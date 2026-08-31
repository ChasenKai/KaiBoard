<p align="center">
  <a href="README.md">English</a> &middot; <a href="README.zh-CN.md">中文</a>
</p>

<p align="center">
  <img src="https://kaibuddy.com/og-image.png" alt="KaiBoard — 免费开源、本地优先的中英文手写风无限白板" width="100%">
</p>

# KaiBoard

<p align="center">
  <a href="https://kaiboard.kaibuddy.com" target="_blank" rel="noopener"><strong>🚀 在线试用 KaiBoard</strong></a>
</p>

免费开源、本地优先的**中英文手写风多画布白板**（绘图内核基于开源 [Excalidraw](https://github.com/excalidraw/excalidraw)）。

> **一句话定位**：无需注册、不上传云端，数据只留在你自己的设备上；为个人单人使用设计，不做实时协同。在绘图内核之上补齐了"多文件 / 多画板管理"这一能力（Excalidraw 原生缺失），并提供回收站与跨设备平行迁移。

> **🙏 关于底层与致谢**：KaiBoard 的画布绘图能力（画笔、形状、无限画布、图片、框架等）100% 来自开源项目 [Excalidraw](https://github.com/excalidraw/excalidraw)（MIT 许可）。我们非常感谢 Excalidraw 团队与开源社区提供的高质量绘图内核，让"本地优先的多画板白板"得以在此基础上构建。KaiBoard 在其之上的"多画板组织 / 本地优化 / 壳层能力"为自身新增，详见 [`docs/FEATURES.md`](docs/FEATURES.md)。

> **设计参考**：多画板管理的交互范式参考了成熟的多画板白板产品的通用设计；绘图内核与具体工程实现均为 KaiBoard 自身完成。

完整功能说明见 [`docs/FEATURES.md`](docs/FEATURES.md)。

## ✨ 核心能力（摘要）

- **本地优先与数据安全**：数据存浏览器（IndexedDB）或你指定的本地文件夹（File System Access API，仅 Chrome/Edge），无账号、不上传；可选将文件夹指向云盘同步目录以借助云盘客户端做**个人跨机同步**（逻辑可行，未经我们充分验证，非团队实时协同编辑）
- **多画板文件树**：多顶层文件夹 + 画板任意层级嵌套、点击切换、面包屑路径
- **拖拽整理 & 右键菜单**：拖拽排序 / 拖入文件夹、剪切-复制-粘贴移动、重命名、删除、导入画板，支持**一次批量导入多个 `.excalidraw` 文件**
- **回收站（软删除）**：误删可还原，支持彻底删除与清空
- **侧栏搜索**：按名过滤，命中链自动展开并高亮
- **导入 / 导出与跨设备迁移**：单 / 多画板原生 `.excalidraw` 互交换；工作区 `.json` 备份平行合并迁移；批量导出选中 / 拖拽外部文件夹导入；PPTX 演示导出
- **画板间跳转链接**（🔶 实验特性，价值未验证、不作卖点）：`kaiboard://<id>` 应用内跳转，设想用于目录画板 / 看板导航
- **中英文手写（中文 Xiaolai + 英文 Virgil）+ 简体/繁体/英文三语 + 离线自托管**
- **上手引导**：首次启动示例结构、空画板欢迎屏、元素批注
- **无限画布**：继承自 Excalidraw 内核，缩放/平移流畅

> 以上每一项功能的详细说明，见 [`docs/FEATURES.md`](docs/FEATURES.md)。

> **⚙ 两层设置，各管各的**：KaiBoard 现在有两处设置——① **画布内设置**（Excalidraw 自带，如视图缩放、主题、导出、快捷键等，由 Excalidraw 控制）；② **外壳设置**（右上角 ⚙，管语言、存储位置，以及我们新增的导入/导出备份、双链等入口）。两者职责不同、互不影响。

> **🌐 语言范围**：画布内 Excalidraw 原生支持数十种语言（由 Excalidraw 提供，我们不改）；KaiBoard 外壳额外做了**简体中文 / 繁体中文 / 英文**三种最基础的语言（覆盖主要用户群）。外壳文本量小且为独立层，只能覆盖我们自己写的 UI，无法替 Excalidraw 增删语言。

## 🚀 快速开始

```bash
npm install
npm run dev
# 默认 http://localhost:5173
```

`npm run dev` 会在启动前自动执行 `scripts/prepare-fonts.mjs`，从已安装的 `@excalidraw/excalidraw` 依赖（`dist/prod/fonts`）生成字体到 `public/fonts`——**字体不进版本库**，每次均强制同步（见 `.gitignore`）。

## 📦 构建为静态目录

```bash
npm run build
# 基础版产物在 dist-basic/ —— 整个目录可拷到 U 盘 / 任意静态服务器
```

⚠️ **不能直接双击 `dist-basic/index.html`**：Excalidraw 0.18+ 为 ES Module 且字体经 `fetch` 加载，`file://` 协议下会被同源 / CORS 策略拦截。请用静态服务器访问：

```bash
npm run preview      # 或
npx serve dist
```

## 🛠 技术栈

| 项 | 选型 |
|---|---|
| 构建 | Vite 5 |
| 框架 | React 18.3 |
| 画布 | `@excalidraw/excalidraw@0.18.1` |
| 存储 | IndexedDB（idb），库名 `kaiboard` |
| 中英文手写字体 | 中文 Xiaolai（小赖体）+ 英文 Virgil（Excalidraw 默认），均自托管、离线可用（SIL OFL-1.1；随 `@excalidraw/excalidraw` 依赖在构建时生成，不进版本库） |

## 📂 数据模型

IndexedDB 库名 `kaiboard`：

| Store | key | 内容 |
|---|---|---|
| `files` | `id` | 文件树节点 `FileNode { id, type:'folder'\|'board', name, parentId, createdAt, updatedAt, order, deletedAt?, trashRoot? }` |
| `boards` | `id`（= 画板 id） | 画板内容 `BoardData { id, elements, appState, files }` |
| `settings` | 字符串键（out-of-line） | UI 状态：`expanded` / `lastBoardId` / `sidebarWidth` / `sidebarCollapsed` / `theme` |

> 画板内容按**画板自身 id** 存入 `boards` store（与文件树节点一一对应）。

## ⚠️ 已知问题 / 注意

- **协作被禁用**：离线场景显式关闭协作相关 UI，避免无谓的网络请求与控制台报错。
- **字体体积**：中文手写字体约 2.6MB woff2，首次加载稍慢（已覆盖 Excalidraw 官方 Virgil 确保离线可用）；**字体在构建时从依赖生成、不随仓库分发**。
- **图片附件**：Excalidraw 内粘贴的图片以 base64 存入 `boards.files`，占 IndexedDB 配额；极端情况需在 DevTools 清理。
- **多标签页**：不同标签页各自持有一份画布实例，同时编辑以最后一次保存为准。

## 🔄 依赖版本与升级策略

KaiBoard 固定依赖 `@excalidraw/excalidraw@0.18.1`（见上方技术栈）。关于"以后版本更新会怎样"：

- **不会自动跟随更新**：npm 依赖是固定版本，除非我们主动改 `package.json` 并重新安装，否则始终停留在 0.18.1，升级时机完全由我们控制。
- **升级是"手动 + 需评估"的刻意动作**：Excalidraw 不同版本间存在破坏性变更（如 `appState` 结构、`restore()` 签名、协作 API 等）。KaiBoard 对内核做了封装（例如用官方 `restore()` 修复跨版本导入白屏、绑定 `langCode`、接管 `onChange` 自动保存、双后端存储），升级大版本需要重新回归测试我们的壳层集成。
- **Excalidraw 托管的"高级功能"（如智能图表）不在开源 npm 包里**：那些只存在于托管的 excalidraw.com / Excalidraw+。即使升级 npm 包，也不会自动获得——这类能力若需要，得由 KaiBoard 自己对接相关模型实现。
- **建议做法**：保持固定版本以保证稳定；当确实需要 Excalidraw 新版本里的某项能力时，再单独立项评估升级、跑回归（含白屏兜底、双后端存储、i18n），确认无误后再发布。

## 📁 项目结构

### 顶层文件与目录

```
kaiboard/
├─ .gitignore               # 忽略规则：构建产物、构建时生成的字体、浏览器缓存等
├─ README.md                # 英文版（canonical）
├─ README.zh-CN.md          # 本文件（中文版）
├─ CHANGELOG.md              # 版本变更记录（中英混排）
├─ LICENSE                  # MIT 开源许可证
├─ THIRD_PARTY_LICENSES     # 第三方依赖版权汇总（Excalidraw 等）
├─ index.html               # HTML 入口；设置 window.EXCALIDRAW_ASSET_PATH = "/"
├─ package.json             # 依赖与脚本（dev / build / preview）
├─ package-lock.json        # 依赖锁版本
├─ vite.config.ts           # Vite 构建配置
├─ tsconfig.json            # TypeScript 类型配置
├─ docs/                    # 文档
│  └─ FEATURES.md            # KaiBoard 功能说明（中英混排，贡献者/用户必读）
├─ public/                  # 静态资源
│  ├─ announcements.json    # 公告栏文案
│  └─ （字体在构建时由 prepare-fonts.mjs 从 @excalidraw/excalidraw 依赖生成到 public/fonts/；favicon 以 data URI 内联）
├─ scripts/                 # 构建脚本
│  ├─ prepare-fonts.mjs     # 字体准备（Excalidraw 官方 + 中文手写）
│  └─ build-basic.mjs       # 基础版构建（VITE_AI_ENABLED=false）
└─ src/                     # 源码，详见下一节
```

### 核心源码结构

```
src/
├─ main.tsx              # 入口：引入 excalidraw/index.css + fonts.css + styles.css
├─ fonts.css             # @font-face 把 Virgil 覆盖为中文手写体
├─ styles.css            # 应用布局
├─ db.ts                 # IndexedDB 封装（files / boards / settings；软删除与回收站、设置读写）
├─ App.tsx               # 主组件：文件树、自动保存、多画板切换、右键菜单、主题、面包屑、保存指示
├─ Sidebar.tsx           # 文件树（搜索 / 行内重命名 / 拖拽 / 空白右键 / 回收站入口）
├─ ContextMenu.tsx       # 右键菜单（导出 / 副本 / 复制链接 / 剪切-复制-粘贴）
├─ TrashPanel.tsx        # 回收站弹窗（还原 / 彻底删除 / 清空）
└─ exportImport.ts       # 导出（工作区备份 / 单画板 .excalidraw）、导入（平行合并、必建树节点、剥离回收站标记）
```

## 💬 反馈

有问题、报 bug 或提功能建议，欢迎通过 [GitHub Issues](https://github.com/ChasenKai/KaiBoard/issues) 反馈。

## 📄 许可

- KaiBoard 本身以 **MIT 许可**发布，完整文本见 [LICENSE](./LICENSE)。
- 第三方依赖（含作为绘图内核的 Excalidraw）的许可证见 [THIRD_PARTY_LICENSES](./THIRD_PARTY_LICENSES)。
- 本产品基于开源 [Excalidraw](https://github.com/excalidraw/excalidraw)（MIT）构建，遵循其 MIT 协议并保留了其版权声明；其官方推广链接（博客 / YouTube）与品牌已从产品 UI 中移除，但许可证文本完整保留。
- 中文手写字体（Xiaolai 小赖体，由 excalidraw-cn 为中文场景优化选用）遵循 SIL Open Font License。
