export interface AnimationSprite {
  id: string;
  characterName: string;
  description: string;
  frameCount: number;
  style: string;
  prompt?: string;
  frames: string[]; // Standard XML SVG strings
  createdTime: string;
  updatedTime?: string;
  isPreset: boolean;
  spritesheetPng?: string;
  rawSpritesheetPng?: string;
  generationMode?: string;
  proportionPolicy?: string;
  normalization?: string;
  inputReferenceInvariant?: string;
  fps?: number;
  gridColumns?: number;
  cellSize?: number;
  frameSize?: number[];
  sheetSize?: number[];
  rootAnchorPolicy?: string;
  adaptiveFramePolicy?: string;
}

export type ActionTriggerType = "mouse" | "keyboard" | "auto" | "state";
export type AssetRole = "player" | "npc" | "effect" | "prop" | "background";
export type AnimationDirection = "left" | "right" | "up" | "down" | "none";

export interface ActionBinding {
  actionName: string;
  triggerType: ActionTriggerType;
  triggerValue: string;
  gameState: string;
  notes?: string;
}

export interface AnimationClip {
  id: string;
  name: string;
  actionName: string;
  direction: AnimationDirection;
  sprite: AnimationSprite;
  binding?: ActionBinding;
  loop: boolean;
  fps?: number;
}

export interface GameAsset {
  id: string;
  name: string;
  role: AssetRole;
  confirmed: boolean;
  savedTime: string;
  updatedTime?: string;
  sprite: AnimationSprite;
  animations?: AnimationClip[];
  defaultAnimationId?: string;
  binding: ActionBinding;
  tags: string[];
}

export type SceneLayerType = "background" | "ground" | "sprite" | "effect" | "foreground";

export interface LayerShadowSettings {
  enabled: boolean;
  color: string;
  opacity: number;
  blur: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export interface LayerLightingSettings {
  preset: "none" | "neon-station";
  brightness: number;
  contrast: number;
  saturate: number;
  edgeLightColor: string;
  edgeLightOpacity: number;
  rimLightColor: string;
  rimLightOpacity: number;
}

export interface SceneLightingSettings {
  preset: "none" | "neon-station";
  brightness: number;
  contrast: number;
  saturate: number;
  ambience: number;
  vignette: number;
  glow: number;
}

export type InteractionPromptStyle = "horror" | "minimal" | "caption";
export type InteractionPreset = "inspect" | "pickup" | "toggle" | "scene-link" | "animated" | "conditional";
export type InteractionTriggerMode = "near-click" | "near-key" | "inventory" | "state";
export type InteractionActionType = "subtitle" | "play-animation" | "toggle-layer" | "pickup-item" | "scene-link" | "set-state";

export interface LayerInteractionSettings {
  enabled: boolean;
  preset?: InteractionPreset;
  triggerMode?: InteractionTriggerMode;
  actionType?: InteractionActionType;
  promptKey: string;
  promptText: string;
  subtitle?: string;
  failSubtitle?: string;
  showText: boolean;
  fontSize: number;
  promptScale: number;
  promptStyle: InteractionPromptStyle;
  triggerRadius: number;
  offsetX: number;
  offsetY: number;
  zoneWidth?: number;
  zoneHeight?: number;
  zoneOffsetX?: number;
  zoneOffsetY?: number;
  conditionStateKey?: string;
  conditionStateValue?: string;
  targetLayerId?: string;
  targetSceneId?: string;
  targetAnimationId?: string;
  itemId?: string;
  setStateKey?: string;
  setStateValue?: string;
  hideLayerOnPickup?: boolean;
  hotspotVisible?: boolean;
}

export interface SceneLayer {
  id: string;
  name: string;
  type: SceneLayerType;
  visible: boolean;
  locked?: boolean;
  assetId?: string;
  activeAnimationId?: string;
  x: number;
  y: number;
  scale: number;
  zIndex: number;
  opacity: number;
  parallax: number;
  width?: number;
  height?: number;
  color?: string;
  imageUrl?: string;
  fit?: "cover" | "contain" | "stretch" | "tile";
  position?: string;
  shadow?: LayerShadowSettings;
  lighting?: LayerLightingSettings;
  interaction?: LayerInteractionSettings;
}

export interface GameScene {
  id: string;
  name: string;
  width: number;
  height: number;
  viewportWidth?: number;
  viewportHeight?: number;
  viewportPreset?: string;
  cameraX: number;
  groundY: number;
  background: string;
  layers: SceneLayer[];
  state?: Record<string, string | number | boolean>;
  lighting?: SceneLightingSettings;
  savedTime: string;
  updatedTime?: string;
}

export interface GameLibrary {
  assets: GameAsset[];
  scenes: GameScene[];
  updatedTime?: string;
}

export type BackgroundTheme = "transparent" | "dark" | "light" | "green-screen";

export interface SpraySheetConfig {
  columns: number; // For rendering sheet (e.g. 1 row of N columns, or 4 columns grid, etc.)
  framePadding: number;
  scale: number; // Export resolution size (e.g., 64px, 128px, 256px, 512px)
}




