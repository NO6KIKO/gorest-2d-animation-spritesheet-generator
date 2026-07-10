import { Move } from "lucide-react";
import type { Key, PointerEvent as ReactPointerEvent } from "react";
import type { GameStartUiLayer, GameStartUiSettings } from "../../../types";
import {
  getStartUiButtonGroup,
  startUiLayerEffectStyle,
  type StartUiEffectPointer,
} from "./startUiEffectsModel";
import { startUiLayerCropStyle, startUiLayerStyle } from "./startUiLayerStyles";

type StartUiCanvasLayerProps = {
  key?: Key;
  designHeight: number;
  designWidth: number;
  effectPointer: StartUiEffectPointer;
  hoveredButtonGroup: string | null;
  isEffectsPreviewing: boolean;
  isSelected: boolean;
  layer: GameStartUiLayer;
  layerIndex: number;
  pressedButtonGroup: string | null;
  settings: GameStartUiSettings;
  onButtonGroupEnter: (group: string) => void;
  onButtonGroupLeave: (group: string) => void;
  onButtonGroupPress: (group: string) => void;
  onStartLayerDrag: (event: ReactPointerEvent<HTMLDivElement>, layer: GameStartUiLayer) => void;
};

function StartUiLayerArtwork({ layer }: { layer: GameStartUiLayer }) {
  if (layer.imageUrl && !layer.sourceWidth) {
    return <img src={layer.imageUrl} alt="" draggable={false} />;
  }
  if (layer.label) {
    return <span className={`scene-start-ui-text-layer ${layer.kind}`}>{layer.label}</span>;
  }
  return null;
}

export function StartUiCanvasLayer({
  designHeight,
  designWidth,
  effectPointer,
  hoveredButtonGroup,
  isEffectsPreviewing,
  isSelected,
  layer,
  layerIndex,
  pressedButtonGroup,
  settings,
  onButtonGroupEnter,
  onButtonGroupLeave,
  onButtonGroupPress,
  onStartLayerDrag,
}: StartUiCanvasLayerProps) {
  const buttonGroup = getStartUiButtonGroup(layer, settings);
  const className = [
    "scene-start-ui-canvas-layer",
    layer.kind,
    isSelected ? "selected" : "",
    layer.locked ? "locked" : "",
    layer.sourceWidth ? "cropped" : "",
    buttonGroup ? "button-layer" : "",
    buttonGroup === hoveredButtonGroup ? "button-hovered" : "",
    buttonGroup === pressedButtonGroup ? "button-pressed" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      data-button-group={buttonGroup || undefined}
      className={className}
      style={{
        ...startUiLayerStyle(layer, designWidth, designHeight),
        ...startUiLayerEffectStyle(layer, settings, effectPointer, layerIndex),
      }}
      onPointerEnter={buttonGroup && isEffectsPreviewing ? () => onButtonGroupEnter(buttonGroup) : undefined}
      onPointerLeave={buttonGroup && isEffectsPreviewing ? () => onButtonGroupLeave(buttonGroup) : undefined}
      onPointerDown={event => {
        if (buttonGroup && isEffectsPreviewing) onButtonGroupPress(buttonGroup);
        if (!layer.locked) onStartLayerDrag(event, layer);
      }}
    >
      {isSelected && !layer.locked && (
        <span className="scene-start-ui-move-handle" aria-hidden="true">
          <Move size={13} />
        </span>
      )}
      <div className="scene-start-ui-layer-fx-entrance">
        <div className="scene-start-ui-layer-fx-interaction">
          <div
            className="scene-start-ui-layer-fx-artwork"
            style={layer.sourceWidth ? startUiLayerCropStyle(layer, designWidth, designHeight) : undefined}
          >
            <StartUiLayerArtwork layer={layer} />
          </div>
        </div>
      </div>
    </div>
  );
}
