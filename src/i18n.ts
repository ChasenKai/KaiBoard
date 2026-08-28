// KaiBoard 外壳 UI 国际化（i18n）
// 画布内 Excalidraw 自带多语言，由 <Excalidraw langCode> 控制；
// 这里只负责「外壳」——侧边栏 / 右键菜单 / 回收站 / 顶栏 / 提示 toast / 设置。
//
// 支持语言：简体中文(zh-CN)、繁体中文(zh-TW)、英文(en)。
// 用法：import { t, getLang, setLang, LANGS, excalidrawLang } from "./i18n";
//       t("ui_newBoard") / t("toast_jumpedTo", { name: "X" })

export type Lang = "zh-CN" | "zh-TW" | "en";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "en", label: "English" },
];

type Dict = Record<string, string>;

const AI_ENABLED = import.meta.env.VITE_AI_ENABLED !== "false";

const agentStrings = {
  agent_title: "Agent 共绘",
  agent_desc: "允许外部 AI Agent（经本地中继）在你的画布上实时增删元素。开启后 KaiBoard 会自动轮询本机 127.0.0.1:8787，不再需要油猴脚本或 F12。默认关闭；关闭后页面立即停止轮询，外部完全无法驱动。",
  agent_enable: "启用 Agent 共绘",
  agent_relayUrl: "中继地址：",
  agent_relayUrlPlaceholder: "http://127.0.0.1:8787",
  agent_relayToken: "中继令牌（复制给 Agent）：",
  agent_relayTokenPlaceholder: "由本地中继自动获取并显示",
  agent_relayAuto: "这是本机中继的令牌。点「复制给 Agent」复制它，粘贴到你所用 Agent 的 MCP 配置里（环境变量 KAIBOARD_TOKEN）即完成授权。不复制 = 不授权任何 Agent。",
  agent_copyToken: "复制给 Agent",
  agent_copied: "已复制 ✓ 去 Agent 的 MCP 配置粘贴（环境变量 KAIBOARD_TOKEN）",
  agent_copyFail: "复制失败，请手动选中文本复制",
  agent_rediscover: "重新检测",
  agent_relayNotFound: "未检测到本地中继，请先运行 kaiboard-mcp --relay（统一 MCP 服务会自带本地中继）。",
  agent_relayStatus: "连接状态：",
  agent_status_idle: "未连接",
  agent_status_connecting: "连接中…",
  agent_status_connected: "已连接",
  agent_status_error: "连接失败（检查中继是否运行 / 令牌是否一致）",
  agent_enabledNote: "已启用：页面正在轮询本地中继；请在同一台电脑运行 kaiboard-mcp --relay，并把上面的「中继令牌」复制到你 Agent 的 MCP 配置（环境变量 KAIBOARD_TOKEN）。",
  agent_disabledNote: "未启用：外部 Agent 无法驱动此白板。",
  agent_enabled: "已启用 Agent 共绘",
  agent_disabled: "已关闭 Agent 共绘",
  agent_snapshotTitle: "快照还原（Agent 共绘安全网）",
  agent_snapshotDesc: "Agent 每次「整板替换 / Mermaid 整板落图」前都会自动存一份快照（最多 20 份）。这里可把它恢复回来，避免误替换后无法撤销。",
  agent_snapshotRefresh: "刷新快照",
  agent_snapshotEmpty: "当前画板暂无快照。Agent 执行过「整板替换」或「Mermaid 整板落图」后，这里会出现可恢复的版本。",
  agent_snapshotMeta: "共 {n} 个元素",
  agent_snapshotRestore: "恢复此版本",
  agent_snapshotRestored: "已恢复快照（{n} 个元素，可 Ctrl+Z 再撤销）",
};

const zhCN: Dict = {
  boot_folder: "我的画板",
  boot_board: "画板 1",
  name_copy: " 副本",
  default_folderName: "新建文件夹",
  default_boardName: "新建画板",
  confirm_moveTrash: "把「{name}」移入回收站？可随时还原。",
  confirm_moveFolderTrash: "把文件夹「{name}」及其中 {n} 项移入回收站？可随时还原。",
  confirm_moveManyTrash: "把选中的 {n} 项移入回收站？可随时还原。",

  toast_incompatibleSkipped: "该画板有 {n} 个不兼容元素已被自动跳过",
  toast_incompatibleBlank: "该画板内容可能与当前版本不兼容，已载入空白画布（其它画板不受影响）",
  toast_jumpedTo: "已跳转到「{name}」",
  toast_linkNotFound: "链接指向的画板不存在（可能已被删除）",
  toast_cannotMoveIntoSelf: "不能移动到自身的子文件夹中",
  toast_boardsMoved: "已移动 {n} 个画板到「{folder}」",
  toast_movedN: "已移动 {n} 项",
  toast_copiedN: "已复制 {n} 项",
  toast_duplicated: "已创建副本",
  toast_importedN: "已导入 {n} 个画板",
  toast_importedSkip: "已导入 {n} 个画板，跳过 {m} 个文件：{list}",
  toast_importNone: "未导入任何画板，跳过 {m} 个文件：{list}",
  toast_copiedLink: "已复制画板链接，粘贴到画布元素的「链接」中即可跳转",
  toast_toTrash: "已移入回收站",
  toast_toTrashMany: "已移入回收站（{n} 个）",
  toast_restored: "已还原「{name}」",
  toast_purged: "已彻底删除",
  toast_trashEmptied: "回收站已清空",
  undo_empty: "没有可撤销的操作",
  undo_restore: "已恢复「{name}」",
  undo_move: "已撤销移动「{name}」",
  undo_rename: "已撤销重命名「{name}」",
  undo_create: "已撤销新建「{name}」",
  undo_clone: "已撤销副本「{name}」",
  undo_items: "{n} 项",
  toast_backupExported: "已导出整体备份（含顶层文件夹）",
  toast_workspaceMerged: "已平行合并导入（不影响已有内容）",
  toast_importFailed: "导入失败：{msg}",

  importSkip_workspace: "「{name}」是工作区备份，请改用顶栏「导入备份」",
  importSkip_notJson: "「{name}」不是合法 JSON",
  importSkip_notBoard: "「{name}」不是有效的 .excalidraw 画板",
  importSkip_failed: "「{name}」导入失败：{msg}",

  ui_expandSidebar: "展开侧边栏",
  ui_collapseSidebar: "收起侧边栏",
  ui_noBoardOpen: "未打开画板",
  ui_saving: "保存中…",
  ui_saved: "已保存",
  ui_newFolder: "+ 文件夹",
  ui_newBoard: "+ 画板",
  ui_exportAll: "导出全部（备份 .json）",
  ui_exportAllTitle: "备份整个工作区（全部文件夹 + 全部画板）",
  ui_importBackup: "导入备份（.json）",
  ui_importBackupTitle: "导入整体工作区备份；单个画板请用文件夹右键「导入画板」",
  ui_themeToDark: "切换到深色",
  ui_themeToLight: "切换到浅色",
  ui_resize: "拖动调整宽度",

  sidebar_searchPlaceholder: "搜索画板 / 文件夹",
  sidebar_foundN: "找到 {n} 项",
  sidebar_noMatch: "没有匹配项",
  sidebar_clear: "清除",
  sidebar_empty: "暂无画板，右键此处或点顶部「+ 新建画板」",
  sidebar_trash: "回收站",
  sidebar_trashTitle: "查看回收站，可还原误删的画板",

  ctx_root: "根目录",
  ctx_newBoard: "+ 新建画板",
  ctx_newFolder: "+ 新建文件夹",
  ctx_importBoard: "导入画板",
  ctx_exportBoard: "导出此画板 (.excalidraw)",
  ctx_duplicate: "创建副本",
  ctx_copyLink: "复制画板链接",
  ctx_copyLinkTitle: "复制后粘贴到画布元素的「链接」中，点击即可跳转到此画板",
  ctx_cut: "剪切",
  ctx_copy: "复制",
  ctx_paste: "粘贴",
  ctx_rename: "重命名",
  ctx_delete: "删除",

  trash_title: "回收站",
  trash_empty: "回收站是空的。删除的画板会先放到这里，可以随时还原。",
  trash_restore: "还原",
  trash_purge: "彻底删除",
  trash_purgeConfirm: "彻底删除「{name}」？此操作不可恢复。",
  trash_totalN: "共 {n} 项",
  trash_emptyConfirm: "清空回收站？其中所有内容将被永久删除，不可恢复。",
  trash_emptyBtn: "清空回收站",
  trash_close: "关闭",
  time_justNow: "刚刚",
  time_minutesAgo: "{n} 分钟前",
  time_hoursAgo: "{n} 小时前",
  time_daysAgo: "{n} 天前",

  set_title: "设置",
  set_language: "语言",
  set_storage: "存储位置",
  set_storageDesc:
    "默认使用浏览器内置数据库（位于系统盘）。可选择本地文件夹（如 E 盘或云盘同步目录），数据将以文件形式存放，从而节省系统盘空间，并在多台电脑间通过云盘同步。仅面向个人多机先后使用，不支持多人实时协同编辑。",
  set_chooseFolder: "选择文件夹…",
  set_currentFolder: "当前位置：",
  set_dirHint: "此文件夹即 Agent 的 --dir 工作目录：在 Agent 的 MCP 配置里把 --dir 指向此文件夹的真实路径，Agent 用 KaiBoard MCP（kbfs_* 工具）写入的画板即落在此处、KaiBoard 中可见。两者不一致时 Agent 会提示「需显式导入才可见」。",
  set_resetDefault: "恢复浏览器默认存储",
  set_experimental: "（实验性：仅 Chrome / Edge 支持；Firefox / Safari 不支持，将自动沿用浏览器默认存储）",
  set_close: "关闭",
  set_storageUnavailable: "当前浏览器不支持文件夹存储（File System Access API），已保留浏览器默认存储。",
  set_storageSwitched: "已切换到文件夹存储，数据已复制到所选位置。",
  set_appearance: "外观",
  set_theme: "主题",
  set_themeLight: "浅色",
  set_themeDark: "深色",
  about_version: "当前版本",
  set_storageReset: "已恢复浏览器默认存储。",
  set_storageMerged: "已切换到文件夹存储，两边数据已合并（同一项目取较新的一版）。",
  set_storageAdopted: "已切换到文件夹存储，本次以文件夹中的数据为准，未写入任何内容。",

  fsq_title: "该文件夹里已经有 KaiBoard 数据",
  fsq_desc:
    "所选文件夹里已存在 {n} 个项目（其中 {b} 个画板文件）——通常是你在另一台电脑上用同一个云盘目录建的。请选择这次如何处理，KaiBoard 不会替你做决定：",
  fsq_merge: "合并（推荐）",
  fsq_mergeDesc:
    "两边的数据都保留：文件夹里有而本机没有的照单收下，本机有而文件夹没有的写进去；同一个项目两边都有时，以最后修改时间较新的那一版为准。不会丢东西。",
  fsq_useFolder: "以文件夹为准",
  fsq_useFolderDesc:
    "本次一个字节都不写入，直接使用文件夹里的现有数据。本机浏览器里原有的数据仍留在原处不会被删除，日后「恢复浏览器默认存储」还能看到。",
  fsq_overwrite: "以本机为准（覆盖文件夹）",
  fsq_overwriteDesc:
    "危险：用本机数据整体改写文件夹的目录树，文件夹里多出来的项目将从列表中消失（画板文件本身仍留在磁盘上，但 KaiBoard 不再显示）。只有在你确认文件夹里是过期数据时才选。",
  fsq_cancel: "取消",

  ...(AI_ENABLED ? agentStrings : {}),

  // P0-1：快照还原（Agent 共绘安全网）

  // AI 面板（独立入口，从设置迁出；基础体验与设置保持零 AI 知识）
  ai_panel_title: "AI 面板",
  ai_panel_subtitle: "所有 AI 能力集中在此。基础体验（设置 / 画布 / 工具栏）与此面板无关，两版完全一致。",
  ai_experimental: "实验性",
  ai_mermaid_title: "Mermaid → 画板",
  ai_mermaid_desc: "由 Agent 工具驱动：在 Agent 对话里给出 Mermaid 文本或自然语言，Agent 生成可编辑图元并推到当前画板。KaiBoard 自身不调用任何大模型 API。",
  ai_mermaid_status: "就绪（在 Agent 工具中使用）",
  ai_more_title: "更多 AI 能力",
  ai_more_desc: "后续新增的 AI 功能会作为本面板里的一项出现，不污染设置与基础体验。",

  // 帮助弹窗
  help_officialSite: "官网介绍",

  // 空画板欢迎屏（P1-A，复用 Excalidraw WelcomeScreen）
  welcome_menuHint: "在左侧文件树新建、整理画板",
  welcome_toolbarHint: "选择左侧工具开始绘制，或按数字键 1–9 切换",
  welcome_helpHint: "按住 [空格] 或 [鼠标滚轮] 拖拽平移画布，滚轮缩放",
  welcome_desc: "本地优先，无账号，你的画布只存在这台设备，不会上传到任何服务器。",
  welcome_newBoard: "新建画板",
  welcome_treeHint: "👈 在左侧文件树点击「新建画板 / 新建文件夹」，整理你的内容",
  welcome_shortcutTools: "切换工具",
  welcome_shortcutPan: "平移画布",
  welcome_shortcutHelp: "查看帮助",

  exportAll_prompt:
    "为这次导出定义一个「顶层文件夹名」：\n导入后会作为一个平行文件夹存在，不影响目标电脑已有内容。\n（若觉得多余，导入后可把内容拖出、删掉该顶层文件夹）",
  exportAll_default: "KaiBoard 备份",
  sel_selectedN: "已选 {n} 个画板",
  sel_exportSelected: "导出选中 (.excalidraw)",
  sel_exportPptx: "导出 PPTX",
  sel_clear: "取消选择",
  toast_exportedSelected: "已导出选中 {n} 个画板（.excalidraw）",

  // 演示型导出（仅 PPTX）
  ctx_exportPptx: "导出为 PPTX",
  toast_exporting: "正在渲染，请稍候…",
  toast_exportEmpty: "画板为空，没有可导出的内容",
  toast_exportedPptx: "已导出 {n} 页 PPTX",
  toast_exportFail: "导出失败：{msg}",

  // 元素批注（Comments）
  cmt_title: "批注",
  cmt_add: "添加批注",
  cmt_empty: "还没有批注。选中画布上的元素后点「添加批注」。",
  cmt_prompt: "给选中的元素写一条批注：",
  cmt_needSelection: "请先在画布上选中一个元素",
  cmt_locate: "定位",
  cmt_delete: "删除",
  cmt_countN: "{n} 条批注",
  toast_cmtAdded: "已添加批注",
  toast_cmtDeleted: "已删除批注",
  cmt_markerTitle: "查看/定位这条批注",
  cmt_clusterTitle: "此处有 {n} 条批注",
  cmt_showMarkers: "画布上显示标记",
  cmt_showMarkersTitle: "在画布上叠加批注锚点，可随时隐藏",
  node_unnamedFolder: "未命名文件夹",
  node_unnamedBoard: "未命名画板",
  error_notJson: "文件不是合法 JSON",
  error_emptyBackup: "备份文件中没有可用的 files/boards 数据",
  board_importedName: "导入的画板",
  copyLink_prompt: "复制此画板链接：",
};

const agentStringsTw = {
  agent_title: "Agent 共繪",
  agent_desc: "允許外部 AI Agent（經本地中繼）在你的畫布上即時增刪元素。開啟後 KaiBoard 會自動輪詢本機 127.0.0.1:8787，不再需要油猴腳本或 F12。預設關閉；關閉後頁面立即停止輪詢，外部完全無法驅動。",
  agent_enable: "啟用 Agent 共繪",
  agent_relayUrl: "中繼地址：",
  agent_relayUrlPlaceholder: "http://127.0.0.1:8787",
  agent_relayToken: "中繼令牌（複製給 Agent）：",
  agent_relayTokenPlaceholder: "由本機中繼自動取得並顯示",
  agent_relayAuto: "這是本機中繼的令牌。點「複製給 Agent」複製它，貼到你所用 Agent 的 MCP 設定裡（環境變數 KAIBOARD_TOKEN）即完成授權。不複製 = 不授權任何 Agent。",
  agent_copyToken: "複製給 Agent",
  agent_copied: "已複製 ✓ 去 Agent 的 MCP 設定貼上（環境變數 KAIBOARD_TOKEN）",
  agent_copyFail: "複製失敗，請手動選取文字複製",
  agent_rediscover: "重新偵測",
  agent_relayNotFound: "未偵測到本地中繼，請先執行 kaiboard-mcp --relay（統一 MCP 服務會自帶本地中繼）。",
  agent_relayStatus: "連線狀態：",
  agent_status_idle: "未連線",
  agent_status_connecting: "連線中…",
  agent_status_connected: "已連線",
  agent_status_error: "連線失敗（檢查中繼是否運行 / 令牌是否一致）",
  agent_enabledNote: "已啟用：頁面正在輪詢本地中繼；請在同一台電腦執行 kaiboard-mcp --relay，並把上面的「中繼令牌」複製到你 Agent 的 MCP 設定（環境變數 KAIBOARD_TOKEN）。",
  agent_disabledNote: "未啟用：外部 Agent 無法驅動此白板。",
  agent_enabled: "已啟用 Agent 共繪",
  agent_disabled: "已關閉 Agent 共繪",
  agent_snapshotTitle: "快照還原（Agent 共繪安全網）",
  agent_snapshotDesc: "Agent 每次「整板替換 / Mermaid 落圖」前都會自動存一份快照（最多 20 份）。這裡可把它恢復回來，避免誤替換後無法撤銷。",
  agent_snapshotRefresh: "重新整理快照",
  agent_snapshotEmpty: "目前畫板沒有快照。Agent 執行過「整板替換」或「Mermaid 整板落圖」後，這裡會出現可恢復的版本。",
  agent_snapshotMeta: "共 {n} 個元素",
  agent_snapshotRestore: "恢復此版本",
  agent_snapshotRestored: "已恢復快照（{n} 個元素，可 Ctrl+Z 再撤銷）",
};

const zhTW: Dict = {
  boot_folder: "我的畫板",
  boot_board: "畫板 1",
  name_copy: " 副本",
  default_folderName: "新建資料夾",
  default_boardName: "新建畫板",
  confirm_moveTrash: "把「{name}」移入資源回收筒？可隨時還原。",
  confirm_moveFolderTrash: "把資料夾「{name}」及其中 {n} 項移入資源回收筒？可隨時還原。",
  confirm_moveManyTrash: "把選中的 {n} 項移入資源回收筒？可隨時還原。",

  toast_incompatibleSkipped: "該畫板有 {n} 個不相容元素已被自動跳過",
  toast_incompatibleBlank: "該畫板內容可能與目前版本不相容，已載入空白畫布（其它畫板不受影響）",
  toast_jumpedTo: "已跳轉到「{name}」",
  toast_linkNotFound: "連結指向的畫板不存在（可能已被刪除）",
  toast_cannotMoveIntoSelf: "不能移動到自身的子資料夾中",
  toast_boardsMoved: "已移動 {n} 個畫板到「{folder}」",
  toast_movedN: "已移動 {n} 項",
  toast_copiedN: "已複製 {n} 項",
  toast_duplicated: "已建立副本",
  toast_importedN: "已匯入 {n} 個畫板",
  toast_importedSkip: "已匯入 {n} 個畫板，跳過 {m} 個檔案：{list}",
  toast_importNone: "未匯入任何畫板，跳過 {m} 個檔案：{list}",
  toast_copiedLink: "已複製畫板連結，貼到畫布元素的「連結」中即可跳轉",
  toast_toTrash: "已移入資源回收筒",
  toast_toTrashMany: "已移入資源回收筒（{n} 個）",
  toast_restored: "已還原「{name}」",
  toast_purged: "已徹底刪除",
  toast_trashEmptied: "資源回收筒已清空",
  undo_empty: "沒有可撤銷的操作",
  undo_restore: "已還原「{name}」",
  undo_move: "已撤銷移動「{name}」",
  undo_rename: "已撤銷重新命名「{name}」",
  undo_create: "已撤銷新建「{name}」",
  undo_clone: "已撤銷副本「{name}」",
  undo_items: "{n} 項",
  toast_backupExported: "已匯出整體備份（含頂層資料夾）",
  toast_workspaceMerged: "已平行合併匯入（不影響已有內容）",
  toast_importFailed: "匯入失敗：{msg}",

  importSkip_workspace: "「{name}」是工作區備份，請改用頂欄「匯入備份」",
  importSkip_notJson: "「{name}」不是合法 JSON",
  importSkip_notBoard: "「{name}」不是有效的 .excalidraw 畫板",
  importSkip_failed: "「{name}」匯入失敗：{msg}",

  ui_expandSidebar: "展開側邊欄",
  ui_collapseSidebar: "收起側邊欄",
  ui_noBoardOpen: "未開啟畫板",
  ui_saving: "儲存中…",
  ui_saved: "已儲存",
  ui_newFolder: "+ 資料夾",
  ui_newBoard: "+ 畫板",
  ui_exportAll: "匯出全部（備份 .json）",
  ui_exportAllTitle: "備份整個工作區（全部資料夾 + 全部畫板）",
  ui_importBackup: "匯入備份（.json）",
  ui_importBackupTitle: "匯入整體工作區備份；單一畫板請用資料夾右鍵「匯入畫板」",
  ui_themeToDark: "切換到深色",
  ui_themeToLight: "切換到淺色",
  ui_resize: "拖動調整寬度",

  sidebar_searchPlaceholder: "搜尋畫板 / 資料夾",
  sidebar_foundN: "找到 {n} 項",
  sidebar_noMatch: "沒有符合項目",
  sidebar_clear: "清除",
  sidebar_empty: "暫無畫板，右鍵此處或點頂部「+ 新建畫板」",
  sidebar_trash: "資源回收筒",
  sidebar_trashTitle: "查看資源回收筒，可還原誤刪的畫板",

  ctx_root: "根目錄",
  ctx_newBoard: "+ 新建畫板",
  ctx_newFolder: "+ 新建資料夾",
  ctx_importBoard: "匯入畫板",
  ctx_exportBoard: "匯出此畫板 (.excalidraw)",
  ctx_duplicate: "建立副本",
  ctx_copyLink: "複製畫板連結",
  ctx_copyLinkTitle: "複製後貼到畫布元素的「連結」中，點擊即可跳轉到此畫板",
  ctx_cut: "剪下",
  ctx_copy: "複製",
  ctx_paste: "貼上",
  ctx_rename: "重新命名",
  ctx_delete: "刪除",

  trash_title: "資源回收筒",
  trash_empty: "資源回收筒是空的。刪除的畫板會先放到這裡，可以隨時還原。",
  trash_restore: "還原",
  trash_purge: "徹底刪除",
  trash_purgeConfirm: "徹底刪除「{name}」？此操作不可復原。",
  trash_totalN: "共 {n} 項",
  trash_emptyConfirm: "清空資源回收筒？其中所有內容將被永久刪除，不可復原。",
  trash_emptyBtn: "清空資源回收筒",
  trash_close: "關閉",
  time_justNow: "剛剛",
  time_minutesAgo: "{n} 分鐘前",
  time_hoursAgo: "{n} 小時前",
  time_daysAgo: "{n} 天前",

  set_title: "設定",
  set_language: "語言",
  set_storage: "儲存位置",
  set_storageDesc:
    "預設使用瀏覽器內建資料庫（位於系統磁碟）。可選擇本機資料夾（如 E 槽或雲端同步目錄），資料將以檔案形式存放，從而節省系統磁碟空間，並在多台電腦間透過雲端同步。僅面向個人多機先後使用，不支援多人即時協同編輯。",
  set_chooseFolder: "選擇資料夾…",
  set_currentFolder: "目前位置：",
  set_dirHint: "此資料夾即 Agent 的 --dir 工作目錄：在 Agent 的 MCP 設定裡把 --dir 指向此資料夾的真實路徑，Agent 用 KaiBoard MCP（kbfs_* 工具）寫入的畫板即落在此處、KaiBoard 中可見。兩者不一致時 Agent 會提示「需顯式匯入才可見」。",
  set_resetDefault: "恢復瀏覽器預設儲存",
  set_experimental: "（實驗性：僅 Chrome / Edge 支援；Firefox / Safari 不支援，將自動沿用瀏覽器預設儲存）",
  set_close: "關閉",
  set_storageUnavailable: "目前瀏覽器不支援資料夾儲存（File System Access API），已保留瀏覽器預設儲存。",
  set_storageSwitched: "已切換到資料夾儲存，資料已複製到所選位置。",
  set_appearance: "外觀",
  set_theme: "主題",
  set_themeLight: "淺色",
  set_themeDark: "深色",
  about_version: "目前版本",
  set_storageReset: "已恢復瀏覽器預設儲存。",
  set_storageMerged: "已切換到資料夾儲存，兩邊資料已合併（同一項目取較新的一版）。",
  set_storageAdopted: "已切換到資料夾儲存，本次以資料夾中的資料為準，未寫入任何內容。",

  fsq_title: "該資料夾裡已經有 KaiBoard 資料",
  fsq_desc:
    "所選資料夾裡已存在 {n} 個項目（其中 {b} 個畫板檔案）——通常是你在另一台電腦上用同一個雲端目錄建立的。請選擇這次如何處理，KaiBoard 不會替你決定：",
  fsq_merge: "合併（建議）",
  fsq_mergeDesc:
    "兩邊的資料都保留：資料夾裡有而本機沒有的照單收下，本機有而資料夾沒有的寫進去；同一個項目兩邊都有時，以最後修改時間較新的那一版為準。不會遺失資料。",
  fsq_useFolder: "以資料夾為準",
  fsq_useFolderDesc:
    "本次完全不寫入，直接使用資料夾裡的現有資料。本機瀏覽器裡原有的資料仍留在原處不會被刪除，日後「恢復瀏覽器預設儲存」還能看到。",
  fsq_overwrite: "以本機為準（覆蓋資料夾）",
  fsq_overwriteDesc:
    "危險：用本機資料整體改寫資料夾的目錄樹，資料夾裡多出來的項目將從清單中消失（畫板檔案本身仍留在磁碟上，但 KaiBoard 不再顯示）。只有在你確認資料夾裡是過期資料時才選。",
  fsq_cancel: "取消",

  ...(AI_ENABLED ? agentStringsTw : {}),

  // P0-1：快照還原（Agent 共繪安全網）

  // AI 面板（獨立入口，自設定遷出；基礎體驗與設定保持零 AI 知識）
  ai_panel_title: "AI 面板",
  ai_panel_subtitle: "所有 AI 能力集中於此。基礎體驗（設定 / 畫布 / 工具列）與此面板無關，兩版完全一致。",
  ai_experimental: "實驗性",
  ai_mermaid_title: "Mermaid → 畫板",
  ai_mermaid_desc: "由 Agent 工具驅動：在 Agent 對話裡給出 Mermaid 文字或自然語言，Agent 生成可編輯圖元並推到目前畫板。KaiBoard 自身不呼叫任何大模型 API。",
  ai_mermaid_status: "就緒（於 Agent 工具中使用）",
  ai_more_title: "更多 AI 能力",
  ai_more_desc: "後續新增的 AI 功能會作為本面板裡的一項出現，不污染設定與基礎體驗。",

  // 帮助弹窗
  help_officialSite: "官方網站",

  // 空畫板歡迎屏（P1-A，复用 Excalidraw WelcomeScreen）
  welcome_menuHint: "在左側檔案樹新建、整理畫板",
  welcome_toolbarHint: "選擇左側工具開始繪製，或按數字鍵 1–9 切換",
  welcome_helpHint: "按住 [空白鍵] 或 [滑鼠滾輪] 拖拽平移畫布，滾輪縮放",
  welcome_desc: "本地優先，無帳號，你的畫布只存在這台裝置，不會上傳到任何伺服器。",
  welcome_newBoard: "新建畫板",
  welcome_treeHint: "👈 在左側檔案樹點擊「新建畫板 / 新建資料夾」，整理你的內容",
  welcome_shortcutTools: "切換工具",
  welcome_shortcutPan: "平移畫布",
  welcome_shortcutHelp: "檢視說明",

  exportAll_prompt:
    "為這次匯出定義一個「頂層資料夾名」：\n匯入後會作為一個平行資料夾存在，不影響目標電腦已有內容。\n（若覺得多餘，匯入後可把內容拖出、刪掉該頂層資料夾）",
  exportAll_default: "KaiBoard 備份",
  sel_selectedN: "已選 {n} 個畫板",
  sel_exportSelected: "匯出選中 (.excalidraw)",
  sel_exportPptx: "匯出 PPTX",
  sel_clear: "取消選擇",
  toast_exportedSelected: "已匯出選中 {n} 個畫板（.excalidraw）",

  // 簡報式匯出（僅 PPTX）
  ctx_exportPptx: "匯出為 PPTX",
  toast_exporting: "正在算繪，請稍候…",
  toast_exportEmpty: "畫板為空，沒有可匯出的內容",
  toast_exportedPptx: "已匯出 {n} 頁 PPTX",
  toast_exportFail: "匯出失敗：{msg}",

  // 元素註解（Comments）
  cmt_title: "註解",
  cmt_add: "新增註解",
  cmt_empty: "還沒有註解。選取畫布上的元素後點「新增註解」。",
  cmt_prompt: "給選取的元素寫一則註解：",
  cmt_needSelection: "請先在畫布上選取一個元素",
  cmt_locate: "定位",
  cmt_delete: "刪除",
  cmt_countN: "{n} 則註解",
  toast_cmtAdded: "已新增註解",
  cmt_markerTitle: "查看/定位這則註解",
  cmt_clusterTitle: "此處有 {n} 則註解",
  cmt_showMarkers: "在畫布上顯示標記",
  cmt_showMarkersTitle: "在畫布上疊加註解錨點，可隨時隱藏",
  toast_cmtDeleted: "已刪除註解",
  node_unnamedFolder: "未命名資料夾",
  node_unnamedBoard: "未命名畫板",
  error_notJson: "檔案不是合法 JSON",
  error_emptyBackup: "備份檔案中沒有可用的 files/boards 資料",
  board_importedName: "匯入的畫板",
  copyLink_prompt: "複製此畫板連結：",
};

const agentStringsEn = {
  agent_title: "Agent co-draw",
  agent_desc: "Lets an external AI Agent (via a local relay) add/remove elements on your canvas in real time. When enabled, KaiBoard polls 127.0.0.1:8787 automatically — no userscript or devtools required. Off by default; turning it off stops polling immediately and fully blocks external driving.",
  agent_enable: "Enable Agent co-draw",
  agent_relayUrl: "Relay URL: ",
  agent_relayUrlPlaceholder: "http://127.0.0.1:8787",
  agent_relayToken: "Relay token (copy to Agent): ",
  agent_relayTokenPlaceholder: "Auto-fetched & shown by the local relay",
  agent_relayAuto: "This is the local relay's token. Click 'Copy to Agent' and paste it into your Agent's MCP config (env KAIBOARD_TOKEN) to grant access. Not copying = no Agent authorized.",
  agent_copyToken: "Copy to Agent",
  agent_copied: "Copied ✓ Paste it into your Agent's MCP config (env KAIBOARD_TOKEN)",
  agent_copyFail: "Copy failed; please select and copy manually",
  agent_rediscover: "Re-detect",
  agent_relayNotFound: "No local relay detected. Run `kaiboard-mcp --relay` on this machine (the unified MCP server brings its own local relay).",
  agent_relayStatus: "Status: ",
  agent_status_idle: "Idle",
  agent_status_connecting: "Connecting…",
  agent_status_connected: "Connected",
  agent_status_error: "Failed (check relay / token)",
  agent_enabledNote: "Enabled: the page is polling the local relay. Run `kaiboard-mcp --relay` on this machine, and copy the 'Relay token' above into your Agent's MCP config (env KAIBOARD_TOKEN).",
  agent_disabledNote: "Disabled: no external Agent can drive this whiteboard.",
  agent_enabled: "Agent co-draw enabled",
  agent_disabled: "Agent co-draw disabled",
  agent_snapshotTitle: "Snapshot restore (Agent co-draw safety net)",
  agent_snapshotDesc: "Before each 'replace board' or 'Mermaid full draw', the Agent auto-saves a snapshot (up to 20). Restore one here to recover from an accidental replace.",
  agent_snapshotRefresh: "Refresh snapshots",
  agent_snapshotEmpty: "No snapshots for this board yet. After the Agent runs a 'replace board' or 'Mermaid full draw', recoverable versions appear here.",
  agent_snapshotMeta: "{n} elements",
  agent_snapshotRestore: "Restore this version",
  agent_snapshotRestored: "Snapshot restored ({n} elements; Ctrl+Z to undo again)",
};

const en: Dict = {
  boot_folder: "My Boards",
  boot_board: "Board 1",
  name_copy: " copy",
  default_folderName: "New folder",
  default_boardName: "New board",
  confirm_moveTrash: "Move “{name}” to Trash? It can be restored anytime.",
  confirm_moveFolderTrash: "Move folder “{name}” and its {n} item(s) to Trash? Restorable anytime.",
  confirm_moveManyTrash: "Move the selected {n} item(s) to Trash? Restorable anytime.",

  toast_incompatibleSkipped: "This board had {n} incompatible element(s) auto-skipped",
  toast_incompatibleBlank:
    "This board may be incompatible with the current version; a blank canvas was loaded (other boards are unaffected)",
  toast_jumpedTo: "Jumped to “{name}”",
  toast_linkNotFound: "The linked board does not exist (it may have been deleted)",
  toast_cannotMoveIntoSelf: "Cannot move a folder into itself",
  toast_boardsMoved: "Moved {n} board(s) to \"{folder}\"",
  toast_movedN: "Moved {n} item(s)",
  toast_copiedN: "Copied {n} item(s)",
  toast_duplicated: "Duplicate created",
  toast_importedN: "Imported {n} board(s)",
  toast_importedSkip: "Imported {n} board(s), skipped {m} file(s): {list}",
  toast_importNone: "No boards imported, skipped {m} file(s): {list}",
  toast_copiedLink: "Board link copied; paste it into a canvas element's “link” to jump",
  toast_toTrash: "Moved to Trash",
  toast_toTrashMany: "Moved {n} board(s) to Trash",
  toast_restored: "Restored “{name}”",
  toast_purged: "Permanently deleted",
  toast_trashEmptied: "Trash emptied",
  undo_empty: "Nothing to undo",
  undo_restore: "Restored “{name}”",
  undo_move: "Move undone for “{name}”",
  undo_rename: "Rename undone for “{name}”",
  undo_create: "Creation undone for “{name}”",
  undo_clone: "Duplicate undone for “{name}”",
  undo_items: "{n} item(s)",
  toast_backupExported: "Workspace backup exported (with top-level folder)",
  toast_workspaceMerged: "Imported in parallel (existing content untouched)",
  toast_importFailed: "Import failed: {msg}",

  importSkip_workspace: "“{name}” is a workspace backup; use the top-bar “Import Backup” instead",
  importSkip_notJson: "“{name}” is not valid JSON",
  importSkip_notBoard: "“{name}” is not a valid .excalidraw board",
  importSkip_failed: "“{name}” import failed: {msg}",

  ui_expandSidebar: "Expand sidebar",
  ui_collapseSidebar: "Collapse sidebar",
  ui_noBoardOpen: "No board open",
  ui_saving: "Saving…",
  ui_saved: "Saved",
  ui_newFolder: "+ Folder",
  ui_newBoard: "+ Board",
  ui_exportAll: "Export All (backup .json)",
  ui_exportAllTitle: "Back up the entire workspace (all folders + all boards)",
  ui_importBackup: "Import Backup (.json)",
  ui_importBackupTitle: "Import a full workspace backup; for a single board, right-click a folder and choose “Import Board”",
  ui_themeToDark: "Switch to dark",
  ui_themeToLight: "Switch to light",
  ui_resize: "Drag to resize",

  sidebar_searchPlaceholder: "Search boards / folders",
  sidebar_foundN: "Found {n} item(s)",
  sidebar_noMatch: "No matches",
  sidebar_clear: "Clear",
  sidebar_empty: "No boards yet — right-click here or use “+ Board” at the top",
  sidebar_trash: "Trash",
  sidebar_trashTitle: "Open Trash to restore accidentally deleted boards",

  ctx_root: "Root",
  ctx_newBoard: "+ New board",
  ctx_newFolder: "+ New folder",
  ctx_importBoard: "Import board",
  ctx_exportBoard: "Export this board (.excalidraw)",
  ctx_duplicate: "Create copy",
  ctx_copyLink: "Copy board link",
  ctx_copyLinkTitle: "Copy and paste into a canvas element's “link” to jump to this board",
  ctx_cut: "Cut",
  ctx_copy: "Copy",
  ctx_paste: "Paste",
  ctx_rename: "Rename",
  ctx_delete: "Delete",

  trash_title: "Trash",
  trash_empty: "Trash is empty. Deleted boards go here first and can be restored anytime.",
  trash_restore: "Restore",
  trash_purge: "Delete permanently",
  trash_purgeConfirm: "Permanently delete “{name}”? This cannot be undone.",
  trash_totalN: "{n} item(s)",
  trash_emptyConfirm: "Empty Trash? All contents will be permanently deleted.",
  trash_emptyBtn: "Empty Trash",
  trash_close: "Close",
  time_justNow: "just now",
  time_minutesAgo: "{n} min ago",
  time_hoursAgo: "{n} h ago",
  time_daysAgo: "{n} d ago",

  set_title: "Settings",
  set_language: "Language",
  set_storage: "Storage location",
  set_storageDesc:
    "By default KaiBoard uses the browser's built-in database (on the system drive). You can choose a local folder (e.g. drive E or a cloud-sync folder) so data is stored as files — saving system-disk space and syncing across PCs via the cloud. For personal use across your own PCs only; multi-user real-time co-editing is not supported.",
  set_chooseFolder: "Choose folder…",
  set_currentFolder: "Current location: ",
  set_dirHint: "This folder is the Agent's --dir working directory: point --dir in your Agent's MCP config to this folder's real path, and boards the Agent writes via KaiBoard MCP (kbfs_* tools) land here and show up in KaiBoard. If they differ, the Agent warns that writes need an explicit import to become visible.",
  set_resetDefault: "Reset to browser default storage",
  set_experimental: "(Experimental: only Chrome/Edge are supported; Firefox/Safari are not and will automatically fall back to browser default storage)",
  set_close: "Close",
  set_storageUnavailable:
    "This browser doesn't support folder storage (File System Access API); browser default storage is kept.",
  set_storageSwitched: "Switched to folder storage; data copied to the selected location.",
  set_storageReset: "Reset to browser default storage.",
  set_appearance: "Appearance",
  set_theme: "Theme",
  set_themeLight: "Light",
  set_themeDark: "Dark",
  about_version: "Version",
  set_storageMerged: "Switched to folder storage; both sides merged (newer version wins per item).",
  set_storageAdopted: "Switched to folder storage using the folder's existing data; nothing was written.",

  fsq_title: "This folder already contains KaiBoard data",
  fsq_desc:
    "The selected folder already holds {n} item(s), including {b} board file(s) — usually created on another computer pointing at the same cloud folder. Choose how to proceed; KaiBoard will not decide for you:",
  fsq_merge: "Merge (recommended)",
  fsq_mergeDesc:
    "Keep both sides: items only in the folder are adopted, items only on this machine are written in, and for items present on both the more recently modified version wins. Nothing is lost.",
  fsq_useFolder: "Use the folder's data",
  fsq_useFolderDesc:
    "Write nothing this time and simply use what's already in the folder. Your existing browser-local data stays where it is and can be seen again via 'Reset to browser default storage'.",
  fsq_overwrite: "Use this machine (overwrite folder)",
  fsq_overwriteDesc:
    "Dangerous: rewrites the folder's tree with this machine's data; extra items in the folder disappear from the list (their board files remain on disk but KaiBoard no longer shows them). Only pick this if you're sure the folder holds stale data.",
  fsq_cancel: "Cancel",

  ...(AI_ENABLED ? agentStringsEn : {}),

  // P0-1: snapshot restore (safety net for Agent replace board)

  // AI panel (standalone entry, moved out of Settings; base UI & Settings stay AI-free)
  ai_panel_title: "AI Panel",
  ai_panel_subtitle: "All AI capabilities live here. The base experience (Settings / canvas / toolbar) is untouched and identical across builds.",
  ai_experimental: "Experimental",
  ai_mermaid_title: "Mermaid → Board",
  ai_mermaid_desc: "Agent-driven: give Mermaid text or natural language in your Agent chat; the Agent generates editable elements and pushes them to the current board. KaiBoard itself calls no LLM API.",
  ai_mermaid_status: "Ready (use from your Agent tool)",
  ai_more_title: "More AI features",
  ai_more_desc: "Future AI features appear as one more item in this panel, never touching Settings or the base experience.",

  // Help dialog
  help_officialSite: "Official Site",

  // Empty-board welcome screen (P1-A, reusing Excalidraw WelcomeScreen)
  welcome_menuHint: "Create and organize boards in the file tree on the left",
  welcome_toolbarHint: "Pick a tool on the left to start drawing, or press keys 1–9",
  welcome_helpHint: "Hold [Space] or [scroll wheel] and drag to pan; scroll to zoom",
  welcome_desc: "Local-first, No account, Your boards live only on this device and are never uploaded to any server.",
  welcome_newBoard: "New board",
  welcome_treeHint: "👈 In the file tree on the left, click 'New board / New folder' to organize your content",
  welcome_shortcutTools: "Switch tools",
  welcome_shortcutPan: "Pan canvas",
  welcome_shortcutHelp: "View help",

  exportAll_prompt:
    "Define a top-level folder name for this export:\nAfter import it appears as a parallel folder, leaving the target's existing content untouched.\n(If redundant, drag the contents out and delete the folder after import)",
  exportAll_default: "KaiBoard Backup",
  sel_selectedN: "Selected {n} board(s)",
  sel_exportSelected: "Export selected (.excalidraw)",
  sel_exportPptx: "Export PPTX",
  sel_clear: "Clear selection",
  toast_exportedSelected: "Exported {n} selected board(s) (.excalidraw)",

  // Presentation exports (PPTX only)
  ctx_exportPptx: "Export as PPTX",
  toast_exporting: "Rendering, please wait…",
  toast_exportEmpty: "Board is empty — nothing to export",
  toast_exportedPptx: "Exported {n} slide(s) to PPTX",
  toast_exportFail: "Export failed: {msg}",

  // Element comments
  cmt_title: "Comments",
  cmt_add: "Add comment",
  cmt_empty: "No comments yet. Select an element on the canvas, then click “Add comment”.",
  cmt_prompt: "Write a comment for the selected element:",
  cmt_needSelection: "Select an element on the canvas first",
  cmt_locate: "Locate",
  cmt_delete: "Delete",
  cmt_countN: "{n} comment(s)",
  toast_cmtAdded: "Comment added",
  toast_cmtDeleted: "Comment deleted",
  cmt_markerTitle: "View / locate this comment",
  cmt_clusterTitle: "{n} comments here",
  cmt_showMarkers: "Show markers on canvas",
  cmt_showMarkersTitle: "Overlay comment anchors on the canvas; hide anytime",
  node_unnamedFolder: "Unnamed folder",
  node_unnamedBoard: "Unnamed board",
  error_notJson: "File is not valid JSON",
  error_emptyBackup: "Backup file has no usable files/boards data",
  board_importedName: "Imported board",
  copyLink_prompt: "Copy this board's link: ",
};

const DICTS: Record<Lang, Dict> = { "zh-CN": zhCN, "zh-TW": zhTW, en };

let current: Lang = "zh-CN";

export function getLang(): Lang {
  return current;
}

export function setLang(l: Lang): void {
  current = l;
}

export function isLang(x: string): x is Lang {
  return x === "zh-CN" || x === "zh-TW" || x === "en";
}

/** 首次访问时按浏览器语言自动选择。zh-CN/zh-SG 等归到 zh-CN；zh-TW/zh-HK/zh-MO 归到 zh-TW；其余归 en。 */
export function detectBrowserLang(): Lang {
  const nav = (typeof navigator !== "undefined" && navigator.language) || "zh-CN";
  const lo = nav.toLowerCase();
  if (lo === "zh-tw" || lo === "zh-hk" || lo === "zh-mo") return "zh-TW";
  if (lo.startsWith("zh")) return "zh-CN";
  return "en";
}

/** 画布 Excalidraw 的 locale 与外壳语言一一对应 */
export function excalidrawLang(l: Lang = current): string {
  return l;
}

/** 翻译；支持 {name} 占位符插值；缺失 key 回退简体中文，再回退 key 本身 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = DICTS[current] ?? zhCN;
  let s: string = dict[key] ?? zhCN[key] ?? key;
  if (vars) {
    for (const k of Object.keys(vars)) {
      s = s.replace(new RegExp("\\{" + k + "\\}", "g"), String(vars[k]));
    }
  }
  return s;
}
