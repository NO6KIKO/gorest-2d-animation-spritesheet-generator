import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type PointerEvent } from "react";
import {
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  Film,
  Keyboard,
  Layers,
  Map as MapIcon,
  MousePointer2,
  Pause,
  Play,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { PRESET_SPRITES } from "./presets";
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

type WorkspaceTab = "scenes" | "preview" | "scene" | "frames" | "sheet" | "blueprint";
type BackgroundMode = "checker" | "dark" | "light" | "green";
type ResizeHandle = "nw" | "ne" | "sw" | "se";
type ResizeState = {
  id: string;
  handle: ResizeHandle;
  anchorScreenX: number;
  anchorScreenY: number;
  assetWidth: number;
  assetHeight: number;
};
type HeldDirection = "left" | "right" | null;
type VehiclePhase = "approaching" | "ready" | "boarded";

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

const VIEWPORT_PRESETS = [
  { id: "desktop", label: "Desktop", width: 1280, height: 720 },
  { id: "ipad", label: "iPad", width: 1024, height: 768 },
  { id: "iphone", label: "iPhone", width: 390, height: 844 },
  { id: "wide", label: "Wide", width: 1440, height: 720 },
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
        locked: true,
        x: 0,
        y: 0,
        scale: 1,
        zIndex: 0,
        opacity: 1,
        parallax: 1,
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

function getFrameSize(sprite: AnimationSprite): [number, number] {
  const [frameW, frameH] = sprite.frameSize || [];
  if (Number.isFinite(frameW) && Number.isFinite(frameH) && frameW > 0 && frameH > 0) {
    return [frameW, frameH];
  }
  const cell = sprite.cellSize || 256;
  return [cell, cell];
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

function spriteFrame(sprite: AnimationSprite, frameIndex: number) {
  const frames = sprite.frames || [];
  return frames[frameIndex % Math.max(1, frames.length)] || frames[0] || "";
}

function buildSpritesheetFrames(
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

export default function App() {
  const [sprites, setSprites] = useState<AnimationSprite[]>(PRESET_SPRITES);
  const [activeSprite, setActiveSprite] = useState<AnimationSprite>(PRESET_SPRITES[0]);
  const [assets, setAssets] = useState<GameAsset[]>([]);
  const [scenes, setScenes] = useState<GameScene[]>([]);
  const [scene, setScene] = useState<GameScene>(() => removeBuiltInSceneKitLayers(createDefaultScene()));
  const [selectedLayerId, setSelectedLayerId] = useState<string>("layer_ground");
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
  const [interactionToast, setInteractionToast] = useState("");
  const [isBackpackOpen, setIsBackpackOpen] = useState(false);
  const [vehiclePhase, setVehiclePhase] = useState<VehiclePhase>("approaching");
  const [notice, setNotice] = useState("Confirmed spritesheets can be saved as game action assets.");
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const zoneDragRef = useRef<{ id: string; startPointerX: number; startPointerY: number; startOffsetX: number; startOffsetY: number } | null>(null);
  const zoneResizeRef = useRef<{ id: string; handle: ResizeHandle; anchorWorldX: number; anchorWorldY: number } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sceneStateRef = useRef<GameScene>(scene);
  const nearbyInteractionRef = useRef<any>(null);
  const triggerNearbyInteractionRef = useRef<(entry?: any) => void>(() => {});
  const [stageSize, setStageSize] = useState({ width: 1280, height: 720 });

  const frames = activeSprite.frames || [];
  const activeSpriteFrameIndex = frames.length ? activeFrame % frames.length : 0;
  const currentFrame = spriteFrame(activeSprite, activeFrame);
  const [frameW, frameH] = getFrameSize(activeSprite);
  const frameRatio = `${frameW} / ${frameH}`;
  const isTallFrame = frameH > frameW * 1.25;
  const selectedLayer = scene.layers.find(layer => layer.id === selectedLayerId);
  const backgroundLayer = scene.layers.find(layer => layer.type === "background");
  const groundLayer = scene.layers.find(layer => layer.type === "ground");
  const sceneLight = sceneLighting(scene);
  const selectedLayerLight = selectedLayer?.lighting || NEON_LAYER_LIGHTING;
  const selectedLayerShadow = selectedLayer?.shadow || NEON_CONTACT_SHADOW;
  const viewportWidth = sceneViewportWidth(scene);
  const viewportHeight = sceneViewportHeight(scene);
  const cameraMax = Math.max(0, scene.width - viewportWidth);
  const stageScaleX = stageSize.width / Math.max(1, viewportWidth);
  const stageScaleY = stageSize.height / Math.max(1, viewportHeight);
  const spriteStageScale = Math.min(stageScaleX, stageScaleY);

  const allAssets = useMemo(() => {
    return [...SCENE_KIT_ASSETS, ...assets];
  }, [assets]);

  const assetById = useMemo(() => {
    return new Map(allAssets.map(asset => [asset.id, asset]));
  }, [allAssets]);

  const selectedLayerAsset = selectedLayer?.assetId ? assetById.get(selectedLayer.assetId) : undefined;
  const selectedLayerClip = resolveAssetClip(selectedLayerAsset, selectedLayer);
  const selectedLayerInteraction = selectedLayer ? layerInteractionSettings(selectedLayer, selectedLayerAsset) : null;
  const currentSceneIsSaved = scenes.some(savedScene => savedScene.id === scene.id);
  const savedSceneCards = scenes.filter(savedScene => savedScene.id !== scene.id);
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
    nearbyInteractionRef.current = nearbyInteraction;
  }, [nearbyInteraction]);

  useEffect(() => {
    const hasBuiltInSceneKitLayer = scene.layers.some(layer => layer.assetId && BUILT_IN_SCENE_KIT_ASSET_IDS.has(layer.assetId));
    if (!hasBuiltInSceneKitLayer) return;
    setScene(prev => removeBuiltInSceneKitLayers(prev));
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
      fetch("/api/spritesheet/latest").then(res => res.json()).catch(() => ({ sprite: null })),
      fetch("/api/game-library").then(res => res.json()).catch(() => ({ assets: [], scenes: [] })),
    ]).then(([latestData, libraryData]: [{ sprite: AnimationSprite | null }, GameLibrary]) => {
      if (cancelled) return;
      if (latestData.sprite && Array.isArray(latestData.sprite.frames)) {
        setSprites(prev => [latestData.sprite!, ...prev.filter(sprite => sprite.id !== latestData.sprite!.id)]);
        setActiveSprite(latestData.sprite);
      }
      if (Array.isArray(libraryData.assets)) setAssets(libraryData.assets);
      if (Array.isArray(libraryData.scenes) && libraryData.scenes.length) {
        const firstScene = libraryData.scenes[0];
        setScenes(libraryData.scenes.map(removeBuiltInSceneKitLayers));
        setScene(removeBuiltInSceneKitLayers(firstScene));
        setSelectedLayerId("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const updateSize = () => {
      setStageSize({ width: element.clientWidth || viewportWidth, height: element.clientHeight || viewportHeight });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    window.addEventListener("resize", updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [viewportWidth, viewportHeight, tab]);

  useEffect(() => {
    const playbackFrameCount = Math.max(1, sceneFrameCount);
    if ((!isPlaying && !sceneHasAutoPlayingLayer) || playbackFrameCount <= 1) return;
    const id = window.setInterval(() => {
      setActiveFrame(prev => (prev + 1) % playbackFrameCount);
    }, 1000 / Math.max(1, fps));
    return () => window.clearInterval(id);
  }, [isPlaying, sceneHasAutoPlayingLayer, sceneFrameCount, fps, activeSprite.id]);

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

  const updateSelectedLayerInteraction = (patch: Partial<LayerInteractionSettings>) => {
    if (!selectedLayer || selectedLayer.locked || !isSceneVisualLayer(selectedLayer)) return;
    const base = layerInteractionSettings(selectedLayer, selectedLayerAsset) || DEFAULT_INTERACTION_SETTINGS;
    updateSceneLayer(selectedLayer.id, {
      interaction: { ...base, ...selectedLayer.interaction, ...patch },
    });
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
      const nextViewportWidth = Math.min(patch.viewportWidth || prev.viewportWidth || VIEWPORT_WIDTH, prev.width);
      const nextViewportHeight = patch.viewportHeight || prev.viewportHeight || prev.height;
      return {
        ...prev,
        ...patch,
        viewportWidth: nextViewportWidth,
        viewportHeight: nextViewportHeight,
        cameraX: clamp(prev.cameraX, 0, Math.max(0, prev.width - nextViewportWidth)),
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
    setTab("scene");
    setNotice(`Inserted layer: ${asset.name}`);
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

  const duplicateSelectedLayer = () => {
    if (!selectedLayer) return;
    const copy = {
      ...selectedLayer,
      id: `layer_copy_${Date.now()}`,
      name: `${selectedLayer.name} copy`,
      x: selectedLayer.x + 36,
      y: selectedLayer.y,
      zIndex: selectedLayer.zIndex + 1,
    };
    setScene(prev => ({ ...prev, layers: [...prev.layers, copy] }));
    setSelectedLayerId(copy.id);
  };

  const removeSelectedLayer = () => {
    if (!selectedLayer || selectedLayer.locked) return;
    setScene(prev => ({ ...prev, layers: prev.layers.filter(layer => layer.id !== selectedLayer.id) }));
    setSelectedLayerId("");
  };

  const persistScene = async (sceneToSave: GameScene, successMessage: string) => {
    setError(null);
    try {
      const nextScene = {
        ...removeBuiltInSceneKitLayers(sceneToSave),
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
      setScenes(data.library.scenes.map(removeBuiltInSceneKitLayers));
      setScene(removeBuiltInSceneKitLayers(data.scene));
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
      ...removeBuiltInSceneKitLayers(scene),
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
        ? data.library.scenes.map(removeBuiltInSceneKitLayers)
        : [];
      setScenes(nextScenes);
      if (scene.id === sceneId) {
        const fallbackScene = nextScenes[0] || removeBuiltInSceneKitLayers(createDefaultScene());
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

  const startNewScene = () => {
    const now = new Date();
    const base = removeBuiltInSceneKitLayers(createDefaultScene());
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
    const cleanScene = removeBuiltInSceneKitLayers(savedScene);
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
    setIsPlaying(false);
  };

  const stagePointerDown = (event: PointerEvent<HTMLDivElement>, layer: SceneLayer) => {
    if (layer.locked) return;
    event.stopPropagation();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pointerX = (event.clientX - rect.left) / stageScaleX + scene.cameraX;
    const pointerY = (event.clientY - rect.top) / stageScaleY;
    dragRef.current = { id: layer.id, dx: pointerX - layer.x, dy: pointerY - layer.y };
    resizeRef.current = null;
    setSelectedLayerId(layer.id);
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
    const left = (layer.x - scene.cameraX) * stageScaleX;
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
      const x = resize.handle === "nw" || resize.handle === "sw"
        ? (resize.anchorScreenX - scaledWidth) / stageScaleX + scene.cameraX
        : resize.anchorScreenX / stageScaleX + scene.cameraX;
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
    updateSceneLayer(drag.id, {
      x: Math.round((event.clientX - rect.left) / stageScaleX + scene.cameraX - drag.dx),
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

  return (
    <div className="blueprint-app">
      <header className="topbar">
        <div>
          <p className="eyebrow">2D Side-Scroller Asset Studio</p>
          <h1>Spritesheet Game Asset Pipeline</h1>
        </div>
        <div className="top-actions">
          <button onClick={() => setTab("scenes")} className="ghost-button"><MapIcon size={16} /> Scenes</button>
          <button onClick={() => setIsPlaying(!isPlaying)} className="ghost-button">
            {isPlaying ? <Pause size={16} /> : <Play size={16} />} {isPlaying ? "Pause" : "Play"}
          </button>
          <button onClick={saveAsset} className="ghost-button"><CheckCircle2 size={16} /> Confirm Asset</button>
          <button onClick={saveScene} className="ghost-button"><Save size={16} /> Save Scene</button>
          <button onClick={saveCompletedScene} className="ghost-button"><CheckCircle2 size={16} /> Save Complete</button>
          <button onClick={startNewScene} className="ghost-button"><Plus size={16} /> New Scene</button>
          <button onClick={downloadSheet} className="primary-button"><Download size={16} /> Download Sheet</button>
        </div>
      </header>

      <main className="game-workspace">
        <aside className="panel left-panel">
          <section>
            <div className="section-title"><Film size={17} /> Current Action</div>
            <div className="asset-preview-card">
              <div className="mini-preview large" style={checkerStyle}>
                <div dangerouslySetInnerHTML={{ __html: spriteFrame(activeSprite, activeFrame) }} />
              </div>
              <strong>{activeSprite.characterName}</strong>
              <span>{activeSprite.frames.length} frames · {frameW} x {frameH}</span>
            </div>

            <label>Action Name</label>
            <input value={binding.actionName} onChange={event => setBinding(prev => ({ ...prev, actionName: event.target.value }))} />

            <div className="two-col">
              <div>
                <label>Asset Role</label>
                <select value={role} onChange={event => setRole(event.target.value as AssetRole)}>
                  {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div>
                <label>Trigger Type</label>
                <select value={binding.triggerType} onChange={event => setBinding(prev => ({ ...prev, triggerType: event.target.value as ActionTriggerType }))}>
                  {Object.entries(triggerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>

            <label>Trigger Value</label>
            <input value={binding.triggerValue} onChange={event => setBinding(prev => ({ ...prev, triggerValue: event.target.value }))} placeholder="Example: KeyD / click / player.walk" />

            <label>Game State</label>
            <input value={binding.gameState} onChange={event => setBinding(prev => ({ ...prev, gameState: event.target.value }))} />

            <label>Tags</label>
            <input value={tagsText} onChange={event => setTagsText(event.target.value)} />

            <button className="primary-button full" onClick={saveAsset}><CheckCircle2 size={16} /> Save as Confirmed Asset</button>
            <button className="ghost-button full" onClick={insertActiveSprite}><Plus size={16} /> Insert Current Action into Scene</button>
          </section>

          <section>
            <div className="section-title"><Upload size={17} /> Import Spritesheet Animation</div>
            <div className="binding-hint">
              Add any complete spritesheet as a scene animation. Use Auto + Loop for ambient effects, or save mouse, keyboard, and state trigger metadata for later gameplay wiring.
            </div>

            <label>Spritesheet Image</label>
            <input type="file" accept="image/png,image/webp,image/jpeg" onChange={handleImportFile} />
            {importSheetSize && (
              <div className="import-summary">
                {importFileName || "Uploaded image"} · {importSheetSize[0]} x {importSheetSize[1]}px
              </div>
            )}

            <label>Asset Name</label>
            <input value={importAssetName} onChange={event => setImportAssetName(event.target.value)} />

            <label>Action / Clip Name</label>
            <input
              value={importActionName}
              onChange={event => {
                const nextActionName = event.target.value;
                setImportActionName(nextActionName);
                setImportGameState(prev =>
                  prev === defaultGameStateForTrigger(importTriggerType, importActionName)
                    ? defaultGameStateForTrigger(importTriggerType, nextActionName)
                    : prev
                );
              }}
              placeholder="Example: steam_loop / door_open"
            />

            <div className="two-col">
              <div>
                <label>Frame Count</label>
                <input type="number" min="1" value={importFrameCount} onChange={event => setImportFrameCount(Math.max(1, Number(event.target.value)))} />
              </div>
              <div>
                <label>Columns</label>
                <input type="number" min="1" value={importColumns} onChange={event => setImportColumns(Math.max(1, Number(event.target.value)))} />
              </div>
            </div>

            <div className="two-col">
              <div>
                <label>Frame Width</label>
                <input type="number" min="1" value={importFrameWidth} onChange={event => setImportFrameWidth(Math.max(1, Number(event.target.value)))} />
              </div>
              <div>
                <label>Frame Height</label>
                <input type="number" min="1" value={importFrameHeight} onChange={event => setImportFrameHeight(Math.max(1, Number(event.target.value)))} />
              </div>
            </div>
            <button className="ghost-button full" type="button" onClick={() => inferImportedFrameSize()}>Infer Frame Size from Sheet</button>

            <div className="two-col">
              <div>
                <label>Asset Role</label>
                <select value={importRole} onChange={event => setImportRole(event.target.value as AssetRole)}>
                  {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div>
                <label>Trigger Type</label>
                <select value={importTriggerType} onChange={event => updateImportTriggerType(event.target.value as ActionTriggerType)}>
                  {Object.entries(triggerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>

            <label>Trigger Value</label>
            <input value={importTriggerValue} onChange={event => setImportTriggerValue(event.target.value)} placeholder="auto / click / KeyF / state key" />

            <label>Game State</label>
            <input value={importGameState} onChange={event => setImportGameState(event.target.value)} />

            <label>Tags</label>
            <input value={importTagsText} onChange={event => setImportTagsText(event.target.value)} />

            <label className="checkbox-line">
              <input type="checkbox" checked={importLoop} onChange={event => setImportLoop(event.target.checked)} />
              Loop this animation
            </label>

            <div className="button-row">
              <button className="ghost-button" type="button" onClick={() => saveImportedSpritesheet(false)}><CheckCircle2 size={16} /> Save</button>
              <button className="primary-button" type="button" onClick={() => saveImportedSpritesheet(true)}><Plus size={16} /> Save & Insert</button>
            </div>
          </section>

          <section>
            <div className="section-title"><MousePointer2 size={17} /> Trigger Test</div>
            <div className="binding-hint">
              Clicking the scene runs the first mouse-bound action. Keyboard triggers match saved asset `triggerValue` fields, such as `KeyD`.
            </div>
            <button className="ghost-button full" onClick={triggerMouseAction}><MousePointer2 size={16} /> Simulate Mouse Trigger</button>
          </section>

          {notice && <div className="notice">{notice}</div>}
          {error && <div className="error">{error}</div>}
        </aside>

        <section className="canvas-stage">
          <div className="blueprint-grid">
            <div className="stage-header">
              <div>
                <p className="eyebrow">Scene Composer</p>
                <h2>{tab === "scenes" ? "Scene Library" : scene.name}</h2>
              </div>
              <div className="tabs">
                <button className={tab === "scenes" ? "active" : ""} onClick={() => setTab("scenes")}><MapIcon size={15} /> Scenes</button>
                <button className={tab === "scene" ? "active" : ""} onClick={() => setTab("scene")}><MapIcon size={15} /> Scene</button>
                <button className={tab === "preview" ? "active" : ""} onClick={() => setTab("preview")}><Play size={15} /> Action</button>
                <button className={tab === "frames" ? "active" : ""} onClick={() => setTab("frames")}>Frames</button>
                <button className={tab === "sheet" ? "active" : ""} onClick={async () => { setTab("sheet"); if (!activeSprite.spritesheetPng && !sheetDataUrl) await compileSheet(); }}>Sheet</button>
                <button className={tab === "blueprint" ? "active" : ""} onClick={() => setTab("blueprint")}>Blueprint</button>
              </div>
            </div>

            {tab === "scenes" && (
              <div className="scene-library">
                <div className="scene-library-header">
                  <div>
                    <p className="eyebrow">Scene Library</p>
                    <h3>Saved Scenes</h3>
                  </div>
                  <div className="scene-library-actions">
                    <button type="button" className="primary-button" onClick={saveCompletedScene}><CheckCircle2 size={16} /> Save Current Complete</button>
                    <button type="button" className="ghost-button" onClick={startNewScene}><Plus size={16} /> New Scene</button>
                  </div>
                </div>

                <div className="scene-card-grid">
                  <article className="scene-card active">
                    <button type="button" className="scene-card-preview" onClick={() => setTab("scene")}>
                      <div
                        className="scene-card-bg"
                        style={{
                          backgroundImage: backgroundLayer?.imageUrl ? `url(${backgroundLayer.imageUrl})` : undefined,
                          backgroundColor: backgroundLayer?.color || "#08070d",
                        }}
                      />
                      <span>Editing</span>
                    </button>
                    <div className="scene-card-body">
                      <strong>{scene.name}</strong>
                      <small>{scene.layers.length} layers / current draft</small>
                      <div className="scene-card-actions">
                        <button type="button" onClick={() => setTab("scene")}>Edit Scene</button>
                        <button type="button" onClick={saveCompletedScene}>Save Complete</button>
                        {currentSceneIsSaved && (
                          <button type="button" className="danger-button" onClick={() => deleteScene(scene.id)}>Delete</button>
                        )}
                      </div>
                    </div>
                  </article>

                  {savedSceneCards.map(savedScene => {
                    const savedBackground = savedScene.layers?.find(layer => layer.type === "background");
                    const isOpen = savedScene.id === scene.id;
                    return (
                      <article key={savedScene.id} className={isOpen ? "scene-card active" : "scene-card"}>
                        <button type="button" className="scene-card-preview" onClick={() => loadSavedScene(savedScene)}>
                          <div
                            className="scene-card-bg"
                            style={{
                              backgroundImage: savedBackground?.imageUrl ? `url(${savedBackground.imageUrl})` : undefined,
                              backgroundColor: savedBackground?.color || "#08070d",
                            }}
                          />
                          <span>{isOpen ? "Open" : "Saved"}</span>
                        </button>
                        <div className="scene-card-body">
                          <strong>{savedScene.name}</strong>
                          <small>{savedScene.layers?.length || 0} layers / {savedScene.updatedTime ? sceneTimestampLabel(new Date(savedScene.updatedTime)) : "unsaved"}</small>
                          <div className="scene-card-actions">
                            <button type="button" onClick={() => loadSavedScene(savedScene)}>Edit Scene</button>
                            <button type="button" onClick={() => downloadJson(savedScene, `scene_${safeName(savedScene.name)}.json`)}>Export</button>
                            <button type="button" className="danger-button" onClick={() => deleteScene(savedScene.id)}>Delete</button>
                          </div>
                        </div>
                      </article>
                    );
                  })}

                  {!savedSceneCards.length && (
                    <div className="scene-library-empty">
                      <strong>No saved scenes yet.</strong>
                      <span>Use Save Current Complete to store this scene, then create another one.</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === "scene" && (
              <div className="scene-editor">
                <div
                  ref={stageRef}
                  className="side-scroller-stage"
                  style={{ aspectRatio: `${viewportWidth} / ${viewportHeight}` }}
                  onClick={event => {
                    const target = event.target as HTMLElement;
                    if (!target.closest(".scene-sprite")) clearSceneSelection();
                  }}
                  onPointerMove={stagePointerMove}
                  onPointerUp={() => { dragRef.current = null; resizeRef.current = null; zoneDragRef.current = null; zoneResizeRef.current = null; }}
                  onPointerLeave={() => { dragRef.current = null; resizeRef.current = null; zoneDragRef.current = null; zoneResizeRef.current = null; }}
                >
                  {backgroundLayer?.visible && backgroundLayer.imageUrl && (
                    <div
                      className="scene-image-background"
                      style={{
                        backgroundImage: `url("${backgroundLayer.imageUrl}")`,
                        backgroundSize: backgroundSizeForFit(backgroundLayer.fit),
                        backgroundRepeat: backgroundLayer.fit === "tile" ? "repeat" : "no-repeat",
                        backgroundPosition: backgroundLayer.position || "center center",
                        opacity: backgroundLayer.opacity,
                        zIndex: backgroundLayer.zIndex,
                        filter: sceneFilter(scene),
                        left: -scene.cameraX * (backgroundLayer.parallax || 1) * stageScaleX,
                        right: "auto",
                        width: scene.width * stageScaleX,
                        height: "100%",
                      }}
                    />
                  )}
                  {backgroundLayer?.visible && !backgroundLayer.imageUrl && (
                    <>
                      <div className="sky-band" style={{ background: backgroundLayer.color || undefined, opacity: backgroundLayer.opacity }} />
                      <div className="mountain-band back" />
                      <div className="mountain-band front" />
                    </>
                  )}
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
                            onPointerDown={event => stagePointerDown(event, layer)}
                            onClick={event => {
                              event.stopPropagation();
                              setSelectedLayerId(layer.id);
                              if (asset.id === "asset_scene_backpack_ui") {
                                setIsBackpackOpen(value => !value);
                                setNotice("Backpack inventory toggled.");
                              }
                              if (mouseClip) updateSceneLayer(layer.id, { activeAnimationId: mouseClip.id });
                              setActiveSprite(mouseClip?.sprite || layerSprite);
                              setActiveFrame(0);
                              setIsPlaying(true);
                              if (mouseClip) setNotice(`Mouse triggered action: ${mouseClip.name}`);
                            }}
                          >
                            <div
                              className="sprite-art"
                              style={{ filter: sceneLayerRenderFilter(scene, layer, asset) }}
                              dangerouslySetInnerHTML={{ __html: frame }}
                            />
                          {layer.id === selectedLayerId && (
                            <>
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
                          {layer.id === selectedLayerId && zone && interaction?.enabled && (
                            <div
                              className="interaction-zone-outline"
                              style={{
                                left: (zone.left - scene.cameraX * (layer.parallax ?? 1)) * stageScaleX,
                                top: zone.top * stageScaleY,
                                width: zone.width * stageScaleX,
                                height: zone.height * stageScaleY,
                                zIndex: layer.zIndex + 5,
                              }}
                              onPointerDown={event => startInteractionZoneDrag(event, layer, interaction)}
                              onClick={event => event.stopPropagation()}
                            >
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
                    <div className="sheet-info">{activeSprite.sheetSize?.join(" x ") || `${frameW * sheetColumns} x ${frameH * Math.ceil(activeSprite.frames.length / sheetColumns)}`} · frame {frameW} x {frameH}px · {activeSprite.frames.length} frames</div>
                    <img src={sheetDataUrl} alt="spritesheet" />
                  </>
                ) : <button onClick={compileSheet}>Generate Sheet Preview</button>}
              </div>
            )}

            {tab === "blueprint" && (
              <div className="source-panel">
                <div><strong>Asset Library:</strong> {assets.length} confirmed assets, {scenes.length} saved scenes.</div>
                <div><strong>Current Action:</strong> {activeSprite.characterName} · {activeSprite.frames.length} frames · {frameW} x {frameH}</div>
                <div><strong>Action Binding:</strong> {triggerLabels[binding.triggerType]} / {binding.triggerValue} / {binding.gameState}</div>
                <div><strong>Layer Rules:</strong> Background, ground, character, effects, and foreground are separated into layers; character and effect layers can be dragged, resized, sorted, and hidden.</div>
                <div><strong>Save Path:</strong> D:\2d-animation-spritesheet-generator\public\generated\game_asset_library.json</div>
                <button className="ghost-button" onClick={() => downloadJson({ assets, scenes: [scene] }, "game_asset_library_export.json")}><Download size={16} /> Export Full Library JSON</button>
              </div>
            )}
          </div>
        </section>

        <aside className="panel right-panel">
          <section>
            <div className="section-title"><Film size={17} /> Motion Speed</div>
            <div className="layer-controls">
              <label>Animation FPS {fps}</label>
              <input type="range" min="4" max="24" step="1" value={fps} onChange={event => setFps(Number(event.target.value))} />
              <label>Walk Speed {walkSpeed} px/s</label>
              <input type="range" min="40" max="240" step="5" value={walkSpeed} onChange={event => setWalkSpeed(Number(event.target.value))} />
              <div className="control-hint">FPS controls spritesheet playback. Walk speed only controls A/D movement through the long scene.</div>
            </div>
          </section>

          <section>
            <div className="section-title"><Eye size={17} /> Global Scene Lighting</div>
            <div className="layer-controls">
              <label>Global Brightness {sceneLight.brightness.toFixed(2)}</label>
              <input type="range" min="0.45" max="1.35" step="0.01" value={sceneLight.brightness} onChange={event => updateSceneLighting({ brightness: Number(event.target.value) })} />
              <label>Global Contrast {sceneLight.contrast.toFixed(2)}</label>
              <input type="range" min="0.65" max="1.45" step="0.01" value={sceneLight.contrast} onChange={event => updateSceneLighting({ contrast: Number(event.target.value) })} />
              <label>Global Saturation {sceneLight.saturate.toFixed(2)}</label>
              <input type="range" min="0.35" max="1.5" step="0.01" value={sceneLight.saturate} onChange={event => updateSceneLighting({ saturate: Number(event.target.value) })} />
              <label>Magenta Ambience {Math.round(sceneLight.ambience * 100)}%</label>
              <input type="range" min="0" max="1" step="0.01" value={sceneLight.ambience} onChange={event => updateSceneLighting({ ambience: Number(event.target.value) })} />
              <label>Vignette {Math.round(sceneLight.vignette * 100)}%</label>
              <input type="range" min="0" max="0.75" step="0.01" value={sceneLight.vignette} onChange={event => updateSceneLighting({ vignette: Number(event.target.value) })} />
              <label>Neon Glow {sceneLight.glow.toFixed(2)}</label>
              <input type="range" min="0.25" max="1.8" step="0.01" value={sceneLight.glow} onChange={event => updateSceneLighting({ glow: Number(event.target.value) })} />
              <label>Explore Camera X {Math.round(scene.cameraX)} / {cameraMax}</label>
              <input type="range" min="0" max={cameraMax} step="1" value={scene.cameraX} onChange={event => setScene(prev => ({ ...prev, cameraX: Number(event.target.value) }))} />
              <div className="lighting-buttons">
                <button type="button" onClick={() => updateSceneLighting({ ...NEON_SCENE_LIGHTING })}>Neon Station</button>
                <button type="button" onClick={() => updateSceneLighting({ ...NEON_SCENE_LIGHTING, preset: "none" as const })}>Disable Global</button>
              </div>
            </div>
          </section>

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
            <div className="section-title"><MapIcon size={17} /> Canvas Frame</div>
            <div className="device-preset-grid">
              {VIEWPORT_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  className={scene.viewportPreset === preset.id ? "active" : ""}
                  onClick={() => updateSceneFrame({ viewportWidth: preset.width, viewportHeight: preset.height, viewportPreset: preset.id })}
                >
                  {preset.label}
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
                      <span>{roleLabels[asset.role]} · {asset.animations?.length || 1} clips · {triggerLabels[asset.binding.triggerType]} {asset.binding.triggerValue}</span>
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
    </div>
  );
}
