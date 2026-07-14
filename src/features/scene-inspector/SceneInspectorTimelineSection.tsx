import { Eye, Gamepad2 } from "lucide-react";
import { SCENE_TRANSITION_PRESETS } from "../../domain/scene/sceneTimeline";
import type { SceneLayer, ScenePlaybackMode, SceneTimelineSettings } from "../../types";

type SceneInspectorTimelineSectionProps = {
  playbackMode: ScenePlaybackMode;
  timeline: SceneTimelineSettings;
  visualLayers: SceneLayer[];
  onPlaybackModeChange: (mode: ScenePlaybackMode) => void;
  onPreviewTransition: () => void;
  onTimelineChange: (patch: Partial<SceneTimelineSettings>) => void;
};

export function SceneInspectorTimelineSection({
  playbackMode,
  timeline,
  visualLayers,
  onPlaybackModeChange,
  onPreviewTransition,
  onTimelineChange,
}: SceneInspectorTimelineSectionProps) {
  const durationSeconds = timeline.transitionDurationMs / 1000;

  return (
    <section className="compact-inspector-section scene-timeline-section">
      <em>Scene Type</em>
      <div className="scene-mode-toggle single" role="group" aria-label="Scene type">
        <button
          type="button"
          className="active"
          onClick={() => playbackMode !== "game" && onPlaybackModeChange("game")}
        >
          <Gamepad2 size={14} /> Game Scene
        </button>
      </div>

      <em>Transition Template</em>
      <div className="scene-transition-presets" role="group" aria-label="Scene transition template">
        {SCENE_TRANSITION_PRESETS.map(preset => (
          <button
            key={preset.type}
            type="button"
            className={timeline.transitionType === preset.type ? "active" : ""}
            title={preset.description}
            onClick={() => onTimelineChange({
              transitionType: preset.type,
              transitionDurationMs: preset.durationMs,
            })}
          >
            <strong>{preset.label}</strong>
            <span>{preset.durationMs ? `${preset.durationMs}ms` : "instant"}</span>
          </button>
        ))}
      </div>

      <label className="scene-transition-duration">
        <span>Duration</span>
        <input
          type="range"
          min="200"
          max="3000"
          step="50"
          value={Math.max(200, timeline.transitionDurationMs)}
          disabled={timeline.transitionType === "cut"}
          onChange={event => onTimelineChange({ transitionDurationMs: Number(event.target.value) })}
        />
        <b>{timeline.transitionType === "cut" ? "0s" : `${durationSeconds.toFixed(2)}s`}</b>
      </label>

      <button
        type="button"
        className="scene-transition-preview-button"
        disabled={timeline.transitionType === "cut"}
        onClick={onPreviewTransition}
      >
        <Eye size={14} /> Preview transition
      </button>
      <span className="scene-transition-layer-count">Applies when leaving this scene · {visualLayers.length} visual layers</span>
    </section>
  );
}
