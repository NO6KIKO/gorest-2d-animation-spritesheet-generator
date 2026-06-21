import type { AnimationClip, AnimationSprite, GameAsset, SceneLayer } from "../../types";

export type SceneSpritesheetEntry = {
  key: string;
  layer: SceneLayer;
  asset: GameAsset;
  clip?: AnimationClip;
  sprite: AnimationSprite;
  frameWidth: number;
  frameHeight: number;
};
