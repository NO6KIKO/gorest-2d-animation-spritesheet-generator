import {
  BOARDING_TRAIN_ASSET_ID,
  BUILT_IN_SCENE_KIT_ASSET_IDS,
  INSPECT_TRIGGER_ASSET_ID,
} from "../scene-kit/sceneKitAssets";
import {
  DEFAULT_INTERACTION_SETTINGS,
  NEON_CONTACT_SHADOW,
  NEON_LAYER_LIGHTING,
  NEON_SCENE_LIGHTING,
  sceneViewportWidth,
} from "./sceneModel";
import type { GameScene, LayerInteractionSettings, SceneLayer } from "../../types";

export function createInteractionTriggerLayer(
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

export function createSceneKitLayer(scene: GameScene, assetId: string, stableId = true): SceneLayer {
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

export function ensureSceneKitLayers(scene: GameScene): GameScene {
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

export function removeBuiltInSceneKitLayers(scene: GameScene): GameScene {
  return {
    ...scene,
    layers: scene.layers.filter(layer => !layer.assetId || !BUILT_IN_SCENE_KIT_ASSET_IDS.has(layer.assetId)),
  };
}

export function normalizeEditableScene(scene: GameScene): GameScene {
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

export function prepareSceneForEditor(scene: GameScene): GameScene {
  return normalizeEditableScene(removeBuiltInSceneKitLayers(scene));
}

export function sceneTimestampLabel(date = new Date()) {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function createDefaultScene(): GameScene {
  return {
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
}
