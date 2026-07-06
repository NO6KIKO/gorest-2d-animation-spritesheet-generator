export type SpritePaletteSwatch = {
  id: string;
  key: string;
  name: string;
  sourceHex: string;
  targetHex: string;
  count: number;
  isNeutral: boolean;
  hsl: HslColor;
};

export type SpritePaletteChange = {
  id: string;
  from: string;
  to: string;
  name: string;
};

export type SpritePaletteAnalysis = {
  sourceUrl: string;
  width: number;
  height: number;
  imageData: ImageData;
  swatches: SpritePaletteSwatch[];
  pixelGroups: Int16Array;
  opaquePixelCount: number;
};

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

type HslColor = {
  h: number;
  s: number;
  l: number;
};

type PaletteBucket = {
  key: string;
  count: number;
  r: number;
  g: number;
  b: number;
  isNeutral: boolean;
  label: string;
};

const MIN_ALPHA = 24;
const HUE_BIN_SIZE = 24;
const DEFAULT_MAX_SWATCHES = 12;

const HUE_LABELS = [
  "Red",
  "Orange",
  "Amber",
  "Yellow",
  "Lime",
  "Green",
  "Aqua",
  "Cyan",
  "Sky",
  "Blue",
  "Indigo",
  "Violet",
  "Purple",
  "Magenta",
  "Rose",
];

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampByte(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

function wrapHue(value: number) {
  return ((value % 360) + 360) % 360;
}

function shortestHueDelta(from: number, to: number) {
  return ((from - to + 540) % 360) - 180;
}

export function rgbToHex({ r, g, b }: RgbColor) {
  return `#${[r, g, b].map(channel => clampByte(channel).toString(16).padStart(2, "0")).join("")}`;
}

export function hexToRgb(hex: string): RgbColor | null {
  const normalized = hex.trim();
  const shorthand = normalized.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i);
  const full = normalized.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (shorthand) {
    return {
      r: parseInt(`${shorthand[1]}${shorthand[1]}`, 16),
      g: parseInt(`${shorthand[2]}${shorthand[2]}`, 16),
      b: parseInt(`${shorthand[3]}${shorthand[3]}`, 16),
    };
  }
  if (!full) return null;
  return {
    r: parseInt(full[1], 16),
    g: parseInt(full[2], 16),
    b: parseInt(full[3], 16),
  };
}

export function rgbToHsl({ r, g, b }: RgbColor): HslColor {
  const red = clampByte(r) / 255;
  const green = clampByte(g) / 255;
  const blue = clampByte(b) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (!delta) return { h: 0, s: 0, l: lightness };

  const saturation = lightness > 0.5
    ? delta / (2 - max - min)
    : delta / (max + min);
  let hue = 0;
  if (max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) * 60;
  else if (max === green) hue = ((blue - red) / delta + 2) * 60;
  else hue = ((red - green) / delta + 4) * 60;
  return { h: wrapHue(hue), s: saturation, l: lightness };
}

export function hslToRgb({ h, s, l }: HslColor): RgbColor {
  const hue = wrapHue(h) / 360;
  const saturation = clamp01(s);
  const lightness = clamp01(l);

  if (!saturation) {
    const value = clampByte(lightness * 255);
    return { r: value, g: value, b: value };
  }

  const hueToRgb = (p: number, q: number, t: number) => {
    let next = t;
    if (next < 0) next += 1;
    if (next > 1) next -= 1;
    if (next < 1 / 6) return p + (q - p) * 6 * next;
    if (next < 1 / 2) return q;
    if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
    return p;
  };

  const q = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  return {
    r: clampByte(hueToRgb(p, q, hue + 1 / 3) * 255),
    g: clampByte(hueToRgb(p, q, hue) * 255),
    b: clampByte(hueToRgb(p, q, hue - 1 / 3) * 255),
  };
}

function paletteKey(color: RgbColor) {
  const hsl = rgbToHsl(color);
  if (hsl.s < 0.12) {
    const tone = hsl.l < 0.18 ? "ink" : hsl.l < 0.42 ? "shadow" : hsl.l < 0.72 ? "mid" : "light";
    const label = tone === "ink" ? "Ink" : tone === "shadow" ? "Shadow" : tone === "mid" ? "Neutral" : "Light";
    return {
      key: `neutral:${tone}`,
      isNeutral: true,
      label,
    };
  }

  const hueBin = Math.floor(wrapHue(hsl.h + HUE_BIN_SIZE / 2) / HUE_BIN_SIZE) % HUE_LABELS.length;
  const saturation = hsl.s < 0.38 ? "soft" : "rich";
  return {
    key: `color:${hueBin}:${saturation}`,
    isNeutral: false,
    label: `${saturation === "soft" ? "Soft" : "Rich"} ${HUE_LABELS[hueBin]}`,
  };
}

function loadImage(sourceUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to read spritesheet pixels."));
    image.src = sourceUrl;
  });
}

function bucketScore(bucket: PaletteBucket) {
  const average = {
    r: bucket.r / bucket.count,
    g: bucket.g / bucket.count,
    b: bucket.b / bucket.count,
  };
  const hsl = rgbToHsl(average);
  const colorBoost = bucket.isNeutral ? 0.9 : 1.12 + hsl.s * 0.24;
  return bucket.count * colorBoost;
}

function makeSwatches(buckets: Map<string, PaletteBucket>, maxSwatches: number) {
  return Array.from(buckets.values())
    .filter(bucket => bucket.count >= 4)
    .sort((a, b) => bucketScore(b) - bucketScore(a))
    .slice(0, maxSwatches)
    .map((bucket, index): SpritePaletteSwatch => {
      const rgb = {
        r: bucket.r / bucket.count,
        g: bucket.g / bucket.count,
        b: bucket.b / bucket.count,
      };
      const sourceHex = rgbToHex(rgb);
      return {
        id: `swatch_${index + 1}`,
        key: bucket.key,
        name: bucket.label,
        sourceHex,
        targetHex: sourceHex,
        count: bucket.count,
        isNeutral: bucket.isNeutral,
        hsl: rgbToHsl(rgb),
      };
    });
}

export async function analyzeSpritesheetPalette(sourceUrl: string, maxSwatches = DEFAULT_MAX_SWATCHES): Promise<SpritePaletteAnalysis> {
  const image = await loadImage(sourceUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) throw new Error("Spritesheet image has no readable size.");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Unable to analyze spritesheet colors.");
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const buckets = new Map<string, PaletteBucket>();
  let opaquePixelCount = 0;

  for (let offset = 0; offset < imageData.data.length; offset += 4) {
    if (imageData.data[offset + 3] < MIN_ALPHA) continue;
    opaquePixelCount += 1;
    const color = {
      r: imageData.data[offset],
      g: imageData.data[offset + 1],
      b: imageData.data[offset + 2],
    };
    const group = paletteKey(color);
    const bucket = buckets.get(group.key) || {
      key: group.key,
      count: 0,
      r: 0,
      g: 0,
      b: 0,
      isNeutral: group.isNeutral,
      label: group.label,
    };
    bucket.count += 1;
    bucket.r += color.r;
    bucket.g += color.g;
    bucket.b += color.b;
    buckets.set(group.key, bucket);
  }

  const swatches = makeSwatches(buckets, maxSwatches);
  const keyToGroup = new Map(swatches.map((swatch, index) => [swatch.key, index]));
  const pixelGroups = new Int16Array(width * height);
  pixelGroups.fill(-1);

  for (let offset = 0, pixelIndex = 0; offset < imageData.data.length; offset += 4, pixelIndex += 1) {
    if (imageData.data[offset + 3] < MIN_ALPHA) continue;
    const key = paletteKey({
      r: imageData.data[offset],
      g: imageData.data[offset + 1],
      b: imageData.data[offset + 2],
    }).key;
    const groupIndex = keyToGroup.get(key);
    if (typeof groupIndex === "number") pixelGroups[pixelIndex] = groupIndex;
  }

  return {
    sourceUrl,
    width,
    height,
    imageData,
    swatches,
    pixelGroups,
    opaquePixelCount,
  };
}

export function getPaletteChanges(swatches: SpritePaletteSwatch[]): SpritePaletteChange[] {
  return swatches
    .filter(swatch => swatch.targetHex.toLowerCase() !== swatch.sourceHex.toLowerCase())
    .map(swatch => ({
      id: swatch.id,
      from: swatch.sourceHex,
      to: swatch.targetHex,
      name: swatch.name,
    }));
}

export function recolorSpritesheet(analysis: SpritePaletteAnalysis, swatches: SpritePaletteSwatch[]) {
  const output = new ImageData(new Uint8ClampedArray(analysis.imageData.data), analysis.width, analysis.height);
  const swatchTargets = swatches.map(swatch => {
    const targetRgb = hexToRgb(swatch.targetHex) || hexToRgb(swatch.sourceHex);
    const targetHsl = targetRgb ? rgbToHsl(targetRgb) : swatch.hsl;
    return {
      swatch,
      changed: swatch.targetHex.toLowerCase() !== swatch.sourceHex.toLowerCase(),
      targetHsl,
    };
  });

  for (let offset = 0, pixelIndex = 0; offset < output.data.length; offset += 4, pixelIndex += 1) {
    const groupIndex = analysis.pixelGroups[pixelIndex];
    if (groupIndex < 0) continue;
    const target = swatchTargets[groupIndex];
    if (!target?.changed) continue;

    const sourceHsl = rgbToHsl({
      r: analysis.imageData.data[offset],
      g: analysis.imageData.data[offset + 1],
      b: analysis.imageData.data[offset + 2],
    });
    const swatch = target.swatch;
    const hueDrift = swatch.isNeutral ? 0 : shortestHueDelta(sourceHsl.h, swatch.hsl.h) * 0.25;
    const saturationRatio = target.targetHsl.s / Math.max(0.08, swatch.hsl.s);
    const nextHsl = {
      h: wrapHue(target.targetHsl.h + hueDrift),
      s: swatch.isNeutral
        ? target.targetHsl.s
        : clamp01(sourceHsl.s * saturationRatio),
      l: clamp01(target.targetHsl.l + (sourceHsl.l - swatch.hsl.l) * 0.9),
    };
    const rgb = hslToRgb(nextHsl);
    output.data[offset] = rgb.r;
    output.data[offset + 1] = rgb.g;
    output.data[offset + 2] = rgb.b;
  }

  const canvas = document.createElement("canvas");
  canvas.width = analysis.width;
  canvas.height = analysis.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to render recolored spritesheet.");
  ctx.putImageData(output, 0, 0);
  return canvas.toDataURL("image/png");
}

export function updateSwatchFromHsl(swatch: SpritePaletteSwatch, patch: Partial<HslColor>) {
  const rgb = hexToRgb(swatch.targetHex) || hexToRgb(swatch.sourceHex);
  const current = rgb ? rgbToHsl(rgb) : swatch.hsl;
  return {
    ...swatch,
    targetHex: rgbToHex(hslToRgb({ ...current, ...patch })),
  };
}
