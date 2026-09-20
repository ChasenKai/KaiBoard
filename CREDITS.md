# Credits / 致谢

**English** | [简体中文](#简体中文)

---

## English

KaiBoard stands on the work of others. Our thanks to everyone below.

### Ecosystem & specifications

| Project | What we use it for |
|---|---|
| [Excalidraw](https://github.com/excalidraw/excalidraw) (MIT) | The canvas / drawing kernel and the `.excalidraw` file format — the contract everything is built on. |
| [React](https://react.dev) / React DOM (MIT) | The UI layer. |
| [Vite](https://vite.dev) (MIT) | Build tooling. |
| [idb](https://github.com/jakearchibald/idb) (ISC) | A thin promise wrapper over IndexedDB, which backs the default local storage. |
| [@excalidraw/mermaid-to-excalidraw](https://github.com/excalidraw/mermaid-to-excalidraw) (MIT) | Turning Mermaid text into editable whiteboard elements. |
| [pptxgenjs](https://github.com/gitbrent/PptxGenJS) (MIT) | Exporting a board as a `.pptx` presentation. |
| [Model Context Protocol](https://modelcontextprotocol.io) | The tool protocol our companion MCP server implements, which is how an AI Agent drives a board. |
| [Agent Skills](https://agentskills.io) specification | The `SKILL.md` format of our companion skill. |

### Fonts & third-party assets

| Asset | Licence / origin |
|---|---|
| **Xiaolai (小赖体)** | SIL Open Font License 1.1 — chosen and subset for Chinese handwriting by [excalidraw-cn](https://github.com/excalidraw-cn), based on [霞鹜 (lxgw) SetoFont](https://github.com/lxgw/setofont). |
| **Virgil** | Excalidraw's own hand-drawn Latin typeface. |
| **Excalifont · Comic Shanns · Nunito · Lilita One · Assistant · Cascadia Code · Liberation Sans** | Shipped with Excalidraw as part of its drawing assets. |

> **This repository does not redistribute font binaries.** They are generated at build time from the installed `@excalidraw/excalidraw` dependency — see `scripts/prepare-fonts.mjs`. The repository itself stays plain text.
>
> Full licence texts and per-dependency attributions: [`THIRD_PARTY_LICENSES`](./THIRD_PARTY_LICENSES).

### Inspiration

Ideas we drew on, and re-implemented ourselves:

| Source | What we took from it |
|---|---|
| [Mermaid](https://mermaid.js.org) | The idea of turning plain text into a diagram — the starting point for our text-to-board path. |
| The broader multi-board whiteboard category | Its general interaction paradigm for organising many boards. The concrete design and engineering here are our own. |

If you believe your work is used here without proper credit, please open an issue — we will fix it.

---

## 简体中文

KaiBoard 站在别人的肩膀上。感谢以下每一位。

### 生态与规范

| 项目 | 我们用它做什么 |
|---|---|
| [Excalidraw](https://github.com/excalidraw/excalidraw)（MIT） | 画布 / 绘图内核，以及 `.excalidraw` 文件格式 —— 一切都建立在这个契约之上。 |
| [React](https://react.dev) / React DOM（MIT） | UI 层。 |
| [Vite](https://vite.dev)（MIT） | 构建工具链。 |
| [idb](https://github.com/jakearchibald/idb)（ISC） | IndexedDB 的轻量 Promise 封装，默认本地存储靠它。 |
| [@excalidraw/mermaid-to-excalidraw](https://github.com/excalidraw/mermaid-to-excalidraw)（MIT） | 把 Mermaid 文本转成可继续编辑的白板元素。 |
| [pptxgenjs](https://github.com/gitbrent/PptxGenJS)（MIT） | 把画板导出成 `.pptx` 演示文稿。 |
| [Model Context Protocol](https://modelcontextprotocol.io) | 配套 MCP 服务端实现的工具协议 —— AI Agent 借此驱动画布。 |
| [Agent Skills](https://agentskills.io) 规范 | 配套 Skill 的 `SKILL.md` 格式。 |

### 字体与第三方资产

| 资产 | 许可 / 来源 |
|---|---|
| **Xiaolai（小赖体）** | SIL Open Font License 1.1 —— 由 [excalidraw-cn](https://github.com/excalidraw-cn) 为中文场景选用并做子集化，源自 [霞鹜 (lxgw) SetoFont](https://github.com/lxgw/setofont)。 |
| **Virgil** | Excalidraw 自带的手写拉丁字体。 |
| **Excalifont · Comic Shanns · Nunito · Lilita One · Assistant · Cascadia Code · Liberation Sans** | 随 Excalidraw 作为其绘图资产一并分发。 |

> **本仓不重新分发字体二进制**。它们在构建时从已安装的 `@excalidraw/excalidraw` 依赖生成 —— 见 `scripts/prepare-fonts.mjs`。仓库本身保持纯文本。
>
> 完整许可文本与逐依赖署名：[`THIRD_PARTY_LICENSES`](./THIRD_PARTY_LICENSES)。

### 灵感来源

我们借鉴了想法、但自行实现的部分：

| 来源 | 我们从中取用的 |
|---|---|
| [Mermaid](https://mermaid.js.org) | 「把纯文本变成图」的思路 —— 我们「文本 → 画板」路径的起点。 |
| 多画板白板这一品类 | 组织大量画板时的通用交互范式。此处的具体设计与工程实现为我们自研。 |

若你认为你的成果在此被使用而未获恰当署名，请开 issue —— 我们会修正。

---

> 📎 相关：[`THIRD_PARTY_LICENSES`](./THIRD_PARTY_LICENSES)（逐依赖许可与署名）· [`LICENSE`](./LICENSE)（本产品 MIT）
