import type { KeyboardEvent as ReactKeyboardEvent, MutableRefObject, PointerEvent as ReactPointerEvent } from "react";
import { DEFAULT_START_UI_EFFECTS } from "../../../domain/scene/startUiModel";
import type { GameStartUiLayer, GameStartUiSettings, StartUiRuntimeActionId } from "../../../types";
import { StartUiCanvasStage } from "./StartUiCanvasStage";
import { StartUiCanvasToolbar } from "./StartUiCanvasToolbar";
import { useStartUiEffectsPreview } from "./useStartUiEffectsPreview";
import { useStartUiRuntimePreview } from "./useStartUiRuntimePreview";

type StartUiWorkbenchProps = {
  designHeight: number;
  designWidth: number;
  draft: GameStartUiSettings;
  isProcessingArtwork: boolean;
  isSaving: boolean;
  selectedLayerId: string | null;
  stageRef: MutableRefObject<HTMLDivElement | null>;
  uiError: string | null;
  uiStatus: string | null;
  visibleLayers: GameStartUiLayer[];
  onFinishLayerDrag: () => void;
  onRunAction: (actionId: StartUiRuntimeActionId) => void | Promise<void>;
  onSave: (settings: GameStartUiSettings) => void | Promise<void>;
  onStartSelectedLayerDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onStartLayerDrag: (event: ReactPointerEvent<HTMLDivElement>, layer: GameStartUiLayer) => void;
  onStageKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onUpdateLayerDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export function StartUiWorkbench({
  designHeight,
  designWidth,
  draft,
  isProcessingArtwork,
  isSaving,
  selectedLayerId,
  stageRef,
  uiError,
  uiStatus,
  visibleLayers,
  onFinishLayerDrag,
  onRunAction,
  onSave,
  onStartSelectedLayerDrag,
  onStartLayerDrag,
  onStageKeyDown,
  onUpdateLayerDrag,
}: StartUiWorkbenchProps) {
  const effects = draft.effects || DEFAULT_START_UI_EFFECTS;
  const canDragSelectedLayer = visibleLayers.some(layer => layer.id === selectedLayerId && !layer.locked);
  const preview = useStartUiEffectsPreview({
    effects,
    onFinishLayerDrag,
    onUpdateLayerDrag,
  });
  const runtime = useStartUiRuntimePreview({
    onPreviewTransition: preview.previewTransition,
    onRunAction,
    settings: draft,
  });
  const toggleRuntimePreview = () => {
    if (!runtime.isRuntimePreviewing) preview.replayEntrance();
    runtime.toggleRuntimePreview();
  };

  return (
    <section className="scene-start-ui-workbench">
      <StartUiCanvasToolbar
        designHeight={designHeight}
        designWidth={designWidth}
        effects={effects}
        isEffectsPreviewing={preview.isEffectsPreviewing}
        isRuntimePreviewing={runtime.isRuntimePreviewing}
        isProcessingArtwork={isProcessingArtwork}
        isSaving={isSaving}
        onPreviewTransition={preview.previewTransition}
        onReplayEntrance={preview.replayEntrance}
        onSave={() => void onSave(draft)}
        onToggleEffectsPreview={preview.toggleEffectsPreview}
        onToggleRuntimePreview={toggleRuntimePreview}
      />

      <StartUiCanvasStage
        canDragSelectedLayer={canDragSelectedLayer && !runtime.isRuntimePreviewing}
        designHeight={designHeight}
        designWidth={designWidth}
        draft={draft}
        isRuntimePreviewing={runtime.isRuntimePreviewing}
        preview={preview}
        selectedLayerId={selectedLayerId}
        stageRef={stageRef}
        visibleLayers={visibleLayers}
        onStageKeyDown={onStageKeyDown}
        onButtonGroupActivate={runtime.activateButtonGroup}
        onStartLayerDrag={onStartLayerDrag}
        onStartSelectedLayerDrag={onStartSelectedLayerDrag}
      />

      {uiStatus && <div className="scene-start-ui-inline-status">{uiStatus}</div>}
      {uiError && <div className="scene-start-ui-inline-error">{uiError}</div>}
    </section>
  );
}
