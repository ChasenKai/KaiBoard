# Agent 共绘（Agent Co-draw）

> **English.** Agent co-draw lets an AI Agent work on your KaiBoard canvas. Two paths: **live co-draw** — the Agent drives the board you already have open, so you see changes as they happen; and **file output** — the Agent produces an editable `.excalidraw` file you import later. It is off by default, talks only to a relay on `127.0.0.1`, and only works once you explicitly hand over a token.

一句话：**让 AI Agent 在你的 KaiBoard 画布上作图 —— 默认关闭、只在本机通信、令牌由你显式授权。**

---

## 1. 两条协作路径

| 路径 | 含义 | 适合 |
|---|---|---|
| **实时共绘（首选）** | Agent 直接驱动你**当前打开的画板**增删改元素 —— 画完即见、可当场继续改 | 你人就在画布前，想边聊边改 |
| **出文件** | Agent 生成一份可编辑的 `.excalidraw` 文件，你随时导入 KaiBoard 或 Excalidraw | 离线产出、稍后再看、或转给别人 |

两条路径共享同一份「合法 Excalidraw 元素」契约，产物都能在 KaiBoard 里继续编辑 —— **不是图片，是原生图元**。

---

## 2. 怎么接上（约 1 分钟）

**前提**：Agent 客户端与 KaiBoard 页面必须在**同一台机器**上（都要能访问 `127.0.0.1`）。

1. **打开 KaiBoard 网页 → 点右上角 ✨ AI → 打开「AI 面板」→ 把「Agent 共绘」开关拨到 ON**。
   （注意：**AI 面板与「设置 ⚙」是两个入口**——Agent 共绘在 AI 面板里，基础设置里没有。）
   - 只有要「让 Agent 在画布上实时增删元素」时才需要这一步。只用多画板 / 手写 / 文件树等常规功能的话，整节都可跳过。
2. 在**同一处**点 **「复制配置给 Agent」** —— 一键拿到一段**可直接粘给你的 AI 助手**的完整配置（含 MCP 服务端地址与你本页生成的令牌）。
3. **把这段发给你的 AI 助手**，让它照此写入 MCP 设置。
4. **重启你的 Agent 客户端**加载新配置；回到 KaiBoard 面板确认显示「连接成功」。完成。

> **换一台电脑 / 给别人用**：在同一台机器上重复上述步骤即可 —— 令牌由页面本地生成，**全自助**，不需要任何人工介入。

### 令牌是什么、为什么必须你手动给

这是一个**未做代码签名的开源工具**。显式令牌模型意味着：**没有你的显式授权，任何 Agent 都连不上你的画布** —— 开关始终在你手上。

**但"手动"不等于"麻烦"**：令牌不用你去找、去拼，面板「复制配置给 Agent」一次给你一段完整、可直接粘的配置；要换令牌，点「更新令牌并重新复制」把新的发给 Agent 即可。

---

## 3. Agent 能做什么

连上后，你的 Agent 会获得一组画板工具（前缀 `kbfs_`），覆盖：

- **读**：列出画板、读取画布元素
- **写**：追加元素、整板替换、打补丁、删除元素
- **转换**：把 Mermaid 文本转成原生可编辑图元落到画板
- **自检**：导出画板元素包围盒截图（用于 Agent 自己回看构图）
- **管理**：新建画板、设置画板元信息

Agent 可以先调 `kbfs_list_capabilities` 查看全部能力。

### 落板纪律（内置）

- **默认落在你当前打开的画板**，往下追加、非破坏；只有你显式说「新建画板」才新建。
- **整板替换**是破坏性动作，执行前会自动留一份快照（最多 20 份），可从「AI 面板 → 快照还原」还原。
- **每批新增内容带一个批次标记**（分隔符 + 时间戳 + 主题），方便你分辨"这轮 Agent 加了什么"。
- **活跃指示**：Agent 在某画板上写入时，左侧文件树对应节点会持续高亮，停手后自动淡出；顶栏也有一个「Agent 共绘中」的状态点。

---

## 4. 配套官方 Skill（推荐）

如果希望 Agent「怎么画」也更懂行（构图、风格档位、箭头路由、标注、社区素材库按需取件），可以装上官方 Skill：

> **https://github.com/ChasenKai/kaiboard-skills**

它把「选哪条协作路径、怎么构图、怎么安全落板」写成给 Agent 看的说明书，与上面的工具配合使用。

---

## 5. 安全边界（要点）

- **数据不出本机**：中继只绑 `127.0.0.1`，画板内容不向任何外部服务器发送。
- **共绘默认关闭**；关闭后页面不轮询任何端口，外部完全驱动不了。
- **令牌即授权**：不要把令牌写进公开文件或分享给他人；令牌泄露等同于该会话可被驱动。
- **同机取舍**：中继开着时，本机上任何知道令牌的程序都能发指令 —— 缓解手段是"令牌 + 仅开启时监听"，不是绝对隔离。

完整的数据位置、威胁模型与已知限制见 [`docs/SECURITY.md`](./SECURITY.md)。

---

## 6. 相关文档

- [`docs/SECURITY.md`](./SECURITY.md) —— 安全模型、威胁模型、已知限制
- [`docs/PRIVACY.md`](./PRIVACY.md) —— 数据存哪、不上传承诺
- [`docs/FEATURES.md`](./FEATURES.md) —— 完整功能说明
- [官方 Skill 仓](https://github.com/ChasenKai/kaiboard-skills) —— 让 Agent 更懂"怎么画"
- [MCP 服务端](https://github.com/ChasenKai/kaiboard-mcp) —— 中继与工具协议的实现（源码可审）
