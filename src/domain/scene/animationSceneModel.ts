import type {
  AnimationScene,
  AnimationSceneClipKind,
  AnimationSceneEndBehavior,
  AnimationSceneSpriteSheetSource,
  AnimationSceneTimelineClip,
  AnimationSceneTrack,
  AnimationSceneTrackKind,
  AnimationSprite,
  GameAsset,
  GameScene,
} from "../../types";
import { buildSpritesheetFrames } from "../sprites/spriteUtils";

export const DEFAULT_ANIMATION_SCENE_DURATION_MS = 5000;
export const DEFAULT_ANIMATION_SCENE_WIDTH = 1280;
export const DEFAULT_ANIMATION_SCENE_HEIGHT = 720;
export const MIN_TIMELINE_CLIP_DURATION_MS = 100;

const TRACK_KINDS: AnimationSceneTrackKind[] = ["background", "sprite", "event"];
const CLIP_KINDS: AnimationSceneClipKind[] = ["background", "spritesheet", "event"];
const END_BEHAVIORS: AnimationSceneEndBehavior[] = ["hold", "loop", "follow-connection"];
const repositorySpriteCache = new Map<string, AnimationSprite>();

function finiteNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  return Math.min(max, Math.max(min, finiteNumber(value, fallback)));
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeSpriteSheetSource(source?: Partial<AnimationSceneSpriteSheetSource>) {
  const imageUrl = source?.imageUrl?.trim();
  if (!imageUrl) return undefined;
  const columns = Math.round(boundedNumber(source?.columns, 1, 1, 256));
  const rows = Math.round(boundedNumber(source?.rows, 1, 1, 256));
  return {
    imageUrl,
    sheetWidth: boundedNumber(source?.sheetWidth, columns, 1, 32768),
    sheetHeight: boundedNumber(source?.sheetHeight, rows, 1, 32768),
    columns,
    rows,
    frameCount: Math.round(boundedNumber(source?.frameCount, columns * rows, 1, columns * rows)),
  } satisfies AnimationSceneSpriteSheetSource;
}

function normalizeTimelineClip(
  clip: Partial<AnimationSceneTimelineClip>,
  trackKind: AnimationSceneTrackKind,
  index: number,
): AnimationSceneTimelineClip {
  const fallbackKind: AnimationSceneClipKind = trackKind === "sprite"
    ? "spritesheet"
    : trackKind === "event" ? "event" : "background";
  const kind = CLIP_KINDS.includes(clip.kind as AnimationSceneClipKind)
    ? clip.kind as AnimationSceneClipKind
    : fallbackKind;
  return {
    id: clip.id || `timeline_clip_${index + 1}`,
    name: clip.name?.trim() || (kind === "spritesheet" ? "Sprite Clip" : kind === "event" ? "Event" : "Background"),
    kind,
    startMs: Math.max(0, Math.round(finiteNumber(clip.startMs, 0))),
    durationMs: Math.max(MIN_TIMELINE_CLIP_DURATION_MS, Math.round(finiteNumber(clip.durationMs, 1000))),
    offsetMs: Math.max(0, Math.round(finiteNumber(clip.offsetMs, 0))),
    assetId: clip.assetId,
    animationId: clip.animationId,
    imageUrl: clip.imageUrl,
    spriteSheet: kind === "spritesheet" ? normalizeSpriteSheetSource(clip.spriteSheet) : undefined,
    eventName: clip.eventName,
    loop: clip.loop ?? true,
    fps: Math.round(boundedNumber(clip.fps, 12, 1, 60)),
    playbackRate: boundedNumber(clip.playbackRate, 1, 0.1, 8),
    x: finiteNumber(clip.x, 0),
    y: finiteNumber(clip.y, 0),
    scale: boundedNumber(clip.scale, 1, 0.05, 20),
    opacity: boundedNumber(clip.opacity, 1, 0, 1),
    fadeInMs: Math.max(0, Math.round(finiteNumber(clip.fadeInMs, 0))),
    fadeOutMs: Math.max(0, Math.round(finiteNumber(clip.fadeOutMs, 0))),
  };
}

function normalizeTrack(track: Partial<AnimationSceneTrack>, index: number): AnimationSceneTrack {
  const kind = TRACK_KINDS.includes(track.kind as AnimationSceneTrackKind)
    ? track.kind as AnimationSceneTrackKind
    : "sprite";
  return {
    id: track.id || `animation_track_${index + 1}`,
    name: track.name?.trim() || (kind === "background" ? "Background" : kind === "event" ? "Events" : `Sprite ${index + 1}`),
    kind,
    clips: Array.isArray(track.clips)
      ? track.clips.map((clip, clipIndex) => normalizeTimelineClip(clip, kind, clipIndex))
      : [],
    muted: track.muted ?? false,
    locked: track.locked ?? false,
    zIndex: Math.round(finiteNumber(track.zIndex, index * 10)),
  };
}

export function normalizeAnimationScene(scene: Partial<AnimationScene>): AnimationScene {
  const tracks = Array.isArray(scene.tracks)
    ? scene.tracks.map(normalizeTrack)
    : [];
  if (!tracks.some(track => track.kind === "background")) {
    tracks.unshift({
      id: "animation_track_background",
      name: "Background",
      kind: "background",
      clips: [],
      zIndex: 0,
    });
  }
  const latestClipEnd = tracks.reduce((latest, track) => (
    track.clips.reduce((trackLatest, clip) => Math.max(trackLatest, clip.startMs + clip.durationMs), latest)
  ), 0);
  const durationMs = Math.max(
    1000,
    Math.round(finiteNumber(scene.durationMs, DEFAULT_ANIMATION_SCENE_DURATION_MS)),
    latestClipEnd,
  );
  const now = new Date().toISOString();
  return {
    version: 1,
    id: scene.id || `animation_scene_${Date.now()}`,
    kind: "animation",
    name: scene.name?.trim() || "Animation Scene",
    width: Math.round(boundedNumber(scene.width, DEFAULT_ANIMATION_SCENE_WIDTH, 240, 7680)),
    height: Math.round(boundedNumber(scene.height, DEFAULT_ANIMATION_SCENE_HEIGHT, 240, 4320)),
    durationMs,
    fps: Math.round(boundedNumber(scene.fps, 30, 1, 60)),
    backgroundColor: scene.backgroundColor || "#171b20",
    endBehavior: END_BEHAVIORS.includes(scene.endBehavior as AnimationSceneEndBehavior)
      ? scene.endBehavior as AnimationSceneEndBehavior
      : "hold",
    tracks,
    markers: Array.isArray(scene.markers)
      ? scene.markers.map((marker, index) => ({
        id: marker.id || `animation_marker_${index + 1}`,
        name: marker.name?.trim() || `Marker ${index + 1}`,
        timeMs: Math.max(0, Math.min(durationMs, Math.round(finiteNumber(marker.timeMs, 0)))),
      }))
      : [],
    savedTime: scene.savedTime || now,
    updatedTime: scene.updatedTime,
  };
}

export function createDefaultAnimationScene(sourceScene?: GameScene, assets: GameAsset[] = []): AnimationScene {
  const nowTime = Date.now();
  const now = new Date(nowTime).toISOString();
  const durationMs = sourceScene?.timeline?.durationMs || DEFAULT_ANIMATION_SCENE_DURATION_MS;
  const sourceWidth = sourceScene?.viewportWidth || sourceScene?.width || DEFAULT_ANIMATION_SCENE_WIDTH;
  const sourceHeight = sourceScene?.viewportHeight || sourceScene?.height || DEFAULT_ANIMATION_SCENE_HEIGHT;
  const backgroundLayer = sourceScene?.layers.find(layer => layer.type === "background" && layer.visible);
  const backgroundTrack: AnimationSceneTrack = {
    id: `animation_track_background_${nowTime}`,
    name: "Background",
    kind: "background",
    clips: backgroundLayer?.imageUrl ? [{
      id: `animation_clip_background_${nowTime}`,
      name: backgroundLayer.name || "Background",
      kind: "background",
      startMs: 0,
      durationMs,
      imageUrl: backgroundLayer.imageUrl,
      opacity: backgroundLayer.opacity,
      loop: false,
    }] : [],
    zIndex: 0,
  };
  const assetMap = new Map(assets.map(asset => [asset.id, asset]));
  const spriteTracks: AnimationSceneTrack[] = (sourceScene?.layers || [])
    .filter(layer => layer.visible && layer.assetId && ["sprite", "effect", "foreground"].includes(layer.type))
    .slice(0, 4)
    .map((layer, index) => {
      const asset = assetMap.get(layer.assetId!);
      const animationId = layer.activeAnimationId || asset?.defaultAnimationId || asset?.animations?.[0]?.id;
      return {
        id: `animation_track_sprite_${nowTime}_${index}`,
        name: layer.name || asset?.name || `Sprite ${index + 1}`,
        kind: "sprite",
        clips: [{
          id: `animation_clip_sprite_${nowTime}_${index}`,
          name: asset?.animations?.find(clip => clip.id === animationId)?.name || asset?.name || layer.name || "Sprite Clip",
          kind: "spritesheet",
          startMs: 0,
          durationMs,
          assetId: layer.assetId,
          animationId,
          loop: true,
          fps: asset?.animations?.find(clip => clip.id === animationId)?.fps || asset?.sprite.fps || 12,
          x: layer.x,
          y: layer.y,
          scale: layer.scale,
          opacity: layer.opacity,
        }],
        zIndex: layer.zIndex || (index + 1) * 10,
      };
    });

  return normalizeAnimationScene({
    version: 1,
    id: `animation_scene_${nowTime}`,
    kind: "animation",
    name: sourceScene ? `${sourceScene.name || "Scene"} Animation` : "New Animation Scene",
    width: sourceWidth,
    height: sourceHeight,
    durationMs,
    fps: 30,
    backgroundColor: backgroundLayer?.color || sourceScene?.background || "#171b20",
    endBehavior: "hold",
    tracks: [backgroundTrack, ...spriteTracks],
    markers: [],
    savedTime: now,
    updatedTime: now,
  });
}

export function cloneAnimationScene(scene: AnimationScene): AnimationScene {
  return cloneValue(scene);
}

export function animationSceneDurationLabel(durationMs: number) {
  const seconds = Math.max(0, Math.round(durationMs / 100) / 10);
  return `${seconds.toFixed(seconds % 1 === 0 ? 0 : 1)}s`;
}

export function animationSceneClipCount(scene: AnimationScene) {
  return scene.tracks.reduce((count, track) => count + track.clips.length, 0);
}

export function animationScenePoster(scene: AnimationScene) {
  return scene.tracks
    .filter(track => !track.muted && track.kind === "background")
    .flatMap(track => track.clips)
    .filter(clip => clip.imageUrl)
    .sort((a, b) => a.startMs - b.startMs)[0]?.imageUrl;
}

export function resolveAnimationSceneSprite(
  clip: AnimationSceneTimelineClip,
  assetById: Map<string, GameAsset>,
): { asset?: GameAsset; sprite: AnimationSprite; fps: number } | undefined {
  const repositorySource = clip.spriteSheet;
  if (repositorySource) {
    const cacheKey = [
      repositorySource.imageUrl,
      repositorySource.sheetWidth,
      repositorySource.sheetHeight,
      repositorySource.columns,
      repositorySource.rows,
      repositorySource.frameCount,
    ].join("|");
    let sprite = repositorySpriteCache.get(cacheKey);
    if (!sprite) {
      const frameWidth = repositorySource.sheetWidth / repositorySource.columns;
      const frameHeight = repositorySource.sheetHeight / repositorySource.rows;
      sprite = {
        id: `repository_sprite_${cacheKey}`,
        characterName: clip.name,
        description: "Repository SpriteSheet used by an Animation Scene clip.",
        frameCount: repositorySource.frameCount,
        style: "repository spritesheet",
        frames: buildSpritesheetFrames(
          repositorySource.imageUrl,
          repositorySource.sheetWidth,
          repositorySource.sheetHeight,
          frameWidth,
          frameHeight,
          repositorySource.frameCount,
          repositorySource.columns,
        ),
        createdTime: "",
        isPreset: false,
        spritesheetPng: repositorySource.imageUrl,
        rawSpritesheetPng: repositorySource.imageUrl,
        fps: clip.fps || 12,
        gridColumns: repositorySource.columns,
        frameSize: [frameWidth, frameHeight],
        sheetSize: [repositorySource.sheetWidth, repositorySource.sheetHeight],
      };
      repositorySpriteCache.set(cacheKey, sprite);
    }
    return { sprite, fps: clip.fps || sprite.fps || 12 };
  }
  if (!clip.assetId) return undefined;
  const asset = assetById.get(clip.assetId);
  if (!asset) return undefined;
  const animation = asset.animations?.find(item => item.id === clip.animationId)
    || asset.animations?.find(item => item.id === asset.defaultAnimationId)
    || asset.animations?.[0];
  const sprite = animation?.sprite || asset.sprite;
  return {
    asset,
    sprite,
    fps: clip.fps || animation?.fps || sprite.fps || 12,
  };
}

export function createAnimationSceneClipId(prefix = "timeline_clip") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
