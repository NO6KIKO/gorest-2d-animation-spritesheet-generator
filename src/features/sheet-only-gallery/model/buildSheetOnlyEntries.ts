import { spriteFrameTotal } from "../../../domain/sprites/spriteUtils";
import type { RepositoryGeneratedImage } from "../../../services/generatedAssetsApi";
import type { AnimationSprite, GameAsset } from "../../../types";
import type { SheetOnlyGalleryEntry } from "../types";

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type BuildSheetOnlyEntriesOptions = {
  assets: GameAsset[];
  repositoryImages: RepositoryGeneratedImage[];
  sprites: AnimationSprite[];
};

export function buildSheetOnlyEntries({
  assets,
  repositoryImages,
  sprites,
}: BuildSheetOnlyEntriesOptions): SheetOnlyGalleryEntry[] {
  const entries: SheetOnlyGalleryEntry[] = [];
  const seen = new Set<string>();
  const remember = (keys: Array<string | undefined>) => {
    const normalized = keys.filter(Boolean) as string[];
    if (normalized.some(key => seen.has(key))) return false;
    normalized.forEach(key => seen.add(key));
    return true;
  };
  const addSprite = (sprite: AnimationSprite | undefined, title: string, meta: string, asset?: GameAsset) => {
    if (!sprite?.frames?.length) return;
    const source = sprite.rawSpritesheetPng || sprite.spritesheetPng;
    if (!remember([`sprite:${sprite.id}`, source ? `url:${source}` : undefined])) return;
    entries.push({
      key: `sprite_${sprite.id}`,
      title,
      meta,
      sprite,
      imageUrl: source,
      asset,
    });
  };

  assets.forEach(asset => {
    if (asset.animations?.length) {
      asset.animations.forEach(clip => {
        addSprite(
          clip.sprite,
          clip.name || asset.name,
          `${asset.role} / ${spriteFrameTotal(clip.sprite)} frames`,
          asset
        );
      });
      return;
    }
    addSprite(asset.sprite, asset.name, `${asset.role} / ${spriteFrameTotal(asset.sprite)} frames`, asset);
  });

  sprites.forEach(sprite => {
    addSprite(sprite, sprite.characterName, `${spriteFrameTotal(sprite)} frames`);
  });

  repositoryImages.forEach(image => {
    if (!remember([`url:${image.url}`])) return;
    entries.push({
      key: `file_${image.name}`,
      title: image.name.replace(/\.[^.]+$/, ""),
      meta: `${image.extension.toUpperCase()} / ${formatFileSize(image.size)}`,
      imageUrl: image.url,
    });
  });

  return entries;
}
