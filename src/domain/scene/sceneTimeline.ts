import type { GameScene, SceneLayer, ScenePlaybackMode, SceneTimelineSettings, SceneTransitionType } from "../../types";
import { isSceneVisualLayer } from "./sceneModel";

export const DEFAULT_SCENE_TIMELINE: SceneTimelineSettings = {
  durationMs: 5000,
  transitionDurationMs: 800,
  transitionType: "cut",
};

export const SCENE_PLAYBACK_MODE_LABELS: Record<ScenePlaybackMode, string> = {
  animate: "Animate",
  game: "Game",
};

export const SCENE_TRANSITION_LABELS: Record<SceneTransitionType, string> = {
  cut: "Cut",
  "fade-black": "Fade Black",
  dissolve: "Dissolve",
};

export function normalizeSceneTimeline(scene: GameScene): GameScene {
  const playbackMode = scene.playbackMode || "game";
  const visualLayerIds = new Set(scene.layers.filter(isSceneVisualLayer).map(layer => layer.id));
  const primaryLayerId = scene.timeline?.primaryLayerId && visualLayerIds.has(scene.timeline.primaryLayerId)
    ? scene.timeline.primaryLayerId
    : scene.layers.find(isSceneVisualLayer)?.id;

  return {
    ...scene,
    playbackMode,
    timeline: {
      ...DEFAULT_SCENE_TIMELINE,
      ...scene.timeline,
      durationMs: clampTimelineMs(scene.timeline?.durationMs, 1000, 120000, DEFAULT_SCENE_TIMELINE.durationMs),
      transitionDurationMs: clampTimelineMs(scene.timeline?.transitionDurationMs, 0, 10000, DEFAULT_SCENE_TIMELINE.transitionDurationMs),
      transitionType: scene.timeline?.transitionType || DEFAULT_SCENE_TIMELINE.transitionType,
      primaryLayerId,
    },
  };
}

export function sceneTimeline(scene: GameScene) {
  return normalizeSceneTimeline(scene).timeline!;
}

export function scenePlaybackMode(scene: GameScene) {
  return scene.playbackMode || "game";
}

export function sceneDurationLabel(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 100) / 10);
  return `${totalSeconds.toFixed(totalSeconds % 1 === 0 ? 0 : 1)}s`;
}

export function sceneTimelinePrimaryLayer(scene: GameScene): SceneLayer | undefined {
  const timeline = sceneTimeline(scene);
  return scene.layers.find(layer => layer.id === timeline.primaryLayerId) || scene.layers.find(isSceneVisualLayer);
}

function clampTimelineMs(value: number | undefined, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}
