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
  isRuntimeButtonTarget: boolean;
  isRuntimePreviewing: boolean;
  isSelected: boolean;
  layer: GameStartUiLayer;
  layerIndex: number;
  pressedButtonGroup: string | null;
  settings: GameStartUiSettings;
  onButtonGroupActivate: (group: string) => void;
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
  isRuntimeButtonTarget,
  isRuntimePreviewing,
  isSelected,
  layer,
  layerIndex,
  pressedButtonGroup,
  settings,
  onButtonGroupActivate,
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
    buttonGroup && isRuntimePreviewing
      ? isRuntimeButtonTarget ? "runtime-button-target" : "runtime-button-decoration"
      : "",
    buttonGroup === hoveredButtonGroup ? "button-hovered" : "",
    buttonGroup === pressedButtonGroup ? "button-pressed" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      data-button-group={buttonGroup || undefined}
      role={buttonGroup && isRuntimePreviewing && isRuntimeButtonTarget ? "button" : undefined}
      tabIndex={buttonGroup && isRuntimePreviewing && isRuntimeButtonTarget ? 0 : undefined}
      aria-label={buttonGroup && isRuntimePreviewing && isRuntimeButtonTarget ? layer.label || layer.name : undefined}
      className={className}
      style={{
        ...startUiLayerStyle(layer, designWidth, designHeight),
        ...startUiLayerEffectStyle(layer, settings, effectPointer, layerIndex),
      }}
      onPointerEnter={buttonGroup && (isEffectsPreviewing || isRuntimePreviewing) ? () => onButtonGroupEnter(buttonGroup) : undefined}
      onPointerLeave={buttonGroup && (isEffectsPreviewing || isRuntimePreviewing) ? () => onButtonGroupLeave(buttonGroup) : undefined}
      onPointerDown={event => {
        if (buttonGroup && (isEffectsPreviewing || isRuntimePreviewing)) onButtonGroupPress(buttonGroup);
        if (buttonGroup && isRuntimePreviewing && isRuntimeButtonTarget) {
          event.stopPropagation();
          return;
        }
        if (!layer.locked) onStartLayerDrag(event, layer);
      }}
      onClick={buttonGroup && isRuntimePreviewing && isRuntimeButtonTarget ? event => {
        event.stopPropagation();
        onButtonGroupActivate(buttonGroup);
      } : undefined}
      onKeyDown={buttonGroup && isRuntimePreviewing && isRuntimeButtonTarget ? event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        onButtonGroupActivate(buttonGroup);
      } : undefined}
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
