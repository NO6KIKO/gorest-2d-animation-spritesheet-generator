import type { GameScene, SceneLayer } from "../../types";
import { cloneSceneLayer } from "./sceneHistory";

export type SceneLayerCopyLabel = "copy" | "paste";
export type SceneObjectTarget = "layer" | "interaction-zone";

export function createSceneLayerInstance(
  sourceLayer: SceneLayer,
  label: SceneLayerCopyLabel,
  offsetIndex: number,
  zIndex: number
): SceneLayer {
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
}

export function replaceBackgroundLayerSettings(targetBackground: SceneLayer, sourceBackground: SceneLayer): SceneLayer {
  return {
    ...sourceBackground,
    id: targetBackground.id,
    name: targetBackground.name,
    type: "background",
    locked: targetBackground.locked,
    visible: true,
    zIndex: targetBackground.zIndex,
  };
}

export function clearBackgroundLayerImage(layer: SceneLayer): SceneLayer {
  return {
    ...layer,
    name: "Black Background",
    visible: true,
    imageUrl: undefined,
    color: "#000000",
    opacity: 1,
    fit: "stretch",
    position: "center center",
  };
}

export function disableLayerInteraction(layer: SceneLayer): SceneLayer {
  return {
    ...layer,
    interaction: layer.interaction ? { ...layer.interaction, enabled: false } : layer.interaction,
  };
}

export function reorderSceneLayerStack(scene: GameScene, sourceId: string, targetId: string): GameScene {
  if (sourceId === targetId) return scene;
  const topFirst = [...scene.layers].sort((a, b) => b.zIndex - a.zIndex);
  const sourceIndex = topFirst.findIndex(layer => layer.id === sourceId);
  const targetIndex = topFirst.findIndex(layer => layer.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return scene;
  const [source] = topFirst.splice(sourceIndex, 1);
  topFirst.splice(targetIndex, 0, source);
  const nextZ = new Map(topFirst.map((layer, index) => [layer.id, (topFirst.length - index) * 10]));
  return {
    ...scene,
    layers: scene.layers.map(layer => ({ ...layer, zIndex: nextZ.get(layer.id) ?? layer.zIndex })),
  };
}
