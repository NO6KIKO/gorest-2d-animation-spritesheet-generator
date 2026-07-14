import {
  Flag,
  ImagePlus,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeAnimationScene } from "../../../domain/scene/animationSceneModel";
import type { AnimationScene, AnimationSceneTimelineClip, AnimationSceneTrack, GameAsset } from "../../../types";
import {
  addBackgroundTimelineClip,
  addEventTimelineClip,
  addRepositorySpriteTimelineClip,
  addSpriteTimelineClip,
  buildAnimationRepositorySpriteOptions,
  buildAnimationSpriteOptions,
  deleteAnimationTimelineClip,
  findAnimationTimelineClip,
  inferAnimationRepositorySpriteGrid,
  type AnimationRepositorySpriteSheetInput,
  type AnimationBackgroundOption,
  updateAnimationTimelineClip,
  updateAnimationTrack,
} from "../model/animationSceneEditor";
import { AnimationSceneInspector } from "./AnimationSceneInspector";
import { AnimationSceneStage } from "./AnimationSceneStage";
import { AnimationSceneTimeline } from "./AnimationSceneTimeline";

type AnimationSceneEditorProps = {
  assets: GameAsset[];
  backgroundOptions: AnimationBackgroundOption[];
  repositoryImages: Array<{ name: string; url: string }>;
  isSaving: boolean;
  runToken: number;
  scene: AnimationScene;
  onChange: (scene: AnimationScene) => void;
  onRunRequestConsumed: () => void;
  onRunComplete: (scene: AnimationScene) => void;
  onSave: () => void | Promise<void>;
};

function timecode(timeMs: number) {
  const totalSeconds = Math.max(0, timeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const hundredths = Math.floor((totalSeconds % 1) * 100);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}

export function AnimationSceneEditor({
  assets,
  backgroundOptions,
  repositoryImages,
  isSaving,
  runToken,
  scene,
  onChange,
  onRunRequestConsumed,
  onRunComplete,
  onSave,
}: AnimationSceneEditorProps) {
  const spriteOptions = useMemo(() => buildAnimationSpriteOptions(assets), [assets]);
  const repositorySpriteOptions = useMemo(
    () => buildAnimationRepositorySpriteOptions(repositoryImages),
    [repositoryImages],
  );
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedBackgroundId, setSelectedBackgroundId] = useState(backgroundOptions[0]?.id || "");
  const [selectedSpriteId, setSelectedSpriteId] = useState(spriteOptions[0]?.id || repositorySpriteOptions[0]?.id || "");
  const [repositorySpriteDraft, setRepositorySpriteDraft] = useState<(AnimationRepositorySpriteSheetInput & { sourceId: string }) | null>(null);
  const [repositorySpriteError, setRepositorySpriteError] = useState("");
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFlowRun, setIsFlowRun] = useState(false);
  const [zoom, setZoom] = useState(100);
  const playheadRef = useRef(currentTimeMs);
  const onRunCompleteRef = useRef(onRunComplete);
  const selected = findAnimationTimelineClip(scene, selectedClipId);
  const selectedLibrarySprite = spriteOptions.find(item => item.id === selectedSpriteId);
  const selectedRepositorySprite = repositorySpriteOptions.find(item => item.id === selectedSpriteId);
  const repositorySpriteReady = Boolean(
    selectedRepositorySprite
    && repositorySpriteDraft?.sourceId === selectedRepositorySprite.id,
  );
  const spriteInsertDisabled = selectedRepositorySprite ? !repositorySpriteReady : !selectedLibrarySprite;

  useEffect(() => {
    playheadRef.current = currentTimeMs;
  }, [currentTimeMs]);

  useEffect(() => {
    onRunCompleteRef.current = onRunComplete;
  }, [onRunComplete]);

  useEffect(() => {
    setCurrentTimeMs(0);
    setIsPlaying(false);
    setIsFlowRun(false);
    setSelectedClipId(null);
  }, [scene.id]);

  useEffect(() => {
    if (!selectedBackgroundId && backgroundOptions[0]) setSelectedBackgroundId(backgroundOptions[0].id);
  }, [backgroundOptions, selectedBackgroundId]);

  useEffect(() => {
    if (!selectedSpriteId) {
      setSelectedSpriteId(spriteOptions[0]?.id || repositorySpriteOptions[0]?.id || "");
    }
  }, [repositorySpriteOptions, selectedSpriteId, spriteOptions]);

  useEffect(() => {
    if (!selectedRepositorySprite) {
      setRepositorySpriteDraft(null);
      setRepositorySpriteError("");
      return;
    }
    let cancelled = false;
    setRepositorySpriteDraft(null);
    setRepositorySpriteError("");
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const grid = inferAnimationRepositorySpriteGrid(
        selectedRepositorySprite.fileName,
        image.naturalWidth,
        image.naturalHeight,
      );
      setRepositorySpriteDraft({
        sourceId: selectedRepositorySprite.id,
        label: selectedRepositorySprite.fileName.replace(/\.[^.]+$/, ""),
        imageUrl: selectedRepositorySprite.imageUrl,
        sheetWidth: image.naturalWidth,
        sheetHeight: image.naturalHeight,
        columns: grid.columns,
        rows: grid.rows,
        frameCount: grid.frameCount,
        fps: /idle/i.test(selectedRepositorySprite.fileName) ? 6 : /walk|move|run/i.test(selectedRepositorySprite.fileName) ? 10 : 12,
      });
    };
    image.onerror = () => {
      if (!cancelled) setRepositorySpriteError("Cannot read SpriteSheet");
    };
    image.src = selectedRepositorySprite.imageUrl;
    return () => {
      cancelled = true;
    };
  }, [selectedRepositorySprite]);

  useEffect(() => {
    if (runToken <= 0) return;
    setCurrentTimeMs(0);
    setIsFlowRun(true);
    setIsPlaying(true);
    onRunRequestConsumed();
  }, [onRunRequestConsumed, runToken]);

  useEffect(() => {
    if (!isPlaying) return;
    let animationFrame = 0;
    let cycleStart = performance.now();
    let cycleOffset = playheadRef.current;
    const tick = (now: number) => {
      const nextTime = cycleOffset + now - cycleStart;
      if (nextTime >= scene.durationMs) {
        if (scene.endBehavior === "loop") {
          cycleStart = now;
          cycleOffset = 0;
          setCurrentTimeMs(0);
          animationFrame = requestAnimationFrame(tick);
          return;
        }
        setCurrentTimeMs(Math.max(0, scene.durationMs - 1));
        setIsPlaying(false);
        if (isFlowRun && scene.endBehavior === "follow-connection") {
          onRunCompleteRef.current(scene);
        }
        setIsFlowRun(false);
        return;
      }
      setCurrentTimeMs(nextTime);
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [isFlowRun, isPlaying, scene]);

  const setPlayhead = (timeMs: number) => {
    setIsPlaying(false);
    setIsFlowRun(false);
    setCurrentTimeMs(Math.max(0, Math.min(scene.durationMs, timeMs)));
  };

  const changeScene = (patch: Partial<AnimationScene>) => {
    onChange(normalizeAnimationScene({ ...scene, ...patch }));
  };

  const changeClip = (clipId: string, patch: Partial<AnimationSceneTimelineClip>) => {
    onChange(updateAnimationTimelineClip(scene, clipId, patch));
  };

  const changeTrack = (trackId: string, patch: Partial<AnimationSceneTrack>) => {
    onChange(updateAnimationTrack(scene, trackId, patch));
  };

  const deleteClip = (clipId: string) => {
    onChange(deleteAnimationTimelineClip(scene, clipId));
    setSelectedClipId(null);
  };

  const insertBackground = () => {
    const option = backgroundOptions.find(item => item.id === selectedBackgroundId);
    if (!option) return;
    const result = addBackgroundTimelineClip(scene, option, Math.min(currentTimeMs, scene.durationMs - 100));
    onChange(result.scene);
    setSelectedClipId(result.clipId);
  };

  const insertSprite = (forceNewTrack = false) => {
    const preferredTrackId = !forceNewTrack && selected?.track.kind === "sprite"
      ? selected.track.id
      : undefined;
    const startMs = Math.max(0, Math.min(currentTimeMs, scene.durationMs - 100));
    let result: ReturnType<typeof addSpriteTimelineClip>;
    let shouldPreview = false;
    if (selectedRepositorySprite) {
      if (!repositorySpriteDraft || repositorySpriteDraft.sourceId !== selectedRepositorySprite.id) return;
      result = addRepositorySpriteTimelineClip(scene, repositorySpriteDraft, startMs, preferredTrackId);
      shouldPreview = repositorySpriteDraft.frameCount > 1;
    } else {
      if (!selectedLibrarySprite) return;
      const asset = assets.find(item => item.id === selectedLibrarySprite.assetId);
      if (!asset) return;
      result = addSpriteTimelineClip(scene, selectedLibrarySprite, asset, startMs, preferredTrackId);
      shouldPreview = !selectedLibrarySprite.isStatic;
    }
    onChange(result.scene);
    setSelectedClipId(result.clipId);
    setCurrentTimeMs(startMs);
    setIsFlowRun(false);
    setIsPlaying(shouldPreview);
  };

  const insertEvent = () => {
    const result = addEventTimelineClip(scene, Math.min(currentTimeMs, scene.durationMs - 100));
    onChange(result.scene);
    setSelectedClipId(result.clipId);
  };

  const startFlowRun = () => {
    setCurrentTimeMs(0);
    setIsFlowRun(true);
    setIsPlaying(true);
  };

  return (
    <div className="animation-scene-editor">
      <div className="animation-editor-topbar">
        <div className="animation-playback-controls" role="group" aria-label="Animation playback">
          <button type="button" title="Return to start" aria-label="Return to start" onClick={() => setPlayhead(0)}>
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            className={isPlaying && !isFlowRun ? "active" : ""}
            title={isPlaying ? "Pause" : "Play"}
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={() => {
              if (currentTimeMs >= scene.durationMs) setCurrentTimeMs(0);
              setIsFlowRun(false);
              setIsPlaying(value => !value);
            }}
          >
            {isPlaying && !isFlowRun ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button type="button" className={isFlowRun ? "active flow" : ""} onClick={startFlowRun}>
            <Play size={15} /> Run Flow
          </button>
          <span className="animation-timecode">{timecode(currentTimeMs)}</span>
        </div>

        <button type="button" className="animation-save-button" onClick={() => void onSave()} disabled={isSaving}>
          <Save size={15} /> {isSaving ? "Saving" : "Save Animation"}
        </button>
      </div>

      <div className="animation-editor-body">
        <AnimationSceneStage
          assets={assets}
          currentTimeMs={currentTimeMs}
          scene={scene}
          selectedClipId={selectedClipId}
          onClipChange={changeClip}
          onSelectClip={clipId => setSelectedClipId(clipId || null)}
        />
        <AnimationSceneInspector
          scene={scene}
          selected={selected}
          onDeleteClip={deleteClip}
          onSceneChange={changeScene}
          onClipChange={changeClip}
        />
      </div>

      <div className="animation-editor-timeline">
        <div className="animation-timeline-toolbar">
          <div className="animation-timeline-meta">
            <strong>{scene.name}</strong>
            <span>{scene.tracks.length} tracks / {scene.tracks.reduce((count, track) => count + track.clips.length, 0)} clips</span>
          </div>
          <div className="animation-insert-tools" aria-label="Insert timeline clips">
            <div className="animation-insert-control">
              <select aria-label="Background source" value={selectedBackgroundId} onChange={event => setSelectedBackgroundId(event.target.value)}>
                {backgroundOptions.length
                  ? backgroundOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)
                  : <option value="">No backgrounds</option>}
              </select>
              <button type="button" title={`Insert background at ${(currentTimeMs / 1000).toFixed(2)}s`} onClick={insertBackground} disabled={!selectedBackgroundId}>
                <ImagePlus size={15} /> Background
              </button>
            </div>
            <div className="animation-insert-control sprite-insert-control">
              <select aria-label="SpriteSheet source" value={selectedSpriteId} onChange={event => setSelectedSpriteId(event.target.value)}>
                {spriteOptions.length > 0 && (
                  <optgroup label="Game Library">
                    {spriteOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </optgroup>
                )}
                {repositorySpriteOptions.length > 0 && (
                  <optgroup label="Repository SpriteSheets">
                    {repositorySpriteOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </optgroup>
                )}
                {!spriteOptions.length && !repositorySpriteOptions.length && <option value="">No SpriteSheets</option>}
              </select>
              {selectedRepositorySprite && repositorySpriteDraft && (
                <div className="animation-repository-sheet-settings" aria-label="Repository SpriteSheet grid">
                  <label title="Columns">
                    <span>C</span>
                    <input
                      aria-label="SpriteSheet columns"
                      type="number"
                      min="1"
                      max="256"
                      value={repositorySpriteDraft.columns}
                      onChange={event => setRepositorySpriteDraft(current => current
                        ? { ...current, columns: Math.max(1, Number(event.target.value)) }
                        : current)}
                    />
                  </label>
                  <label title="Rows">
                    <span>R</span>
                    <input
                      aria-label="SpriteSheet rows"
                      type="number"
                      min="1"
                      max="256"
                      value={repositorySpriteDraft.rows}
                      onChange={event => setRepositorySpriteDraft(current => current
                        ? { ...current, rows: Math.max(1, Number(event.target.value)) }
                        : current)}
                    />
                  </label>
                  <label title="Active frames">
                    <span>F</span>
                    <input
                      aria-label="SpriteSheet frame count"
                      type="number"
                      min="1"
                      max={repositorySpriteDraft.columns * repositorySpriteDraft.rows}
                      value={repositorySpriteDraft.frameCount}
                      onChange={event => setRepositorySpriteDraft(current => current
                        ? {
                            ...current,
                            frameCount: Math.max(1, Math.min(current.columns * current.rows, Number(event.target.value))),
                          }
                        : current)}
                    />
                  </label>
                  <label title="Frames per second">
                    <span>FPS</span>
                    <input
                      aria-label="Repository SpriteSheet FPS"
                      type="number"
                      min="1"
                      max="60"
                      value={repositorySpriteDraft.fps}
                      onChange={event => setRepositorySpriteDraft(current => current
                        ? { ...current, fps: Math.max(1, Math.min(60, Number(event.target.value))) }
                        : current)}
                    />
                  </label>
                </div>
              )}
              {selectedRepositorySprite && !repositorySpriteDraft && (
                <span className="animation-repository-sheet-status">{repositorySpriteError || "Reading grid..."}</span>
              )}
              <button
                type="button"
                title={selected?.track.kind === "sprite" ? `Insert into ${selected.track.name}` : "Insert SpriteSheet on a new track"}
                onClick={() => insertSprite(false)}
                disabled={spriteInsertDisabled}
              >
                <Sparkles size={15} /> Sprite
              </button>
              <button
                type="button"
                className="animation-new-track-button"
                title="Insert SpriteSheet on a new track"
                aria-label="Insert SpriteSheet on a new track"
                onClick={() => insertSprite(true)}
                disabled={spriteInsertDisabled}
              >
                <Layers size={15} />
              </button>
            </div>
            <button type="button" title={`Insert event at ${(currentTimeMs / 1000).toFixed(2)}s`} onClick={insertEvent}>
              <Flag size={15} /> Event
            </button>
            <span className="animation-insert-target">
              {(currentTimeMs / 1000).toFixed(2)}s / {selected?.track.kind === "sprite" ? selected.track.name : "new sprite track"}
              {repositorySpriteDraft && selectedRepositorySprite
                ? ` / ${repositorySpriteDraft.columns}x${repositorySpriteDraft.rows} / ${repositorySpriteDraft.frameCount}f`
                : selectedLibrarySprite?.isStatic ? " / static frames" : ""}
            </span>
          </div>
          <label className="animation-zoom-control">
            Zoom
            <input type="range" min="50" max="220" step="10" value={zoom} onChange={event => setZoom(Number(event.target.value))} />
          </label>
        </div>
        <AnimationSceneTimeline
          currentTimeMs={currentTimeMs}
          scene={scene}
          selectedClipId={selectedClipId}
          zoom={zoom}
          onClipChange={changeClip}
          onCurrentTimeChange={setPlayhead}
          onSelectClip={setSelectedClipId}
          onTrackChange={changeTrack}
        />
      </div>
    </div>
  );
}
