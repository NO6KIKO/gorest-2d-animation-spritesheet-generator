import { getFrameSize } from "../sprites/spriteUtils";
import { BOARDING_TRAIN_ASSET_ID, INSPECT_TRIGGER_ASSET_ID } from "../scene-kit/sceneKitAssets";
import type {
  AnimationClip,
  AnimationSprite,
  GameAsset,
  GameScene,
  LayerInteractionSettings,
  LayerLightingSettings,
  LayerShadowSettings,
  SceneLayer,
  SceneLightingSettings,
} from "../../types";

const DEFAULT_VIEWPORT_WIDTH = 1280;

export const NEON_CONTACT_SHADOW: LayerShadowSettings = {
  enabled: true,
  color: "rgba(2, 0, 10, 0.88)",
  opacity: 0.74,
  blur: 24,
  width: 0.58,
  height: 0.065,
  offsetX: 0,
  offsetY: 6,
};

export const NEON_LAYER_LIGHTING: LayerLightingSettings = {
  preset: "neon-station",
  brightness: 0.64,
  contrast: 0.98,
  saturate: 0.74,
  edgeLightColor: "#ff3e75",
  edgeLightOpacity: 0.32,
  rimLightColor: "#8e54ff",
  rimLightOpacity: 0.24,
};

export const DEFAULT_BACKGROUND_LIGHTING: LayerLightingSettings = {
  preset: "background-adjust",
  brightness: 1,
  contrast: 1,
  saturate: 1,
  edgeLightColor: "#ffffff",
  edgeLightOpacity: 0,
  rimLightColor: "#ffffff",
  rimLightOpacity: 0,
};

export const NEON_SCENE_LIGHTING: SceneLightingSettings = {
  preset: "neon-station",
  brightness: 1,
  contrast: 1.04,
  saturate: 0.96,
  ambience: 0.78,
  vignette: 0.28,
  glow: 1,
};

export const DEFAULT_INTERACTION_SETTINGS: LayerInteractionSettings = {
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
  zoneShape: "rect",
  zoneOffsetX: 0,
  zoneOffsetY: 0,
  repeatMode: "repeatable",
  cooldownMs: 0,
  debugVisible: true,
  hideLayerOnPickup: true,
  hotspotVisible: true,
  lightColor: "#f4d38a",
  lightIntensity: 0.65,
  lightFalloff: 0.78,
  lightBlendMode: "screen",
  lightFlicker: 0,
  audioLabel: "Ambient sound",
  audioVolume: 0.7,
  audioLoop: false,
  cameraMode: "room-lock",
  cameraDurationMs: 450,
  cameraZoom: 1.12,
  cameraShakeIntensity: 8,
  physicsMode: "solid",
  physicsStrength: 1,
  physicsFriction: 0.55,
  dialogueSpeaker: "Unknown",
  dialogueText: "Who are you?\nWhy is this classroom connected to the ward?",
};

export function sceneViewportWidth(scene: GameScene) {
  return Math.min(scene.viewportWidth || DEFAULT_VIEWPORT_WIDTH, scene.width);
}

export function sceneViewportHeight(scene: GameScene) {
  return scene.viewportHeight || scene.height;
}

export function formatViewportRatio(width: number, height: number) {
  if (!width || !height) return "custom";
  const ratio = width / height;
  return ratio >= 1 ? `${ratio.toFixed(2)}:1` : `1:${(height / width).toFixed(2)}`;
}

function rgbaColor(hex: string, opacity: number) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return hex;
  const [, r, g, b] = match;
  return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${opacity})`;
}

export function sceneLighting(scene: GameScene) {
  return scene.lighting || NEON_SCENE_LIGHTING;
}

export function sceneFilter(scene: GameScene) {
  const lighting = sceneLighting(scene);
  if (lighting.preset === "none") return "none";
  return [
    `brightness(${lighting.brightness})`,
    `contrast(${lighting.contrast})`,
    `saturate(${lighting.saturate})`,
  ].join(" ");
}

function colorAdjustmentFilter(lighting: LayerLightingSettings) {
  return [
    `brightness(${lighting.brightness})`,
    `contrast(${lighting.contrast})`,
    `saturate(${lighting.saturate})`,
  ].join(" ");
}

function isIdentityColorAdjustment(lighting: LayerLightingSettings) {
  return lighting.brightness === 1 && lighting.contrast === 1 && lighting.saturate === 1;
}

export function backgroundLightingForLayer(layer: SceneLayer) {
  return layer.lighting?.preset === "background-adjust"
    ? { ...DEFAULT_BACKGROUND_LIGHTING, ...layer.lighting }
    : DEFAULT_BACKGROUND_LIGHTING;
}

export function backgroundLayerFilter(layer: SceneLayer) {
  if (!layer.lighting || layer.lighting.preset === "none") return "none";
  const lighting = backgroundLightingForLayer(layer);
  return isIdentityColorAdjustment(lighting) ? "none" : colorAdjustmentFilter(lighting);
}

export function layerFilter(layer: SceneLayer) {
  const lighting = layer.lighting || NEON_LAYER_LIGHTING;
  if (lighting.preset === "none") return "none";
  if (lighting.preset === "background-adjust") {
    return isIdentityColorAdjustment(lighting) ? "none" : colorAdjustmentFilter(lighting);
  }
  return [
    colorAdjustmentFilter(lighting),
    "sepia(0.08)",
    `drop-shadow(-5px 0 8px ${rgbaColor(lighting.rimLightColor, lighting.rimLightOpacity)})`,
    `drop-shadow(7px 0 10px ${rgbaColor(lighting.edgeLightColor, lighting.edgeLightOpacity)})`,
    "drop-shadow(0 14px 18px rgba(4, 0, 12, 0.5))",
  ].join(" ");
}

export function combineFilters(...filters: Array<string | undefined>) {
  const active = filters.filter(filter => filter && filter !== "none");
  return active.length ? active.join(" ") : "none";
}

export function characterFilter(scene: GameScene, layer: SceneLayer) {
  return combineFilters(sceneFilter(scene), layerFilter(layer));
}

export function sceneLayerRenderFilter(scene: GameScene, layer: SceneLayer, asset?: GameAsset) {
  const explicitLayerFilter = layer.lighting ? layerFilter(layer) : "none";
  if (asset?.role === "player") return characterFilter(scene, layer);
  return combineFilters(sceneFilter(scene), explicitLayerFilter);
}

export function isSceneVisualLayer(layer: SceneLayer) {
  return layer.type === "sprite" || layer.type === "effect" || layer.type === "foreground";
}

export function isTransformableSceneLayer(layer: SceneLayer) {
  return layer.type === "background" || isSceneVisualLayer(layer);
}

export function resolveAssetClip(asset?: GameAsset, layer?: SceneLayer): AnimationClip | undefined {
  if (!asset?.animations?.length) return undefined;
  return (
    asset.animations.find(clip => clip.id === layer?.activeAnimationId) ||
    asset.animations.find(clip => clip.id === asset.defaultAnimationId) ||
    asset.animations[0]
  );
}

export function resolveAssetSprite(asset?: GameAsset, layer?: SceneLayer): AnimationSprite | undefined {
  return resolveAssetClip(asset, layer)?.sprite || asset?.sprite;
}

export function layerWorldBounds(layer: SceneLayer, asset?: GameAsset) {
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

export function interactionZoneBounds(layer: SceneLayer, asset: GameAsset | undefined, interaction: LayerInteractionSettings) {
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

export type InteractionZoneBounds = ReturnType<typeof interactionZoneBounds>;

export type InteractionCollisionRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

const DEFAULT_ZONE_POLYGON_POINTS = [
  { x: 0.5, y: 0 },
  { x: 0.96, y: 0.22 },
  { x: 0.88, y: 0.78 },
  { x: 0.5, y: 1 },
  { x: 0.12, y: 0.78 },
  { x: 0.04, y: 0.22 },
];

function pointInPolygon(pointX: number, pointY: number, points: Array<{ x: number; y: number }>) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const currentPoint = points[index];
    const previousPoint = points[previous];
    const crosses = (
      (currentPoint.y > pointY) !== (previousPoint.y > pointY) &&
      pointX < ((previousPoint.x - currentPoint.x) * (pointY - currentPoint.y)) / (previousPoint.y - currentPoint.y || 1) + currentPoint.x
    );
    if (crosses) inside = !inside;
  }
  return inside;
}

export function interactionZoneContainsPoint(bounds: InteractionZoneBounds, interaction: LayerInteractionSettings, pointX: number, pointY: number) {
  if (interaction.zoneShape === "circle" || interaction.zoneShape === "brush") {
    const radiusX = Math.max(1, bounds.width / 2);
    const radiusY = Math.max(1, bounds.height / 2);
    const normalizedX = (pointX - bounds.centerX) / radiusX;
    const normalizedY = (pointY - bounds.centerY) / radiusY;
    return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
  }

  if (interaction.zoneShape === "polygon") {
    const points = (interaction.zonePolygonPoints?.length ? interaction.zonePolygonPoints : DEFAULT_ZONE_POLYGON_POINTS)
      .map(point => ({
        x: bounds.left + point.x * bounds.width,
        y: bounds.top + point.y * bounds.height,
      }));
    return pointInPolygon(pointX, pointY, points);
  }

  return (
    pointX >= bounds.left &&
    pointX <= bounds.right &&
    pointY >= bounds.top &&
    pointY <= bounds.bottom
  );
}

export function interactionZoneIntersectsRect(
  bounds: InteractionZoneBounds,
  interaction: LayerInteractionSettings,
  rect: InteractionCollisionRect
) {
  const overlapsBounds =
    rect.right >= bounds.left &&
    rect.left <= bounds.right &&
    rect.bottom >= bounds.top &&
    rect.top <= bounds.bottom;
  if (!overlapsBounds) return false;
  if (!interaction.zoneShape || interaction.zoneShape === "rect") return true;

  const samplePoints: Array<[number, number]> = [
    [rect.centerX, rect.centerY],
    [rect.left, rect.top],
    [rect.right, rect.top],
    [rect.right, rect.bottom],
    [rect.left, rect.bottom],
    [rect.centerX, rect.top],
    [rect.right, rect.centerY],
    [rect.centerX, rect.bottom],
    [rect.left, rect.centerY],
  ];
  if (samplePoints.some(([pointX, pointY]) => interactionZoneContainsPoint(bounds, interaction, pointX, pointY))) {
    return true;
  }

  return (
    bounds.centerX >= rect.left &&
    bounds.centerX <= rect.right &&
    bounds.centerY >= rect.top &&
    bounds.centerY <= rect.bottom
  );
}

export function isLightZoneInteraction(interaction?: LayerInteractionSettings | null) {
  return interaction?.preset === "light-zone" || interaction?.actionType === "light-zone";
}

export function isAudioZoneInteraction(interaction?: LayerInteractionSettings | null) {
  return interaction?.preset === "audio-zone" || interaction?.actionType === "play-audio";
}

export function isCameraZoneInteraction(interaction?: LayerInteractionSettings | null) {
  return interaction?.preset === "camera-zone" || interaction?.actionType === "camera-focus";
}

export function isDialogueZoneInteraction(interaction?: LayerInteractionSettings | null) {
  return interaction?.preset === "dialogue-zone" || interaction?.actionType === "dialogue";
}

export function isPhysicsZoneInteraction(interaction?: LayerInteractionSettings | null) {
  return interaction?.preset === "physics-zone" || interaction?.actionType === "physics-zone";
}

export function interactionZoneLabel(interaction?: LayerInteractionSettings | null) {
  if (!interaction) return "Interaction Zone";
  if (isLightZoneInteraction(interaction)) return "Light Zone";
  if (isAudioZoneInteraction(interaction)) return "Audio Zone";
  if (isCameraZoneInteraction(interaction)) return "Camera Zone";
  if (isDialogueZoneInteraction(interaction)) return "Dialogue Zone";
  if (isPhysicsZoneInteraction(interaction)) return "Physics Zone";
  if (interaction.preset === "scene-link" || interaction.actionType === "scene-link") return "Door Zone";
  if (interaction.preset === "pickup" || interaction.actionType === "pickup-item") return "Pickup Zone";
  if (interaction.preset === "toggle" || interaction.actionType === "toggle-layer") return "Switch Zone";
  if (interaction.preset === "animated" || interaction.actionType === "play-animation") return "Animation Zone";
  if (interaction.preset === "conditional" || interaction.actionType === "set-state") return "State Zone";
  return "Inspect Zone";
}

export function stateValueFromText(value?: string) {
  const text = (value || "").trim();
  if (!text) return "";
  if (text === "true") return true;
  if (text === "false") return false;
  if (!Number.isNaN(Number(text)) && text !== "") return Number(text);
  return text;
}

export function stateMatches(actual: unknown, expected?: string) {
  const text = (expected || "").trim();
  if (!text) return Boolean(actual);
  return String(actual) === String(stateValueFromText(text));
}

export function keyLabelFromBinding(triggerValue?: string) {
  if (!triggerValue) return "E";
  return triggerValue.replace(/^Key/i, "").replace(/^Digit/i, "") || triggerValue;
}

export function defaultInteractionText(asset?: GameAsset) {
  if (!asset) return DEFAULT_INTERACTION_SETTINGS.promptText;
  if (asset.id === BOARDING_TRAIN_ASSET_ID) return "Board";
  if (asset.id === "asset_scene_ticket_machine") return "Use";
  if (asset.id === INSPECT_TRIGGER_ASSET_ID) return "Inspect";
  return asset.binding?.actionName === "interact" ? "Interact" : asset.name;
}

export function layerInteractionSettings(layer: SceneLayer, asset?: GameAsset): LayerInteractionSettings | null {
  const assetIsInteractable = !!asset && (
    asset.tags.includes("interactable") ||
    asset.tags.includes("interaction-trigger") ||
    asset.tags.includes("inspect-hotspot")
  );
  if (!assetIsInteractable && !layer.interaction) return null;
  return {
    ...DEFAULT_INTERACTION_SETTINGS,
    promptKey: keyLabelFromBinding(asset?.binding?.triggerValue),
    promptText: defaultInteractionText(asset),
    ...layer.interaction,
  };
}
