import type { GameStartUiSettings, StartUiLayerKind } from "../../../types";
import type { AutoSplitRegion } from "./startUiLayerModel";
import { startUiAutoSplitRegions } from "./startUiLayerModel";

type DetectionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  density: number;
};

type CellComponent = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cells: number;
};

const ANALYSIS_MAX_WIDTH = 960;
const ANALYSIS_MAX_HEIGHT = 640;
const CELL_SIZE = 8;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function percentile(values: number[], target: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp(Math.round((sorted.length - 1) * target), 0, sorted.length - 1);
  return sorted[index];
}

function boxesOverlap(a: DetectionBox, b: DetectionBox) {
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return x * y;
}

function mergeBox(a: DetectionBox, b: DetectionBox): DetectionBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
    score: Math.max(a.score, b.score) + Math.min(a.score, b.score) * 0.35,
    density: Math.max(a.density, b.density),
  };
}

function shouldMergeBoxes(a: DetectionBox, b: DetectionBox, designWidth: number, designHeight: number) {
  const overlapArea = boxesOverlap(a, b);
  const smallerArea = Math.min(a.width * a.height, b.width * b.height);
  if (overlapArea > smallerArea * 0.18) return true;

  const aCenterX = a.x + a.width / 2;
  const bCenterX = b.x + b.width / 2;
  const aCenterY = a.y + a.height / 2;
  const bCenterY = b.y + b.height / 2;
  const verticalOverlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  const horizontalGap = Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width);
  const verticalGap = Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height);

  if (verticalOverlap > Math.min(a.height, b.height) * 0.18 && horizontalGap < designWidth * 0.055) {
    return true;
  }

  const sameTitleCluster =
    Math.abs(aCenterY - bCenterY) < designHeight * 0.13 &&
    Math.abs(aCenterX - bCenterX) < designWidth * 0.42 &&
    horizontalGap < designWidth * 0.12 &&
    a.y < designHeight * 0.48 &&
    b.y < designHeight * 0.48;
  if (sameTitleCluster) return true;

  return verticalGap < designHeight * 0.018 && Math.abs(aCenterX - bCenterX) < designWidth * 0.08;
}

function mergeNearbyBoxes(boxes: DetectionBox[], designWidth: number, designHeight: number) {
  const merged = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < merged.length; i += 1) {
      for (let j = i + 1; j < merged.length; j += 1) {
        if (!shouldMergeBoxes(merged[i], merged[j], designWidth, designHeight)) continue;
        merged[i] = mergeBox(merged[i], merged[j]);
        merged.splice(j, 1);
        changed = true;
        break;
      }
      if (changed) break;
    }
  }
  return merged;
}

function componentToBox(
  component: CellComponent,
  cellScores: Float32Array,
  gridWidth: number,
  gridHeight: number,
  analysisWidth: number,
  analysisHeight: number,
  designWidth: number,
  designHeight: number,
): DetectionBox | null {
  const x0 = component.minX * CELL_SIZE;
  const y0 = component.minY * CELL_SIZE;
  const x1 = Math.min(analysisWidth, (component.maxX + 1) * CELL_SIZE);
  const y1 = Math.min(analysisHeight, (component.maxY + 1) * CELL_SIZE);
  const scaleX = designWidth / analysisWidth;
  const scaleY = designHeight / analysisHeight;
  const paddingX = designWidth * 0.012;
  const paddingY = designHeight * 0.014;
  const x = clamp(Math.round(x0 * scaleX - paddingX), 0, designWidth - 1);
  const y = clamp(Math.round(y0 * scaleY - paddingY), 0, designHeight - 1);
  const right = clamp(Math.round(x1 * scaleX + paddingX), x + 1, designWidth);
  const bottom = clamp(Math.round(y1 * scaleY + paddingY), y + 1, designHeight);
  const width = right - x;
  const height = bottom - y;
  const imageArea = designWidth * designHeight;
  const area = width * height;
  const aspect = width / Math.max(1, height);

  if (width < designWidth * 0.1 || height < designHeight * 0.035) return null;
  if (width > designWidth * 0.92 && height > designHeight * 0.42) return null;
  if (area < imageArea * 0.004 || area > imageArea * 0.32) return null;
  if (aspect < 1.1 || aspect > 12) return null;

  let scoreSum = 0;
  let cells = 0;
  for (let yCell = component.minY; yCell <= component.maxY; yCell += 1) {
    for (let xCell = component.minX; xCell <= component.maxX; xCell += 1) {
      if (xCell < 0 || yCell < 0 || xCell >= gridWidth || yCell >= gridHeight) continue;
      scoreSum += cellScores[yCell * gridWidth + xCell];
      cells += 1;
    }
  }

  const centerX = x + width / 2;
  const centrality = 1 - Math.min(1, Math.abs(centerX - designWidth / 2) / (designWidth / 2));
  const density = component.cells / Math.max(1, cells);
  const sizeScore = Math.sqrt(area / imageArea);
  const horizontalUiBonus = aspect > 2 ? 0.16 : 0;
  const topTitleBonus = y < designHeight * 0.45 && height > designHeight * 0.09 ? 0.12 : 0;
  const score = scoreSum / Math.max(1, cells) + density * 0.45 + centrality * 0.18 + sizeScore + horizontalUiBonus + topTitleBonus;

  return { x, y, width, height, score, density };
}

function findComponents(mask: Uint8Array, gridWidth: number, gridHeight: number) {
  const visited = new Uint8Array(mask.length);
  const components: CellComponent[] = [];
  const queue: number[] = [];

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;

    visited[start] = 1;
    queue.length = 0;
    queue.push(start);
    let minX = gridWidth;
    let minY = gridHeight;
    let maxX = 0;
    let maxY = 0;
    let cells = 0;

    for (let index = 0; index < queue.length; index += 1) {
      const cellIndex = queue[index];
      const x = cellIndex % gridWidth;
      const y = Math.floor(cellIndex / gridWidth);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      cells += 1;

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue;
          const neighborIndex = ny * gridWidth + nx;
          if (!mask[neighborIndex] || visited[neighborIndex]) continue;
          visited[neighborIndex] = 1;
          queue.push(neighborIndex);
        }
      }
    }

    if (cells >= 4) components.push({ minX, minY, maxX, maxY, cells });
  }

  return components;
}

function dilateMask(mask: Uint8Array, gridWidth: number, gridHeight: number) {
  const dilated = new Uint8Array(mask.length);
  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const index = y * gridWidth + x;
      if (!mask[index]) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue;
          dilated[ny * gridWidth + nx] = 1;
        }
      }
    }
  }
  return dilated;
}

function getMenuItems(settings: GameStartUiSettings) {
  return [
    { suffix: "new_game", label: settings.primaryActionLabel || "New Game" },
    settings.showContinue ? { suffix: "continue", label: settings.continueActionLabel || "Continue" } : null,
    settings.showLoadGame ? { suffix: "load_game", label: settings.loadActionLabel || "Load Game" } : null,
    settings.showSettings ? { suffix: "settings", label: settings.settingsActionLabel || "Settings" } : null,
    settings.showQuit ? { suffix: "quit", label: settings.quitActionLabel || "Quit" } : null,
  ].filter(Boolean) as Array<{ suffix: string; label: string }>;
}

function pickMenuBoxes(boxes: DetectionBox[], designWidth: number, designHeight: number) {
  const menuCandidates = boxes
    .filter(box => {
      const aspect = box.width / Math.max(1, box.height);
      return (
        aspect >= 2 &&
        box.width >= designWidth * 0.16 &&
        box.width <= designWidth * 0.78 &&
        box.height >= designHeight * 0.045 &&
        box.height <= designHeight * 0.18
      );
    })
    .sort((a, b) => a.y - b.y);

  if (menuCandidates.length <= 1) return menuCandidates;

  const groups: DetectionBox[][] = [];
  menuCandidates.forEach(candidate => {
    const centerX = candidate.x + candidate.width / 2;
    const group = groups.find(items => {
      const sample = items[0];
      const sampleCenterX = sample.x + sample.width / 2;
      const widthRatio = Math.min(sample.width, candidate.width) / Math.max(sample.width, candidate.width);
      return Math.abs(sampleCenterX - centerX) < designWidth * 0.13 && widthRatio > 0.55;
    });
    if (group) group.push(candidate);
    else groups.push([candidate]);
  });

  const bestGroup = groups
    .map(group => {
      const sorted = [...group].sort((a, b) => a.y - b.y);
      let stackScore = 0;
      for (let index = 1; index < sorted.length; index += 1) {
        const previous = sorted[index - 1];
        const gap = sorted[index].y - (previous.y + previous.height);
        if (gap >= 0 && gap <= designHeight * 0.18) stackScore += 1;
      }
      const score = sorted.reduce((sum, item) => sum + item.score, 0) + stackScore * 0.8 + sorted.length * 0.35;
      return { group: sorted, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.group || [];

  return bestGroup.slice(0, 6);
}

function pickTitleBox(boxes: DetectionBox[], menuBoxes: DetectionBox[], designHeight: number) {
  const menuTop = menuBoxes.length ? Math.min(...menuBoxes.map(box => box.y)) : designHeight * 0.62;
  return boxes
    .filter(box => {
      const overlapsMenu = menuBoxes.some(menu => boxesOverlap(box, menu) > Math.min(box.width * box.height, menu.width * menu.height) * 0.15);
      const centerY = box.y + box.height / 2;
      return !overlapsMenu && box.y < menuTop && centerY < designHeight * 0.55 && box.height >= designHeight * 0.055;
    })
    .sort((a, b) => b.score - a.score)[0];
}

function boxToRegion(
  box: DetectionBox,
  suffix: string,
  name: string,
  kind: StartUiLayerKind,
  zIndex: number,
  label?: string,
): AutoSplitRegion {
  return {
    suffix,
    name,
    kind,
    label,
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
    zIndex,
    detected: true,
    score: box.score,
  };
}

function buildDetectedRegions(
  boxes: DetectionBox[],
  settings: GameStartUiSettings,
  designWidth: number,
  designHeight: number,
): AutoSplitRegion[] {
  const menuBoxes = pickMenuBoxes(boxes, designWidth, designHeight);
  const titleBox = pickTitleBox(boxes, menuBoxes, designHeight);
  const menuItems = getMenuItems(settings);
  const detectedRegions: AutoSplitRegion[] = [];

  if (titleBox) {
    detectedRegions.push(boxToRegion(titleBox, "logo", "Logo / Title", "title", 10, settings.title || "Title"));
  }

  menuBoxes
    .sort((a, b) => a.y - b.y)
    .forEach((box, index) => {
      const menuItem = menuItems[index] || { suffix: `button_${index + 1}`, label: `Button ${index + 1}` };
      detectedRegions.push(boxToRegion(box, menuItem.suffix, menuItem.label, "menu", 20 + index * 10, menuItem.label));
    });

  return detectedRegions;
}

function detectBoxesFromImage(image: HTMLImageElement, designWidth: number, designHeight: number) {
  const naturalWidth = Math.max(1, image.naturalWidth || image.width || designWidth);
  const naturalHeight = Math.max(1, image.naturalHeight || image.height || designHeight);
  const scale = Math.min(1, ANALYSIS_MAX_WIDTH / naturalWidth, ANALYSIS_MAX_HEIGHT / naturalHeight);
  const analysisWidth = Math.max(64, Math.round(naturalWidth * scale));
  const analysisHeight = Math.max(64, Math.round(naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = analysisWidth;
  canvas.height = analysisHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];

  context.drawImage(image, 0, 0, analysisWidth, analysisHeight);
  const pixels = context.getImageData(0, 0, analysisWidth, analysisHeight).data;
  const luma = new Float32Array(analysisWidth * analysisHeight);
  const edges = new Float32Array(analysisWidth * analysisHeight);
  const edgeSamples: number[] = [];

  for (let index = 0, pixel = 0; index < luma.length; index += 1, pixel += 4) {
    const alpha = pixels[pixel + 3] / 255;
    luma[index] = (pixels[pixel] * 0.2126 + pixels[pixel + 1] * 0.7152 + pixels[pixel + 2] * 0.0722) * alpha;
  }

  for (let y = 1; y < analysisHeight - 1; y += 1) {
    for (let x = 1; x < analysisWidth - 1; x += 1) {
      const index = y * analysisWidth + x;
      const horizontal = Math.abs(luma[index + 1] - luma[index - 1]);
      const vertical = Math.abs(luma[index + analysisWidth] - luma[index - analysisWidth]);
      const edge = horizontal + vertical;
      edges[index] = edge;
      if ((x + y) % 3 === 0) edgeSamples.push(edge);
    }
  }

  const threshold = Math.max(18, percentile(edgeSamples, 0.84));
  const gridWidth = Math.ceil(analysisWidth / CELL_SIZE);
  const gridHeight = Math.ceil(analysisHeight / CELL_SIZE);
  const cellScores = new Float32Array(gridWidth * gridHeight);
  const cellStrongCounts = new Uint16Array(gridWidth * gridHeight);
  const cellPixelCounts = new Uint16Array(gridWidth * gridHeight);

  for (let y = 1; y < analysisHeight - 1; y += 1) {
    const cellY = Math.floor(y / CELL_SIZE);
    for (let x = 1; x < analysisWidth - 1; x += 1) {
      const cellX = Math.floor(x / CELL_SIZE);
      const cellIndex = cellY * gridWidth + cellX;
      const edge = edges[y * analysisWidth + x];
      cellScores[cellIndex] += Math.min(1.5, edge / Math.max(1, threshold));
      cellPixelCounts[cellIndex] += 1;
      if (edge >= threshold) cellStrongCounts[cellIndex] += 1;
    }
  }

  const mask = new Uint8Array(gridWidth * gridHeight);
  for (let index = 0; index < mask.length; index += 1) {
    const pixelsInCell = Math.max(1, cellPixelCounts[index]);
    cellScores[index] /= pixelsInCell;
    const strongRatio = cellStrongCounts[index] / pixelsInCell;
    if (strongRatio > 0.055 || cellScores[index] > 0.3) {
      mask[index] = 1;
    }
  }

  const components = findComponents(dilateMask(mask, gridWidth, gridHeight), gridWidth, gridHeight);
  const boxes = components
    .map(component => componentToBox(component, cellScores, gridWidth, gridHeight, analysisWidth, analysisHeight, designWidth, designHeight))
    .filter(Boolean) as DetectionBox[];

  return mergeNearbyBoxes(boxes, designWidth, designHeight)
    .filter(box => box.score > 0.55)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

export function detectStartUiAutoSplitRegions(
  image: HTMLImageElement,
  settings: GameStartUiSettings,
  designWidth: number,
  designHeight: number,
) {
  const background = startUiAutoSplitRegions(settings, designWidth, designHeight)[0];
  const detectedRegions = buildDetectedRegions(detectBoxesFromImage(image, designWidth, designHeight), settings, designWidth, designHeight);
  const menuCount = detectedRegions.filter(region => region.kind === "menu").length;

  if (menuCount >= 1 || detectedRegions.length >= 2) {
    return {
      regions: [background, ...detectedRegions],
      usedSmartDetection: true,
    };
  }

  return {
    regions: startUiAutoSplitRegions(settings, designWidth, designHeight),
    usedSmartDetection: false,
  };
}
