import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// KaiBoard 构建配置
// - 🔴 命令内核来自 npm 包 @kaibuddy/kaiboard-core —— **不要改回跨仓引用 ../mcp/packages/core/src**：
//   本地能跑（同级目录），但 CI / Cloudflare Pages 只 clone app 仓，会以
//   `Could not load .../mcp/packages/core/src/... ENOENT` 构建失败（2026-09-23 实测踩到，
//   后果是产品站停更近一个月而 GitHub 上已发布）。
// - base "/"：配合 window.EXCALIDRAW_ASSET_PATH="/"，字体/资源从站点根 /fonts 加载（离线自托管）
// - optimizeDeps target es2022：Excalidraw 0.18 需要
// - assetsInlineLimit 0：字体文件不内联，保持独立以便离线拷贝
export default defineConfig({
  plugins: [react()],
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
