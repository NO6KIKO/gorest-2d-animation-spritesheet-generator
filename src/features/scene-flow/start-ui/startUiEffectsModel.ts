import type { CSSProperties } from "react";
import { DEFAULT_START_UI_EFFECTS } from "../../../domain/scene/startUiModel";
import { normalizeStartUiActionLabel, startUiRuntimeActionOptions } from "../../../domain/scene/startUiRuntime";
import type { GameStartUiEffects, GameStartUiLayer, GameStartUiSettings } from "../../../types";

export type StartUiEffectPointer = {
  x: number;
  y: number;
};

export const CENTERED_START_UI_EFFECT_POINTER: StartUiEffectPointer = { x: 0, y: 0 };

type StartUiEffectStyle = CSSProperties & {
  [key: `--start-ui-${string}`]: string | number | undefined;
};

function startUiActionLabels(settings: GameStartUiSettings) {
  return startUiRuntimeActionOptions(settings).map(option => normalizeStartUiActionLabel(option.label)).filter(Boolean);
}

export function getStartUiButtonGroup(layer: GameStartUiLayer, settings: GameStartUiSettings) {
  const group = normalizeStartUiActionLabel(layer.label || layer.name);
  if (!group) return null;
  if (layer.kind === "menu") return group;
  return layer.kind === "overlay" && startUiActionLabels(settings).includes(group) ? group : null;
}

function startUiLayerParallaxDepth(layer: GameStartUiLayer, settings: GameStartUiSettings) {
  if (layer.kind === "background") return -0.35;
  if (layer.kind === "title") return 0.85;
  if (getStartUiButtonGroup(layer, settings)) return 0.5;
  return 0.2;
}

function startUiLayerEntranceIndex(layer: GameStartUiLayer, settings: GameStartUiSettings, layerIndex: number) {
  if (layer.kind === "background" || layer.kind === "title") return 0;
  const group = getStartUiButtonGroup(layer, settings);
  if (!group) return Math.max(1, layerIndex);
  const groupIndex = startUiActionLabels(settings).indexOf(group);
  return groupIndex >= 0 ? groupIndex + 1 : Math.max(1, layerIndex);
}

export function startUiLayerEffectStyle(
  layer: GameStartUiLayer,
  settings: GameStartUiSettings,
  pointer: StartUiEffectPointer,
  layerIndex: number,
): StartUiEffectStyle {
  const effects = settings.effects || DEFAULT_START_UI_EFFECTS;
  const depth = startUiLayerParallaxDepth(layer, settings);
  return {
    "--start-ui-parallax-x": `${pointer.x * effects.parallaxStrength * depth}px`,
    "--start-ui-parallax-y": `${pointer.y * effects.parallaxStrength * depth}px`,
    "--start-ui-entrance-delay": `${startUiLayerEntranceIndex(layer, settings, layerIndex) * effects.entranceStagger}ms`,
  };
}

export function startUiStageEffectStyle(effects: GameStartUiEffects = DEFAULT_START_UI_EFFECTS): StartUiEffectStyle {
  const flickerOpacity = Math.min(0.48, effects.flickerStrength / 210);
  const titleShift = effects.titleStrength / 12;
  return {
    "--start-ui-flicker-opacity": flickerOpacity,
    "--start-ui-flicker-opacity-soft": flickerOpacity * 0.28,
    "--start-ui-flicker-opacity-medium": flickerOpacity * 0.54,
    "--start-ui-flicker-duration": `${effects.flickerInterval}s`,
    "--start-ui-vignette-opacity": Math.min(0.76, effects.vignetteStrength / 132),
    "--start-ui-grain-opacity": Math.min(0.28, effects.grainStrength / 360),
    "--start-ui-title-duration": `${effects.titleSpeed}s`,
    "--start-ui-title-scale": 1 + effects.titleStrength / 4000,
    "--start-ui-title-brightness": 1 + effects.titleStrength / 560,
    "--start-ui-title-shift": `${titleShift}px`,
    "--start-ui-title-shift-negative": `${titleShift * -1}px`,
    "--start-ui-title-shift-soft": `${titleShift * 0.45}px`,
    "--start-ui-button-lift": `${effects.buttonLift}px`,
    "--start-ui-button-lift-negative": `${effects.buttonLift * -1}px`,
    "--start-ui-button-glow-blur": `${4 + effects.buttonGlow / 4}px`,
    "--start-ui-button-glow-opacity": Math.min(0.9, effects.buttonGlow / 100),
    "--start-ui-button-brightness": 1 + effects.buttonGlow / 380,
    "--start-ui-button-press-scale": effects.buttonPressScale / 100,
    "--start-ui-entrance-duration": `${effects.entranceDuration}ms`,
    "--start-ui-transition-duration": `${effects.transitionDuration}ms`,
  };
}

export function startUiStageEffectClassName(
  effects: GameStartUiEffects,
  isPreviewing: boolean,
  canDragSelectedLayer: boolean,
) {
  return [
    "scene-start-ui-design-stage",
    canDragSelectedLayer ? "can-drag-selected" : "",
    isPreviewing ? "effects-preview" : "",
    isPreviewing && effects.flickerEnabled ? "effect-flicker" : "",
    isPreviewing ? `effect-title-${effects.titleEffect}` : "",
    isPreviewing ? `effect-button-${effects.buttonHoverEffect}` : "",
    isPreviewing ? `effect-entrance-${effects.entranceEffect}` : "",
    effects.respectReducedMotion ? "respect-reduced-motion" : "",
  ].filter(Boolean).join(" ");
}
