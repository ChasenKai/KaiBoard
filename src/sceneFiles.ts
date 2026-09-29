// 场景图片裁剪（唯一实现，所有落盘点共用）
//
// 背景：Excalidraw 的 api.getFiles() 返回的是**进程内累积**的文件库，不是「当前画板的图片」。
//   载入画板时我们只 addFiles 追加、从不清理（Excalidraw 也没提供清空 API），所以只要这次
//   会话切过 N 个有图的板，文件库里就同时躺着这 N 个板的全部图片。
//
//   于是任何一处「把 getFiles() 原样写回存储」的代码，都会把**全会话图片**灌进**目标画板**：
//     → 图片在板与板之间指数级复制（实测 60 板 / 92.5MB，97% 是图片）
//     → 磁盘被撑爆，且这类孤儿图 MCP 命令层也删不掉（relay 只能改 elements）
//
// 修复口径：落盘前只保留**本板 elements 里真的引用到的** fileId。
// 这是唯一正确判据 —— 不是"当前打开的板"，也不是"最近用过的"，就是元素引用。
//
// 🔴 纪律：新增任何写 board.files 的代码路径，都必须经过本函数。
//   2026-09-29 的教训：首轮只修了 App.tsx 的 runSave，agentBridge 的 2 处 + App.tsx 另 4 处
//   仍在原样写回 —— 修复必须「扫全部调用点」，不能「修我看到的那一处」。

/** 收集 elements 里实际引用到的 fileId（跳过已删除元素）。 */
export function referencedFileIds(elements: unknown): Set<string> {
  const used = new Set<string>();
  for (const e of (elements as any[]) || []) {
    if (e && !e.isDeleted && e.type === "image" && typeof e.fileId === "string") {
      used.add(e.fileId);
    }
  }
  return used;
}

/**
 * 把「进程内全量文件库」裁剪为「本板实际引用的图片」。
 *
 * @param files    通常是 api.getFiles() 的返回值
 * @param elements 该画板的 elements
 * @returns 只含被引用 fileId 的新对象；入参异常时**退化为原值**（宁可多存，不可丢图）
 */
export function pruneFilesToScene(files: unknown, elements: unknown): any {
  try {
    const src = (files as Record<string, any>) || {};
    const used = referencedFileIds(elements);
    // 一个都没引用 → 直接空对象（这正是「没放过图的板却存了 11 张图」的根因）
    return Object.fromEntries(Object.entries(src).filter(([fid]) => used.has(fid)));
  } catch {
    return files;
  }
}
