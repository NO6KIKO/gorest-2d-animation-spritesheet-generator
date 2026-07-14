import { Trash2 } from "lucide-react";
import type {
  AnimationScene,
  AnimationSceneEndBehavior,
  AnimationSceneSpriteSheetSource,
  AnimationSceneTimelineClip,
  AnimationSceneTrack,
} from "../../../types";

type SelectedTimelineClip = {
  track: AnimationSceneTrack;
  clip: AnimationSceneTimelineClip;
};

type AnimationSceneInspectorProps = {
  scene: AnimationScene;
  selected?: SelectedTimelineClip;
  onDeleteClip: (clipId: string) => void;
  onSceneChange: (patch: Partial<AnimationScene>) => void;
  onClipChange: (clipId: string, patch: Partial<AnimationSceneTimelineClip>) => void;
};

const END_BEHAVIOR_LABELS: Record<AnimationSceneEndBehavior, string> = {
  hold: "Hold final frame",
  loop: "Loop sequence",
  "follow-connection": "Follow node connection",
};

function seconds(value: number) {
  return Math.round(value / 100) / 10;
}

function secondsToMs(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 1000)) : fallback;
}

export function AnimationSceneInspector({
  scene,
  selected,
  onDeleteClip,
  onSceneChange,
  onClipChange,
}: AnimationSceneInspectorProps) {
  const clip = selected?.clip;
  const updateSpriteSheet = (patch: Partial<AnimationSceneSpriteSheetSource>) => {
    if (!clip?.spriteSheet) return;
    onClipChange(clip.id, { spriteSheet: { ...clip.spriteSheet, ...patch } });
  };
  return (
    <aside className="animation-inspector">
      <header>
        <span>{clip ? "Timeline Clip" : "Animation Scene"}</span>
        <strong>{clip?.name || scene.name}</strong>
      </header>

      {!clip && (
        <div className="animation-inspector-fields">
          <label>
            <span>Name</span>
            <input value={scene.name} onChange={event => onSceneChange({ name: event.target.value })} />
          </label>
          <div className="animation-inspector-grid">
            <label>
              <span>Duration</span>
              <input
                type="number"
                min="1"
                max="600"
                step="0.1"
                value={seconds(scene.durationMs)}
                onChange={event => onSceneChange({ durationMs: secondsToMs(event.target.value, scene.durationMs) })}
              />
            </label>
            <label>
              <span>Timeline FPS</span>
              <input type="number" min="1" max="60" value={scene.fps} onChange={event => onSceneChange({ fps: Number(event.target.value) })} />
            </label>
          </div>
          <div className="animation-inspector-grid">
            <label>
              <span>Width</span>
              <input type="number" min="240" value={scene.width} onChange={event => onSceneChange({ width: Number(event.target.value) })} />
            </label>
            <label>
              <span>Height</span>
              <input type="number" min="240" value={scene.height} onChange={event => onSceneChange({ height: Number(event.target.value) })} />
            </label>
          </div>
          <label>
            <span>End behavior</span>
            <select value={scene.endBehavior} onChange={event => onSceneChange({ endBehavior: event.target.value as AnimationSceneEndBehavior })}>
              {(Object.keys(END_BEHAVIOR_LABELS) as AnimationSceneEndBehavior[]).map(value => (
                <option key={value} value={value}>{END_BEHAVIOR_LABELS[value]}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Canvas color</span>
            <div className="animation-color-field">
              <input type="color" value={scene.backgroundColor} onChange={event => onSceneChange({ backgroundColor: event.target.value })} />
              <input value={scene.backgroundColor} onChange={event => onSceneChange({ backgroundColor: event.target.value })} />
            </div>
          </label>
        </div>
      )}

      {clip && (
        <div className="animation-inspector-fields">
          <div className="animation-clip-kind">{selected.track.name} / {clip.kind}</div>
          <label>
            <span>Clip name</span>
            <input value={clip.name} onChange={event => onClipChange(clip.id, { name: event.target.value })} />
          </label>
          <div className="animation-inspector-grid">
            <label>
              <span>Start</span>
              <input
                type="number"
                min="0"
                step="0.05"
                value={seconds(clip.startMs)}
                onChange={event => onClipChange(clip.id, { startMs: secondsToMs(event.target.value, clip.startMs) })}
              />
            </label>
            <label>
              <span>Duration</span>
              <input
                type="number"
                min="0.1"
                step="0.05"
                value={seconds(clip.durationMs)}
                onChange={event => onClipChange(clip.id, { durationMs: secondsToMs(event.target.value, clip.durationMs) })}
              />
            </label>
          </div>
          {clip.kind !== "event" && (
            <>
              <div className="animation-inspector-grid">
                <label>
                  <span>Fade in</span>
                  <input type="number" min="0" step="0.05" value={seconds(clip.fadeInMs || 0)} onChange={event => onClipChange(clip.id, { fadeInMs: secondsToMs(event.target.value, 0) })} />
                </label>
                <label>
                  <span>Fade out</span>
                  <input type="number" min="0" step="0.05" value={seconds(clip.fadeOutMs || 0)} onChange={event => onClipChange(clip.id, { fadeOutMs: secondsToMs(event.target.value, 0) })} />
                </label>
              </div>
              <label>
                <span>Opacity</span>
                <input type="range" min="0" max="1" step="0.01" value={clip.opacity ?? 1} onChange={event => onClipChange(clip.id, { opacity: Number(event.target.value) })} />
              </label>
            </>
          )}
          {clip.kind === "spritesheet" && (
            <>
              <div className="animation-inspector-grid">
                <label>
                  <span>X</span>
                  <input type="number" value={Math.round(clip.x || 0)} onChange={event => onClipChange(clip.id, { x: Number(event.target.value) })} />
                </label>
                <label>
                  <span>Y</span>
                  <input type="number" value={Math.round(clip.y || 0)} onChange={event => onClipChange(clip.id, { y: Number(event.target.value) })} />
                </label>
              </div>
              <div className="animation-inspector-grid">
                <label>
                  <span>Scale</span>
                  <input type="number" min="0.05" max="20" step="0.05" value={clip.scale || 1} onChange={event => onClipChange(clip.id, { scale: Number(event.target.value) })} />
                </label>
                <label>
                  <span>Sprite FPS</span>
                  <input type="number" min="1" max="60" value={clip.fps || 12} onChange={event => onClipChange(clip.id, { fps: Number(event.target.value) })} />
                </label>
              </div>
              {clip.spriteSheet && (
                <>
                  <div className="animation-repository-source">{clip.spriteSheet.imageUrl.split("/").pop()}</div>
                  <div className="animation-inspector-grid">
                    <label>
                      <span>Columns</span>
                      <input
                        type="number"
                        min="1"
                        max="256"
                        value={clip.spriteSheet.columns}
                        onChange={event => updateSpriteSheet({ columns: Number(event.target.value) })}
                      />
                    </label>
                    <label>
                      <span>Rows</span>
                      <input
                        type="number"
                        min="1"
                        max="256"
                        value={clip.spriteSheet.rows}
                        onChange={event => updateSpriteSheet({ rows: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                  <label>
                    <span>Active frames</span>
                    <input
                      type="number"
                      min="1"
                      max={clip.spriteSheet.columns * clip.spriteSheet.rows}
                      value={clip.spriteSheet.frameCount}
                      onChange={event => updateSpriteSheet({ frameCount: Number(event.target.value) })}
                    />
                  </label>
                </>
              )}
              <label className="animation-check-field">
                <input type="checkbox" checked={clip.loop ?? true} onChange={event => onClipChange(clip.id, { loop: event.target.checked })} />
                <span>Loop SpriteSheet frames inside this clip</span>
              </label>
            </>
          )}
          {clip.kind === "event" && (
            <label>
              <span>Event name</span>
              <input value={clip.eventName || ""} onChange={event => onClipChange(clip.id, { eventName: event.target.value })} />
            </label>
          )}
          <button type="button" className="animation-delete-clip" onClick={() => onDeleteClip(clip.id)}>
            <Trash2 size={15} /> Delete Clip
          </button>
        </div>
      )}
    </aside>
  );
}
