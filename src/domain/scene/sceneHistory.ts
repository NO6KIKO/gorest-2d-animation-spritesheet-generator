import type { GameScene, SceneLayer } from "../../types";

export const SCENE_HISTORY_LIMIT = 80;

export function cloneSceneForHistory(scene: GameScene) {
  if (typeof structuredClone === "function") return structuredClone(scene);
  return JSON.parse(JSON.stringify(scene)) as GameScene;
}

export function cloneSceneLayer(layer: SceneLayer) {
  if (typeof structuredClone === "function") return structuredClone(layer);
  return JSON.parse(JSON.stringify(layer)) as SceneLayer;
}

export function sceneHistoryKey(scene: GameScene) {
  return JSON.stringify(scene);
}
