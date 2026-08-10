// 门面（facade）：编译期由 vite resolve.alias 的 @agent 决定实际实现。
//
//  - 基础版（VITE_AI_ENABLED=false，公开仓库默认）：@agent → src/_agent_stub（无逻辑桩），
//    基础版产物不含任何真实 AI 协议 / 桥接 / 中继代码。
//  - 带 AI 版（VITE_AI_ENABLED=true，仅本地 AI 构建）：@agent → src/_agent_private（真实实现，
//    gitignored，不进入公开仓库）。
//
// 这样 App.tsx 永远只 import 本门面，具体实现由构建通道决定，源码树对外零 AI 泄漏。
export * from "@agent/agentIntegration";
