import { loadImageSize, readFileAsDataUrl } from "../../../app/fileInput";
import { saveGeneratedImage } from "../../../services/generatedAssetsApi";
import type { GameStartUiLayer, GameStartUiSettings } from "../../../types";
import { safeStartUiFilenamePart, startUiImageExtension } from "./startUiAssetNaming";
import { detectStartUiAutoSplitRegions } from "./startUiRegionDetection";
import {
  startUiRegionToLayer,
  type AutoSplitRegion,
} from "./startUiLayerModel";

export type StartUiSplitResult = {
  layers: GameStartUiLayer[];
  detectedRegionCount: number;
  usedSmartDetection: boolean;
};

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read Start UI artwork."));
    image.src = src;
  });
}

async function saveCanvasPng(canvas: HTMLCanvasElement, name: string) {
  const file = await saveGeneratedImage(canvas.toDataURL("image/png"), `${name}.png`, "Failed to save Start UI layer image");
  return file.url;
}

function expandedRegion(region: AutoSplitRegion, width: number, height: number) {
  const padX = Math.round(Math.max(10, region.width * 0.035, width * 0.006));
  const padY = Math.round(Math.max(8, region.height * 0.06, height * 0.006));
  const x = Math.max(0, region.x - padX);
  const y = Math.max(0, region.y - padY);
  const right = Math.min(width, region.x + region.width + padX);
  const bottom = Math.min(height, region.y + region.height + padY);
  return { x, y, width: right - x, height: bottom - y };
}

function healBackgroundRegion(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  region: AutoSplitRegion,
  settings: GameStartUiSettings,
  width: number,
  height: number,
) {
  const mask = expandedRegion(region, width, height);
  const blur = Math.round(Math.max(18, Math.min(44, Math.max(mask.width, mask.height) * 0.08)));
  const offsetX = Math.max(16, Math.round(region.width * 0.5));
  const offsetY = Math.max(14, Math.round(region.height * 0.5));
  const offsets = [
    { x: -offsetX, y: 0, opacity: 0.24 },
    { x: offsetX, y: 0, opacity: 0.24 },
    { x: 0, y: -offsetY, opacity: 0.2 },
    { x: 0, y: offsetY, opacity: 0.2 },
    { x: -offsetX, y: -offsetY, opacity: 0.12 },
    { x: offsetX, y: offsetY, opacity: 0.12 },
  ];

  context.save();
  context.beginPath();
  context.rect(mask.x, mask.y, mask.width, mask.height);
  context.clip();
  context.filter = `blur(${blur}px)`;
  context.drawImage(image, -blur, -blur, width + blur * 2, height + blur * 2);
  offsets.forEach(offset => {
    context.globalAlpha = offset.opacity;
    context.drawImage(image, offset.x, offset.y, width, height);
  });
  context.filter = "none";
  context.globalAlpha = 1;
  context.fillStyle = settings.theme === "light" ? "rgba(248, 250, 252, .28)" : "rgba(5, 8, 14, .38)";
  context.fillRect(mask.x, mask.y, mask.width, mask.height);
  context.restore();
}

export async function uploadStartUiImage(file: File, prefix: string) {
  const dataUrl = await readFileAsDataUrl(file, "Could not read the Start UI image.");
  const [width, height] = await loadImageSize(dataUrl, "Could not read the Start UI image size.");
  const saved = await saveGeneratedImage(
    dataUrl,
    `start_ui_${prefix}_${Date.now()}_${safeStartUiFilenamePart(file.name)}.${startUiImageExtension(file)}`,
    "Failed to save Start UI image",
  );
  return { url: saved.url, width, height };
}

export async function generateSplitLayersFromStartUiArtwork(
  sourceUrl: string,
  settings: GameStartUiSettings,
  designWidth: number,
  designHeight: number,
): Promise<StartUiSplitResult> {
  const image = await loadCanvasImage(sourceUrl);
  const width = Math.max(1, Math.round(designWidth));
  const height = Math.max(1, Math.round(designHeight));
  const naturalWidth = Math.max(1, image.naturalWidth || image.width || width);
  const naturalHeight = Math.max(1, image.naturalHeight || image.height || height);
  const scaleX = naturalWidth / width;
  const scaleY = naturalHeight / height;
  const split = detectStartUiAutoSplitRegions(image, settings, width, height);
  const regions = split.regions;
  const timestamp = Date.now();

  const backgroundCanvas = document.createElement("canvas");
  backgroundCanvas.width = width;
  backgroundCanvas.height = height;
  const backgroundContext = backgroundCanvas.getContext("2d");
  if (!backgroundContext) throw new Error("Could not create Start UI canvas.");
  backgroundContext.drawImage(image, 0, 0, width, height);

  regions
    .filter(region => region.kind !== "background")
    .forEach(region => healBackgroundRegion(backgroundContext, image, region, settings, width, height));

  const backgroundUrl = await saveCanvasPng(backgroundCanvas, `start_ui_autosplit_background_${timestamp}`);
  const layers: GameStartUiLayer[] = [startUiRegionToLayer(regions[0], backgroundUrl, false)];

  for (const region of regions.slice(1)) {
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = Math.max(1, region.width);
    cropCanvas.height = Math.max(1, region.height);
    const cropContext = cropCanvas.getContext("2d");
    if (!cropContext) continue;
    cropContext.drawImage(
      image,
      region.x * scaleX,
      region.y * scaleY,
      region.width * scaleX,
      region.height * scaleY,
      0,
      0,
      region.width,
      region.height,
    );
    const imageUrl = await saveCanvasPng(cropCanvas, `start_ui_autosplit_${region.suffix}_${timestamp}`);
    layers.push({
      ...startUiRegionToLayer(region, imageUrl, false),
      imageUrl,
    });
  }

  return {
    layers,
    detectedRegionCount: regions.filter(region => region.detected).length,
    usedSmartDetection: split.usedSmartDetection,
  };
}
