// 门面（facade）：编译期由 vite resolve.alias 的 @agent 决定实际实现。
//
//  - 基础版（VITE_AI_ENABLED=false，公开仓库默认）：@agent → src/_agent_stub（无逻辑桩，
//    所有方法 no-op、AI 面板渲染为空），基础版产物不含任何可用的真实 AI 执行逻辑。
//  - 带 AI 版（VITE_AI_ENABLED=true，仅本地 AI 构建）：@agent → src/_agent_private（真实实现，
//    gitignored，不进入公开仓库）。
//
// App.tsx 永远只 import 本门面，具体实现由构建通道决定。真正的 AI 实现（src/_agent_private/）不进公开仓；
// 但源码树内残留的 src/agentBridge.ts / src/agentRelayClient.ts 是未被引用的早期死代码
// （已被 tree-shake 剔除、不进产物），故「源码树对外零 AI 泄漏」并不准确——公开仓含的是 no-op 桩与死代码，而非可用实现。
export * from "@agent/agentIntegration";
