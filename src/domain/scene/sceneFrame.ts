import type { GameScene } from "../../types";
import { clamp } from "../../shared/math";

export type SceneFramePatch = Partial<Pick<GameScene, "viewportWidth" | "viewportHeight" | "viewportPreset">>;

export function resizeSceneFrame(scene: GameScene, patch: SceneFramePatch, fallbackViewportWidth = 1280): GameScene {
  const requestedViewportWidth = patch.viewportWidth || scene.viewportWidth || fallbackViewportWidth;
  const requestedViewportHeight = patch.viewportHeight || scene.viewportHeight || scene.height;
  const nextSceneWidth = Math.max(scene.width, requestedViewportWidth);
  const nextSceneHeight = Math.max(scene.height, requestedViewportHeight);
  const nextViewportWidth = Math.min(requestedViewportWidth, nextSceneWidth);
  const nextViewportHeight = requestedViewportHeight;

  return {
    ...scene,
    ...patch,
    width: nextSceneWidth,
    height: nextSceneHeight,
    viewportWidth: nextViewportWidth,
    viewportHeight: nextViewportHeight,
    cameraX: clamp(scene.cameraX, 0, Math.max(0, nextSceneWidth - nextViewportWidth)),
    layers: scene.layers.map(layer => {
      if (layer.type !== "background") return layer;
      const followsWorldWidth = !layer.width || Math.abs(layer.width - scene.width) <= 2;
      const followsWorldHeight = !layer.height || Math.abs(layer.height - scene.height) <= 2;
      return {
        ...layer,
        width: followsWorldWidth ? nextSceneWidth : layer.width,
        height: followsWorldHeight ? nextSceneHeight : layer.height,
        y: followsWorldHeight && Math.abs(layer.y - scene.height) <= 2 ? nextSceneHeight : layer.y,
      };
    }),
  };
}
