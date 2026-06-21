import type { AnimationSprite, GameAsset } from "../../types";

export type SheetOnlyGalleryEntry = {
  key: string;
  title: string;
  meta: string;
  sprite?: AnimationSprite;
  imageUrl?: string;
  asset?: GameAsset;
};
