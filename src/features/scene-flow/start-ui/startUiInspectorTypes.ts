import type { GameStartUiEffects, GameStartUiLayer, GameStartUiSettings } from "../../../types";

export type PatchStartUiDraft = (patch: Partial<GameStartUiSettings>) => void;
export type PatchStartUiEffects = (patch: Partial<GameStartUiEffects>) => void;
export type PatchStartUiLayer = (layerId: string, patch: Partial<GameStartUiLayer>) => void;
