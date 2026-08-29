# KaiBoard 更新日志 / Changelog

> 面向用户 / 随开源发布包一起看的版本变更记录（公开版）。  
> User-facing version history, shipped with the open-source release (public edition).

---

## 关于版本号 / About version numbers

- 唯一真源：`package.json` 的 `version`。
- Single source of truth: the `version` field in `package.json`.
- 对外只发布一个产品 **KaiBoard** + 版本号；后续能力升级沿用同一版本号递增。
- We publish one product — **KaiBoard** — with one version number; future capability upgrades continue on the same incrementing version.
- 基础内容与扩展能力共享同一份代码，任一部分更新都整体升版，不拆成两条版本线对外。
- The base and extended capabilities share one codebase; any update bumps the whole version — we do not split into two public version lines.

---

## 当前版本 / Current version

### v1.0.0（2026-08-29）· 首个正式稳定版 / First stable release

KaiBoard 的第一个正式稳定版。本版聚焦基础白板能力，公测阶段的能力至此全部收敛为稳定版。
This is KaiBoard's first stable release. It focuses on core whiteboard capabilities, promoting everything from the public beta to stable.

- 「落板即见」：文件夹存储模式下，画板文件被外部程序（如同步盘、脚本或其它编辑器）改动后，切回 KaiBoard 或定时检查时会自动同步更新，无需手动刷新或重新导入。
  "See-it-on-land": in folder-storage mode, when board files are modified by an external program (a sync drive, a script, or another editor), KaiBoard picks the changes up automatically — either when you return to the tab or on a periodic check. No manual refresh or re-import needed.

- 稳定性：修复文件夹存储下并发读写偶发导致的 `tree.json` 半截读取（极端情况可能把整棵画板树清空），改为带重试与缺失兜底。
  Stability: fixed a race in folder storage where concurrent read/write could read a half-written `tree.json` (in the worst case able to wipe the entire board tree). Reads now retry, and fall back safely when the file is missing.

#### v1.0.0 功能基准 / Feature baseline

> 以下为 v1.0.0 已稳定提供的能力（自公测以来累积，构成本正式版的功能基线）。
> Stable capabilities shipped in v1.0.0 (accumulated across the public beta, forming the baseline of this stable release).

- 本地优先：浏览器内置数据库（IndexedDB）与本地文件夹双存储；无账号、不注册，数据不出本机。
  Local-first: dual storage via the browser's built-in database (IndexedDB) or a local folder; no account, no sign-up, data never leaves your device.
- 多画板文件树：文件夹与画板任意层级嵌套、多选与拖拽整理、回收站可二次还原。
  Multi-board file tree: folders and boards nested at any depth, multi-select and drag to organise, trash with one-click restore.
- 统一导入导出：单画板为原生 `.excalidraw`，工作区备份为 `.json`；可往返，也可被 excalidraw.com 等第三方直接消费。
  Unified import & export: native `.excalidraw` per board, workspace backup as `.json`; round-trippable and directly consumable by third parties such as excalidraw.com.
- PPTX 演示导出（按需懒加载，不进主包）。
  PPTX presentation export (lazy-loaded on demand, not in the main bundle).
- 元素批注：随画板本地保存，随 `.excalidraw` 一起导出。
  Element comments: saved locally with the board and exported alongside the `.excalidraw`.
- 中英文手写风（中文 Xiaolai + 英文 Virgil）、简 / 繁 / 英三语界面、明暗双主题。
  Chinese & English handwriting style (Xiaolai for Chinese, Virgil for English), Simplified / Traditional Chinese / English UI, light & dark themes.
- 导入外部 `.excalidraw` 不再因 `appState.collaborators` 导致整页崩溃。
  Importing an external `.excalidraw` no longer crashes the page on `appState.collaborators`.

---

## 历史版本 / Previous releases

### v1.0.0-beta.4（2026-08-23）· 导入 .excalidraw 崩溃修复 / Import crash fix

- 修复：导入外部 .excalidraw 后整页崩溃，提示 "appState.collaborators.forEach is not a function"；导入与加载画布时双保险清理 `appState.collaborators`（Excalidraw 内部期望其为 Map，JSON 序列化后变成普通对象会触发崩溃）。
  Fix: importing an external `.excalidraw` could crash the whole page with "appState.collaborators.forEach is not a function"; `appState.collaborators` is now sanitized both on import and when loading a board (Excalidraw expects a Map, but JSON serialization turns it into a plain object that throws).

- 变更：产品对外定位由「中文手写风」升级为「中英文手写风」——中文 Xiaolai + 英文 Virgil 双字体，覆盖产品站首页、README / README.zh-CN、特性文档（FEATURES）与 GEO 事实源（public/llms.txt）；对外文案统一收敛，不再强调具体字体名，一律以「中英文手写风」表述。
  Change: public positioning upgraded from "Chinese handwriting style" to "Chinese & English handwriting style" — Chinese Xiaolai + English Virgil dual fonts, covering the product site home, README / README.zh-CN, feature docs (FEATURES), and the GEO fact source (public/llms.txt); external copy now consistently drops specific font-name emphasis and uses the "Chinese & English handwriting style" phrasing.

### v1.0.0-beta.3（2026-08-12）· 侧栏结构树管理增强 / Sidebar tree management enhancements

- 侧栏结构树：文件夹与画板一致的多选（Ctrl/Shift 点击、勾选框），空文件夹可独立选中  
  Sidebar tree: folders and boards now share consistent multi-select (Ctrl/Shift click, checkbox); empty folders can be selected on their own.
- 文件夹 = 整单元：选中文件夹即选中其全部内容；复制 / 剪切 / 粘贴 / 副本对整棵子树生效（深克隆），删除与导出按整单元处理  
  Folder = whole unit: selecting a folder selects all its contents; copy / cut / paste / duplicate apply to the entire subtree (deep clone); delete and export treat it as one unit.
- 全套树快捷键：Ctrl+C 复制 / Ctrl+X 剪切 / Ctrl+V 粘贴 / Ctrl+A 全选 / Delete 或 Backspace 删除选中 / Ctrl+Z 撤销树操作（删除 / 移动 / 改名 / 新建 / 副本，toast 报出恢复的节点名）  
  Full tree shortcuts: Ctrl+C copy / Ctrl+X cut / Ctrl+V paste / Ctrl+A select all / Delete or Backspace delete selection / Ctrl+Z undo tree operations (delete / move / rename / create / duplicate, with a toast naming the restored node).
- 删除去重保护：同时选中文件夹及其后代时只删顶层文件夹，不会上溯误删父级；误删可经回收站二次还原  
  Delete de-dup protection: selecting a folder and its descendants deletes only the top folder — it never climbs up to delete the parent; mistaken deletes can be restored from the trash.

### v1.0.0-beta.2（2026-08-12）· i18n 与帮助入口优化 / i18n & Help entry improvements

- 首次访问按浏览器语言自动选择界面语言（简中 / 繁中 / 英文），切换后写入本地设置，刷新保持  
  Auto-detect browser language on first visit (zh-CN / zh-TW / en) and persist the choice in local settings across reloads.
- 帮助弹窗新增「官网介绍」入口，方便从应用内直达 KaiBuddy 官网  
  Help dialog adds an "Official Site" entry for quick access to the KaiBuddy landing site.

---

### v1.0.0-beta（2026-08-09）· 基础版公测首发 / First public beta of the base edition

- 多画板文件树 / 侧栏画板多选 + 整组拖入文件夹  
  Multi-board file tree / sidebar multi-select + drag whole groups into folders.
- 导入导出统一：单/多导入、单/多导出一律原生 `.excalidraw`；顶栏「导出全部 / 导入备份」为 KaiBoard 工作区 `.json`  
  Unified import & export: single/multi import and single/multi export are all native `.excalidraw`; the top bar "Export all / Import backup" produces a KaiBoard workspace `.json`.
- 演示型导出：PPTX（pptxgenjs，按需动态加载，不进主包）  
  Presentation export: PPTX (pptxgenjs, lazy-loaded on demand, not in the main bundle).
- 元素批注（随画板本地保存、随 `.excalidraw` 导出）  
  Element comments (saved locally with the board, exported with the `.excalidraw`).
- 帮助弹窗原生两栏排版；版本号入口位于「设置 → 关于」  
  Help dialog with native two-column layout; version entry under "Settings → About".
- Toast 对齐原生浅色方框  
  Toast aligned to the native light box.
- 画板级剪切 / 复制 / 粘贴  
  Board-level cut / copy / paste.
- 开源协议三件套（MIT + 第三方许可 + README 许可小节）  
  Open-source license trio (MIT + third-party licenses + README license section).
- 顶部公告条「beta 公测版」数据备份提示  
  Top announcement bar "beta" data-backup reminder.

> 说明：当前公开发布为基础版，聚焦本地优先白板能力。后续扩展能力将随版本升级自然开放。  
> Note: the current public release is the base edition, focused on local-first whiteboard capabilities. Extended capabilities will unlock naturally with future version upgrades.

## 版本号规则 / Version number rules

- 唯一真源：`package.json` 的 `version`。  
  Single source of truth: the `version` field in `package.json`.
- 对外单一版本号递增；基础内容与扩展能力共享同一份代码，任一部分更新都整体升版，不拆成两条版本线对外。  
  One public incrementing version number; base and extended capabilities share one codebase, and any update bumps the whole version — we do not split into two public version lines.
