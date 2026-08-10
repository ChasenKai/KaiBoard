# KaiBoard 更新日志（Changelog）

> 面向用户 / 随开源发布包一起看的版本变更记录（公开版）。

---

## 关于版本号
- 唯一真源：`package.json` 的 `version`。
- 对外只发布一个产品 **KaiBoard** + 版本号；后续能力升级沿用同一版本号递增。
- 基础内容与扩展能力共享同一份代码，任一部分更新都整体升版，不拆成两条版本线对外。

---

## 当前版本

### v1.0.0-beta（2026-08-09）· 基础版公测首发
- 多画板文件树 / 侧栏画板多选 + 整组拖入文件夹
- 导入导出统一：单/多导入、单/多导出一律原生 `.excalidraw`；顶栏「导出全部 / 导入备份」为 KaiBoard 工作区 `.json`
- 演示型导出：PPTX（pptxgenjs，按需动态加载，不进主包）
- 元素批注（随画板本地保存、随 `.excalidraw` 导出）
- 帮助弹窗原生两栏排版；版本号入口位于「设置 → 关于」
- Toast 对齐原生浅色方框
- 画板级剪切 / 复制 / 粘贴
- 开源协议三件套（MIT + 第三方许可 + README 许可小节）
- 顶部公告条「beta 公测版」数据备份提示

> 说明：当前公开发布为基础版，聚焦本地优先白板能力。后续扩展能力将随版本升级自然开放。

### 仓库与构建（2026-08-10）
- **仓库纯文本化**：字体（Excalidraw 官方 8 款 + 中文手写 Xiaolai 共 209 子集）不再提交进版本库，改为 `npm run dev` / `build` 时由 `scripts/prepare-fonts.mjs` 从已安装的 `@excalidraw/excalidraw@0.18.1` 依赖生成到 `public/fonts/`（已在 `.gitignore` 忽略）。
- **favicon 内联**：站点图标以 data URI 内联进 `index.html` 与 `src/favicon.ts`，源 `public/favicon.png` 不再进版本库（避开二进制、保持仓库纯文本）。
- **社交预览图外置**：`.github/social-preview.png` 不进版本库，发布后在 GitHub Settings 上传。

---

## 版本号规则
- 唯一真源：`package.json` 的 `version`。
- 对外单一版本号递增；基础内容与扩展能力共享同一份代码，任一部分更新都整体升版，不拆成两条版本线对外。
