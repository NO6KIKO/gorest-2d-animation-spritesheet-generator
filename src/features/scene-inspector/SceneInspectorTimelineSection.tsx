import { Film, Gamepad2 } from "lucide-react";
import {
  SCENE_PLAYBACK_MODE_LABELS,
  SCENE_TRANSITION_LABELS,
  sceneDurationLabel,
} from "../../domain/scene/sceneTimeline";
import type { SceneLayer, ScenePlaybackMode, SceneTimelineSettings, SceneTransitionType } from "../../types";

type SceneInspectorTimelineSectionProps = {
  playbackMode: ScenePlaybackMode;
  timeline: SceneTimelineSettings;
  visualLayers: SceneLayer[];
  onPlaybackModeChange: (mode: ScenePlaybackMode) => void;
  onTimelineChange: (patch: Partial<SceneTimelineSettings>) => void;
};

const transitionOptions = Object.entries(SCENE_TRANSITION_LABELS) as Array<[SceneTransitionType, string]>;

export function SceneInspectorTimelineSection({
  playbackMode,
  timeline,
  visualLayers,
  onPlaybackModeChange,
  onTimelineChange,
}: SceneInspectorTimelineSectionProps) {
  const durationSeconds = Math.round(timeline.durationMs / 100) / 10;
  const transitionSeconds = Math.round(timeline.transitionDurationMs / 100) / 10;

  return (
    <section className="compact-inspector-section scene-timeline-section">
      <em>Scene Type</em>
      <div className="scene-mode-toggle" role="group" aria-label="Scene type">
        <button
          type="button"
          className={playbackMode === "game" ? "active" : ""}
          onClick={() => onPlaybackModeChange("game")}
        >
          <Gamepad2 size={14} /> {SCENE_PLAYBACK_MODE_LABELS.game}
        </button>
        <button
          type="button"
          className={playbackMode === "animate" ? "active" : ""}
          onClick={() => onPlaybackModeChange("animate")}
        >
          <Film size={14} /> {SCENE_PLAYBACK_MODE_LABELS.animate}
        </button>
      </div>

      {playbackMode === "animate" && (
        <>
          <div className="compact-dual-fields">
            <label>
              Duration
              <input
                min={1}
                max={120}
                step={0.1}
                type="number"
                value={durationSeconds}
                onChange={event => onTimelineChange({ durationMs: secondsToMs(event.target.value, 5000) })}
              />
            </label>
            <label>
              Exit
              <input
                min={0}
                max={10}
                step={0.1}
                type="number"
                value={transitionSeconds}
                onChange={event => onTimelineChange({ transitionDurationMs: secondsToMs(event.target.value, 800) })}
              />
            </label>
          </div>

          <label>
            Transition
            <select
              value={timeline.transitionType}
              onChange={event => onTimelineChange({ transitionType: event.target.value as SceneTransitionType })}
            >
              {transitionOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            Primary Sprite
            <select
              value={timeline.primaryLayerId || ""}
              onChange={event => onTimelineChange({ primaryLayerId: event.target.value || undefined })}
            >
              <option value="">Auto</option>
              {visualLayers.map(layer => (
                <option key={layer.id} value={layer.id}>{layer.name}</option>
              ))}
            </select>
          </label>

          <div className="scene-timeline-summary">
            <span>{sceneDurationLabel(timeline.durationMs)}</span>
            <span>{SCENE_TRANSITION_LABELS[timeline.transitionType]}</span>
            <span>{sceneDurationLabel(timeline.transitionDurationMs)}</span>
          </div>
        </>
      )}
    </section>
  );
}

function secondsToMs(value: string, fallbackMs: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallbackMs;
  return Math.round(Math.max(0, parsed) * 1000);
}
