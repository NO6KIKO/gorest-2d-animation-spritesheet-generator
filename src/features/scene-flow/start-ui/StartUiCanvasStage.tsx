import type {
  KeyboardEvent as ReactKeyboardEvent,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
} from "react";
import { DEFAULT_START_UI_EFFECTS } from "../../../domain/scene/startUiModel";
import type { GameStartUiLayer, GameStartUiSettings } from "../../../types";
import { StartUiCanvasLayer } from "./StartUiCanvasLayer";
import { StartUiEffectOverlays } from "./StartUiEffectOverlays";
import {
  CENTERED_START_UI_EFFECT_POINTER,
  startUiStageEffectClassName,
  startUiStageEffectStyle,
} from "./startUiEffectsModel";
import type { StartUiEffectsPreviewController } from "./useStartUiEffectsPreview";

type StartUiCanvasStageProps = {
  canDragSelectedLayer: boolean;
  designHeight: number;
  designWidth: number;
  draft: GameStartUiSettings;
  preview: StartUiEffectsPreviewController;
  selectedLayerId: string | null;
  stageRef: MutableRefObject<HTMLDivElement | null>;
  visibleLayers: GameStartUiLayer[];
  onStageKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onStartLayerDrag: (event: ReactPointerEvent<HTMLDivElement>, layer: GameStartUiLayer) => void;
  onStartSelectedLayerDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export function StartUiCanvasStage({
  canDragSelectedLayer,
  designHeight,
  designWidth,
  draft,
  preview,
  selectedLayerId,
  stageRef,
  visibleLayers,
  onStageKeyDown,
  onStartLayerDrag,
  onStartSelectedLayerDrag,
}: StartUiCanvasStageProps) {
  const effects = draft.effects || DEFAULT_START_UI_EFFECTS;
  const effectPointer = preview.isEffectsPreviewing
    ? preview.effectPointer
    : CENTERED_START_UI_EFFECT_POINTER;

  return (
    <div className={`scene-start-ui-canvas-shell ${draft.theme}`}>
      <div
        ref={stageRef}
        className={startUiStageEffectClassName(effects, preview.isEffectsPreviewing, canDragSelectedLayer)}
        style={{
          aspectRatio: `${designWidth} / ${designHeight}`,
          maxWidth: `${designWidth}px`,
          ...startUiStageEffectStyle(effects),
        }}
        tabIndex={0}
        onKeyDown={onStageKeyDown}
        onPointerDown={onStartSelectedLayerDrag}
        onPointerMoveCapture={preview.handleStagePointerMove}
        onPointerUpCapture={preview.finishPointerInteraction}
        onPointerCancelCapture={preview.finishPointerInteraction}
        onPointerLeave={preview.leaveStage}
      >
        {visibleLayers.map((layer, layerIndex) => (
          <StartUiCanvasLayer
            key={`${layer.id}-${preview.isEffectsPreviewing ? preview.entrancePreviewCycle : "still"}`}
            designHeight={designHeight}
            designWidth={designWidth}
            effectPointer={effectPointer}
            hoveredButtonGroup={preview.hoveredButtonGroup}
            isEffectsPreviewing={preview.isEffectsPreviewing}
            isSelected={selectedLayerId === layer.id}
            layer={layer}
            layerIndex={layerIndex}
            pressedButtonGroup={preview.pressedButtonGroup}
            settings={draft}
            onButtonGroupEnter={preview.setHoveredButtonGroup}
            onButtonGroupLeave={preview.leaveButtonGroup}
            onButtonGroupPress={preview.setPressedButtonGroup}
            onStartLayerDrag={onStartLayerDrag}
          />
        ))}

        <StartUiEffectOverlays
          effects={effects}
          isEffectsPreviewing={preview.isEffectsPreviewing}
          transitionPreviewCycle={preview.transitionPreviewCycle}
        />
      </div>
    </div>
  );
}
