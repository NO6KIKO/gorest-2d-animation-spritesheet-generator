import type { ActionBinding, AnimationClip, AnimationSprite, GameAsset } from "../../types";
import { buildSpritesheetFrames } from "../sprites/spriteUtils";

export type SpriteGridPatch = {
  frameWidth?: number;
  frameHeight?: number;
  frameCount?: number;
  columns?: number;
};

type RebuildSpritesheetGridInput = {
  sprite: AnimationSprite;
  source: string;
  sheetSize: [number, number];
  currentFrameSize: [number, number];
  currentFrameCount: number;
  currentColumns: number;
  patch: SpriteGridPatch;
};

export type RebuiltSpritesheetGrid = {
  frameCount: number;
  frameHeight: number;
  frameWidth: number;
  sprite: AnimationSprite;
};

export function applyAssetClipMetadataPatch(
  asset: GameAsset,
  clipId: string,
  patch: Partial<AnimationClip>,
  bindingPatch?: Partial<ActionBinding>
): GameAsset {
  if (!asset.animations?.length) return asset;
  const animations = asset.animations.map(clip => {
    if (clip.id !== clipId) return clip;
    return {
      ...clip,
      ...patch,
      binding: { ...clip.binding, ...bindingPatch },
    };
  });
  const defaultClip =
    animations.find(clip => clip.id === asset.defaultAnimationId) ||
    animations[0];
  return {
    ...asset,
    animations,
    sprite: defaultClip?.sprite || asset.sprite,
    binding: defaultClip?.binding || asset.binding,
    updatedTime: new Date().toISOString(),
  };
}

export function replaceSpriteInAsset(asset: GameAsset, spriteId: string, nextSprite: AnimationSprite): GameAsset {
  const animations = asset.animations?.map(clip => (
    clip.sprite.id === spriteId ? { ...clip, sprite: nextSprite } : clip
  ));
  return {
    ...asset,
    sprite: asset.sprite.id === spriteId ? nextSprite : asset.sprite,
    animations,
    updatedTime: new Date().toISOString(),
  };
}

type SpriteWithFrameMetadata = AnimationSprite & { frameBboxes?: number[][] };

export function deleteFrameFromSprite(sprite: AnimationSprite, frameIndex: number): AnimationSprite | null {
  if (sprite.frames.length <= 1 || frameIndex < 0 || frameIndex >= sprite.frames.length) return null;

  const nextFrameCount = sprite.frames.length - 1;
  const metadata = sprite as SpriteWithFrameMetadata;
  const nextColumns = sprite.gridColumns
    ? Math.min(Math.max(1, sprite.gridColumns), nextFrameCount)
    : sprite.gridColumns;
  const nextSprite: SpriteWithFrameMetadata = {
    ...sprite,
    frameCount: nextFrameCount,
    frames: sprite.frames.filter((_, index) => index !== frameIndex),
    gridColumns: nextColumns,
    updatedTime: new Date().toISOString(),
  };

  if (Array.isArray(metadata.frameBboxes)) {
    nextSprite.frameBboxes = metadata.frameBboxes.filter((_, index) => index !== frameIndex);
  }

  const policyColumns = nextColumns || Math.min(4, nextFrameCount);
  nextSprite.adaptiveFramePolicy = `${policyColumns} columns, ${Math.ceil(nextFrameCount / Math.max(1, policyColumns))} rows, ${nextFrameCount} active frames after deleting frame ${frameIndex + 1}.`;
  return nextSprite;
}

export function rebuildSpritesheetGridSprite({
  sprite,
  source,
  sheetSize,
  currentFrameSize,
  currentFrameCount,
  currentColumns,
  patch,
}: RebuildSpritesheetGridInput): RebuiltSpritesheetGrid | null {
  const [currentFrameWidth, currentFrameHeight] = currentFrameSize;
  const [sheetWidth, sheetHeight] = sheetSize;
  const frameWidth = Math.max(1, Math.round(patch.frameWidth ?? currentFrameWidth));
  const frameHeight = Math.max(1, Math.round(patch.frameHeight ?? currentFrameHeight));
  const frameCount = Math.max(1, Math.round(patch.frameCount ?? currentFrameCount));
  const columns = Math.max(1, Math.round(patch.columns ?? currentColumns));
  const rows = Math.max(1, Math.ceil(frameCount / columns));

  if (columns * frameWidth > sheetWidth + 1 || rows * frameHeight > sheetHeight + 1) return null;

  return {
    frameCount,
    frameHeight,
    frameWidth,
    sprite: {
      ...sprite,
      frameCount,
      frames: buildSpritesheetFrames(source, sheetWidth, sheetHeight, frameWidth, frameHeight, frameCount, columns),
      frameSize: [frameWidth, frameHeight],
      sheetSize: [sheetWidth, sheetHeight],
      gridColumns: columns,
      adaptiveFramePolicy: `${columns} columns, ${rows} rows, ${frameCount} active frames.`,
      updatedTime: new Date().toISOString(),
    } as AnimationSprite,
  };
}
