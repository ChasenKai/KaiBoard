import { openDB, type IDBPDatabase } from "idb";
import * as fs from "./fsStore";

export interface FileNode {
  id: string;
  type: "folder" | "board";
  name: string;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
  order?: number; // 同层排序权重，越小越靠前；拖拽/移动时更新
  deletedAt?: number | null; // 软删除时间戳；空 = 未删除（在回收站中可还原）
  trashRoot?: boolean; // 标记「用户直接删除的那一个」，其子孙只打 deletedAt 不打此标记
}

export interface BoardData {
  id: string;
  elements: any[];
  appState: any;
  files: any;
}

// KaiBoard 的 IndexedDB：库名 kaiboard
// - files    store：文件树节点（文件夹 + 画板），按 id 主键，parentId 索引
// - boards   store：画板内容（elements/appState/files），按 id 主键
// - settings store：UI 状态持久化（展开态 / 最后打开画板 / 侧边栏宽度 / 主题 / 语言 / 存储位置），key-value
// 注意：settings 永远存 IndexedDB —— 因为「文件夹存储」的句柄本身就记录在 settings 里。
//
// 可选存储后端：folder（File System Access API）。通过 ensureStorage() 决定用哪个后端，
// 默认 idb。切换逻辑见文件底部 ensureStorage / backend。

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB("kaiboard", 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("files")) {
          const files = db.createObjectStore("files", { keyPath: "id" });
          files.createIndex("parentId", "parentId");
        }
        if (!db.objectStoreNames.contains("boards")) {
          db.createObjectStore("boards", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings"); // out-of-line key
        }
      },
    });
  }
  return dbPromise;
}

// ---------- 存储后端路由 ----------
let backend: "idb" | "fs" = "idb";
let ensurePromise: Promise<void> | null = null;

/**
 * 决定当前用哪个存储后端。幂等（只跑一次）。
 * - 默认 idb（IndexedDB，浏览器系统盘）。
 * - 若设置里 storageMode==="filesystem" 且存有目录句柄，且权限已授予，则切到 fs（文件夹文件存储）。
 */
export function ensureStorage(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      try {
        const mode = await getSetting<string>("storageMode", "idb");
        const handle = await getSetting<any>("storageFolderHandle", null);
        if (mode === "filesystem" && handle) {
          const q = handle.queryPermission
            ? await handle.queryPermission({ mode: "readwrite" })
            : "denied";
          if (q === "granted") {
            await fs.initFsStore(handle);
            backend = "fs";
            return;
          }
          const r = handle.requestPermission
            ? await handle.requestPermission({ mode: "readwrite" })
            : "denied";
          if (r === "granted") {
            await fs.initFsStore(handle);
            backend = "fs";
            return;
          }
        }
      } catch {
        /* 任何异常都回退到 IndexedDB，保证可用 */
      }
      backend = "idb";
    })();
  }
  return ensurePromise;
}

export function getBackend(): "idb" | "fs" {
  return backend;
}

/** 运行时切换到文件夹存储（设置 UI 在用户选好文件夹并授权后调用） */
export async function activateFsBackend(handle: any): Promise<void> {
  await fs.initFsStore(handle);
  backend = "fs";
}

/** 运行时切回 IndexedDB（恢复默认存储） */
export function resetBackend(): void {
  backend = "idb";
}

const alive = (n: FileNode) => !n.deletedAt;

/** 全部节点（含回收站中的） */
export async function listAllNodes(): Promise<FileNode[]> {
  await ensureStorage();
  if (backend === "fs") return fs.fsListAllNodes();
  const db = await getDB();
  return (await db.getAll("files")) as FileNode[];
}

/** 未删除的节点（文件树展示用） */
export async function listNodes(): Promise<FileNode[]> {
  await ensureStorage();
  if (backend === "fs") return fs.fsListNodes();
  return (await listAllNodes()).filter(alive);
}

/** 回收站条目：只列出用户直接删除的那一层（子孙不重复列出） */
export async function listTrashRoots(): Promise<FileNode[]> {
  await ensureStorage();
  if (backend === "fs") return fs.fsListTrashRoots();
  const all = await listAllNodes();
  return all
    .filter((n) => n.deletedAt && n.trashRoot)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
}

export async function putNode(node: FileNode): Promise<void> {
  await ensureStorage();
  if (backend === "fs") return fs.fsPutNode(node);
  const db = await getDB();
  await db.put("files", node);
}

/** 硬删除单个节点（不递归、不动 boards），仅供回收站「彻底删除」内部使用 */
export async function deleteNode(id: string): Promise<void> {
  await ensureStorage();
  if (backend === "fs") return fs.fsDeleteNode(id);
  const db = await getDB();
  await db.delete("files", id);
}

/** 未删除的直接子节点；parentId 传 null 取根层 */
export async function listChildren(parentId: string | null): Promise<FileNode[]> {
  await ensureStorage();
  if (backend === "fs") return fs.fsListChildren(parentId);
  const all = await listNodes();
  return all.filter((n) => n.parentId === parentId);
}

/** 含已删除的直接子节点（回收站递归还原/清除时用） */
export async function listChildrenAll(parentId: string | null): Promise<FileNode[]> {
  await ensureStorage();
  if (backend === "fs") return fs.fsListChildrenAll(parentId);
  const all = await listAllNodes();
  return all.filter((n) => n.parentId === parentId);
}

export async function getNode(id: string): Promise<FileNode | undefined> {
  await ensureStorage();
  if (backend === "fs") return fs.fsGetNode(id);
  const db = await getDB();
  return (await db.get("files", id)) as FileNode | undefined;
}

/**
 * 取某父节点下兄弟节点中的最大 order（无则 0），用于追加到末尾。
 */
export async function getMaxOrder(parentId: string | null): Promise<number> {
  await ensureStorage();
  if (backend === "fs") return fs.fsGetMaxOrder(parentId);
  const kids = await listChildren(parentId);
  const orders = kids.map((k) => k.order ?? 0);
  return orders.length ? Math.max(...orders) : 0;
}

export async function getBoard(id: string): Promise<BoardData | undefined> {
  await ensureStorage();
  if (backend === "fs") return fs.fsGetBoard(id);
  const db = await getDB();
  return (await db.get("boards", id)) as BoardData | undefined;
}

/** 画板文件最后修改时间（ms）。仅 filesystem 后端有意义；其余返回 0。供外部变化重读判断。 */
export async function getBoardMtime(id: string): Promise<number> {
  await ensureStorage();
  if (backend === "fs") return fs.fsBoardMtime(id);
  return 0;
}

/** tree.json 最后修改时间（ms）。仅 filesystem 后端有意义；其余返回 0。供外部变化重读判断。 */
export async function getTreeMtime(): Promise<number> {
  await ensureStorage();
  if (backend === "fs") return fs.fsTreeMtime();
  return 0;
}

export async function putBoard(board: BoardData): Promise<void> {
  await ensureStorage();
  if (backend === "fs") return fs.fsPutBoard(board);
  const db = await getDB();
  await db.put("boards", board);
}

/** 批量写文件树节点（一次落盘，避免逐节点重复写整棵 tree.json）。仅用于导入等批量场景。 */
export async function putNodes(nodes: FileNode[]): Promise<void> {
  if (!nodes.length) return;
  await ensureStorage();
  if (backend === "fs") return fs.fsPutNodes(nodes);
  const db = await getDB();
  const tx = db.transaction("files", "readwrite");
  for (const n of nodes) await tx.store.put(n);
  await tx.done;
}

export async function deleteBoard(id: string): Promise<void> {
  await ensureStorage();
  if (backend === "fs") return fs.fsDeleteBoard(id);
  const db = await getDB();
  await db.delete("boards", id);
}

export async function getAllFiles(): Promise<FileNode[]> {
  await ensureStorage();
  if (backend === "fs") return fs.fsGetAllFiles();
  return listNodes();
}

export async function getAllBoards(): Promise<BoardData[]> {
  await ensureStorage();
  if (backend === "fs") return fs.fsGetAllBoards();
  const db = await getDB();
  return (await db.getAll("boards")) as BoardData[];
}

// ---------- 回收站 ----------

/** 软删除：给节点及其全部子孙打 deletedAt，仅顶层打 trashRoot */
export async function trashNode(id: string): Promise<void> {
  await ensureStorage();
  if (backend === "fs") return fs.fsTrashNode(id);
  const now = Date.now();
  const all = await listAllNodes();
  const childrenOf = new Map<string | null, FileNode[]>();
  for (const n of all) {
    const arr = childrenOf.get(n.parentId) ?? [];
    arr.push(n);
    childrenOf.set(n.parentId, arr);
  }
  const db = await getDB();
  const tx = db.transaction("files", "readwrite");
  const stack: string[] = [id];
  let isRoot = true;
  while (stack.length) {
    const cur = stack.pop()!;
    const node = all.find((n) => n.id === cur);
    if (node && !node.deletedAt) {
      node.deletedAt = now;
      node.trashRoot = isRoot;
      await tx.store.put(node);
    }
    isRoot = false;
    for (const c of childrenOf.get(cur) ?? []) stack.push(c.id);
  }
  await tx.done;
}

/** 还原：清除节点及其子孙的删除标记；若原父级已不存在则还原到根层 */
export async function restoreNode(id: string): Promise<void> {
  await ensureStorage();
  if (backend === "fs") return fs.fsRestoreNode(id);
  const all = await listAllNodes();
  const node = all.find((n) => n.id === id);
  if (!node) return;

  const parent = node.parentId ? all.find((n) => n.id === node.parentId) : null;
  if (node.parentId && (!parent || parent.deletedAt)) {
    node.parentId = null;
  }

  const childrenOf = new Map<string | null, FileNode[]>();
  for (const n of all) {
    const arr = childrenOf.get(n.parentId) ?? [];
    arr.push(n);
    childrenOf.set(n.parentId, arr);
  }

  const db = await getDB();
  const tx = db.transaction("files", "readwrite");
  const stack: string[] = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    const n = all.find((x) => x.id === cur);
    if (n && n.deletedAt) {
      n.deletedAt = null;
      n.trashRoot = false;
      await tx.store.put(n);
    }
    for (const c of childrenOf.get(cur) ?? []) stack.push(c.id);
  }
  await tx.done;
}

/** 彻底删除：物理移除节点及其全部子孙（含 boards 内容），不可恢复 */
export async function purgeNode(id: string): Promise<void> {
  await ensureStorage();
  if (backend === "fs") return fs.fsPurgeNode(id);
  const all = await listAllNodes();
  const childrenOf = new Map<string | null, FileNode[]>();
  for (const n of all) {
    const arr = childrenOf.get(n.parentId) ?? [];
    arr.push(n);
    childrenOf.set(n.parentId, arr);
  }
  const targets: FileNode[] = [];
  const stack: string[] = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    const n = all.find((x) => x.id === cur);
    if (n) targets.push(n);
    for (const c of childrenOf.get(cur) ?? []) stack.push(c.id);
  }
  const db = await getDB();
  const tx = db.transaction(["files", "boards"], "readwrite");
  for (const t of targets) {
    await tx.objectStore("files").delete(t.id);
    if (t.type === "board") await tx.objectStore("boards").delete(t.id);
  }
  await tx.done;
}

/** 清空回收站 */
export async function emptyTrash(): Promise<void> {
  await ensureStorage();
  if (backend === "fs") return fs.fsEmptyTrash();
  const roots = await listTrashRoots();
  for (const r of roots) await purgeNode(r.id);
}

// ---------- UI 设置持久化（始终走 IndexedDB）----------

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await getDB();
    const v = await db.get("settings", key);
    return (v === undefined ? fallback : v) as T;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: any): Promise<void> {
  try {
    const db = await getDB();
    await db.put("settings", value, key);
  } catch {
    /* 设置写入失败不影响主流程 */
  }
}
