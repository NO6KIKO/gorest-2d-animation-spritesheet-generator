import type { ActionBinding, ActionTriggerType, AnimationClip, AnimationSprite, AssetRole, GameAsset } from "../../types";
import { buildSpritesheetFrames } from "../sprites/spriteUtils";
import { defaultGameStateForTrigger, defaultTriggerValueForType, escapeHtmlAttribute, safeName, splitTags } from "./assetModel";

type UploadedStaticObjectInput = {
  dataUrl: string;
  fileName: string;
  width: number;
  height: number;
};

type ImportedSpritesheetInput = {
  dataUrl: string;
  fileName: string;
  assetName: string;
  actionName: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  columns: number;
  sheetWidth: number;
  sheetHeight: number;
  role: AssetRole;
  triggerType: ActionTriggerType;
  triggerValue: string;
  gameState: string;
  tagsText: string;
  loop: boolean;
  fps: number;
};

export function createUploadedStaticObjectAsset({
  dataUrl,
  fileName,
  width,
  height,
}: UploadedStaticObjectInput): { asset: GameAsset; sprite: AnimationSprite } {
  const now = new Date().toISOString();
  const baseName = fileName.replace(/\.[^.]+$/, "") || "Uploaded Object";
  const safeBase = safeName(baseName);
  const sprite: AnimationSprite = {
    id: `sprite_static_${safeBase}_${Date.now()}`,
    characterName: baseName,
    description: `Static uploaded object from ${fileName || "image file"}.`,
    frameCount: 1,
    style: "Uploaded static object",
    frames: [`<img src="${dataUrl}" alt="${escapeHtmlAttribute(baseName)}" draggable="false" />`],
    createdTime: now,
    isPreset: false,
    spritesheetPng: dataUrl,
    rawSpritesheetPng: dataUrl,
    frameSize: [width, height],
    sheetSize: [width, height],
    generationMode: "uploaded-static-object",
    proportionPolicy: "Uploaded static object keeps its original pixel ratio and can be resized as a scene layer.",
  };
  const binding: ActionBinding = {
    actionName: "static",
    triggerType: "auto",
    triggerValue: "auto",
    gameState: `static.${safeBase}`,
    notes: "Static object uploaded from the Layer panel.",
  };
  const asset: GameAsset = {
    id: `asset_static_${safeBase}_${Date.now()}`,
    name: baseName,
    role: "prop",
    confirmed: true,
    savedTime: now,
    updatedTime: now,
    sprite,
    binding,
    tags: ["uploaded", "static-object"],
  };
  return { asset, sprite };
}

export function createImportedSpritesheetAsset({
  dataUrl,
  fileName,
  assetName,
  actionName,
  frameWidth,
  frameHeight,
  frameCount,
  columns,
  sheetWidth,
  sheetHeight,
  role,
  triggerType,
  triggerValue,
  gameState,
  tagsText,
  loop,
  fps,
}: ImportedSpritesheetInput): { asset: GameAsset; binding: ActionBinding; clip: AnimationClip; sprite: AnimationSprite } {
  const now = new Date().toISOString();
  const binding: ActionBinding = {
    actionName,
    triggerType,
    triggerValue: triggerValue.trim() || defaultTriggerValueForType(triggerType),
    gameState: gameState.trim() || defaultGameStateForTrigger(triggerType, actionName),
    notes: triggerType === "auto" && loop
      ? "Imported spritesheet loops continuously while it is visible in the scene."
      : "Imported spritesheet action with configurable trigger metadata.",
  };
  const rows = Math.ceil(frameCount / columns);
  const sprite: AnimationSprite = {
    id: `sprite_import_${safeName(assetName)}_${Date.now()}`,
    characterName: assetName,
    description: `Imported ${frameCount}-frame spritesheet from ${fileName || "uploaded image"}.`,
    frameCount,
    style: "Imported spritesheet",
    frames: buildSpritesheetFrames(dataUrl, sheetWidth, sheetHeight, frameWidth, frameHeight, frameCount, columns),
    createdTime: now,
    isPreset: false,
    spritesheetPng: dataUrl,
    fps,
    gridColumns: columns,
    frameSize: [frameWidth, frameHeight],
    sheetSize: [sheetWidth, sheetHeight],
    generationMode: "uploaded-spritesheet",
    proportionPolicy: "Use the exact uploaded frame grid; do not stretch or recrop frames.",
    adaptiveFramePolicy: `${columns} columns, ${rows} rows, ${frameCount} active frames.`,
  };
  const clip: AnimationClip = {
    id: `clip_${safeName(actionName)}_${Date.now()}`,
    name: actionName,
    actionName,
    direction: "none",
    sprite,
    binding,
    loop,
    fps,
  };
  const asset: GameAsset = {
    id: `asset_${safeName(assetName)}_${safeName(actionName)}_${Date.now()}`,
    name: `${assetName} / ${actionName}`,
    role,
    confirmed: true,
    savedTime: now,
    updatedTime: now,
    sprite,
    animations: [clip],
    defaultAnimationId: clip.id,
    binding,
    tags: splitTags(tagsText),
  };
  return { asset, binding, clip, sprite };
}
