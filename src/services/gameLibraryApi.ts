import type { AnimationSprite, GameAsset, GameLibrary, GameScene, GameStartUiSettings } from "../types";

type LatestSpriteResponse = {
  sprite?: AnimationSprite | null;
};

type GameLibraryMutationResponse = {
  asset?: GameAsset;
  scene?: GameScene;
  startUi?: GameStartUiSettings;
  library?: Partial<GameLibrary>;
  error?: string;
};

const EMPTY_LIBRARY: GameLibrary = {
  assets: [],
  scenes: [],
};

function normalizeGameLibrary(data?: Partial<GameLibrary>): GameLibrary {
  return {
    assets: Array.isArray(data?.assets) ? data.assets : [],
    scenes: Array.isArray(data?.scenes) ? data.scenes : [],
    startUi: data?.startUi && typeof data.startUi === "object" ? data.startUi : undefined,
  };
}

async function parseGameLibraryMutation(response: Response, fallbackError: string): Promise<{
  asset?: GameAsset;
  scene?: GameScene;
  startUi?: GameStartUiSettings;
  library: GameLibrary;
}> {
  const data = await response.json().catch(() => ({})) as GameLibraryMutationResponse;
  if (!response.ok) throw new Error(data.error || fallbackError);
  return {
    asset: data.asset,
    scene: data.scene,
    startUi: data.startUi,
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

export async function saveGameStartUi(startUi: GameStartUiSettings, fallbackError = "Failed to save Start UI") {
  const response = await fetch("/api/game-library/start-ui", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startUi }),
  });
  return parseGameLibraryMutation(response, fallbackError);
}

export async function deleteGameScene(sceneId: string, fallbackError = "Failed to delete scene") {
  const response = await fetch(`/api/game-library/scenes/${sceneId}`, { method: "DELETE" });
  return parseGameLibraryMutation(response, fallbackError);
}
