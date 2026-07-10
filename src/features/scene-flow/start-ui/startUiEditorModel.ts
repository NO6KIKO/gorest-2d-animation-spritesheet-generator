import type { GameStartUiLayer, GameStartUiSettings } from "../../../types";

export type StartUiPoint = {
  x: number;
  y: number;
};

export type StartUiDragState = {
  id: string;
  pointerX: number;
  pointerY: number;
  x: number;
  y: number;
};

export function clampStartUiValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function startUiSettingsSignature(settings: GameStartUiSettings) {
  return JSON.stringify(settings);
}

export function getStartUiDesignSize(settings: GameStartUiSettings) {
  return {
    designHeight: Math.max(1, settings.designHeight || 941),
    designWidth: Math.max(1, settings.designWidth || 1672),
  };
}

export function orderStartUiLayers(layers: GameStartUiLayer[] = []) {
  return [...layers].sort((a, b) => a.zIndex - b.zIndex);
}

export function filterVisibleStartUiLayers(layers: GameStartUiLayer[]) {
  return layers.filter(layer => layer.visible && (layer.imageUrl || layer.label));
}

export function preferredStartUiLayerId(layers: GameStartUiLayer[] = []) {
  return layers.find(layer => layer.kind !== "background")?.id || layers[0]?.id || null;
}

export function findStartUiLayer(layers: GameStartUiLayer[] = [], layerId: string | null) {
  return layers.find(layer => layer.id === layerId) || null;
}

export function patchStartUiLayer(
  settings: GameStartUiSettings,
  layerId: string,
  patch: Partial<GameStartUiLayer>,
) {
  return {
    ...settings,
    layers: (settings.layers || []).map(layer => layer.id === layerId ? { ...layer, ...patch } : layer),
  };
}

export function pointFromStartUiStage(
  event: { clientX: number; clientY: number },
  stage: HTMLElement | null,
  designWidth: number,
  designHeight: number,
): StartUiPoint {
  const rect = stage?.getBoundingClientRect();
  if (!rect) return { x: 0, y: 0 };
  return {
    x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * designWidth,
    y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * designHeight,
  };
}

export function createStartUiDragState(layer: GameStartUiLayer, pointer: StartUiPoint): StartUiDragState {
  return {
    id: layer.id,
    pointerX: pointer.x,
    pointerY: pointer.y,
    x: layer.x,
    y: layer.y,
  };
}

export function clampStartUiLayerPosition(
  layer: Pick<GameStartUiLayer, "height" | "width">,
  x: number,
  y: number,
  designWidth: number,
  designHeight: number,
) {
  return {
    x: Math.round(clampStartUiValue(x, -layer.width * 0.9, designWidth - layer.width * 0.1)),
    y: Math.round(clampStartUiValue(y, -layer.height * 0.9, designHeight - layer.height * 0.1)),
  };
}

export function dragStartUiLayerPosition(
  layer: GameStartUiLayer,
  drag: StartUiDragState,
  pointer: StartUiPoint,
  designWidth: number,
  designHeight: number,
) {
  return clampStartUiLayerPosition(
    layer,
    drag.x + pointer.x - drag.pointerX,
    drag.y + pointer.y - drag.pointerY,
    designWidth,
    designHeight,
  );
}

export function moveStartUiLayerPosition(
  layer: GameStartUiLayer,
  deltaX: number,
  deltaY: number,
  designWidth: number,
  designHeight: number,
) {
  return clampStartUiLayerPosition(layer, layer.x + deltaX, layer.y + deltaY, designWidth, designHeight);
}
