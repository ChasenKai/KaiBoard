# KaiBoard 功能说明

> 📄 本文档说明 KaiBoard 提供了哪些能力，以及它在 [Excalidraw](https://github.com/excalidraw/excalidraw) 绘图内核之上新增 / 增强了哪些部分。（Excalidraw 以 MIT 开源，KaiBoard 遵循其 MIT 协议并完整保留版权声明，详见 [THIRD_PARTY_LICENSES](../THIRD_PARTY_LICENSES)。）

> KaiBoard 是一个**免费开源、本地优先（local-first）的多画布白板**，补齐了"多文件 / 多画板管理"这一能力（Excalidraw 原生缺失），并围绕本地数据安全、跨设备迁移、中文书写体验做了增强。其绘图内核基于 [Excalidraw](https://github.com/excalidraw/excalidraw) 0.18.1。
>
> 技术栈：绘图内核基于 Excalidraw 0.18.1 + React 18 + IndexedDB（idb）。所有数据存于浏览器本地，不上传任何服务器。

> **English.** KaiBoard is a free, open-source, local-first multi-board whiteboard. It adds the "multi-file / multi-board management" capability Excalidraw lacks natively, and enhances local data safety, cross-device migration, and the Chinese writing experience. Drawing engine: Excalidraw 0.18.1. Tech stack: Excalidraw 0.18.1 + React 18 + IndexedDB (idb). All data stays in your browser; nothing is uploaded to any server.

---

## 一句话定位（可用于 GitHub 简介）

> **KaiBoard** —— 免费开源、本地优先的**中文手写风多画布白板**。无需注册、不上传云端，数据只留在你自己的设备上；为个人单人使用设计，不做实时协同。

英文版（GitHub About / 英文 README 首行）：

> **KaiBoard** — a free, open-source, local-first multi-board whiteboard with Chinese handwriting fonts. No account, no cloud — your data stays on your own device. Built for personal single-user use; no real-time collaboration.

---

## 功能总览

KaiBoard 的能力按"用户价值"分为七组，下文逐组展开：

1. **本地优先与数据安全** —— 数据存你自己的设备、无账号、不上传；可选指向本地文件夹。
2. **多画板工作区（核心）** —— 文件树式的多文件夹 / 多画板组织、拖拽、回收站、搜索。
3. **导入 / 导出与跨设备迁移** —— 原生 `.excalidraw` 互交换、工作区备份、平行合并迁移、PPTX 演示导出。
4. **中文与本地化体验** —— 中文手写字体、简 / 繁 / 英三语、明暗主题。
5. **上手与引导** —— 首次启动引导、空画板欢迎屏、元素批注。
6. **画板间跳转链接（🔶 实验特性）** —— 可用但价值未验证，不作卖点。
7. **底层、致谢与两层设置** —— 绘图内核来自 Excalidraw、致谢、两层设置边界。

> 关于"规划中"的能力，见文末「八、规划中」。

**English — seven groups:**
1. **Local-first & data safety** — data on your device, no account, no upload; optional folder storage.
2. **Multi-board workspace (core)** — folder-tree of boards, drag, trash, search.
3. **Import / export & cross-device migration** — native `.excalidraw` exchange, workspace backup, parallel-merge migration, PPTX export.
4. **Chinese & localization** — Chinese handwriting font, Simplified/Traditional/English UI, light & dark themes.
5. **Onboarding** — first-run guide, empty-board welcome, element comments.
6. **Inter-board links (🔶 experimental)** — usable but value unverified; not a selling point.
7. **Engine, credits & two settings layers** — drawing engine from Excalidraw, credits, two settings boundaries.

---

## 一、本地优先与数据安全

KaiBoard 的定位是**个人本地优先**白板：数据默认只在你自己的设备上，不依赖任何后端、不创建账号、不上传任何服务器。

- **默认存储**：浏览器内置数据库（IndexedDB，位于系统盘）。
- **自动保存与状态持久化**：编辑后防抖自动保存；记住你的工作区状态（展开态、上次打开的画板、侧栏宽度、明暗主题），刷新后原样恢复。
- **可选存储位置（文件夹）**：在「设置 → 存储位置」里可手动选择一个**本地文件夹**，KaiBoard 会把数据以真实文件写入该文件夹（`kaiboard-data/tree.json` + `boards/<id>.json`）。
  - 好处一：**节省系统盘空间**（数据移出 C 盘）。
  - 好处二：**多机同步的"理论可行"路径**——若所选文件夹位于**云盘同步目录**（OneDrive / 百度网盘同步盘等），在另一台电脑的 KaiBoard 也指向同一目录，即可借助云盘客户端在多台电脑间同步。
    > ⚠️ **诚实说明**：文件夹存储本身已实装；但"指向云盘目录实现个人跨机同步"的实际表现（冲突处理、后写覆盖、tree.json 频繁重写对云盘重传的影响等）**取决于你所用的云盘客户端，未经我们充分验证**。它属于"逻辑上可行"的能力，而非我们打包测试过的卖点。
  - **浏览器支持**：文件夹存储依赖 **File System Access API**，**仅 Chrome / Edge 支持**；Firefox / Safari 不支持，设置里点「选择文件夹」会自动回退到浏览器默认存储（数据不丢）。
  - **切换可逆**：随时可「恢复浏览器默认存储」；切换时当前工作区无缝合并到目标存储（文件夹 ↔ 浏览器互切都不丢数据），留在原位置的旧文件仍保留在磁盘上。

### 边界 / 非目标：不做多人实时协同编辑

- 多机同步是「同一人先后操作、指向同一云盘目录」的**文件级同步（后写覆盖，last-write-wins）**。
- 当前**不支持多人实时协同编辑**（无 CRDT / OT、无并发冲突合并）。若未来确实需要多人实时协作，属全新方向，需单独立项（后端 / 账号 / 冲突算法）评估，不在当前版本范围内。

**🇬🇧 English.** KaiBoard is a personal, local-first whiteboard: data stays on your own device by default — no backend, no account, no upload to any server.
- **Default storage**: browser IndexedDB (system disk).
- **Auto-save & state persistence**: debounced auto-save; remembers workspace state (expanded nodes, last board, sidebar width, theme) and restores after refresh.
- **Optional folder storage**: in Settings → Storage you can pick a local folder; KaiBoard writes real files there (`kaiboard-data/tree.json` + `boards/<id>.json`).
  - Saves system-disk space; enables a *theoretically possible* multi-machine sync via a cloud-sync folder (OneDrive / Baidu, etc.) — point KaiBoard on another PC at the same folder.
  - ⚠️ Honesty note: folder storage is implemented; but cross-machine sync via cloud drive (conflict handling, last-write-wins, frequent tree.json rewrites) depends on your cloud client and is **not fully verified by us** — logically feasible, not a tested selling point.
  - **Browser support**: folder storage needs the File System Access API — **Chrome/Edge only**; Firefox/Safari fall back to browser default storage automatically (no data loss).
  - **Reversible**: switch back to browser default anytime; switching merges seamlessly (folder ↔ browser, no data loss); old files remain on disk.

**Boundary / non-goal: no real-time multi-user collaboration.**
- Multi-machine sync is file-level, same-person-sequential, last-write-wins.
- No real-time co-editing (no CRDT/OT, no concurrent-merge). If needed later, it's a new direction requiring backend/account/conflict-algorithm work — out of current scope.

---

## 二、多画板工作区（核心）

Excalidraw 本身是**单画布**工具：一次只编辑一个场景，没有"多文件 / 多画板"的概念。KaiBoard 的核心优化，就是把这个单画布扩展成一个**可组织、可管理、可迁移的多画布工作区**。

### 1. 多画板文件树
- 左侧文件树，按**文件夹 + 画板**组织，支持**任意层级嵌套**；一个工作区里可同时管理多个顶层文件夹与大量画板。
- 点击文件夹展开 / 收起，点击画板即在该画布内打开（组件常驻，切换不丢状态）。
- 顶栏显示当前画板的**面包屑路径**（如 `我的画板 / 项目A / 画板1`）。

### 2. 拖拽整理
- 在文件树中**拖拽**节点：可重新排序、拖入文件夹、拖回根目录。
- 内置循环保护：不能把一个文件夹拖进它自己的子孙文件夹里。

### 3. 右键菜单与批量导入
- 不同位置右键提供不同操作：
  - **空白处 / 文件夹**：新建画板、新建文件夹、导入画板（可一次多选多个 `.excalidraw` 精准落入当前文件夹）、粘贴（剪贴板非空时显示）。
  - **文件夹**：额外提供「导出 PPTX」（整组递归导出）。
  - **画板**：导出此画板（`.excalidraw`）、导出 PPTX、创建副本、复制画板链接、剪切、复制、重命名、删除。
- **移动节点有两种方式**（菜单里没有"移动到…"子菜单）：
  1. **拖拽**：在文件树中拖拽节点重新排序、拖入文件夹、拖回根目录；内置循环保护，不能把文件夹拖进它自己的子孙。
  2. **剪切 / 复制 → 粘贴**：对节点「剪切」或「复制」，再到目标文件夹 / 空白处右键「粘贴」。（早期版本的"移动到…"悬浮子菜单已移除，由剪贴板式移动替代。）

### 4. 回收站（防误删）
- 删除 = 软删除（移入回收站），可随时**还原**。
- 支持**彻底删除**与**清空回收站**。

### 5. 侧栏搜索
- 输入关键词过滤画板 / 文件夹；命中项的**祖先链自动展开并高亮**，找不到时不打乱整棵树。

### 6. 跨版本导入健壮性
- 载入任意来源（含高版本 Excalidraw 等其它来源导出的场景）前，先用官方 `restore()` 归一化到当前版本。
- 整段载入包了兜底：万一仍有不兼容内容，只会降级为空白画布 + 提示，**绝不拖垮整个应用**，其它画板照常可用。

**🇬🇧 English.** Excalidraw is single-canvas: one scene at a time, no "multi-file / multi-board" concept. KaiBoard's core optimization extends that single canvas into an organizable, manageable, migratable multi-board workspace.
- **1. Multi-board file tree**: left tree of folders + boards, arbitrarily nested; manage many top-level folders and boards; click to open (component persists, state kept); breadcrumb path in top bar.
- **2. Drag to organize**: reorder, drag into folder, drag back to root; cycle protection prevents dropping a folder into its own descendant.
- **3. Right-click menu & batch import**: context-specific actions (new board/folder, import boards — multi-select `.excalidraw` into current folder, paste); folder offers "Export PPTX" (recursive); board offers export/duplicate/link/cut/copy/rename/delete. Move via drag or cut-copy-paste (the old "Move to…" submenu was removed).
- **4. Trash (anti-mis-delete)**: delete = soft-delete to trash, restorable; supports permanent delete & empty trash.
- **5. Sidebar search**: filter by keyword; ancestor chains auto-expand & highlight; doesn't disturb the tree when not found.
- **6. Cross-version import robustness**: normalize via official `restore()` before loading any source; whole-load is guarded — incompatible content degrades to a blank canvas + notice, never crashes the app; other boards keep working.

---

## 三、导入 / 导出与跨设备迁移

### 1. 统一格式规则
- 除顶栏「导出全部 / 导入备份」为 KaiBoard `.json` 工作区备份（迁备场景）外，**单 / 多导入、单 / 多导出一律保持原生 `.excalidraw`**——统一格式、可往返、对外可交换（可被 excalidraw.com / 第三方 NL→Excalidraw 生成器直接消费）。

### 2. 单画板导入 / 导出
- 单画板支持按 **Excalidraw `.excalidraw` 原生格式**导入 / 导出，且可**精准落入指定文件夹**。

### 3. 跨设备平行迁移（备份 / 恢复）
- **导出全部**：导出时让你定义**顶层文件夹名**，把当前所有内容套进该文件夹再下载。
- **导入备份**：以**平行合并**方式导入——所有节点生成全新 id，不会覆盖、不会清空目标机已有内容。换电脑时把导出的文件夹原样搬过去，觉得顶层文件夹多余可随手拖空删掉。

### 4. 侧栏多选 & 批量导出选中 / 拖拽外部文件夹导入
- **侧栏多选态**：勾选画板（勾选文件夹 = 其下全部画板递归选中，三态 ☐/☑/▣），顶部出现选择条，显示「已选 N 个画板」+「导出选中 (.excalidraw)」+「取消选择」。
- **批量导出选中画板**：点「导出选中」→ **逐个画板导出为原生 `.excalidraw` 文件**（与单画板右键「导出此画板」同格式；会触发浏览器多次下载）。该格式不保留文件夹层级——选中通常少量，用户手动归位成本低。
- **拖拽外部文件夹导入**：把系统里的文件夹直接拖到侧栏 → 按原目录结构在文件树创建对应层级文件夹，并批量导入其中的 `.excalidraw`/`.json`（Chrome / Edge 递归读目录；Firefox / Safari 自动扁平降级）。
- 单画板右键「导出此画板 (.excalidraw)」仍保留（逐个导出原样不变）。

### 5. 演示型导出（PPTX）
- 右键画板 / 右键文件夹（整组递归）/ 侧栏多选「导出选中」可导出 **PPTX（16:9 演示文稿，一板一页）**。
- 零上传、纯本地：PPTX 用 `pptxgenjs`（按需动态加载，不进主包）。
- 与「导出此画板 (.excalidraw)」原生格式互不冲突：`.excalidraw` 用于对外交换 / 再编辑，PPTX 用于演示交付。

**🇬🇧 English.**
- **1. Unified format rule**: except top-bar "Export all / Import backup" (KaiBoard `.json` workspace backup), all single/multi import & export stay native `.excalidraw` — uniform, round-trippable, externally exchangeable (consumable by excalidraw.com / third-party NL→Excalidraw generators).
- **2. Single-board import/export**: native Excalidraw `.excalidraw`, lands precisely in a chosen folder.
- **3. Cross-device parallel migration (backup/restore)**: "Export all" lets you define a top folder name and wraps everything; "Import backup" merges in parallel — all nodes get fresh ids, never overwrites or clears existing content.
- **4. Sidebar multi-select & batch export / drag-folder import**: multi-select boards (folder = recursive; tri-state); "Export selected" exports each as native `.excalidraw`; drag a system folder onto the sidebar to recreate structure and batch-import its `.excalidraw`/`.json` (Chrome/Edge recursive; Firefox/Safari flatten).
- **5. Presentation export (PPTX)**: export board / folder (recursive) / selected to PPTX (16:9, one board per slide); zero upload, fully local via `pptxgenjs` (lazy-loaded). `.excalidraw` for exchange/re-edit, PPTX for delivery — non-conflicting.

---

## 四、中文与本地化体验

### 1. 中文手写字体（Xiaolai / 小赖体）
- 内置**中文手写字体 Xiaolai（小赖体）**，自托管、离线可用（SIL OFL-1.1，由 excalidraw-cn 为中文场景优化选用）；画布默认即该手写体，无需手动切换。字体随 `@excalidraw/excalidraw` 依赖在构建时生成到 `public/fonts/`，**不进版本库**（仓库保持纯文本）。
- 子集化 `@font-face` 规则按字形按需加载，仅作用于画布与少量 UI 文本。

### 2. 多语言界面
- 界面提供**简体中文 / 繁体中文 / 英文**三种语言（设置内一键切换）：Excalidraw 原生工具条随同切换语言；KaiBoard 自定义的侧栏 / 右键菜单 / 提示 / 设置等壳层文案也已完整 i18n。

### 3. 主题
- 自带浅色 / 深色主题切换并持久化；资源自托管（`EXCALIDRAW_ASSET_PATH = "/"`），离线可用。

**🇬🇧 English.**
- **1. Chinese handwriting font (Xiaolai)**: built-in Xiaolai (小赖体) font, self-hosted, offline (SIL OFL-1.1, chosen/optimized by excalidraw-cn for Chinese); canvas defaults to it, no manual switch. Subset `@font-face` loads glyphs on demand. The font is generated into `public/fonts/` at build time from the `@excalidraw/excalidraw` dependency and is **not committed to the repo** (kept text-only).
- **2. Multi-language UI**: Simplified / Traditional Chinese / English (one-click in settings); Excalidraw's native toolbar switches language too; KaiBoard's own sidebar/menu/prompts/settings shell text is fully i18n'd.
- **3. Theme**: built-in light/dark toggle, persisted; assets self-hosted (`EXCALIDRAW_ASSET_PATH = "/"`), offline.

---

## 五、上手与引导

### 1. 首次启动引导
- 工作区为空时自动创建「我的画板 / 画板1」示例结构，开箱即用。

### 2. 空画板欢迎屏
- 打开一个空画板时，画布中央显示欢迎屏（快速上手提示 + 起始操作入口），首屏不再一片空白。

### 3. 元素批注（Comments）
- 选中画布元素可添加批注，批注以锚点叠加在画布上（跟随平移 / 缩放 / 元素移动实时定位），可随时隐藏。
- 批注写入元素 `customData`，随画板一起本地保存 / 导出，**不引入任何后端**。

**🇬🇧 English.**
- **1. First-run guide**: when workspace is empty, auto-creates a "我的画板 / 画板1" sample — ready to use.
- **2. Empty-board welcome**: opening an empty board shows a centered welcome screen (quick-start hints + entry points).
- **3. Element comments**: select a canvas element to add a comment, anchored overlay (follows pan/zoom/move, hideable); written to element `customData`, saved/exported locally, no backend.

---

## 六、画板间跳转链接（🔶 实验特性，价值未验证）

> **状态说明**：该能力可用，但**真实需求尚未验证**——它在早期开发中被提议加入，作者本人未使用过，也无用户反馈。当前定性为**保留但冻结**：不作卖点宣传、不再追加投入（不做双向 backlink 面板）。若你用上了并觉得有价值，欢迎反馈——这会成为解冻它的依据。

- 复制某个画板的专属链接（`kaiboard://<id>`），粘贴到画布任意元素的"链接"里。
- 在画布上点击该链接，会**在 KaiBoard 内部直接跳转到目标画板**（不会开新标签页）。
- 设想用法："目录画板""看板导航""内容互链"等结构化用法（**均未经实际使用验证**）。

**🇬🇧 English.** (🔶 experimental, value unverified)
- **Status**: usable, but real demand unverified — proposed early, never used by the author, no user feedback. Currently "kept but frozen": not advertised, no further investment (no bidirectional backlink panel). If you use it and find value, feedback can unfreeze it.
- Copy a board's link (`kaiboard://<id>`) into any element's "link". Clicking it jumps **inside KaiBoard** to the target board (no new tab). Envisaged uses: "index board", "kanban nav", "content interlink" (all unverified).

---

## 七、底层、致谢与两层设置

### 1. 关于底层与致谢
- **画布内核 100% 来自开源 Excalidraw**：画笔、形状、文本、箭头、图片、框架、无限画布等绘图能力，均由 [Excalidraw](https://github.com/excalidraw/excalidraw)（MIT 许可）提供。KaiBoard 在其之上补齐"多画板组织 / 本地优化 / 壳层能力"，绘图内核未做修改。
- **致谢**：感谢 Excalidraw 团队与开源社区提供的高质量绘图内核，让本地优先的多画板白板得以在其上构建。
- **设计参考**：多画板管理的交互范式参考了成熟的多画板白板产品的通用设计；绘图内核与具体工程实现均为 KaiBoard 自身完成。

### 2. ⚙ 两层设置，各管各的
- ① **画布内设置（Excalidraw 自带）**：通过画布左上 / 右上菜单（视图缩放、主题、导出、快捷键等），由 Excalidraw 控制，KaiBoard 不干预。
- ② **外壳设置（KaiBoard ⚙）**：管语言、存储位置，以及 KaiBoard 新增的入口（导入 / 导出备份、跳转链接等）。
- 两者职责不同、互不影响；若找不到某项设置，先看它在画布内还是在外壳里。

### 3. 🌐 语言范围
- 画布内 Excalidraw 原生支持数十种语言（由 Excalidraw 提供，我们不改）；KaiBoard 外壳额外做了**简体中文 / 繁体中文 / 英文**三种最基础的语言（覆盖主要用户群）。外壳文本量小且为独立层，只能覆盖我们自己写的 UI，无法替 Excalidraw 增删语言。

**🇬🇧 English.**
- **1. Engine & credits**: 100% of the canvas engine comes from open-source Excalidraw (MIT) — pen, shapes, text, arrows, images, frames, infinite canvas. KaiBoard adds multi-board organization / local optimization / shell capabilities on top; the engine is unmodified. Thanks to the Excalidraw team & community.
- **2. Two settings layers**: ① in-canvas settings (Excalidraw's own: zoom, theme, export, shortcuts) — Excalidraw-controlled; ② shell settings (KaiBoard ⚙): language, storage, and KaiBoard's added entries (backup import/export, links). Distinct, non-interfering.
- **3. Language scope**: Excalidraw natively supports dozens of languages (untouched); KaiBoard shell adds Simplified/Traditional Chinese/English (covers main audiences). Shell text is small/independent, can't add/remove Excalidraw languages.

---

## 八、规划中

- 当前基础版聚焦本地优先白板能力；更多扩展能力仍在内部评估与验证，成熟后随版本升级逐步释放，不在当前发布说明中提前预告。

**🇬🇧 English.** The current base edition focuses on local-first whiteboard capabilities; further extensions are under internal evaluation. Mature ones ship gradually in later versions — not pre-announced in this release.
