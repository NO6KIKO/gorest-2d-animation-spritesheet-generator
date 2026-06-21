import type { ActionBinding, ActionTriggerType, AnimationClip, AnimationSprite, AssetRole, GameAsset } from "../../types";

export const DEFAULT_BINDING: ActionBinding = {
  actionName: "walk",
  triggerType: "keyboard",
  triggerValue: "KeyD",
  gameState: "player.walk",
  notes: "Side-scroller character walks right with a compact stride.",
};

export function safeName(name: string) {
  return name.replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "sprite";
}

export function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function splitTags(tagsText: string) {
  return tagsText.split(/[,\s]+/).map(tag => tag.trim()).filter(Boolean);
}

export function defaultTriggerValueForType(triggerType: ActionTriggerType) {
  if (triggerType === "auto") return "auto";
  if (triggerType === "mouse") return "click";
  if (triggerType === "keyboard") return "KeyF";
  return "scene.animation.active";
}

export function defaultGameStateForTrigger(triggerType: ActionTriggerType, actionName: string) {
  const actionKey = safeName(actionName || "animation");
  if (triggerType === "auto") return `scene.${actionKey}.loop`;
  if (triggerType === "mouse") return `scene.${actionKey}.clicked`;
  if (triggerType === "keyboard") return `input.${actionKey}`;
  return `state.${actionKey}`;
}

export function createAsset(sprite: AnimationSprite, role: AssetRole, binding: ActionBinding, tagsText: string): GameAsset {
  const now = new Date().toISOString();
  const id = `asset_${safeName(sprite.characterName)}_${safeName(binding.actionName)}_${Date.now()}`;
  return {
    id,
    name: `${sprite.characterName} / ${binding.actionName}`,
    role,
    confirmed: true,
    savedTime: now,
    updatedTime: now,
    sprite,
    binding,
    tags: splitTags(tagsText),
  };
}

export function clipButtonText(clip: AnimationClip) {
  const key = clip.binding?.triggerType === "keyboard" ? ` ${clip.binding.triggerValue.replace(/^Key/i, "")}` : "";
  if (clip.direction === "left") return `Walk Left${key}`;
  if (clip.direction === "right") return `Walk Right${key}`;
  return clip.actionName === "idle" ? "Idle" : clip.name;
}
