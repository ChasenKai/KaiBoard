// 演示型导出：PPTX。
//
// 定位（对标 Excalidraw+ 的「导出为演示文稿」）：KaiBoard 不做云端渲染服务，
// 全部在浏览器本地完成 —— 画板 → PNG（@excalidraw/excalidraw 的 exportToBlob）
// → PPTX（pptxgenjs，动态 import 独立 chunk）。
//
// 本地优先红线：不联网、不上传、不需要账号。
//
// 双路发布：本模块与 AI 无关，属于 Layer1 基础能力，基础版同样包含。

import type { BoardData } from "./db";

export interface ExportItem {
  name: string;
  board: BoardData;
}

interface Rendered {
  name: string;
  dataUrl: string;
  w: number;
  h: number;
}

/** 单个画板 → PNG data URL（含宽高）。空画板返回 null。 */
async function renderBoard(item: ExportItem, maxWidthOrHeight: number): Promise<Rendered | null> {
  const els = Array.isArray(item.board?.elements) ? item.board.elements : [];
  const live = els.filter((e: any) => e && !e.isDeleted);
  if (!live.length) return null;
  const { exportToBlob } = await import("@excalidraw/excalidraw");
  const blob = await exportToBlob({
    elements: live as any,
    files: (item.board.files as any) || null,
    appState: {
      ...(item.board.appState || {}),
      // 暗水印（不可见）：导出的 PNG 会内嵌场景元数据(tEXt)，携带 source 标记，
      // 与 .excalidraw 原文件格式的 source 字段一致，属品牌推广、防君子不防小人。
      source: "KaiBoard",
      exportBackground: true,
      exportWithDarkMode: false,
      exportScale: 2,
    } as any,
    mimeType: "image/png",
    maxWidthOrHeight,
  });
  const dataUrl = await blobToDataUrl(blob);
  const { w, h } = await imageSize(dataUrl);
  return { name: item.name, dataUrl, w, h };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("read blob failed"));
    fr.readAsDataURL(blob);
  });
}

function imageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = dataUrl;
  });
}

/**
 * 导出为 PPTX：一板一页（16:9），图片居中等比缩放。
 * pptxgenjs 走动态 import → 只在用户真的点导出时才加载这段 chunk。
 * @returns 实际生成的页数
 */
export async function exportBoardsToPptx(
  items: ExportItem[],
  opts?: { fileName?: string; withTitles?: boolean }
): Promise<number> {
  const pages: Rendered[] = [];
  for (const it of items) {
    const r = await renderBoard(it, 1920);
    if (r) pages.push(r);
  }
  if (!pages.length) return 0;

  const mod: any = await import("pptxgenjs");
  const PptxGen = mod.default || mod;
  const pptx = new PptxGen();
  pptx.layout = "LAYOUT_16x9"; // 10 x 5.625 英寸
  pptx.title = opts?.fileName || "KaiBoard";

  const SLIDE_W = 10;
  const SLIDE_H = 5.625;
  const withTitles = opts?.withTitles !== false && pages.length > 1;
  const topPad = withTitles ? 0.62 : 0.25;
  const availW = SLIDE_W - 0.5;
  const availH = SLIDE_H - topPad - 0.25;

  for (const p of pages) {
    const slide = pptx.addSlide();
    if (withTitles) {
      slide.addText(p.name, {
        x: 0.25,
        y: 0.18,
        w: SLIDE_W - 0.5,
        h: 0.36,
        fontSize: 16,
        bold: true,
        color: "333333",
      });
    }
    const ratio = Math.min(availW / p.w, availH / p.h);
    const w = p.w * ratio;
    const h = p.h * ratio;
    slide.addImage({
      data: p.dataUrl,
      x: (SLIDE_W - w) / 2,
      y: topPad + (availH - h) / 2,
      w,
      h,
    });
  }

  const safe = (opts?.fileName || "KaiBoard").replace(/[\\/:*?"<>|]/g, "_");
  await pptx.writeFile({ fileName: `${safe}.pptx` });
  return pages.length;
}
