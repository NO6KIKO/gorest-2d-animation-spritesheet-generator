import { Save } from "lucide-react";
import type { MutableRefObject, PointerEvent as ReactPointerEvent } from "react";
import type { GameStartUiLayer, GameStartUiSettings } from "../../../types";
import { startUiLayerCropStyle, startUiLayerStyle } from "./startUiLayerStyles";

type StartUiWorkbenchProps = {
  designHeight: number;
  designWidth: number;
  draft: GameStartUiSettings;
  isProcessingArtwork: boolean;
  isSaving: boolean;
  selectedLayerId: string | null;
  stageRef: MutableRefObject<HTMLDivElement | null>;
  uiError: string | null;
  visibleLayers: GameStartUiLayer[];
  onFinishLayerDrag: () => void;
  onSave: (settings: GameStartUiSettings) => void | Promise<void>;
  onStartLayerDrag: (event: ReactPointerEvent<HTMLDivElement>, layer: GameStartUiLayer) => void;
  onUpdateLayerDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

function renderLayerArtwork(layer: GameStartUiLayer) {
  if (layer.imageUrl && !layer.sourceWidth) {
    return <img src={layer.imageUrl} alt="" draggable={false} />;
  }
  if (layer.label) {
    return <span className={`scene-start-ui-text-layer ${layer.kind}`}>{layer.label}</span>;
  }
  return null;
}

export function StartUiWorkbench({
  designHeight,
  designWidth,
  draft,
  isProcessingArtwork,
  isSaving,
  selectedLayerId,
  stageRef,
  uiError,
  visibleLayers,
  onFinishLayerDrag,
  onSave,
  onStartLayerDrag,
  onUpdateLayerDrag,
}: StartUiWorkbenchProps) {
  return (
    <section className="scene-start-ui-workbench">
      <div className="scene-start-ui-canvas-toolbar">
        <div>
          <strong>Start UI</strong>
          <span>{Math.round(designWidth)} x {Math.round(designHeight)}</span>
        </div>
        <button type="button" className="primary-button" onClick={() => void onSave(draft)} disabled={isSaving || isProcessingArtwork}>
          <Save size={15} /> {isSaving ? "Saving" : "Save Start UI"}
        </button>
      </div>

      <div className={`scene-start-ui-canvas-shell ${draft.theme}`}>
        <div
          ref={stageRef}
          className="scene-start-ui-design-stage"
          style={{ aspectRatio: `${designWidth} / ${designHeight}`, maxWidth: `${designWidth}px` }}
          onPointerMoveCapture={onUpdateLayerDrag}
          onPointerUpCapture={onFinishLayerDrag}
          onPointerCancelCapture={onFinishLayerDrag}
        >
          {visibleLayers.map(layer => (
            <div
              key={layer.id}
              className={`scene-start-ui-canvas-layer ${layer.kind} ${selectedLayerId === layer.id ? "selected" : ""} ${layer.locked ? "locked" : ""} ${layer.sourceWidth ? "cropped" : ""}`}
              style={{
                ...startUiLayerStyle(layer, designWidth, designHeight),
                ...(layer.sourceWidth ? startUiLayerCropStyle(layer, designWidth, designHeight) : {}),
              }}
              onPointerDown={event => onStartLayerDrag(event, layer)}
            >
              {renderLayerArtwork(layer)}
            </div>
          ))}
        </div>
      </div>
      {uiError && <div className="scene-start-ui-inline-error">{uiError}</div>}
    </section>
  );
}
