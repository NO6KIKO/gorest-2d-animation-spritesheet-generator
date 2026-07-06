import { Fragment, type MouseEvent, type PointerEvent } from "react";
import type {
  AnimationSprite,
  GameAsset,
  LayerInteractionSettings,
  LayerShadowSettings,
  SceneLayer,
} from "../../types";
import { SceneVisualLayer } from "./SceneVisualLayer";

type ResizeHandle = "nw" | "ne" | "sw" | "se";

type InteractionZoneBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type SceneVisualLayerStackProps = {
  activeFrame: number;
  assetById: Map<string, GameAsset>;
  contactShadow: LayerShadowSettings;
  layers: SceneLayer[];
  sceneCameraX: number;
  sceneCameraY: number;
  selectedInteractionZoneLayerId: string | null;
  selectedLayerId: string;
  spriteStageScale: number;
  stageScaleX: number;
  stageScaleY: number;
  getInteraction: (layer: SceneLayer, asset: GameAsset) => LayerInteractionSettings | null;
  getInteractionZoneBounds: (
    layer: SceneLayer,
    asset: GameAsset,
    interaction: LayerInteractionSettings
  ) => InteractionZoneBounds;
  getRenderFilter: (layer: SceneLayer, asset: GameAsset) => string;
  resolveAssetSprite: (asset?: GameAsset, layer?: SceneLayer) => AnimationSprite | undefined;
  onInteractionZoneClick: (layer: SceneLayer, sprite: AnimationSprite) => void;
  onInteractionZoneDragStart: (
    event: PointerEvent<HTMLDivElement>,
    layer: SceneLayer,
    interaction: LayerInteractionSettings
  ) => void;
  onInteractionZoneResizeStart: (
    event: PointerEvent<HTMLElement>,
    layer: SceneLayer,
    asset: GameAsset,
    interaction: LayerInteractionSettings,
    handle: ResizeHandle
  ) => void;
  onLayerContextMenu: (event: MouseEvent<HTMLElement>, layer: SceneLayer) => void;
  onLayerPointerDown: (event: PointerEvent<HTMLDivElement>, layer: SceneLayer) => void;
  onLayerResizeStart: (
    event: PointerEvent<HTMLSpanElement>,
    layer: SceneLayer,
    assetWidth: number,
    assetHeight: number,
    handle: ResizeHandle
  ) => void;
  onLayerSelect: (layer: SceneLayer, sprite: AnimationSprite) => void;
  onZoneContextMenu: (event: MouseEvent<HTMLElement>, layer: SceneLayer) => void;
};

function isSceneVisualLayer(layer: SceneLayer) {
  return layer.type === "sprite" || layer.type === "effect" || layer.type === "foreground";
}

export function SceneVisualLayerStack({
  activeFrame,
  assetById,
  contactShadow,
  layers,
  sceneCameraX,
  sceneCameraY,
  selectedInteractionZoneLayerId,
  selectedLayerId,
  spriteStageScale,
  stageScaleX,
  stageScaleY,
  getInteraction,
  getInteractionZoneBounds,
  getRenderFilter,
  resolveAssetSprite,
  onInteractionZoneClick,
  onInteractionZoneDragStart,
  onInteractionZoneResizeStart,
  onLayerContextMenu,
  onLayerPointerDown,
  onLayerResizeStart,
  onLayerSelect,
  onZoneContextMenu,
}: SceneVisualLayerStackProps) {
  return (
    <>
      {layers
        .filter(layer => layer.visible && isSceneVisualLayer(layer))
        .sort((a, b) => a.zIndex - b.zIndex)
        .map(layer => {
          const asset = layer.assetId ? assetById.get(layer.assetId) : undefined;
          if (!asset) return null;
          const layerSprite = resolveAssetSprite(asset, layer);
          if (!layerSprite) return null;
          const interaction = getInteraction(layer, asset);
          return (
            <Fragment key={layer.id}>
              <SceneVisualLayer
                activeFrame={activeFrame}
                asset={asset}
                contactShadow={contactShadow}
                interaction={interaction}
                isInteractionTrigger={asset.tags.includes("interaction-trigger")}
                layer={layer}
                renderFilter={getRenderFilter(layer, asset)}
                sceneCameraX={sceneCameraX}
                sceneCameraY={sceneCameraY}
                selectedInteractionZoneLayerId={selectedInteractionZoneLayerId}
                selectedLayerId={selectedLayerId}
                sprite={layerSprite}
                spriteStageScale={spriteStageScale}
                stageScaleX={stageScaleX}
                stageScaleY={stageScaleY}
                zone={interaction ? getInteractionZoneBounds(layer, asset, interaction) : null}
                onInteractionZoneClick={onInteractionZoneClick}
                onInteractionZoneDragStart={onInteractionZoneDragStart}
                onInteractionZoneResizeStart={onInteractionZoneResizeStart}
                onLayerContextMenu={onLayerContextMenu}
                onLayerPointerDown={onLayerPointerDown}
                onLayerResizeStart={onLayerResizeStart}
                onLayerSelect={onLayerSelect}
                onZoneContextMenu={onZoneContextMenu}
              />
            </Fragment>
          );
        })}
    </>
  );
}
