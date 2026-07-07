import type { GameStartUiLayer, GameStartUiSettings, StartUiLayerKind } from "../../../types";

export type AutoSplitRegion = {
  suffix: string;
  name: string;
  kind: StartUiLayerKind;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  locked?: boolean;
};

export type UploadedStartUiImage = {
  url: string;
  width: number;
  height: number;
};

export function clampStartUiValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function toggleLabel(value: boolean) {
  return value ? "On" : "Off";
}

export function safeStartUiFilenamePart(value: string) {
  const cleaned = value
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return cleaned.slice(0, 46) || "artwork";
}

export function startUiImageExtension(file: File) {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  return "png";
}

export function makeStartUiLayerId(prefix: string) {
  return `start_ui_layer_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function menuRegions(settings: GameStartUiSettings, designWidth: number, designHeight: number) {
  const menuItems = [
    { suffix: "new_game", label: settings.primaryActionLabel || "New Game" },
    settings.showContinue ? { suffix: "continue", label: settings.continueActionLabel || "Continue" } : null,
    settings.showLoadGame ? { suffix: "load_game", label: settings.loadActionLabel || "Load Game" } : null,
    settings.showSettings ? { suffix: "settings", label: settings.settingsActionLabel || "Settings" } : null,
    settings.showQuit ? { suffix: "quit", label: settings.quitActionLabel || "Quit" } : null,
  ].filter(Boolean) as Array<{ suffix: string; label: string }>;

  const buttonWidth = Math.round(designWidth * 0.36);
  const buttonHeight = Math.round(designHeight * 0.105);
  const gap = Math.round(designHeight * 0.035);
  const totalHeight = menuItems.length * buttonHeight + Math.max(0, menuItems.length - 1) * gap;
  const startY = Math.round(designHeight * 0.53 - totalHeight * 0.5);
  const x = Math.round((designWidth - buttonWidth) * 0.5);

  return menuItems.map((item, index) => ({
    suffix: item.suffix,
    name: item.label,
    kind: "menu" as const,
    label: item.label,
    x,
    y: startY + index * (buttonHeight + gap),
    width: buttonWidth,
    height: buttonHeight,
    zIndex: 20 + index * 10,
  }));
}

export function startUiAutoSplitRegions(
  settings: GameStartUiSettings,
  designWidth: number,
  designHeight: number,
): AutoSplitRegion[] {
  return [
    {
      suffix: "background",
      name: "Background",
      kind: "background",
      x: 0,
      y: 0,
      width: designWidth,
      height: designHeight,
      zIndex: 0,
      locked: true,
    },
    {
      suffix: "logo",
      name: "Logo / Title",
      kind: "title",
      label: settings.title || "Title",
      x: Math.round(designWidth * 0.24),
      y: Math.round(designHeight * 0.06),
      width: Math.round(designWidth * 0.52),
      height: Math.round(designHeight * 0.34),
      zIndex: 10,
    },
    ...menuRegions(settings, designWidth, designHeight),
  ];
}

export function startUiRegionToLayer(region: AutoSplitRegion, imageUrl: string, useCrop: boolean): GameStartUiLayer {
  const isBackground = region.kind === "background";
  return {
    id: makeStartUiLayerId(region.suffix),
    name: region.name,
    kind: region.kind,
    imageUrl: isBackground || useCrop ? imageUrl : "",
    label: region.label,
    visible: true,
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    opacity: 1,
    zIndex: region.zIndex,
    locked: region.locked,
    sourceX: !isBackground && useCrop ? region.x : undefined,
    sourceY: !isBackground && useCrop ? region.y : undefined,
    sourceWidth: !isBackground && useCrop ? region.width : undefined,
    sourceHeight: !isBackground && useCrop ? region.height : undefined,
  };
}

export function buildCroppedStartUiTemplateLayers(
  sourceUrl: string,
  settings: GameStartUiSettings,
  designWidth: number,
  designHeight: number,
) {
  return startUiAutoSplitRegions(settings, designWidth, designHeight).map(region => (
    startUiRegionToLayer(region, sourceUrl, true)
  ));
}

export function buildTextStartUiLayoutLayers(
  backgroundUrl: string,
  settings: GameStartUiSettings,
  designWidth: number,
  designHeight: number,
) {
  return startUiAutoSplitRegions(settings, designWidth, designHeight).map(region => (
    startUiRegionToLayer(region, backgroundUrl, false)
  ));
}

export function createUploadedStartUiLayer(
  kind: StartUiLayerKind,
  upload: UploadedStartUiImage,
  settings: GameStartUiSettings,
  designWidth: number,
  designHeight: number,
): GameStartUiLayer {
  const width = Math.round(Math.min(upload.width, designWidth * (kind === "title" ? 0.52 : 0.36)));
  const height = Math.round(Math.min(upload.height, designHeight * (kind === "title" ? 0.32 : 0.12)));
  return {
    id: makeStartUiLayerId(kind),
    name: kind === "title" ? "Logo / Title" : "Menu Button",
    kind,
    imageUrl: upload.url,
    label: kind === "title" ? settings.title : settings.primaryActionLabel,
    visible: true,
    x: Math.round((designWidth - width) * 0.5),
    y: Math.round(designHeight * (kind === "title" ? 0.1 : 0.56)),
    width,
    height,
    opacity: 1,
    zIndex: kind === "title" ? 12 : 45,
  };
}

export function createTextStartUiButtonLayer(settings: GameStartUiSettings, designWidth: number, designHeight: number): GameStartUiLayer {
  return {
    id: makeStartUiLayerId("button"),
    name: settings.primaryActionLabel || "Button",
    kind: "menu",
    imageUrl: "",
    label: settings.primaryActionLabel || "New Game",
    visible: true,
    x: Math.round(designWidth * 0.32),
    y: Math.round(designHeight * 0.6),
    width: Math.round(designWidth * 0.36),
    height: Math.round(designHeight * 0.1),
    opacity: 1,
    zIndex: 50,
  };
}
