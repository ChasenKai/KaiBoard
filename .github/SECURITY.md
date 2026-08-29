> 本文件随开源发布，定义如何向 KaiBoard 报告安全漏洞。  
> This file is published with the open-source release and defines how to report security vulnerabilities to KaiBoard.
>
> 威胁模型与详细风险清单为内部评估文档，**不公开**。  
> Threat model and detailed risk inventory are internal assessment documents and **not public**.

# 安全政策 / Security Policy

## 支持版本 / Supported versions

| 版本 / Version | 安全更新 / Security updates |
| --- | --- |
| `v1.0.0`（最新 / latest） | ✅ 支持 / Supported |
| 更早版本（含 `v1.0.0-beta.*`）/ Earlier versions (incl. `v1.0.0-beta.*`) | ❌ 不再维护 / Not maintained |

## 报告漏洞 / Reporting a vulnerability

请**私下**报告安全问题，不要公开提 issue。  
Please report security issues **privately**; do not open a public issue.

- **推荐 / Recommended**：在 GitHub 仓库 **Security → Report a vulnerability** 使用私有漏洞报告（Private Vulnerability Reporting）。  
  Use **Security → Report a vulnerability** in the GitHub repository (Private Vulnerability Reporting).

## 响应预期 / What to expect

- 我们会在 **72 小时内**确认收到。  
  We will acknowledge receipt within **72 hours**.
- 尽快给出初步评估与修复时间表。  
  We will provide an initial assessment and remediation timeline as soon as possible.
- 修复发布后，会在 Release Notes 中致谢（如你愿意公开）。  
  You will be credited in the Release Notes upon fix publication (if you choose to be named).

## 范围说明 / Scope

KaiBoard 是**本地优先、无后端、无账号**的应用，数据只留在你自己的设备上：  
KaiBoard is a **local-first, no-backend, no-account** application; your data stays on your own device:

- 不收集个人数据、不涉及云端账户；  
  No personal data is collected and there are no cloud accounts.
- 攻击面主要集中在 **本地文件读写 / 导入导出解析 / 未来可选的 Agent 共绘接口**。  
  The attack surface is mainly **local file I/O / import-export parsing / the future optional Agent co-drawing interface**.

感谢你帮助保持 KaiBoard 的安全。  
Thank you for helping keep KaiBoard secure.
