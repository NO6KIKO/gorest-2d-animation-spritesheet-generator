import { useRef, type Dispatch, type PointerEvent, type RefObject, type SetStateAction } from "react";
import {
  DEFAULT_INTERACTION_SETTINGS,
  interactionZoneBounds,
  layerInteractionSettings,
  layerWorldBounds,
} from "../../domain/scene/sceneModel";
import { clampLayerScale } from "../../shared/math";
import type { GameAsset, GameScene, LayerInteractionSettings, SceneLayer } from "../../types";

export type SceneStageResizeHandle = "nw" | "ne" | "sw" | "se";

type ResizeState = {
  id: string;
  handle: SceneStageResizeHandle;
  anchorScreenX: number;
  anchorScreenY: number;
  assetWidth: number;
  assetHeight: number;
};

type ZoneDragState = {
  id: string;
  startPointerX: number;
  startPointerY: number;
  startOffsetX: number;
  startOffsetY: number;
};

type ZoneResizeState = {
  id: string;
  handle: SceneStageResizeHandle;
  anchorWorldX: number;
  anchorWorldY: number;
};

type UseSceneStagePointerInteractionsOptions = {
  assetById: Map<string, GameAsset>;
  scene: GameScene;
  sceneStateRef: RefObject<GameScene>;
  spriteStageScale: number;
  stageRef: RefObject<HTMLDivElement>;
  stageScaleX: number;
  stageScaleY: number;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setScene: Dispatch<SetStateAction<GameScene>>;
  setSelectedInteractionZoneLayerId: Dispatch<SetStateAction<string | null>>;
  setSelectedLayerId: Dispatch<SetStateAction<string>>;
};

export function useSceneStagePointerInteractions({
  assetById,
  scene,
  sceneStateRef,
  spriteStageScale,
  stageRef,
  stageScaleX,
  stageScaleY,
  setIsPlaying,
  setScene,
  setSelectedInteractionZoneLayerId,
  setSelectedLayerId,
}: UseSceneStagePointerInteractionsOptions) {
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const zoneDragRef = useRef<ZoneDragState | null>(null);
  const zoneResizeRef = useRef<ZoneResizeState | null>(null);

  const updateSceneLayer = (layerId: string, patch: Partial<SceneLayer>) => {
    setScene(prev => ({
      ...prev,
      layers: prev.layers.map(layer => layer.id === layerId ? { ...layer, ...patch } : layer),
    }));
  };

  const clearPointerState = () => {
    dragRef.current = null;
    resizeRef.current = null;
    zoneDragRef.current = null;
    zoneResizeRef.current = null;
  };

  const clearSceneSelection = () => {
    clearPointerState();
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
    const pointerY = (event.clientY - rect.top) / stageScaleY + (scene.cameraY || 0) * parallax;
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
    handle: SceneStageResizeHandle
  ) => {
    if (layer.locked) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = null;
    const parallax = layer.parallax ?? 1;
    const left = (layer.x - scene.cameraX * parallax) * stageScaleX;
    const width = assetWidth * layer.scale * spriteStageScale;
    const height = assetHeight * layer.scale * spriteStageScale;
    const bottom = (layer.y - (scene.cameraY || 0) * parallax) * stageScaleY;
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
    const pointerY = (event.clientY - rect.top) / stageScaleY + (scene.cameraY || 0) * parallax;
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
    event: PointerEvent<HTMLElement>,
    layer: SceneLayer,
    asset: GameAsset,
    interaction: LayerInteractionSettings,
    handle: SceneStageResizeHandle
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
      const pointerWorldY = (event.clientY - rect.top) / stageScaleY + (scene.cameraY || 0) * parallax;
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
      const pointerWorldY = (event.clientY - rect.top) / stageScaleY + (scene.cameraY || 0) * parallax;
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
        ? resize.anchorScreenY / stageScaleY + (scene.cameraY || 0) * parallax
        : (resize.anchorScreenY + scaledHeight) / stageScaleY + (scene.cameraY || 0) * parallax;
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
      y: Math.round((event.clientY - rect.top) / stageScaleY + (scene.cameraY || 0) * parallax - drag.dy),
    });
  };

  return {
    clearPointerState,
    clearSceneSelection,
    stagePointerDown,
    stagePointerMove,
    startInteractionZoneDrag,
    startInteractionZoneResize,
    startLayerResize,
    updateSceneLayer,
  };
}
