# KaiBoard 隐私说明（Privacy）

> **English.** KaiBoard is a local-first whiteboard. Your boards live on your own device — no account, no upload, no telemetry. The optional Agent co-draw feature talks only to a relay on `127.0.0.1` that you start yourself, and it never sends board data anywhere.

一句话：**KaiBoard 是本地优先（local-first）白板 —— 你的画布数据默认只待在你自己的设备上，不上传、不建账号、不收集遥测。**

---

## 1. 数据存在哪里

- **默认存储**：浏览器本地数据库（IndexedDB，位于你系统的浏览器配置目录下）。
- **可选存储**：在「设置 → 存储位置」里手动选择一个**本地文件夹**，KaiBoard 会把数据以真实文件写入该目录（`kaiboard-data/tree.json` + `boards/<id>.json`）。若选的是 OneDrive / 百度网盘等同步盘，则可在你自己的多台电脑间同步（文件级、后写覆盖）。
- **切换可逆**：随时可「恢复浏览器默认存储」；切换时当前工作区无缝合并到目标存储，旧文件仍保留在磁盘上。

## 2. 我们「不」做什么（零上传承诺）

- 🚫 **不上传任何画布内容** —— KaiBoard **没有后端、没有账号体系**。所有绘图、保存、导出、导入都在你的浏览器 / 本地文件里完成。
- 🚫 **不要求注册 / 登录**。打开即用，无需邮箱、手机号、密码。
- 🚫 **不采集遥测 / 行为埋点 / 崩溃上报**等任何形式的用户数据上报。
- 🚫 **画布数据不出本机**。Agent 共绘（可选功能）只与**你自己在本机 `127.0.0.1` 启动的中继**通信；令牌由你显式授权，中继只绑回环地址，不向任何外部服务器发送画板内容。

## 3. 你可以自己验证

- **开源内核**：绘图能力来自开源 [Excalidraw](https://github.com/excalidraw/excalidraw)（MIT 许可），KaiBoard 的多画板管理 / 本地优化层为自研并同样开源。完整依赖见 [`THIRD_PARTY_LICENSES.md`](../THIRD_PARTY_LICENSES.md)。
- **离线可用**：字体、资源全部自托管，断网也能用。
- **自己查**：打开浏览器开发者工具 → Network 面板，正常使用 KaiBoard（画图、保存、导出）时，你**看不到**任何指向 KaiBoard 域名的画布数据外发请求。
  （例外：你主动把存储目录选在云盘同步盘时，那是云盘厂商在同步你的文件，与 KaiBoard 无关。）
- **代码可读**：仓库源码与构建产物都是明文，可逐行审计。

## 4. 备份与防丢（重要）

- 本地存储虽稳，但**清除浏览器缓存 / 卸载浏览器 / 换设备未同步**可能导致数据丢失。
- **请定期备份**：左侧栏「导出」单个 `.excalidraw` 文件，或顶栏「导出全部（备份）」导出整个工作区 `.json`。
- 已内置**回收站**（软删除，可还原）与**跨设备平行合并导入**，降低误删与换机风险。

## 5. 相关文档

- [`docs/SECURITY.md`](./SECURITY.md) —— 数据位置、威胁模型与已知限制
- [`docs/AGENT.md`](./AGENT.md) —— Agent 共绘是什么、怎么接、安全边界在哪
- [`docs/FEATURES.md`](./FEATURES.md) —— 完整功能说明
