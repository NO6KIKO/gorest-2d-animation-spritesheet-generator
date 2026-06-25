import { ArrowLeft, Layers, Plus, X } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { spriteFrame } from "../../domain/sprites/spriteUtils";
import type { AnimationSprite, GameAsset } from "../../types";
import { SheetOnlySpritesheetPreview } from "./SheetOnlySpritesheetPreview";
import type { SheetOnlyGalleryEntry } from "./types";

type SheetOnlyGalleryProps = {
  activeSpriteName: string;
  checkerStyle: CSSProperties;
  entries: SheetOnlyGalleryEntry[];
  hasSelection: boolean;
  selectionTitle: string;
  selectedSprite?: AnimationSprite;
  sheetDataUrl: string | null;
  onBack: () => void;
  onDeleteSpriteFrame: (frameIndex: number) => void;
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
  selectedSprite,
  sheetDataUrl,
  onBack,
  onDeleteSpriteFrame,
  onGeneratePreview,
  onSelectImage,
  onSelectSprite,
  onShowAll,
}: SheetOnlyGalleryProps) {
  const [isCodexModalOpen, setIsCodexModalOpen] = useState(false);

  return (
    <main className="sheet-only-screen">
      <button type="button" className="mode-back-button sheet-only-back" onClick={hasSelection ? onShowAll : onBack}>
        <ArrowLeft size={16} /> Back
      </button>
      {hasSelection && (
        <button type="button" className="mode-back-button sheet-only-grid-button" onClick={onShowAll}>
          <Layers size={16} /> All
        </button>
      )}
      {!hasSelection ? (
        <div className="sheet-only-gallery" aria-label="Repository spritesheet gallery">
          <button
            type="button"
            className="sheet-only-tile sheet-only-add-tile"
            aria-label="Open Codex upload request dialog"
            onClick={() => setIsCodexModalOpen(true)}
          >
            <Plus size={84} strokeWidth={1.4} />
          </button>
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
                  <img src={entry.imageUrl} alt="" loading="lazy" decoding="async" />
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
        <SheetOnlySpritesheetPreview
          checkerStyle={checkerStyle}
          sheetDataUrl={sheetDataUrl}
          sprite={selectedSprite}
          title={selectionTitle || activeSpriteName}
          onDeleteFrame={onDeleteSpriteFrame}
          onGeneratePreview={onGeneratePreview}
        />
      )}
      {!entries.length && !hasSelection && (
        <div className="sheet-only-empty">
          No repository images found.
        </div>
      )}
      {isCodexModalOpen && (
        <div className="sheet-only-modal-backdrop" role="presentation" onMouseDown={() => setIsCodexModalOpen(false)}>
          <section
            className="sheet-only-codex-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sheet-only-codex-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <button
              type="button"
              className="sheet-only-modal-close"
              aria-label="Close"
              onClick={() => setIsCodexModalOpen(false)}
            >
              <X size={18} />
            </button>
            <div className="sheet-only-modal-copy">
              <strong id="sheet-only-codex-title">Send it to Codex</strong>
              <span>Attach the source image in the Codex chat, then describe the animation or visual effect you want.</span>
            </div>
            <div className="sheet-only-modal-prompt">
              <span>Example</span>
              <p>Use this image as a spritesheet source. Create a clean idle animation preview, keep the character proportions, and slice it into even frames.</p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
