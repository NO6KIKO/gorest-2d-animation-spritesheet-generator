import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type MouseEvent, type PointerEvent } from "react";
import {
  CheckCircle2,
  Clipboard,
  Copy,
  Download,
  Eye,
  EyeOff,
  Film,
  Keyboard,
  Layers,
  Lock,
  Monitor,
  Map as MapIcon,
  Pause,
  Play,
  Plus,
  Save,
  Scissors,
  Smartphone,
  Tablet,
  Trash2,
  Unlock,
  Upload,
  X,
} from "lucide-react";
import { PRESET_SPRITES } from "./presets";
import type { AppMode, SheetOnlySelectionKind, WorkspaceTab } from "./app/types";
import {
  buildSpritesheetFrames,
  getFrameSize,
  spriteFrame,
  spriteFrameTotal,
  spriteGridColumns,
  spriteGridRows,
  spritesheetFrameThumbStyle,
} from "./domain/sprites/spriteUtils";
import { CurrentActionPanel } from "./features/current-action";
import { buildSceneFlowNodes, SceneFlowCanvas, type SceneFlowNode } from "./features/scene-flow";
import { ModePicker } from "./features/mode-picker";
import { buildSheetOnlyEntries, SheetOnlyGallery } from "./features/sheet-only-gallery";
import { SpritesheetImporterPanel } from "./features/spritesheet-importer";
import { WorkspaceStageHeader } from "./features/workspace-stage-header";
import { GlobalSceneLightingPanel, MotionSpeedPanel } from "./features/workspace-right-panel";
import { TriggerTestPanel, WorkspaceMessages } from "./features/workspace-sidebar";
import { WorkspaceTopbar } from "./features/workspace-topbar";
import { fetchGameLibrary, fetchLatestSprite } from "./services/gameLibraryApi";
import { fetchGeneratedAssets, type RepositoryGeneratedImage } from "./services/generatedAssetsApi";
import {
  ActionBinding,
  ActionTriggerType,
  AnimationClip,
  AnimationSprite,
  AssetRole,
  GameAsset,
  GameLibrary,
  GameScene,
  InteractionPreset,
  InteractionPromptStyle,
  LayerInteractionSettings,
  SceneLayer,
} from "./types";

type BackgroundMode = "checker" | "dark" | "light" | "green";
type ResizeHandle = "nw" | "ne" | "sw" | "se";
type ScenePanelResizeHandle = "layers" | "inspector";
type ResizeState = {
  id: string;
  handle: ResizeHandle;
  anchorScreenX: number;
  anchorScreenY: number;
  assetWidth: number;
  assetHeight: number;
};
type ScenePanelResizeState = {
  handle: ScenePanelResizeHandle;
  startX: number;
  startLayerWidth: number;
  startInspectorWidth: number;
};
type SceneContextMenuTarget = "layer" | "interaction-zone";
type SceneContextMenuState = {
  x: number;
  y: number;
  layerId: string;
  target: SceneContextMenuTarget;
};
type SceneLayerClipboard = {
  layer: SceneLayer;
  sourceSceneId: string;
};
type HeldDirection = "left" | "right" | null;
type VehiclePhase = "approaching" | "ready" | "boarded";
type ViewportPresetIcon = "phone" | "tablet" | "desktop";
type ViewportPreset = {
  id: string;
  label: string;
  width: number;
  height: number;
  icon: ViewportPresetIcon;
  note: string;
};
type SceneSpritesheetEntry = {
  key: string;
  layer: SceneLayer;
  asset: GameAsset;
  clip?: AnimationClip;
  sprite: AnimationSprite;
  frameWidth: number;
  frameHeight: number;
};
const VIEWPORT_WIDTH = 1280;
const DEFAULT_WALK_SPEED = 120;
const BOARDING_TRAIN_ASSET_ID = "asset_scene_boarding_train";
const INSPECT_TRIGGER_ASSET_ID = "asset_scene_e_trigger_point";
const SHOW_SCENE_KIT_TOOLS = false;
const BUILT_IN_SCENE_KIT_ASSET_IDS = new Set([
  INSPECT_TRIGGER_ASSET_ID,
  "asset_scene_ticket_machine",
  "asset_scene_backpack_ui",
  "asset_scene_backpack_panel",
  "asset_scene_station_sign_13",
  BOARDING_TRAIN_ASSET_ID,
]);

const DEFAULT_INTERACTION_SETTINGS: LayerInteractionSettings = {
  enabled: true,
  preset: "inspect",
  triggerMode: "near-click",
  actionType: "subtitle",
  promptKey: "",
  promptText: "Inspect",
  subtitle: "There is something worth inspecting here.",
  failSubtitle: "Nothing happens.",
  showText: false,
  fontSize: 11,
  promptScale: 0.88,
  promptStyle: "horror",
  triggerRadius: 180,
  offsetX: 0,
  offsetY: -34,
  zoneOffsetX: 0,
  zoneOffsetY: 0,
  hideLayerOnPickup: true,
  hotspotVisible: true,
};

const INTERACTION_PRESETS: Record<InteractionPreset, Partial<LayerInteractionSettings> & { label: string }> = {
  inspect: {
    label: "Inspect",
    preset: "inspect",
    triggerMode: "near-click",
    actionType: "subtitle",
    promptText: "Inspect",
    subtitle: "There is something worth inspecting here.",
    showText: false,
  },
  pickup: {
    label: "Pickup",
    preset: "pickup",
    triggerMode: "near-click",
    actionType: "pickup-item",
    promptText: "Pick up",
    subtitle: "Picked up an item.",
    showText: false,
    hideLayerOnPickup: true,
  },
  toggle: {
    label: "Toggle",
    preset: "toggle",
    triggerMode: "near-click",
    actionType: "toggle-layer",
    promptText: "Use",
    subtitle: "Something changed.",
  },
  "scene-link": {
    label: "Door / Scene Link",
    preset: "scene-link",
    triggerMode: "near-click",
    actionType: "scene-link",
    promptText: "Enter",
    subtitle: "Moving to another scene.",
  },
  animated: {
    label: "Animated Prop",
    preset: "animated",
    triggerMode: "near-click",
    actionType: "play-animation",
    promptText: "Activate",
    subtitle: "The object starts moving.",
  },
  conditional: {
    label: "Conditional",
    preset: "conditional",
    triggerMode: "near-click",
    actionType: "set-state",
    promptText: "Inspect",
    subtitle: "The condition is satisfied.",
    failSubtitle: "It does not seem ready yet.",
  },
};

const VIEWPORT_PRESETS: ViewportPreset[] = [
  { id: "iphone-portrait", label: "Phone Portrait", width: 390, height: 844, icon: "phone", note: "9:19.5" },
  { id: "phone-landscape", label: "Phone Wide", width: 844, height: 390, icon: "phone", note: "19.5:9" },
  { id: "portrait-720p", label: "Portrait 720p", width: 720, height: 1280, icon: "phone", note: "9:16" },
  { id: "portrait-1080p", label: "Portrait 1080p", width: 1080, height: 1920, icon: "phone", note: "9:16" },
  { id: "ipad-portrait", label: "iPad Portrait", width: 768, height: 1024, icon: "tablet", note: "3:4" },
  { id: "ipad-pro-portrait", label: "iPad Pro Portrait", width: 820, height: 1180, icon: "tablet", note: "11-inch" },
  { id: "ipad", label: "iPad Wide", width: 1024, height: 768, icon: "tablet", note: "4:3" },
  { id: "ipad-wide", label: "iPad Pro Wide", width: 1180, height: 820, icon: "tablet", note: "11-inch" },
  { id: "desktop", label: "Desktop 720p", width: 1280, height: 720, icon: "desktop", note: "16:9" },
  { id: "desktop-1080p", label: "Desktop 1080p", width: 1920, height: 1080, icon: "desktop", note: "16:9" },
  { id: "wide", label: "Ultrawide", width: 1440, height: 720, icon: "desktop", note: "2:1" },
];

const checkerStyle = {
  backgroundImage:
    "linear-gradient(45deg, #d6d9de 25%, transparent 25%), linear-gradient(-45deg, #d6d9de 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d6d9de 75%), linear-gradient(-45deg, transparent 75%, #d6d9de 75%)",
  backgroundSize: "22px 22px",
  backgroundPosition: "0 0, 0 11px, 11px -11px, -11px 0",
  backgroundColor: "#f6f7f9",
};

const NEON_CONTACT_SHADOW = {
  enabled: true,
  color: "rgba(2, 0, 10, 0.88)",
  opacity: 0.74,
  blur: 24,
  width: 0.58,
  height: 0.065,
  offsetX: 0,
  offsetY: 6,
};

const NEON_LAYER_LIGHTING = {
  preset: "neon-station" as const,
  brightness: 0.64,
  contrast: 0.98,
  saturate: 0.74,
  edgeLightColor: "#ff3e75",
  edgeLightOpacity: 0.32,
  rimLightColor: "#8e54ff",
  rimLightOpacity: 0.24,
};

const NEON_SCENE_LIGHTING = {
  preset: "neon-station" as const,
  brightness: 1,
  contrast: 1.04,
  saturate: 0.96,
  ambience: 0.78,
  vignette: 0.28,
  glow: 1,
};

const triggerLabels: Record<ActionTriggerType, string> = {
  mouse: "Mouse",
  keyboard: "Keyboard",
  auto: "Auto",
  state: "State",
};

const roleLabels: Record<AssetRole, string> = {
  player: "Player",
  npc: "NPC",
  effect: "Effect",
  prop: "Prop",
  background: "Background",
};

const defaultBinding: ActionBinding = {
  actionName: "walk",
  triggerType: "keyboard",
  triggerValue: "KeyD",
  gameState: "player.walk",
  notes: "Side-scroller character walks right with a compact stride.",
};

function safeName(name: string) {
  return name.replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "sprite";
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function splitTags(tagsText: string) {
  return tagsText.split(/[,\s]+/).map(tag => tag.trim()).filter(Boolean);
}

function defaultTriggerValueForType(triggerType: ActionTriggerType) {
  if (triggerType === "auto") return "auto";
  if (triggerType === "mouse") return "click";
  if (triggerType === "keyboard") return "KeyF";
  return "scene.animation.active";
}

function defaultGameStateForTrigger(triggerType: ActionTriggerType, actionName: string) {
  const actionKey = safeName(actionName || "animation");
  if (triggerType === "auto") return `scene.${actionKey}.loop`;
  if (triggerType === "mouse") return `scene.${actionKey}.clicked`;
  if (triggerType === "keyboard") return `input.${actionKey}`;
  return `state.${actionKey}`;
}

function backgroundSizeForFit(fit?: SceneLayer["fit"]) {
  if (fit === "contain") return "contain";
  if (fit === "stretch") return "100% 100%";
  if (fit === "tile") return "auto";
  return "cover";
}

function clampLayerScale(value: number) {
  return Math.min(2.5, Math.max(0.05, value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sceneViewportWidth(scene: GameScene) {
  return Math.min(scene.viewportWidth || VIEWPORT_WIDTH, scene.width);
}

function sceneViewportHeight(scene: GameScene) {
  return scene.viewportHeight || scene.height;
}

function formatViewportRatio(width: number, height: number) {
  if (!width || !height) return "custom";
  const ratio = width / height;
  return ratio >= 1 ? `${ratio.toFixed(2)}:1` : `1:${(height / width).toFixed(2)}`;
}

function ViewportPresetIconView({ icon }: { icon: ViewportPresetIcon }) {
  if (icon === "phone") return <Smartphone size={15} />;
  if (icon === "tablet") return <Tablet size={15} />;
  return <Monitor size={15} />;
}

function rgbaColor(hex: string, opacity: number) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return hex;
  const [, r, g, b] = match;
  return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${opacity})`;
}

function sceneLighting(scene: GameScene) {
  return scene.lighting || NEON_SCENE_LIGHTING;
}

function sceneFilter(scene: GameScene) {
  const lighting = sceneLighting(scene);
  if (lighting.preset === "none") return "none";
  return [
    `brightness(${lighting.brightness})`,
    `contrast(${lighting.contrast})`,
    `saturate(${lighting.saturate})`,
  ].join(" ");
}

function layerFilter(layer: SceneLayer) {
  const lighting = layer.lighting || NEON_LAYER_LIGHTING;
  if (lighting.preset === "none") return "none";
  return [
    `brightness(${lighting.brightness})`,
    `contrast(${lighting.contrast})`,
    `saturate(${lighting.saturate})`,
    "sepia(0.08)",
    `drop-shadow(-5px 0 8px ${rgbaColor(lighting.rimLightColor, lighting.rimLightOpacity)})`,
    `drop-shadow(7px 0 10px ${rgbaColor(lighting.edgeLightColor, lighting.edgeLightOpacity)})`,
    "drop-shadow(0 14px 18px rgba(4, 0, 12, 0.5))",
  ].join(" ");
}

function characterFilter(scene: GameScene, layer: SceneLayer) {
  return combineFilters(sceneFilter(scene), layerFilter(layer));
}

function sceneLayerRenderFilter(scene: GameScene, layer: SceneLayer, asset?: GameAsset) {
  const explicitLayerFilter = layer.lighting ? layerFilter(layer) : "none";
  if (asset?.role === "player") return characterFilter(scene, layer);
  return combineFilters(sceneFilter(scene), explicitLayerFilter);
}

function combineFilters(...filters: Array<string | undefined>) {
  const active = filters.filter(filter => filter && filter !== "none");
  return active.length ? active.join(" ") : "none";
}

function isSceneVisualLayer(layer: SceneLayer) {
  return layer.type === "sprite" || layer.type === "effect" || layer.type === "foreground";
}

function isTransformableSceneLayer(layer: SceneLayer) {
  return layer.type === "background" || isSceneVisualLayer(layer);
}

function layerWorldBounds(layer: SceneLayer, asset?: GameAsset) {
  const sprite = resolveAssetSprite(asset, layer);
  const [spriteW, spriteH] = sprite ? getFrameSize(sprite) : [0, 0];
  const width = spriteW * layer.scale;
  const height = spriteH * layer.scale;
  return {
    left: layer.x,
    right: layer.x + width,
    top: layer.y - height,
    bottom: layer.y,
    width,
    height,
    centerX: layer.x + width * 0.5,
    centerY: layer.y - height * 0.5,
  };
}

function interactionZoneBounds(layer: SceneLayer, asset: GameAsset | undefined, interaction: LayerInteractionSettings) {
  const bounds = layerWorldBounds(layer, asset);
  const width = Math.max(24, interaction.zoneWidth || bounds.width);
  const height = Math.max(24, interaction.zoneHeight || bounds.height);
  const centerX = bounds.centerX + (interaction.zoneOffsetX || 0);
  const centerY = bounds.centerY + (interaction.zoneOffsetY || 0);
  return {
    left: centerX - width / 2,
    right: centerX + width / 2,
    top: centerY - height / 2,
    bottom: centerY + height / 2,
    width,
    height,
    centerX,
    centerY,
  };
}

function stateValueFromText(value?: string) {
  const text = (value || "").trim();
  if (!text) return "";
  if (text === "true") return true;
  if (text === "false") return false;
  if (!Number.isNaN(Number(text)) && text !== "") return Number(text);
  return text;
}

function stateMatches(actual: unknown, expected?: string) {
  const text = (expected || "").trim();
  if (!text) return Boolean(actual);
  return String(actual) === String(stateValueFromText(text));
}

function keyLabelFromBinding(triggerValue?: string) {
  if (!triggerValue) return "E";
  return triggerValue.replace(/^Key/i, "").replace(/^Digit/i, "") || triggerValue;
}

function defaultInteractionText(asset?: GameAsset) {
  if (!asset) return DEFAULT_INTERACTION_SETTINGS.promptText;
  if (asset.id === BOARDING_TRAIN_ASSET_ID) return "Board";
  if (asset.id === "asset_scene_ticket_machine") return "Use";
  if (asset.id === INSPECT_TRIGGER_ASSET_ID) return "Inspect";
  return asset.binding.actionName === "interact" ? "Interact" : asset.name;
}

function layerInteractionSettings(layer: SceneLayer, asset?: GameAsset): LayerInteractionSettings | null {
  const assetIsInteractable = !!asset && (
    asset.tags.includes("interactable") ||
    asset.tags.includes("interaction-trigger") ||
    asset.tags.includes("inspect-hotspot")
  );
  if (!assetIsInteractable && !layer.interaction) return null;
  return {
    ...DEFAULT_INTERACTION_SETTINGS,
    promptKey: keyLabelFromBinding(asset?.binding.triggerValue),
    promptText: defaultInteractionText(asset),
    ...layer.interaction,
  };
}

function createStaticSprite(id: string, characterName: string, frameWidth: number, frameHeight: number, svgBody: string): AnimationSprite {
  const pngSource = SCENE_KIT_PNG_SOURCES[id];
  if (pngSource) {
    return {
      id,
      characterName,
      description: `Reusable PNG scene-kit asset: ${characterName}.`,
      frameCount: 1,
      style: "Generated PNG scene prop",
      frames: [
        `<img src="${pngSource.url}" alt="${characterName}" draggable="false" />`,
      ],
      createdTime: "2026-06-10T00:00:00.000Z",
      isPreset: true,
      spritesheetPng: pngSource.url,
      rawSpritesheetPng: pngSource.url,
      frameSize: [pngSource.width, pngSource.height],
      sheetSize: [pngSource.width, pngSource.height],
      generationMode: "png-scene-kit",
      proportionPolicy: "PNG asset keeps its generated pixel ratio and can be resized as a layer.",
    };
  }
  return {
    id,
    characterName,
    description: `Reusable scene-kit prop: ${characterName}.`,
    frameCount: 1,
    style: "Neon subway scene prop",
    frames: [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${frameWidth}" height="${frameHeight}" viewBox="0 0 ${frameWidth} ${frameHeight}">${svgBody}</svg>`,
    ],
    createdTime: "2026-06-10T00:00:00.000Z",
    isPreset: true,
    frameSize: [frameWidth, frameHeight],
    sheetSize: [frameWidth, frameHeight],
    generationMode: "built-in-scene-kit",
    proportionPolicy: "Static prop keeps its designed frame ratio and can be resized as a layer.",
  };
}

function createStaticAsset(asset: Omit<GameAsset, "savedTime" | "updatedTime" | "confirmed">): GameAsset {
  return {
    ...asset,
    confirmed: true,
    savedTime: "2026-06-10T00:00:00.000Z",
    updatedTime: "2026-06-10T00:00:00.000Z",
  };
}

const SCENE_KIT_PNG_SOURCES: Record<string, { url: string; width: number; height: number }> = {
  sprite_scene_ticket_machine: { url: "/generated/scene_kit_ticket_machine.png", width: 392, height: 1541 },
  sprite_scene_backpack_ui: { url: "/generated/scene_kit_backpack_icon.png", width: 274, height: 315 },
  sprite_scene_station_sign_13: { url: "/generated/scene_kit_platform_13_sign.png", width: 589, height: 384 },
  sprite_scene_backpack_panel: { url: "/generated/scene_kit_backpack_panel.png", width: 729, height: 438 },
  sprite_scene_boarding_train: { url: "/generated/scene_kit_boarding_train.png", width: 1868, height: 547 },
};

const TICKET_MACHINE_SPRITE = createStaticSprite(
  "sprite_scene_ticket_machine",
  "Ruined Ticket Machine",
  392,
  1541,
  `
    <defs>
      <linearGradient id="tmBody" x1="0" x2="1" y1="0" y2="1">
        <stop stop-color="#2a1a31" offset="0"/>
        <stop stop-color="#18111e" offset="0.5"/>
        <stop stop-color="#05060b" offset="1"/>
      </linearGradient>
      <linearGradient id="tmGlow" x1="0" x2="1">
        <stop stop-color="#ff356a" offset="0"/>
        <stop stop-color="#9b55ff" offset="1"/>
      </linearGradient>
      <filter id="tmSoftGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="tmGrime" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="21"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer><feFuncA type="table" tableValues="0 0.15"/></feComponentTransfer>
      </filter>
    </defs>
    <ellipse cx="110" cy="340" rx="82" ry="14" fill="#01020a" opacity="0.45"/>
    <rect x="37" y="26" width="146" height="316" rx="12" fill="url(#tmBody)" stroke="#4d405b" stroke-width="3"/>
    <path d="M48 54h124v44H48z" fill="#140b1b" stroke="#d23d67" stroke-width="2" filter="url(#tmSoftGlow)"/>
    <text x="110" y="83" text-anchor="middle" font-family="Inter,Arial" font-size="19" font-weight="800" fill="#ffc7d6">TICKETS</text>
    <rect x="56" y="118" width="108" height="58" rx="5" fill="#08111c" stroke="#764c91" stroke-width="2"/>
    <path d="M66 136h88M66 152h62" stroke="#ff4d7c" stroke-width="4" stroke-linecap="round" opacity="0.72"/>
    <rect x="55" y="194" width="48" height="38" rx="5" fill="#121621" stroke="#705d77" stroke-width="2"/>
    <rect x="117" y="194" width="48" height="38" rx="5" fill="#10131b" stroke="#705d77" stroke-width="2"/>
    <circle cx="79" cy="213" r="8" fill="#ff4979" filter="url(#tmSoftGlow)"/>
    <rect x="126" y="207" width="30" height="8" rx="4" fill="#d9b889"/>
    <rect x="59" y="252" width="102" height="30" rx="5" fill="#080910" stroke="#5b5265" stroke-width="2"/>
    <path d="M69 266h68" stroke="#8f7d90" stroke-width="4" stroke-linecap="round"/>
    <path d="M42 307h136" stroke="url(#tmGlow)" stroke-width="3" opacity="0.7"/>
    <path d="M57 37c21-9 85-8 108 0M48 293c25 11 98 10 123 0" stroke="#ffffff" stroke-width="1.2" opacity="0.08"/>
    <path d="M70 104l-14 225M160 108l-16 222" stroke="#000" stroke-width="3" opacity="0.22"/>
    <path d="M36 39c-10 55-10 217 1 292M184 47c9 80 8 185-4 288" stroke="#120b16" stroke-width="3" opacity="0.78"/>
    <path d="M31 76h-15M185 96h18M36 167H18M184 246h23M46 319H26" stroke="#25172a" stroke-width="6" stroke-linecap="round"/>
    <path d="M47 42h124l12 18M39 93c38 7 104 7 141-2M39 242c43 8 96 7 139-1M45 334c36 9 95 9 129 0" stroke="#ffffff" stroke-width="1" opacity="0.055"/>
    <path d="M61 108h12M172 101h10M49 192h11M170 288h12M80 323h10M137 44h15" stroke="#ff356a" stroke-width="2" opacity="0.32"/>
    <path d="M31 58l-9 23M197 117l-12 32M23 236l10 34M187 310l14 19" stroke="#4d2f55" stroke-width="2" opacity="0.62"/>
    <rect x="37" y="26" width="146" height="316" fill="#fff" filter="url(#tmGrime)" opacity="0.48"/>
  `
);

const BACKPACK_UI_SPRITE = createStaticSprite(
  "sprite_scene_backpack_ui",
  "Ruined Backpack HUD",
  96,
  96,
  `
    <defs>
      <linearGradient id="bagPanel" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#24162c" offset="0"/>
        <stop stop-color="#080b12" offset="1"/>
      </linearGradient>
      <linearGradient id="bagGlow" x1="0" x2="1">
        <stop stop-color="#ff356a" offset="0"/>
        <stop stop-color="#9b55ff" offset="1"/>
      </linearGradient>
      <filter id="bagSoftGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="bagNoise" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="9"/>
        <feComponentTransfer><feFuncA type="table" tableValues="0 0.12"/></feComponentTransfer>
      </filter>
    </defs>
    <rect x="6" y="6" width="84" height="84" rx="14" fill="#05060c" opacity="0.7"/>
    <rect x="8" y="7" width="80" height="80" rx="13" fill="url(#bagPanel)" stroke="#53445c" stroke-width="2" opacity="0.97"/>
    <path d="M18 20h60M12 74h72" stroke="#2a2030" stroke-width="4" opacity="0.9"/>
    <path d="M32 36c1-14 8-23 17-23s15 9 16 23" fill="none" stroke="#887b8f" stroke-width="6" stroke-linecap="round"/>
    <path d="M32 36c2-10 7-17 17-17s15 7 17 17" fill="none" stroke="#15111a" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M24 34h49l-4 42H28z" fill="#241f2d" stroke="#9a8da2" stroke-width="2"/>
    <rect x="31" y="45" width="35" height="24" rx="3" fill="#111620" stroke="#4d4557" stroke-width="1.5"/>
    <path d="M36 54h25M39 63h16" stroke="url(#bagGlow)" stroke-width="3.5" stroke-linecap="round" filter="url(#bagSoftGlow)"/>
    <path d="M26 39l-7 25M72 39l7 24" stroke="#3b3142" stroke-width="4" stroke-linecap="round"/>
    <circle cx="73" cy="23" r="8" fill="#ff356a" filter="url(#bagSoftGlow)"/>
    <text x="73" y="27" text-anchor="middle" font-family="Arial" font-size="10" font-weight="900" fill="#150713">I</text>
    <path d="M21 32h10M70 33h10M21 58h8M72 57h8M39 79h13" stroke="#ff356a" stroke-width="1.7" opacity="0.32"/>
    <rect x="8" y="7" width="80" height="80" fill="#fff" filter="url(#bagNoise)" opacity="0.5"/>
  `
);

const STATION_SIGN_13_SPRITE = createStaticSprite(
  "sprite_scene_station_sign_13",
  "Platform 13 Hanging Sign",
  320,
  150,
  `
    <defs>
      <linearGradient id="signFace" x1="0" x2="1" y1="0" y2="1">
        <stop stop-color="#27152a" offset="0"/>
        <stop stop-color="#12111a" offset="0.56"/>
        <stop stop-color="#06070c" offset="1"/>
      </linearGradient>
      <filter id="signGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="signGrime" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="3" seed="13"/>
        <feComponentTransfer><feFuncA type="table" tableValues="0 0.18"/></feComponentTransfer>
      </filter>
    </defs>
    <path d="M54 0v25M266 0v25" stroke="#5b415f" stroke-width="2" opacity="0.55"/>
    <path d="M58 0v24M270 0v24" stroke="#1a1320" stroke-width="5"/>
    <rect x="14" y="18" width="292" height="106" rx="6" fill="url(#signFace)" stroke="#4a3b5b" stroke-width="3"/>
    <rect x="28" y="32" width="58" height="58" rx="7" fill="#ff416f" filter="url(#signGlow)"/>
    <text x="57" y="72" text-anchor="middle" font-family="Inter,Arial" font-size="32" font-weight="900" fill="#130915">13</text>
    <text x="105" y="56" font-family="Inter,Arial" font-size="23" font-weight="900" fill="#ffd3de">PLATFORM 13</text>
    <text x="106" y="84" font-family="Inter,Arial" font-size="13" font-weight="800" fill="#8e88a2">LOWER RING / TICKET HALL</text>
    <path d="M25 105h270" stroke="#873d64" stroke-width="3" opacity="0.7"/>
    <path d="M109 101h120" stroke="#ff4779" stroke-width="3" opacity="0.65" filter="url(#signGlow)"/>
    <path d="M14 126h292" stroke="#05050a" stroke-width="8" opacity="0.8"/>
    <path d="M23 28c54-10 218-9 276 2M27 116c70 8 197 8 267-2" stroke="#ffffff" stroke-width="1" opacity="0.07"/>
    <path d="M31 26h9M231 28h11M283 112h12M116 117h18M172 31h20" stroke="#ff386e" stroke-width="2" opacity="0.34"/>
    <path d="M98 64h15M262 53h24M250 72h18M249 89h31" stroke="#6d5e70" stroke-width="3" stroke-linecap="round"/>
    <rect x="14" y="18" width="292" height="106" fill="#fff" filter="url(#signGrime)" opacity="0.5"/>
  `
);

const BACKPACK_PANEL_SPRITE = createStaticSprite(
  "sprite_scene_backpack_panel",
  "Open Backpack Inventory Panel",
  769,
  464,
  ""
);

const BOARDING_TRAIN_SPRITE = createStaticSprite(
  "sprite_scene_boarding_train",
  "Arriving Subway Car",
  1868,
  547,
  ""
);

const INTERACTION_TRIGGER_SPRITE = createStaticSprite(
  "sprite_scene_e_trigger_point",
  "Reusable Eye Inspect Hotspot",
  80,
  80,
  `
    <defs>
      <filter id="hotspotShadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.42"/>
      </filter>
    </defs>
    <circle cx="40" cy="40" r="30" fill="rgba(13,15,18,.34)" stroke="rgba(255,255,255,.76)" stroke-width="3" stroke-dasharray="6 5" filter="url(#hotspotShadow)"/>
    <circle cx="40" cy="40" r="17" fill="rgba(5,5,6,.62)" stroke="rgba(255,255,255,.42)" stroke-width="2"/>
    <path d="M40 13v13M40 54v13M13 40h13M54 40h13" stroke="#f3f0e8" stroke-width="3" stroke-linecap="round" opacity=".82"/>
    <ellipse cx="40" cy="40" rx="21" ry="13" fill="rgba(244,240,232,.86)" stroke="rgba(20,20,20,.82)" stroke-width="3"/>
    <circle cx="40" cy="40" r="6" fill="#141416"/>
    <circle cx="42" cy="38" r="2" fill="#f4f0e8" opacity=".8"/>
  `
);

const SCENE_KIT_ASSETS: GameAsset[] = [
  createStaticAsset({
    id: INSPECT_TRIGGER_ASSET_ID,
    name: "Eye Inspect Hotspot / Reusable",
    role: "prop",
    sprite: INTERACTION_TRIGGER_SPRITE,
    defaultAnimationId: "clip_e_trigger_idle",
    animations: [
      {
        id: "clip_eye_inspect_idle",
        name: "Eye Inspect Idle",
        actionName: "interact",
        direction: "none",
        sprite: INTERACTION_TRIGGER_SPRITE,
        binding: {
          actionName: "interact",
          triggerType: "mouse",
          triggerValue: "click",
          gameState: "hotspot.nearby",
          notes: "Reusable invisible/visible inspect hotspot. Drag it into the scene, set prompt text/style/radius on the layer, and click the eye icon when the player is nearby.",
        },
        loop: false,
      },
    ],
    binding: {
      actionName: "interact",
      triggerType: "mouse",
      triggerValue: "click",
      gameState: "hotspot.nearby",
      notes: "Reusable inspect hotspot with configurable eye prompt text, prompt style, font size, trigger radius, and prompt offset.",
    },
    tags: ["scene-kit", "interaction-trigger", "inspect-hotspot", "hotspot", "reusable"],
  }),
  createStaticAsset({
    id: "asset_scene_ticket_machine",
    name: "Ruined Ticket Machine / Interact",
    role: "prop",
    sprite: TICKET_MACHINE_SPRITE,
    defaultAnimationId: "clip_ticket_machine_idle",
    animations: [
      {
        id: "clip_ticket_machine_idle",
        name: "Ticket Machine Idle",
        actionName: "interact",
        direction: "none",
        sprite: TICKET_MACHINE_SPRITE,
        binding: {
          actionName: "interact",
          triggerType: "mouse",
          triggerValue: "click",
          gameState: "ticketMachine.nearby",
          notes: "Reusable inspectable prop. When the player is near it, the scene shows a clickable eye prompt.",
        },
        loop: false,
      },
    ],
    binding: {
      actionName: "interact",
      triggerType: "mouse",
      triggerValue: "click",
      gameState: "ticketMachine.nearby",
      notes: "Reusable inspectable prop. When the player is near it, the scene shows a clickable eye prompt.",
    },
    tags: ["scene-kit", "interactable", "inspectable", "ticket-machine", "reusable"],
  }),
  createStaticAsset({
    id: "asset_scene_backpack_ui",
    name: "Backpack HUD / Inventory",
    role: "prop",
    sprite: BACKPACK_UI_SPRITE,
    defaultAnimationId: "clip_backpack_hud_idle",
    animations: [
      {
        id: "clip_backpack_hud_idle",
        name: "Backpack HUD Idle",
        actionName: "inventory_hud",
        direction: "none",
        sprite: BACKPACK_UI_SPRITE,
        binding: {
          actionName: "inventory_hud",
          triggerType: "state",
          triggerValue: "inventory.visible",
          gameState: "ui.backpack",
          notes: "Screen-space HUD layer. Uses parallax 0 so it stays fixed while the camera moves.",
        },
        loop: false,
      },
    ],
    binding: {
      actionName: "inventory_hud",
      triggerType: "state",
      triggerValue: "inventory.visible",
      gameState: "ui.backpack",
      notes: "Screen-space HUD layer. Uses parallax 0 so it stays fixed while the camera moves.",
    },
    tags: ["scene-kit", "ui", "backpack", "reusable"],
  }),
  createStaticAsset({
    id: "asset_scene_backpack_panel",
    name: "Open Backpack Inventory Panel / UI",
    role: "prop",
    sprite: BACKPACK_PANEL_SPRITE,
    defaultAnimationId: "clip_backpack_panel_open",
    animations: [
      {
        id: "clip_backpack_panel_open",
        name: "Open Backpack Panel",
        actionName: "inventory_open",
        direction: "none",
        sprite: BACKPACK_PANEL_SPRITE,
        binding: {
          actionName: "inventory_open",
          triggerType: "state",
          triggerValue: "inventory.open",
          gameState: "ui.backpack.open",
          notes: "PNG overlay shown when the backpack HUD icon is clicked or I is pressed.",
        },
        loop: false,
      },
    ],
    binding: {
      actionName: "inventory_open",
      triggerType: "state",
      triggerValue: "inventory.open",
      gameState: "ui.backpack.open",
      notes: "PNG overlay shown when the backpack HUD icon is clicked or I is pressed.",
    },
    tags: ["scene-kit", "ui", "backpack-panel", "png", "reusable"],
  }),
  createStaticAsset({
    id: "asset_scene_station_sign_13",
    name: "Platform 13 Hanging Sign / Prop",
    role: "prop",
    sprite: STATION_SIGN_13_SPRITE,
    defaultAnimationId: "clip_station_sign_13_idle",
    animations: [
      {
        id: "clip_station_sign_13_idle",
        name: "Platform 13 Sign Idle",
        actionName: "station_sign",
        direction: "none",
        sprite: STATION_SIGN_13_SPRITE,
        binding: {
          actionName: "station_sign",
          triggerType: "state",
          triggerValue: "station.line13",
          gameState: "scene.stationSign",
          notes: "Reusable subway sign prop.",
        },
        loop: false,
      },
    ],
    binding: {
      actionName: "station_sign",
      triggerType: "state",
      triggerValue: "station.line13",
      gameState: "scene.stationSign",
      notes: "Reusable subway sign prop.",
    },
    tags: ["scene-kit", "station-sign", "line-13", "reusable"],
  }),
  createStaticAsset({
    id: BOARDING_TRAIN_ASSET_ID,
    name: "Arriving Subway Car / Board",
    role: "prop",
    sprite: BOARDING_TRAIN_SPRITE,
    defaultAnimationId: "clip_boarding_train_idle",
    animations: [
      {
        id: "clip_boarding_train_idle",
        name: "Boarding Train Ready",
        actionName: "board_vehicle",
        direction: "none",
        sprite: BOARDING_TRAIN_SPRITE,
        binding: {
          actionName: "board_vehicle",
          triggerType: "mouse",
          triggerValue: "click",
          gameState: "vehicle.readyToBoard",
          notes: "Reusable side-view boarding vehicle. It renders in front of the player, but window alpha must stay transparent so the player can walk behind it and remain visible through the glass. Click the eye prompt to board when nearby.",
        },
        loop: false,
      },
    ],
    binding: {
      actionName: "board_vehicle",
      triggerType: "mouse",
      triggerValue: "click",
      gameState: "vehicle.readyToBoard",
      notes: "Reusable side-view boarding vehicle. It approaches from the foreground, accepts a click on the nearby eye prompt once stopped, and keeps transparent windows for behind-player visibility.",
    },
    tags: ["scene-kit", "vehicle", "boarding", "interactable", "inspectable", "png", "transparent-windows", "side-view", "reusable"],
  }),
];

function createInteractionTriggerLayer(
  scene: GameScene,
  id: string,
  name: string,
  x: number,
  y: number,
  promptText: string,
  interaction: Partial<LayerInteractionSettings> = {}
): SceneLayer {
  return {
    id,
    name,
    type: "effect",
    visible: true,
    assetId: INSPECT_TRIGGER_ASSET_ID,
    activeAnimationId: "clip_eye_inspect_idle",
    x,
    y,
    scale: 0.55,
    zIndex: 82,
    opacity: 0.75,
    parallax: 1,
    shadow: { ...NEON_CONTACT_SHADOW, enabled: false },
    lighting: { ...NEON_LAYER_LIGHTING, preset: "none" as const },
    interaction: {
      ...DEFAULT_INTERACTION_SETTINGS,
      promptText,
      triggerRadius: 170,
      offsetY: -30,
      ...interaction,
    },
  };
}

function createSceneKitLayer(scene: GameScene, assetId: string, stableId = true): SceneLayer {
  const suffix = stableId ? "" : `_${Date.now()}`;
  if (assetId === INSPECT_TRIGGER_ASSET_ID) {
    const viewportW = sceneViewportWidth(scene);
    return createInteractionTriggerLayer(
      scene,
      `layer_scene_e_trigger_point${suffix}`,
      "Eye Inspect Hotspot",
      Math.round(scene.cameraX + viewportW * 0.5),
      scene.groundY - 10,
      "Inspect"
    );
  }
  if (assetId === "asset_scene_ticket_machine") {
    return {
      id: `layer_scene_ticket_machine${suffix}`,
      name: "Ticket Machine",
      type: "sprite",
      visible: true,
      assetId,
      activeAnimationId: "clip_ticket_machine_idle",
      x: 720,
      y: scene.groundY + 3,
      scale: 0.22,
      zIndex: 24,
      opacity: 1,
      parallax: 1,
      shadow: { ...NEON_CONTACT_SHADOW, opacity: 0.62, width: 0.72 },
      lighting: { ...NEON_LAYER_LIGHTING, preset: "none" as const },
    };
  }
  if (assetId === "asset_scene_backpack_ui") {
    return {
      id: `layer_scene_backpack_ui${suffix}`,
      name: "Backpack HUD",
      type: "foreground",
      visible: true,
      assetId,
      activeAnimationId: "clip_backpack_hud_idle",
      x: 1210,
      y: 96,
      scale: 0.18,
      zIndex: 120,
      opacity: 1,
      parallax: 0,
      shadow: { ...NEON_CONTACT_SHADOW, enabled: false },
      lighting: { ...NEON_LAYER_LIGHTING, preset: "none" as const },
    };
  }
  if (assetId === "asset_scene_backpack_panel") {
    return {
      id: `layer_scene_backpack_panel${suffix}`,
      name: "Open Backpack Panel",
      type: "foreground",
      visible: true,
      assetId,
      activeAnimationId: "clip_backpack_panel_open",
      x: 258,
      y: 572,
      scale: 0.72,
      zIndex: 118,
      opacity: 1,
      parallax: 0,
      shadow: { ...NEON_CONTACT_SHADOW, enabled: false },
      lighting: { ...NEON_LAYER_LIGHTING, preset: "none" as const },
    };
  }
  if (assetId === BOARDING_TRAIN_ASSET_ID) {
    const viewportW = sceneViewportWidth(scene);
    return {
      id: `layer_scene_boarding_train${suffix}`,
      name: "Arriving Subway Car",
      type: "sprite",
      visible: true,
      assetId,
      activeAnimationId: "clip_boarding_train_idle",
      x: scene.cameraX + viewportW + 180,
      y: scene.height - 36,
      scale: 0.44,
      zIndex: 86,
      opacity: 1,
      parallax: 1,
      shadow: { ...NEON_CONTACT_SHADOW, opacity: 0.5, width: 0.9, height: 0.04, offsetY: 12 },
      lighting: { ...NEON_LAYER_LIGHTING, preset: "none" as const },
    };
  }
  return {
    id: `layer_scene_station_sign_13${suffix}`,
    name: "Platform 13 Hanging Sign",
    type: "sprite",
    visible: true,
    assetId,
    activeAnimationId: "clip_station_sign_13_idle",
    x: 920,
    y: 292,
    scale: 0.36,
    zIndex: 12,
    opacity: 0.92,
    parallax: 1,
    shadow: { ...NEON_CONTACT_SHADOW, enabled: false },
    lighting: { ...NEON_LAYER_LIGHTING, preset: "none" as const },
  };
}

function ensureSceneKitLayers(scene: GameScene) {
  const existingIds = new Set(scene.layers.map(layer => layer.id));
  const normalizedLayers = scene.layers.map(layer => {
    if (layer.assetId === "asset_scene_backpack_ui" && layer.scale > 0.35) {
      return { ...layer, x: 1210, y: 96, scale: 0.18, parallax: 0, zIndex: Math.max(layer.zIndex, 120) };
    }
    if (layer.assetId === "asset_scene_ticket_machine" && layer.scale > 0.3) {
      return { ...layer, scale: 0.22, lighting: { ...NEON_LAYER_LIGHTING, preset: "none" as const } };
    }
    if (layer.assetId === "asset_scene_ticket_machine") {
      return { ...layer, lighting: { ...NEON_LAYER_LIGHTING, preset: "none" as const } };
    }
    if (layer.assetId === "asset_scene_station_sign_13" && layer.scale > 0.48) {
      return { ...layer, x: 920, y: 292, scale: 0.36, lighting: { ...NEON_LAYER_LIGHTING, preset: "none" as const } };
    }
    if (layer.assetId === "asset_scene_station_sign_13") {
      return { ...layer, lighting: { ...NEON_LAYER_LIGHTING, preset: "none" as const } };
    }
    if (layer.assetId === BOARDING_TRAIN_ASSET_ID) {
      return { ...layer, lighting: { ...NEON_LAYER_LIGHTING, preset: "none" as const } };
    }
    return layer;
  });
  const missingLayers = [
    createSceneKitLayer(scene, "asset_scene_station_sign_13"),
    createSceneKitLayer(scene, "asset_scene_ticket_machine"),
    createSceneKitLayer(scene, "asset_scene_backpack_ui"),
    createSceneKitLayer(scene, BOARDING_TRAIN_ASSET_ID),
    createInteractionTriggerLayer(scene, "layer_scene_eye_hotspot_ticket_machine", "Ticket Machine Eye Hotspot", 738, scene.groundY - 12, "Use ticket machine", { triggerRadius: 155, offsetY: -42 }),
    createInteractionTriggerLayer(scene, "layer_scene_eye_hotspot_notice", "Notice Board Eye Hotspot", 390, scene.groundY - 18, "Inspect notice", { triggerRadius: 145, fontSize: 10, promptStyle: "caption" }),
    createInteractionTriggerLayer(scene, "layer_scene_eye_hotspot_platform_edge", "Platform Edge Eye Hotspot", 1480, scene.groundY - 14, "Wait for train", { triggerRadius: 190 }),
  ].filter(layer => !existingIds.has(layer.id));
  return missingLayers.length ? { ...scene, layers: [...normalizedLayers, ...missingLayers] } : { ...scene, layers: normalizedLayers };
}

function removeBuiltInSceneKitLayers(scene: GameScene): GameScene {
  return {
    ...scene,
    layers: scene.layers.filter(layer => !layer.assetId || !BUILT_IN_SCENE_KIT_ASSET_IDS.has(layer.assetId)),
  };
}

function normalizeEditableScene(scene: GameScene): GameScene {
  return {
    ...scene,
    layers: scene.layers.map(layer => {
      if (layer.type !== "background") return layer;
      const width = layer.width && layer.width > 0 ? layer.width : scene.width;
      const height = layer.height && layer.height > 0 ? layer.height : scene.height;
      const wasLegacyFullFrameBackground = !layer.width && !layer.height && layer.y === 0;
      return {
        ...layer,
        locked: false,
        x: Number.isFinite(layer.x) ? layer.x : 0,
        y: wasLegacyFullFrameBackground ? height : (Number.isFinite(layer.y) ? layer.y : height),
        scale: layer.scale || 1,
        zIndex: layer.zIndex ?? 0,
        opacity: layer.opacity ?? 1,
        parallax: layer.parallax ?? 1,
        width,
        height,
        fit: layer.fit || "stretch",
        position: layer.position || "left center",
      };
    }),
  };
}

function prepareSceneForEditor(scene: GameScene): GameScene {
  return normalizeEditableScene(removeBuiltInSceneKitLayers(scene));
}

function sceneTimestampLabel(date = new Date()) {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createDefaultScene(): GameScene {
  const scene: GameScene = {
    id: "scene_side_scroller_demo",
    name: "Side Scroller Scene",
    width: 3840,
    height: 720,
    viewportWidth: 1280,
    viewportHeight: 720,
    viewportPreset: "desktop",
    cameraX: 0,
    groundY: 520,
    background: "chinese_station_platform",
    state: {
      has_key: false,
      radio_on: false,
      door_open: false,
      visited_bedroom: false,
    },
    lighting: { ...NEON_SCENE_LIGHTING },
    savedTime: new Date().toISOString(),
    layers: [
      {
        id: "layer_sky",
        name: "Background",
        type: "background",
        visible: true,
        locked: false,
        x: 0,
        y: 720,
        scale: 1,
        zIndex: 0,
        opacity: 1,
        parallax: 1,
        width: 3840,
        height: 720,
        color: "#08070d",
        imageUrl: "/generated/chinese_side_scroller_station_extended_3840x720.png",
        fit: "stretch",
        position: "left center",
      },
      {
        id: "layer_ground",
        name: "Ground",
        type: "ground",
        visible: false,
        locked: true,
        x: 0,
        y: 520,
        scale: 1,
        zIndex: 10,
        opacity: 0.45,
        parallax: 1,
        color: "#f0b14a",
      },
    ],
  };
  return scene;
}

function downloadUrl(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  downloadUrl(url, filename);
  URL.revokeObjectURL(url);
}

function blobUrlFromSvg(svg: string) {
  return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
}

async function drawSvgFrame(ctx: CanvasRenderingContext2D, svg: string, x: number, y: number, w: number, h: number) {
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

function createAsset(sprite: AnimationSprite, role: AssetRole, binding: ActionBinding, tagsText: string): GameAsset {
  const now = new Date().toISOString();
  const id = `asset_${safeName(sprite.characterName)}_${safeName(binding.actionName)}_${Date.now()}`;
  return {
    id,
    name: `${sprite.characterName} / ${binding.actionName}`,
    role,
    confirmed: true,
    savedTime: now,
    updatedTime: now,
    sprite,
    binding,
    tags: splitTags(tagsText),
  };
}

function resolveAssetClip(asset?: GameAsset, layer?: SceneLayer): AnimationClip | undefined {
  if (!asset?.animations?.length) return undefined;
  return (
    asset.animations.find(clip => clip.id === layer?.activeAnimationId) ||
    asset.animations.find(clip => clip.id === asset.defaultAnimationId) ||
    asset.animations[0]
  );
}

function resolveAssetSprite(asset?: GameAsset, layer?: SceneLayer): AnimationSprite | undefined {
  return resolveAssetClip(asset, layer)?.sprite || asset?.sprite;
}

function clipButtonText(clip: AnimationClip) {
  const key = clip.binding?.triggerType === "keyboard" ? ` ${clip.binding.triggerValue.replace(/^Key/i, "")}` : "";
  if (clip.direction === "left") return `Walk Left${key}`;
  if (clip.direction === "right") return `Walk Right${key}`;
  return clip.actionName === "idle" ? "Idle" : clip.name;
}

const SCENE_HISTORY_LIMIT = 80;

function cloneSceneForHistory(scene: GameScene) {
  if (typeof structuredClone === "function") return structuredClone(scene);
  return JSON.parse(JSON.stringify(scene)) as GameScene;
}

function cloneSceneLayer(layer: SceneLayer) {
  if (typeof structuredClone === "function") return structuredClone(layer);
  return JSON.parse(JSON.stringify(layer)) as SceneLayer;
}

function sceneHistoryKey(scene: GameScene) {
  return JSON.stringify(scene);
}

export default function App() {
  const [sprites, setSprites] = useState<AnimationSprite[]>(PRESET_SPRITES);
  const [activeSprite, setActiveSprite] = useState<AnimationSprite>(PRESET_SPRITES[0]);
  const [assets, setAssets] = useState<GameAsset[]>([]);
  const [repositoryImages, setRepositoryImages] = useState<RepositoryGeneratedImage[]>([]);
  const [scenes, setScenes] = useState<GameScene[]>([]);
  const [scene, setScene] = useState<GameScene>(() => prepareSceneForEditor(createDefaultScene()));
  const [selectedLayerId, setSelectedLayerId] = useState<string>("layer_ground");
  const [selectedInteractionZoneLayerId, setSelectedInteractionZoneLayerId] = useState<string | null>(null);
  const [appMode, setAppMode] = useState<AppMode>("home");
  const [tab, setTab] = useState<WorkspaceTab>("scenes");
  const [activeFrame, setActiveFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [heldDirection, setHeldDirection] = useState<HeldDirection>(null);
  const [fps, setFps] = useState(12);
  const [walkSpeed, setWalkSpeed] = useState(DEFAULT_WALK_SPEED);
  const [bgMode, setBgMode] = useState<BackgroundMode>("checker");
  const [sheetDataUrl, setSheetDataUrl] = useState<string | null>(null);
  const [sheetColumns, setSheetColumns] = useState(4);
  const [binding, setBinding] = useState<ActionBinding>(defaultBinding);
  const [role, setRole] = useState<AssetRole>("player");
  const [tagsText, setTagsText] = useState("confirmed, side-scroller");
  const [importSheetDataUrl, setImportSheetDataUrl] = useState<string | null>(null);
  const [importSheetSize, setImportSheetSize] = useState<[number, number] | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [importAssetName, setImportAssetName] = useState("Imported Animation");
  const [importActionName, setImportActionName] = useState("loop");
  const [importFrameWidth, setImportFrameWidth] = useState(256);
  const [importFrameHeight, setImportFrameHeight] = useState(256);
  const [importFrameCount, setImportFrameCount] = useState(12);
  const [importColumns, setImportColumns] = useState(4);
  const [importRole, setImportRole] = useState<AssetRole>("effect");
  const [importTriggerType, setImportTriggerType] = useState<ActionTriggerType>("auto");
  const [importTriggerValue, setImportTriggerValue] = useState(defaultTriggerValueForType("auto"));
  const [importGameState, setImportGameState] = useState(defaultGameStateForTrigger("auto", "loop"));
  const [importTagsText, setImportTagsText] = useState("imported, spritesheet");
  const [importLoop, setImportLoop] = useState(true);
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [layerDropTargetId, setLayerDropTargetId] = useState<string | null>(null);
  const [expandedSpritesheetKey, setExpandedSpritesheetKey] = useState<string | null>(null);
  const [scenePanelWidths, setScenePanelWidths] = useState({ layers: 120, inspector: 220 });
  const [stageShellSize, setStageShellSize] = useState({ width: 0, height: 0 });
  const [sceneControlsHeight, setSceneControlsHeight] = useState(0);
  const [sceneContextMenu, setSceneContextMenu] = useState<SceneContextMenuState | null>(null);
  const [sceneClipboard, setSceneClipboard] = useState<SceneLayerClipboard | null>(null);
  const [isLayerLibraryOpen, setIsLayerLibraryOpen] = useState(false);
  const [sheetOnlyHasSelection, setSheetOnlyHasSelection] = useState(false);
  const [sheetOnlySelectionKind, setSheetOnlySelectionKind] = useState<SheetOnlySelectionKind>(null);
  const [sheetOnlySelectionTitle, setSheetOnlySelectionTitle] = useState("");
  const [interactionToast, setInteractionToast] = useState("");
  const [isBackpackOpen, setIsBackpackOpen] = useState(false);
  const [vehiclePhase, setVehiclePhase] = useState<VehiclePhase>("approaching");
  const [notice, setNotice] = useState("Confirmed spritesheets can be saved as game action assets.");
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const scenePanelResizeRef = useRef<ScenePanelResizeState | null>(null);
  const layerDragRef = useRef<string | null>(null);
  const zoneDragRef = useRef<{ id: string; startPointerX: number; startPointerY: number; startOffsetX: number; startOffsetY: number } | null>(null);
  const zoneResizeRef = useRef<{ id: string; handle: ResizeHandle; anchorWorldX: number; anchorWorldY: number } | null>(null);
  const stageShellRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sceneGlobalControlsRef = useRef<HTMLDivElement | null>(null);
  const sceneStateRef = useRef<GameScene>(scene);
  const selectedLayerIdRef = useRef(selectedLayerId);
  const sceneHistoryPastRef = useRef<GameScene[]>([]);
  const sceneHistoryFutureRef = useRef<GameScene[]>([]);
  const sceneHistoryLastRef = useRef<GameScene | null>(null);
  const sceneHistoryNavigationRef = useRef(false);
  const scenePasteCountRef = useRef(0);
  const nearbyInteractionRef = useRef<any>(null);
  const triggerNearbyInteractionRef = useRef<(entry?: any) => void>(() => {});

  const frames = activeSprite.frames || [];
  const activeSpriteFrameIndex = frames.length ? activeFrame % frames.length : 0;
  const currentFrame = spriteFrame(activeSprite, activeFrame);
  const [frameW, frameH] = getFrameSize(activeSprite);
  const frameRatio = `${frameW} / ${frameH}`;
  const isTallFrame = frameH > frameW * 1.25;
  const selectedLayer = scene.layers.find(layer => layer.id === selectedLayerId);
  const backgroundLayer = scene.layers.find(layer => layer.type === "background");
  const groundLayer = scene.layers.find(layer => layer.type === "ground");

  useEffect(() => {
    if (selectedLayer || !scene.layers.length) return;
    const topLayer = [...scene.layers].sort((a, b) => b.zIndex - a.zIndex)[0];
    if (topLayer) setSelectedLayerId(topLayer.id);
  }, [scene.layers, selectedLayer]);
  const sceneLight = sceneLighting(scene);
  const selectedLayerLight = selectedLayer?.lighting || NEON_LAYER_LIGHTING;
  const selectedLayerShadow = selectedLayer?.shadow || NEON_CONTACT_SHADOW;
  const viewportWidth = sceneViewportWidth(scene);
  const viewportHeight = sceneViewportHeight(scene);
  const stageFitScale = (() => {
    if (!stageShellSize.width || !stageShellSize.height) return 1;
    const availableWidth = Math.max(180, stageShellSize.width - 28);
    const controlsSpace = sceneControlsHeight ? sceneControlsHeight + 32 : 112;
    const availableHeight = Math.max(180, stageShellSize.height - controlsSpace);
    return Math.min(1, availableWidth / Math.max(1, viewportWidth), availableHeight / Math.max(1, viewportHeight));
  })();
  const stageSize = {
    width: Math.max(1, Math.round(viewportWidth * stageFitScale)),
    height: Math.max(1, Math.round(viewportHeight * stageFitScale)),
  };
  const selectedViewportPreset = VIEWPORT_PRESETS.find(preset => preset.id === scene.viewportPreset);
  const viewportRatioLabel = formatViewportRatio(viewportWidth, viewportHeight);
  const cameraMax = Math.max(0, scene.width - viewportWidth);
  const stageScaleX = stageSize.width / Math.max(1, viewportWidth);
  const stageScaleY = stageSize.height / Math.max(1, viewportHeight);
  const spriteStageScale = Math.min(stageScaleX, stageScaleY);
  const compactScenePanels = stageShellSize.width > 0 && stageShellSize.width < 340;
  const sceneLayerPanelWidth = compactScenePanels ? Math.min(scenePanelWidths.layers, 84) : scenePanelWidths.layers;
  const sceneInspectorPanelWidth = compactScenePanels ? Math.min(scenePanelWidths.inspector, 148) : scenePanelWidths.inspector;
  const sceneCenterMinWidth = compactScenePanels ? 220 : 180;

  const allAssets = useMemo(() => {
    return [...SCENE_KIT_ASSETS, ...assets];
  }, [assets]);

  const assetById = useMemo(() => {
    return new Map(allAssets.map(asset => [asset.id, asset]));
  }, [allAssets]);

  const layerLibraryAssets = useMemo(() => {
    return assets.filter(asset => Boolean(resolveAssetSprite(asset)?.frames.length));
  }, [assets]);

  const selectedInteractionZoneLayer = selectedInteractionZoneLayerId
    ? scene.layers.find(layer => layer.id === selectedInteractionZoneLayerId)
    : undefined;
  const selectedInteractionZoneAsset = selectedInteractionZoneLayer?.assetId
    ? assetById.get(selectedInteractionZoneLayer.assetId)
    : undefined;
  const selectedInteractionZoneSettings = selectedInteractionZoneLayer
    ? layerInteractionSettings(selectedInteractionZoneLayer, selectedInteractionZoneAsset)
    : null;

  useEffect(() => {
    if (!selectedInteractionZoneLayerId) return;
    if (scene.layers.some(layer => layer.id === selectedInteractionZoneLayerId && layer.interaction?.enabled)) return;
    setSelectedInteractionZoneLayerId(null);
  }, [scene.layers, selectedInteractionZoneLayerId]);

  const sceneSpritesheetEntries = useMemo<SceneSpritesheetEntry[]>(() => {
    return scene.layers
      .filter(layer => layer.assetId && isSceneVisualLayer(layer))
      .flatMap(layer => {
        const asset = assetById.get(layer.assetId!);
        if (!asset) return [];
        const clips = asset.animations?.length ? asset.animations : [undefined];
        return clips.map(clip => {
          const sprite = clip?.sprite || asset.sprite;
          const [frameWidth, frameHeight] = getFrameSize(sprite);
          return {
            key: `${layer.id}_${clip?.id || asset.sprite.id}`,
            layer,
            asset,
            clip,
            sprite,
            frameWidth,
            frameHeight,
          };
        });
      });
  }, [assetById, scene.layers]);

  const sheetOnlyEntries = useMemo(() => buildSheetOnlyEntries({
    assets,
    repositoryImages,
    sprites,
  }), [assets, repositoryImages, sprites]);

  const selectedLayerAsset = selectedLayer?.assetId ? assetById.get(selectedLayer.assetId) : undefined;
  const selectedLayerClip = resolveAssetClip(selectedLayerAsset, selectedLayer);
  const selectedLayerInteraction = selectedLayer ? layerInteractionSettings(selectedLayer, selectedLayerAsset) : null;
  const selectedLayerSprite = resolveAssetSprite(selectedLayerAsset, selectedLayer);
  const selectedAssetEditable = Boolean(selectedLayerAsset && assets.some(asset => asset.id === selectedLayerAsset.id));
  const selectedLayerSpriteFrameIndex = selectedLayerSprite?.frames.length ? activeFrame % selectedLayerSprite.frames.length : 0;
  const selectedLayerFrameSize = selectedLayerSprite ? getFrameSize(selectedLayerSprite) : [0, 0];
  const selectedLayerSpriteFrameCount = spriteFrameTotal(selectedLayerSprite);
  const selectedLayerSpriteColumns = spriteGridColumns(selectedLayerSprite);
  const selectedLayerSpriteRows = spriteGridRows(selectedLayerSprite);
  const selectedLayerSpriteSheetSize = selectedLayerSprite?.sheetSize || selectedLayerFrameSize;
  const selectedLayerSpriteSource = selectedLayerSprite?.rawSpritesheetPng || selectedLayerSprite?.spritesheetPng || "";
  const selectedLayerClipFps = Math.round(selectedLayerClip?.fps || selectedLayerSprite?.fps || fps);
  const selectedLayerSpriteEditableGrid = Boolean(selectedAssetEditable && selectedLayerSpriteSource && selectedLayerSprite?.sheetSize?.length);
  const selectedLayerIsAvatar = selectedLayerAsset?.role === "player" || selectedLayerAsset?.role === "npc";
  const savedSceneCards = useMemo(() => scenes.filter(savedScene => savedScene.id !== scene.id), [scene.id, scenes]);
  const hasVisibleBackgroundImage = Boolean(backgroundLayer?.visible && backgroundLayer.imageUrl);
  const sceneFlowNodes = useMemo(() => buildSceneFlowNodes({
    currentScene: scene,
    currentBackground: backgroundLayer,
    savedScenes: savedSceneCards,
  }), [backgroundLayer, savedSceneCards, scene]);
  const sceneFrameCount = useMemo(() => {
    return scene.layers.reduce((maxFrameCount, layer) => {
      if (!layer.visible || !isSceneVisualLayer(layer)) return maxFrameCount;
      const asset = layer.assetId ? assetById.get(layer.assetId) : undefined;
      const sprite = resolveAssetSprite(asset, layer);
      return Math.max(maxFrameCount, sprite?.frames.length || 0);
    }, activeSprite.frames.length || 0);
  }, [activeSprite.frames.length, assetById, scene.layers]);
  const sceneHasAutoPlayingLayer = useMemo(() => {
    return scene.layers.some(layer => {
      if (!layer.visible || !isSceneVisualLayer(layer)) return false;
      const asset = layer.assetId ? assetById.get(layer.assetId) : undefined;
      const clip = resolveAssetClip(asset, layer);
      return clip?.loop === true && clip.binding?.triggerType === "auto";
    });
  }, [assetById, scene.layers]);
  const hasBoardingTrainLayer = useMemo(() => {
    return scene.layers.some(layer => layer.visible && layer.assetId === BOARDING_TRAIN_ASSET_ID);
  }, [scene.layers]);
  const nearbyInteraction = useMemo(() => {
    const playerLayer = scene.layers.find(layer => {
      if (!layer.visible || !layer.assetId || !isSceneVisualLayer(layer)) return false;
      return assetById.get(layer.assetId)?.role === "player";
    });
    if (!playerLayer) return null;
    const playerAsset = assetById.get(playerLayer.assetId!);
    const playerBounds = layerWorldBounds(playerLayer, playerAsset);
    const interactableLayers = scene.layers
      .filter(layer => layer.visible && layer.assetId && isSceneVisualLayer(layer))
      .map(layer => {
        const asset = assetById.get(layer.assetId!);
        if (!asset) return null;
        const interaction = layerInteractionSettings(layer, asset);
        if (!interaction?.enabled || asset.role === "player") return null;
        if (asset.id === BOARDING_TRAIN_ASSET_ID && vehiclePhase !== "ready") return null;
        const bounds = interactionZoneBounds(layer, asset, interaction);
        const dx = Math.max(bounds.left - playerBounds.centerX, playerBounds.centerX - bounds.right, 0);
        const dy = Math.max(bounds.top - playerBounds.centerY, playerBounds.centerY - bounds.bottom, 0);
        const distance = Math.hypot(dx, dy);
        return { layer, asset, bounds, distance, interaction };
      })
      .filter(Boolean)
      .sort((a, b) => a!.distance - b!.distance);
    const nearest = interactableLayers[0];
    if (!nearest || nearest.distance > nearest.interaction.triggerRadius) return null;
    return nearest;
  }, [assetById, scene.layers, vehiclePhase]);

  const scenePayload = useMemo(() => ({ ...scene, layers: [...scene.layers] }), [scene]);

  useEffect(() => {
    sceneStateRef.current = scene;
  }, [scene]);

  useEffect(() => {
    selectedLayerIdRef.current = selectedLayerId;
  }, [selectedLayerId]);

  useEffect(() => {
    const previousScene = sceneHistoryLastRef.current;
    const nextSnapshot = cloneSceneForHistory(scene);
    const isAutomaticSceneMotion = isPlaying || Boolean(heldDirection);

    if (!previousScene) {
      sceneHistoryLastRef.current = nextSnapshot;
      return;
    }

    if (previousScene.id !== scene.id) {
      sceneHistoryPastRef.current = [];
      sceneHistoryFutureRef.current = [];
      sceneHistoryLastRef.current = nextSnapshot;
      sceneHistoryNavigationRef.current = false;
      return;
    }

    if (sceneHistoryNavigationRef.current) {
      sceneHistoryNavigationRef.current = false;
      sceneHistoryLastRef.current = nextSnapshot;
      return;
    }

    if (sceneHistoryKey(previousScene) === sceneHistoryKey(scene)) {
      sceneHistoryLastRef.current = nextSnapshot;
      return;
    }

    if (!isAutomaticSceneMotion) {
      sceneHistoryPastRef.current = [...sceneHistoryPastRef.current, previousScene].slice(-SCENE_HISTORY_LIMIT);
      sceneHistoryFutureRef.current = [];
    }
    sceneHistoryLastRef.current = nextSnapshot;
  }, [heldDirection, isPlaying, scene]);

  useEffect(() => {
    if (!sceneContextMenu) return;
    const closeMenu = () => setSceneContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [sceneContextMenu]);

  useEffect(() => {
    const element = stageShellRef.current;
    const controls = sceneGlobalControlsRef.current;
    if (!element) return;
    const updateStageShellSize = () => {
      setStageShellSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
      setSceneControlsHeight(controls?.offsetHeight || 0);
    };
    updateStageShellSize();
    const observer = new ResizeObserver(updateStageShellSize);
    observer.observe(element);
    if (controls) observer.observe(controls);
    window.addEventListener("resize", updateStageShellSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateStageShellSize);
    };
  }, [tab, scenePanelWidths.layers, scenePanelWidths.inspector]);

  useEffect(() => {
    const handleMove = (event: globalThis.PointerEvent) => {
      if (layerDragRef.current) {
        const targetLayerId = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest<HTMLElement>("[data-layer-row-id]")
          ?.dataset.layerRowId;
        setLayerDropTargetId(targetLayerId && targetLayerId !== layerDragRef.current ? targetLayerId : null);
      }

      const resize = scenePanelResizeRef.current;
      if (!resize) return;
      const deltaX = event.clientX - resize.startX;
      setScenePanelWidths({
        layers: resize.handle === "layers"
          ? clamp(resize.startLayerWidth + deltaX, 88, 260)
          : resize.startLayerWidth,
        inspector: resize.handle === "inspector"
          ? clamp(resize.startInspectorWidth - deltaX, 150, 360)
          : resize.startInspectorWidth,
      });
    };
    const handleUp = (event: globalThis.PointerEvent) => {
      if (layerDragRef.current) {
        finishLayerPointerReorder(event.clientX, event.clientY);
      }
      scenePanelResizeRef.current = null;
      document.body.classList.remove("resizing-scene-panels");
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, []);

  useEffect(() => {
    nearbyInteractionRef.current = nearbyInteraction;
  }, [nearbyInteraction]);

  useEffect(() => {
    const hasBuiltInSceneKitLayer = scene.layers.some(layer => layer.assetId && BUILT_IN_SCENE_KIT_ASSET_IDS.has(layer.assetId));
    if (!hasBuiltInSceneKitLayer) return;
    setScene(prev => prepareSceneForEditor(prev));
    setIsBackpackOpen(false);
  }, [scene.layers]);

  useEffect(() => {
    if (!interactionToast) return;
    const id = window.setTimeout(() => setInteractionToast(""), 1800);
    return () => window.clearTimeout(id);
  }, [interactionToast]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchLatestSprite().catch(() => null),
      fetchGameLibrary().catch(() => ({ assets: [], scenes: [] })),
      fetchGeneratedAssets().catch(() => []),
    ]).then(([latestSprite, libraryData, generatedFiles]: [AnimationSprite | null, GameLibrary, RepositoryGeneratedImage[]]) => {
      if (cancelled) return;
      if (latestSprite) {
        setSprites(prev => [latestSprite, ...prev.filter(sprite => sprite.id !== latestSprite.id)]);
        setActiveSprite(latestSprite);
      }
      if (Array.isArray(libraryData.assets)) setAssets(libraryData.assets);
      setRepositoryImages(generatedFiles);
      if (Array.isArray(libraryData.scenes) && libraryData.scenes.length) {
        const firstScene = libraryData.scenes[0];
        setScenes(libraryData.scenes.map(prepareSceneForEditor));
        setScene(prepareSceneForEditor(firstScene));
        setSelectedLayerId("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const playbackFrameCount = Math.max(1, sceneFrameCount);
    if ((!isPlaying && !sceneHasAutoPlayingLayer) || playbackFrameCount <= 1) return;
    const id = window.setInterval(() => {
      setActiveFrame(prev => (prev + 1) % playbackFrameCount);
    }, 1000 / Math.max(1, selectedLayerClipFps));
    return () => window.clearInterval(id);
  }, [isPlaying, sceneHasAutoPlayingLayer, sceneFrameCount, selectedLayerClipFps, activeSprite.id]);

  useEffect(() => {
    setActiveFrame(0);
    setSheetColumns(Math.min(4, activeSprite.frames.length || 4));
    setSheetDataUrl(activeSprite.spritesheetPng || null);
  }, [activeSprite.id]);

  const triggerNearbyInteraction = (entry = nearbyInteractionRef.current || nearbyInteraction) => {
    if (!entry) return;
    if (entry.asset.id === BOARDING_TRAIN_ASSET_ID) {
      setVehiclePhase("boarded");
      setHeldDirection(null);
      setScene(prev => ({
        ...prev,
        layers: prev.layers.map(layer => {
          if (!layer.assetId) return layer;
          const asset = assetById.get(layer.assetId);
          if (asset?.role === "player") return { ...layer, opacity: 0.18 };
          if (layer.assetId === BOARDING_TRAIN_ASSET_ID) return { ...layer, zIndex: Math.max(layer.zIndex, 92) };
          return layer;
        }),
      }));
      setInteractionToast("Boarded the subway car");
      setNotice("Boarding triggered from the eye prompt. This vehicle can now be used as a scene-transition hook.");
      return;
    }
    const { layer, asset, interaction } = entry;
    const promptText = interaction.promptText || layer.name;
    const stateBag = sceneStateRef.current.state || {};
    const conditionKey = interaction.conditionStateKey?.trim();
    if (conditionKey && !stateMatches(stateBag[conditionKey], interaction.conditionStateValue)) {
      const failText = interaction.failSubtitle || "It does not seem ready yet.";
      setInteractionToast(failText);
      setNotice(`Interaction blocked by state: ${conditionKey}`);
      return;
    }

    const actionType = interaction.actionType || "subtitle";
    const subtitle = interaction.subtitle || promptText;
    if (actionType === "pickup-item") {
      const itemId = (interaction.itemId || safeName(layer.name)).trim();
      setScene(prev => ({
        ...prev,
        state: { ...(prev.state || {}), [itemId]: true },
        layers: prev.layers.map(item =>
          item.id === layer.id && interaction.hideLayerOnPickup !== false
            ? { ...item, visible: false }
            : item
        ),
      }));
      setSelectedLayerId("");
      setInteractionToast(subtitle || `Picked up ${layer.name}.`);
      setNotice(`Pickup stored in scene state: ${itemId}=true`);
      return;
    }

    if (actionType === "toggle-layer") {
      const targetLayerId = interaction.targetLayerId || layer.id;
      setScene(prev => ({
        ...prev,
        layers: prev.layers.map(item => item.id === targetLayerId ? { ...item, visible: !item.visible } : item),
      }));
      setInteractionToast(subtitle);
      setNotice(`Toggled layer visibility: ${targetLayerId}`);
      return;
    }

    if (actionType === "play-animation") {
      const targetLayerId = interaction.targetLayerId || layer.id;
      const targetLayer = sceneStateRef.current.layers.find(item => item.id === targetLayerId) || layer;
      const targetAsset = targetLayer.assetId ? assetById.get(targetLayer.assetId) : asset;
      const targetClip =
        targetAsset?.animations?.find(clip => clip.id === interaction.targetAnimationId) ||
        targetAsset?.animations?.find(clip => clip.id === targetAsset.defaultAnimationId) ||
        targetAsset?.animations?.[0];
      if (targetClip) {
        setScene(prev => ({
          ...prev,
          layers: prev.layers.map(item => item.id === targetLayerId ? { ...item, activeAnimationId: targetClip.id } : item),
        }));
        setActiveSprite(targetClip.sprite);
        setActiveFrame(0);
        setIsPlaying(true);
        setInteractionToast(subtitle);
        setNotice(`Played interaction animation: ${targetClip.name}`);
        return;
      }
    }

    if (actionType === "scene-link") {
      const targetScene = interaction.targetSceneId ? scenes.find(item => item.id === interaction.targetSceneId) : undefined;
      if (targetScene) {
        setInteractionToast(subtitle);
        loadSavedScene(targetScene);
        return;
      }
      setInteractionToast(interaction.failSubtitle || "No target scene is assigned yet.");
      setNotice("Scene-link interaction needs a target scene.");
      return;
    }

    if (actionType === "set-state") {
      const key = (interaction.setStateKey || conditionKey || safeName(promptText)).trim();
      const value = stateValueFromText(interaction.setStateValue || "true");
      setScene(prev => ({ ...prev, state: { ...(prev.state || {}), [key]: value } }));
      setInteractionToast(subtitle);
      setNotice(`Scene state updated: ${key}=${String(value)}`);
      return;
    }

    setInteractionToast(subtitle);
    setNotice(`Inspect triggered: ${promptText}`);
  };

  useEffect(() => {
    triggerNearbyInteractionRef.current = triggerNearbyInteraction;
  }, [triggerNearbyInteraction]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "KeyI") {
        event.preventDefault();
        if (event.repeat) return;
        setIsBackpackOpen(value => !value);
        setNotice("Backpack inventory toggled.");
        return;
      }

      const activeNearbyInteraction = nearbyInteractionRef.current;
      if (activeNearbyInteraction?.interaction?.triggerMode === "near-key") {
        const configuredKey = String(activeNearbyInteraction.interaction.promptKey || "KeyE").trim();
        const normalizedCode = configuredKey.length === 1 ? `Key${configuredKey.toUpperCase()}` : configuredKey;
        if (
          event.code.toLowerCase() === normalizedCode.toLowerCase() ||
          event.key.toLowerCase() === configuredKey.toLowerCase()
        ) {
          event.preventDefault();
          if (event.repeat) return;
          triggerNearbyInteractionRef.current(activeNearbyInteraction);
          return;
        }
      }

      const matchedLayer = sceneStateRef.current.layers
        .filter(layer => layer.visible && isSceneVisualLayer(layer) && layer.assetId)
        .map(layer => {
          const asset = assetById.get(layer.assetId!);
          const clip = asset?.animations?.find(item =>
            item.binding?.triggerType === "keyboard" &&
            item.binding.triggerValue.toLowerCase() === event.code.toLowerCase()
          );
          return asset && clip ? { layer, asset, clip } : null;
        })
        .find(Boolean);

      if (matchedLayer) {
        event.preventDefault();
        if (matchedLayer.clip.direction === "left" || matchedLayer.clip.direction === "right") {
          setHeldDirection(matchedLayer.clip.direction);
        }
        if (event.repeat) return;
        setScene(prev => ({
          ...prev,
          layers: prev.layers.map(layer => layer.id === matchedLayer.layer.id ? { ...layer, activeAnimationId: matchedLayer.clip.id } : layer),
        }));
        setActiveSprite(matchedLayer.clip.sprite);
        setActiveFrame(0);
        setIsPlaying(true);
        setNotice(`Keyboard ${matchedLayer.clip.binding?.triggerValue} triggered action: ${matchedLayer.clip.name}`);
        return;
      }

      const matched = assets.find(asset =>
        !asset.animations?.length &&
        asset.binding.triggerType === "keyboard" &&
        asset.binding.triggerValue.toLowerCase() === event.code.toLowerCase()
      );
      if (!matched) return;
      event.preventDefault();
      if (event.repeat) return;
      setActiveSprite(matched.sprite);
      setActiveFrame(0);
      setIsPlaying(true);
      setNotice(`Keyboard ${matched.binding.triggerValue} triggered action: ${matched.binding.actionName}`);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const matchedLayer = sceneStateRef.current.layers
        .filter(layer => layer.visible && isSceneVisualLayer(layer) && layer.assetId)
        .map(layer => {
          const asset = assetById.get(layer.assetId!);
          const triggeredClip = asset?.animations?.find(item =>
            item.binding?.triggerType === "keyboard" &&
            item.binding.triggerValue.toLowerCase() === event.code.toLowerCase()
          );
          if (!asset || !triggeredClip) return null;
          const idleClip =
            asset.animations?.find(item => item.id === asset.defaultAnimationId) ||
            asset.animations?.find(item => item.actionName === "idle");
          return idleClip ? { layer, idleClip } : null;
        })
        .find(Boolean);

      if (!matchedLayer) return;
      event.preventDefault();
      setHeldDirection(null);
      setScene(prev => ({
        ...prev,
        layers: prev.layers.map(layer => layer.id === matchedLayer.layer.id ? { ...layer, activeAnimationId: matchedLayer.idleClip.id } : layer),
      }));
      setActiveSprite(matchedLayer.idleClip.sprite);
      setActiveFrame(0);
      setIsPlaying(true);
      setNotice("Key released. Returning to idle breathing.");
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [assetById, assets]);

  useEffect(() => {
    if (!heldDirection) return;
    let frameId = 0;
    let lastTime = performance.now();
    const step = (time: number) => {
      const delta = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;
      setScene(prev => {
        const viewportW = sceneViewportWidth(prev);
        const maxCameraX = Math.max(0, prev.width - viewportW);
        const direction = heldDirection === "left" ? -1 : 1;
        let focusX: number | null = null;
        const layers = prev.layers.map(layer => {
          if (!layer.assetId) return layer;
          const asset = assetById.get(layer.assetId);
          if (asset?.role !== "player") return layer;
          const sprite = resolveAssetSprite(asset, layer);
          const [spriteW] = sprite ? getFrameSize(sprite) : [0, 0];
          const layerWidth = spriteW * layer.scale;
          const nextX = clamp(layer.x + direction * walkSpeed * delta, 0, Math.max(0, prev.width - layerWidth));
          focusX = nextX + layerWidth * 0.5;
          return { ...layer, x: Number(nextX.toFixed(2)) };
        });
        if (focusX === null) return prev;
        const nextCameraX = clamp(focusX - viewportW * 0.42, 0, maxCameraX);
        return { ...prev, cameraX: Number(nextCameraX.toFixed(2)), layers };
      });
      frameId = window.requestAnimationFrame(step);
    };
    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [assetById, heldDirection, walkSpeed]);

  useEffect(() => {
    if (vehiclePhase !== "approaching" || !hasBoardingTrainLayer) return;
    let frameId = 0;
    let lastTime = performance.now();
    const step = (time: number) => {
      const delta = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;
      let arrived = false;
      setScene(prev => {
        const viewportW = sceneViewportWidth(prev);
        const trainAsset = assetById.get(BOARDING_TRAIN_ASSET_ID);
        const playerLayer = prev.layers.find(layer => {
          if (!layer.visible || !layer.assetId || !isSceneVisualLayer(layer)) return false;
          return assetById.get(layer.assetId)?.role === "player";
        });
        const playerAsset = playerLayer?.assetId ? assetById.get(playerLayer.assetId) : undefined;
        const playerBounds = playerLayer ? layerWorldBounds(playerLayer, playerAsset) : null;
        const layers = prev.layers.map(layer => {
          if (layer.assetId !== BOARDING_TRAIN_ASSET_ID) return layer;
          const bounds = layerWorldBounds(layer, trainAsset);
          const maxLayerX = Math.max(40, prev.width - bounds.width);
          const targetX = playerBounds
            ? clamp(playerBounds.centerX - bounds.width * 0.46, 40, maxLayerX)
            : clamp(prev.cameraX + viewportW * 0.28, 40, maxLayerX);
          const nextX = Math.max(targetX, layer.x - 330 * delta);
          if (Math.abs(nextX - targetX) < 3) arrived = true;
          return { ...layer, x: Number(nextX.toFixed(2)) };
        });
        return { ...prev, layers };
      });
      if (arrived) {
        setVehiclePhase("ready");
        setInteractionToast("Subway car stopped");
        setNotice("The subway car has stopped in front of the player. Click the eye prompt to board.");
        return;
      }
      frameId = window.requestAnimationFrame(step);
    };
    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [assetById, hasBoardingTrainLayer, vehiclePhase]);

  const updateSceneLayer = (layerId: string, patch: Partial<SceneLayer>) => {
    setScene(prev => ({
      ...prev,
      layers: prev.layers.map(layer => layer.id === layerId ? { ...layer, ...patch } : layer),
    }));
  };

  const setLayerAnimation = (layerId: string, clip: AnimationClip) => {
    updateSceneLayer(layerId, { activeAnimationId: clip.id });
    setActiveSprite(clip.sprite);
    setActiveFrame(0);
    setIsPlaying(true);
    setNotice(`Switched action: ${clip.name}`);
  };

  const previewSceneSpritesheetEntry = (entry: SceneSpritesheetEntry, openScene = false) => {
    updateSceneLayer(entry.layer.id, { activeAnimationId: entry.clip?.id || entry.layer.activeAnimationId });
    setSelectedLayerId(entry.layer.id);
    setActiveSprite(entry.sprite);
    setActiveFrame(0);
    setIsPlaying(true);
    setExpandedSpritesheetKey(entry.key);
    if (openScene) setTab("scene");
    setNotice(`Previewing ${entry.asset.name} on layer ${entry.layer.name}.`);
  };

  const updateAssetMetadata = (assetId: string, patch: Partial<GameAsset>) => {
    if (!assets.some(asset => asset.id === assetId)) {
      setNotice("Built-in scene kit assets can be layered and animated, but save a copy before editing their library metadata.");
      return;
    }
    setAssets(prev => prev.map(asset => asset.id === assetId ? { ...asset, ...patch, updatedTime: new Date().toISOString() } : asset));
  };

  const updateAssetClipMetadata = (
    assetId: string,
    clipId: string,
    patch: Partial<AnimationClip>,
    bindingPatch?: Partial<ActionBinding>
  ) => {
    if (!assets.some(asset => asset.id === assetId)) {
      setNotice("Built-in scene kit assets can be previewed here, but their metadata is read-only.");
      return;
    }
    setAssets(prev => prev.map(asset => {
      if (asset.id !== assetId || !asset.animations?.length) return asset;
      const animations = asset.animations.map(clip => {
        if (clip.id !== clipId) return clip;
        return {
          ...clip,
          ...patch,
          binding: { ...clip.binding, ...bindingPatch },
        };
      });
      const defaultClip =
        animations.find(clip => clip.id === asset.defaultAnimationId) ||
        animations[0];
      return {
        ...asset,
        animations,
        sprite: defaultClip?.sprite || asset.sprite,
        binding: defaultClip?.binding || asset.binding,
        updatedTime: new Date().toISOString(),
      };
    }));
  };

  const replaceSpriteInAsset = (asset: GameAsset, spriteId: string, nextSprite: AnimationSprite): GameAsset => {
    const animations = asset.animations?.map(clip => (
      clip.sprite.id === spriteId ? { ...clip, sprite: nextSprite } : clip
    ));
    return {
      ...asset,
      sprite: asset.sprite.id === spriteId ? nextSprite : asset.sprite,
      animations,
      updatedTime: new Date().toISOString(),
    };
  };

  const updateSelectedSpriteMetadata = (patch: Partial<AnimationSprite>) => {
    if (!selectedLayerAsset || !selectedLayerSprite) return;
    if (!selectedAssetEditable) {
      setNotice("Built-in spritesheet metadata is read-only. Import or save a copy before editing it.");
      return;
    }
    const nextSprite = { ...selectedLayerSprite, ...patch };
    setAssets(prev => prev.map(asset => (
      asset.id === selectedLayerAsset.id ? replaceSpriteInAsset(asset, selectedLayerSprite.id, nextSprite) : asset
    )));
    if (activeSprite.id === selectedLayerSprite.id) setActiveSprite(nextSprite);
  };

  const updateSelectedSpritesheetFps = (nextValue: number) => {
    const nextFps = Math.max(1, Math.round(nextValue));
    setFps(nextFps);
    if (!selectedLayerAsset || !selectedAssetEditable) return;
    if (selectedLayerClip) {
      updateAssetClipMetadata(selectedLayerAsset.id, selectedLayerClip.id, { fps: nextFps });
      return;
    }
    updateSelectedSpriteMetadata({ fps: nextFps });
  };

  const rebuildSelectedSpritesheetGrid = (patch: {
    frameWidth?: number;
    frameHeight?: number;
    frameCount?: number;
    columns?: number;
  }) => {
    if (!selectedLayerAsset || !selectedLayerSprite) return;
    if (!selectedLayerSpriteEditableGrid) {
      setNotice("Only imported spritesheet images can rebuild their frame grid here.");
      return;
    }
    const source = selectedLayerSpriteSource;
    const [currentFrameWidth, currentFrameHeight] = selectedLayerFrameSize;
    const [sheetWidth, sheetHeight] = selectedLayerSpriteSheetSize;
    const frameWidth = Math.max(1, Math.round(patch.frameWidth ?? currentFrameWidth));
    const frameHeight = Math.max(1, Math.round(patch.frameHeight ?? currentFrameHeight));
    const frameCount = Math.max(1, Math.round(patch.frameCount ?? selectedLayerSpriteFrameCount));
    const columns = Math.max(1, Math.round(patch.columns ?? selectedLayerSpriteColumns));
    const rows = Math.max(1, Math.ceil(frameCount / columns));

    if (columns * frameWidth > sheetWidth + 1 || rows * frameHeight > sheetHeight + 1) {
      setNotice("Frame grid is larger than the spritesheet image. Reduce frame size, frame count, or columns.");
      return;
    }

    const nextSprite: AnimationSprite = {
      ...selectedLayerSprite,
      frameCount,
      frames: buildSpritesheetFrames(source, sheetWidth, sheetHeight, frameWidth, frameHeight, frameCount, columns),
      frameSize: [frameWidth, frameHeight],
      sheetSize: [sheetWidth, sheetHeight],
      gridColumns: columns,
      adaptiveFramePolicy: `${columns} columns, ${rows} rows, ${frameCount} active frames.`,
      updatedTime: new Date().toISOString(),
    } as AnimationSprite;

    setAssets(prev => prev.map(asset => (
      asset.id === selectedLayerAsset.id ? replaceSpriteInAsset(asset, selectedLayerSprite.id, nextSprite) : asset
    )));
    if (activeSprite.id === selectedLayerSprite.id) setActiveSprite(nextSprite);
    setActiveFrame(prev => Math.min(prev, frameCount - 1));
    setNotice(`Updated spritesheet grid: ${frameCount} frames / ${frameWidth} x ${frameHeight}.`);
  };

  const saveAssetMetadata = async (assetId: string) => {
    const asset = assets.find(item => item.id === assetId);
    if (!asset) {
      setNotice("This asset is built in. Save it as a confirmed asset first if you want persistent metadata edits.");
      return;
    }
    setError(null);
    try {
      const response = await fetch("/api/game-library/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save asset metadata");
      setAssets(data.library.assets);
      setNotice(`Saved spritesheet metadata: ${asset.name}`);
    } catch (err: any) {
      setError(err.message || "Failed to save asset metadata");
    }
  };

  const updateSceneLighting = (patch: Partial<NonNullable<GameScene["lighting"]>>) => {
    setScene(prev => ({
      ...prev,
      lighting: { ...NEON_SCENE_LIGHTING, ...prev.lighting, ...patch },
    }));
  };

  const updateSelectedLayerLighting = (patch: Partial<NonNullable<SceneLayer["lighting"]>>) => {
    if (!selectedLayer || selectedLayer.locked || !isSceneVisualLayer(selectedLayer)) return;
    updateSceneLayer(selectedLayer.id, {
      lighting: { ...NEON_LAYER_LIGHTING, ...selectedLayer.lighting, ...patch },
    });
  };

  const updateSelectedLayerShadow = (patch: Partial<NonNullable<SceneLayer["shadow"]>>) => {
    if (!selectedLayer || selectedLayer.locked || !isSceneVisualLayer(selectedLayer)) return;
    updateSceneLayer(selectedLayer.id, {
      shadow: { ...NEON_CONTACT_SHADOW, ...selectedLayer.shadow, ...patch },
    });
  };

  const updateLayerInteraction = (layerId: string, patch: Partial<LayerInteractionSettings>) => {
    setScene(prev => ({
      ...prev,
      layers: prev.layers.map(layer => {
        if (layer.id !== layerId || layer.locked || !isSceneVisualLayer(layer)) return layer;
        const asset = layer.assetId ? assetById.get(layer.assetId) : undefined;
        const base = layerInteractionSettings(layer, asset) || DEFAULT_INTERACTION_SETTINGS;
        return {
          ...layer,
          interaction: { ...base, ...layer.interaction, ...patch },
        };
      }),
    }));
  };

  const updateSelectedLayerInteraction = (patch: Partial<LayerInteractionSettings>) => {
    if (!selectedLayer || selectedLayer.locked || !isSceneVisualLayer(selectedLayer)) return;
    updateLayerInteraction(selectedLayer.id, patch);
  };

  const applyInteractionPreset = (preset: InteractionPreset) => {
    if (!selectedLayer || selectedLayer.locked || !isSceneVisualLayer(selectedLayer)) return;
    const { label, ...presetPatch } = INTERACTION_PRESETS[preset];
    const base = layerInteractionSettings(selectedLayer, selectedLayerAsset) || DEFAULT_INTERACTION_SETTINGS;
    const bounds = layerWorldBounds(selectedLayer, selectedLayerAsset);
    const keyName = safeName(selectedLayer.name || label);
    updateSceneLayer(selectedLayer.id, {
      interaction: {
        ...base,
        ...selectedLayer.interaction,
        ...presetPatch,
        enabled: true,
        zoneWidth: selectedLayer.interaction?.zoneWidth || Math.round(bounds.width || 160),
        zoneHeight: selectedLayer.interaction?.zoneHeight || Math.round(bounds.height || 120),
        itemId: preset === "pickup" ? selectedLayer.interaction?.itemId || keyName : selectedLayer.interaction?.itemId,
        setStateKey: preset === "conditional" ? selectedLayer.interaction?.setStateKey || keyName : selectedLayer.interaction?.setStateKey,
        promptKey: presetPatch.triggerMode === "near-key" ? selectedLayer.interaction?.promptKey || "KeyE" : selectedLayer.interaction?.promptKey || base.promptKey,
      },
    });
    setNotice(`Applied interaction preset: ${label}`);
  };

  const updateSceneFrame = (patch: Partial<Pick<GameScene, "viewportWidth" | "viewportHeight" | "viewportPreset">>) => {
    setScene(prev => {
      const requestedViewportWidth = patch.viewportWidth || prev.viewportWidth || VIEWPORT_WIDTH;
      const requestedViewportHeight = patch.viewportHeight || prev.viewportHeight || prev.height;
      const nextSceneWidth = Math.max(prev.width, requestedViewportWidth);
      const nextSceneHeight = Math.max(prev.height, requestedViewportHeight);
      const nextViewportWidth = Math.min(requestedViewportWidth, nextSceneWidth);
      const nextViewportHeight = requestedViewportHeight;
      return {
        ...prev,
        ...patch,
        width: nextSceneWidth,
        height: nextSceneHeight,
        viewportWidth: nextViewportWidth,
        viewportHeight: nextViewportHeight,
        cameraX: clamp(prev.cameraX, 0, Math.max(0, nextSceneWidth - nextViewportWidth)),
        layers: prev.layers.map(layer => {
          if (layer.type !== "background") return layer;
          const followsWorldWidth = !layer.width || Math.abs(layer.width - prev.width) <= 2;
          const followsWorldHeight = !layer.height || Math.abs(layer.height - prev.height) <= 2;
          return {
            ...layer,
            width: followsWorldWidth ? nextSceneWidth : layer.width,
            height: followsWorldHeight ? nextSceneHeight : layer.height,
            y: followsWorldHeight && Math.abs(layer.y - prev.height) <= 2 ? nextSceneHeight : layer.y,
          };
        }),
      };
    });
  };

  const saveAsset = async () => {
    setError(null);
    try {
      const asset = createAsset(activeSprite, role, binding, tagsText);
      const response = await fetch("/api/game-library/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save asset");
      setAssets(data.library.assets);
      setNotice(`Saved action asset: ${asset.name}`);
    } catch (err: any) {
      setError(err.message || "Failed to save asset");
    }
  };

  const deleteAsset = async (assetId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/game-library/assets/${assetId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to delete asset");
      setAssets(data.library.assets);
      setScenes(data.library.scenes);
      setScene(prev => ({ ...prev, layers: prev.layers.filter(layer => layer.assetId !== assetId) }));
      setNotice("Removed from the asset library.");
    } catch (err: any) {
      setError(err.message || "Failed to delete asset");
    }
  };

  const insertAssetLayer = (asset: GameAsset, overrides: Partial<SceneLayer> = {}) => {
    const assetSprite = resolveAssetSprite(asset);
    const [, assetHeight] = assetSprite ? getFrameSize(assetSprite) : [256, 256];
    const targetHeight = asset.role === "effect" ? 150 : asset.role === "player" ? 300 : 220;
    const defaultScale = clampLayerScale(targetHeight / Math.max(1, assetHeight));
    const layer: SceneLayer = {
      id: `layer_${safeName(asset.binding.actionName)}_${Date.now()}`,
      name: asset.name,
      type: asset.role === "effect" ? "effect" : "sprite",
      visible: true,
      assetId: asset.id,
      activeAnimationId: asset.defaultAnimationId || asset.animations?.[0]?.id,
      x: Math.round(scene.width * 0.45),
      y: scene.groundY + 2,
      scale: defaultScale,
      zIndex: asset.role === "effect" ? 42 : 30,
      opacity: 1,
      parallax: 1,
      ...overrides,
    };
    setScene(prev => ({ ...prev, layers: [...prev.layers, layer] }));
    setSelectedLayerId(layer.id);
    setSelectedInteractionZoneLayerId(null);
    if (assetSprite) {
      setActiveSprite(assetSprite);
      setActiveFrame(0);
    }
    setIsLayerLibraryOpen(false);
    setTab("scene");
    setNotice(`Inserted layer: ${asset.name}`);
  };

  const handleLayerImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file to add as a static object.");
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const image = new Image();
      image.onload = async () => {
        const now = new Date().toISOString();
        const baseName = file.name.replace(/\.[^.]+$/, "") || "Uploaded Object";
        const width = Math.max(1, image.naturalWidth || image.width || 256);
        const height = Math.max(1, image.naturalHeight || image.height || 256);
        const safeBase = safeName(baseName);
        const sprite: AnimationSprite = {
          id: `sprite_static_${safeBase}_${Date.now()}`,
          characterName: baseName,
          description: `Uploaded static object from ${file.name}.`,
          frameCount: 1,
          style: "Uploaded static object",
          frames: [`<img src="${dataUrl}" alt="${escapeHtmlAttribute(baseName)}" draggable="false" />`],
          createdTime: now,
          isPreset: false,
          spritesheetPng: dataUrl,
          rawSpritesheetPng: dataUrl,
          frameSize: [width, height],
          sheetSize: [width, height],
          generationMode: "uploaded-static-object",
          proportionPolicy: "Uploaded static object keeps its original pixel ratio and can be resized as a scene layer.",
        };
        const binding: ActionBinding = {
          actionName: "static",
          triggerType: "auto",
          triggerValue: "auto",
          gameState: `static.${safeBase}`,
          notes: "Static object uploaded from the Layer panel.",
        };
        const asset: GameAsset = {
          id: `asset_static_${safeBase}_${Date.now()}`,
          name: baseName,
          role: "prop",
          confirmed: true,
          savedTime: now,
          updatedTime: now,
          sprite,
          binding,
          tags: ["uploaded", "static-object"],
        };

        try {
          const response = await fetch("/api/game-library/assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ asset }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Failed to save uploaded object");
          const savedAsset = data.library.assets.find((item: GameAsset) => item.id === asset.id) || asset;
          setAssets(data.library.assets);
          setSprites(prev => [sprite, ...prev.filter(item => item.id !== sprite.id)]);
          insertAssetLayer(savedAsset);
          setNotice(`Uploaded and inserted: ${savedAsset.name}`);
        } catch (err: any) {
          setError(err.message || "Failed to save uploaded object");
        }
      };
      image.onerror = () => setError("Could not read the uploaded image size.");
      image.src = dataUrl;
    };
    reader.onerror = () => setError("Could not read the uploaded image.");
    reader.readAsDataURL(file);
  };

  const insertActiveSprite = () => {
    const tempAsset = assets.find(asset =>
      asset.sprite.id === activeSprite.id ||
      asset.animations?.some(clip => clip.sprite.id === activeSprite.id)
    );
    if (tempAsset) {
      insertAssetLayer(tempAsset);
      return;
    }
    setNotice("Save the current spritesheet as a confirmed asset before inserting it into the scene.");
  };

  const selectSheetOnlySprite = (previewSprite: AnimationSprite, title = previewSprite.characterName, asset?: GameAsset) => {
    if (!previewSprite?.frames.length) return;
    const defaultClip = asset?.animations?.find(clip => clip.id === asset.defaultAnimationId) || asset?.animations?.[0];
    setActiveSprite(previewSprite);
    setActiveFrame(0);
    setIsPlaying(false);
    setSheetOnlyHasSelection(true);
    setSheetOnlySelectionKind("sprite");
    setSheetOnlySelectionTitle(title);
    setSheetColumns(previewSprite.gridColumns || Math.min(4, previewSprite.frames.length || 4));
    setSheetDataUrl(previewSprite.spritesheetPng || previewSprite.rawSpritesheetPng || null);
    if (asset) {
      setRole(asset.role);
      setBinding(defaultClip?.binding || asset.binding || defaultBinding);
      setTagsText(asset.tags.join(", "));
    }
    setNotice(`Loaded spritesheet object: ${title}`);
  };

  const selectSheetOnlyImage = (imageUrl: string, title: string) => {
    setActiveFrame(0);
    setIsPlaying(false);
    setSheetOnlyHasSelection(true);
    setSheetOnlySelectionKind("image");
    setSheetOnlySelectionTitle(title);
    setSheetDataUrl(imageUrl);
    setNotice(`Loaded image: ${title}`);
  };

  const insertSceneKitAsset = (assetId: string) => {
    const asset = SCENE_KIT_ASSETS.find(item => item.id === assetId);
    if (!asset) return;
    insertAssetLayer(asset, createSceneKitLayer(scene, assetId, false));
    if (assetId === BOARDING_TRAIN_ASSET_ID) setVehiclePhase("approaching");
    setNotice(`Inserted reusable scene-kit layer: ${asset.name}`);
  };

  const insertFullSceneKit = () => {
    setScene(prev => ensureSceneKitLayers(prev));
    setVehiclePhase("approaching");
    setTab("scene");
    setNotice("Subway interaction kit is available: reusable eye inspect hotspots, ticket machine, backpack HUD, Line 13 sign, and boarding train.");
  };

  const reorderLayerStack = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setScene(prev => {
      const topFirst = [...prev.layers].sort((a, b) => b.zIndex - a.zIndex);
      const sourceIndex = topFirst.findIndex(layer => layer.id === sourceId);
      const targetIndex = topFirst.findIndex(layer => layer.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;
      const [source] = topFirst.splice(sourceIndex, 1);
      topFirst.splice(targetIndex, 0, source);
      const nextZ = new Map(topFirst.map((layer, index) => [layer.id, (topFirst.length - index) * 10]));
      return {
        ...prev,
        layers: prev.layers.map(layer => ({ ...layer, zIndex: nextZ.get(layer.id) ?? layer.zIndex })),
      };
    });
  };

  const finishLayerPointerReorder = (clientX: number, clientY: number) => {
    const sourceLayerId = layerDragRef.current;
    if (!sourceLayerId) return;
    const targetLayerId = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>("[data-layer-row-id]")
      ?.dataset.layerRowId;
    if (targetLayerId) reorderLayerStack(sourceLayerId, targetLayerId);
    layerDragRef.current = null;
    setDraggedLayerId(null);
    setLayerDropTargetId(null);
  };

  const startScenePanelResize = (event: PointerEvent<HTMLButtonElement>, handle: ScenePanelResizeHandle) => {
    event.preventDefault();
    event.stopPropagation();
    scenePanelResizeRef.current = {
      handle,
      startX: event.clientX,
      startLayerWidth: scenePanelWidths.layers,
      startInspectorWidth: scenePanelWidths.inspector,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.classList.add("resizing-scene-panels");
  };

  const inferImportedFrameSize = (sheetSize = importSheetSize, columns = importColumns, frameCount = importFrameCount) => {
    if (!sheetSize) {
      setNotice("Upload a spritesheet first so the frame size can be inferred.");
      return;
    }
    const safeColumns = Math.max(1, Math.round(columns));
    const rows = Math.max(1, Math.ceil(Math.max(1, frameCount) / safeColumns));
    setImportFrameWidth(Math.max(1, Math.floor(sheetSize[0] / safeColumns)));
    setImportFrameHeight(Math.max(1, Math.floor(sheetSize[1] / rows)));
  };

  const handleImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setImportSheetDataUrl(dataUrl);
      setImportFileName(file.name);
      const baseName = file.name.replace(/\.[^.]+$/, "");
      setImportAssetName(prev => (!prev.trim() || prev === "Imported Animation" ? baseName : prev));
      const image = new Image();
      image.onload = () => {
        const sheetSize: [number, number] = [image.naturalWidth || image.width, image.naturalHeight || image.height];
        setImportSheetSize(sheetSize);
        inferImportedFrameSize(sheetSize);
      };
      image.onerror = () => setError("Could not read the uploaded image size.");
      image.src = dataUrl;
    };
    reader.onerror = () => setError("Could not read the uploaded file.");
    reader.readAsDataURL(file);
  };

  const updateImportTriggerType = (triggerType: ActionTriggerType) => {
    setImportTriggerType(triggerType);
    setImportTriggerValue(defaultTriggerValueForType(triggerType));
    setImportGameState(defaultGameStateForTrigger(triggerType, importActionName));
    if (triggerType === "auto") setImportLoop(true);
  };

  const updateImportActionName = (nextActionName: string) => {
    setImportActionName(nextActionName);
    setImportGameState(prev =>
      prev === defaultGameStateForTrigger(importTriggerType, importActionName)
        ? defaultGameStateForTrigger(importTriggerType, nextActionName)
        : prev
    );
  };

  const saveImportedSpritesheet = async (insertAfterSave = false) => {
    setError(null);
    if (!importSheetDataUrl) {
      setError("Choose a spritesheet image first.");
      return;
    }
    const frameWidth = Math.max(1, Math.round(importFrameWidth));
    const frameHeight = Math.max(1, Math.round(importFrameHeight));
    const frameCount = Math.max(1, Math.round(importFrameCount));
    const columns = Math.max(1, Math.round(importColumns));
    const rows = Math.ceil(frameCount / columns);
    const sheetWidth = importSheetSize?.[0] || frameWidth * columns;
    const sheetHeight = importSheetSize?.[1] || frameHeight * rows;
    if (columns * frameWidth > sheetWidth + 1 || rows * frameHeight > sheetHeight + 1) {
      setError("The frame grid is larger than the uploaded spritesheet. Check frame size, columns, and frame count.");
      return;
    }

    const now = new Date().toISOString();
    const actionName = importActionName.trim() || "loop";
    const assetName = importAssetName.trim() || "Imported Animation";
    const binding: ActionBinding = {
      actionName,
      triggerType: importTriggerType,
      triggerValue: importTriggerValue.trim() || defaultTriggerValueForType(importTriggerType),
      gameState: importGameState.trim() || defaultGameStateForTrigger(importTriggerType, actionName),
      notes: importTriggerType === "auto" && importLoop
        ? "Imported spritesheet loops continuously while it is visible in the scene."
        : "Imported spritesheet action with configurable trigger metadata.",
    };
    const sprite: AnimationSprite = {
      id: `sprite_import_${safeName(assetName)}_${Date.now()}`,
      characterName: assetName,
      description: `Imported ${frameCount}-frame spritesheet from ${importFileName || "uploaded image"}.`,
      frameCount,
      style: "Imported spritesheet",
      frames: buildSpritesheetFrames(importSheetDataUrl, sheetWidth, sheetHeight, frameWidth, frameHeight, frameCount, columns),
      createdTime: now,
      isPreset: false,
      spritesheetPng: importSheetDataUrl,
      fps,
      gridColumns: columns,
      frameSize: [frameWidth, frameHeight],
      sheetSize: [sheetWidth, sheetHeight],
      generationMode: "uploaded-spritesheet",
      proportionPolicy: "Use the exact uploaded frame grid; do not stretch or recrop frames.",
      adaptiveFramePolicy: `${columns} columns, ${rows} rows, ${frameCount} active frames.`,
    };
    const clip: AnimationClip = {
      id: `clip_${safeName(actionName)}_${Date.now()}`,
      name: actionName,
      actionName,
      direction: "none",
      sprite,
      binding,
      loop: importLoop,
      fps,
    };
    const asset: GameAsset = {
      id: `asset_${safeName(assetName)}_${safeName(actionName)}_${Date.now()}`,
      name: `${assetName} / ${actionName}`,
      role: importRole,
      confirmed: true,
      savedTime: now,
      updatedTime: now,
      sprite,
      animations: [clip],
      defaultAnimationId: clip.id,
      binding,
      tags: splitTags(importTagsText),
    };

    try {
      const response = await fetch("/api/game-library/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to import spritesheet asset");
      const savedAsset = data.library.assets.find((item: GameAsset) => item.id === asset.id) || asset;
      setAssets(data.library.assets);
      setSprites(prev => [sprite, ...prev.filter(item => item.id !== sprite.id)]);
      setActiveSprite(sprite);
      setActiveFrame(0);
      setSheetColumns(columns);
      setSheetDataUrl(importSheetDataUrl);
      if (insertAfterSave) insertAssetLayer(savedAsset);
      setNotice(insertAfterSave ? `Imported and inserted: ${asset.name}` : `Imported spritesheet asset: ${asset.name}`);
    } catch (err: any) {
      setError(err.message || "Failed to import spritesheet asset");
    }
  };

  const buildLayerInstance = (sourceLayer: SceneLayer, label: "copy" | "paste", offsetIndex: number, zIndex: number): SceneLayer => {
    const layer = cloneSceneLayer(sourceLayer);
    return {
      ...layer,
      id: `layer_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: `${layer.name} ${label}`,
      visible: true,
      locked: false,
      x: Number((layer.x + offsetIndex * 36).toFixed(2)),
      y: Number((layer.y + offsetIndex * 24).toFixed(2)),
      zIndex,
    };
  };

  const copyLayerToSceneClipboard = (layerId = selectedLayerIdRef.current) => {
    const layer = sceneStateRef.current.layers.find(item => item.id === layerId);
    if (!layer || !isTransformableSceneLayer(layer)) {
      setNotice("Select an item or background to copy.");
      setSceneContextMenu(null);
      return false;
    }
    setSceneClipboard({ layer: cloneSceneLayer(layer), sourceSceneId: sceneStateRef.current.id });
    scenePasteCountRef.current = 0;
    setSceneContextMenu(null);
    setNotice(`Copied: ${layer.name}`);
    return true;
  };

  const cutLayerToSceneClipboard = (layerId = selectedLayerIdRef.current) => {
    const layer = sceneStateRef.current.layers.find(item => item.id === layerId);
    if (!layer || !isTransformableSceneLayer(layer)) {
      setNotice("Select an item to cut.");
      setSceneContextMenu(null);
      return;
    }
    if (layer.locked) {
      setNotice("Unlock the layer before cutting it.");
      setSceneContextMenu(null);
      return;
    }
    if (layer.type === "background") {
      setNotice("Background cannot be cut. Copy it, then paste into another scene to replace background settings.");
      setSceneContextMenu(null);
      return;
    }
    setSceneClipboard({ layer: cloneSceneLayer(layer), sourceSceneId: sceneStateRef.current.id });
    scenePasteCountRef.current = 0;
    setScene(prev => ({ ...prev, layers: prev.layers.filter(item => item.id !== layer.id) }));
    setSelectedLayerId("");
    setSelectedInteractionZoneLayerId(null);
    setSceneContextMenu(null);
    setNotice(`Cut: ${layer.name}`);
  };

  const pasteLayerFromSceneClipboard = () => {
    if (!sceneClipboard) {
      setNotice("Nothing to paste.");
      setSceneContextMenu(null);
      return;
    }

    const sourceLayer = cloneSceneLayer(sceneClipboard.layer);
    if (sourceLayer.type === "background") {
      const targetBackground = sceneStateRef.current.layers.find(layer => layer.type === "background");
      if (!targetBackground) {
        setNotice("No background layer is available in this scene.");
        setSceneContextMenu(null);
        return;
      }
      if (targetBackground.locked) {
        setNotice("Unlock the background before pasting background settings.");
        setSceneContextMenu(null);
        return;
      }
      const replacement: SceneLayer = {
        ...sourceLayer,
        id: targetBackground.id,
        name: targetBackground.name,
        type: "background",
        locked: targetBackground.locked,
        visible: true,
        zIndex: targetBackground.zIndex,
      };
      setScene(prev => ({
        ...prev,
        layers: prev.layers.map(layer => layer.id === targetBackground.id ? replacement : layer),
      }));
      setSelectedLayerId(targetBackground.id);
      setSelectedInteractionZoneLayerId(null);
      setSceneContextMenu(null);
      setNotice(`Pasted background settings from ${sourceLayer.name}.`);
      return;
    }

    const offsetIndex = scenePasteCountRef.current + 1;
    const maxZ = Math.max(...sceneStateRef.current.layers.map(layer => layer.zIndex), sourceLayer.zIndex);
    const pastedLayer = buildLayerInstance(sourceLayer, "paste", offsetIndex, maxZ + 1);
    scenePasteCountRef.current = offsetIndex;
    setScene(prev => ({ ...prev, layers: [...prev.layers, pastedLayer] }));
    setSelectedLayerId(pastedLayer.id);
    setSelectedInteractionZoneLayerId(null);
    setSceneContextMenu(null);
    setNotice(`Pasted: ${sourceLayer.name}`);
  };

  const duplicateSceneLayer = (layerId = selectedLayerIdRef.current) => {
    const layer = sceneStateRef.current.layers.find(item => item.id === layerId);
    if (!layer || !isTransformableSceneLayer(layer)) {
      setNotice("Select an item to duplicate.");
      setSceneContextMenu(null);
      return;
    }
    if (layer.locked) {
      setNotice("Unlock the layer before duplicating it.");
      setSceneContextMenu(null);
      return;
    }
    if (layer.type === "background") {
      setNotice("Background uses a single editable layer. Copy and paste it into another scene to reuse settings.");
      setSceneContextMenu(null);
      return;
    }
    const maxZ = Math.max(...sceneStateRef.current.layers.map(item => item.zIndex), layer.zIndex);
    const copy = buildLayerInstance(layer, "copy", 1, maxZ + 1);
    setScene(prev => ({ ...prev, layers: [...prev.layers, copy] }));
    setSelectedLayerId(copy.id);
    setSelectedInteractionZoneLayerId(null);
    setSceneContextMenu(null);
    setNotice(`Duplicated: ${layer.name}`);
  };

  const duplicateSelectedLayer = () => duplicateSceneLayer(selectedLayerId);

  const openSceneLayerContextMenu = (
    event: MouseEvent<HTMLElement>,
    layer: SceneLayer,
    target: SceneContextMenuTarget = "layer",
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedLayerId(layer.id);
    setSelectedInteractionZoneLayerId(target === "interaction-zone" ? layer.id : null);
    const layerAsset = layer.assetId ? assetById.get(layer.assetId) : undefined;
    const layerSprite = resolveAssetSprite(layerAsset, layer);
    if (layerSprite) {
      setActiveSprite(layerSprite);
      setActiveFrame(0);
    }
    setSceneContextMenu({ x: event.clientX, y: event.clientY, layerId: layer.id, target });
  };

  const deleteSceneObject = (layerId: string, target: SceneContextMenuTarget) => {
    const layer = sceneStateRef.current.layers.find(item => item.id === layerId);
    if (!layer) return;
    if (target !== "interaction-zone" && layer.type === "background") {
      const hadBackgroundImage = Boolean(layer.imageUrl);
      setScene(prev => ({
        ...prev,
        background: "none",
        layers: prev.layers.map(item => item.id === layerId
          ? {
            ...item,
            name: "Black Background",
            visible: true,
            imageUrl: undefined,
            color: "#000000",
            opacity: 1,
            fit: "stretch",
            position: "center center",
          }
          : item),
      }));
      setSelectedLayerId(layerId);
      setSelectedInteractionZoneLayerId(null);
      setSceneContextMenu(null);
      setNotice(hadBackgroundImage ? "Deleted background image. Scene now uses the default black background." : "Background is already empty.");
      return;
    }
    if (layer.locked) {
      setNotice("Unlock the layer before deleting it.");
      setSceneContextMenu(null);
      return;
    }
    if (target === "interaction-zone") {
      setScene(prev => ({
        ...prev,
        layers: prev.layers.map(item => item.id === layerId
          ? { ...item, interaction: item.interaction ? { ...item.interaction, enabled: false } : item.interaction }
          : item),
      }));
      setSelectedInteractionZoneLayerId(null);
      setSceneContextMenu(null);
      setNotice(`Deleted interaction zone: ${layer.name}`);
      return;
    }
    setScene(prev => ({ ...prev, layers: prev.layers.filter(item => item.id !== layerId) }));
    setSelectedLayerId("");
    setSelectedInteractionZoneLayerId(null);
    setSceneContextMenu(null);
    setNotice(`Deleted layer: ${layer.name}`);
  };

  const removeSelectedLayer = () => {
    if (!selectedLayer) return;
    deleteSceneObject(selectedLayer.id, selectedInteractionZoneLayerId === selectedLayer.id ? "interaction-zone" : "layer");
  };

  const isEditingTextTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const tagName = target.tagName.toLowerCase();
    return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
  };

  const restoreSceneFromHistory = (nextScene: GameScene, message: string) => {
    const selectedId = selectedLayerIdRef.current;
    const selectedLayerStillExists = selectedId && nextScene.layers.some(layer => layer.id === selectedId);
    const fallbackLayer = [...nextScene.layers].sort((a, b) => b.zIndex - a.zIndex)[0];

    sceneHistoryNavigationRef.current = true;
    setScene(cloneSceneForHistory(nextScene));
    setSelectedLayerId(selectedLayerStillExists ? selectedId : fallbackLayer?.id || "");
    setSelectedInteractionZoneLayerId(null);
    setSceneContextMenu(null);
    setNotice(message);
  };

  const undoSceneChange = () => {
    const previousScene = sceneHistoryPastRef.current[sceneHistoryPastRef.current.length - 1];
    if (!previousScene) {
      setNotice("Nothing to undo.");
      return;
    }
    sceneHistoryPastRef.current = sceneHistoryPastRef.current.slice(0, -1);
    sceneHistoryFutureRef.current = [
      cloneSceneForHistory(sceneStateRef.current),
      ...sceneHistoryFutureRef.current,
    ].slice(0, SCENE_HISTORY_LIMIT);
    restoreSceneFromHistory(previousScene, "Undo");
  };

  const redoSceneChange = () => {
    const nextScene = sceneHistoryFutureRef.current[0];
    if (!nextScene) {
      setNotice("Nothing to redo.");
      return;
    }
    sceneHistoryFutureRef.current = sceneHistoryFutureRef.current.slice(1);
    sceneHistoryPastRef.current = [
      ...sceneHistoryPastRef.current,
      cloneSceneForHistory(sceneStateRef.current),
    ].slice(-SCENE_HISTORY_LIMIT);
    restoreSceneFromHistory(nextScene, "Redo");
  };

  useEffect(() => {
    const onHistoryKey = (event: KeyboardEvent) => {
      if (tab !== "scene") return;
      if (event.repeat || isEditingTextTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const modifierPressed = event.ctrlKey || event.metaKey;
      const isUndo = modifierPressed && key === "z" && !event.shiftKey;
      const isRedo = modifierPressed && (key === "y" || (key === "z" && event.shiftKey));
      if (!isUndo && !isRedo) return;
      event.preventDefault();
      event.stopPropagation();
      if (isUndo) {
        undoSceneChange();
        return;
      }
      redoSceneChange();
    };

    window.addEventListener("keydown", onHistoryKey, true);
    return () => window.removeEventListener("keydown", onHistoryKey, true);
  }, [tab]);

  useEffect(() => {
    const onClipboardKey = (event: KeyboardEvent) => {
      if (tab !== "scene") return;
      if (event.repeat || isEditingTextTarget(event.target)) return;
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (!["c", "x", "v", "d"].includes(key)) return;

      event.preventDefault();
      event.stopPropagation();
      if (key === "c") {
        copyLayerToSceneClipboard();
        return;
      }
      if (key === "x") {
        cutLayerToSceneClipboard();
        return;
      }
      if (key === "v") {
        pasteLayerFromSceneClipboard();
        return;
      }
      duplicateSceneLayer();
    };

    window.addEventListener("keydown", onClipboardKey, true);
    return () => window.removeEventListener("keydown", onClipboardKey, true);
  }, [sceneClipboard, tab]);

  useEffect(() => {
    const onDeleteKey = (event: KeyboardEvent) => {
      if (tab !== "scene") return;
      if (event.repeat || (event.key !== "Backspace" && event.key !== "Delete")) return;
      if (isEditingTextTarget(event.target)) return;
      if (!selectedLayerId) return;
      event.preventDefault();
      event.stopPropagation();
      deleteSceneObject(selectedLayerId, selectedInteractionZoneLayerId === selectedLayerId ? "interaction-zone" : "layer");
    };
    window.addEventListener("keydown", onDeleteKey, true);
    return () => window.removeEventListener("keydown", onDeleteKey, true);
  }, [selectedInteractionZoneLayerId, selectedLayerId, tab]);

  const persistScene = async (sceneToSave: GameScene, successMessage: string) => {
    setError(null);
    try {
      const nextScene = {
        ...prepareSceneForEditor(sceneToSave),
        savedTime: sceneToSave.savedTime || new Date().toISOString(),
        updatedTime: new Date().toISOString(),
      };
      const response = await fetch("/api/game-library/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene: nextScene }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save scene");
      setScenes(data.library.scenes.map(prepareSceneForEditor));
      setScene(prepareSceneForEditor(data.scene));
      setSelectedLayerId("");
      setTab("scenes");
      setNotice(successMessage.replace("{name}", data.scene.name));
    } catch (err: any) {
      setError(err.message || "Failed to save scene");
    }
  };

  const saveScene = async () => {
    await persistScene(scene, "Scene updated: {name}");
  };

  const saveCompletedScene = async () => {
    const now = new Date();
    const completedScene: GameScene = {
      ...prepareSceneForEditor(scene),
      id: `scene_completed_${Date.now()}`,
      name: `${scene.name || "Scene"} - Complete ${sceneTimestampLabel(now)}`,
      savedTime: now.toISOString(),
      updatedTime: now.toISOString(),
    };
    await persistScene(completedScene, "Completed scene saved: {name}");
  };

  const deleteScene = async (sceneId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/game-library/scenes/${sceneId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to delete scene");
      const nextScenes = Array.isArray(data.library.scenes)
        ? data.library.scenes.map(prepareSceneForEditor)
        : [];
      setScenes(nextScenes);
      if (scene.id === sceneId) {
        const fallbackScene = nextScenes[0] || prepareSceneForEditor(createDefaultScene());
        setScene(fallbackScene);
        setSelectedLayerId("");
      }
      setIsBackpackOpen(false);
      setVehiclePhase("approaching");
      setTab("scenes");
      setNotice("Scene deleted.");
    } catch (err: any) {
      setError(err.message || "Failed to delete scene");
    }
  };

  const uniqueCopiedSceneName = (sourceName: string) => {
    const baseName = `${sourceName || "Scene"} Copy`;
    const usedNames = new Set([scene.name, ...scenes.map(savedScene => savedScene.name)].filter(Boolean));
    if (!usedNames.has(baseName)) return baseName;
    let copyIndex = 2;
    while (usedNames.has(`${baseName} ${copyIndex}`)) copyIndex += 1;
    return `${baseName} ${copyIndex}`;
  };

  const saveSceneCopy = async (sourceScene: GameScene, successPrefix: string) => {
    setError(null);
    try {
      const now = new Date().toISOString();
      const cleanSource = prepareSceneForEditor(sourceScene);
      const sceneCopy: GameScene = {
        ...cloneSceneForHistory(cleanSource),
        id: `scene_copy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: uniqueCopiedSceneName(cleanSource.name),
        savedTime: now,
        updatedTime: now,
      };
      const response = await fetch("/api/game-library/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene: sceneCopy }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save scene copy");
      setScenes(data.library.scenes.map(prepareSceneForEditor));
      setTab("scenes");
      setNotice(`${successPrefix}: ${data.scene.name}`);
    } catch (err: any) {
      setError(err.message || "Failed to save scene copy");
    }
  };

  const duplicateSceneNode = async (node: SceneFlowNode) => {
    if (!node.scene || node.isPlaceholder) {
      setNotice("Select a scene to duplicate.");
      return;
    }
    await saveSceneCopy(node.scene, "Scene duplicated");
  };

  const pasteSceneNode = async (sourceScene: GameScene) => {
    await saveSceneCopy(sourceScene, "Scene pasted");
  };

  const deleteSceneNode = async (node: SceneFlowNode) => {
    if (!node.scene || node.isPlaceholder) {
      setNotice("Select a scene to delete.");
      return;
    }
    const isSavedScene = scenes.some(savedScene => savedScene.id === node.scene?.id);
    if (!isSavedScene) {
      if (node.isCurrent) {
        const fallbackScene = scenes[0] || prepareSceneForEditor(createDefaultScene());
        setScene(fallbackScene);
        setSelectedLayerId("");
        setTab("scenes");
        setNotice("Current draft scene cleared.");
        return;
      }
      setNotice("This scene has not been saved yet.");
      return;
    }
    await deleteScene(node.scene.id);
  };

  const startNewScene = () => {
    const now = new Date();
    const base = prepareSceneForEditor(createDefaultScene());
    const playerLayers = scene.layers
      .filter(layer => {
        if (!layer.assetId || !isSceneVisualLayer(layer)) return false;
        return assetById.get(layer.assetId)?.role === "player";
      })
      .map((layer, index) => ({
        ...layer,
        id: `layer_player_scene_${Date.now()}_${index}`,
        name: layer.name || "Player",
        x: 420 + index * 36,
        y: base.groundY + 2,
        zIndex: Math.max(layer.zIndex, 30),
        opacity: 1,
        parallax: 1,
        visible: true,
      }));
    const nextScene: GameScene = {
      ...base,
      id: `scene_draft_${Date.now()}`,
      name: `New Scene ${scenes.length + 1}`,
      cameraX: 0,
      savedTime: now.toISOString(),
      updatedTime: now.toISOString(),
      layers: [...base.layers, ...playerLayers],
    };
    setScene(nextScene);
    setSelectedLayerId(playerLayers[0]?.id || "");
    setIsBackpackOpen(false);
    setVehiclePhase("approaching");
    setTab("scene");
    setNotice(playerLayers.length ? "New scene created with the current player copied in." : "New empty scene created.");
  };

  const loadSavedScene = (savedScene: GameScene) => {
    const cleanScene = prepareSceneForEditor(savedScene);
    setScene(cleanScene);
    setSelectedLayerId("");
    setIsBackpackOpen(false);
    setVehiclePhase("approaching");
    setTab("scene");
    setNotice(`Loaded scene: ${cleanScene.name}`);
  };

  const compileSheet = async () => {
    if (!activeSprite.frames.length) return null;
    const columns = Math.min(sheetColumns, activeSprite.frames.length);
    const rows = Math.ceil(activeSprite.frames.length / columns);
    const canvas = document.createElement("canvas");
    canvas.width = columns * frameW;
    canvas.height = rows * frameH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to create export canvas");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < activeSprite.frames.length; i++) {
      await drawSvgFrame(ctx, activeSprite.frames[i], (i % columns) * frameW, Math.floor(i / columns) * frameH, frameW, frameH);
    }
    const url = canvas.toDataURL("image/png");
    setSheetDataUrl(url);
    return url;
  };

  const openGameMode = () => {
    setAppMode("game");
    setTab("scenes");
  };

  const openSheetOnlyMode = () => {
    setAppMode("sheet-only");
    setTab("sheet");
    setIsPlaying(false);
    setSheetOnlyHasSelection(false);
    setSheetOnlySelectionKind(null);
    setSheetOnlySelectionTitle("");
  };

  const returnToModePicker = () => {
    setIsPlaying(false);
    setAppMode("home");
  };

  useEffect(() => {
    if (appMode !== "sheet-only" || !sheetOnlyHasSelection || sheetOnlySelectionKind !== "sprite") return;
    if (activeSprite.spritesheetPng) {
      setSheetDataUrl(activeSprite.spritesheetPng);
      return;
    }
    setSheetDataUrl(null);
    void compileSheet().catch((err: any) => setError(err.message || "Failed to generate spritesheet preview"));
  }, [appMode, activeSprite.id, activeSprite.spritesheetPng, sheetOnlyHasSelection, sheetOnlySelectionKind]);

  const downloadSheet = async () => {
    try {
      const url = activeSprite.spritesheetPng || sheetDataUrl || await compileSheet();
      if (url) {
        const filename = `spritesheet_${safeName(activeSprite.characterName)}_${activeSprite.frames.length}f.png`;
        if (activeSprite.spritesheetPng && url === activeSprite.spritesheetPng) downloadUrl(url, filename);
        else downloadDataUrl(url, filename);
      }
    } catch (err: any) {
      setError(err.message || "Failed to export spritesheet");
    }
  };

  const downloadSelectedSceneItem = () => {
    if (!selectedLayer) {
      setNotice("Select an item first.");
      return;
    }

    if (selectedLayer.type === "background" && selectedLayer.imageUrl) {
      downloadUrl(selectedLayer.imageUrl, `item_${safeName(selectedLayer.name)}.png`);
      return;
    }

    const asset = selectedLayer.assetId ? assetById.get(selectedLayer.assetId) : undefined;
    const sprite = resolveAssetSprite(asset, selectedLayer);
    if (!asset || !sprite) {
      downloadJson(selectedLayer, `item_${safeName(selectedLayer.name)}.json`);
      return;
    }

    const pngUrl = sprite.spritesheetPng || sprite.rawSpritesheetPng;
    if (pngUrl) {
      downloadUrl(pngUrl, `item_${safeName(selectedLayer.name)}_spritesheet.png`);
      return;
    }

    const frameSvg = spriteFrame(sprite, activeFrame);
    downloadDataUrl(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(frameSvg)}`,
      `item_${safeName(selectedLayer.name)}_frame.svg`
    );
  };

  const triggerMouseAction = () => {
    const matched = assets
      .map(asset => {
        const clip = asset.animations?.find(item => item.binding?.triggerType === "mouse");
        if (clip) return { asset, clip };
        return asset.binding.triggerType === "mouse" ? { asset, clip: undefined } : null;
      })
      .find(Boolean);
    if (!matched) {
      setNotice("No mouse-triggered action is bound yet.");
      return;
    }
    if (matched.clip) {
      setScene(prev => ({
        ...prev,
        layers: prev.layers.map(layer => layer.assetId === matched.asset.id ? { ...layer, activeAnimationId: matched.clip!.id } : layer),
      }));
    }
    setActiveSprite(matched.clip?.sprite || resolveAssetSprite(matched.asset) || matched.asset.sprite);
    setActiveFrame(0);
    setIsPlaying(true);
    setNotice(`Mouse triggered action: ${matched.clip?.name || matched.asset.binding.actionName}`);
  };

  const clearSceneSelection = () => {
    dragRef.current = null;
    resizeRef.current = null;
    zoneDragRef.current = null;
    zoneResizeRef.current = null;
    setSelectedLayerId("");
    setSelectedInteractionZoneLayerId(null);
    setIsPlaying(false);
  };

  const stagePointerDown = (event: PointerEvent<HTMLDivElement>, layer: SceneLayer) => {
    if (layer.locked) return;
    event.stopPropagation();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const parallax = layer.parallax ?? 1;
    const pointerX = (event.clientX - rect.left) / stageScaleX + scene.cameraX * parallax;
    const pointerY = (event.clientY - rect.top) / stageScaleY;
    dragRef.current = { id: layer.id, dx: pointerX - layer.x, dy: pointerY - layer.y };
    resizeRef.current = null;
    setSelectedLayerId(layer.id);
    setSelectedInteractionZoneLayerId(null);
  };

  const startLayerResize = (
    event: PointerEvent<HTMLSpanElement>,
    layer: SceneLayer,
    assetWidth: number,
    assetHeight: number,
    handle: ResizeHandle
  ) => {
    if (layer.locked) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = null;
    const parallax = layer.parallax ?? 1;
    const left = (layer.x - scene.cameraX * parallax) * stageScaleX;
    const width = assetWidth * layer.scale * spriteStageScale;
    const height = assetHeight * layer.scale * spriteStageScale;
    const bottom = layer.y * stageScaleY;
    const top = bottom - height;
    const right = left + width;
    const anchorScreenX = handle === "nw" || handle === "sw" ? right : left;
    const anchorScreenY = handle === "nw" || handle === "ne" ? bottom : top;
    resizeRef.current = {
      id: layer.id,
      handle,
      anchorScreenX,
      anchorScreenY,
      assetWidth,
      assetHeight,
    };
    setSelectedLayerId(layer.id);
    setSelectedInteractionZoneLayerId(null);
  };

  const startInteractionZoneDrag = (event: PointerEvent<HTMLDivElement>, layer: SceneLayer, interaction: LayerInteractionSettings) => {
    if (layer.locked) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const parallax = layer.parallax ?? 1;
    const pointerX = (event.clientX - rect.left) / stageScaleX + scene.cameraX * parallax;
    const pointerY = (event.clientY - rect.top) / stageScaleY;
    dragRef.current = null;
    resizeRef.current = null;
    zoneResizeRef.current = null;
    zoneDragRef.current = {
      id: layer.id,
      startPointerX: pointerX,
      startPointerY: pointerY,
      startOffsetX: interaction.zoneOffsetX || 0,
      startOffsetY: interaction.zoneOffsetY || 0,
    };
    setSelectedLayerId(layer.id);
    setSelectedInteractionZoneLayerId(layer.id);
  };

  const startInteractionZoneResize = (
    event: PointerEvent<HTMLSpanElement>,
    layer: SceneLayer,
    asset: GameAsset,
    interaction: LayerInteractionSettings,
    handle: ResizeHandle
  ) => {
    if (layer.locked) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const zone = interactionZoneBounds(layer, asset, interaction);
    dragRef.current = null;
    resizeRef.current = null;
    zoneDragRef.current = null;
    zoneResizeRef.current = {
      id: layer.id,
      handle,
      anchorWorldX: handle === "nw" || handle === "sw" ? zone.right : zone.left,
      anchorWorldY: handle === "nw" || handle === "ne" ? zone.bottom : zone.top,
    };
    setSelectedLayerId(layer.id);
    setSelectedInteractionZoneLayerId(layer.id);
  };

  const stagePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const zoneResize = zoneResizeRef.current;
    if (zoneResize) {
      const layerSnapshot = sceneStateRef.current.layers.find(layer => layer.id === zoneResize.id);
      const parallax = layerSnapshot?.parallax ?? 1;
      const pointerWorldX = (event.clientX - rect.left) / stageScaleX + scene.cameraX * parallax;
      const pointerWorldY = (event.clientY - rect.top) / stageScaleY;
      setScene(prev => {
        const layer = prev.layers.find(item => item.id === zoneResize.id);
        const asset = layer?.assetId ? assetById.get(layer.assetId) : undefined;
        if (!layer || !asset) return prev;
        const base = layerInteractionSettings(layer, asset) || DEFAULT_INTERACTION_SETTINGS;
        const width = Math.max(24, Math.abs(pointerWorldX - zoneResize.anchorWorldX));
        const height = Math.max(24, Math.abs(pointerWorldY - zoneResize.anchorWorldY));
        const centerX = (pointerWorldX + zoneResize.anchorWorldX) / 2;
        const centerY = (pointerWorldY + zoneResize.anchorWorldY) / 2;
        const layerBounds = layerWorldBounds(layer, asset);
        const interaction = {
          ...base,
          ...layer.interaction,
          zoneWidth: Math.round(width),
          zoneHeight: Math.round(height),
          zoneOffsetX: Math.round(centerX - layerBounds.centerX),
          zoneOffsetY: Math.round(centerY - layerBounds.centerY),
        };
        return {
          ...prev,
          layers: prev.layers.map(item => item.id === layer.id ? { ...item, interaction } : item),
        };
      });
      return;
    }

    const zoneDrag = zoneDragRef.current;
    if (zoneDrag) {
      const layerSnapshot = sceneStateRef.current.layers.find(layer => layer.id === zoneDrag.id);
      const parallax = layerSnapshot?.parallax ?? 1;
      const pointerWorldX = (event.clientX - rect.left) / stageScaleX + scene.cameraX * parallax;
      const pointerWorldY = (event.clientY - rect.top) / stageScaleY;
      const nextOffsetX = Math.round(zoneDrag.startOffsetX + pointerWorldX - zoneDrag.startPointerX);
      const nextOffsetY = Math.round(zoneDrag.startOffsetY + pointerWorldY - zoneDrag.startPointerY);
      setScene(prev => ({
        ...prev,
        layers: prev.layers.map(layer => {
          if (layer.id !== zoneDrag.id) return layer;
          const asset = layer.assetId ? assetById.get(layer.assetId) : undefined;
          const base = layerInteractionSettings(layer, asset) || DEFAULT_INTERACTION_SETTINGS;
          return {
            ...layer,
            interaction: { ...base, ...layer.interaction, zoneOffsetX: nextOffsetX, zoneOffsetY: nextOffsetY },
          };
        }),
      }));
      return;
    }

    const resize = resizeRef.current;
    if (resize) {
      const pointerScreenX = event.clientX - rect.left;
      const pointerScreenY = event.clientY - rect.top;
      const widthScreen = resize.handle === "nw" || resize.handle === "sw"
        ? resize.anchorScreenX - pointerScreenX
        : pointerScreenX - resize.anchorScreenX;
      const heightScreen = resize.handle === "nw" || resize.handle === "ne"
        ? resize.anchorScreenY - pointerScreenY
        : pointerScreenY - resize.anchorScreenY;
      const scaleFromWidth = widthScreen / Math.max(1, resize.assetWidth * spriteStageScale);
      const scaleFromHeight = heightScreen / Math.max(1, resize.assetHeight * spriteStageScale);
      const nextScale = clampLayerScale(Math.max(scaleFromWidth, scaleFromHeight));
      const scaledWidth = resize.assetWidth * nextScale * spriteStageScale;
      const scaledHeight = resize.assetHeight * nextScale * spriteStageScale;
      const layerSnapshot = sceneStateRef.current.layers.find(layer => layer.id === resize.id);
      const parallax = layerSnapshot?.parallax ?? 1;
      const x = resize.handle === "nw" || resize.handle === "sw"
        ? (resize.anchorScreenX - scaledWidth) / stageScaleX + scene.cameraX * parallax
        : resize.anchorScreenX / stageScaleX + scene.cameraX * parallax;
      const y = resize.handle === "nw" || resize.handle === "ne"
        ? resize.anchorScreenY / stageScaleY
        : (resize.anchorScreenY + scaledHeight) / stageScaleY;
      updateSceneLayer(resize.id, {
        x: Math.round(x),
        y: Math.round(y),
        scale: Number(nextScale.toFixed(3)),
      });
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const layerSnapshot = sceneStateRef.current.layers.find(layer => layer.id === drag.id);
    const parallax = layerSnapshot?.parallax ?? 1;
    updateSceneLayer(drag.id, {
      x: Math.round((event.clientX - rect.left) / stageScaleX + scene.cameraX * parallax - drag.dx),
      y: Math.round((event.clientY - rect.top) / stageScaleY - drag.dy),
    });
  };

  const applyNeonLightingToSelectedLayer = () => {
    if (!selectedLayer || selectedLayer.locked || !isSceneVisualLayer(selectedLayer)) return;
    updateSceneLayer(selectedLayer.id, {
      shadow: { ...NEON_CONTACT_SHADOW },
      lighting: { ...NEON_LAYER_LIGHTING },
    });
    setNotice("Applied neon station lighting to the selected layer.");
  };

  const clearLightingFromSelectedLayer = () => {
    if (!selectedLayer || selectedLayer.locked || !isSceneVisualLayer(selectedLayer)) return;
    updateSceneLayer(selectedLayer.id, {
      shadow: { ...NEON_CONTACT_SHADOW, enabled: false },
      lighting: { ...NEON_LAYER_LIGHTING, preset: "none" as const },
    });
    setNotice("Disabled simulated lighting on the selected layer.");
  };

  const bgClass = bgMode === "checker" ? "preview-bg checker" : `preview-bg ${bgMode}`;

  if (appMode === "home") {
    return <ModePicker onOpenGame={openGameMode} onOpenSheetOnly={openSheetOnlyMode} />;
  }

  if (appMode === "sheet-only") {
    return (
      <SheetOnlyGallery
        activeSpriteName={activeSprite.characterName}
        checkerStyle={checkerStyle}
        entries={sheetOnlyEntries}
        hasSelection={sheetOnlyHasSelection}
        selectionTitle={sheetOnlySelectionTitle}
        sheetDataUrl={sheetDataUrl}
        onBack={returnToModePicker}
        onGeneratePreview={() => void compileSheet()}
        onSelectImage={selectSheetOnlyImage}
        onSelectSprite={selectSheetOnlySprite}
        onShowAll={() => {
          setSheetOnlyHasSelection(false);
          setSheetOnlySelectionKind(null);
        }}
      />
    );
  }

  return (
    <div className={`blueprint-app ${tab === "scenes" || tab === "scene" ? "core-mode" : ""}`}>
      <WorkspaceTopbar
        isPlaying={isPlaying}
        onBack={returnToModePicker}
        onDownloadSheet={downloadSheet}
        onOpenScenes={() => setTab("scenes")}
        onSaveAsset={saveAsset}
        onSaveComplete={saveCompletedScene}
        onSaveScene={saveScene}
        onStartNewScene={startNewScene}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
      />

      <main className={`game-workspace ${tab === "scenes" || tab === "scene" ? "simple-workspace" : ""}`}>
        <aside className="panel left-panel utility-panel">
          <CurrentActionPanel
            activeFrame={activeFrame}
            activeSprite={activeSprite}
            binding={binding}
            checkerStyle={checkerStyle}
            frameHeight={frameH}
            frameWidth={frameW}
            role={role}
            roleLabels={roleLabels}
            tagsText={tagsText}
            triggerLabels={triggerLabels}
            onBindingChange={setBinding}
            onInsertActiveSprite={insertActiveSprite}
            onRoleChange={setRole}
            onSaveAsset={saveAsset}
            onTagsTextChange={setTagsText}
          />

          <SpritesheetImporterPanel
            actionName={importActionName}
            assetName={importAssetName}
            columns={importColumns}
            fileName={importFileName}
            frameCount={importFrameCount}
            frameHeight={importFrameHeight}
            frameWidth={importFrameWidth}
            gameState={importGameState}
            importLoop={importLoop}
            role={importRole}
            roleLabels={roleLabels}
            sheetSize={importSheetSize}
            tagsText={importTagsText}
            triggerLabels={triggerLabels}
            triggerType={importTriggerType}
            triggerValue={importTriggerValue}
            onActionNameChange={updateImportActionName}
            onAssetNameChange={setImportAssetName}
            onColumnsChange={setImportColumns}
            onFileChange={handleImportFile}
            onFrameCountChange={setImportFrameCount}
            onFrameHeightChange={setImportFrameHeight}
            onFrameWidthChange={setImportFrameWidth}
            onGameStateChange={setImportGameState}
            onInferFrameSize={() => inferImportedFrameSize()}
            onLoopChange={setImportLoop}
            onRoleChange={setImportRole}
            onSave={() => saveImportedSpritesheet(false)}
            onSaveAndInsert={() => saveImportedSpritesheet(true)}
            onTagsTextChange={setImportTagsText}
            onTriggerTypeChange={updateImportTriggerType}
            onTriggerValueChange={setImportTriggerValue}
          />

          <TriggerTestPanel onTriggerMouseAction={triggerMouseAction} />
          <WorkspaceMessages error={error} notice={notice} />
        </aside>

        <section className="canvas-stage">
          <div className="blueprint-grid">
            <WorkspaceStageHeader
              activeTab={tab}
              title={tab === "scenes" ? "Scene Library" : tab === "spritesheets" ? "Scene Spritesheets" : scene.name}
              viewportHeight={viewportHeight}
              viewportPreset={scene.viewportPreset}
              viewportPresets={VIEWPORT_PRESETS}
              viewportWidth={viewportWidth}
              onOpenSheet={async () => {
                setTab("sheet");
                if (!activeSprite.spritesheetPng && !sheetDataUrl) await compileSheet();
              }}
              onTabChange={setTab}
              onViewportHeightChange={height => updateSceneFrame({ viewportHeight: height, viewportPreset: "custom" })}
              onViewportPresetChange={presetId => {
                const preset = VIEWPORT_PRESETS.find(item => item.id === presetId);
                if (preset) updateSceneFrame({ viewportWidth: preset.width, viewportHeight: preset.height, viewportPreset: preset.id });
              }}
              onViewportWidthChange={width => updateSceneFrame({ viewportWidth: width, viewportPreset: "custom" })}
            />

            {tab === "scenes" && (
              <SceneFlowCanvas
                nodes={sceneFlowNodes}
                onCreateScene={() => {
                  startNewScene();
                  setTab("scene");
                }}
                onDeleteScene={deleteSceneNode}
                onDuplicateScene={duplicateSceneNode}
                onOpenScene={node => {
                  if (node.isPlaceholder) {
                    startNewScene();
                    setTab("scene");
                    return;
                  }
                  if (node.scene && !node.isCurrent) loadSavedScene(node.scene);
                  setTab("scene");
                }}
                onPasteScene={pasteSceneNode}
                onSaveCurrent={saveCompletedScene}
                onStatus={setNotice}
              />
            )}

            {tab === "scene" && (
              <div className="scene-editor">
                <div
                  className="scene-wireframe"
                  style={{
                    gridTemplateColumns: `${sceneLayerPanelWidth}px 8px minmax(${sceneCenterMinWidth}px, 1fr) 8px ${sceneInspectorPanelWidth}px`,
                  }}
                >
                  <aside className="scene-mini-panel layer-rail">
                    <div className="mini-panel-title layer-panel-title">
                      <b>Layer</b>
                      <div className="layer-panel-title-actions">
                        <button
                          type="button"
                          className={isLayerLibraryOpen ? "mini-add-layer-button active" : "mini-add-layer-button"}
                          title="Add layer"
                          aria-label="Add layer"
                          onClick={() => setIsLayerLibraryOpen(value => !value)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    {isLayerLibraryOpen && (
                      <div className="layer-add-popover" role="dialog" aria-label="Add asset">
                        <div className="layer-add-popover-header">
                          <strong>Add Asset</strong>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label="Close add asset"
                            onClick={() => setIsLayerLibraryOpen(false)}
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <div className="layer-add-popover-actions">
                          <label className="layer-upload-button">
                            <Upload size={13} />
                            <span>Upload Image</span>
                            <input type="file" accept="image/*" onChange={handleLayerImageUpload} />
                          </label>
                        </div>
                        <div className="layer-asset-grid">
                          {layerLibraryAssets.length ? layerLibraryAssets.map(asset => {
                            const previewSprite = resolveAssetSprite(asset);
                            if (!previewSprite) return null;
                            return (
                              <button
                                key={asset.id}
                                type="button"
                                className="layer-asset-option"
                                title={asset.name}
                                onClick={() => insertAssetLayer(asset)}
                              >
                                <span className="layer-asset-thumb">
                                  <span dangerouslySetInnerHTML={{ __html: spriteFrame(previewSprite, 0) }} />
                                </span>
                                <strong>{asset.name}</strong>
                              </button>
                            );
                          }) : (
                            <div className="layer-add-empty">No assets yet</div>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="mini-layer-list">
                      {scene.layers
                        .slice()
                        .sort((a, b) => b.zIndex - a.zIndex)
                        .map(layer => {
                          const canDragLayer = !layer.locked;
                          return (
                            <button
                              key={layer.id}
                              type="button"
                              data-layer-row-id={layer.id}
                              className={[
                                layer.id === selectedLayerId ? "active" : "",
                                draggedLayerId === layer.id ? "dragging" : "",
                                layerDropTargetId === layer.id ? "drop-target" : "",
                                !layer.visible ? "not-visible" : "",
                                !canDragLayer ? "locked" : "",
                              ].filter(Boolean).join(" ")}
                              onClick={() => {
                                setSelectedLayerId(layer.id);
                                setSelectedInteractionZoneLayerId(null);
                                const layerAsset = layer.assetId ? assetById.get(layer.assetId) : undefined;
                                const layerSprite = resolveAssetSprite(layerAsset, layer);
                                if (layerSprite) setActiveSprite(layerSprite);
                              }}
                              onContextMenu={event => {
                                openSceneLayerContextMenu(event, layer);
                              }}
                              onPointerDown={event => {
                                if (!canDragLayer || event.button !== 0) return;
                                setSelectedLayerId(layer.id);
                                setSelectedInteractionZoneLayerId(null);
                                const layerAsset = layer.assetId ? assetById.get(layer.assetId) : undefined;
                                const layerSprite = resolveAssetSprite(layerAsset, layer);
                                if (layerSprite) {
                                  setActiveSprite(layerSprite);
                                  setActiveFrame(0);
                                }
                                layerDragRef.current = layer.id;
                                setDraggedLayerId(layer.id);
                              }}
                              onPointerUp={event => finishLayerPointerReorder(event.clientX, event.clientY)}
                              onPointerCancel={() => {
                                layerDragRef.current = null;
                                setDraggedLayerId(null);
                                setLayerDropTargetId(null);
                              }}
                              title={canDragLayer ? `${layer.name} / drag to reorder depth` : `${layer.name} / locked`}
                            >
                              <span className="mini-layer-grip" aria-hidden="true">{canDragLayer ? "::" : "--"}</span>
                              <span
                                className="mini-layer-visibility"
                                role="button"
                                tabIndex={0}
                                title={layer.visible ? "Hide layer" : "Show layer"}
                                onPointerDown={event => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                }}
                                onClick={event => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  updateSceneLayer(layer.id, { visible: !layer.visible });
                                }}
                                onKeyDown={event => {
                                  if (event.key !== "Enter" && event.key !== " ") return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  updateSceneLayer(layer.id, { visible: !layer.visible });
                                }}
                              >
                                {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                              </span>
                              <span
                                className="mini-layer-lock"
                                role="button"
                                tabIndex={0}
                                title={layer.locked ? "Unlock layer" : "Lock layer"}
                                aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                                onPointerDown={event => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                }}
                                onClick={event => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  updateSceneLayer(layer.id, { locked: !layer.locked });
                                }}
                                onKeyDown={event => {
                                  if (event.key !== "Enter" && event.key !== " ") return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  updateSceneLayer(layer.id, { locked: !layer.locked });
                                }}
                              >
                                {layer.locked ? <Lock size={13} /> : <Unlock size={13} />}
                              </span>
                              <strong>{layer.name}</strong>
                            </button>
                          );
                        })}
                    </div>
                  </aside>
                  <button
                    type="button"
                    className="scene-resizer left"
                    aria-label="Resize layer panel"
                    title="Drag to resize Layers"
                    onPointerDown={event => startScenePanelResize(event, "layers")}
                  />
                  <div
                    ref={stageShellRef}
                    className="scene-stage-shell"
                    style={{ ["--scene-global-controls-space" as string]: `${sceneControlsHeight ? sceneControlsHeight + 28 : 98}px` }}
                  >
                    <div
                      ref={stageRef}
                      className="side-scroller-stage"
                      style={{
                        width: stageSize.width,
                        height: stageSize.height,
                        aspectRatio: `${viewportWidth} / ${viewportHeight}`,
                        background: hasVisibleBackgroundImage ? undefined : "#000",
                      }}
                      onClick={event => {
                        const target = event.target as HTMLElement;
                        if (!target.closest(".scene-sprite") && !target.closest(".scene-background-transform") && !target.closest(".interaction-zone-outline")) clearSceneSelection();
                      }}
                      onContextMenu={event => {
                        const target = event.target as HTMLElement;
                        if (target.closest(".scene-sprite") || target.closest(".scene-background-transform") || target.closest(".interaction-zone-outline")) return;
                        if (backgroundLayer) openSceneLayerContextMenu(event, backgroundLayer);
                      }}
                      onPointerMove={stagePointerMove}
                      onPointerUp={() => { dragRef.current = null; resizeRef.current = null; zoneDragRef.current = null; zoneResizeRef.current = null; }}
                      onPointerLeave={() => { dragRef.current = null; resizeRef.current = null; zoneDragRef.current = null; zoneResizeRef.current = null; }}
                    >
                  {backgroundLayer?.visible && (() => {
                    const baseWidth = backgroundLayer.width || scene.width;
                    const baseHeight = backgroundLayer.height || scene.height;
                    const width = baseWidth * backgroundLayer.scale * spriteStageScale;
                    const height = baseHeight * backgroundLayer.scale * spriteStageScale;
                    const left = (backgroundLayer.x - scene.cameraX * (backgroundLayer.parallax ?? 1)) * stageScaleX;
                    const top = backgroundLayer.y * stageScaleY - height;
                    return (
                      <>
                        <div
                          className="scene-image-background"
                          style={{
                            left,
                            top,
                            width,
                            height,
                            opacity: backgroundLayer.opacity,
                            zIndex: backgroundLayer.zIndex,
                            filter: sceneFilter(scene),
                            backgroundColor: backgroundLayer.imageUrl ? (backgroundLayer.color || "#08070d") : "#000",
                          }}
                        >
                          {backgroundLayer.imageUrl ? (
                            <div
                              className="scene-image-background-fill"
                              style={{
                                backgroundImage: `url("${backgroundLayer.imageUrl}")`,
                                backgroundSize: backgroundSizeForFit(backgroundLayer.fit),
                                backgroundRepeat: backgroundLayer.fit === "tile" ? "repeat" : "no-repeat",
                                backgroundPosition: backgroundLayer.position || "center center",
                              }}
                            />
                          ) : null}
                        </div>
                        {!backgroundLayer.locked && (
                          <div
                            className={backgroundLayer.id === selectedLayerId ? "scene-background-transform selected" : "scene-background-transform"}
                            style={{
                              left,
                              top,
                              width,
                              height,
                              zIndex: Math.max(backgroundLayer.zIndex + 2, 2),
                            }}
                            onPointerDown={event => stagePointerDown(event, backgroundLayer)}
                            onClick={event => {
                              event.stopPropagation();
                              setSelectedLayerId(backgroundLayer.id);
                              setSelectedInteractionZoneLayerId(null);
                            }}
                            onContextMenu={event => openSceneLayerContextMenu(event, backgroundLayer)}
                          >
                            {backgroundLayer.id === selectedLayerId && (
                              <>
                                <span className="scene-background-label">Background</span>
                                <span className="resize-handle nw" title="Drag to resize background" onPointerDown={event => startLayerResize(event, backgroundLayer, baseWidth, baseHeight, "nw")} />
                                <span className="resize-handle ne" title="Drag to resize background" onPointerDown={event => startLayerResize(event, backgroundLayer, baseWidth, baseHeight, "ne")} />
                                <span className="resize-handle sw" title="Drag to resize background" onPointerDown={event => startLayerResize(event, backgroundLayer, baseWidth, baseHeight, "sw")} />
                                <span className="resize-handle se" title="Drag to resize background" onPointerDown={event => startLayerResize(event, backgroundLayer, baseWidth, baseHeight, "se")} />
                              </>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                  {backgroundLayer?.visible && sceneLight.preset !== "none" && (
                    <>
                      <div
                        className="scene-lighting-overlay"
                        style={{
                          opacity: sceneLight.ambience,
                          filter: `saturate(${sceneLight.glow}) brightness(${sceneLight.brightness})`,
                        }}
                      />
                      <div className="scene-vignette-overlay" style={{ opacity: sceneLight.vignette }} />
                    </>
                  )}
                  {groundLayer?.visible && (
                    <>
                      <div className="ground-band" style={{ top: `${scene.groundY * stageScaleY}px`, backgroundColor: groundLayer.color, opacity: groundLayer.opacity }} />
                      <div className="ground-line" style={{ top: `${scene.groundY * stageScaleY}px` }} />
                    </>
                  )}
                  {scene.layers
                    .filter(layer => layer.visible && isSceneVisualLayer(layer))
                    .sort((a, b) => a.zIndex - b.zIndex)
                    .map(layer => {
                      const asset = layer.assetId ? assetById.get(layer.assetId) : undefined;
                      if (!asset) return null;
                      const layerSprite = resolveAssetSprite(asset, layer);
                      if (!layerSprite) return null;
                      const interaction = layerInteractionSettings(layer, asset);
                      const isInteractionTrigger = asset.tags.includes("interaction-trigger");
                      const hotspotOpacity = isInteractionTrigger && interaction?.hotspotVisible === false && layer.id !== selectedLayerId
                        ? 0.08
                        : layer.opacity;
                      const mouseClip = asset.animations?.find(clip => clip.binding?.triggerType === "mouse");
                      const [assetW, assetH] = getFrameSize(layerSprite);
                      const width = assetW * layer.scale * spriteStageScale;
                      const height = assetH * layer.scale * spriteStageScale;
                      const frame = spriteFrame(layerSprite, activeFrame);
                      const shadow = layer.shadow || NEON_CONTACT_SHADOW;
                      const shadowWidth = width * shadow.width;
                      const shadowHeight = Math.max(8, height * shadow.height);
                      const stageX = (layer.x - scene.cameraX * (layer.parallax ?? 1)) * stageScaleX;
                      const zone = interaction ? interactionZoneBounds(layer, asset, interaction) : null;
                      return (
                        <Fragment key={layer.id}>
                          {shadow.enabled && (
                            <div
                              className="scene-contact-shadow"
                              style={{
                                left: stageX + width / 2 - shadowWidth / 2 + shadow.offsetX * spriteStageScale,
                                top: layer.y * stageScaleY - shadowHeight / 2 + shadow.offsetY * spriteStageScale,
                                width: shadowWidth,
                                height: shadowHeight,
                                zIndex: layer.zIndex - 1,
                                opacity: shadow.opacity * layer.opacity,
                                background: shadow.color,
                                filter: `blur(${shadow.blur * spriteStageScale}px)`,
                              }}
                            />
                          )}
                          <div
                            className={`${layer.id === selectedLayerId ? "scene-sprite selected" : "scene-sprite"} ${isInteractionTrigger ? "interaction-hotspot-layer" : ""}`}
                            style={{
                              left: stageX,
                              top: layer.y * stageScaleY - height,
                              width,
                              height,
                              zIndex: layer.zIndex,
                              opacity: hotspotOpacity,
                            }}
                            onPointerDown={event => {
                              stagePointerDown(event, layer);
                              setActiveSprite(layerSprite);
                              setActiveFrame(0);
                            }}
                            onClick={event => {
                              event.stopPropagation();
                              setSelectedLayerId(layer.id);
                              setActiveSprite(layerSprite);
                              setActiveFrame(0);
                            }}
                            onContextMenu={event => {
                              openSceneLayerContextMenu(event, layer);
                            }}
                          >
                            <div
                              className="sprite-art"
                              style={{ filter: sceneLayerRenderFilter(scene, layer, asset) }}
                              dangerouslySetInnerHTML={{ __html: frame }}
                            />
                          {layer.id === selectedLayerId && selectedInteractionZoneLayerId !== layer.id && (
                            <>
                              <span className="scene-selection-label">{layer.name}</span>
                              <span
                                className="resize-handle nw"
                                title="Drag to resize"
                                onPointerDown={event => startLayerResize(event, layer, assetW, assetH, "nw")}
                              />
                              <span
                                className="resize-handle ne"
                                title="Drag to resize"
                                onPointerDown={event => startLayerResize(event, layer, assetW, assetH, "ne")}
                              />
                              <span
                                className="resize-handle sw"
                                title="Drag to resize"
                                onPointerDown={event => startLayerResize(event, layer, assetW, assetH, "sw")}
                              />
                              <span
                              className="resize-handle se"
                              title="Drag to resize"
                              onPointerDown={event => startLayerResize(event, layer, assetW, assetH, "se")}
                            />
                            </>
                          )}
                          </div>
                          {zone && interaction?.enabled && (
                            <div
                              className={`interaction-zone-outline ${selectedInteractionZoneLayerId === layer.id ? "selected" : ""} ${selectedLayerId === layer.id ? "owner-selected" : ""}`}
                              style={{
                                left: (zone.left - scene.cameraX * (layer.parallax ?? 1)) * stageScaleX,
                                top: zone.top * stageScaleY,
                                width: zone.width * stageScaleX,
                                height: zone.height * stageScaleY,
                                zIndex: layer.zIndex + 5,
                              }}
                              onPointerDown={event => startInteractionZoneDrag(event, layer, interaction)}
                              onClick={event => {
                                event.stopPropagation();
                                setSelectedLayerId(layer.id);
                                setSelectedInteractionZoneLayerId(layer.id);
                                setActiveSprite(layerSprite);
                                setActiveFrame(0);
                              }}
                              onContextMenu={event => {
                                openSceneLayerContextMenu(event, layer, "interaction-zone");
                              }}
                            >
                              {selectedInteractionZoneLayerId === layer.id && (
                                <>
                                  <span>Interaction Zone</span>
                                  <i
                                    className="interaction-zone-handle nw"
                                    onPointerDown={event => startInteractionZoneResize(event, layer, asset, interaction, "nw")}
                                  />
                                  <i
                                    className="interaction-zone-handle ne"
                                    onPointerDown={event => startInteractionZoneResize(event, layer, asset, interaction, "ne")}
                                  />
                                  <i
                                    className="interaction-zone-handle sw"
                                    onPointerDown={event => startInteractionZoneResize(event, layer, asset, interaction, "sw")}
                                  />
                                  <i
                                    className="interaction-zone-handle se"
                                    onPointerDown={event => startInteractionZoneResize(event, layer, asset, interaction, "se")}
                                  />
                                </>
                              )}
                            </div>
                          )}
                        </Fragment>
                      );
                    })}
                  {nearbyInteraction && (
                    <button
                      type="button"
                      className={`interaction-prompt ${nearbyInteraction.interaction.promptStyle}`}
                      style={{
                        left: (nearbyInteraction.bounds.centerX - scene.cameraX * (nearbyInteraction.layer.parallax ?? 1)) * stageScaleX + nearbyInteraction.interaction.offsetX * spriteStageScale,
                        top: Math.max(14, nearbyInteraction.bounds.top * stageScaleY + nearbyInteraction.interaction.offsetY * spriteStageScale),
                        zIndex: nearbyInteraction.layer.zIndex + 8,
                        ["--prompt-font-size" as string]: `${nearbyInteraction.interaction.fontSize}px`,
                        ["--prompt-scale" as string]: nearbyInteraction.interaction.promptScale,
                      }}
                      onClick={event => {
                        event.stopPropagation();
                        triggerNearbyInteraction(nearbyInteraction);
                      }}
                      title={nearbyInteraction.interaction.promptText || "Inspect"}
                    >
                      <span className="interaction-eye" aria-hidden="true">
                        <img src="/generated/ui_chinese_horror_eye_inspect_prompt.png" alt="" draggable={false} />
                      </span>
                      {nearbyInteraction.interaction.showText && nearbyInteraction.interaction.promptText && (
                        <strong>{nearbyInteraction.interaction.promptText}</strong>
                      )}
                    </button>
                  )}
                  {interactionToast && <div className="interaction-toast">{interactionToast}</div>}
                  {isBackpackOpen && (
                    <button
                      type="button"
                      className="backpack-panel-overlay"
                      onClick={event => {
                        event.stopPropagation();
                        setIsBackpackOpen(false);
                      }}
                      title="Click to close backpack"
                    >
                      <img src="/generated/scene_kit_backpack_panel.png" alt="Open backpack inventory" draggable={false} />
                    </button>
                  )}
                    </div>
                    <div ref={sceneGlobalControlsRef} className="scene-global-controls" aria-label="Scene global controls">
                      <label>
                        <span>Camera X {Math.round(scene.cameraX)} / {cameraMax}</span>
                        <input type="range" min="0" max={cameraMax} step="1" value={scene.cameraX} onChange={event => setScene(prev => ({ ...prev, cameraX: Number(event.target.value) }))} />
                      </label>
                      <label>
                        <span>Global Brightness {sceneLight.brightness.toFixed(2)}</span>
                        <input type="range" min="0.45" max="1.35" step="0.01" value={sceneLight.brightness} onChange={event => updateSceneLighting({ brightness: Number(event.target.value) })} />
                      </label>
                      <label>
                        <span>Magenta Ambience {Math.round(sceneLight.ambience * 100)}%</span>
                        <input type="range" min="0" max="1" step="0.01" value={sceneLight.ambience} onChange={event => updateSceneLighting({ ambience: Number(event.target.value) })} />
                      </label>
                      <label>
                        <span>Glow {sceneLight.glow.toFixed(2)}</span>
                        <input type="range" min="0.5" max="1.8" step="0.01" value={sceneLight.glow} onChange={event => updateSceneLighting({ glow: Number(event.target.value) })} />
                      </label>
                      <label>
                        <span>Vignette {Math.round(sceneLight.vignette * 100)}%</span>
                        <input type="range" min="0" max="1" step="0.01" value={sceneLight.vignette} onChange={event => updateSceneLighting({ vignette: Number(event.target.value) })} />
                      </label>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="scene-resizer right"
                    aria-label="Resize inspector panel"
                    title="Drag to resize Inspector"
                    onPointerDown={event => startScenePanelResize(event, "inspector")}
                  />
                  <aside className="scene-mini-panel inspector-rail">
                    <div className="compact-inspector">
                      <strong>
                        {selectedInteractionZoneLayer
                          ? "Interaction Zone"
                          : selectedLayer ? (selectedLayerIsAvatar ? "Avatar Inspector" : "Item Inspector") : scene.name}
                      </strong>
                      <span>
                        {selectedInteractionZoneLayer
                          ? `Owner: ${selectedInteractionZoneLayer.name}`
                          : selectedLayer ? `${selectedLayer.name} / ${selectedLayerAsset ? roleLabels[selectedLayerAsset.role] : selectedLayer.type} / z${selectedLayer.zIndex}` : `${scene.layers.length} layers`}
                      </span>
                      <button
                        type="button"
                        className="inspector-primary-action"
                        onClick={downloadSelectedSceneItem}
                        disabled={!selectedLayer}
                      >
                        <Download size={15} /> Download Selected Item
                      </button>
                      {selectedLayer && (
                        <button
                          type="button"
                          className="inspector-secondary-action"
                          onClick={() => updateSceneLayer(selectedLayer.id, { locked: !selectedLayer.locked })}
                        >
                          {selectedLayer.locked ? <Unlock size={15} /> : <Lock size={15} />}
                          {selectedLayer.locked ? "Unlock Layer" : "Lock Layer"}
                        </button>
                      )}
                      {selectedLayer && (
                        <>
                          <div className="compact-inspector-section">
                            <em>Transform</em>
                            <label>Scale {selectedLayer.scale.toFixed(2)}</label>
                            <input type="range" min="0.05" max="2.5" step="0.01" value={selectedLayer.scale} onChange={event => updateSceneLayer(selectedLayer.id, { scale: Number(event.target.value) })} disabled={selectedLayer.locked || selectedInteractionZoneLayerId === selectedLayer.id} />
                            <label>Opacity {Math.round(selectedLayer.opacity * 100)}%</label>
                            <input type="range" min="0.1" max="1" step="0.01" value={selectedLayer.opacity} onChange={event => updateSceneLayer(selectedLayer.id, { opacity: Number(event.target.value) })} disabled={selectedLayer.locked || selectedInteractionZoneLayerId === selectedLayer.id} />
                          </div>

                          {selectedInteractionZoneLayer && selectedInteractionZoneSettings && (
                            <div className="compact-inspector-section interaction-zone-inspector">
                              <em>Interaction Zone</em>
                              <label>Zone X {selectedInteractionZoneSettings.zoneOffsetX || 0}px</label>
                              <input type="range" min="-520" max="520" step="1" value={selectedInteractionZoneSettings.zoneOffsetX || 0} onChange={event => updateLayerInteraction(selectedInteractionZoneLayer.id, { zoneOffsetX: Number(event.target.value) })} disabled={selectedInteractionZoneLayer.locked} />
                              <label>Zone Y {selectedInteractionZoneSettings.zoneOffsetY || 0}px</label>
                              <input type="range" min="-360" max="360" step="1" value={selectedInteractionZoneSettings.zoneOffsetY || 0} onChange={event => updateLayerInteraction(selectedInteractionZoneLayer.id, { zoneOffsetY: Number(event.target.value) })} disabled={selectedInteractionZoneLayer.locked} />
                              <div className="compact-dual-fields">
                                <label>
                                  Width
                                  <input type="number" min="24" value={Math.round(selectedInteractionZoneSettings.zoneWidth || layerWorldBounds(selectedInteractionZoneLayer, selectedInteractionZoneAsset).width || 160)} onChange={event => updateLayerInteraction(selectedInteractionZoneLayer.id, { zoneWidth: Number(event.target.value) })} disabled={selectedInteractionZoneLayer.locked} />
                                </label>
                                <label>
                                  Height
                                  <input type="number" min="24" value={Math.round(selectedInteractionZoneSettings.zoneHeight || layerWorldBounds(selectedInteractionZoneLayer, selectedInteractionZoneAsset).height || 120)} onChange={event => updateLayerInteraction(selectedInteractionZoneLayer.id, { zoneHeight: Number(event.target.value) })} disabled={selectedInteractionZoneLayer.locked} />
                                </label>
                              </div>
                              <span>Drag the zone directly on the scene to place it independently.</span>
                            </div>
                          )}

                          {isSceneVisualLayer(selectedLayer) && selectedLayerIsAvatar && (
                            <div className="compact-inspector-section avatar-inspector-section">
                              <em>Avatar</em>
                              <label>Walk Speed {walkSpeed}px/s</label>
                              <input type="range" min="40" max="260" step="5" value={walkSpeed} onChange={event => setWalkSpeed(Number(event.target.value))} disabled={selectedLayer.locked} />
                              <label className="compact-toggle">
                                <input type="checkbox" checked={isPlaying} onChange={event => setIsPlaying(event.target.checked)} />
                                Preview animation
                              </label>
                            </div>
                          )}

                          {isSceneVisualLayer(selectedLayer) && !selectedLayerIsAvatar && (
                            <div className="compact-inspector-section item-inspector-section">
                              <em>Item</em>
                              <label>Layer Type</label>
                              <select value={selectedLayer.type} onChange={event => updateSceneLayer(selectedLayer.id, { type: event.target.value as SceneLayer["type"] })} disabled={selectedLayer.locked}>
                                <option value="sprite">Sprite</option>
                                <option value="effect">Effect</option>
                                <option value="foreground">Foreground</option>
                                <option value="background">Background</option>
                              </select>
                              <label>Parallax {(selectedLayer.parallax ?? 1).toFixed(2)}</label>
                              <input type="range" min="0" max="1.25" step="0.01" value={selectedLayer.parallax ?? 1} onChange={event => updateSceneLayer(selectedLayer.id, { parallax: Number(event.target.value) })} disabled={selectedLayer.locked} />
                            </div>
                          )}

                          {isSceneVisualLayer(selectedLayer) && selectedLayerSprite && (
                            <div className="compact-inspector-section spritesheet-inspector-section">
                              <div className="spritesheet-section-heading">
                                <em>Spritesheet</em>
                                <button
                                  type="button"
                                  onClick={() => selectedLayerAsset && saveAssetMetadata(selectedLayerAsset.id)}
                                  disabled={!selectedLayerAsset || !selectedAssetEditable}
                                >
                                  <Save size={13} /> Save
                                </button>
                              </div>

                              <div className="spritesheet-param-grid">
                                <span>Frames <strong>{selectedLayerSpriteFrameCount}</strong></span>
                                <span>Frame <strong>{selectedLayerFrameSize[0]} x {selectedLayerFrameSize[1]}</strong></span>
                                <span>Sheet <strong>{selectedLayerSpriteSheetSize.join(" x ") || "SVG"}</strong></span>
                                <span>Grid <strong>{selectedLayerSpriteColumns} x {selectedLayerSpriteRows}</strong></span>
                              </div>

                              <div className="spritesheet-preview-controls">
                                <button type="button" onClick={() => { setIsPlaying(value => !value); setActiveSprite(selectedLayerSprite); }}>
                                  {isPlaying ? <Pause size={13} /> : <Play size={13} />} {isPlaying ? "Pause" : "Play"}
                                </button>
                                <button type="button" onClick={() => { setActiveSprite(selectedLayerSprite); setActiveFrame(0); setIsPlaying(true); }}>
                                  Restart
                                </button>
                                <button
                                  type="button"
                                  disabled={!selectedLayerSpriteSource}
                                  onClick={() => selectedLayerSpriteSource && downloadUrl(selectedLayerSpriteSource, `spritesheet_${safeName(selectedLayerSprite.characterName)}.png`)}
                                >
                                  <Download size={13} /> PNG
                                </button>
                              </div>

                              <label>Preview FPS {selectedLayerClipFps}</label>
                              <input
                                type="range"
                                min="1"
                                max="60"
                                step="1"
                                value={selectedLayerClipFps}
                                onChange={event => updateSelectedSpritesheetFps(Number(event.target.value))}
                              />

                              {selectedLayerSprite.frames.length ? (
                                <>
                                  <label>Current Frame {selectedLayerSpriteFrameIndex + 1} / {selectedLayerSpriteFrameCount}</label>
                                  <input
                                    type="range"
                                    min="0"
                                    max={Math.max(0, selectedLayerSprite.frames.length - 1)}
                                    step="1"
                                    value={selectedLayerSpriteFrameIndex}
                                    onChange={event => {
                                      setIsPlaying(false);
                                      setActiveFrame(Number(event.target.value));
                                    }}
                                  />
                                  <div className="spritesheet-frame-strip">
                                    {selectedLayerSprite.frames.slice(0, 24).map((frame, frameIndex) => {
                                      const frameThumbStyle = spritesheetFrameThumbStyle(selectedLayerSprite, frameIndex);
                                      return (
                                        <button
                                          key={`${selectedLayerSprite.id}_${frameIndex}`}
                                          type="button"
                                          className={frameIndex === selectedLayerSpriteFrameIndex ? "active" : ""}
                                          style={{ aspectRatio: `${selectedLayerFrameSize[0]} / ${selectedLayerFrameSize[1]}` }}
                                          onClick={() => {
                                            setIsPlaying(false);
                                            setActiveSprite(selectedLayerSprite);
                                            setActiveFrame(frameIndex);
                                          }}
                                          title={`Frame ${frameIndex + 1}`}
                                        >
                                          {frameThumbStyle ? (
                                            <span className="spritesheet-frame-thumb" style={frameThumbStyle} />
                                          ) : (
                                            <span dangerouslySetInnerHTML={{ __html: frame }} />
                                          )}
                                        </button>
                                      );
                                    })}
                                    {selectedLayerSprite.frames.length > 24 && <i>+{selectedLayerSprite.frames.length - 24}</i>}
                                  </div>
                                </>
                              ) : null}

                              {selectedLayerAsset && (
                                <>
                                  <div className="compact-dual-fields">
                                    <label>
                                      Asset Name
                                      <input
                                        value={selectedLayerAsset.name}
                                        disabled={!selectedAssetEditable}
                                        onChange={event => updateAssetMetadata(selectedLayerAsset.id, { name: event.target.value })}
                                      />
                                    </label>
                                    <label>
                                      Role
                                      <select
                                        value={selectedLayerAsset.role}
                                        disabled={!selectedAssetEditable}
                                        onChange={event => updateAssetMetadata(selectedLayerAsset.id, { role: event.target.value as AssetRole })}
                                      >
                                        {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                      </select>
                                    </label>
                                  </div>
                                  <label>Sprite Name</label>
                                  <input
                                    value={selectedLayerSprite.characterName}
                                    disabled={!selectedAssetEditable}
                                    onChange={event => updateSelectedSpriteMetadata({ characterName: event.target.value })}
                                  />
                                </>
                              )}

                              {selectedLayerAsset?.animations?.length ? (
                                <>
                                  <label>Clip</label>
                                  <div className="spritesheet-clip-buttons">
                                    {selectedLayerAsset.animations.map(clip => (
                                      <button
                                        key={clip.id}
                                        type="button"
                                        className={clip.id === selectedLayerClip?.id ? "active" : ""}
                                        onClick={() => setLayerAnimation(selectedLayer.id, clip)}
                                      >
                                        {clipButtonText(clip)}
                                      </button>
                                    ))}
                                  </div>
                                  <select
                                    value={selectedLayer.activeAnimationId || selectedLayerAsset.defaultAnimationId || selectedLayerClip?.id || ""}
                                    onChange={event => {
                                      const clip = selectedLayerAsset.animations?.find(item => item.id === event.target.value);
                                      if (clip) setLayerAnimation(selectedLayer.id, clip);
                                    }}
                                  >
                                    {selectedLayerAsset.animations.map(clip => (
                                      <option key={clip.id} value={clip.id}>{clipButtonText(clip)}</option>
                                    ))}
                                  </select>
                                  {selectedLayerClip && (
                                    <>
                                      <label>Clip Name</label>
                                      <input
                                        value={selectedLayerClip.name}
                                        disabled={!selectedAssetEditable}
                                        onChange={event => updateAssetClipMetadata(selectedLayerAsset.id, selectedLayerClip.id, { name: event.target.value })}
                                      />
                                      <div className="compact-dual-fields">
                                        <label>
                                          Action
                                          <input
                                            value={selectedLayerClip.actionName}
                                            disabled={!selectedAssetEditable}
                                            onChange={event => updateAssetClipMetadata(selectedLayerAsset.id, selectedLayerClip.id, { actionName: event.target.value }, { actionName: event.target.value })}
                                          />
                                        </label>
                                        <label>
                                          Direction
                                          <select
                                            value={selectedLayerClip.direction}
                                            disabled={!selectedAssetEditable}
                                            onChange={event => updateAssetClipMetadata(selectedLayerAsset.id, selectedLayerClip.id, { direction: event.target.value as AnimationClip["direction"] })}
                                          >
                                            <option value="none">None</option>
                                            <option value="left">Left</option>
                                            <option value="right">Right</option>
                                          </select>
                                        </label>
                                      </div>
                                      <div className="compact-dual-fields">
                                        <label>
                                          Trigger
                                          <select
                                            value={selectedLayerClip.binding?.triggerType || selectedLayerAsset.binding.triggerType}
                                            disabled={!selectedAssetEditable}
                                            onChange={event => updateAssetClipMetadata(selectedLayerAsset.id, selectedLayerClip.id, {}, { triggerType: event.target.value as ActionTriggerType })}
                                          >
                                            {Object.entries(triggerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                          </select>
                                        </label>
                                        <label>
                                          Value
                                          <input
                                            value={selectedLayerClip.binding?.triggerValue || selectedLayerAsset.binding.triggerValue}
                                            disabled={!selectedAssetEditable}
                                            onChange={event => updateAssetClipMetadata(selectedLayerAsset.id, selectedLayerClip.id, {}, { triggerValue: event.target.value })}
                                          />
                                        </label>
                                      </div>
                                      <label>Game State</label>
                                      <input
                                        value={selectedLayerClip.binding?.gameState || selectedLayerAsset.binding.gameState}
                                        disabled={!selectedAssetEditable}
                                        onChange={event => updateAssetClipMetadata(selectedLayerAsset.id, selectedLayerClip.id, {}, { gameState: event.target.value })}
                                      />
                                      <label className="compact-toggle">
                                        <input
                                          type="checkbox"
                                          checked={selectedLayerClip.loop}
                                          disabled={!selectedAssetEditable}
                                          onChange={event => updateAssetClipMetadata(selectedLayerAsset.id, selectedLayerClip.id, { loop: event.target.checked })}
                                        />
                                        Loop clip
                                      </label>
                                      <button
                                        type="button"
                                        className="inspector-secondary-action"
                                        disabled={!selectedAssetEditable}
                                        onClick={() => updateAssetMetadata(selectedLayerAsset.id, { defaultAnimationId: selectedLayerClip.id })}
                                      >
                                        Set As Default Clip
                                      </button>
                                    </>
                                  )}
                                </>
                              ) : (
                                <span>Static sprite object: one frame, no animation clip.</span>
                              )}

                              <div className="spritesheet-grid-editor">
                                <em>Frame Grid</em>
                                <div className="compact-dual-fields">
                                  <label>
                                    Frame W
                                    <input
                                      type="number"
                                      min="1"
                                      value={selectedLayerFrameSize[0]}
                                      disabled={!selectedLayerSpriteEditableGrid}
                                      onChange={event => rebuildSelectedSpritesheetGrid({ frameWidth: Number(event.target.value) })}
                                    />
                                  </label>
                                  <label>
                                    Frame H
                                    <input
                                      type="number"
                                      min="1"
                                      value={selectedLayerFrameSize[1]}
                                      disabled={!selectedLayerSpriteEditableGrid}
                                      onChange={event => rebuildSelectedSpritesheetGrid({ frameHeight: Number(event.target.value) })}
                                    />
                                  </label>
                                </div>
                                <div className="compact-dual-fields">
                                  <label>
                                    Frames
                                    <input
                                      type="number"
                                      min="1"
                                      value={selectedLayerSpriteFrameCount}
                                      disabled={!selectedLayerSpriteEditableGrid}
                                      onChange={event => rebuildSelectedSpritesheetGrid({ frameCount: Number(event.target.value) })}
                                    />
                                  </label>
                                  <label>
                                    Columns
                                    <input
                                      type="number"
                                      min="1"
                                      value={selectedLayerSpriteColumns}
                                      disabled={!selectedLayerSpriteEditableGrid}
                                      onChange={event => rebuildSelectedSpritesheetGrid({ columns: Number(event.target.value) })}
                                    />
                                  </label>
                                </div>
                                <span>
                                  {selectedLayerSpriteEditableGrid
                                    ? `Source ${selectedLayerSpriteSheetSize[0]} x ${selectedLayerSpriteSheetSize[1]} / ${selectedLayerSpriteRows} rows`
                                    : selectedAssetEditable ? "Static images and SVG assets do not need grid slicing." : "Read-only asset. Import a copy to edit grid slicing."}
                                </span>
                              </div>

                              {!selectedAssetEditable && (
                                <span>Built-in spritesheet metadata is read-only. Imported assets can edit these values.</span>
                              )}
                            </div>
                          )}

                          {isSceneVisualLayer(selectedLayer) && !selectedLayer.locked && (
                            <div className="compact-inspector-section">
                              <em>Lighting</em>
                              <div className="compact-action-row">
                                <button type="button" onClick={applyNeonLightingToSelectedLayer}>Neon</button>
                                <button type="button" onClick={clearLightingFromSelectedLayer}>Off</button>
                              </div>
                              <label>Brightness {selectedLayerLight.brightness.toFixed(2)}</label>
                              <input type="range" min="0.25" max="1.35" step="0.01" value={selectedLayerLight.brightness} onChange={event => updateSelectedLayerLighting({ brightness: Number(event.target.value), preset: "neon-station" })} />
                              <label>Contrast {selectedLayerLight.contrast.toFixed(2)}</label>
                              <input type="range" min="0.55" max="1.55" step="0.01" value={selectedLayerLight.contrast} onChange={event => updateSelectedLayerLighting({ contrast: Number(event.target.value), preset: "neon-station" })} />
                              <label>Saturation {selectedLayerLight.saturate.toFixed(2)}</label>
                              <input type="range" min="0.25" max="1.5" step="0.01" value={selectedLayerLight.saturate} onChange={event => updateSelectedLayerLighting({ saturate: Number(event.target.value), preset: "neon-station" })} />
                              <label>Edge Light {Math.round(selectedLayerLight.edgeLightOpacity * 100)}%</label>
                              <input type="range" min="0" max="0.75" step="0.01" value={selectedLayerLight.edgeLightOpacity} onChange={event => updateSelectedLayerLighting({ edgeLightOpacity: Number(event.target.value), preset: "neon-station" })} />
                              <label>Contact Shadow {Math.round(selectedLayerShadow.opacity * 100)}%</label>
                              <input type="range" min="0" max="1" step="0.01" value={selectedLayerShadow.opacity} onChange={event => updateSelectedLayerShadow({ opacity: Number(event.target.value), enabled: Number(event.target.value) > 0 })} />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </aside>
                </div>
                <div className="scene-toolbar">
                  <input
                    className="scene-name-input"
                    value={scene.name}
                    onChange={event => setScene(prev => ({ ...prev, name: event.target.value }))}
                    aria-label="Scene name"
                  />
                  <button className="ghost-button" onClick={insertActiveSprite}><Plus size={16} /> Insert Current Action</button>
                  <button className="ghost-button" onClick={duplicateSelectedLayer}><Copy size={16} /> Duplicate Layer</button>
                  <button className="ghost-button" onClick={removeSelectedLayer}><Trash2 size={16} /> Delete Layer</button>
                  <button className="ghost-button" onClick={() => downloadJson(scenePayload, `scene_${safeName(scene.name)}.json`)}><Download size={16} /> Export Scene JSON</button>
                </div>
                <div className="lighting-strip">
                  <label>Global Brightness {sceneLight.brightness.toFixed(2)}<input type="range" min="0.45" max="1.35" step="0.01" value={sceneLight.brightness} onChange={event => updateSceneLighting({ brightness: Number(event.target.value) })} /></label>
                  <label>Magenta Ambience {Math.round(sceneLight.ambience * 100)}%<input type="range" min="0" max="1" step="0.01" value={sceneLight.ambience} onChange={event => updateSceneLighting({ ambience: Number(event.target.value) })} /></label>
                  <label>Camera X {Math.round(scene.cameraX)} / {cameraMax}<input type="range" min="0" max={cameraMax} step="1" value={scene.cameraX} onChange={event => setScene(prev => ({ ...prev, cameraX: Number(event.target.value) }))} /></label>
                  {selectedLayer && isSceneVisualLayer(selectedLayer) && !selectedLayer.locked && (
                    <>
                      <label>Character Brightness {selectedLayerLight.brightness.toFixed(2)}<input type="range" min="0.25" max="1.35" step="0.01" value={selectedLayerLight.brightness} onChange={event => updateSelectedLayerLighting({ brightness: Number(event.target.value), preset: "neon-station" })} /></label>
                      <label>Contact Shadow {Math.round(selectedLayerShadow.opacity * 100)}%<input type="range" min="0" max="1" step="0.01" value={selectedLayerShadow.opacity} onChange={event => updateSelectedLayerShadow({ opacity: Number(event.target.value), enabled: Number(event.target.value) > 0 })} /></label>
                    </>
                  )}
                </div>
              </div>
            )}

            {tab === "spritesheets" && (
              <div className="spritesheet-library-page">
                <div className="scene-library-header">
                  <div>
                    <p className="eyebrow">Scene Spritesheets</p>
                    <h3>{sceneSpritesheetEntries.length} animation clips in this scene</h3>
                  </div>
                  <div className="scene-library-actions">
                    <button type="button" className="ghost-button" onClick={() => setIsPlaying(value => !value)}>
                      {isPlaying ? <Pause size={16} /> : <Play size={16} />} {isPlaying ? "Pause All" : "Play All"}
                    </button>
                    <button type="button" className="primary-button" onClick={saveScene}><Save size={16} /> Save Scene</button>
                  </div>
                </div>

                <div className="spritesheet-library-grid">
                  {sceneSpritesheetEntries.map(entry => {
                    const isExpanded = expandedSpritesheetKey === entry.key;
                    const clipBinding = entry.clip?.binding || entry.asset.binding;
                    const editableAsset = assets.some(asset => asset.id === entry.asset.id);
                    const frameCount = entry.sprite.frames.length || 1;
                    const assetClips = entry.asset.animations || [];
                    return (
                      <article key={entry.key} className={isExpanded ? "spritesheet-inspector-card expanded" : "spritesheet-inspector-card"}>
                        <button
                          type="button"
                          className="spritesheet-inspector-preview"
                          style={checkerStyle}
                          onClick={() => previewSceneSpritesheetEntry(entry)}
                        >
                          <div
                            style={{ aspectRatio: `${entry.frameWidth} / ${entry.frameHeight}` }}
                            dangerouslySetInnerHTML={{ __html: spriteFrame(entry.sprite, activeFrame) }}
                          />
                        </button>
                        <div className="spritesheet-inspector-main">
                          <div className="spritesheet-inspector-title">
                            <div>
                              <strong>{entry.clip?.name || entry.asset.name}</strong>
                              <span>{entry.layer.name} / {roleLabels[entry.asset.role]} / {frameCount} frames / {entry.frameWidth} x {entry.frameHeight}</span>
                            </div>
                            <button
                              type="button"
                              className={isExpanded ? "active" : ""}
                              onClick={() => setExpandedSpritesheetKey(isExpanded ? null : entry.key)}
                            >
                              Edit
                            </button>
                          </div>
                          <div className="spritesheet-inspector-actions">
                            <button type="button" onClick={() => previewSceneSpritesheetEntry(entry)}><Play size={13} /> Preview</button>
                            <button type="button" onClick={() => previewSceneSpritesheetEntry(entry, true)}><MapIcon size={13} /> Locate Layer</button>
                            <button type="button" onClick={() => downloadUrl(entry.sprite.spritesheetPng || entry.sprite.rawSpritesheetPng || "", `spritesheet_${safeName(entry.sprite.characterName)}.png`)} disabled={!entry.sprite.spritesheetPng && !entry.sprite.rawSpritesheetPng}><Download size={13} /> PNG</button>
                          </div>

                          {isExpanded && (
                            <div className="spritesheet-inspector-editor">
                              {!editableAsset && (
                                <div className="control-hint">This is a built-in scene kit asset. You can edit layer placement in the Scene tab, but persistent metadata editing is available for confirmed assets.</div>
                              )}
                              <div className="two-col">
                                <div>
                                  <label>Asset Name</label>
                                  <input
                                    value={entry.asset.name}
                                    disabled={!editableAsset}
                                    onChange={event => updateAssetMetadata(entry.asset.id, { name: event.target.value })}
                                  />
                                </div>
                                <div>
                                  <label>Asset Role</label>
                                  <select
                                    value={entry.asset.role}
                                    disabled={!editableAsset}
                                    onChange={event => updateAssetMetadata(entry.asset.id, { role: event.target.value as AssetRole })}
                                  >
                                    {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                  </select>
                                </div>
                              </div>

                              <div className="two-col">
                                <div>
                                  <label>Layer Clip</label>
                                  <select
                                    value={entry.layer.activeAnimationId || entry.asset.defaultAnimationId || entry.clip?.id || ""}
                                    onChange={event => {
                                      const nextClip = entry.asset.animations?.find(clip => clip.id === event.target.value);
                                      if (nextClip) setLayerAnimation(entry.layer.id, nextClip);
                                    }}
                                  >
                                    {assetClips.length
                                      ? assetClips.map(clip => <option key={clip.id} value={clip.id}>{clip.name}</option>)
                                      : <option value="">Single Sprite</option>}
                                  </select>
                                </div>
                                <div>
                                  <label>Default Clip</label>
                                  <select
                                    value={entry.asset.defaultAnimationId || entry.clip?.id || ""}
                                    disabled={!editableAsset || !entry.asset.animations?.length}
                                    onChange={event => updateAssetMetadata(entry.asset.id, { defaultAnimationId: event.target.value })}
                                  >
                                    {assetClips.length
                                      ? assetClips.map(clip => <option key={clip.id} value={clip.id}>{clip.name}</option>)
                                      : <option value="">Single Sprite</option>}
                                  </select>
                                </div>
                              </div>

                              <div className="two-col">
                                <div>
                                  <label>Clip Name</label>
                                  <input
                                    value={entry.clip?.name || entry.asset.binding.actionName}
                                    disabled={!editableAsset}
                                    onChange={event => entry.clip
                                      ? updateAssetClipMetadata(entry.asset.id, entry.clip.id, { name: event.target.value })
                                      : updateAssetMetadata(entry.asset.id, { binding: { ...entry.asset.binding, actionName: event.target.value } })
                                    }
                                  />
                                </div>
                                <div>
                                  <label>Action Name</label>
                                  <input
                                    value={entry.clip?.actionName || entry.asset.binding.actionName}
                                    disabled={!editableAsset}
                                    onChange={event => entry.clip
                                      ? updateAssetClipMetadata(entry.asset.id, entry.clip.id, { actionName: event.target.value }, { actionName: event.target.value })
                                      : updateAssetMetadata(entry.asset.id, { binding: { ...entry.asset.binding, actionName: event.target.value } })
                                    }
                                  />
                                </div>
                              </div>

                              <div className="two-col">
                                <div>
                                  <label>Trigger Type</label>
                                  <select
                                    value={clipBinding.triggerType}
                                    disabled={!editableAsset}
                                    onChange={event => entry.clip
                                      ? updateAssetClipMetadata(entry.asset.id, entry.clip.id, {}, { triggerType: event.target.value as ActionTriggerType })
                                      : updateAssetMetadata(entry.asset.id, { binding: { ...entry.asset.binding, triggerType: event.target.value as ActionTriggerType } })
                                    }
                                  >
                                    {Object.entries(triggerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label>Trigger Value</label>
                                  <input
                                    value={clipBinding.triggerValue}
                                    disabled={!editableAsset}
                                    onChange={event => entry.clip
                                      ? updateAssetClipMetadata(entry.asset.id, entry.clip.id, {}, { triggerValue: event.target.value })
                                      : updateAssetMetadata(entry.asset.id, { binding: { ...entry.asset.binding, triggerValue: event.target.value } })
                                    }
                                  />
                                </div>
                              </div>

                              <label>Game State</label>
                              <input
                                value={clipBinding.gameState}
                                disabled={!editableAsset}
                                onChange={event => entry.clip
                                  ? updateAssetClipMetadata(entry.asset.id, entry.clip.id, {}, { gameState: event.target.value })
                                  : updateAssetMetadata(entry.asset.id, { binding: { ...entry.asset.binding, gameState: event.target.value } })
                                }
                              />

                              <div className="two-col">
                                <div>
                                  <label>Direction</label>
                                  <select
                                    value={entry.clip?.direction || "none"}
                                    disabled={!editableAsset || !entry.clip}
                                    onChange={event => entry.clip && updateAssetClipMetadata(entry.asset.id, entry.clip.id, { direction: event.target.value as AnimationClip["direction"] })}
                                  >
                                    <option value="none">None</option>
                                    <option value="left">Left</option>
                                    <option value="right">Right</option>
                                  </select>
                                </div>
                                <div>
                                  <label>Loop</label>
                                  <select
                                    value={entry.clip?.loop ? "true" : "false"}
                                    disabled={!editableAsset || !entry.clip}
                                    onChange={event => entry.clip && updateAssetClipMetadata(entry.asset.id, entry.clip.id, { loop: event.target.value === "true" })}
                                  >
                                    <option value="true">Loop</option>
                                    <option value="false">Play Once</option>
                                  </select>
                                </div>
                              </div>

                              <label>Tags</label>
                              <input
                                value={entry.asset.tags.join(", ")}
                                disabled={!editableAsset}
                                onChange={event => updateAssetMetadata(entry.asset.id, { tags: splitTags(event.target.value) })}
                              />

                              <div className="spritesheet-inspector-save-row">
                                <button type="button" className="ghost-button" onClick={() => saveAssetMetadata(entry.asset.id)} disabled={!editableAsset}><Save size={14} /> Save Asset Metadata</button>
                                <button type="button" className="ghost-button" onClick={() => updateSceneLayer(entry.layer.id, { visible: !entry.layer.visible })}>{entry.layer.visible ? <EyeOff size={14} /> : <Eye size={14} />} {entry.layer.visible ? "Hide Layer" : "Show Layer"}</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>

                {!sceneSpritesheetEntries.length && (
                  <div className="scene-library-empty">
                    <strong>No spritesheets in this scene yet.</strong>
                    <span>Insert a confirmed asset or import a spritesheet animation to see it here.</span>
                  </div>
                )}
              </div>
            )}

            {tab === "preview" && (
              <div className="simulator-row">
                <div className={bgClass}>
                  {currentFrame ? (
                    <div
                      className={`sprite-render ${isTallFrame ? "tall" : ""}`}
                      style={{ aspectRatio: frameRatio }}
                      dangerouslySetInnerHTML={{ __html: currentFrame }}
                    />
                  ) : <span>No frames</span>}
                </div>
                <div className="timeline-panel">
                  <div className="big-frame">{String(activeSpriteFrameIndex + 1).padStart(2, "0")}<span>/{frames.length}</span></div>
                  <input type="range" min="0" max={Math.max(0, frames.length - 1)} value={activeSpriteFrameIndex} onChange={event => { setIsPlaying(false); setActiveFrame(Number(event.target.value)); }} />
                  <div className="player-controls">
                    <button onClick={() => setActiveFrame(value => (value === 0 ? frames.length - 1 : value - 1))}>Previous Frame</button>
                    <button onClick={() => setIsPlaying(value => !value)}>{isPlaying ? "Pause" : "Play"}</button>
                    <button onClick={() => setActiveFrame(value => (value + 1) % frames.length)}>Next Frame</button>
                  </div>
                  <div className="bg-buttons">
                    <button className={bgMode === "checker" ? "active" : ""} onClick={() => setBgMode("checker")}>Grid</button>
                    <button className={bgMode === "dark" ? "active" : ""} onClick={() => setBgMode("dark")}>Dark</button>
                    <button className={bgMode === "light" ? "active" : ""} onClick={() => setBgMode("light")}>Light</button>
                    <button className={bgMode === "green" ? "active" : ""} onClick={() => setBgMode("green")}>Green</button>
                  </div>
                </div>
              </div>
            )}

            {tab === "frames" && (
              <div className="frames-grid">
                {frames.map((svg, idx) => (
                  <button key={idx} className={`frame-tile ${idx === activeSpriteFrameIndex ? "active" : ""}`} onClick={() => { setActiveFrame(idx); setIsPlaying(false); }}>
                    <div className="frame-canvas" style={{ ...checkerStyle, aspectRatio: frameRatio }}><div dangerouslySetInnerHTML={{ __html: svg }} /></div>
                    <div className="frame-meta"><span>Frame {idx + 1}</span></div>
                  </button>
                ))}
              </div>
            )}

            {tab === "sheet" && (
              <div className="sheet-panel">
                {sheetDataUrl ? (
                  <>
                    <div className="sheet-info">{activeSprite.sheetSize?.join(" x ") || `${frameW * sheetColumns} x ${frameH * Math.ceil(activeSprite.frames.length / sheetColumns)}`} / frame {frameW} x {frameH}px / {activeSprite.frames.length} frames</div>
                    <img src={sheetDataUrl} alt="spritesheet" />
                  </>
                ) : <button onClick={compileSheet}>Generate Sheet Preview</button>}
              </div>
            )}

            {tab === "blueprint" && (
              <div className="source-panel">
                <div><strong>Asset Library:</strong> {assets.length} confirmed assets, {scenes.length} saved scenes.</div>
                <div><strong>Current Action:</strong> {activeSprite.characterName} / {activeSprite.frames.length} frames / {frameW} x {frameH}</div>
                <div><strong>Action Binding:</strong> {triggerLabels[binding.triggerType]} / {binding.triggerValue} / {binding.gameState}</div>
                <div><strong>Layer Rules:</strong> Background, ground, character, effects, and foreground are separated into layers; character and effect layers can be dragged, resized, sorted, and hidden.</div>
                <div><strong>Save Path:</strong> D:\2d-animation-spritesheet-generator\public\generated\game_asset_library.json</div>
                <button className="ghost-button" onClick={() => downloadJson({ assets, scenes: [scene] }, "game_asset_library_export.json")}><Download size={16} /> Export Full Library JSON</button>
              </div>
            )}
          </div>
        </section>

        <aside className="panel right-panel utility-panel">
          <MotionSpeedPanel
            fps={fps}
            walkSpeed={walkSpeed}
            onFpsChange={setFps}
            onWalkSpeedChange={setWalkSpeed}
          />

          <GlobalSceneLightingPanel
            cameraMax={cameraMax}
            cameraX={scene.cameraX}
            lighting={sceneLight}
            onApplyNeonStation={() => updateSceneLighting({ ...NEON_SCENE_LIGHTING })}
            onCameraXChange={value => setScene(prev => ({ ...prev, cameraX: value }))}
            onDisableGlobalLighting={() => updateSceneLighting({ ...NEON_SCENE_LIGHTING, preset: "none" as const })}
            onLightingChange={updateSceneLighting}
          />

          {SHOW_SCENE_KIT_TOOLS && (
            <section>
              <div className="section-title"><Plus size={17} /> Reusable Scene Kit</div>
              <div className="scene-kit-grid">
                <button type="button" className="primary-button" onClick={insertFullSceneKit}>Add Subway Kit</button>
                <button type="button" onClick={() => insertSceneKitAsset(INSPECT_TRIGGER_ASSET_ID)}>Eye Inspect Hotspot</button>
                <button type="button" onClick={() => insertSceneKitAsset("asset_scene_ticket_machine")}>Ticket Machine</button>
                <button type="button" onClick={() => insertSceneKitAsset("asset_scene_backpack_ui")}>Backpack HUD</button>
                <button type="button" onClick={() => insertSceneKitAsset("asset_scene_station_sign_13")}>Platform 13 Sign</button>
                <button type="button" onClick={() => insertSceneKitAsset(BOARDING_TRAIN_ASSET_ID)}>Boarding Train</button>
                <button type="button" onClick={() => insertSceneKitAsset("asset_scene_backpack_panel")}>Open Backpack Panel</button>
              </div>
              <div className="control-hint">These are reusable assets with saved trigger metadata. Eye Inspect Hotspot can be dragged anywhere and customized per layer.</div>
            </section>
          )}

          <section>
            <div className="section-title"><Monitor size={17} /> Simulation Screen</div>
            <div className="screen-frame-summary">
              <strong>{Math.round(viewportWidth)} x {Math.round(viewportHeight)}</strong>
              <span>{selectedViewportPreset?.label || "Custom"} / {viewportRatioLabel}</span>
            </div>
            <div className="device-preset-grid">
              {VIEWPORT_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  className={scene.viewportPreset === preset.id ? "active" : ""}
                  onClick={() => updateSceneFrame({ viewportWidth: preset.width, viewportHeight: preset.height, viewportPreset: preset.id })}
                >
                  <span className="device-preset-title"><ViewportPresetIconView icon={preset.icon} /> {preset.label}</span>
                  <span className="device-preset-meta">{preset.width} x {preset.height} / {preset.note}</span>
                </button>
              ))}
            </div>
            <div className="two-col">
              <div>
                <label>Frame Width</label>
                <input type="number" min="240" value={Math.round(viewportWidth)} onChange={event => updateSceneFrame({ viewportWidth: Number(event.target.value), viewportPreset: "custom" })} />
              </div>
              <div>
                <label>Frame Height</label>
                <input type="number" min="240" value={Math.round(viewportHeight)} onChange={event => updateSceneFrame({ viewportHeight: Number(event.target.value), viewportPreset: "custom" })} />
              </div>
            </div>
            <label>Background Fit</label>
            <select
              value={backgroundLayer?.fit || "stretch"}
              onChange={event => backgroundLayer && updateSceneLayer(backgroundLayer.id, { fit: event.target.value as SceneLayer["fit"] })}
            >
              <option value="stretch">Stretch to world</option>
              <option value="cover">Cover frame</option>
              <option value="contain">Contain frame</option>
              <option value="tile">Tile</option>
            </select>
            <label>Background Position</label>
            <input
              value={backgroundLayer?.position || "left center"}
              onChange={event => backgroundLayer && updateSceneLayer(backgroundLayer.id, { position: event.target.value })}
              placeholder="left center / center center / 40% 50%"
            />
            <div className="control-hint">The scene world can stay wide while this frame controls the visible screen size for desktop, tablet, and phone previews.</div>
          </section>

          <section>
            <div className="section-title"><Layers size={17} /> Layers</div>
            <div className="control-hint">Drag unlocked layer rows to decide what renders above or below. Top rows render in front.</div>
            <div className="layer-list">
              {scene.layers
                .slice()
                .sort((a, b) => b.zIndex - a.zIndex)
                .map(layer => {
                  const canDragLayer = !layer.locked;
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      draggable={canDragLayer}
                      className={`${layer.id === selectedLayerId ? "layer-row active" : "layer-row"} ${draggedLayerId === layer.id ? "dragging" : ""}`}
                      onClick={() => {
                        setSelectedLayerId(layer.id);
                        setSelectedInteractionZoneLayerId(null);
                        const layerAsset = layer.assetId ? assetById.get(layer.assetId) : undefined;
                        const layerSprite = resolveAssetSprite(layerAsset, layer);
                        if (layerSprite) setActiveSprite(layerSprite);
                      }}
                      onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                        if (!canDragLayer) {
                          event.preventDefault();
                          return;
                        }
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", layer.id);
                        setDraggedLayerId(layer.id);
                      }}
                      onDragOver={event => {
                        if (!draggedLayerId || !canDragLayer || draggedLayerId === layer.id) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={event => {
                        event.preventDefault();
                        const sourceId = event.dataTransfer.getData("text/plain") || draggedLayerId;
                        if (sourceId && canDragLayer) reorderLayerStack(sourceId, layer.id);
                        setDraggedLayerId(null);
                      }}
                      onDragEnd={() => setDraggedLayerId(null)}
                    >
                      <span className="drag-grip" title={canDragLayer ? "Drag to reorder" : "Locked layer"}>{canDragLayer ? "::" : "--"}</span>
                      <span>{layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}</span>
                      <strong>{layer.name}</strong>
                      <em>{layer.type} / z{layer.zIndex}</em>
                    </button>
                  );
                })}
            </div>

            {selectedLayer && (
              <div className="layer-controls">
                <label>Layer Name</label>
                <input value={selectedLayer.name} onChange={event => updateSceneLayer(selectedLayer.id, { name: event.target.value })} disabled={selectedLayer.locked} />
                <div className="two-col">
                  <div>
                    <label>X</label>
                    <input type="number" value={Math.round(selectedLayer.x)} onChange={event => updateSceneLayer(selectedLayer.id, { x: Number(event.target.value) })} disabled={selectedLayer.locked} />
                  </div>
                  <div>
                    <label>Y</label>
                    <input type="number" value={Math.round(selectedLayer.y)} onChange={event => updateSceneLayer(selectedLayer.id, { y: Number(event.target.value) })} disabled={selectedLayer.locked} />
                  </div>
                </div>
                <label>Scale {selectedLayer.scale.toFixed(2)}</label>
                <input type="range" min="0.05" max="2.5" step="0.01" value={selectedLayer.scale} onChange={event => updateSceneLayer(selectedLayer.id, { scale: Number(event.target.value) })} disabled={selectedLayer.locked} />
                <label>Parallax {(selectedLayer.parallax ?? 1).toFixed(2)}</label>
                <input type="range" min="0" max="1.25" step="0.01" value={selectedLayer.parallax ?? 1} onChange={event => updateSceneLayer(selectedLayer.id, { parallax: Number(event.target.value) })} disabled={selectedLayer.locked} />
                <div className="control-hint">Use 1 for normal world objects. Use 0 for fixed HUD/UI layers.</div>
                {selectedLayer.type === "background" && (
                  <>
                    <div className="two-col">
                      <div>
                        <label>Source Width</label>
                        <input
                          type="number"
                          min="1"
                          value={Math.round(selectedLayer.width || scene.width)}
                          onChange={event => updateSceneLayer(selectedLayer.id, { width: Math.max(1, Number(event.target.value)) })}
                          disabled={selectedLayer.locked}
                        />
                      </div>
                      <div>
                        <label>Source Height</label>
                        <input
                          type="number"
                          min="1"
                          value={Math.round(selectedLayer.height || scene.height)}
                          onChange={event => updateSceneLayer(selectedLayer.id, { height: Math.max(1, Number(event.target.value)) })}
                          disabled={selectedLayer.locked}
                        />
                      </div>
                    </div>
                    <label>Background Fit</label>
                    <select
                      value={selectedLayer.fit || "stretch"}
                      onChange={event => updateSceneLayer(selectedLayer.id, { fit: event.target.value as SceneLayer["fit"] })}
                      disabled={selectedLayer.locked}
                    >
                      <option value="stretch">Stretch to layer box</option>
                      <option value="cover">Cover layer box</option>
                      <option value="contain">Contain layer box</option>
                      <option value="tile">Tile</option>
                    </select>
                    <label>Background Position</label>
                    <input
                      value={selectedLayer.position || "left center"}
                      onChange={event => updateSceneLayer(selectedLayer.id, { position: event.target.value })}
                      placeholder="left center / center center / 40% 50%"
                      disabled={selectedLayer.locked}
                    />
                    <button
                      type="button"
                      className="ghost-button full"
                      onClick={() => updateSceneLayer(selectedLayer.id, {
                        x: 0,
                        y: scene.height,
                        width: scene.width,
                        height: scene.height,
                        scale: 1,
                        fit: "stretch",
                        position: "left center",
                      })}
                      disabled={selectedLayer.locked}
                    >
                      Fill Scene World
                    </button>
                    <div className="control-hint">Select the background layer, then drag the box or pull any corner handle to frame it like other objects.</div>
                  </>
                )}
                {!selectedLayer.locked && <div className="control-hint">You can also drag the selected layer's corner handles on the canvas to resize proportionally.</div>}
                {isSceneVisualLayer(selectedLayer) && !selectedLayer.locked && (
                  <div className="interaction-controls">
                    <div className="section-title compact"><Eye size={15} /> Interaction Preset</div>
                    <div className="preset-grid">
                      {Object.entries(INTERACTION_PRESETS).map(([preset, config]) => (
                        <button
                          key={preset}
                          type="button"
                          className={selectedLayerInteraction?.preset === preset ? "active" : ""}
                          onClick={() => applyInteractionPreset(preset as InteractionPreset)}
                        >
                          {config.label}
                        </button>
                      ))}
                    </div>
                    {!selectedLayerInteraction ? (
                      <div className="control-hint">Choose a preset to turn this layer into an interactable object with its own editable trigger zone.</div>
                    ) : (
                      <>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={selectedLayerInteraction.enabled}
                            onChange={event => updateSelectedLayerInteraction({ enabled: event.target.checked })}
                          />
                          Enable interaction
                        </label>
                        <div className="two-col">
                          <div>
                            <label>Trigger Mode</label>
                            <select value={selectedLayerInteraction.triggerMode || "near-click"} onChange={event => updateSelectedLayerInteraction({ triggerMode: event.target.value as LayerInteractionSettings["triggerMode"] })}>
                              <option value="near-click">Near + Click Eye</option>
                              <option value="near-key">Near + Key</option>
                              <option value="inventory">Inventory State</option>
                              <option value="state">Scene State</option>
                            </select>
                          </div>
                          <div>
                            <label>Action Type</label>
                            <select value={selectedLayerInteraction.actionType || "subtitle"} onChange={event => updateSelectedLayerInteraction({ actionType: event.target.value as LayerInteractionSettings["actionType"] })}>
                              <option value="subtitle">Show Subtitle</option>
                              <option value="play-animation">Play Animation</option>
                              <option value="toggle-layer">Toggle Layer</option>
                              <option value="pickup-item">Pickup Item</option>
                              <option value="scene-link">Door / Scene Link</option>
                              <option value="set-state">Set State</option>
                            </select>
                          </div>
                        </div>
                        <div className="two-col">
                          <div>
                            <label>Prompt Key</label>
                            <input value={selectedLayerInteraction.promptKey} onChange={event => updateSelectedLayerInteraction({ promptKey: event.target.value })} placeholder="KeyE" />
                          </div>
                          <div>
                            <label>Prompt Style</label>
                            <select value={selectedLayerInteraction.promptStyle} onChange={event => updateSelectedLayerInteraction({ promptStyle: event.target.value as InteractionPromptStyle })}>
                              <option value="horror">Horror Eye</option>
                              <option value="minimal">Minimal</option>
                              <option value="caption">Caption</option>
                            </select>
                          </div>
                        </div>
                        <label>Prompt Text</label>
                        <input value={selectedLayerInteraction.promptText} onChange={event => updateSelectedLayerInteraction({ promptText: event.target.value })} />
                        <label>Subtitle Text</label>
                        <textarea rows={2} value={selectedLayerInteraction.subtitle || ""} onChange={event => updateSelectedLayerInteraction({ subtitle: event.target.value })} />
                        <label>Failed Condition Subtitle</label>
                        <textarea rows={2} value={selectedLayerInteraction.failSubtitle || ""} onChange={event => updateSelectedLayerInteraction({ failSubtitle: event.target.value })} />
                        <div className="two-col">
                          <div>
                            <label>Target Layer</label>
                            <select value={selectedLayerInteraction.targetLayerId || ""} onChange={event => updateSelectedLayerInteraction({ targetLayerId: event.target.value || undefined })}>
                              <option value="">This layer</option>
                              {scene.layers.filter(item => isSceneVisualLayer(item)).map(item => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label>Target Scene</label>
                            <select value={selectedLayerInteraction.targetSceneId || ""} onChange={event => updateSelectedLayerInteraction({ targetSceneId: event.target.value || undefined })}>
                              <option value="">None</option>
                              {scenes.map(item => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        {selectedLayerAsset?.animations?.length ? (
                          <>
                            <label>Target Animation</label>
                            <select value={selectedLayerInteraction.targetAnimationId || ""} onChange={event => updateSelectedLayerInteraction({ targetAnimationId: event.target.value || undefined })}>
                              <option value="">Default animation</option>
                              {selectedLayerAsset.animations.map(clip => (
                                <option key={clip.id} value={clip.id}>{clip.name}</option>
                              ))}
                            </select>
                          </>
                        ) : null}
                        <div className="two-col">
                          <div>
                            <label>Condition Key</label>
                            <input value={selectedLayerInteraction.conditionStateKey || ""} onChange={event => updateSelectedLayerInteraction({ conditionStateKey: event.target.value })} placeholder="has_key" />
                          </div>
                          <div>
                            <label>Condition Value</label>
                            <input value={selectedLayerInteraction.conditionStateValue || ""} onChange={event => updateSelectedLayerInteraction({ conditionStateValue: event.target.value })} placeholder="true" />
                          </div>
                        </div>
                        <div className="two-col">
                          <div>
                            <label>Item ID</label>
                            <input value={selectedLayerInteraction.itemId || ""} onChange={event => updateSelectedLayerInteraction({ itemId: event.target.value })} placeholder="old_key" />
                          </div>
                          <div>
                            <label>Set State</label>
                            <input value={selectedLayerInteraction.setStateKey || ""} onChange={event => updateSelectedLayerInteraction({ setStateKey: event.target.value })} placeholder="door_open" />
                          </div>
                        </div>
                        <label>Set State Value</label>
                        <input value={selectedLayerInteraction.setStateValue || ""} onChange={event => updateSelectedLayerInteraction({ setStateValue: event.target.value })} placeholder="true / false / text / number" />
                        <label className="checkbox-row">
                          <input type="checkbox" checked={selectedLayerInteraction.showText} onChange={event => updateSelectedLayerInteraction({ showText: event.target.checked })} />
                          Show prompt text beside the eye
                        </label>
                        <label className="checkbox-row">
                          <input type="checkbox" checked={selectedLayerInteraction.hotspotVisible !== false} onChange={event => updateSelectedLayerInteraction({ hotspotVisible: event.target.checked })} />
                          Show hotspot marker layer
                        </label>
                        <label className="checkbox-row">
                          <input type="checkbox" checked={selectedLayerInteraction.hideLayerOnPickup !== false} onChange={event => updateSelectedLayerInteraction({ hideLayerOnPickup: event.target.checked })} />
                          Hide this layer after pickup
                        </label>
                        <div className="two-col">
                          <div>
                            <label>Zone Width</label>
                            <input type="number" min="24" value={Math.round(selectedLayerInteraction.zoneWidth || layerWorldBounds(selectedLayer, selectedLayerAsset).width || 160)} onChange={event => updateSelectedLayerInteraction({ zoneWidth: Number(event.target.value) })} />
                          </div>
                          <div>
                            <label>Zone Height</label>
                            <input type="number" min="24" value={Math.round(selectedLayerInteraction.zoneHeight || layerWorldBounds(selectedLayer, selectedLayerAsset).height || 120)} onChange={event => updateSelectedLayerInteraction({ zoneHeight: Number(event.target.value) })} />
                          </div>
                        </div>
                        <div className="two-col">
                          <div>
                            <label>Zone X {selectedLayerInteraction.zoneOffsetX || 0}px</label>
                            <input type="range" min="-420" max="420" step="1" value={selectedLayerInteraction.zoneOffsetX || 0} onChange={event => updateSelectedLayerInteraction({ zoneOffsetX: Number(event.target.value) })} />
                          </div>
                          <div>
                            <label>Zone Y {selectedLayerInteraction.zoneOffsetY || 0}px</label>
                            <input type="range" min="-260" max="260" step="1" value={selectedLayerInteraction.zoneOffsetY || 0} onChange={event => updateSelectedLayerInteraction({ zoneOffsetY: Number(event.target.value) })} />
                          </div>
                        </div>
                        <label>Text Font Size {selectedLayerInteraction.fontSize}px</label>
                        <input type="range" min="8" max="24" step="1" value={selectedLayerInteraction.fontSize} onChange={event => updateSelectedLayerInteraction({ fontSize: Number(event.target.value) })} />
                        <label>Prompt Scale {selectedLayerInteraction.promptScale.toFixed(2)}</label>
                        <input type="range" min="0.45" max="1.45" step="0.01" value={selectedLayerInteraction.promptScale} onChange={event => updateSelectedLayerInteraction({ promptScale: Number(event.target.value) })} />
                        <label>Trigger Radius {selectedLayerInteraction.triggerRadius}px</label>
                        <input type="range" min="60" max="520" step="5" value={selectedLayerInteraction.triggerRadius} onChange={event => updateSelectedLayerInteraction({ triggerRadius: Number(event.target.value) })} />
                        <div className="two-col">
                          <div>
                            <label>Prompt X {selectedLayerInteraction.offsetX}px</label>
                            <input type="range" min="-220" max="220" step="1" value={selectedLayerInteraction.offsetX} onChange={event => updateSelectedLayerInteraction({ offsetX: Number(event.target.value) })} />
                          </div>
                          <div>
                            <label>Prompt Y {selectedLayerInteraction.offsetY}px</label>
                            <input type="range" min="-180" max="80" step="1" value={selectedLayerInteraction.offsetY} onChange={event => updateSelectedLayerInteraction({ offsetY: Number(event.target.value) })} />
                          </div>
                        </div>
                        <div className="state-preview">
                          {Object.entries(scene.state || {}).map(([key, value]) => (
                            <span key={key}>{key}: {String(value)}</span>
                          ))}
                        </div>
                        <div className="control-hint">Interaction zones are independent from the image. Use them for clickable radios, doors, boxes, and hidden investigation areas.</div>
                      </>
                    )}
                  </div>
                )}
                {isSceneVisualLayer(selectedLayer) && !selectedLayer.locked && (
                  <>
                    {selectedLayerAsset?.animations?.length ? (
                      <div className="clip-switcher">
                        <label>Animation Clip</label>
                        <div className="clip-buttons">
                          {selectedLayerAsset.animations.map(clip => (
                            <button
                              key={clip.id}
                              type="button"
                              className={clip.id === selectedLayerClip?.id ? "active" : ""}
                              onClick={() => setLayerAnimation(selectedLayer.id, clip)}
                            >
                              {clipButtonText(clip)}
                            </button>
                          ))}
                        </div>
                        <div className="control-hint">A/D switches between left and right walk. Release the key to return to idle breathing.</div>
                      </div>
                    ) : null}
                    <label>Character Brightness {selectedLayerLight.brightness.toFixed(2)}</label>
                    <input type="range" min="0.25" max="1.35" step="0.01" value={selectedLayerLight.brightness} onChange={event => updateSelectedLayerLighting({ brightness: Number(event.target.value), preset: "neon-station" })} />
                    <label>Character Contrast {selectedLayerLight.contrast.toFixed(2)}</label>
                    <input type="range" min="0.55" max="1.55" step="0.01" value={selectedLayerLight.contrast} onChange={event => updateSelectedLayerLighting({ contrast: Number(event.target.value), preset: "neon-station" })} />
                    <label>Character Saturation {selectedLayerLight.saturate.toFixed(2)}</label>
                    <input type="range" min="0.25" max="1.5" step="0.01" value={selectedLayerLight.saturate} onChange={event => updateSelectedLayerLighting({ saturate: Number(event.target.value), preset: "neon-station" })} />
                    <label>Red Edge Light {Math.round(selectedLayerLight.edgeLightOpacity * 100)}%</label>
                    <input type="range" min="0" max="0.75" step="0.01" value={selectedLayerLight.edgeLightOpacity} onChange={event => updateSelectedLayerLighting({ edgeLightOpacity: Number(event.target.value), preset: "neon-station" })} />
                    <label>Purple Rim Light {Math.round(selectedLayerLight.rimLightOpacity * 100)}%</label>
                    <input type="range" min="0" max="0.75" step="0.01" value={selectedLayerLight.rimLightOpacity} onChange={event => updateSelectedLayerLighting({ rimLightOpacity: Number(event.target.value), preset: "neon-station" })} />
                    <label>Contact Shadow {Math.round(selectedLayerShadow.opacity * 100)}%</label>
                    <input type="range" min="0" max="1" step="0.01" value={selectedLayerShadow.opacity} onChange={event => updateSelectedLayerShadow({ opacity: Number(event.target.value), enabled: Number(event.target.value) > 0 })} />
                    <label>Lighting Preset</label>
                    <div className="lighting-buttons">
                      <button type="button" onClick={applyNeonLightingToSelectedLayer}>Neon Station</button>
                      <button type="button" onClick={clearLightingFromSelectedLayer}>Disable Lighting</button>
                    </div>
                    <div className="control-hint">Neon Station adds a soft contact shadow, darker ambient tint, and red/purple edge lighting.</div>
                  </>
                )}
                {!selectedLayer.locked && <div className="control-hint">You can also drag the selected layer's blue corner handle on the canvas to resize proportionally.</div>}
                <label>Opacity {Math.round(selectedLayer.opacity * 100)}%</label>
                <input type="range" min="0.1" max="1" step="0.01" value={selectedLayer.opacity} onChange={event => updateSceneLayer(selectedLayer.id, { opacity: Number(event.target.value) })} />
                <label>Layer z-index</label>
                <input type="number" value={selectedLayer.zIndex} onChange={event => updateSceneLayer(selectedLayer.id, { zIndex: Number(event.target.value) })} disabled={selectedLayer.locked} />
                <button className="ghost-button full" onClick={() => updateSceneLayer(selectedLayer.id, { visible: !selectedLayer.visible })}>{selectedLayer.visible ? <EyeOff size={16} /> : <Eye size={16} />} {selectedLayer.visible ? "Hide" : "Show"}</button>
              </div>
            )}
          </section>

          <section>
            <div className="section-title"><CheckCircle2 size={17} /> Confirmed Assets</div>
            <div className="sprite-list">
              {assets.map(asset => {
                const previewSprite = resolveAssetSprite(asset) || asset.sprite;
                return (
                  <div key={asset.id} className="sprite-card asset-card">
                    <button className="mini-preview" style={checkerStyle} onClick={() => setActiveSprite(previewSprite)}>
                      <div dangerouslySetInnerHTML={{ __html: spriteFrame(previewSprite, activeFrame) }} />
                    </button>
                    <div>
                      <strong>{asset.name}</strong>
                      <span>{roleLabels[asset.role]} / {asset.animations?.length || 1} clips / {triggerLabels[asset.binding.triggerType]} {asset.binding.triggerValue}</span>
                      <div className="asset-actions">
                        <button onClick={() => insertAssetLayer(asset)}><Plus size={13} /> Insert</button>
                        <button onClick={() => setActiveSprite(previewSprite)}><Play size={13} /> Preview</button>
                        <button onClick={() => deleteAsset(asset.id)}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!assets.length && <div className="empty-state">No confirmed assets yet.</div>}
            </div>
          </section>

          <section>
            <div className="section-title"><Keyboard size={17} /> Available Sprites</div>
            <div className="sprite-list compact">
              {sprites.map(sprite => (
                <button key={sprite.id} className={sprite.id === activeSprite.id ? "sprite-card active" : "sprite-card"} onClick={() => setActiveSprite(sprite)}>
                  <div className="mini-preview" style={checkerStyle}><div dangerouslySetInnerHTML={{ __html: spriteFrame(sprite, 0) }} /></div>
                  <div><strong>{sprite.characterName}</strong><span>{sprite.frames.length} frames</span></div>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </main>
      {sceneContextMenu && (() => {
        const menuLayer = scene.layers.find(layer => layer.id === sceneContextMenu.layerId);
        const isZoneMenu = sceneContextMenu.target === "interaction-zone";
        const isEditableLayerMenu = Boolean(menuLayer && !isZoneMenu && isTransformableSceneLayer(menuLayer));
        const isBackgroundMenu = Boolean(menuLayer && !isZoneMenu && menuLayer.type === "background");
        const currentBackgroundLayer = scene.layers.find(layer => layer.type === "background");
        const pasteNeedsUnlockedBackground = sceneClipboard?.layer.type === "background" && currentBackgroundLayer?.locked;
        const copyDisabled = !isEditableLayerMenu;
        const cutDisabled = !isEditableLayerMenu || Boolean(menuLayer?.locked) || menuLayer?.type === "background";
        const pasteDisabled = !sceneClipboard || Boolean(pasteNeedsUnlockedBackground);
        const duplicateDisabled = !isEditableLayerMenu || Boolean(menuLayer?.locked) || menuLayer?.type === "background";
        const deleteDisabled = !menuLayer || (Boolean(menuLayer.locked) && !isBackgroundMenu);
        const contextHint = (() => {
          if (isZoneMenu) return "Select the owner item for copy, cut, paste, and duplicate.";
          if (!menuLayer) return "No scene object selected.";
          if (!isTransformableSceneLayer(menuLayer)) return "This layer cannot be copied or duplicated.";
          if (menuLayer.type === "background") return "Delete clears the image and keeps the default black scene background.";
          if (menuLayer.locked) return "Unlock before cutting, duplicating, or deleting.";
          if (!sceneClipboard) return "Copy or cut an item before pasting.";
          return "";
        })();
        return (
          <div
            className="scene-context-menu"
            style={{ left: sceneContextMenu.x, top: sceneContextMenu.y }}
            role="menu"
            onPointerDown={event => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onContextMenu={event => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <div className="scene-context-menu-title">
              {isZoneMenu ? "Interaction Zone" : menuLayer?.name || "Scene Object"}
            </div>
            <button
              type="button"
              role="menuitem"
              disabled={copyDisabled}
              onClick={() => menuLayer && copyLayerToSceneClipboard(menuLayer.id)}
            >
              <Copy size={14} /> Copy <kbd>Ctrl C</kbd>
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={cutDisabled}
              onClick={() => menuLayer && cutLayerToSceneClipboard(menuLayer.id)}
            >
              <Scissors size={14} /> Cut <kbd>Ctrl X</kbd>
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={pasteDisabled}
              onClick={pasteLayerFromSceneClipboard}
            >
              <Clipboard size={14} /> Paste <kbd>Ctrl V</kbd>
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={duplicateDisabled}
              onClick={() => menuLayer && duplicateSceneLayer(menuLayer.id)}
            >
              <Copy size={14} /> Duplicate <kbd>Ctrl D</kbd>
            </button>
            <div className="scene-context-menu-separator" />
            <button
              type="button"
              role="menuitem"
              disabled={deleteDisabled}
              onClick={() => deleteSceneObject(sceneContextMenu.layerId, sceneContextMenu.target)}
            >
              <Trash2 size={14} /> {isZoneMenu ? "Delete Interaction Zone" : "Delete"}
            </button>
            {contextHint && (
              <span>{contextHint}</span>
            )}
          </div>
        );
      })()}
    </div>
  );
}
