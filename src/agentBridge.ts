// Agent 共绘桥（Mode B / B2）：通过 postMessage 接收外部指令，经 Excalidraw API 读写场景。
//
// 安全模型（见 docs/AI_NATIVE.md §7）：
//  - 仅当「Agent 共绘」开启且令牌匹配、且发送方同源（页面内注入的扩展 / userscript）时才响应；
//  - 关闭开关即完全不可被外部驱动；令牌由用户在设置里生成，绝不静默外发画板内容。
//
// 指令协议（消息体）：{ type:"kaiboard-agent-cmd", id?, token, cmd, ... }
//  读：
//   - getBoard        → 返回目标画板 elements
//   - getScreenshot   → 返回目标画板 PNG（base64 data URL）【P0.5 视觉读】
//   - listBoards      → 返回文件树（文件夹 + 画板）【N2】
//  写：
//   - addElement      → 追加 elements（数组或单个），返回稳定 id 列表
//   - patchElement    → 按 id 局部合并属性【N1】
//   - deleteElement   → 按 id 删除元素【N4】
//   - replaceBoard    → 整板替换 elements（敏感动作，自动快照 + toast 透明提示）
//   - createBoard     → 新建空画板，返回 boardId【A1】
//   - fromMermaid     → Mermaid 源码 → 原生 Excalidraw 图元并落板【C5 / P1】
//
// 寻址（N3）：所有画板级指令都接受可选 `boardId`。
//   - 缺省 / 等于当前打开画板 → 走 Excalidraw 实时 API（可撤销、即时重绘）；
//   - 指向其它画板 → 直接读写 IndexedDB（不切画布，规避 canvas 竞态），写完广播树变更事件。
//
// 溯源（C4 源随图走）：写类指令可带 `source`（如生成该图的 mermaid / DSL / 提示词），
//   会落到每个新元素的 customData.__kbSource，getBoard 读回时原样返回，避免「贴图即黑箱」。
//
// 响应：{ type:"kaiboard-agent-resp", id?, ok, ... }

import {
  getSetting,
  setSetting,
  getBoard as dbGetBoard,
  putBoard as dbPutBoard,
  getNode,
  putNode,
  listNodes,
  getMaxOrder,
} from "./db";
import type { BoardData, FileNode } from "./db";

const MSG_CMD = "kaiboard-agent-cmd";
const MSG_RESP = "kaiboard-agent-resp";
const SNAPSHOT_KEY = "agentSnapshots";
const MAX_SNAPSHOTS = 20;

/** 桥写入了「非当前画板」时广播，App 侧据此刷新左侧文件树。 */
export const TREE_CHANGED_EVENT = "kaiboard-tree-changed";

export interface BridgeAPI {
  getSceneElements: () => readonly any[];
  getAppState?: () => any;
  getFiles?: () => any;
  updateScene: (scene: {
    elements?: any[];
    appState?: any;
    captureUpdate?: "IMMEDIATELY" | "EVENTUALLY" | "NEVER";
  }) => void;
}

/** 生成稳定的元素 id（缺失时自动补，供 agent 后续 patch/delete 引用）。 */
function genElementId(): string {
  return "kb_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export type BridgeCmd =
  | "getBoard"
  | "addElement"
  | "replaceBoard"
  | "getScreenshot"
  | "patchElement"
  | "deleteElement"
  | "listBoards"
  | "createBoard"
  | "fromMermaid";

/** C4 源随图走：随图携带的「生成来源」。 */
export interface KbSource {
  /** 来源类型：mermaid / dsl / prompt / url / note ... */
  kind?: string;
  /** 源文本本体 */
  text?: string;
  [k: string]: any;
}

export interface CmdMsg {
  type: string;
  id?: string;
  token: string;
  cmd: BridgeCmd;
  /** addElement / replaceBoard：元素（数组或单个） */
  elements?: any[] | any;
  /** N3 寻址：目标画板 id；缺省 = 当前打开的画板 */
  boardId?: string;
  /** N1 patchElement：[{ id, ...要合并的属性 }] */
  patches?: any[] | any;
  /** N4 deleteElement：要删除的元素 id（数组或单个） */
  ids?: string[] | string;
  /** A1 createBoard：新画板名 / 目标父文件夹（缺省根层） */
  name?: string;
  parentId?: string | null;
  /** fromMermaid：mermaid 源码 */
  mermaid?: string;
  /** C4 源随图走 */
  source?: KbSource | string;
  /** getScreenshot 选项 */
  opts?: {
    maxWidthOrHeight?: number;
    background?: boolean;
    darkMode?: boolean;
    /** fromMermaid：整板替换而非追加 */
    replace?: boolean;
    /** fromMermaid / createBoard 组合：落到新建画板 */
    fontSize?: number;
  };
}

export interface Snapshot {
  boardId: string;
  ts: number;
  elements: any[];
}

/** 列出快照（可选按画板过滤），最新在前。供「快照还原」UI 使用（P0-1 数据安全）。 */
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

let attached = false;
let handlerRef: ((e: MessageEvent) => void) | null = null;

async function pushSnapshot(boardId: string | undefined, elements: readonly any[]) {
  if (!boardId) return;
  try {
    const list = await getSetting<Snapshot[]>(SNAPSHOT_KEY, []);
    list.push({ boardId, ts: Date.now(), elements: JSON.parse(JSON.stringify(elements)) });
    while (list.length > MAX_SNAPSHOTS) list.shift();
    await setSetting(SNAPSHOT_KEY, list);
    try {
      window.dispatchEvent(new CustomEvent("kaiboard-snapshot-pushed"));
    } catch {
      /* 非浏览器环境忽略 */
    }
  } catch {
    /* 快照失败不应阻断主指令 */
  }
}

// ---------- N3 寻址：当前画布 vs 直写 db ----------

/** 目标是否为「非当前打开的画板」（走 db 直读写）。 */
function isRemote(current: string | undefined, target?: string): boolean {
  return !!target && target !== current;
}

/** 读取目标画板的元素。 */
async function readScene(api: BridgeAPI, current: string | undefined, target?: string): Promise<any[]> {
  if (isRemote(current, target)) {
    const b = await dbGetBoard(target!);
    if (!b) throw new Error("board not found: " + target);
    return Array.isArray(b.elements) ? [...b.elements] : [];
  }
  return [...api.getSceneElements()];
}

/** 写回目标画板的元素。远端写会顺带更新节点 updatedAt 并广播树变更。 */
async function writeScene(
  api: BridgeAPI,
  current: string | undefined,
  target: string | undefined,
  els: any[]
): Promise<void> {
  if (isRemote(current, target)) {
    const b = await dbGetBoard(target!);
    const next: BoardData = b
      ? { ...b, elements: els }
      : { id: target!, elements: els, appState: {}, files: {} };
    await dbPutBoard(next);
    try {
      const n = await getNode(target!);
      if (n) await putNode({ ...n, updatedAt: Date.now() });
    } catch {
      /* 节点时间戳更新失败不阻断 */
    }
    broadcastTreeChanged();
    return;
  }
  // N6 撤销集成：captureUpdate:"IMMEDIATELY" 让 agent 动作立即被 Store 捕获、
  // 触发 onChange 与重绘，并且可 Ctrl+Z 撤销。
  api.updateScene({ elements: els, captureUpdate: "IMMEDIATELY" });
}

function broadcastTreeChanged() {
  try {
    window.dispatchEvent(new CustomEvent(TREE_CHANGED_EVENT));
  } catch {
    /* 非浏览器环境忽略 */
  }
}

// ---------- 元素处理工具 ----------

/** 规范化传入元素：补稳定 id + C4 源随图走。返回 [元素数组, id 数组]。 */
function normalizeIncoming(add: any[], source?: KbSource | string): [any[], string[]] {
  const src: KbSource | undefined =
    typeof source === "string" ? { kind: "text", text: source } : source || undefined;
  const ids: string[] = [];
  const norm = add.map((el: any) => {
    if (!el || typeof el !== "object") return el;
    const id = typeof el.id === "string" && el.id ? el.id : genElementId();
    ids.push(id);
    const next: any = { ...el, id };
    if (src) {
      next.customData = { ...(el.customData || {}), __kbSource: { ...src, at: Date.now() } };
    }
    return next;
  });
  return [norm, ids];
}

/** #41 防重叠：非空画板时把新元素整体下移到现有内容下方。 */
function offsetBelow(existing: readonly any[], incoming: any[]): void {
  if (!existing.length || !incoming.length) return;
  const bottom = existing.reduce((m: number, e: any) => {
    const y = typeof e.y === "number" ? e.y : 0;
    const h = typeof e.height === "number" ? e.height : 0;
    return Math.max(m, y + h);
  }, 0);
  const minY = incoming.reduce((m: number, e: any) => {
    const y = typeof e.y === "number" ? e.y : 0;
    return Math.min(m, y);
  }, Infinity);
  const margin = 80;
  const dy = Math.max(0, bottom + margin - minY);
  if (dy > 0) {
    incoming.forEach((e: any) => {
      if (e && typeof e === "object") e.y = (typeof e.y === "number" ? e.y : 0) + dy;
    });
  }
}

/** 内部复用：把一批元素追加到目标画板。 */
async function appendElements(
  api: BridgeAPI,
  current: string | undefined,
  target: string | undefined,
  raw: any[],
  source: KbSource | string | undefined,
  onActivity: (msg: string) => void
): Promise<{ ok: true; added: number; ids: string[] }> {
  const cur = await readScene(api, current, target);
  const [norm, ids] = normalizeIncoming(raw, source);
  offsetBelow(cur, norm);
  await writeScene(api, current, target, [...cur, ...norm]);
  if (norm.length) {
    onActivity(
      isRemote(current, target)
        ? `Agent 共绘：已向其它画板添加 ${norm.length} 个元素`
        : `Agent 共绘：已添加 ${norm.length} 个元素`
    );
  }
  return { ok: true, added: norm.length, ids };
}

// ---------- 指令执行 ----------

/** 执行单条共绘指令；可被 postMessage 监听与本地中继轮询共用。 */
export async function executeCommand(
  api: BridgeAPI,
  token: string,
  onActivity: (msg: string) => void,
  d: CmdMsg,
  boardId?: string
): Promise<{ ok: boolean; [k: string]: any }> {
  if (!d || d.type !== MSG_CMD) return { ok: false, error: "bad type" };
  if (d.token !== token) return { ok: false, error: "bad token" };

  const target = d.boardId;

  try {
    switch (d.cmd) {
      // ---------- 读 ----------
      case "getBoard": {
        const els = await readScene(api, boardId, target);
        return { ok: true, boardId: target || boardId || null, elements: els };
      }

      /** P0.5 视觉读：把目标画板渲成 PNG（base64 data URL）交回 Agent 自查。 */
      case "getScreenshot": {
        const { exportToBlob } = await import("@excalidraw/excalidraw");
        const els = await readScene(api, boardId, target);
        if (!els.length) return { ok: true, empty: true, dataUrl: null, boardId: target || boardId || null };
        let files: any = {};
        let appState: any = {};
        if (isRemote(boardId, target)) {
          const b = await dbGetBoard(target!);
          files = b?.files || {};
          appState = b?.appState || {};
        } else {
          files = api.getFiles ? api.getFiles() : {};
          appState = api.getAppState ? api.getAppState() : {};
        }
        const o = d.opts || {};
        const blob = await exportToBlob({
          elements: els as any,
          files: files || null,
          appState: {
            ...appState,
            exportBackground: o.background !== false,
            exportWithDarkMode: !!o.darkMode,
          } as any,
          mimeType: "image/png",
          maxWidthOrHeight: o.maxWidthOrHeight || 1400,
        });
        const dataUrl = await blobToDataUrl(blob);
        return {
          ok: true,
          boardId: target || boardId || null,
          mimeType: "image/png",
          bytes: blob.size,
          dataUrl,
        };
      }

      /** N2：返回文件树（文件夹 + 画板），供 Agent 寻址。 */
      case "listBoards": {
        const nodes = await listNodes();
        const slim = nodes.map((n: FileNode) => ({
          id: n.id,
          type: n.type,
          name: n.name,
          parentId: n.parentId,
          updatedAt: n.updatedAt,
        }));
        return { ok: true, activeBoardId: boardId || null, nodes: slim };
      }

      // ---------- 写 ----------
      case "addElement": {
        const add = Array.isArray(d.elements) ? d.elements : d.elements ? [d.elements] : [];
        if (!add.length) return { ok: true, added: 0, ids: [] };
        return await appendElements(api, boardId, target, add, d.source, onActivity);
      }

      /** N1：按 id 局部合并属性（不存在的 id 记入 missing）。 */
      case "patchElement": {
        const raw = Array.isArray(d.patches) ? d.patches : d.patches ? [d.patches] : [];
        if (!raw.length) return { ok: true, patched: 0, missing: [] };
        const cur = await readScene(api, boardId, target);
        const byId = new Map<string, any>();
        for (const p of raw) if (p && typeof p === "object" && typeof p.id === "string") byId.set(p.id, p);
        const missing: string[] = [];
        for (const id of byId.keys()) if (!cur.some((e: any) => e && e.id === id)) missing.push(id);
        let patched = 0;
        const next = cur.map((e: any) => {
          if (!e || typeof e !== "object") return e;
          const p = byId.get(e.id);
          if (!p) return e;
          patched++;
          const merged: any = { ...e, ...p, id: e.id, versionNonce: Math.floor(Math.random() * 2 ** 31) };
          if (p.customData || e.customData) {
            merged.customData = { ...(e.customData || {}), ...(p.customData || {}) };
          }
          return merged;
        });
        if (patched) {
          await writeScene(api, boardId, target, next);
          onActivity(`Agent 共绘：已修改 ${patched} 个元素`);
        }
        return { ok: true, patched, missing };
      }

      /** N4：按 id 删除元素。 */
      case "deleteElement": {
        const ids = Array.isArray(d.ids) ? d.ids : d.ids ? [d.ids] : [];
        if (!ids.length) return { ok: true, deleted: 0, missing: [] };
        const cur = await readScene(api, boardId, target);
        const set = new Set(ids);
        const missing = ids.filter((id) => !cur.some((e: any) => e && e.id === id));
        const next = cur.filter((e: any) => !(e && set.has(e.id)));
        const deleted = cur.length - next.length;
        if (deleted) {
          await writeScene(api, boardId, target, next);
          onActivity(`Agent 共绘：已删除 ${deleted} 个元素`);
        }
        return { ok: true, deleted, missing };
      }

      case "replaceBoard": {
        const raw = Array.isArray(d.elements) ? d.elements : [];
        const before = await readScene(api, boardId, target);
        await pushSnapshot(target || boardId, before);
        const [els] = normalizeIncoming(raw, d.source);
        await writeScene(api, boardId, target, els);
        onActivity(`Agent 共绘：已整板替换（${els.length} 个元素）`);
        return { ok: true, replaced: els.length };
      }

      /** A1：新建空画板（直写 db，不切画布），返回 boardId。 */
      case "createBoard": {
        const now = Date.now();
        const id = crypto.randomUUID();
        const parentId = d.parentId ?? null;
        if (parentId) {
          const p = await getNode(parentId);
          if (!p || p.type !== "folder") return { ok: false, error: "parent folder not found: " + parentId };
        }
        const order = (await getMaxOrder(parentId)) + 1;
        const node: FileNode = {
          id,
          type: "board",
          name: (d.name || "").trim() || "Agent 画板",
          parentId,
          createdAt: now,
          updatedAt: now,
          order,
        };
        await putNode(node);
        const init = Array.isArray(d.elements) ? d.elements : [];
        const [els] = normalizeIncoming(init, d.source);
        await dbPutBoard({ id, elements: els, appState: {}, files: {} });
        broadcastTreeChanged();
        onActivity(`Agent 共绘：已新建画板「${node.name}」`);
        return { ok: true, boardId: id, name: node.name, added: els.length };
      }

      /** C5 / P1：Mermaid → 原生可编辑 Excalidraw 图元。 */
      case "fromMermaid": {
        const src = (d.mermaid || "").trim();
        if (!src) return { ok: false, error: "empty mermaid" };
        const [{ parseMermaidToExcalidraw }, { convertToExcalidrawElements }] = await Promise.all([
          import("@excalidraw/mermaid-to-excalidraw"),
          import("@excalidraw/excalidraw"),
        ]);
        let skeleton: any;
        try {
          skeleton = await parseMermaidToExcalidraw(src, {
            themeVariables: { fontSize: `${d.opts?.fontSize || 16}px` },
          });
        } catch (e: any) {
          return { ok: false, error: "mermaid parse failed: " + (e?.message || String(e)) };
        }
        const converted = convertToExcalidrawElements(skeleton.elements as any) as any[];
        // C4：mermaid 源码天然就是「源随图走」的最佳载体
        const source: KbSource = { kind: "mermaid", text: src, ...(typeof d.source === "object" ? d.source : {}) };
        if (d.opts?.replace) {
          const before = await readScene(api, boardId, target);
          await pushSnapshot(target || boardId, before);
          const [els] = normalizeIncoming(converted, source);
          await writeScene(api, boardId, target, els);
          onActivity(`Agent 共绘：Mermaid 已整板落图（${els.length} 个元素）`);
          return { ok: true, replaced: els.length, files: skeleton.files ? Object.keys(skeleton.files).length : 0 };
        }
        const r = await appendElements(api, boardId, target, converted, source, onActivity);
        return { ...r, fromMermaid: true };
      }

      default:
        return { ok: false, error: "unknown cmd" };
    }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
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

function makeHandler(api: BridgeAPI, token: string, onActivity: (msg: string) => void, boardId?: string) {
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
      executeCommand(api, token, onActivity, d, boardId).then(reply).catch(() => reply({ ok: false, error: "exec failed" }));
    } catch {
      /* 单条指令异常不影响整体 */
    }
  };
}

/** 挂载 / 重挂监听。enabled 或 token 变化时调用即可；幂等（先移除旧监听）。 */
export async function initAgentBridge(api: BridgeAPI, onActivity: (msg: string) => void, boardId?: string): Promise<void> {
  if (attached && handlerRef) {
    window.removeEventListener("message", handlerRef);
    attached = false;
    handlerRef = null;
  }
  const enabled = await getSetting<boolean>("agentCollabEnabled", false);
  const token = await getSetting<string>("agentCollabToken", "");
  if (!enabled || !token) return;
  handlerRef = makeHandler(api, token, onActivity, boardId);
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
