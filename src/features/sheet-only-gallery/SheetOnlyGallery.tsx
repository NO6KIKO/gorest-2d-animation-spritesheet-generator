import { ArrowLeft, Layers, Plus } from "lucide-react";
import type { CSSProperties } from "react";
import { spriteFrame } from "../../domain/sprites/spriteUtils";
import type { AnimationSprite, GameAsset } from "../../types";
import type { SheetOnlyGalleryEntry } from "./types";

type SheetOnlyGalleryProps = {
  activeSpriteName: string;
  checkerStyle: CSSProperties;
  entries: SheetOnlyGalleryEntry[];
  hasSelection: boolean;
  selectionTitle: string;
  sheetDataUrl: string | null;
  onBack: () => void;
  onGeneratePreview: () => void;
  onSelectImage: (imageUrl: string, title: string) => void;
  onSelectSprite: (sprite: AnimationSprite, title: string, asset?: GameAsset) => void;
  onShowAll: () => void;
};

export function SheetOnlyGallery({
  activeSpriteName,
  checkerStyle,
  entries,
  hasSelection,
  selectionTitle,
  sheetDataUrl,
  onBack,
  onGeneratePreview,
  onSelectImage,
  onSelectSprite,
  onShowAll,
}: SheetOnlyGalleryProps) {
  return (
    <main className="sheet-only-screen">
      <button type="button" className="mode-back-button sheet-only-back" onClick={onBack}>
        <ArrowLeft size={16} /> Back
      </button>
      {hasSelection && (
        <button type="button" className="mode-back-button sheet-only-grid-button" onClick={onShowAll}>
          <Layers size={16} /> All
        </button>
      )}
      {!hasSelection ? (
        <div className="sheet-only-gallery" aria-label="Repository spritesheet gallery">
          <div className="sheet-only-tile sheet-only-add-tile" aria-label="Add spritesheet placeholder">
            <Plus size={84} strokeWidth={1.4} />
          </div>
          {entries.map(entry => (
            <button
              type="button"
              key={entry.key}
              className="sheet-only-tile"
              onClick={() => {
                if (entry.sprite) onSelectSprite(entry.sprite, entry.title, entry.asset);
                else if (entry.imageUrl) onSelectImage(entry.imageUrl, entry.title);
              }}
            >
              <span className="sheet-only-thumb" style={checkerStyle}>
                {entry.imageUrl ? (
                  <img src={entry.imageUrl} alt="" />
                ) : entry.sprite ? (
                  <span dangerouslySetInnerHTML={{ __html: spriteFrame(entry.sprite, 0) }} />
                ) : null}
              </span>
              <span className="sheet-only-tile-copy">
                <strong>{entry.title}</strong>
                <small>{entry.meta}</small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="sheet-only-canvas">
          {sheetDataUrl ? (
            <img src={sheetDataUrl} alt={`${selectionTitle || activeSpriteName} spritesheet`} />
          ) : (
            <button type="button" className="primary-button" onClick={onGeneratePreview}>
              Generate Sheet Preview
            </button>
          )}
        </div>
      )}
      {!entries.length && !hasSelection && (
        <div className="sheet-only-empty">
          No repository images found.
        </div>
      )}
    </main>
  );
}
