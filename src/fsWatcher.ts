// 外部变化重读（M2-3 · 「落板即见」关键一环）
//
// 文件夹存储（filesystem）模式下，Agent（或任何外部进程，如 @kaiboard/mcp-server 的
// `--dir` 绑定）会直写 <文件夹>/kaiboard-data/ 下的 tree.json 与 boards/<id>.json。
// 应用本体此前只在「操作时」重读（见 fsStore 的 readTree 调用点），Agent 写入后用户
// 不操作就看不到。本模块补上「切前台 / 定时」重读：
//
//   - 树变化（Agent 建板 / 向非当前画板落图）→ 刷新左侧文件树（onTreeChanged）
//   - 当前画板文件在「本标签页后台期间」被改 → 回到前台时重载当前画板（onBoardChanged）
//
// 设计边界（避免冲掉用户可见状态下的编辑）：
//   - 当前画板重载【只在 visibilitychange 前台跃迁时】发生；定时轮询不重载当前画板，
//     只记录 mtime，使后台外部写入的差异保留到前台再落。
//   - IndexedDB 后端下为 no-op（其变化均经应用内桥，已各自刷新）。
//
// 仅依赖 db.ts 的 getBackend / getTreeMtime / getBoardMtime，零新增依赖、不影响双路构建。

import { getBackend, getTreeMtime, getBoardMtime } from "./db";

export interface FsWatcherHandle {
  stop: () => void;
}

export function startFsWatcher(opts: {
  /** 取当前打开画板 id（用 ref，避免闭包拿到旧值） */
  getActiveBoardId: () => string | null;
  /** 树变化 → 刷新左侧文件树 */
  onTreeChanged: () => void;
  /** 当前画板需重载 → 重新载入画布 */
  onBoardChanged: (id: string) => void;
  /** 轮询间隔，默认 5s */
  intervalMs?: number;
}): FsWatcherHandle {
  const intervalMs = opts.intervalMs ?? 5000;
  let lastTreeMtime = 0;
  let lastBoardMtime = 0;
  let initialized = false;
  let stopped = false;
  let timer: number | null = null;

  const isDocVisible = (): boolean =>
    typeof document === "undefined" || document.visibilityState === "visible";

  const tick = async (fromVisibility: boolean): Promise<void> => {
    if (stopped) return;
    if (getBackend() !== "fs") return;
    const visible = isDocVisible();
    try {
      // ---- 树：任何变化都刷新（安全，无冲掉风险）----
      const treeMtime = await getTreeMtime();
      if (treeMtime && treeMtime !== lastTreeMtime) {
        lastTreeMtime = treeMtime;
        if (initialized) opts.onTreeChanged();
      }

      // ---- 当前画板：仅前台跃迁且后台期间被改时重载 ----
      const activeId = opts.getActiveBoardId();
      if (activeId) {
        const boardMtime = await getBoardMtime(activeId);
        if (boardMtime && boardMtime !== lastBoardMtime) {
          if (fromVisibility && initialized) {
            // 回到前台，且当前画板在后台被外部改写 → 安全重载
            opts.onBoardChanged(activeId);
          }
          // 前台轮询：消费自身自动保存产生的 mtime 变化，不重载；
          // 后台轮询：故意不更新 lastBoardMtime，保留外部差异到前台再落。
          if (visible) lastBoardMtime = boardMtime;
        }
      } else {
        lastBoardMtime = 0;
      }
    } catch {
      /* 读取失败忽略，下次轮询再探 */
    } finally {
      initialized = true;
    }
  };

  const onVisibility = (): void => {
    if (isDocVisible()) void tick(true);
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }
  timer = window.setInterval(() => void tick(false), intervalMs);

  return {
    stop: () => {
      stopped = true;
      if (timer != null) window.clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    },
  };
}
