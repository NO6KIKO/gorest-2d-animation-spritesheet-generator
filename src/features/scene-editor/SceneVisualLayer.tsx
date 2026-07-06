import type { MouseEvent, PointerEvent } from "react";
import { interactionZoneLabel } from "../../domain/scene/sceneModel";
import { getFrameSize, spriteFrame } from "../../domain/sprites/spriteUtils";
import type {
  AnimationSprite,
  GameAsset,
  LayerInteractionSettings,
  LayerShadowSettings,
  SceneLayer,
} from "../../types";

type ResizeHandle = "nw" | "ne" | "sw" | "se";

type InteractionZoneBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type SceneVisualLayerProps = {
  activeFrame: number;
  asset: GameAsset;
  contactShadow: LayerShadowSettings;
  interaction: LayerInteractionSettings | null;
  isInteractionTrigger: boolean;
  layer: SceneLayer;
  renderFilter: string;
  selectedInteractionZoneLayerId: string | null;
  selectedLayerId: string;
  sceneCameraX: number;
  sceneCameraY: number;
  sprite: AnimationSprite;
  spriteStageScale: number;
  stageScaleX: number;
  stageScaleY: number;
  zone: InteractionZoneBounds | null;
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

export function SceneVisualLayer({
  activeFrame,
  asset,
  contactShadow,
  interaction,
  isInteractionTrigger,
  layer,
  renderFilter,
  selectedInteractionZoneLayerId,
  selectedLayerId,
  sceneCameraX,
  sceneCameraY,
  sprite,
  spriteStageScale,
  stageScaleX,
  stageScaleY,
  zone,
  onInteractionZoneClick,
  onInteractionZoneDragStart,
  onInteractionZoneResizeStart,
  onLayerContextMenu,
  onLayerPointerDown,
  onLayerResizeStart,
  onLayerSelect,
  onZoneContextMenu,
}: SceneVisualLayerProps) {
  const isSelected = layer.id === selectedLayerId;
  const [assetWidth, assetHeight] = getFrameSize(sprite);
  const width = assetWidth * layer.scale * spriteStageScale;
  const height = assetHeight * layer.scale * spriteStageScale;
  const frame = spriteFrame(sprite, activeFrame);
  const shadow = layer.shadow || contactShadow;
  const shadowWidth = width * shadow.width;
  const shadowHeight = Math.max(8, height * shadow.height);
  const stageX = (layer.x - sceneCameraX * (layer.parallax ?? 1)) * stageScaleX;
  const stageY = (layer.y - sceneCameraY * (layer.parallax ?? 1)) * stageScaleY;
  const hotspotOpacity = isInteractionTrigger && interaction?.hotspotVisible === false && !isSelected
    ? 0.08
    : layer.opacity;
  const isLightZone = interaction?.preset === "light-zone" || interaction?.actionType === "light-zone";
  const zonePresetClass = interaction?.preset ? `zone-preset-${interaction.preset}` : "";

  return (
    <>
      {shadow.enabled && (
        <div
          className="scene-contact-shadow"
          style={{
            left: stageX + width / 2 - shadowWidth / 2 + shadow.offsetX * spriteStageScale,
            top: stageY - shadowHeight / 2 + shadow.offsetY * spriteStageScale,
            width: shadowWidth,
            height: shadowHeight,
            zIndex: layer.zIndex - 1,
            opacity: shadow.opacity * layer.opacity,
            background: shadow.color,
            filter: `blur(${shadow.blur * spriteStageScale}px)`,
          }}
        />
      )}
      <div
        className={`${isSelected ? "scene-sprite selected" : "scene-sprite"} ${isInteractionTrigger ? "interaction-hotspot-layer" : ""}`}
        style={{
          left: stageX,
          top: stageY - height,
          width,
          height,
          zIndex: layer.zIndex,
          opacity: hotspotOpacity,
        }}
        onPointerDown={event => {
          onLayerPointerDown(event, layer);
          onLayerSelect(layer, sprite);
        }}
        onClick={event => {
          event.stopPropagation();
          onLayerSelect(layer, sprite);
        }}
        onContextMenu={event => {
          onLayerContextMenu(event, layer);
        }}
      >
        <div
          className="sprite-art"
          style={{ filter: renderFilter }}
          dangerouslySetInnerHTML={{ __html: frame }}
        />
        {isSelected && selectedInteractionZoneLayerId !== layer.id && (
          <>
            <span className="scene-selection-label">{layer.name}</span>
            <span
              className="resize-handle nw"
              title="Drag to resize"
              onPointerDown={event => onLayerResizeStart(event, layer, assetWidth, assetHeight, "nw")}
            />
            <span
              className="resize-handle ne"
              title="Drag to resize"
              onPointerDown={event => onLayerResizeStart(event, layer, assetWidth, assetHeight, "ne")}
            />
            <span
              className="resize-handle sw"
              title="Drag to resize"
              onPointerDown={event => onLayerResizeStart(event, layer, assetWidth, assetHeight, "sw")}
            />
            <span
              className="resize-handle se"
              title="Drag to resize"
              onPointerDown={event => onLayerResizeStart(event, layer, assetWidth, assetHeight, "se")}
            />
          </>
        )}
      </div>
      {zone && interaction?.enabled && (
        <div
          className={`interaction-zone-outline ${zonePresetClass} ${isLightZone ? "light-zone" : ""} ${interaction.zoneShape === "circle" ? "circle-zone" : ""} ${selectedInteractionZoneLayerId === layer.id ? "selected" : ""} ${isSelected ? "owner-selected" : ""}`}
          style={{
            left: (zone.left - sceneCameraX * (layer.parallax ?? 1)) * stageScaleX,
            top: (zone.top - sceneCameraY * (layer.parallax ?? 1)) * stageScaleY,
            width: zone.width * stageScaleX,
            height: zone.height * stageScaleY,
            zIndex: layer.zIndex + 5,
          }}
          onPointerDown={event => onInteractionZoneDragStart(event, layer, interaction)}
          onClick={event => {
            event.stopPropagation();
            onInteractionZoneClick(layer, sprite);
          }}
          onContextMenu={event => {
            onZoneContextMenu(event, layer);
          }}
        >
          {selectedInteractionZoneLayerId === layer.id && (
            <>
              <span>{interactionZoneLabel(interaction)}</span>
              <i
                className="interaction-zone-handle nw"
                onPointerDown={event => onInteractionZoneResizeStart(event, layer, asset, interaction, "nw")}
              />
              <i
                className="interaction-zone-handle ne"
                onPointerDown={event => onInteractionZoneResizeStart(event, layer, asset, interaction, "ne")}
              />
              <i
                className="interaction-zone-handle sw"
                onPointerDown={event => onInteractionZoneResizeStart(event, layer, asset, interaction, "sw")}
              />
              <i
                className="interaction-zone-handle se"
                onPointerDown={event => onInteractionZoneResizeStart(event, layer, asset, interaction, "se")}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}
