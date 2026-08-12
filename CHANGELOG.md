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
- 帮助弹窗新增「官网介绍」入口，方便从应用内直达 KaiLab 官网  
  Help dialog adds an "Official Site" entry for quick access to the KaiLab landing site.

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
