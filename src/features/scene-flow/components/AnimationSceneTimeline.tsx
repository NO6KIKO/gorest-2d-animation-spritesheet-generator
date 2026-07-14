import { Eye, EyeOff, Lock, Unlock } from "lucide-react";
import { type PointerEvent } from "react";
import { MIN_TIMELINE_CLIP_DURATION_MS } from "../../../domain/scene/animationSceneModel";
import type { AnimationScene, AnimationSceneTimelineClip, AnimationSceneTrack } from "../../../types";

type ClipDragMode = "move" | "trim-start" | "trim-end";

type AnimationSceneTimelineProps = {
  currentTimeMs: number;
  scene: AnimationScene;
  selectedClipId: string | null;
  zoom: number;
  onClipChange: (clipId: string, patch: Partial<AnimationSceneTimelineClip>) => void;
  onCurrentTimeChange: (timeMs: number) => void;
  onSelectClip: (clipId: string) => void;
  onTrackChange: (trackId: string, patch: Partial<AnimationSceneTrack>) => void;
};

const LABEL_WIDTH = 154;

function snapTime(value: number, fps: number) {
  const frameMs = 1000 / Math.max(1, fps);
  return Math.round(value / frameMs) * frameMs;
}

function clipClassName(clip: AnimationSceneTimelineClip, selected: boolean) {
  return ["animation-timeline-clip", clip.kind, selected ? "selected" : ""].filter(Boolean).join(" ");
}

export function AnimationSceneTimeline({
  currentTimeMs,
  scene,
  selectedClipId,
  zoom,
  onClipChange,
  onCurrentTimeChange,
  onSelectClip,
  onTrackChange,
}: AnimationSceneTimelineProps) {
  const contentWidth = Math.max(760, scene.durationMs / 1000 * zoom);
  const pixelsPerMs = contentWidth / Math.max(1, scene.durationMs);
  const tickStepSeconds = scene.durationMs > 60000 ? 10 : scene.durationMs > 20000 ? 5 : 1;
  const tickCount = Math.ceil(scene.durationMs / 1000 / tickStepSeconds);
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => index * tickStepSeconds * 1000)
    .filter(timeMs => timeMs <= scene.durationMs);

  const seekFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".animation-timeline-clip")) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const timeMs = (event.clientX - bounds.left) / Math.max(1, bounds.width) * scene.durationMs;
    onCurrentTimeChange(Math.max(0, Math.min(scene.durationMs, snapTime(timeMs, scene.fps))));
  };

  const startClipDrag = (
    event: PointerEvent<HTMLElement>,
    track: AnimationSceneTrack,
    clip: AnimationSceneTimelineClip,
    mode: ClipDragMode,
  ) => {
    if (track.locked) return;
    event.preventDefault();
    event.stopPropagation();
    const pointerTarget = event.currentTarget;
    pointerTarget.setPointerCapture?.(event.pointerId);
    onSelectClip(clip.id);
    const startClientX = event.clientX;
    const startMs = clip.startMs;
    const startDurationMs = clip.durationMs;
    const startOffsetMs = clip.offsetMs || 0;
    const clipEndMs = startMs + startDurationMs;
    const move = (moveEvent: globalThis.PointerEvent) => {
      const deltaMs = snapTime((moveEvent.clientX - startClientX) / Math.max(0.001, pixelsPerMs), scene.fps);
      if (mode === "move") {
        const nextStart = Math.max(0, startMs + deltaMs);
        onClipChange(clip.id, { startMs: Math.round(nextStart) });
        return;
      }
      if (mode === "trim-start") {
        const nextStart = Math.max(0, Math.min(clipEndMs - MIN_TIMELINE_CLIP_DURATION_MS, startMs + deltaMs));
        onClipChange(clip.id, {
          startMs: Math.round(nextStart),
          durationMs: Math.round(clipEndMs - nextStart),
          offsetMs: Math.max(0, Math.round(startOffsetMs + nextStart - startMs)),
        });
        return;
      }
      const nextDuration = Math.max(
        MIN_TIMELINE_CLIP_DURATION_MS,
        startDurationMs + deltaMs,
      );
      onClipChange(clip.id, { durationMs: Math.round(nextDuration) });
    };
    const finish = (finishEvent?: globalThis.PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      if (finishEvent && pointerTarget.hasPointerCapture?.(finishEvent.pointerId)) {
        pointerTarget.releasePointerCapture?.(finishEvent.pointerId);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  return (
    <div className="animation-timeline-scroller">
      <div className="animation-timeline-grid" style={{ width: LABEL_WIDTH + contentWidth }}>
        <div className="animation-timeline-corner">Tracks</div>
        <div className="animation-timeline-ruler" style={{ width: contentWidth }} onPointerDown={seekFromPointer}>
          {ticks.map(timeMs => (
            <span key={timeMs} style={{ left: timeMs * pixelsPerMs }}>
              <i />
              {(timeMs / 1000).toFixed(0)}s
            </span>
          ))}
        </div>

        {scene.tracks.map(track => (
          <div className="animation-timeline-row" key={track.id}>
            <div className="animation-track-label">
              <div>
                <strong>{track.name}</strong>
                <span>{track.kind}</span>
              </div>
              <button
                type="button"
                title={track.muted ? "Show track" : "Hide track"}
                aria-label={track.muted ? "Show track" : "Hide track"}
                onClick={() => onTrackChange(track.id, { muted: !track.muted })}
              >
                {track.muted ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button
                type="button"
                title={track.locked ? "Unlock track" : "Lock track"}
                aria-label={track.locked ? "Unlock track" : "Lock track"}
                onClick={() => onTrackChange(track.id, { locked: !track.locked })}
              >
                {track.locked ? <Lock size={13} /> : <Unlock size={13} />}
              </button>
            </div>
            <div
              className={`animation-timeline-lane ${track.kind} ${track.muted ? "muted" : ""}`}
              style={{ width: contentWidth }}
              onPointerDown={seekFromPointer}
            >
              {track.clips.map(clip => (
                <button
                  key={clip.id}
                  type="button"
                  className={clipClassName(clip, selectedClipId === clip.id)}
                  style={{
                    left: clip.startMs * pixelsPerMs,
                    width: Math.max(18, clip.durationMs * pixelsPerMs),
                  }}
                  title={`${clip.name} / ${(clip.durationMs / 1000).toFixed(2)}s`}
                  onPointerDown={event => startClipDrag(event, track, clip, "move")}
                  onClick={event => {
                    event.stopPropagation();
                    onSelectClip(clip.id);
                  }}
                >
                  <i className="clip-trim-handle start" onPointerDown={event => startClipDrag(event, track, clip, "trim-start")} />
                  <span>{clip.name}</span>
                  <small>{(clip.durationMs / 1000).toFixed(1)}s</small>
                  <i className="clip-trim-handle end" onPointerDown={event => startClipDrag(event, track, clip, "trim-end")} />
                </button>
              ))}
            </div>
          </div>
        ))}

        <div
          className="animation-timeline-playhead"
          style={{ left: LABEL_WIDTH + currentTimeMs * pixelsPerMs }}
          aria-hidden="true"
        >
          <span />
        </div>
      </div>
    </div>
  );
}
