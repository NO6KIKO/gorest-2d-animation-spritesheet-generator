import { loadImageSize, readFileAsDataUrl } from "../../../app/fileInput";
import { saveGeneratedImage } from "../../../services/generatedAssetsApi";
import type { GameStartUiLayer, GameStartUiSettings } from "../../../types";
import {
  safeStartUiFilenamePart,
  startUiAutoSplitRegions,
  startUiImageExtension,
  startUiRegionToLayer,
} from "./startUiLayerModel";

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
) {
  const image = await loadCanvasImage(sourceUrl);
  const width = Math.max(1, Math.round(designWidth));
  const height = Math.max(1, Math.round(designHeight));
  const naturalWidth = Math.max(1, image.naturalWidth || image.width || width);
  const naturalHeight = Math.max(1, image.naturalHeight || image.height || height);
  const scaleX = naturalWidth / width;
  const scaleY = naturalHeight / height;
  const regions = startUiAutoSplitRegions(settings, width, height);
  const timestamp = Date.now();

  const backgroundCanvas = document.createElement("canvas");
  backgroundCanvas.width = width;
  backgroundCanvas.height = height;
  const backgroundContext = backgroundCanvas.getContext("2d");
  if (!backgroundContext) throw new Error("Could not create Start UI canvas.");
  backgroundContext.drawImage(image, 0, 0, width, height);

  regions.filter(region => region.kind !== "background").forEach(region => {
    backgroundContext.save();
    backgroundContext.beginPath();
    backgroundContext.rect(region.x, region.y, region.width, region.height);
    backgroundContext.clip();
    backgroundContext.filter = "blur(22px)";
    backgroundContext.drawImage(image, -32, -32, width + 64, height + 64);
    backgroundContext.filter = "none";
    backgroundContext.fillStyle = settings.theme === "light" ? "rgba(248, 250, 252, .34)" : "rgba(5, 8, 14, .34)";
    backgroundContext.fillRect(region.x, region.y, region.width, region.height);
    backgroundContext.restore();
  });

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

  return layers;
}
