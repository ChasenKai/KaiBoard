import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// 命令内核单一真源 = ../mcp/packages/core/src（同级 mcp 仓）。
// 页面端不自带 core 副本，改为经 @agent-core 引用同一份。
const coreTarget = fileURLToPath(new URL("../mcp/packages/core/src", import.meta.url));

// KaiBoard 构建配置
// - base 设为 "/"：配合 window.EXCALIDRAW_ASSET_PATH="/"，字体/资源从站点根 /fonts 加载（离线自托管）
// - optimizeDeps target es2022：Excalidraw 0.18 需要
// - assetsInlineLimit 0：字体文件不内联，保持独立以便离线拷贝
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@agent-core": coreTarget,
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
