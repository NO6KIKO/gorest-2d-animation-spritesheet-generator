import { normalizeAnimationScene } from "../domain/scene/animationSceneModel";
import { normalizeGameFlowGraph } from "../domain/scene/sceneFlowGraph";
import type { AnimationScene, AnimationSprite, GameAsset, GameFlowGraph, GameLibrary, GameScene, GameStartUiSettings } from "../types";

type LatestSpriteResponse = {
  sprite?: AnimationSprite | null;
};

type GameLibraryMutationResponse = {
  asset?: GameAsset;
  animationScene?: AnimationScene;
  scene?: GameScene;
  startUi?: GameStartUiSettings;
  startUis?: GameStartUiSettings[];
  flowGraph?: GameFlowGraph;
  library?: Partial<GameLibrary>;
  error?: string;
};

const EMPTY_LIBRARY: GameLibrary = {
  assets: [],
  scenes: [],
  animationScenes: [],
  startUis: [],
};

function normalizeGameLibrary(data?: Partial<GameLibrary>): GameLibrary {
  const startUis = Array.isArray(data?.startUis)
    ? data.startUis.filter((item): item is GameStartUiSettings => Boolean(item && typeof item === "object"))
    : data?.startUi && typeof data.startUi === "object"
      ? [data.startUi]
      : [];
  return {
    assets: Array.isArray(data?.assets) ? data.assets : [],
    scenes: Array.isArray(data?.scenes) ? data.scenes : [],
    animationScenes: Array.isArray(data?.animationScenes)
      ? data.animationScenes.map(normalizeAnimationScene)
      : [],
    startUi: data?.startUi && typeof data.startUi === "object" ? data.startUi : startUis[0],
    startUis,
    flowGraph: data?.flowGraph && typeof data.flowGraph === "object"
      ? normalizeGameFlowGraph(data.flowGraph)
      : undefined,
  };
}

async function parseGameLibraryMutation(response: Response, fallbackError: string): Promise<{
  asset?: GameAsset;
  animationScene?: AnimationScene;
  scene?: GameScene;
  startUi?: GameStartUiSettings;
  startUis?: GameStartUiSettings[];
  flowGraph?: GameFlowGraph;
  library: GameLibrary;
}> {
  const data = await response.json().catch(() => ({})) as GameLibraryMutationResponse;
  if (!response.ok) throw new Error(data.error || fallbackError);
  return {
    asset: data.asset,
    animationScene: data.animationScene ? normalizeAnimationScene(data.animationScene) : undefined,
    scene: data.scene,
    startUi: data.startUi,
    startUis: data.startUis,
    flowGraph: data.flowGraph,
    library: normalizeGameLibrary(data.library),
  };
}

export async function fetchLatestSprite(): Promise<AnimationSprite | null> {
  const response = await fetch("/api/spritesheet/latest");
  const data = await response.json().catch(() => ({ sprite: null })) as LatestSpriteResponse;
  return data.sprite && Array.isArray(data.sprite.frames) ? data.sprite : null;
}

export async function fetchGameLibrary(): Promise<GameLibrary> {
  const response = await fetch("/api/game-library");
  const data = await response.json().catch(() => EMPTY_LIBRARY) as GameLibrary;
  return normalizeGameLibrary(data);
}

export async function saveGameAsset(asset: GameAsset, fallbackError = "Failed to save asset") {
  const response = await fetch("/api/game-library/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ asset }),
  });
  return parseGameLibraryMutation(response, fallbackError);
}

export async function deleteGameAsset(assetId: string, fallbackError = "Failed to delete asset") {
  const response = await fetch(`/api/game-library/assets/${assetId}`, { method: "DELETE" });
  return parseGameLibraryMutation(response, fallbackError);
}

export async function saveGameScene(scene: GameScene, fallbackError = "Failed to save scene") {
  const response = await fetch("/api/game-library/scenes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scene }),
  });
  return parseGameLibraryMutation(response, fallbackError);
}

export async function saveAnimationScene(animationScene: AnimationScene, fallbackError = "Failed to save animation scene") {
  const response = await fetch("/api/game-library/animation-scenes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ animationScene }),
  });
  return parseGameLibraryMutation(response, fallbackError);
}

export async function saveGameStartUi(startUi: GameStartUiSettings, fallbackError = "Failed to save Start UI") {
  const response = await fetch("/api/game-library/start-ui", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startUi }),
  });
  return parseGameLibraryMutation(response, fallbackError);
}

export async function deleteGameStartUi(startUiId: string, fallbackError = "Failed to delete Start UI") {
  const response = await fetch(`/api/game-library/start-ui/${encodeURIComponent(startUiId)}`, { method: "DELETE" });
  return parseGameLibraryMutation(response, fallbackError);
}

export async function deleteGameScene(sceneId: string, fallbackError = "Failed to delete scene") {
  const response = await fetch(`/api/game-library/scenes/${sceneId}`, { method: "DELETE" });
  return parseGameLibraryMutation(response, fallbackError);
}

export async function deleteAnimationScene(animationSceneId: string, fallbackError = "Failed to delete animation scene") {
  const response = await fetch(`/api/game-library/animation-scenes/${encodeURIComponent(animationSceneId)}`, { method: "DELETE" });
  return parseGameLibraryMutation(response, fallbackError);
}

export async function saveGameFlowGraph(flowGraph: GameFlowGraph, fallbackError = "Failed to save scene flow") {
  const response = await fetch("/api/game-library/flow", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flowGraph }),
  });
  return parseGameLibraryMutation(response, fallbackError);
}
