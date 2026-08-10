import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Excalidraw, FONT_FAMILY, restore, WelcomeScreen, sceneCoordsToViewportCoords } from "@excalidraw/excalidraw";
import { FAVICON_DATA_URI } from "./favicon";

import {
  listNodes,
  listAllNodes,
  getAllBoards,
  putNode,
  listChildren,
  getBoard,
  putBoard,
  getNode,
  getMaxOrder,
  trashNode,
  listTrashRoots,
  restoreNode,
  purgeNode,
  emptyTrash,
  getSetting,
  setSetting,
  ensureStorage,
  activateFsBackend,
  resetBackend,
  getBackend,
} from "./db";
import type { FileNode, BoardData } from "./db";
import { t, getLang, setLang, LANGS, isLang, type Lang } from "./i18n";
import { fsSupported, fsCopyFromIdb, fsMergeFromIdb, fsPeekFolder, fsExportAll } from "./fsStore";
import { useAgentIntegration, AIPanel } from "./agentIntegration";
import AnnouncementBar from "./AnnouncementBar";
import Sidebar from "./Sidebar";

// 双路发布开关：默认开启（带 AI 版）；基础版构建用 VITE_AI_ENABLED=false。
// 仅控制「是否渲染 Agent 共绘设置面板」；真正的 AI 协议层隔离在 agentIntegration.tsx 内（动态 import）。
const AI_ENABLED = import.meta.env.VITE_AI_ENABLED !== "false";

// 版本号真源 = package.json 的 version（与 CHANGELOG / 关于口径一致，不剧透构建通道 / AI 版）
const APP_VERSION = (pkg as any).version as string;

import ContextMenu from "./ContextMenu";
import TrashPanel from "./TrashPanel";
import HelpDialog from "./HelpDialog";
import { exportAll, exportBoard, importFile } from "./exportImport";
import type { ExportItem } from "./exportPptx";
import CommentPanel, { type CommentItem } from "./CommentPanel";
import pkg from "../package.json";

type CtxMenu = { x: number; y: number; nodeId: string | null; folders: FileNode[] } | null;
type SaveState = "idle" | "saving" | "saved";
type Theme = "light" | "dark";

const BOARD_LINK_PREFIX = "kaiboard://";

// 计算场景的「实质内容」指纹：只取非删除元素的核心字段。
// 用于过滤 Excalidraw 高频 onChange：只取「元素内容」+「视图/选中态」生成指纹，
// 光标移动、拖拽中、编辑中等纯临时 appState 微变不会进指纹，避免把「保存中」卡在防抖里。
// 平移画布、点选元素这类只动视图的动作会让指纹变化 → 正常触发一次保存（贴近 Excalidraw 原生）。
// 指纹同时覆盖「元素内容」与「视图/选中态」——平移画布、点选元素这类只动视图的动作
// 也视为一次变更而保存（贴近 Excalidraw 原生：appState 一并持久化）。
// 不含 cursorX/Y、draggingElement、editingElement 等纯临时态，避免无谓落盘。
function computeSceneHash(elements: any[], appState?: any): string {
  let h = 0;
  for (const e of elements) {
    if (!e || e.isDeleted) continue;
    const s = `${e.id}:${e.version}:${e.versionNonce}:${e.type}`;
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
  }
  if (appState) {
    const view = `${appState.scrollX ?? 0}|${appState.scrollY ?? 0}|${appState.zoom ?? 1}`;
    const sel = Object.keys(appState.selectedElementIds || {}).sort().join(",");
    const vs = `V:${view}#S:${sel}`;
    for (let i = 0; i < vs.length; i++) {
      h = (h << 5) - h + vs.charCodeAt(i);
      h |= 0;
    }
  }
  return String(h);
}

export default function App() {
  const [nodes, setNodes] = useState<FileNode[]>([]);
  const [trashItems, setTrashItems] = useState<FileNode[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [ctxMenu, setCtxMenu] = useState<CtxMenu>(null);
  const [apiReady, setApiReady] = useState(false);
  const [booted, setBooted] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [theme, setTheme] = useState<Theme>("light");
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [lang, setLangState] = useState<Lang>("zh-CN");
  const [showSettings, setShowSettings] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  // 元素批注（存在元素 customData.__kbComment 里，随画板一起本地保存）
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  // Word 式画布批注标记层：在画布上叠加小锚点，跟随平移/缩放/元素移动实时定位。
  // 存储为「聚合簇」：单元素=💬，重叠时聚成 +N 气泡（小缩放更清晰）。
  const [markers, setMarkers] = useState<{ x: number; y: number; count: number; ids: string[] }[]>([]);
  const [showCommentMarkers, setShowCommentMarkers] = useState(true);
  const [folderName, setFolderName] = useState<string | null>(null);
  // 侧栏多选态：被选中的画板 id 集合（文件夹勾选会递归展开为其下画板）
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // 侧栏「当前导航到的文件夹」= 键盘 Ctrl+V 的粘贴目标（贴近 Windows 资源管理器「当前所在位置」语义）。
  // 点击文件夹 / 新建文件夹 / 打开画板 时同步更新；为 null 时回退到「激活画板所在文件夹」或根目录。
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  // 画板级剪贴板（Windows 式剪切/复制/粘贴）：cut=软剪切（粘贴时真正移动），copy=粘贴时生成副本
  const [clipboard, setClipboard] = useState<{ ids: string[]; op: "cut" | "copy" } | null>(null);
  // 所选文件夹里已有 KaiBoard 数据时，先弹窗让用户决定合并/以文件夹为准/覆盖
  const [folderConflict, setFolderConflict] = useState<{ handle: any; nodes: number; boards: number } | null>(null);

  const apiRef = useRef<any>(null);
  // 最近一次画布指针的场景坐标（用于把批注锚定到「点击点」而非元素中心）
  const pointerSceneRef = useRef<{ x: number; y: number } | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const saveTimer = useRef<number | null>(null);
  const savedTimer = useRef<number | null>(null);
  const maxWaitTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  const loadingRef = useRef(false);
  const lastSavedHashRef = useRef<string>("");
  // 已为「这个确切状态」排程过保存的指纹：相同 hash 的 onChange 直接略过，
  // 避免防抖在 500ms 窗口内被反复重置而永远到不了落盘（→ 一直「保存中」）。
  const pendingHashRef = useRef<string>("");
  // 首次变脏时间戳：用于 2s 兜底强制落盘，杜绝任何路径下的卡死。
  const dirtySinceRef = useRef<number>(0);

  const saveBoard = useCallback(async (id: string, elements: any, appState: any, files: any) => {
    const { collaborators, ...rest } = appState || {};
    const data: BoardData = {
      id,
      elements: elements || [],
      appState: rest || {},
      files: files || {},
    };
    await putBoard(data);
    const now = Date.now();
    const lt = lastTouchRef.current;
    if (lt.id !== id || now - lt.ts >= TOUCH_INTERVAL) {
      const node = await getNode(id);
      if (node) {
        node.updatedAt = now;
        await putNode(node);
      }
      lastTouchRef.current = { id, ts: now };
    }
  }, []);

  // 「已保存」显示约 1.5s 后淡出回空白——避免持久常显导致后续改动仍显示旧「已保存」。
  const markSaved = useCallback(() => {
    setSaveState("saved");
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaveState("idle"), 1500);
  }, []);

  const clearSaveTimers = useCallback(() => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (maxWaitTimer.current) { clearTimeout(maxWaitTimer.current); maxWaitTimer.current = null; }
    pendingHashRef.current = "";
    dirtySinceRef.current = 0;
  }, []);

  // 真正落盘（防抖触发 / 2s 兜底 / flush 共用）。取实时场景，写当前激活画板。
  const runSave = useCallback(async () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (maxWaitTimer.current) { clearTimeout(maxWaitTimer.current); maxWaitTimer.current = null; }
    const cur = activeIdRef.current;
    if (!cur) { pendingHashRef.current = ""; dirtySinceRef.current = 0; return; }
    const api = apiRef.current;
    if (!api) return;
    const els = api.getSceneElements();
    const st = api.getAppState();
    const fl = api.getFiles();
    setSaveState("saving");
    try {
      await saveBoard(cur, els, st, fl);
      setCommentCount(
        (els as any[]).filter((e: any) => e && !e.isDeleted && e.customData?.__kbComment?.text).length
      );
      lastSavedHashRef.current = computeSceneHash(els as any[], st);
      markSaved();
    } catch {
      setSaveState("idle");
    } finally {
      pendingHashRef.current = "";
      dirtySinceRef.current = 0;
    }
  }, [saveBoard, markSaved]);


  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const refreshNodes = useCallback(async () => {
    const [ns, tr] = await Promise.all([listNodes(), listTrashRoots()]);
    setNodes(ns);
    setTrashItems(tr);
  }, []);

  // Agent 共绘（Mode B / B2 + B2.1）集成层：state、回调、副作用、设置面板全部在 ./agentIntegration 内。
  // onTreeChanged：桥在「非当前画板」上建板/落图后刷新左侧树（N3 寻址不切画布，故需显式刷新）。
  const agent = useAgentIntegration({
    apiRef,
    activeIdRef,
    showToast,
    activeBoardId,
    onTreeChanged: refreshNodes,
  });

  // 全局 Escape：关闭所有浮层（右键菜单 / 设置 / 回收站 / 批注 / 冲突弹窗）。
  // 修复「按 Esc 想退出却卡死、画布与侧栏同时失灵」的回归风险——此前所有遮罩只支持点击背景关闭，
  // 无键盘出口；若遮罩未正常关闭，全屏 ctx-backdrop(50)/modal-backdrop(60) 会同时压住画布与侧栏。
  // 输入框聚焦时让 Esc 留给文本控件，不误关弹窗。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      const typing =
        !!ae &&
        (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable);
      if (e.key === "Escape") {
        if (typing) return;
        setCtxMenu(null);
        setShowSettings(false);
        setShowTrash(false);
        setShowComments(false);
        setFolderConflict(null);
        setShowHelp(false);
        setShowAIPanel(false);
        setClipboard(null);
        return;
      }
      if (e.key === "?" && !typing) {
        e.preventDefault();
        setShowHelp(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setShowHelp]);

  // ----- 语言切换 -----
  const changeLang = useCallback(async (l: Lang) => {
    setLang(l);
    setLangState(l);
    await setSetting("lang", l);
  }, []);

  // ----- 存储位置：文件夹（File System Access）/ 浏览器默认 -----
  /**
   * 真正切到文件夹存储。mode 决定「以谁为准」：
   *  - merge     两边并集，同 id 取 updatedAt 新的（推荐，零丢失）
   *  - useFolder 完全以文件夹为准，本次不写入任何东西
   *  - overwrite 用本机数据覆盖文件夹（仅在文件夹为空 or 用户显式选择时）
   */
  const applyFolderStorage = useCallback(
    async (handle: any, mode: "merge" | "useFolder" | "overwrite") => {
      // 切换前 backend 仍为 idb，读到的就是当前 IndexedDB 工作区
      const nodes = await listAllNodes();
      const boards = await getAllBoards();
      const src = {
        listAllNodes: () => Promise.resolve(nodes),
        getAllBoards: () => Promise.resolve(boards),
      };
      await activateFsBackend(handle);
      if (mode === "overwrite") await fsCopyFromIdb(src);
      else if (mode === "merge") await fsMergeFromIdb(src);
      // useFolder：一个字节都不写，直接采用文件夹里的现有数据
      await setSetting("storageMode", "filesystem");
      await setSetting("storageFolderHandle", handle);
      setFolderName(handle.name ?? null);
      await refreshNodes();
      showToast(
        mode === "merge"
          ? t("set_storageMerged")
          : mode === "useFolder"
            ? t("set_storageAdopted")
            : t("set_storageSwitched"),
      );
    },
    [refreshNodes, showToast],
  );

  const handleChooseFolder = useCallback(async () => {
    if (!fsSupported()) {
      showToast(t("set_storageUnavailable"));
      return;
    }
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      const perm = await handle.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") {
        showToast(t("set_storageUnavailable"));
        return;
      }
      // 关键：先只读探测目标文件夹里有没有别的电脑同步过来的数据，
      // 有就交给用户决定，绝不静默覆盖。
      const existing = await fsPeekFolder(handle);
      if (existing.nodes > 0 || existing.boards > 0) {
        setFolderConflict({ handle, ...existing });
        return;
      }
      await applyFolderStorage(handle, "overwrite"); // 空文件夹：直接复制过去
    } catch (e: any) {
      if (e && e.name === "AbortError") return; // 用户取消选择
      showToast(t("set_storageUnavailable"));
    }
  }, [applyFolderStorage, showToast]);

  const resolveFolderConflict = useCallback(
    async (mode: "merge" | "useFolder" | "overwrite") => {
      const c = folderConflict;
      if (!c) return;
      setFolderConflict(null);
      try {
        await applyFolderStorage(c.handle, mode);
      } catch {
        showToast(t("set_storageUnavailable"));
      }
    },
    [folderConflict, applyFolderStorage, showToast],
  );

  const handleResetStorage = useCallback(async () => {
    // 切回前，先把文件夹存储期间的新增/修改合并回 IndexedDB，保证无缝（不因切换丢失视图）
    let data: { nodes: FileNode[]; boards: BoardData[] } | null = null;
    if (getBackend() === "fs") {
      try {
        data = await fsExportAll();
      } catch {
        data = null;
      }
    }
    resetBackend();
    if (data) {
      for (const n of data.nodes) await putNode(n);
      for (const b of data.boards) await putBoard(b);
    }
    await setSetting("storageMode", "idb");
    await setSetting("storageFolderHandle", null);
    setFolderName(null);
    await refreshNodes();
    showToast(t("set_storageReset"));
  }, [refreshNodes, showToast]);

  // ----- 初始加载：恢复上次的 UI 状态 -----
  useEffect(() => {
    (async () => {
      const [savedExpanded, lastBoardId, w, collapsed, th, savedLang, storageMode, handle] = await Promise.all([
        getSetting<string[]>("expanded", []),
        getSetting<string | null>("lastBoardId", null),
        getSetting<number>("sidebarWidth", 260),
        getSetting<boolean>("sidebarCollapsed", false),
        getSetting<Theme>("theme", "light"),
        getSetting<string>("lang", "zh-CN"),
        getSetting<string>("storageMode", "idb"),
        getSetting<any>("storageFolderHandle", null),
      ]);
      setSidebarWidth(w);
      setSidebarCollapsed(collapsed);
      setTheme(th);
      if (isLang(savedLang)) {
        setLang(savedLang);
        setLangState(savedLang);
      }
      if (storageMode === "filesystem" && handle) setFolderName(handle.name ?? null);

      // 先决定存储后端（IndexedDB / 文件夹），再读数据
      await ensureStorage();

      let ns = await listNodes();
      if (ns.length === 0) {
        const folderId = crypto.randomUUID();
        const boardId = crypto.randomUUID();
        const now = Date.now();
        await putNode({ id: folderId, type: "folder", name: t("boot_folder"), parentId: null, createdAt: now, updatedAt: now, order: 1 });
        await putNode({ id: boardId, type: "board", name: t("boot_board"), parentId: folderId, createdAt: now, updatedAt: now, order: 1 });
        await putBoard({ id: boardId, elements: [], appState: {}, files: {} });
        ns = await listNodes();
      }
      setNodes(ns);
      setTrashItems(await listTrashRoots());

      // 优先恢复上次打开的画板
      const lastValid = lastBoardId && ns.some((n) => n.id === lastBoardId && n.type === "board");
      const target = lastValid ? lastBoardId! : ns.find((n) => n.type === "board")?.id ?? null;
      if (target) {
        activeIdRef.current = target;
        setActiveBoardId(target);
      }

      setExpanded(
        savedExpanded.length
          ? new Set(savedExpanded)
          : new Set(ns.filter((n) => n.type === "folder").map((n) => n.id))
      );
      setBooted(true);
    })();
  }, []);

  // ----- UI 状态持久化（booted 之后才写，避免覆盖已存设置）-----
  useEffect(() => {
    if (booted) setSetting("expanded", [...expanded]);
  }, [expanded, booted]);
  useEffect(() => {
    if (booted && activeBoardId) setSetting("lastBoardId", activeBoardId);
  }, [activeBoardId, booted]);
  useEffect(() => {
    if (booted) setSetting("sidebarWidth", sidebarWidth);
  }, [sidebarWidth, booted]);
  useEffect(() => {
    if (booted) setSetting("sidebarCollapsed", sidebarCollapsed);
  }, [sidebarCollapsed, booted]);
  useEffect(() => {
    if (booted) setSetting("theme", theme);
  }, [theme, booted]);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // 画布标记层：把每个带批注的元素中心点从场景坐标换算成视口像素坐标
  const recomputeMarkers = useCallback(() => {
    const api = apiRef.current;
    if (!api) {
      setMarkers([]);
      return;
    }
    const st = api.getAppState() as any;
    // 1) 每个带批注元素 → 视口像素坐标（直接用元素自身 x/y，不做任何偏移：看到哪就是哪）
    const raw: { x: number; y: number; id: string }[] = [];
    for (const e of api.getSceneElements() as any[]) {
      if (!e || e.isDeleted || !e.customData?.__kbComment?.text) continue;
      const vp = sceneCoordsToViewportCoords({ sceneX: e.x, sceneY: e.y }, st);
      raw.push({ x: vp.x, y: vp.y, id: e.id });
    }
    if (raw.length === 0) {
      setMarkers([]);
      return;
    }
    // 2) 贪心聚合：视口内圆心距离 < 26px 的合并成 +N 气泡（小缩放不再挤成一团）
    const TH = 26;
    const TH2 = TH * TH;
    const clusters: { x: number; y: number; ids: string[] }[] = [];
    for (const r of raw) {
      let merged = false;
      for (const c of clusters) {
        const dx = c.x - r.x;
        const dy = c.y - r.y;
        if (dx * dx + dy * dy <= TH2) {
          const n = c.ids.length + 1;
          c.x = (c.x * c.ids.length + r.x) / n;
          c.y = (c.y * c.ids.length + r.y) / n;
          c.ids.push(r.id);
          merged = true;
          break;
        }
      }
      if (!merged) clusters.push({ x: r.x, y: r.y, ids: [r.id] });
    }
    setMarkers(clusters.map((c) => ({ x: c.x, y: c.y, count: c.ids.length, ids: c.ids })));
  }, []);

  // ----- 自动保存（防抖 500ms）-----
  // updatedAt 的落盘做了节流：同一画板两次写树节点（tree.json）至少间隔 2s，
  // 避免文件夹存储模式下每 500ms 就重写并触发云盘重传整棵 tree.json。
  // 偏差 ≤2s 对「最后修改时间」排序无可见影响，且不引入卸载 flush 风险。
  const lastTouchRef = useRef<{ id: string | null; ts: number }>({ id: null, ts: 0 });
  const TOUCH_INTERVAL = 2000;
  const handleChange = useCallback(
    (elements: any, appState: any) => {
      if (loadingRef.current) return; // 程序化载入期间不保存
      const id = activeIdRef.current;
      if (!id) return;
      // 标记层实时跟随：用 RAF 异步重算，避免在 Excalidraw onChange 同步周期内 setState 触发死循环
      if (showCommentMarkers) {
        window.requestAnimationFrame(recomputeMarkers);
      }
      // 只有场景实质内容变化才进入保存流程（过滤光标移动/选择框/appState 微变导致的高频 onChange），
      // 否则防抖会被无限重启、且「保存中」会卡死。指纹同时覆盖元素内容与视图/选中态。
      const hash = computeSceneHash(elements, appState);
      if (hash === lastSavedHashRef.current) return;
      // 已经为「这个确切状态」排程过保存：相同 hash 的后续 onChange 直接略过，
      // 不再重置 500ms 防抖——这是「停手后还一直保存中」的根治点。
      if (hash === pendingHashRef.current) return;
      pendingHashRef.current = hash;
      if (!dirtySinceRef.current) dirtySinceRef.current = Date.now();
      // 立即给出「保存中」反馈（编辑中体感，与原生一致），落盘完成后切到「已保存」并约 1.5s 淡出。
      if (savedTimer.current) clearTimeout(savedTimer.current);
      setSaveState("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => { void runSave(); }, 500);
      // 2s 兜底：即便某种异常让防抖反复重置，也强制落盘一次，杜绝卡死。
      if (!maxWaitTimer.current) {
        maxWaitTimer.current = window.setTimeout(() => { maxWaitTimer.current = null; void runSave(); }, 2000);
      }
    },
    [saveBoard, showCommentMarkers, recomputeMarkers, runSave]
  );

  // 切走 / 关闭页面时立即落盘，避免「画完切到别的标签页才看到保存完成」的体感。
  // （hidden-tab 下浏览器会节流渲染与定时器，状态更新可能要等切回才 flush，
  //   所以在可见性变化 / 卸载时主动 flush 当前画板。）
  useEffect(() => {
    const flushNow = () => {
      const cur = activeIdRef.current;
      const api = apiRef.current;
      if (!cur || !api || loadingRef.current) return;
      clearSaveTimers();
      void runSave();
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", flushNow);
    window.addEventListener("pagehide", flushNow);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", flushNow);
      window.removeEventListener("pagehide", flushNow);
    };
  }, [runSave, clearSaveTimers]);

  // ----- 元素批注（Comments）-----
  // 批注写进元素的 customData.__kbComment，跟随画板一起本地保存 / 导出，不引入任何后端。

  const readComments = useCallback((): CommentItem[] => {
    const api = apiRef.current;
    if (!api) return [];
    return (api.getSceneElements() as any[])
      .filter((e: any) => e && !e.isDeleted && e.customData?.__kbComment?.text)
      .map((e: any) => ({
        elementId: e.id,
        text: String(e.customData.__kbComment.text),
        at: Number(e.customData.__kbComment.at) || 0,
        kind: e.type,
      }))
      .sort((a, b) => b.at - a.at);
  }, []);

  const refreshComments = useCallback(() => {
    const list = readComments();
    setComments(list);
    setCommentCount(list.length);
    recomputeMarkers();
  }, [readComments, recomputeMarkers]);

  const handleOpenComments = useCallback(() => {
    refreshComments();
    setShowComments(true);
  }, [refreshComments]);

  const handleAddComment = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    const st = api.getAppState?.() || {};
    const sel = Object.keys(st.selectedElementIds || {}).filter((k) => st.selectedElementIds[k]);
    if (sel.length !== 1) {
      showToast(t("cmt_needSelection"));
      return;
    }
    const targetId = sel[0];
    const cur = api.getSceneElements() as any[];
    const target = cur.find((e: any) => e.id === targetId);
    if (!target) return;
    const old = target.customData?.__kbComment?.text || "";
    const text = window.prompt(t("cmt_prompt"), old);
    if (text === null) return;
    const next = cur.map((e: any) => {
      if (!e || e.id !== targetId) return e;
      const customData = { ...(e.customData || {}) };
      if (text.trim())
        customData.__kbComment = { text: text.trim(), at: Date.now() };
      else delete customData.__kbComment;
      return { ...e, customData, versionNonce: Math.floor(Math.random() * 2 ** 31) };
    });
    api.updateScene({ elements: next, captureUpdate: "IMMEDIATELY" });
    setTimeout(refreshComments, 0);
    showToast(t(text.trim() ? "toast_cmtAdded" : "toast_cmtDeleted"));
  }, [refreshComments, showToast]);

  const handleLocateComment = useCallback((elementId: string) => {
    const api = apiRef.current;
    if (!api) return;
    setShowComments(false);
    try {
      const el = (api.getSceneElements() as any[]).find((e: any) => e.id === elementId);
      if (el) api.scrollToContent(el, { fitToContent: true, animate: true });
    } catch {
      /* 定位失败忽略 */
    }
  }, []);

  const handleDeleteComment = useCallback(
    (elementId: string) => {
      const api = apiRef.current;
      if (!api) return;
      const next = (api.getSceneElements() as any[]).map((e: any) => {
        if (!e || e.id !== elementId) return e;
        const customData = { ...(e.customData || {}) };
        delete customData.__kbComment;
        return { ...e, customData, versionNonce: Math.floor(Math.random() * 2 ** 31) };
      });
      api.updateScene({ elements: next, captureUpdate: "IMMEDIATELY" });
      setTimeout(refreshComments, 0);
      showToast(t("toast_cmtDeleted"));
    },
    [refreshComments, showToast]
  );

  // ----- 把画板数据载入画布（保持组件挂载，用 updateScene）-----
  // 关键修复：R 及其它高版本 Excalidraw 导出的场景，其 elements/appState 可能与
  // KaiBoard 的 0.18.1 不完全兼容，直接 updateScene 会渲染崩溃 → 整页白屏。
  // 这里先用官方 restore() 把场景归一化到当前版本（自动丢弃/修复不兼容项），
  // 再整体包在 try/catch 里：万一仍失败，也只降级为空白画布 + 提示，绝不拖垮整个应用。
  const loadBoardIntoCanvas = useCallback(async (id: string) => {
    const api = apiRef.current;
    if (!api) return;
    loadingRef.current = true;
    clearSaveTimers();
    try {
      const board = await getBoard(id);
      if (!board) {
        // 新画板默认小赖体（Xiaolai=100，中文手写）
        api.updateScene({ elements: [], appState: { currentItemFontFamily: (FONT_FAMILY as any).Xiaolai } });
        // 对齐指纹（含视图态），避免载入后的 onChange 误判为「有变更」而触发一次无谓落盘
        lastSavedHashRef.current = computeSceneHash([], api.getAppState());
        markSaved();
        return;
      }
      const rawEls = board.elements || [];
      const restored = restore(
        { elements: rawEls, appState: board.appState || {}, files: board.files || {} },
        api.getAppState(), // 以当前 appState 为基底，保留主题等
        null,
        { refreshDimensions: true, repairBindings: true }
      );
      // 提示：若有元素因版本不兼容被 restore 丢弃
      if (restored.elements.length < rawEls.length) {
        showToast(t("toast_incompatibleSkipped", { n: rawEls.length - restored.elements.length }));
      }
      if (restored.files && Object.keys(restored.files).length) {
        try {
          api.addFiles(Object.values(restored.files));
        } catch {
          /* 图片缺失时忽略 */
        }
      }
      // 载入画板时统一把默认文字字体设为小赖体（Xiaolai=100），中英文皆为手写体
      api.updateScene({
        elements: restored.elements,
        appState: { ...restored.appState, currentItemFontFamily: (FONT_FAMILY as any).Xiaolai },
      });
      setCommentCount(
        restored.elements.filter((e: any) => e && !e.isDeleted && (e as any).customData?.__kbComment?.text).length
      );
      api.history.clear();
      // 载入完成后把指纹对齐到当前场景（含视图态），避免旧 hash 导致下一次 onChange 误判为"未变更"
      lastSavedHashRef.current = computeSceneHash(restored.elements, restored.appState);
      markSaved();
    } catch (err) {
      console.error("[KaiBoard] 画板载入失败，已降级为空白画布：", err);
      try {
        api.updateScene({ elements: [], appState: { currentItemFontFamily: (FONT_FAMILY as any).Xiaolai } });
      } catch {
        /* noop */
      }
      showToast(t("toast_incompatibleBlank"));
    } finally {
      loadingRef.current = false;
    }
  }, [showToast, clearSaveTimers]);

  useEffect(() => {
    if (activeBoardId && apiReady) {
      loadBoardIntoCanvas(activeBoardId);
    }
  }, [activeBoardId, apiReady, loadBoardIntoCanvas]);

  const switchBoard = useCallback(
    async (id: string) => {
      // 先 flush 当前画板（不依赖防抖定时器，确保切走前一定落盘）
      clearSaveTimers();
      const cur = activeIdRef.current;
      if (cur && cur !== id && apiRef.current) {
        const els = apiRef.current.getSceneElements();
        const st = apiRef.current.getAppState();
        const fl = apiRef.current.getFiles();
        await saveBoard(cur, els, st, fl);
      }
      // 不重置 lastSavedHashRef：让 loadBoardIntoCanvas 在载入后对齐新画板指纹，
      // 避免「切到空画板却触发一次无谓落盘并闪一下已保存」。新画板载入后通过 markSaved 显示「已保存」并淡出。
      activeIdRef.current = id;
      setActiveBoardId(id);
      const node = await getNode(id);
      setActiveFolderId(node?.parentId ?? null);
      markSaved();
    },
    [saveBoard, clearSaveTimers, getNode]
  );

  const handleAPI = useCallback((api: any) => {
    apiRef.current = api;
    // 把「小赖体(Xiaolai)」注册为画布可选字体：FONT_FAMILY 是 Excalidraw 导出的可变对象。
    // excalidraw-cn 已在 Fonts.registered 中以值 100 注册了 Xiaolai（含精确度量 + 字脸），
    // 并仅以 fallback:true 将其排除出自带字体选择器；这里把 FONT_FAMILY.Xiaolai=100 注册后，
    // 渲染期 getFontFamilyString 反向查到 "Xiaolai"、度量走精确 Xiaolai 度量，中文即手写体
    // （拉丁字形经回退链落到系统字体）。用 100 而非新值，可复用既有精确度量，避免回退 Virgil。
    if ((FONT_FAMILY as any).Xiaolai == null) (FONT_FAMILY as any).Xiaolai = 100;
    // KaiBoard 默认画布文字字体即小赖体（Xiaolai=100）：中英文皆手写体。
    // 仅设定"新文字默认字体"，不改动已有文字元素自身存储的 fontFamily。
    try {
      api.updateScene({ appState: { currentItemFontFamily: (FONT_FAMILY as any).Xiaolai } });
    } catch { /* noop */ }
    setApiReady(true);
    agent.handleApiReady(api);
  }, [agent.handleApiReady]);


  // ----- 画板间双链：点击 kaiboard://<id> 在应用内跳转 -----
  const handleLinkOpen = useCallback(
    (element: any, event: any) => {
      const link: string = element?.link || "";
      if (!link.startsWith(BOARD_LINK_PREFIX)) return; // 普通链接交给浏览器
      const targetId = link.slice(BOARD_LINK_PREFIX.length).trim();
      const target = nodes.find((n) => n.id === targetId && n.type === "board");
      // 阻止 Excalidraw 打开新标签页
      if (event?.preventDefault) event.preventDefault();
      if (event?.nativeEvent?.preventDefault) event.nativeEvent.preventDefault();
      if (target) {
        switchBoard(target.id);
        showToast(t("toast_jumpedTo", { name: target.name }));
      } else {
        showToast(t("toast_linkNotFound"));
      }
    },
    [nodes, switchBoard, showToast]
  );

  // ----- 拖拽移动 / 排序 / 移动到文件夹 -----
  const collectDescendants = useCallback(async (rootId: string): Promise<Set<string>> => {
    const all = await listNodes();
    const childrenOf = new Map<string | null, string[]>();
    for (const n of all) {
      const arr = childrenOf.get(n.parentId) ?? [];
      arr.push(n.id);
      childrenOf.set(n.parentId, arr);
    }
    const out = new Set<string>();
    const stack = [rootId];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const c of childrenOf.get(cur) ?? []) {
        if (!out.has(c)) {
          out.add(c);
          stack.push(c);
        }
      }
    }
    return out;
  }, []);

  const handleMove = useCallback(
    async (draggedId: string, targetId: string | null, position: "inside" | "after") => {
      const dragged = await getNode(draggedId);
      if (!dragged || draggedId === targetId) return;
      if (dragged.type === "folder") {
        const desc = await collectDescendants(draggedId);
        if (targetId && desc.has(targetId)) {
          showToast(t("toast_cannotMoveIntoSelf"));
          return;
        }
      }
      let newParent: string | null;
      let newOrder: number;
      if (targetId === null) {
        newParent = null;
        newOrder = (await getMaxOrder(null)) + 1;
      } else {
        const target = await getNode(targetId);
        if (!target) return;
        if (position === "inside") {
          if (target.type !== "folder") return;
          newParent = targetId;
          newOrder = (await getMaxOrder(targetId)) + 1;
          setExpanded((s) => new Set(s).add(targetId));
        } else {
          newParent = target.parentId;
          newOrder = (target.order ?? 0) + 0.5;
        }
      }
      dragged.parentId = newParent;
      dragged.order = newOrder;
      dragged.updatedAt = Date.now();
      await putNode(dragged);
      await refreshNodes();
    },
    [refreshNodes, collectDescendants, showToast]
  );

  // handleMoveTo 已移除：画板级剪切/复制/粘贴（handlePaste）已完全覆盖「移动」动作，
  // 且复制+粘贴额外提供「克隆画板」能力。见下方 handleCut / handleCopy / handlePaste。

  const foldersForMove = useCallback(
    async (nodeId: string | null): Promise<FileNode[]> => {
      const all = await listNodes();
      if (!nodeId) return all.filter((n) => n.type === "folder");
      const exclude = new Set<string>([nodeId]);
      const desc = await collectDescendants(nodeId);
      desc.forEach((d) => exclude.add(d));
      const self = all.find((n) => n.id === nodeId);
      return all.filter((n) => n.type === "folder" && !exclude.has(n.id) && n.id !== self?.parentId);
    },
    [collectDescendants]
  );

  // ----- 导出 / 导入 / 副本 -----
  // 修复：必须导出「右键点中的那个画板」，而不是当前激活的画板
  const handleExportBoard = useCallback(
    async (nodeId: string) => {
      const node = await getNode(nodeId);
      if (!node || node.type !== "board") return;
      // 若导出的正是当前画板，先把未落盘的改动 flush，避免导出旧内容
      if (activeIdRef.current === nodeId && apiRef.current) {
        clearSaveTimers();
        await saveBoard(
          nodeId,
          apiRef.current.getSceneElements(),
          apiRef.current.getAppState(),
          apiRef.current.getFiles()
        );
      }
      const board = await getBoard(nodeId);
      if (board) await exportBoard(node.name || "画板", board);
    },
    [saveBoard, clearSaveTimers]
  );

  /** 若目标画板正是当前画板，先把未落盘的改动 flush，避免导出/收藏到旧内容。 */
  const flushIfActive = useCallback(
    async (nodeId: string) => {
      if (activeIdRef.current !== nodeId || !apiRef.current) return;
      clearSaveTimers();
      await saveBoard(
        nodeId,
        apiRef.current.getSceneElements(),
        apiRef.current.getAppState(),
        apiRef.current.getFiles()
      );
    },
    [saveBoard, clearSaveTimers]
  );

  const handleDuplicate = useCallback(
    async (nodeId: string) => {
      const node = await getNode(nodeId);
      if (!node || node.type !== "board") return;
      if (activeIdRef.current === nodeId && apiRef.current) {
        clearSaveTimers();
        await saveBoard(
          nodeId,
          apiRef.current.getSceneElements(),
          apiRef.current.getAppState(),
          apiRef.current.getFiles()
        );
      }
      const board = await getBoard(nodeId);
      const newId = crypto.randomUUID();
      const now = Date.now();
      await putNode({
        id: newId,
        type: "board",
        name: `${node.name}${t("name_copy")}`,
        parentId: node.parentId,
        createdAt: now,
        updatedAt: now,
        order: (await getMaxOrder(node.parentId)) + 1,
      });
      await putBoard({
        id: newId,
        elements: board?.elements ? JSON.parse(JSON.stringify(board.elements)) : [],
        appState: board?.appState ? JSON.parse(JSON.stringify(board.appState)) : {},
        files: board?.files ? JSON.parse(JSON.stringify(board.files)) : {},
      });
      await refreshNodes();
      await switchBoard(newId);
      showToast(t("toast_duplicated"));
    },
    [refreshNodes, switchBoard, saveBoard, showToast, clearSaveTimers]
  );

  // 画板级剪切 / 复制：把当前侧栏选中（selected）的画板写入剪贴板
  const handleCut = useCallback(async () => {
    if (selected.size === 0) return;
    setClipboard({ ids: Array.from(selected), op: "cut" });
  }, [selected]);

  const handleCopy = useCallback(async () => {
    if (selected.size === 0) return;
    setClipboard({ ids: Array.from(selected), op: "copy" });
  }, [selected]);

  // 画板级粘贴：把剪贴板内容落到目标文件夹（folderId=null 表示根目录）
  // cut → 逐个移动 parentId 到目标并置末尾，随后清空剪贴板；
  // copy → 逐个深克隆（新 id、名称加「 副本」）进目标文件夹，剪贴板保留可多次粘贴。
  // 防自我移动：cut 时目标不能是任一被剪切项的子孙（复用 toast_cannotMoveIntoSelf）。
  const handlePaste = useCallback(
    async (targetFolderId: string | null) => {
      if (!clipboard || clipboard.ids.length === 0) return;
      if (clipboard.op === "cut") {
        for (const id of clipboard.ids) {
          if (id === targetFolderId) {
            showToast(t("toast_cannotMoveIntoSelf"));
            return;
          }
          const node = await getNode(id);
          if (node && node.type === "folder") {
            const desc = await collectDescendants(id);
            if (desc.has(targetFolderId || "")) {
              showToast(t("toast_cannotMoveIntoSelf"));
              return;
            }
          }
        }
      }
      if (clipboard.op === "cut") {
        for (const id of clipboard.ids) {
          const node = await getNode(id);
          if (!node) continue;
          node.parentId = targetFolderId;
          node.order = (await getMaxOrder(targetFolderId)) + 1;
          node.updatedAt = Date.now();
          await putNode(node);
        }
        setClipboard(null);
        await refreshNodes();
        showToast(t("toast_movedN", { n: clipboard.ids.length }));
      } else {
        for (const id of clipboard.ids) {
          const node = await getNode(id);
          if (!node || node.type !== "board") continue;
          const board = await getBoard(id);
          const newId = crypto.randomUUID();
          const now = Date.now();
          await putNode({
            id: newId,
            type: "board",
            name: `${node.name}${t("name_copy")}`,
            parentId: targetFolderId,
            createdAt: now,
            updatedAt: now,
            order: (await getMaxOrder(targetFolderId)) + 1,
          });
          await putBoard({
            id: newId,
            elements: board?.elements ? JSON.parse(JSON.stringify(board.elements)) : [],
            appState: board?.appState ? JSON.parse(JSON.stringify(board.appState)) : {},
            files: board?.files ? JSON.parse(JSON.stringify(board.files)) : {},
          });
        }
        await refreshNodes();
        showToast(t("toast_copiedN", { n: clipboard.ids.length }));
        // copy 保留剪贴板，可多次粘贴；新剪切/复制或 Esc 时重置
      }
    },
    [clipboard, refreshNodes, showToast, t, getNode, getBoard, putNode, putBoard, getMaxOrder, collectDescendants]
  );

  // 画板级剪切/复制/粘贴键盘快捷键（Ctrl+X / Ctrl+C / Ctrl+V）。
  // 仅在「侧栏已选中画板」且焦点不在画布文本框 / Excalidraw 画布内时生效，
  // 避免与 Excalidraw 画布元素的 Ctrl+C/V 冲突。Ctrl+V 粘贴到「当前激活画板所在文件夹」（或根目录）。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      const typing = !!ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable);
      const inExcalidraw = !!(ae && ae.closest && ae.closest(".excalidraw"));
      const inRenameInput = !!(ae && ae.classList && ae.classList.contains("rename-input"));
      if (!(e.ctrlKey || e.metaKey) || inExcalidraw) return;
      // 侧栏重命名输入框中：放行画板级剪切/复制/粘贴（先失焦提交命名），避免抢焦点导致快捷键失效
      if (typing && !inRenameInput) return;
      const k = e.key.toLowerCase();
      if (k === "x") {
        if (selected.size > 0) {
          if (inRenameInput && ae) ae.blur();
          e.preventDefault();
          void handleCut();
        }
      } else if (k === "c") {
        if (selected.size > 0) {
          if (inRenameInput && ae) ae.blur();
          e.preventDefault();
          void handleCopy();
        }
      } else if (k === "v") {
        if (clipboard) {
          if (inRenameInput && ae) ae.blur();
          e.preventDefault();
          void (async () => {
            const active = activeIdRef.current ? await getNode(activeIdRef.current) : null;
            await handlePaste(activeFolderId ?? (active?.parentId ?? null));
          })();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, clipboard, handleCut, handleCopy, handlePaste, getNode, activeIdRef, activeFolderId]);

  // 右键文件夹 / 空白处「导入画板」：支持一次多选多个 .excalidraw 精准落到该文件夹
  const handleImportToFolder = useCallback(
    async (folderId: string | null) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = ".excalidraw,application/json";
      input.onchange = async () => {
        const files = input.files ? Array.from(input.files) : [];
        if (files.length === 0) return;

        const importedIds: string[] = [];
        const skipped: string[] = [];

        for (const f of files) {
          try {
            const text = await f.text();
            let payload: any;
            try {
              payload = JSON.parse(text);
            } catch {
              skipped.push(t("importSkip_notJson", { name: f.name }));
              continue;
            }
            // 工作区备份（{ files, boards }）不该用「导入画板」导入，提示改用顶栏「导入备份」
            const isWorkspace =
              Array.isArray(payload?.files) || Array.isArray(payload?.boards);
            if (isWorkspace) {
              skipped.push(t("importSkip_workspace", { name: f.name }));
              continue;
            }
            // 合法画板场景：必须含 elements 数组（兼容外部/其他工具导出的 .excalidraw 或 .json）
            if (!Array.isArray(payload?.elements)) {
              skipped.push(t("importSkip_notBoard", { name: f.name }));
              continue;
            }
            const id = await importFile(f, folderId);
            if (id) importedIds.push(id);
          } catch (e) {
            skipped.push(t("importSkip_failed", { name: f.name, msg: (e as Error).message }));
          }
        }

        await refreshNodes();
        if (folderId) setExpanded((s) => new Set(s).add(folderId));

        // 激活第一个成功导入的画板
        if (importedIds.length > 0) {
          const ns = await listNodes();
          const first = ns.find((n) => n.id === importedIds[0]);
          if (first) {
            activeIdRef.current = first.id;
            setActiveBoardId(first.id);
          }
        }

        // 汇总提示：成功 / 跳过 / 全部失败
        if (importedIds.length > 0 && skipped.length === 0) {
          showToast(t("toast_importedN", { n: importedIds.length }));
        } else if (importedIds.length > 0 && skipped.length > 0) {
          showToast(
            t("toast_importedSkip", {
              n: importedIds.length,
              m: skipped.length,
              list: skipped.join("；"),
            })
          );
        } else if (skipped.length > 0) {
          showToast(t("toast_importNone", { m: skipped.length, list: skipped.join("；") }));
        }
      };
      input.click();
    },
    [importFile, refreshNodes, showToast, listNodes]
  );

  // P1-A：空画板欢迎屏「打开文件」——导入单个 .excalidraw/JSON 画板并跳转到它
  // 收集某节点下所有「画板」id（递归），按文件树可见顺序（order 升序 → 名称）返回。
  // 传入 null 可拿到「全局」可见顺序，用于多选导出排序。
  const descendantBoardIds = useCallback(
    (rootId: string | null): string[] => {
      const byPid = new Map<string | null, FileNode[]>();
      for (const n of nodes) {
        const arr = byPid.get(n.parentId) ?? [];
        arr.push(n);
        byPid.set(n.parentId, arr);
      }
      for (const arr of byPid.values()) {
        arr.sort(
          (a, b) =>
            (a.order ?? 0) - (b.order ?? 0) ||
            a.name.localeCompare(b.name, "zh-Hans-CN")
        );
      }
      const res: string[] = [];
      const stack = [rootId];
      while (stack.length) {
        const cur = stack.pop()!;
        const kids = byPid.get(cur) ?? [];
        // 逆序入栈，保证出栈（处理）顺序与可见顺序一致
        for (let i = kids.length - 1; i >= 0; i--) {
          const c = kids[i];
          if (c.type === "board") res.push(c.id);
          else stack.push(c.id);
        }
      }
      return res;
    },
    [nodes]
  );

  // 侧栏勾选：画板直接切换；文件夹按「其下画板是否全选」整组切换
  const onToggleSelect = useCallback(
    (node: FileNode) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (node.type === "board") {
          if (next.has(node.id)) next.delete(node.id);
          else next.add(node.id);
        } else {
          const desc = descendantBoardIds(node.id);
          const allSel = desc.length > 0 && desc.every((id) => next.has(id));
          if (allSel) desc.forEach((id) => next.delete(id));
          else desc.forEach((id) => next.add(id));
        }
        return next;
      });
    },
    [descendantBoardIds]
  );

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  // 多选：Shift 范围选（替换整组为可见序列中的连续区间）
  const onSetSelection = useCallback((ids: string[]) => setSelected(new Set(ids)), []);
  // 整组拖入文件夹后给一个反馈 toast
  const onSelectionMoved = useCallback(
    (count: number, folderId: string | null) => {
      const name = folderId ? nodes.find((n) => n.id === folderId)?.name ?? "" : "根目录";
      showToast(t("toast_boardsMoved", { n: count, folder: name }));
    },
    [nodes, showToast, t]
  );

  // 导出选中：逐个画板导出为原生 .excalidraw（与单画板右键导出同格式）
  // 规则（2026-08-05）：除顶栏总体批量备份外，单/多导入导出一律保持原生 .excalidraw。
  const handleExportSelected = useCallback(async () => {
    if (selected.size === 0) return;
    const boards = (await getAllBoards()).filter((b) => selected.has(b.id));
    if (boards.length === 0) return;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const b of boards) {
      const name = byId.get(b.id)?.name || "画板";
      await exportBoard(name, b);
    }
    showToast(t("toast_exportedSelected", { n: boards.length }));
    setSelected(new Set());
  }, [selected, nodes, showToast]);

  // ----- 演示型导出（PPTX，按需动态加载，不进主包）-----
  // 对标 Excalidraw+ 的「导出为演示文稿」：画板 → PNG → PPTX(pptxgenjs)。
  // 历史：早期曾实现 PDF（浏览器打印管线），因手写体/透明/分页失真、效果差而移除；
  //       PPTX 可经「另存为 PDF」等价覆盖该用途，故不再单独提供 PDF 导出。

  /** 收集导出目标：画板 = 自身；文件夹 = 其下全部画板（递归）。 */
  const collectExportItems = useCallback(
    async (nodeId: string): Promise<{ items: ExportItem[]; title: string }> => {
      const node = await getNode(nodeId);
      if (!node) return { items: [], title: "KaiBoard" };
      if (node.type === "board") {
        await flushIfActive(nodeId);
        const b = await getBoard(nodeId);
        return { items: b ? [{ name: node.name || "画板", board: b }] : [], title: node.name || "画板" };
      }
      const ids = descendantBoardIds(nodeId);
      if (activeIdRef.current && ids.includes(activeIdRef.current)) await flushIfActive(activeIdRef.current);
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const bById = new Map((await getAllBoards()).map((b) => [b.id, b]));
      const items: ExportItem[] = [];
      for (const id of ids) {
        const b = bById.get(id);
        if (b) items.push({ name: byId.get(id)?.name || "画板", board: b });
      }
      return { items, title: node.name || "KaiBoard" };
    },
    [flushIfActive, descendantBoardIds, nodes]
  );

  const runPresentationExport = useCallback(
    async (items: ExportItem[], title: string) => {
      if (!items.length) {
        showToast(t("toast_exportEmpty"));
        return;
      }
      showToast(t("toast_exporting"));
      try {
        const { exportBoardsToPptx } = await import("./exportPptx");
        const n = await exportBoardsToPptx(items, { fileName: title });
        if (!n) showToast(t("toast_exportEmpty"));
        else showToast(t("toast_exportedPptx", { n }));
      } catch (e: any) {
        showToast(t("toast_exportFail", { msg: e?.message || String(e) }));
      }
    },
    [showToast]
  );

  const handleExportAs = useCallback(
    async (nodeId: string) => {
      const { items, title } = await collectExportItems(nodeId);
      await runPresentationExport(items, title);
    },
    [collectExportItems, runPresentationExport]
  );

  const handleExportSelectedAs = useCallback(
    async () => {
      if (selected.size === 0) return;
      if (activeIdRef.current && selected.has(activeIdRef.current)) await flushIfActive(activeIdRef.current);
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const bById = new Map((await getAllBoards()).map((b) => [b.id, b]));
      // 按文件树可见顺序排序（descendantBoardIds(null) = 全局顺序），再按勾选集合过滤
      const items: ExportItem[] = descendantBoardIds(null)
        .filter((id) => selected.has(id))
        .map((id) => ({ name: byId.get(id)?.name || "画板", board: bById.get(id)! }))
        .filter((it) => it.board);
      await runPresentationExport(items, "KaiBoard");
    },
    [selected, nodes, flushIfActive, runPresentationExport, descendantBoardIds]
  );

  const makeFolderNode = useCallback(
    async (name: string, parentId: string | null): Promise<string> => {
      const id = crypto.randomUUID();
      const now = Date.now();
      await putNode({
        id,
        type: "folder",
        name,
        parentId,
        createdAt: now,
        updatedAt: now,
        order: (await getMaxOrder(parentId)) + 1,
      });
      return id;
    },
    []
  );

  // 拖外部文件/文件夹到界面：webkitGetAsEntry 递归读目录，按结构建文件夹并导入画板
  const onDropExternal = useCallback(
    async (dt: DataTransfer, targetFolderId: string | null) => {
      const items = dt.items ? (Array.from(dt.items) as any[]) : [];
      const entries: { entry: any; parentId: string | null }[] = [];
      for (const it of items) {
        if (it.kind === "file" && it.webkitGetAsEntry) {
          const e = it.webkitGetAsEntry();
          if (e) entries.push({ entry: e, parentId: targetFolderId });
        }
      }
      let count = 0;
      const importEntry = async (entry: any, parentId: string | null): Promise<void> => {
        if (entry.isFile) {
          if (!/\.(excalidraw|json)$/i.test(entry.name)) return;
          const file: File = await new Promise((res, rej) => entry.file(res, rej));
          await importFile(file, parentId);
          count++;
        } else if (entry.isDirectory) {
          const folderId = await makeFolderNode(entry.name, parentId);
          const reader = entry.createReader();
          const readBatch = (): Promise<any[]> =>
            new Promise((res, rej) => reader.readEntries(res, rej));
          let batch = await readBatch();
          while (batch.length > 0) {
            for (const c of batch) await importEntry(c, folderId);
            batch = await readBatch();
          }
        }
      };
      if (entries.length === 0) {
        // 降级：部分浏览器（如 Firefox）不暴露 entry，但提供 files（扁平导入）
        const files = dt.files ? Array.from(dt.files) : [];
        for (const f of files) {
          if (/\.(excalidraw|json)$/i.test(f.name)) {
            await importFile(f, targetFolderId);
            count++;
          }
        }
      } else {
        for (const { entry, parentId } of entries) await importEntry(entry, parentId);
      }
      await refreshNodes();
      if (targetFolderId) setExpanded((s) => new Set(s).add(targetFolderId));
      if (count > 0) showToast(t("toast_importedN", { n: count }));
    },
    [importFile, makeFolderNode, refreshNodes, showToast]
  );

  const handleCopyBoardLink = useCallback(
    async (nodeId: string) => {
      const link = `${BOARD_LINK_PREFIX}${nodeId}`;
      try {
        await navigator.clipboard.writeText(link);
        showToast(t("toast_copiedLink"));
      } catch {
        window.prompt(t("copyLink_prompt"), link);
      }
    },
    [showToast]
  );

  // ----- 文件树操作 -----
  const createFolder = useCallback(
    async (parentId: string | null) => {
      const id = crypto.randomUUID();
      const now = Date.now();
      await putNode({
        id,
        type: "folder",
        name: t("default_folderName"),
        parentId,
        createdAt: now,
        updatedAt: now,
        order: (await getMaxOrder(parentId)) + 1,
      });
      if (parentId) setExpanded((s) => new Set(s).add(parentId));
      await refreshNodes();
      setRenamingId(id); // 创建后直接进入内联重命名
      setActiveFolderId(id); // 新建文件夹立即成为键盘粘贴目标
    },
    [refreshNodes]
  );

  const createBoard = useCallback(
    async (parentId: string | null) => {
      const id = crypto.randomUUID();
      const now = Date.now();
      await putNode({
        id,
        type: "board",
        name: t("default_boardName"),
        parentId,
        createdAt: now,
        updatedAt: now,
        order: (await getMaxOrder(parentId)) + 1,
      });
      await putBoard({ id, elements: [], appState: {}, files: {} });
      if (parentId) setExpanded((s) => new Set(s).add(parentId));
      await refreshNodes();
      await switchBoard(id);
      setRenamingId(id);
    },
    [refreshNodes, switchBoard]
  );

  const handleRenameSubmit = useCallback(
    async (id: string, rawName: string) => {
      setRenamingId(null);
      const name = rawName.trim();
      const node = await getNode(id);
      if (!node || !name || name === node.name) return;
      node.name = name;
      node.updatedAt = Date.now();
      await putNode(node);
      await refreshNodes();
    },
    [refreshNodes]
  );

  // 删除 = 移入回收站（可还原）
  const onDelete = useCallback(
    async (id: string) => {
      const node = await getNode(id);
      if (!node) return;
      const kids = node.type === "folder" ? await listChildren(id) : [];
      const msg =
        node.type === "folder" && kids.length > 0
          ? t("confirm_moveFolderTrash", { name: node.name, n: kids.length })
          : t("confirm_moveTrash", { name: node.name });
      if (!window.confirm(msg)) return;

      const wasActive = activeIdRef.current === id;
      await trashNode(id);
      const remaining = await listNodes();
      await refreshNodes();

      if (wasActive || !remaining.some((n) => n.id === activeIdRef.current)) {
        const firstBoard = remaining.find((n) => n.type === "board");
        activeIdRef.current = firstBoard?.id ?? null;
        setActiveBoardId(firstBoard?.id ?? null);
      }
      showToast(t("toast_toTrash"));
    },
    [refreshNodes, showToast]
  );

  const handleRestore = useCallback(
    async (id: string) => {
      await restoreNode(id);
      await refreshNodes();
      const node = await getNode(id);
      if (node?.type === "board") await switchBoard(id);
      showToast(t("toast_restored", { name: node?.name ?? "" }));
    },
    [refreshNodes, switchBoard, showToast]
  );

  const handlePurge = useCallback(
    async (id: string) => {
      await purgeNode(id);
      await refreshNodes();
      showToast(t("toast_purged"));
    },
    [refreshNodes, showToast]
  );

  const handleEmptyTrash = useCallback(async () => {
    await emptyTrash();
    await refreshNodes();
    showToast(t("toast_trashEmptied"));
  }, [refreshNodes, showToast]);

  // ----- 工具栏 -----
  const onExport = useCallback(async () => {
    const ok = await exportAll();
    if (ok) showToast(t("toast_backupExported"));
  }, [showToast]);

  const onImport = useCallback(
    async (file: File) => {
      try {
        const active = nodes.find((n) => n.id === activeIdRef.current);
        const defaultParent = active?.parentId ?? null;
        const importedId = await importFile(file, defaultParent);
        await refreshNodes();
        const ns = await listNodes();
        const target = importedId ? ns.find((n) => n.id === importedId) : ns.find((n) => n.type === "board");
        if (target) {
          activeIdRef.current = target.id;
          setActiveBoardId(target.id);
        }
        showToast(t("toast_workspaceMerged"));
      } catch (e) {
        showToast(t("toast_importFailed", { msg: (e as Error).message }));
      }
    },
    [nodes, refreshNodes, showToast]
  );

  const toggleExpand = useCallback((id: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  // ----- 侧边栏拖拽调宽 -----
  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = sidebarWidth;
      const cleanup = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("blur", cleanup);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      const onMouseMove = (ev: MouseEvent) => {
        setSidebarWidth(Math.max(180, Math.min(560, startW + ev.clientX - startX)));
      };
      const onMouseUp = () => cleanup();
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      // 鼠标在浏览器窗口外松开时，mouseup 可能收不到；用 blur/失焦兜底复位，
      // 避免 body 残留 userSelect:none 造成侧栏/画布“点不动”。
      window.addEventListener("blur", cleanup);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [sidebarWidth]
  );

  // ----- 当前画板路径（面包屑）-----
  const breadcrumb = useMemo(() => {
    if (!activeBoardId) return [] as string[];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const parts: string[] = [];
    let cur: FileNode | undefined = byId.get(activeBoardId);
    while (cur) {
      parts.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return parts;
  }, [activeBoardId, nodes]);

  const ctxNode = ctxMenu?.nodeId ? nodes.find((n) => n.id === ctxMenu.nodeId) : undefined;

  return (
    <div className="app">
      <AnnouncementBar />
      <div className="toolbar">
        <div className="toolbar-left">
          <button
            className="icon-btn"
            onClick={() => setSidebarCollapsed((v) => !v)}
            title={sidebarCollapsed ? t("ui_expandSidebar") : t("ui_collapseSidebar")}
          >
            {sidebarCollapsed ? "☰" : "◧"}
          </button>

          <div className="brand" title="KaiBoard">
            <img className="brand-logo" src={FAVICON_DATA_URI} alt="KaiBoard" />
            <span className="brand-text">KaiBoard</span>
          </div>

          <span className="crumb">
            {breadcrumb.length === 0 ? (
              <span className="crumb-empty">{t("ui_noBoardOpen")}</span>
            ) : (
              breadcrumb.map((p, i) => (
                <span key={i}>
                  {i > 0 && <span className="crumb-sep">/</span>}
                  <span className={i === breadcrumb.length - 1 ? "crumb-cur" : ""}>{p}</span>
                </span>
              ))
            )}
          </span>

          <span className={"save-state " + saveState}>
            {saveState === "saving" ? t("ui_saving") : saveState === "saved" ? t("ui_saved") : ""}
          </span>
        </div>

        <div className="toolbar-right">
          {AI_ENABLED && (
            <button className="ai-btn" title={t("ai_panel_title")} onClick={() => setShowAIPanel((v) => !v)}>
              ✨ AI
            </button>
          )}
          <button onClick={onExport} title={t("ui_exportAllTitle")}>
            {t("ui_exportAll")}
          </button>
          <label className="btn" title={t("ui_importBackupTitle")}>
            {t("ui_importBackup")}
            <input
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
                e.target.value = "";
              }}
            />
          </label>

          <button
            className="icon-btn"
            onClick={() => setShowSettings(true)}
            title={t("set_title")}
          >
            ⚙
          </button>

          <button
            className="icon-btn"
            onClick={() => setShowHelp(true)}
            title="帮助"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="body">
        {!sidebarCollapsed && (
          <>
            <div className="sidebar-host" style={{ width: sidebarWidth }}>
              <Sidebar
                nodes={nodes}
                activeBoardId={activeBoardId}
                expanded={expanded}
                onToggle={toggleExpand}
                onActivate={switchBoard}
                onMove={handleMove}
                renamingId={renamingId}
                onRenamingChange={setRenamingId}
                onRenameSubmit={handleRenameSubmit}
                trashCount={trashItems.length}
                onOpenTrash={() => setShowTrash(true)}
                selectedIds={selected}
                onToggleSelect={onToggleSelect}
                onExportSelected={handleExportSelected}
                onExportSelectedPptx={() => handleExportSelectedAs()}
                onClearSelection={clearSelection}
                onSetSelection={onSetSelection}
                onSelectionMoved={onSelectionMoved}
                onDropExternal={onDropExternal}
                onNewFolder={() => createFolder(null)}
                onNewBoard={() => createBoard(null)}
                commentCount={commentCount}
                onOpenComments={handleOpenComments}
                onFolderFocus={setActiveFolderId}
                onContextMenu={(x, y, id) =>
                  foldersForMove(id).then((folders) => setCtxMenu({ x, y, nodeId: id, folders }))
                }
                onBlankContextMenu={(x, y) => setCtxMenu({ x, y, nodeId: null, folders: [] })}
              />
            </div>
            <div className="resizer" onMouseDown={startResize} title={t("ui_resize")} />
          </>
        )}

        <div className="canvas-wrap">
          <Excalidraw
            excalidrawAPI={handleAPI}
            onChange={handleChange}
            onPointerUpdate={(p: any) => {
              if (p?.pointer) pointerSceneRef.current = { x: p.pointer.x, y: p.pointer.y };
            }}
            onLinkOpen={handleLinkOpen}
            langCode={getLang()}
            theme={theme}
            UIOptions={{
              canvasActions: {
                loadScene: false,
                saveToActiveFile: false,
                export: { saveFileToDisk: true },
              },
            }}
          >
            <WelcomeScreen>
              <WelcomeScreen.Center>
                <div className="kb-brand">
                  <img src={FAVICON_DATA_URI} className="kb-logo" alt="KaiBoard" />
                  <span className="kb-brand-name">KaiBoard</span>
                </div>
                <p className="welcome-desc">{t("welcome_desc")}</p>
<WelcomeScreen.Center.Menu>
                  <WelcomeScreen.Center.MenuItem
                    icon={
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="12" y1="8" x2="12" y2="16" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                      </svg>
                    }
                    onSelect={() => createBoard(null)}
                  >
                    {t("welcome_newBoard")}
                  </WelcomeScreen.Center.MenuItem>
                  <WelcomeScreen.Center.MenuItem
                    icon={
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5" />
                        <line x1="12" y1="17" x2="12" y2="17" />
                      </svg>
                    }
                    onSelect={() => setShowHelp(true)}
                  >
                    帮助
                  </WelcomeScreen.Center.MenuItem>
                </WelcomeScreen.Center.Menu>
                <p className="welcome-tree-hint">{t("welcome_treeHint")}</p>
                <div className="welcome-shortcuts">
                  <span><kbd>1</kbd>–<kbd>9</kbd> {t("welcome_shortcutTools")}</span>
                  <span><kbd>空格</kbd> {t("welcome_shortcutPan")}</span>
                  <span><kbd>?</kbd> {t("welcome_shortcutHelp")}</span>
                </div>
              </WelcomeScreen.Center>
            </WelcomeScreen>
          </Excalidraw>

          {showCommentMarkers && markers.length > 0 && (
            <div className="comment-markers">
              {markers.map((m) => (
                <button
                  key={m.ids.join("-")}
                  className={"comment-marker" + (m.count > 1 ? " is-cluster" : "")}
                  style={{ left: m.x, top: m.y }}
                  title={m.count > 1 ? t("cmt_clusterTitle", { n: m.count }) : t("cmt_markerTitle")}
                  onClick={() => handleOpenComments()}
                >
                  <span className="marker-body">{m.count > 1 ? `💬 ${m.count}` : "💬"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          node={ctxNode}
          canPaste={clipboard !== null}
          onClose={() => setCtxMenu(null)}
          onRename={() => {
            if (ctxMenu.nodeId) setRenamingId(ctxMenu.nodeId);
            setCtxMenu(null);
          }}
          onDelete={() => {
            if (ctxMenu.nodeId) onDelete(ctxMenu.nodeId);
            setCtxMenu(null);
          }}
          onNewBoard={() => {
            createBoard(ctxMenu.nodeId);
            setCtxMenu(null);
          }}
          onNewFolder={() => {
            createFolder(ctxMenu.nodeId);
            setCtxMenu(null);
          }}
          onExportBoard={() => {
            if (ctxMenu.nodeId) handleExportBoard(ctxMenu.nodeId);
            setCtxMenu(null);
          }}
          onDuplicate={() => {
            if (ctxMenu.nodeId) handleDuplicate(ctxMenu.nodeId);
            setCtxMenu(null);
          }}
          onCopyLink={() => {
            if (ctxMenu.nodeId) handleCopyBoardLink(ctxMenu.nodeId);
            setCtxMenu(null);
          }}
          onImportToFolder={() => {
            handleImportToFolder(ctxMenu.nodeId);
            setCtxMenu(null);
          }}
          onCut={() => {
            setCtxMenu(null);
            void handleCut();
          }}
          onCopy={() => {
            setCtxMenu(null);
            void handleCopy();
          }}
          onPaste={() => {
            const target = ctxNode?.type === "folder" ? ctxNode.id : null;
            setCtxMenu(null);
            void handlePaste(target);
          }}
          onExportPptx={() => {
            if (ctxMenu.nodeId) handleExportAs(ctxMenu.nodeId);
            setCtxMenu(null);
          }}
        />
      )}

      {showTrash && (
        <TrashPanel
          items={trashItems}
          onRestore={handleRestore}
          onPurge={handlePurge}
          onEmpty={handleEmptyTrash}
          onClose={() => setShowTrash(false)}
        />
      )}

      {showComments && (
        <CommentPanel
          items={comments}
          showMarkers={showCommentMarkers}
          onToggleMarkers={() => setShowCommentMarkers((v) => !v)}
          onAdd={handleAddComment}
          onLocate={handleLocateComment}
          onDelete={handleDeleteComment}
          onClose={() => setShowComments(false)}
        />
      )}

      {showSettings && (
        <>
          <div className="modal-backdrop" onClick={() => setShowSettings(false)} />
          <div className="modal">
            <div className="modal-head">
              <span>{t("set_title")}</span>
              <button className="modal-close" onClick={() => setShowSettings(false)} title={t("set_close")}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="set-row">
                <label className="set-label">{t("set_language")}</label>
                <select value={lang} onChange={(e) => changeLang(e.target.value as Lang)}>
                  {LANGS.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="set-section">
                <div className="set-label">{t("set_appearance")}</div>
                <div className="set-row">
                  <label className="set-label">{t("set_theme")}</label>
                  <select value={theme} onChange={(e) => setTheme(e.target.value as "light" | "dark")}>
                    <option value="light">{t("set_themeLight")}</option>
                    <option value="dark">{t("set_themeDark")}</option>
                  </select>
                </div>
              </div>

              <div className="set-section">
                <div className="set-label">{t("set_storage")}</div>
                <p className="set-desc">{t("set_storageDesc")}</p>
                <div className="set-row">
                  <button className="btn" onClick={handleChooseFolder}>
                    {t("set_chooseFolder")}
                  </button>
                  {folderName && (
                    <span className="set-current">
                      {t("set_currentFolder")}
                      {folderName}
                    </span>
                  )}
                </div>
                <div className="set-row">
                  <button className="btn" onClick={handleResetStorage}>
                    {t("set_resetDefault")}
                  </button>
                </div>
                <p className="set-experimental">{t("set_experimental")}</p>
              </div>

              <div className="set-section">
                <div className="set-label">{t("about_version")}</div>
                <p className="set-desc">KaiBoard v{APP_VERSION}</p>
              </div>
            </div>
            <div className="modal-foot">
              <span className="spacer" />
              <button className="mini" onClick={() => setShowSettings(false)}>
                {t("set_close")}
              </button>
            </div>
          </div>
        </>
      )}

      {showAIPanel && AI_ENABLED && <AIPanel {...agent} onClose={() => setShowAIPanel(false)} />}

      {folderConflict && (
        <>
          <div className="modal-backdrop" onClick={() => setFolderConflict(null)} />
          <div className="modal">
            <div className="modal-head">
              <strong>{t("fsq_title")}</strong>
              <button className="modal-close" onClick={() => setFolderConflict(null)} title={t("fsq_cancel")}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="set-desc">
                {t("fsq_desc", { n: folderConflict.nodes, b: folderConflict.boards })}
              </p>
              <div className="set-section">
                <button className="btn" onClick={() => resolveFolderConflict("merge")}>
                  {t("fsq_merge")}
                </button>
                <p className="set-experimental">{t("fsq_mergeDesc")}</p>
              </div>
              <div className="set-section">
                <button className="btn" onClick={() => resolveFolderConflict("useFolder")}>
                  {t("fsq_useFolder")}
                </button>
                <p className="set-experimental">{t("fsq_useFolderDesc")}</p>
              </div>
              <div className="set-section">
                <button className="btn danger" onClick={() => resolveFolderConflict("overwrite")}>
                  {t("fsq_overwrite")}
                </button>
                <p className="set-experimental">{t("fsq_overwriteDesc")}</p>
              </div>
            </div>
            <div className="modal-foot">
              <span className="spacer" />
              <button className="mini" onClick={() => setFolderConflict(null)}>
                {t("fsq_cancel")}
              </button>
            </div>
          </div>
        </>
      )}

      {showHelp && (
        <HelpDialog onClose={() => setShowHelp(false)} theme={theme} />
      )}

      {toast && (
        <div
          className="toast"
          style={
            {
              "--toast-bg": theme === "dark" ? "#363636" : "#ffffff",
              "--toast-color": theme === "dark" ? "#ced4da" : "#1e1e1e",
              "--toast-border": theme === "dark" ? "#495057" : "#e9ecef",
            } as any
          }
        >
          {toast}
        </div>
      )}
    </div>
  );
}
