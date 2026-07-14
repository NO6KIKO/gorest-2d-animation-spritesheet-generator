import { useEffect, useRef, useState, type PointerEvent } from "react";
import { getFrameSize, spriteFrame, spriteFrameTotal } from "../../../domain/sprites/spriteUtils";
import { resolveAnimationSceneSprite } from "../../../domain/scene/animationSceneModel";
import type { AnimationScene, AnimationSceneTimelineClip, GameAsset } from "../../../types";
import { clipIsActive, clipOpacityAtTime } from "../model/animationSceneEditor";

type AnimationSceneStageProps = {
  assets: GameAsset[];
  currentTimeMs: number;
  scene: AnimationScene;
  selectedClipId: string | null;
  onClipChange: (clipId: string, patch: Partial<AnimationSceneTimelineClip>) => void;
  onSelectClip: (clipId: string) => void;
};

export function AnimationSceneStage({
  assets,
  currentTimeMs,
  scene,
  selectedClipId,
  onClipChange,
  onSelectClip,
}: AnimationSceneStageProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: scene.width, height: scene.height });
  const assetById = new Map(assets.map(asset => [asset.id, asset]));
  const visibleTracks = [...scene.tracks]
    .filter(track => !track.muted)
    .sort((a, b) => a.zIndex - b.zIndex);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const resize = () => {
      const availableWidth = Math.max(1, shell.clientWidth - 32);
      const availableHeight = Math.max(1, shell.clientHeight - 32);
      const scale = Math.min(availableWidth / scene.width, availableHeight / scene.height);
      setStageSize({
        width: Math.max(1, scene.width * scale),
        height: Math.max(1, scene.height * scale),
      });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(shell);
    return () => observer.disconnect();
  }, [scene.height, scene.width]);

  const startSpriteDrag = (event: PointerEvent<HTMLButtonElement>, clip: AnimationSceneTimelineClip) => {
    const bounds = stageRef.current?.getBoundingClientRect();
    if (!bounds) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectClip(clip.id);
    const startClientX = event.clientX;
    const startClientY = event.clientY;
    const startX = clip.x || 0;
    const startY = clip.y || 0;
    const move = (moveEvent: globalThis.PointerEvent) => {
      onClipChange(clip.id, {
        x: startX + (moveEvent.clientX - startClientX) / Math.max(1, bounds.width) * scene.width,
        y: startY + (moveEvent.clientY - startClientY) / Math.max(1, bounds.height) * scene.height,
      });
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  return (
    <div ref={shellRef} className="animation-stage-shell">
      <div className="animation-stage-frame">
        <div
          ref={stageRef}
          className="animation-stage"
          style={{
            width: stageSize.width,
            height: stageSize.height,
            aspectRatio: `${scene.width} / ${scene.height}`,
            backgroundColor: scene.backgroundColor,
          }}
          onPointerDown={() => onSelectClip("")}
        >
          {visibleTracks.flatMap(track => track.clips.map(clip => {
            if (!clipIsActive(clip, currentTimeMs)) return null;
            const opacity = clipOpacityAtTime(clip, currentTimeMs);
            if (clip.kind === "background" && clip.imageUrl) {
              return (
                <button
                  key={clip.id}
                  type="button"
                  className={`animation-stage-background ${selectedClipId === clip.id ? "selected" : ""}`}
                  style={{ zIndex: track.zIndex, opacity }}
                  aria-label={`Select background clip ${clip.name}`}
                  onPointerDown={event => {
                    event.stopPropagation();
                    onSelectClip(clip.id);
                  }}
                >
                  <img alt="" draggable={false} src={clip.imageUrl} />
                </button>
              );
            }
            if (clip.kind !== "spritesheet") return null;
            const resolved = resolveAnimationSceneSprite(clip, assetById);
            if (!resolved) return null;
            const [frameWidth, frameHeight] = getFrameSize(resolved.sprite);
            const scale = clip.scale || 1;
            const width = frameWidth * scale;
            const height = frameHeight * scale;
            const localTimeMs = Math.max(0, currentTimeMs - clip.startMs + (clip.offsetMs || 0));
            const frameProgress = localTimeMs / 1000 * resolved.fps * (clip.playbackRate || 1);
            const frameTotal = Math.max(1, spriteFrameTotal(resolved.sprite));
            const frameIndex = clip.loop
              ? Math.floor(frameProgress) % frameTotal
              : Math.min(frameTotal - 1, Math.floor(frameProgress));
            return (
              <button
                key={clip.id}
                type="button"
                className={`animation-stage-sprite ${selectedClipId === clip.id ? "selected" : ""}`}
                style={{
                  left: `${(clip.x || 0) / scene.width * 100}%`,
                  top: `${((clip.y || 0) - height) / scene.height * 100}%`,
                  width: `${width / scene.width * 100}%`,
                  height: `${height / scene.height * 100}%`,
                  zIndex: track.zIndex,
                  opacity,
                }}
                aria-label={`Move sprite clip ${clip.name}`}
                onPointerDown={event => startSpriteDrag(event, clip)}
              >
                <span dangerouslySetInnerHTML={{ __html: spriteFrame(resolved.sprite, frameIndex) }} />
              </button>
            );
          }))}
          <div className="animation-stage-timecode">
            {(currentTimeMs / 1000).toFixed(2)} / {(scene.durationMs / 1000).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}
