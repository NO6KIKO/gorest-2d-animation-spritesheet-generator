import type { AnimationSprite } from "../../types";
import { getFrameSize } from "./spriteUtils";

function blobUrlFromSvg(svg: string) {
  return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
}

export async function drawSvgFrame(ctx: CanvasRenderingContext2D, svg: string, x: number, y: number, w: number, h: number) {
  const imgMatch = svg.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1]) {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to render PNG frame"));
      image.src = imgMatch[1];
    });
    ctx.drawImage(img, x, y, w, h);
    return;
  }
  const url = blobUrlFromSvg(svg);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to render SVG frame"));
      image.src = url;
    });
    ctx.drawImage(img, x, y, w, h);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function compileSpritesheetImage(sprite: AnimationSprite, sheetColumns: number) {
  if (!sprite.frames.length) return null;
  const [frameW, frameH] = getFrameSize(sprite);
  const columns = Math.min(sheetColumns, sprite.frames.length);
  const rows = Math.ceil(sprite.frames.length / columns);
  const canvas = document.createElement("canvas");
  canvas.width = columns * frameW;
  canvas.height = rows * frameH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to create export canvas");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < sprite.frames.length; i++) {
    await drawSvgFrame(ctx, sprite.frames[i], (i % columns) * frameW, Math.floor(i / columns) * frameH, frameW, frameH);
  }
  return canvas.toDataURL("image/png");
}
