import { listNodes, listAllNodes, getAllBoards, putNode, putBoard, putNodes, getMaxOrder, type FileNode, type BoardData } from "./db";
import { t } from "./i18n";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// 导入时做的字段归一化：兼容外部/旧工具导出的脏值
// - parentId 可能为字符串 'None' / 'null' / 非 uuid → 一律视为根层 null
// - createdAt / updatedAt 可能是字符串时间戳 → 转数字
// - 顺便剥离 deletedAt / trashRoot 等回收站标记
function normalizeFileNode(f: any): FileNode {
  let pid = f?.parentId;
  if (pid == null || pid === "None" || pid === "null" || typeof pid !== "string") pid = null;
  const num = (v: any) =>
    typeof v === "string" ? Number(v) || Date.now() : typeof v === "number" ? v : Date.now();
  const ord = f?.order;
  return {
    id: f.id,
    type: f.type === "folder" ? "folder" : "board",
    name: f.name || (f.type === "folder" ? t("node_unnamedFolder") : t("node_unnamedBoard")),
    parentId: pid,
    createdAt: num(f.createdAt),
    updatedAt: num(f.updatedAt),
    order: typeof ord === "number" ? ord : typeof ord === "string" ? Number(ord) || 0 : 0,
  };
}

function normalizeParentId(pid: any): string | null {
  if (pid == null || pid === "None" || pid === "null" || typeof pid !== "string") return null;
  return pid;
}

// ============ 工作区备份（整个文件树 + 全部画板）============
// 注意：只备份「未删除」的节点（listNodes）。回收站里的内容不进备份，
// 避免导出带 deletedAt/trashRoot 的脏数据，也避免重新导入时生成孤儿。
//
// 关键设计：导出时让用户定义「顶层文件夹名」，
// 把当前所有根层节点挂到这个新建的顶层文件夹之下。这样在另一台已有数据的
// 电脑上「导入备份」时，会平行合并为一个独立文件夹，绝不影响目标机原有内容。
// （用户若觉得顶层文件夹多余，导入后把内容拖出、删掉顶层文件夹即可。）
export async function exportAll(): Promise<boolean> {
  const topName = window.prompt(t("exportAll_prompt"), t("exportAll_default"));
  if (topName === null) return false; // 用户取消
  const name = topName.trim() || t("exportAll_default");

  const files = await listNodes(); // 仅未删除节点
  const aliveIds = new Set(files.map((f) => f.id));
  const trashedIds = new Set(
    (await listAllNodes())
      .filter((f) => !aliveIds.has(f.id))
      .map((f) => f.id)
  );
  // 画板只保留：未删除节点的画板 + 孤儿画板（无树节点，重新导入时会自动补建）
  const boards = (await getAllBoards()).filter((b) => !trashedIds.has(b.id));

  // 新建顶层文件夹，把所有「当前根层节点」挂到它下面
  const rootId = crypto.randomUUID();
  const rootFolder: FileNode = {
    id: rootId,
    type: "folder",
    name,
    parentId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    order: 0,
  };
  const remappedFiles = files.map((f) =>
    f.parentId == null ? { ...f, parentId: rootId } : f
  );

  const payload = {
    app: "KaiBoard",
    version: 1,
    exportedAt: new Date().toISOString(),
    files: [rootFolder, ...remappedFiles],
    boards,
  };
  triggerDownload(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    `kaiboard-backup-${new Date().toISOString().slice(0, 10)}.json`
  );
  return true;
}

// ============ 单画板导出（Excalidraw 原生 .excalidraw 场景）============
export async function exportBoard(name: string, board: BoardData): Promise<void> {
  const safe = (name || "画板").replace(/[\\/:*?"<>|]/g, "_");
  const scene = {
    type: "excalidraw",
    version: 2,
    source: "KaiBoard",
    elements: board.elements || [],
    appState: board.appState || {},
    files: board.files || {},
  };
  triggerDownload(
    new Blob([JSON.stringify(scene, null, 2)], { type: "application/json" }),
    `${safe}.excalidraw`
  );
}

// ============ 导入：自动识别格式 ============
// 返回导入后建议激活的画板 id（没有则返回 null）
export async function importFile(file: File, defaultParentId: string | null): Promise<string | null> {
  const text = await file.text();
  let payload: any;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(t("error_notJson"));
  }

  // 单画板场景（Excalidraw .excalidraw）：含有 elements 数组，且没有 files/boards 包装
  if (Array.isArray(payload?.elements) && !Array.isArray(payload?.files) && !Array.isArray(payload?.boards)) {
    return await importScene(payload, file.name, defaultParentId);
  }

  // 工作区备份：{ files: [...], boards: [...] }
  const files: FileNode[] = Array.isArray(payload?.files) ? payload.files : [];
  const boards: BoardData[] = Array.isArray(payload?.boards) ? payload.boards : [];
  if (files.length === 0 && boards.length === 0) {
    throw new Error(t("error_emptyBackup"));
  }
  return await importWorkspace(files, boards);
}

// 导入单个 Excalidraw 场景 → 新建一个画板节点（必建树节点，杜绝孤儿）
async function importScene(scene: any, fileName: string, defaultParentId: string | null): Promise<string> {
  const id = crypto.randomUUID();
  const base = fileName.replace(/\.excalidraw$/i, "").replace(/\.json$/i, "");
  const name = base || t("board_importedName");
  const now = Date.now();
  const maxOrder = await getMaxOrderSafe(defaultParentId);
  const node: FileNode = {
    id,
    type: "board",
    name,
    parentId: defaultParentId,
    createdAt: now,
    updatedAt: now,
    order: maxOrder + 1,
  };
  await putNode(node);
  await putBoard({
    id,
    elements: scene.elements || [],
    appState: scene.appState || {},
    files: scene.files || {},
  });
  return id;
}

// 导入工作区备份：为所有节点 / 画板生成全新 id，按映射重接 parentId，
// 平行合并进当前工作区 —— 绝不覆盖、绝不清空目标已有数据（与迁移工具一致）。
// 即使源文件与目标机存在相同内容，也会作为独立副本并存，由用户自行取舍。
async function importWorkspace(files: FileNode[], boards: BoardData[]): Promise<string | null> {
  // 1) 为每一个 file / board 分配全新 id（平行合并，从源头避免 id 冲突 / 覆盖）
  const idMap = new Map<string, string>();
  for (const f of files) idMap.set(f.id, crypto.randomUUID());
  for (const b of boards) if (b.id) idMap.set(b.id, crypto.randomUUID());
  const newId = (old: any) => (old != null && idMap.has(old) ? idMap.get(old)! : old);
  const normPid = (pid: any) => {
    const p = normalizeParentId(pid);
    return p == null ? null : idMap.has(p) ? idMap.get(p)! : p;
  };

  // 2) 收集所有文件树节点（全部用新 id，parentId 一并重映射），最后一次性写入。
  //    走 putNode / putBoard —— 自动路由到当前存储后端（IndexedDB 或文件夹文件存储）。
  //    （此前直接 getDB().transaction 写死 IndexedDB，文件夹存储模式下导入会落到错误后端。）
  const fileNodes: FileNode[] = [];
  for (const f of files) {
    const nf = normalizeFileNode(f);
    fileNodes.push({ ...nf, id: newId(f.id), parentId: normPid(f.parentId) });
  }

  // 3) 写画板内容（新 id）；孤儿画板（无对应 file 节点）自动补建树节点挂到根
  let firstBoardId: string | null = null;
  for (const b of boards) {
    if (!b.id) continue;
    const bid = newId(b.id);
    await putBoard({ ...b, id: bid });
    if (!files.some((f) => f.id === b.id)) {
      fileNodes.push({
        id: bid,
        type: "board",
        name: (b as any).name || t("node_unnamedBoard"),
        parentId: null,
        createdAt:
          typeof (b as any).createdAt === "string"
            ? Number((b as any).createdAt) || Date.now()
            : (b as any).createdAt || Date.now(),
        updatedAt: Date.now(),
        order: typeof (b as any).order === "number" ? (b as any).order : 0,
      });
    }
    if (!firstBoardId) firstBoardId = bid;
  }
  if (fileNodes.length) await putNodes(fileNodes);
  return firstBoardId;
}

async function getMaxOrderSafe(parentId: string | null): Promise<number> {
  return getMaxOrder(parentId);
}
