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
  preset: "none" | "neon-station" | "background-adjust";
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

export type ScenePlaybackMode = "game" | "animate";
export type SceneTransitionType = "cut" | "fade-black" | "dissolve";

export interface SceneTimelineSettings {
  durationMs: number;
  transitionType: SceneTransitionType;
  transitionDurationMs: number;
  primaryLayerId?: string;
}

export type InteractionPromptStyle = "horror" | "minimal" | "caption";
export type InteractionPreset = "inspect" | "pickup" | "toggle" | "scene-link" | "animated" | "conditional" | "light-zone" | "audio-zone" | "camera-zone" | "dialogue-zone" | "physics-zone";
export type InteractionTriggerMode = "near-click" | "near-key" | "inventory" | "state" | "auto";
export type InteractionActionType = "subtitle" | "play-animation" | "toggle-layer" | "pickup-item" | "scene-link" | "set-state" | "light-zone" | "play-audio" | "camera-focus" | "dialogue" | "physics-zone";
export type InteractionZoneShape = "rect" | "circle" | "polygon" | "brush";
export type InteractionRepeatMode = "once" | "repeatable" | "cooldown";
export type InteractionLightBlendMode = "screen" | "plus-lighter" | "normal";
export type InteractionCameraMode = "room-lock" | "focus" | "pan" | "zoom" | "shake" | "return-player";
export type InteractionPhysicsMode = "solid" | "slow" | "pull";

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
  zoneShape?: InteractionZoneShape;
  zoneWidth?: number;
  zoneHeight?: number;
  zoneOffsetX?: number;
  zoneOffsetY?: number;
  zonePolygonPoints?: Array<{ x: number; y: number }>;
  physicsMode?: InteractionPhysicsMode;
  physicsStrength?: number;
  physicsFriction?: number;
  repeatMode?: InteractionRepeatMode;
  cooldownMs?: number;
  debugVisible?: boolean;
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
  lightColor?: string;
  lightIntensity?: number;
  lightFalloff?: number;
  lightBlendMode?: InteractionLightBlendMode;
  lightFlicker?: number;
  lightAttachToLayerId?: string;
  audioLabel?: string;
  audioUrl?: string;
  audioVolume?: number;
  audioLoop?: boolean;
  cameraMode?: InteractionCameraMode;
  cameraTargetX?: number;
  cameraTargetY?: number;
  cameraDurationMs?: number;
  cameraZoom?: number;
  cameraShakeIntensity?: number;
  dialogueSpeaker?: string;
  dialogueText?: string;
  dialoguePortraitUrl?: string;
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
  playbackMode?: ScenePlaybackMode;
  timeline?: SceneTimelineSettings;
  width: number;
  height: number;
  viewportWidth?: number;
  viewportHeight?: number;
  viewportPreset?: string;
  cameraX: number;
  cameraY: number;
  groundY: number;
  background: string;
  layers: SceneLayer[];
  state?: Record<string, string | number | boolean>;
  lighting?: SceneLightingSettings;
  savedTime: string;
  updatedTime?: string;
}

export type StartUiTheme = "dark" | "light" | "horror";
export type StartUiLayerKind = "background" | "title" | "menu" | "overlay";
export type StartUiTitleEffect = "none" | "breathe" | "glitch";
export type StartUiButtonHoverEffect = "none" | "lift" | "glow" | "lift-glow";
export type StartUiEntranceEffect = "none" | "fade" | "rise";
export type StartUiTransitionEffect = "none" | "fade" | "lights-out";

export interface GameStartUiEffects {
  enabled: boolean;
  parallaxStrength: number;
  flickerEnabled: boolean;
  flickerStrength: number;
  flickerInterval: number;
  vignetteStrength: number;
  grainStrength: number;
  titleEffect: StartUiTitleEffect;
  titleStrength: number;
  titleSpeed: number;
  buttonHoverEffect: StartUiButtonHoverEffect;
  buttonLift: number;
  buttonGlow: number;
  buttonPressScale: number;
  entranceEffect: StartUiEntranceEffect;
  entranceDuration: number;
  entranceStagger: number;
  transitionEffect: StartUiTransitionEffect;
  transitionDuration: number;
  respectReducedMotion: boolean;
}

export interface GameStartUiLayer {
  id: string;
  name: string;
  kind: StartUiLayerKind;
  imageUrl: string;
  label?: string;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  zIndex: number;
  locked?: boolean;
  sourceX?: number;
  sourceY?: number;
  sourceWidth?: number;
  sourceHeight?: number;
}

export interface GameStartUiSettings {
  id: string;
  enabled: boolean;
  title: string;
  subtitle: string;
  theme: StartUiTheme;
  designWidth?: number;
  designHeight?: number;
  initialSceneId?: string;
  backgroundImageUrl?: string;
  layers?: GameStartUiLayer[];
  effects?: GameStartUiEffects;
  primaryActionLabel: string;
  continueActionLabel: string;
  loadActionLabel: string;
  settingsActionLabel: string;
  quitActionLabel: string;
  showContinue: boolean;
  showLoadGame: boolean;
  showSettings: boolean;
  showQuit: boolean;
  saveSlots: number;
  autosave: boolean;
  confirmNewGame: boolean;
  musicVolume: number;
  sfxVolume: number;
  fullscreenToggle: boolean;
  languageSelector: boolean;
  updatedTime?: string;
}

export interface GameLibrary {
  assets: GameAsset[];
  scenes: GameScene[];
  startUi?: GameStartUiSettings;
  startUis?: GameStartUiSettings[];
  updatedTime?: string;
}

export type BackgroundTheme = "transparent" | "dark" | "light" | "green-screen";

export interface SpraySheetConfig {
  columns: number; // For rendering sheet (e.g. 1 row of N columns, or 4 columns grid, etc.)
  framePadding: number;
  scale: number; // Export resolution size (e.g., 64px, 128px, 256px, 512px)
}




