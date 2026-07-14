import {
  createAnimationSceneClipId,
  MIN_TIMELINE_CLIP_DURATION_MS,
  normalizeAnimationScene,
} from "../../../domain/scene/animationSceneModel";
import { getFrameSize } from "../../../domain/sprites/spriteUtils";
import type {
  AnimationScene,
  AnimationSceneSpriteSheetSource,
  AnimationSceneTimelineClip,
  AnimationSceneTrack,
  GameAsset,
} from "../../../types";

export type AnimationBackgroundOption = {
  id: string;
  label: string;
  imageUrl: string;
};

export type AnimationSpriteOption = {
  id: string;
  label: string;
  assetId: string;
  animationId?: string;
  isStatic: boolean;
};

export type AnimationRepositorySpriteSheetInput = AnimationSceneSpriteSheetSource & {
  label: string;
  fps: number;
};

export type AnimationRepositorySpriteOption = {
  id: string;
  label: string;
  imageUrl: string;
  fileName: string;
};

export type AnimationRepositorySpriteGrid = {
  columns: number;
  rows: number;
  frameCount: number;
};

export function buildAnimationRepositorySpriteOptions(images: Array<{ name: string; url: string }>) {
  return images
    .filter(image => (
      /sprite|sheet|\d+f(?:[_.-]|$)|walk|idle|animation|frames?/i.test(image.name)
      || /(?:^|[_.-])\d{1,3}x\d{1,3}(?:[_.-]|$)/i.test(image.name)
    ))
    .map(image => ({
      id: `repository::${image.url}`,
      label: image.name,
      imageUrl: image.url,
      fileName: image.name,
    } satisfies AnimationRepositorySpriteOption));
}

export function inferAnimationRepositorySpriteGrid(
  fileName: string,
  sheetWidth: number,
  sheetHeight: number,
): AnimationRepositorySpriteGrid {
  const explicitGrid = fileName.match(/(?:^|[_.-])(\d{1,3})x(\d{1,3})(?:[_.-]|$)/i);
  const explicitFrameCount = fileName.match(/(?:^|[_.-])(\d{1,3})f(?:[_.-]|$)/i);
  if (explicitGrid) {
    const rows = Math.max(1, Number(explicitGrid[1]));
    const columns = Math.max(1, Number(explicitGrid[2]));
    return {
      columns,
      rows,
      frameCount: Math.min(columns * rows, Math.max(1, Number(explicitFrameCount?.[1]) || columns * rows)),
    };
  }

  const frameCount = Math.max(1, Number(explicitFrameCount?.[1]) || 0);
  if (frameCount > 1) {
    let best = { columns: frameCount, rows: 1, score: Number.POSITIVE_INFINITY };
    for (let columns = 1; columns <= frameCount; columns += 1) {
      if (frameCount % columns !== 0) continue;
      const rows = frameCount / columns;
      const frameAspect = (sheetWidth / columns) / Math.max(1, sheetHeight / rows);
      const score = Math.abs(Math.log(Math.max(0.0001, frameAspect)));
      if (score < best.score) best = { columns, rows, score };
    }
    return { columns: best.columns, rows: best.rows, frameCount };
  }

  const aspect = sheetWidth / Math.max(1, sheetHeight);
  const columns = aspect >= 1 ? Math.max(1, Math.min(64, Math.round(aspect))) : 1;
  const rows = aspect < 1 ? Math.max(1, Math.min(64, Math.round(1 / aspect))) : 1;
  return { columns, rows, frameCount: columns * rows };
}

function spriteIsStatic(sprite: GameAsset["sprite"]) {
  if (sprite.frameCount <= 1 || sprite.frames.length <= 1) return true;
  const metadata = [
    sprite.generationMode,
    sprite.normalization,
    sprite.rootAnchorPolicy,
    sprite.adaptiveFramePolicy,
  ].filter(Boolean).join(" ").toLowerCase();
  return /stabilized[_ -]?idle|single[_ -]?pose|identical|static frame/.test(metadata);
}

function animationMotionPriority(name: string, actionName: string, isStatic: boolean) {
  if (isStatic) return 2;
  return /move|walk|run|talk|attack|spin|swim|raise|cry|drum/i.test(`${name} ${actionName}`) ? 0 : 1;
}

export function buildAnimationSpriteOptions(assets: GameAsset[]): AnimationSpriteOption[] {
  return assets.flatMap((asset, assetIndex) => {
    if (asset.animations?.length) {
      return asset.animations.map(animation => {
        const isStatic = spriteIsStatic(animation.sprite);
        return {
          id: `${asset.id}::${animation.id}`,
          label: `${asset.name} / ${animation.name}${isStatic ? " / static" : ""}`,
          assetId: asset.id,
          animationId: animation.id,
          isStatic,
          assetIndex,
          priority: animationMotionPriority(animation.name, animation.actionName, isStatic),
        };
      });
    }
    const isStatic = spriteIsStatic(asset.sprite);
    return [{
      id: `${asset.id}::default`,
      label: `${asset.name}${isStatic ? " / static" : ""}`,
      assetId: asset.id,
      animationId: asset.defaultAnimationId,
      isStatic,
      assetIndex,
      priority: animationMotionPriority(asset.name, asset.binding.actionName, isStatic),
    }];
  }).sort((a, b) => a.assetIndex - b.assetIndex || a.priority - b.priority || a.label.localeCompare(b.label))
    .map(option => ({
      id: option.id,
      label: option.label,
      assetId: option.assetId,
      animationId: option.animationId,
      isStatic: option.isStatic,
    }));
}

export function findAnimationTimelineClip(scene: AnimationScene, clipId: string | null) {
  if (!clipId) return undefined;
  for (const track of scene.tracks) {
    const clip = track.clips.find(item => item.id === clipId);
    if (clip) return { track, clip };
  }
  return undefined;
}

export function updateAnimationTimelineClip(
  scene: AnimationScene,
  clipId: string,
  patch: Partial<AnimationSceneTimelineClip>,
): AnimationScene {
  const tracks = scene.tracks.map(track => ({
    ...track,
    clips: track.clips.map(clip => clip.id === clipId ? { ...clip, ...patch } : clip),
  }));
  return normalizeAnimationScene({ ...scene, tracks });
}

export function deleteAnimationTimelineClip(scene: AnimationScene, clipId: string): AnimationScene {
  const tracks = scene.tracks
    .map(track => ({ ...track, clips: track.clips.filter(clip => clip.id !== clipId) }))
    .filter(track => track.kind === "background" || track.clips.length > 0);
  return normalizeAnimationScene({ ...scene, tracks });
}

export function updateAnimationTrack(
  scene: AnimationScene,
  trackId: string,
  patch: Partial<AnimationSceneTrack>,
): AnimationScene {
  return normalizeAnimationScene({
    ...scene,
    tracks: scene.tracks.map(track => track.id === trackId ? { ...track, ...patch } : track),
  });
}

function availableDuration(scene: AnimationScene, startMs: number) {
  return Math.max(MIN_TIMELINE_CLIP_DURATION_MS, Math.min(3000, scene.durationMs - startMs));
}

export function addBackgroundTimelineClip(
  scene: AnimationScene,
  option: AnimationBackgroundOption,
  startMs: number,
): { scene: AnimationScene; clipId: string } {
  const clipId = createAnimationSceneClipId("background_clip");
  const clip: AnimationSceneTimelineClip = {
    id: clipId,
    name: option.label,
    kind: "background",
    startMs,
    durationMs: availableDuration(scene, startMs),
    imageUrl: option.imageUrl,
    loop: false,
    opacity: 1,
    fadeInMs: 0,
    fadeOutMs: 0,
  };
  const backgroundTrack = scene.tracks.find(track => track.kind === "background");
  const tracks = backgroundTrack
    ? scene.tracks.map(track => track.id === backgroundTrack.id
      ? { ...track, clips: [...track.clips, clip] }
      : track)
    : [{ id: `background_track_${Date.now()}`, name: "Background", kind: "background" as const, clips: [clip], zIndex: 0 }, ...scene.tracks];
  return { scene: normalizeAnimationScene({ ...scene, tracks }), clipId };
}

function appendSpriteClip(
  scene: AnimationScene,
  clip: AnimationSceneTimelineClip,
  trackName: string,
  preferredTrackId?: string,
) {
  const preferredTrack = preferredTrackId
    ? scene.tracks.find(track => track.id === preferredTrackId && track.kind === "sprite" && !track.locked)
    : undefined;
  if (preferredTrack) {
    return {
      scene: normalizeAnimationScene({
        ...scene,
        tracks: scene.tracks.map(track => track.id === preferredTrack.id
          ? { ...track, clips: [...track.clips, clip] }
          : track),
      }),
      clipId: clip.id,
    };
  }
  const track: AnimationSceneTrack = {
    id: `sprite_track_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: trackName,
    kind: "sprite",
    clips: [clip],
    zIndex: Math.max(10, ...scene.tracks.map(item => item.zIndex + 10)),
  };
  return {
    scene: normalizeAnimationScene({ ...scene, tracks: [...scene.tracks, track] }),
    clipId: clip.id,
  };
}

export function addSpriteTimelineClip(
  scene: AnimationScene,
  option: AnimationSpriteOption,
  asset: GameAsset,
  startMs: number,
  preferredTrackId?: string,
): { scene: AnimationScene; clipId: string } {
  const animation = asset.animations?.find(item => item.id === option.animationId)
    || asset.animations?.find(item => item.id === asset.defaultAnimationId)
    || asset.animations?.[0];
  const sprite = animation?.sprite || asset.sprite;
  const [frameWidth, frameHeight] = getFrameSize(sprite);
  const clipId = createAnimationSceneClipId("sprite_clip");
  const clip: AnimationSceneTimelineClip = {
    id: clipId,
    name: animation?.name || asset.name,
    kind: "spritesheet",
    startMs,
    durationMs: availableDuration(scene, startMs),
    assetId: asset.id,
    animationId: animation?.id || option.animationId,
    loop: animation?.loop ?? true,
    fps: animation?.fps || sprite.fps || 12,
    playbackRate: 1,
    x: scene.width / 2 - frameWidth / 2,
    y: scene.height * 0.82,
    scale: Math.min(1, scene.height * 0.45 / Math.max(1, frameHeight)),
    opacity: 1,
    fadeInMs: 0,
    fadeOutMs: 0,
  };
  return appendSpriteClip(scene, clip, asset.name, preferredTrackId);
}

export function addRepositorySpriteTimelineClip(
  scene: AnimationScene,
  source: AnimationRepositorySpriteSheetInput,
  startMs: number,
  preferredTrackId?: string,
): { scene: AnimationScene; clipId: string } {
  const frameWidth = source.sheetWidth / Math.max(1, source.columns);
  const frameHeight = source.sheetHeight / Math.max(1, source.rows);
  const clip: AnimationSceneTimelineClip = {
    id: createAnimationSceneClipId("repository_sprite_clip"),
    name: source.label,
    kind: "spritesheet",
    startMs,
    durationMs: availableDuration(scene, startMs),
    spriteSheet: {
      imageUrl: source.imageUrl,
      sheetWidth: source.sheetWidth,
      sheetHeight: source.sheetHeight,
      columns: source.columns,
      rows: source.rows,
      frameCount: source.frameCount,
    },
    loop: true,
    fps: source.fps,
    playbackRate: 1,
    x: scene.width / 2 - frameWidth / 2,
    y: scene.height * 0.82,
    scale: Math.min(1, scene.height * 0.45 / Math.max(1, frameHeight)),
    opacity: 1,
    fadeInMs: 0,
    fadeOutMs: 0,
  };
  return appendSpriteClip(scene, clip, source.label, preferredTrackId);
}

export function addEventTimelineClip(scene: AnimationScene, startMs: number) {
  const clipId = createAnimationSceneClipId("event_clip");
  const clip: AnimationSceneTimelineClip = {
    id: clipId,
    name: "Event",
    kind: "event",
    eventName: "event",
    startMs,
    durationMs: Math.min(500, Math.max(MIN_TIMELINE_CLIP_DURATION_MS, scene.durationMs - startMs)),
    loop: false,
  };
  const eventTrack = scene.tracks.find(track => track.kind === "event");
  const tracks = eventTrack
    ? scene.tracks.map(track => track.id === eventTrack.id ? { ...track, clips: [...track.clips, clip] } : track)
    : [...scene.tracks, {
      id: `event_track_${Date.now()}`,
      name: "Events",
      kind: "event" as const,
      clips: [clip],
      zIndex: 1000,
    }];
  return { scene: normalizeAnimationScene({ ...scene, tracks }), clipId };
}

export function clipOpacityAtTime(clip: AnimationSceneTimelineClip, timeMs: number) {
  const baseOpacity = clip.opacity ?? 1;
  const localTime = timeMs - clip.startMs;
  const remainingTime = clip.durationMs - localTime;
  const fadeIn = clip.fadeInMs || 0;
  const fadeOut = clip.fadeOutMs || 0;
  const fadeInOpacity = fadeIn > 0 ? Math.min(1, Math.max(0, localTime / fadeIn)) : 1;
  const fadeOutOpacity = fadeOut > 0 ? Math.min(1, Math.max(0, remainingTime / fadeOut)) : 1;
  return baseOpacity * Math.min(fadeInOpacity, fadeOutOpacity);
}

export function clipIsActive(clip: AnimationSceneTimelineClip, timeMs: number) {
  return timeMs >= clip.startMs && timeMs < clip.startMs + clip.durationMs;
}
