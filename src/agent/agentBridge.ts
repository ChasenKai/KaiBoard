// Agent 共绘桥：postMessage 传输层 + App 存储适配层。
//
// 指令逻辑已抽到 @kaibuddy/kaiboard-core（./core/）。本文件只负责：
//   - postMessage 监听器（同源校验 + 令牌校验）
//   - 把 BridgeAPI 包成 StorageAdapter（createAppStorageAdapter）
//   - 截图渲染钩子（renderPng，依赖浏览器 canvas，仅 app 注入）
//   - 兼容旧签名的 listSnapshots / restoreSnapshotToApi / executeCommand
// 对外导出与历史版本保持一致，App.tsx / 中继客户端零改动。
//
// 安全模型：
//  - 仅当「Agent 共绘」开启且令牌匹配、且发送方同源（页面内注入的扩展 / userscript）时才响应；
//  - 关闭开关即完全不可被外部驱动；令牌由用户在设置里生成，绝不静默外发画板内容。

import {
  getSetting,
  setSetting,
  getBoard as dbGetBoard,
  putBoard as dbPutBoard,
  getNode as dbGetNode,
  putNode as dbPutNode,
  listNodes as dbListNodes,
  getMaxOrder as dbGetMaxOrder,
  trashNode as dbTrashNode,
  listTrashRoots as dbListTrashRoots,
  restoreNode as dbRestoreNode,
} from "../db";
import type { BoardData, FileNode } from "../db";
// 仅类型导入（编译期擦除、零运行时成本）：把 BridgeAPI 锚定到 Excalidraw 的**真实签名**，
// 使 tsc 能校验我们每一次对 excalidrawAPI 的调用（见 BridgeAPI 的注释）。
import type {
  ExcalidrawImperativeAPI,
  Collaborator,
  SocketId,
} from "@excalidraw/excalidraw/types";
// 命令内核不再自带副本，改为引用单一真源
// （来自 npm 包 @kaibuddy/kaiboard-core —— 不再跨仓引用源码，确保 CI/CF 能构建）。
// 加/改命令只需改那一处，两侧（MCP --dir 模式 与 页面端 relay 模式）同时生效。
import {
  executeCommand as coreExecuteCommand,
  SNAPSHOT_KEY,
} from "@kaibuddy/kaiboard-core";
import type {
  StorageAdapter,
  AgentCommand,
  AgentCmd,
  KbSource,
  Snapshot,
} from "@kaibuddy/kaiboard-core";

const MSG_CMD = "kaiboard-agent-cmd";
const MSG_RESP = "kaiboard-agent-resp";

/** 桥改动了画板（新建 / 远端改图）时广播，App 侧据此刷新左侧文件树。 */
export const TREE_CHANGED_EVENT = "kaiboard-tree-changed";

/**
 * Agent 在某个画板上「活跃」（发生写入）时广播，App 侧据此点亮树里对应节点。
 *
 * 与 TREE_CHANGED_EVENT 的区别：本事件**每次写入都发、且包含当前画板**。
 * 当前画板的写入不改树结构，因此此前不发 TREE_CHANGED_EVENT，
 * 也就无从体现「Agent 正在动这块板」——这正是要补的缺口。
 *
 * ⚠️ 事件名在 `agentIntegration.tsx` 里以**字面量**重复出现（那边刻意不做值导入，
 * 以免把本模块拽进主包）。改这里必须同步改那边，两处字符串要一致。
 */
export const AGENT_ACTIVITY_EVENT = "kaiboard-agent-activity";

/**
 * App 侧真正用到的 Excalidraw 能力子集。
 *
 * ⚠️ **必须从 Excalidraw 的真实类型派生，不能手写镜像。**
 *
 * 教训：初版是手写的 `{ elements?, appState?, captureUpdate? }`，
 * 漏了顶层字段 `collaborators`，于是我把 `collaborators` 塞进 `appState` 也照样编译通过。
 * 而 `appState` 在内核里走的是 `this.setState(...)`（装着 `activeTool` 等**实时交互状态**），
 * 直接造成「Agent 一写入，用户就选不了工具」（用户实测）。
 *
 * 真实签名是 `appState?: Pick<AppState, K> | null` —— `collaborators` 根本不是 AppState 的键，
 * 派生之后 tsc 会当场拦下这类错。**手写镜像会让 tsc 这个唯一门禁失效。**
 */
export type BridgeAPI = Pick<
  ExcalidrawImperativeAPI,
  "getSceneElements" | "getAppState" | "getFiles" | "updateScene" | "scrollToContent"
>;

/** 指令枚举（与 core AgentCmd 对齐）。 */
export type BridgeCmd = AgentCmd;
export type { KbSource, Snapshot };

/** 传输层指令体（含 type / token，由传输层剥离后转交 core 的 AgentCommand）。 */
export interface CmdMsg {
  type: string;
  id?: string;
  token: string;
  cmd: BridgeCmd;
  /** addElement / replaceBoard：元素（数组或单个） */
  elements?: any[] | any;
  /** 目标画板 id；缺省 = 当前打开的画板 */
  boardId?: string;
  /** patchElement：[{ id, ...要合并的属性 }] */
  patches?: any[] | any;
  /** deleteElement：要删除的元素 id（数组或单个） */
  ids?: string[] | string;
  /** A1 createBoard：新画板名 / 目标父文件夹（缺省根层） */
  name?: string;
  parentId?: string | null;
  /** renameFolder / deleteFolder：目标文件夹 id */
  folderId?: string;
  /** moveNode / reorderNode / restoreNode：目标节点 id */
  nodeId?: string;
  /** reorderNode：同层排序权重 */
  order?: number;
  /** fromMermaid：mermaid 源码 */
  mermaid?: string;
  /** 源随图走 */
  source?: KbSource | string;
  /** getScreenshot / fromMermaid 选项 */
  opts?: {
    maxWidthOrHeight?: number;
    background?: boolean;
    darkMode?: boolean;
    /** fromMermaid：整板替换而非追加 */
    replace?: boolean;
    fontSize?: number;
  };
}

// ---------- App 存储适配层（BridgeAPI → StorageAdapter） ----------

function broadcastTreeChanged(boardId?: string) {
  try {
    window.dispatchEvent(new CustomEvent(TREE_CHANGED_EVENT, { detail: { boardId } }));
  } catch {
    /* 非浏览器环境忽略 */
  }
}

/** 广播「Agent 在这块板上活跃」。每次写入都调用（含当前画板），驱动 App 侧树上高亮续期。 */
function broadcastAgentActivity(boardId?: string) {
  if (!boardId) return;
  try {
    window.dispatchEvent(new CustomEvent(AGENT_ACTIVITY_EVENT, { detail: { boardId } }));
  } catch {
    /* 非浏览器环境忽略 */
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("read blob failed"));
    fr.readAsDataURL(blob);
  });
}

/**
 * 把「Agent 写进来的元素」过一遍 Excalidraw 官方的元素归一化 `restoreElements`。
 *
 * 🔴 为什么必须做（关键根因）：
 * KaiBoard 正常载入画板时会走官方 `restore()`（见 App.tsx 载入路径），把元素补齐/修复成**合法**形态；
 * 但 **Agent 写入路径绕过了它**，直接把稀疏元素塞进 `updateScene` —— 回读可见缺
 * `seed` / `isDeleted` / `locked` / `groupIds` / `boundElements` / `roundness`，且 `version: null`。
 * 内核的**命中判定**依赖这些字段，于是用户表现为：
 *   **「箭头框选 / 橡皮 / 点文字都不行，但凭空画矩形椭圆可以」**
 * 且 **切一次画板就恢复**（切回来 = 又走了一遍 restore）。← 用户实测原话，与推理完全吻合。
 * 归一化后，Agent 写入与正常载入走**同一套元素契约**。
 *
 * 非阻断：模块缺失或 restore 抛错时原样返回（退回旧行为），绝不影响写入本身。
 */
let restoreElementsFn: ((els: any, local?: any, opts?: any) => any[]) | null | undefined;
async function normalizeForScene(api: BridgeAPI, els: any[]): Promise<any[]> {
  try {
    if (restoreElementsFn === undefined) {
      const m: any = await import("@excalidraw/excalidraw");
      restoreElementsFn = typeof m.restoreElements === "function" ? m.restoreElements : null;
    }
    if (!restoreElementsFn) return els;
    // 传当前场景作为 localElements，让元素间的绑定关系（箭头 ↔ 图形）也能被修复
    return restoreElementsFn(els, api.getSceneElements());
  } catch {
    return els;
  }
}

/**
 * 🔬 诊断开关：置 false 时**完全跳过 presence 注入**，其它行为一行不改。
 * 曾用它做单变量实验（怀疑 presence 干扰交互）；后定位到真正根因是
 * **Agent 写入绕过元素归一化**（见 `normalizeForScene`），presence 与此无关 → 已恢复 true。
 * 保留该开关以备将来再排查画布交互问题。
 */
const AGENT_PRESENCE_ENABLED = true;

/** 画布内 presence 持续时长（ms）。语义 = 每次写入**续期**，停手后自然消退。
 * 取 20s 而非 10s：10s 常「还没感受到就没了」，20s 让用户来得及注意到。 */
const AGENT_PRESENCE_MS = 20000;

/**
 * 一批画完后，是否「按需把视图带过去」。
 * 策略：**只在绘制停下之后、且新内容真的落在视口外时才用一下**，
 * **绘制过程中绝不动视口** —— 既解决「Agent 追加到下方导致用户看不到」，又几乎不打扰（U7）。
 * 想彻底关掉就置 false。
 */
const AGENT_AUTOSCROLL_ON_IDLE = true;

/**
 * 虚拟协作者 id / 名字：Agent 在画布上的「他人」身份（走 Excalidraw 原生 collaborator 通道）。
 *
 * **命名约定**：凡由 KaiBoard 主动注入的虚拟协作者一律用 `kaiboard-` 前缀，
 * 便于将来多个身份共存时互相区分、**各自只清自己那一项**。当前只有一个：
 *   - `kaiboard-agent` —— 代表「有 Agent 在写这块画布」。
 * 将来若需并存的身份（如第二个 Agent、或流式绘制的独立指示），
 * **追加后缀即可**（`kaiboard-agent-2` / `kaiboard-stream` …），互不干扰；
 * **不要**改用无前缀名 —— 真实多人协作时协作者 id 由 socket id 生成，无前缀会撞车。
 */
const AGENT_COLLAB_ID = "kaiboard-agent";

/** presence 续期计时器：连续写入时不断重置，避免前一批的 timer 把后一批的 presence 提前清掉。 */
let presenceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 这批元素是否**没有完整落在当前视口内**（用于决定要不要自动滚动）。
 *
 * Excalidraw 的 `scrollX/scrollY` 是**场景坐标**下的偏移：屏幕坐标 = (scene + scroll) × zoom，
 * 故可见场景矩形 = `[-scrollX, -scrollX + width/zoom] × [-scrollY, -scrollY + height/zoom]`。
 * 任一步取不到值就返回 false —— **宁可不滚，也不误滚**。
 */
function batchOutsideViewport(api: BridgeAPI, els: any[]): boolean {
  try {
    const st = api.getAppState?.();
    if (!st) return false;
    const zoom = st.zoom && typeof st.zoom === "object" ? st.zoom.value : st.zoom;
    if (typeof zoom !== "number" || !zoom) return false;
    if (
      typeof st.scrollX !== "number" ||
      typeof st.scrollY !== "number" ||
      typeof st.width !== "number" ||
      typeof st.height !== "number"
    ) {
      return false;
    }
    const x0 = -st.scrollX;
    const y0 = -st.scrollY;
    const x1 = x0 + st.width / zoom;
    const y1 = y0 + st.height / zoom;
    const M = 40; // 容差：贴边/只露一角不算「需要滚」，避免过度打扰
    for (const e of els) {
      if (!e || typeof e.x !== "number" || typeof e.y !== "number") continue;
      const w = typeof e.width === "number" ? e.width : 0;
      const h = typeof e.height === "number" ? e.height : 0;
      const fullyVisible =
        e.x >= x0 + M && e.y >= y0 + M && e.x + w <= x1 - M && e.y + h <= y1 - M;
      if (!fullyVisible) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 画布内 presence：用 Excalidraw **原生 collaborator（协作他人）通道**点亮 Agent 刚写入的元素。
 *
 * 为什么用 collaborator：
 *  - 用户要求「Agent 的高亮必须与用户自己的选中区分开，且无论何时都能看出 Agent 在操作哪个画布」。
 *    借用 `appState.selectedElementIds` 会**抢用户的选中**，直接违背该要求（初版如此，已改）。
 *  - collaborator 是 Excalidraw 原生渲染的「他人 presence」：按其 `color` 给
 *    `selectedElementIds` 里的元素画**半透明彩色协作描边**（用户描述的「透明其他色 + 带点边线」），
 *    并渲染一个**带用户名的协作光标** —— 与用户自己的选中是两套独立视觉，互不干扰。
 *  - 纯公开 API（`updateScene({ appState: { collaborators } })`），不 fork、不改内核，
 *    符合「跟随上游升级」的偏好。KaiBoard 自身从不使用 `collaborators`
 *    （仅在导入/还原时防御性删除），这条通道本来就是空的。
 *
 * 非侵入保证：① 任何异常都不影响写入本身；② 只点亮「本次新增 / versionNonce 变了」的元素；
 * ③ 到期只摘掉自己那一项，**全程不碰用户的选中态**。
 */
function showAgentPresence(api: BridgeAPI, els: any[], beforeSig: Map<string, any>) {
  try {
    if (!AGENT_PRESENCE_ENABLED) return; // 🔬 诊断开关：关掉后本函数完全不动，用于单变量定位
    if (!api.getAppState) return;
    // U6/U7：用户正在手绘 / 缩放拖拽时不注入 presence —— 不与用户当前操作打架。
    // （presence 只是增强项，跳过它不影响本次写入本身。）
    const live = api.getAppState?.();
    if (live?.newElement || live?.resizingElement || live?.multiElement) return;
    const fresh = (els || []).filter((e: any) => {
      if (!e || typeof e.id !== "string") return false;
      if (!beforeSig.has(e.id)) return true; // 本次新增
      const prevNonce = beforeSig.get(e.id);
      return (
        prevNonce !== undefined &&
        e.versionNonce !== undefined &&
        prevNonce !== e.versionNonce
      ); // 本次被改（patchElement 会换 versionNonce）
    });
    if (!fresh.length) return;
    const ids: string[] = fresh.map((e: any) => e.id);

    // 「Agent 光标」放在本批内容的中心。加它是为了**保底可见**：协作描边依赖内核渲染细节，
    // 而协作光标是 Excalidraw 的稳定特性、且自带用户名标签（"Agent"），一眼就能读懂。
    const n = fresh.length;
    const cx = fresh.reduce((s: number, e: any) => s + (e.x || 0) + (e.width || 0) / 2, 0) / n;
    const cy = fresh.reduce((s: number, e: any) => s + (e.y || 0) + (e.height || 0) / 2, 0) / n;

    // **合并**进现有 Map，而不是整体替换：将来若有多个虚拟协作者（多 Agent / 流式指示）
    // 共存，彼此不得互相清掉。命名约定见上方 AGENT_COLLAB_ID 注释。
    // 注：collaborators 的键是**品牌类型** `SocketId`（平时由 socket 层生成）；我们是本地注入、
    // 没有真实 socket，所以必须显式断言 —— 这层断言是本文件里唯一必要的。
    const existing: Map<SocketId, Collaborator> =
      api.getAppState?.()?.collaborators instanceof Map
        ? (api.getAppState()!.collaborators as Map<SocketId, Collaborator>)
        : new Map<SocketId, Collaborator>();
    const collaborators = new Map<SocketId, Collaborator>(existing);
    // ⚠️ `selectedElementIds` 要的是**对象映射** `{ [id]: true }`，**不是数组**。
    // 初版传了 `string[]`（手写镜像把类型检查废掉了）→ 协作描边从未渲染，
    // 用户只看到协作光标、看不到元素描边。此处为修正点。
    const sel: Record<string, true> = {};
    for (const id of ids) sel[id] = true;
    collaborators.set(AGENT_COLLAB_ID as unknown as SocketId, {
      id: AGENT_COLLAB_ID as unknown as SocketId,
      username: "Agent",
      color: { background: "rgba(34, 197, 94, 0.18)", stroke: "#22c55e" },
      selectedElementIds: sel,
      pointer: { x: cx, y: cy, tool: "pointer" },
      button: "up",
    });
    // ⚠️ `collaborators` 是 `updateScene` 的**顶层字段**，绝不能塞进 `appState`。
    // 依据内核实现（@excalidraw/excalidraw dist/dev/index.js 的 updateScene）：
    //   if (sceneData.appState)       this.setState(sceneData.appState);      // 写进实时交互状态（含 activeTool！）
    //   if (sceneData.elements)       this.scene.replaceAllElements(...);
    //   if (sceneData.collaborators)  this.setState({ collaborators });       // ← 正确通道
    // 曾误把 collaborators 放进 appState：结果是每次写入都往**交互状态**里写东西、
    // 还会被并进 history 快照 —— 表现为「Agent 一操作，用户就选不了工具」。
    // 现在的调用只给顶层 collaborators，**不传 appState、不传 captureUpdate** → 副作用最小。
    api.updateScene({ collaborators });

    if (presenceTimer) clearTimeout(presenceTimer);
    presenceTimer = setTimeout(() => {
      presenceTimer = null;
      try {
        const cur = api.getAppState?.()?.collaborators;
        // 只摘掉我们自己那一项，**绝不整体清空** —— 别人的协作者不归我们管。
        if (cur instanceof Map && cur.has(AGENT_COLLAB_ID as unknown as SocketId)) {
          const next = new Map(cur as Map<SocketId, Collaborator>);
          next.delete(AGENT_COLLAB_ID as unknown as SocketId);
          // 同上去：走顶层 collaborators 字段，不碰 appState。
          api.updateScene({ collaborators: next });
        }
        // U7：**绘制停下之后**才考虑把视图带过去；且只在新内容真的在视口外时，**一次**。
        // 绘制中不动 → 不会边画边跳；画完若本来就看得见 → 也不动。
        if (AGENT_AUTOSCROLL_ON_IDLE && api.scrollToContent && batchOutsideViewport(api, fresh)) {
          api.scrollToContent(fresh, { fitToViewport: true, animate: true, duration: 300 });
        }
      } catch {
        /* 页面已卸载，忽略 */
      }
    }, AGENT_PRESENCE_MS);
  } catch {
    /* presence 属增强项，任何异常都不应阻断写入 */
  }
}

/**
 * 把 App 的 BridgeAPI 包成存储无关的 StorageAdapter。
 * - 当前画板走 Excalidraw 实时 API（可撤销、即时重绘）；
 * - 其它画板直写 IndexedDB（不切画布，规避 canvas 竞态），写完广播树变更事件。
 */
export function createAppStorageAdapter(api: BridgeAPI, currentBoardId: string | undefined): StorageAdapter {
  const isRemote = (target?: string) => !!target && target !== currentBoardId;

  return {
    currentBoardId,
    async readElements(target?: string): Promise<any[]> {
      if (isRemote(target)) {
        const b = await dbGetBoard(target!);
        if (!b) throw new Error("board not found: " + target);
        return Array.isArray(b.elements) ? [...b.elements] : [];
      }
      return [...api.getSceneElements()];
    },
    async readMeta(target?: string): Promise<{ elements: any[]; files: any; appState: any }> {
      if (isRemote(target)) {
        const b = await dbGetBoard(target!);
        return { elements: b?.elements || [], files: b?.files || {}, appState: b?.appState || {} };
      }
      return {
        elements: [...api.getSceneElements()],
        files: api.getFiles ? api.getFiles() : {},
        appState: api.getAppState ? api.getAppState() : {},
      };
    },
    async writeElements(target: string | undefined, els: any[]): Promise<void> {
      // 🔴 归一化（本次修复的核心）：Agent 写入必须与「正常载入画板」走**同一套元素契约**。
      // 不做的话，稀疏元素会让内核命中判定失效 → 用户的「选择 / 橡皮 / 文字失灵、切画板才恢复」。
      // 这里直接就地覆盖入参（唯一改动点），下游所有分支自动受益（relay 写入 + 远端落库）。
      els = await normalizeForScene(api, els);
      if (isRemote(target)) {
        const b = await dbGetBoard(target!);
        const next: BoardData = b
          ? { ...b, elements: els }
          : { id: target!, elements: els, appState: {}, files: {} };
        await dbPutBoard(next);
        try {
          const n = await dbGetNode(target!);
          if (n) await dbPutNode({ ...n, updatedAt: Date.now() });
        } catch {
          /* 节点时间戳更新失败不阻断 */
        }
        broadcastTreeChanged(target!);
        broadcastAgentActivity(target!);
        return;
      }
      // 先记下写入前的「id → versionNonce」，写入后据此挑出「本次新增 / 被改」的元素做 presence 点亮。
      const beforeSig = new Map<string, any>();
      for (const e of api.getSceneElements() || []) {
        if (e && typeof e.id === "string") beforeSig.set(e.id, e.versionNonce);
      }

      // 撤销集成：captureUpdate:"IMMEDIATELY" 让 agent 动作立即被 Store 捕获、可 Ctrl+Z 撤销
      api.updateScene({ elements: els, captureUpdate: "IMMEDIATELY" });
      // 点亮本次新增/被改的元素（原生 collaborator 描边，全程不碰用户的选中态）
      showAgentPresence(api, els, beforeSig);
      // Agent 活跃事件：**当前画板也要发** —— 树侧据此点亮本节点，
      // 满足「不管 Agent 动的是不是用户当前打开的板，都要能看出是哪块」。
      broadcastAgentActivity(target || currentBoardId);

      // 立即落盘：走 updateScene 只改内存里的当前画面，
      // 真正进库要等 App 的防抖保存（500ms）。两个问题：
      //   ① 后台标签页会被浏览器节流，防抖保存可能迟迟不触发 → Agent 写完读回旧值/空，
      //      误判失败并重试（这也是"写入后必须 sleep ≥1.5s 再读"这条纪律的根因）；
      //   ② 写完立刻关页面会丢数据。
      // 这里补一次同步落盘，让"命令返回成功"= 数据已进库，不依赖防抖。
      try {
        const id = target || currentBoardId;
        if (id) {
          await dbPutBoard({
            id,
            elements: els,
            files: api.getFiles ? api.getFiles() : {},
            appState: api.getAppState ? api.getAppState() : {},
          });
        }
      } catch {
        /* 落盘失败不阻断：画面已更新，仍可等防抖保存兜底 */
      }
    },
    async listBoards(): Promise<FileNode[]> {
      return dbListNodes();
    },
    async getNode(id: string): Promise<FileNode | undefined> {
      return dbGetNode(id);
    },
    async putNode(node: FileNode): Promise<void> {
      await dbPutNode(node);
      broadcastTreeChanged(node.id);
      broadcastAgentActivity(node.id); // createBoard：让新画板节点也点亮
    },
    async putBoardData(id: string, data: BoardData): Promise<void> {
      await dbPutBoard({ id, ...data });
      broadcastTreeChanged(id);
      broadcastAgentActivity(id);
    },
    /** listTrash：回收站顶层条目（仅用户直接删除的那一层）。 */
    async listTrash(): Promise<FileNode[]> {
      return dbListTrashRoots();
    },
    /** restoreNode：从回收站递归还原，随后刷新文件树。 */
    async restoreNode(id: string): Promise<void> {
      await dbRestoreNode(id);
      broadcastTreeChanged(id);
    },
    /** deleteBoard / deleteFolder：软删除（进回收站，可还原），随后刷新文件树。
     *  刻意不发活跃事件：该节点随即从树上消失，点它没有意义。 */
    async trashNode(id: string): Promise<void> {
      await dbTrashNode(id);
      broadcastTreeChanged(id);
    },
    async getMaxOrder(parentId: string | null): Promise<number> {
      return dbGetMaxOrder(parentId);
    },
    async getSetting<T>(key: string, fallback: T): Promise<T> {
      return getSetting<T>(key, fallback);
    },
    async setSetting(key: string, value: any): Promise<void> {
      return setSetting(key, value);
    },
    // 仅 app 注入：浏览器有 canvas，可 exportToBlob；MCP --dir 不注入 → 标记不支持
    async renderPng(
      elements: any[],
      files: any,
      appState: any,
      opts: any,
    ): Promise<{ dataUrl: string; bytes: number }> {
      const { exportToBlob } = await import("@excalidraw/excalidraw");
      const blob = await exportToBlob({
        elements: elements as any,
        files: files || null,
        appState: {
          ...appState,
          exportBackground: opts?.background !== false,
          exportWithDarkMode: !!opts?.darkMode,
        } as any,
        mimeType: "image/png",
        maxWidthOrHeight: opts?.maxWidthOrHeight || 1400,
      });
      const dataUrl = await blobToDataUrl(blob);
      return { dataUrl, bytes: blob.size };
    },
  };
}

// ---------- 指令执行（兼容旧签名） ----------

/** 兼容历史签名：先校验 type/token（传输层职责），再代理到 core 执行器。 */
export async function executeCommand(
  api: BridgeAPI,
  token: string,
  onActivity: (msg: string) => void,
  d: CmdMsg,
  boardId?: string,
): Promise<{ ok: boolean; [k: string]: any }> {
  if (!d || d.type !== MSG_CMD) return { ok: false, error: "bad type" };
  if (d.token !== token) return { ok: false, error: "bad token" };
  const adapter = createAppStorageAdapter(api, boardId);
  return coreExecuteCommand(adapter, onActivity, d as unknown as AgentCommand);
}

// ---------- 快照（app 侧，沿用 db 直读，保持 listSnapshots(boardId?) 旧签名） ----------

/** 列出快照（可选按画板过滤），最新在前。供「快照还原」UI 使用。 */
export async function listSnapshots(boardId?: string): Promise<Snapshot[]> {
  try {
    const list = await getSetting<Snapshot[]>(SNAPSHOT_KEY, []);
    const filtered = boardId ? list.filter((s) => s.boardId === boardId) : list;
    return [...filtered].sort((a, b) => b.ts - a.ts);
  } catch {
    return [];
  }
}

/** 把一份快照的元素还原到当前画布（captureUpdate:IMMEDIATELY → 可 Ctrl+Z 撤销）。 */
export async function restoreSnapshotToApi(api: BridgeAPI, snap: Snapshot): Promise<void> {
  if (!api || !snap) return;
  api.updateScene({
    elements: JSON.parse(JSON.stringify(snap.elements)),
    captureUpdate: "IMMEDIATELY",
  });
}

// ---------- postMessage 传输层 ----------

let attached = false;
let handlerRef: ((e: MessageEvent) => void) | null = null;

function makeHandler(
  api: BridgeAPI,
  token: string,
  onActivity: (msg: string) => void,
  boardId?: string,
) {
  return (e: MessageEvent) => {
    try {
      if (e.origin !== window.location.origin) return; // 仅接受同源页面内注入方
      const d = e.data as CmdMsg;
      const reply = (payload: any) => {
        const src = e.source as Window | null;
        if (src && typeof src.postMessage === "function") {
          src.postMessage({ type: MSG_RESP, id: d.id, ...payload }, e.origin);
        }
      };
      executeCommand(api, token, onActivity, d, boardId)
        .then(reply)
        .catch(() => reply({ ok: false, error: "exec failed" }));
    } catch {
      /* 单条指令异常不影响整体 */
    }
  };
}

/** 挂载 / 重挂监听。enabled 或 token 变化时调用即可；幂等（先移除旧监听）。 */
export async function initAgentBridge(
  api: BridgeAPI,
  onActivity: (msg: string) => void,
  boardId?: string,
): Promise<void> {
  if (attached && handlerRef) {
    window.removeEventListener("message", handlerRef);
    attached = false;
    handlerRef = null;
  }
  const enabled = await getSetting<boolean>("agentCollabEnabled", false);
  const storedToken = await getSetting<string>("agentCollabToken", "");
  if (!enabled || !storedToken) return;
  handlerRef = makeHandler(api, storedToken, onActivity, boardId);
  window.addEventListener("message", handlerRef);
  attached = true;
}

/** 生成一个随机连接令牌（24 字节十六进制）。 */
export function generateAgentToken(): string {
  const a = new Uint8Array(24);
  (window.crypto as Crypto).getRandomValues(a);
  return Array.from(a)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
