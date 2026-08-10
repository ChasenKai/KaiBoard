// 文件形式的数据存储（File System Access API）
// 由用户手动选择一个文件夹，KaiBoard 把数据以真实文件存进去：
//   <所选文件夹>/kaiboard-data/tree.json     全部文件树节点（FileNode[]）
//   <所选文件夹>/kaiboard-data/boards/<id>.json   每个画板内容（BoardData）
// 这样数据不在浏览器系统盘，且若所选文件夹是云盘同步目录，即可多电脑同步。
//
// 本模块只在「存储位置」被设为文件夹时启用；否则 KaiBoard 仍用 IndexedDB（见 db.ts）。
// 类型用 any 规避部分浏览器/TS lib 尚未内置 File System Access 类型的问题。

declare global {
  interface Window {
    showDirectoryPicker?: (opts?: any) => Promise<any>;
  }
}

import type { FileNode, BoardData } from "./db";

let DATA_DIR: any = null; // kaiboard-data 目录句柄
let BOARDS_DIR: any = null;

export function fsSupported(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

/** 用一个用户选定的目录句柄初始化（创建 kaiboard-data / boards 子目录） */
export async function initFsStore(rootDir: any): Promise<void> {
  DATA_DIR = await rootDir.getDirectoryHandle("kaiboard-data", { create: true });
  BOARDS_DIR = await DATA_DIR.getDirectoryHandle("boards", { create: true });
}

async function writeJson(dir: any, name: string, data: any): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(JSON.stringify(data, null, 2));
  await w.close();
}

async function readJson(dir: any, name: string): Promise<any | null> {
  try {
    const fh = await dir.getFileHandle(name);
    const file = await fh.getFile();
    return JSON.parse(await file.text());
  } catch {
    return null;
  }
}

async function removeEntry(dir: any, name: string): Promise<void> {
  try {
    await dir.removeEntry(name);
  } catch {
    /* 文件不存在时忽略 */
  }
}

const alive = (n: FileNode) => !n.deletedAt;

async function readTree(): Promise<FileNode[]> {
  return (await readJson(DATA_DIR, "tree.json")) || [];
}
async function writeTree(nodes: FileNode[]): Promise<void> {
  await writeJson(DATA_DIR, "tree.json", nodes);
}
async function readBoard(id: string): Promise<BoardData | undefined> {
  return await readJson(BOARDS_DIR, id + ".json");
}
async function writeBoard(board: BoardData): Promise<void> {
  await writeJson(BOARDS_DIR, board.id + ".json", board);
}
async function removeBoard(id: string): Promise<void> {
  await removeEntry(BOARDS_DIR, id + ".json");
}

// ---------- 与 db.ts 同款 API ----------

export async function fsListAllNodes(): Promise<FileNode[]> {
  return readTree();
}
export async function fsListNodes(): Promise<FileNode[]> {
  return (await readTree()).filter(alive);
}
export async function fsListTrashRoots(): Promise<FileNode[]> {
  const all = await readTree();
  return all
    .filter((n) => n.deletedAt && n.trashRoot)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
}
export async function fsPutNode(node: FileNode): Promise<void> {
  const all = await readTree();
  const i = all.findIndex((n) => n.id === node.id);
  if (i >= 0) all[i] = node;
  else all.push(node);
  await writeTree(all);
}

/** 批量写树节点：一次读 + 一次写，避免逐节点重复重写整棵 tree.json。 */
export async function fsPutNodes(nodes: FileNode[]): Promise<void> {
  if (!nodes.length) return;
  const all = await readTree();
  const byId = new Map(all.map((n) => [n.id, n]));
  for (const n of nodes) byId.set(n.id, n);
  await writeTree([...byId.values()]);
}
export async function fsDeleteNode(id: string): Promise<void> {
  const all = (await readTree()).filter((n) => n.id !== id);
  await writeTree(all);
}
export async function fsListChildren(parentId: string | null): Promise<FileNode[]> {
  return (await fsListNodes()).filter((n) => n.parentId === parentId);
}
export async function fsListChildrenAll(parentId: string | null): Promise<FileNode[]> {
  return (await readTree()).filter((n) => n.parentId === parentId);
}
export async function fsGetNode(id: string): Promise<FileNode | undefined> {
  return (await readTree()).find((n) => n.id === id);
}
export async function fsGetMaxOrder(parentId: string | null): Promise<number> {
  const kids = await fsListChildren(parentId);
  const orders = kids.map((k) => k.order ?? 0);
  return orders.length ? Math.max(...orders) : 0;
}
export async function fsGetBoard(id: string): Promise<BoardData | undefined> {
  return readBoard(id);
}
export async function fsPutBoard(board: BoardData): Promise<void> {
  await writeBoard(board);
}
export async function fsDeleteBoard(id: string): Promise<void> {
  await removeBoard(id);
}
export async function fsGetAllFiles(): Promise<FileNode[]> {
  return fsListNodes();
}
export async function fsGetAllBoards(): Promise<BoardData[]> {
  const out: BoardData[] = [];
  try {
    for await (const [, h] of BOARDS_DIR.entries() as any) {
      if (typeof h.getFile !== "function") continue;
      const file = await h.getFile();
      const text = await file.text();
      out.push(JSON.parse(text));
    }
  } catch {
    /* 目录为空或不可用 */
  }
  return out;
}

export async function fsTrashNode(id: string): Promise<void> {
  const now = Date.now();
  const all = await readTree();
  const childrenOf = new Map<string | null, FileNode[]>();
  for (const n of all) {
    const arr = childrenOf.get(n.parentId) ?? [];
    arr.push(n);
    childrenOf.set(n.parentId, arr);
  }
  const stack: string[] = [id];
  let isRoot = true;
  while (stack.length) {
    const cur = stack.pop()!;
    const node = all.find((n) => n.id === cur);
    if (node && !node.deletedAt) {
      node.deletedAt = now;
      node.trashRoot = isRoot;
    }
    isRoot = false;
    for (const c of childrenOf.get(cur) ?? []) stack.push(c.id);
  }
  await writeTree(all);
}

export async function fsRestoreNode(id: string): Promise<void> {
  const all = await readTree();
  const node = all.find((n) => n.id === id);
  if (!node) return;
  const parent = node.parentId ? all.find((n) => n.id === node.parentId) : null;
  if (node.parentId && (!parent || parent.deletedAt)) node.parentId = null;
  const childrenOf = new Map<string | null, FileNode[]>();
  for (const n of all) {
    const arr = childrenOf.get(n.parentId) ?? [];
    arr.push(n);
    childrenOf.set(n.parentId, arr);
  }
  const stack: string[] = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    const n = all.find((x) => x.id === cur);
    if (n && n.deletedAt) {
      n.deletedAt = null;
      n.trashRoot = false;
    }
    for (const c of childrenOf.get(cur) ?? []) stack.push(c.id);
  }
  await writeTree(all);
}

export async function fsPurgeNode(id: string): Promise<void> {
  const all = await readTree();
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
  const remain = all.filter((n) => !targets.some((t) => t.id === n.id));
  await writeTree(remain);
  for (const t of targets) if (t.type === "board") await removeBoard(t.id);
}

export async function fsEmptyTrash(): Promise<void> {
  const roots = await fsListTrashRoots();
  for (const r of roots) await fsPurgeNode(r.id);
}

/**
 * 只读探测：所选文件夹里是否已经有 KaiBoard 数据。
 * 不创建任何目录、不写任何文件，也不改动本模块的 DATA_DIR / BOARDS_DIR，
 * 因此可以在「用户还没决定怎么处理」之前安全调用。
 */
export async function fsPeekFolder(rootDir: any): Promise<{ nodes: number; boards: number }> {
  try {
    const dataDir = await rootDir.getDirectoryHandle("kaiboard-data", { create: false });
    const tree: FileNode[] = (await readJson(dataDir, "tree.json")) || [];
    let boards = 0;
    try {
      const bd = await dataDir.getDirectoryHandle("boards", { create: false });
      for await (const [name] of bd.entries() as any) {
        if (String(name).endsWith(".json")) boards++;
      }
    } catch {
      /* boards 子目录不存在 */
    }
    return { nodes: tree.filter(alive).length, boards };
  } catch {
    return { nodes: 0, boards: 0 }; // 目录里没有 kaiboard-data，视为全新文件夹
  }
}

/**
 * 【覆盖】把当前 IndexedDB 工作区整体写入文件夹。
 * 危险：文件夹原有的 tree.json 会被整体替换（同 id 画板文件被改写；
 * 文件夹里多出来的画板文件虽不删除，但会从目录树消失 = 事实上不可见）。
 * 仅在文件夹为空、或用户显式选择「以本机为准」时调用。
 */
export async function fsCopyFromIdb(idb: {
  listAllNodes: () => Promise<FileNode[]>;
  getAllBoards: () => Promise<BoardData[]>;
}): Promise<void> {
  const nodes = await idb.listAllNodes();
  const boards = await idb.getAllBoards();
  await writeTree(nodes);
  for (const b of boards) await writeBoard(b);
}

/**
 * 【合并·推荐】本机 IndexedDB 与文件夹已有数据按 id 求并集，两边都不丢：
 * - 文件夹里有、本机没有的 → 原样保留
 * - 本机有、文件夹没有的   → 写进文件夹
 * - 两边都有（同 id）      → updatedAt 较新的一方胜出（画板内容随之写入）
 * id 是 UUID，跨机不会误撞；同 id 必然是同一个逻辑节点经云盘同步而来。
 */
export async function fsMergeFromIdb(idb: {
  listAllNodes: () => Promise<FileNode[]>;
  getAllBoards: () => Promise<BoardData[]>;
}): Promise<{ added: number; updated: number; kept: number }> {
  const localNodes = await idb.listAllNodes();
  const localBoards = await idb.getAllBoards();
  const remote = await readTree();

  const merged = new Map<string, FileNode>();
  for (const n of remote) merged.set(n.id, n);

  const boardById = new Map(localBoards.map((b) => [b.id, b]));
  const toWrite: BoardData[] = [];
  let added = 0;
  let updated = 0;

  for (const n of localNodes) {
    const exist = merged.get(n.id);
    if (!exist) {
      merged.set(n.id, n);
      added++;
    } else if ((n.updatedAt ?? 0) > (exist.updatedAt ?? 0)) {
      merged.set(n.id, n);
      updated++;
    } else {
      continue; // 文件夹侧更新，保留文件夹版本，不覆写画板文件
    }
    if (n.type === "board") {
      const b = boardById.get(n.id);
      if (b) toWrite.push(b);
    }
  }

  await writeTree([...merged.values()]);
  for (const b of toWrite) await writeBoard(b);
  return { added, updated, kept: remote.length };
}

/** 读取文件夹存储的全部数据（切回 IndexedDB 前先导出，用于无缝合并回去） */
export async function fsExportAll(): Promise<{ nodes: FileNode[]; boards: BoardData[] }> {
  const nodes = await readTree();
  const boards: BoardData[] = [];
  for (const n of nodes) {
    if (n.type === "board") {
      const b = await readBoard(n.id);
      if (b) boards.push(b);
    }
  }
  return { nodes, boards };
}
