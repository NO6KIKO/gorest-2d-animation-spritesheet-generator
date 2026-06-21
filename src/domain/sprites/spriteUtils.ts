import type { CSSProperties } from "react";
import type { AnimationSprite } from "../../types";

export function getFrameSize(sprite: AnimationSprite): [number, number] {
  const [frameW, frameH] = sprite.frameSize || [];
  if (Number.isFinite(frameW) && Number.isFinite(frameH) && frameW > 0 && frameH > 0) {
    return [frameW, frameH];
  }
  const cell = sprite.cellSize || 256;
  return [cell, cell];
}

export function spriteFrame(sprite: AnimationSprite, frameIndex: number) {
  const frames = sprite.frames || [];
  return frames[frameIndex % Math.max(1, frames.length)] || frames[0] || "";
}

export function spriteFrameTotal(sprite?: AnimationSprite) {
  return sprite?.frames.length || sprite?.frameCount || 0;
}

export function spriteGridColumns(sprite?: AnimationSprite) {
  if (!sprite) return 1;
  if (sprite.gridColumns && sprite.gridColumns > 0) return Math.round(sprite.gridColumns);
  const [frameWidth] = getFrameSize(sprite);
  const sheetWidth = sprite.sheetSize?.[0] || frameWidth;
  return Math.max(1, Math.round(sheetWidth / Math.max(1, frameWidth)));
}

export function spriteGridRows(sprite?: AnimationSprite) {
  return Math.max(1, Math.ceil(Math.max(1, spriteFrameTotal(sprite)) / spriteGridColumns(sprite)));
}

export function cssImageUrl(url: string) {
  return `url("${url.replace(/["\\]/g, "\\$&")}")`;
}

export function spritesheetFrameThumbStyle(sprite: AnimationSprite, frameIndex: number): CSSProperties | undefined {
  const source = sprite.rawSpritesheetPng || sprite.spritesheetPng;
  if (!source) return undefined;
  const columns = spriteGridColumns(sprite);
  const rows = spriteGridRows(sprite);
  const column = frameIndex % columns;
  const row = Math.floor(frameIndex / columns);
  const x = columns <= 1 ? 0 : (column / (columns - 1)) * 100;
  const y = rows <= 1 ? 0 : (row / (rows - 1)) * 100;
  return {
    backgroundImage: cssImageUrl(source),
    backgroundPosition: `${x}% ${y}%`,
    backgroundSize: `${columns * 100}% ${rows * 100}%`,
  };
}

export function buildSpritesheetFrames(
  dataUrl: string,
  sheetWidth: number,
  sheetHeight: number,
  frameWidth: number,
  frameHeight: number,
  frameCount: number,
  columns: number
) {
  return Array.from({ length: frameCount }, (_, index) => {
    const x = (index % columns) * frameWidth;
    const y = Math.floor(index / columns) * frameHeight;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${frameWidth}" height="${frameHeight}" viewBox="${x} ${y} ${frameWidth} ${frameHeight}" overflow="hidden"><image href="${dataUrl}" x="0" y="0" width="${sheetWidth}" height="${sheetHeight}" preserveAspectRatio="none"/></svg>`;
  });
}
