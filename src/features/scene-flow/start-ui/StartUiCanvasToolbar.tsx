import { Eye, EyeOff, MousePointerClick, Play, RotateCcw, Save, Square } from "lucide-react";
import type { GameStartUiEffects } from "../../../types";

type StartUiCanvasToolbarProps = {
  designHeight: number;
  designWidth: number;
  effects: GameStartUiEffects;
  isEffectsPreviewing: boolean;
  isRuntimePreviewing: boolean;
  isProcessingArtwork: boolean;
  isSaving: boolean;
  onPreviewTransition: () => void;
  onReplayEntrance: () => void;
  onSave: () => void;
  onToggleEffectsPreview: () => void;
  onToggleRuntimePreview: () => void;
};

export function StartUiCanvasToolbar({
  designHeight,
  designWidth,
  effects,
  isEffectsPreviewing,
  isRuntimePreviewing,
  isProcessingArtwork,
  isSaving,
  onPreviewTransition,
  onReplayEntrance,
  onSave,
  onToggleEffectsPreview,
  onToggleRuntimePreview,
}: StartUiCanvasToolbarProps) {
  return (
    <div className="scene-start-ui-canvas-toolbar">
      <div className="scene-start-ui-canvas-meta">
        <strong>Start UI</strong>
        <span>{Math.round(designWidth)} x {Math.round(designHeight)}</span>
      </div>
      <div className="scene-start-ui-toolbar-actions">
        <div className="scene-start-ui-preview-controls" role="group" aria-label="Preview controls">
          <button
            type="button"
            className={`ghost-button scene-start-ui-runtime-toggle ${isRuntimePreviewing ? "active" : ""}`}
            title={isRuntimePreviewing ? "Stop UI runtime" : "Run UI"}
            aria-pressed={isRuntimePreviewing}
            onClick={onToggleRuntimePreview}
          >
            {isRuntimePreviewing ? <Square size={14} /> : <MousePointerClick size={15} />}
            {isRuntimePreviewing ? "Stop" : "Run UI"}
          </button>
          <button
            type="button"
            className={`ghost-button scene-start-ui-preview-toggle ${isEffectsPreviewing ? "active" : ""}`}
            title={isEffectsPreviewing ? "Pause effect preview" : "Preview effects"}
            disabled={!effects.enabled}
            onClick={onToggleEffectsPreview}
          >
            {isEffectsPreviewing ? <Eye size={15} /> : <EyeOff size={15} />}
            Effects
          </button>
          <button
            type="button"
            className="ghost-button icon-button"
            aria-label="Replay entrance"
            title="Replay entrance"
            disabled={!isEffectsPreviewing || effects.entranceEffect === "none"}
            onClick={onReplayEntrance}
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            className="ghost-button scene-start-ui-exit-preview"
            title="Preview exit transition"
            disabled={!isEffectsPreviewing || effects.transitionEffect === "none"}
            onClick={onPreviewTransition}
          >
            <Play size={15} /> Exit
          </button>
        </div>
        <button type="button" className="primary-button" onClick={onSave} disabled={isSaving || isProcessingArtwork}>
          <Save size={15} /> {isSaving ? "Saving" : "Save Start UI"}
        </button>
      </div>
    </div>
  );
}
