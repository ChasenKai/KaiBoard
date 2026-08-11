import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// 构建期「Agent 共绘」实现切换（双路发布核心机制）：
//  - VITE_AI_ENABLED=true（带 AI 版，仅本地 AI 构建）→ @agent 指向 _agent_private（真实实现，gitignored，不进公开仓）
//  - 否则（基础版，公开仓库默认）→ @agent 指向 _agent_stub（无逻辑桩：方法皆 no-op，AI 面板渲染为空）
// 基础版产物不含任何可用的真实 AI 执行逻辑（AI 大脑在 gitignored 的 src/_agent_private/，未被编译进 dist-basic）。
// 注：源码树另有 src/agentBridge.ts / src/agentRelayClient.ts 等早期协议客户端死代码，未被任何构建路径引用、
//     已被 tree-shake 剔除、不进产物，不可据此误判为「已泄露完整 AI 实现」。
const agentTarget =
  process.env.VITE_AI_ENABLED === "true"
    ? fileURLToPath(new URL("./src/_agent_private", import.meta.url))
    : fileURLToPath(new URL("./src/_agent_stub", import.meta.url));

// KaiBoard 构建配置
// - base 设为 "/"：配合 window.EXCALIDRAW_ASSET_PATH="/"，字体/资源从站点根 /fonts 加载（离线自托管）
// - optimizeDeps target es2022：Excalidraw 0.18 需要
// - assetsInlineLimit 0：字体文件不内联，保持独立以便离线拷贝
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@agent": agentTarget,
    },
  },
  base: "/",
  optimizeDeps: {
    esbuildOptions: {
      target: "es2022",
    },
  },
  build: {
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 8000,
    // 不在构建前清空 dist：本机 E: 卷的安全删除钩子会拦截 vite 的 rmSync。
    // 改用原地覆盖；旧哈希 chunk 会残留（无害），如需纯净可手动删除 dist/ 后重建。
    emptyOutDir: false,
  },
});
