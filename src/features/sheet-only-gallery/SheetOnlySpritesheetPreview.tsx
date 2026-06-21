import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { getFrameSize, spriteFrameTotal, spriteGridColumns, spriteGridRows } from "../../domain/sprites/spriteUtils";
import type { AnimationSprite } from "../../types";

type SheetSize = {
  width: number;
  height: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

type SheetOnlySpritesheetPreviewProps = {
  checkerStyle: CSSProperties;
  sheetDataUrl: string | null;
  sprite?: AnimationSprite;
  title: string;
  onGeneratePreview: () => void;
};

function clampFrameSize(value: number, max: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(Math.round(value), Math.max(1, max)));
}

function spriteSheetSize(sprite?: AnimationSprite): SheetSize | null {
  const [width, height] = sprite?.sheetSize || [];
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { width, height };
  }
  return null;
}

function inferFrameSize(sheetSize: SheetSize, sprite?: AnimationSprite) {
  if (sprite) {
    const [frameWidth, frameHeight] = getFrameSize(sprite);
    return { frameWidth, frameHeight };
  }

  if (sheetSize.width >= sheetSize.height) {
    const columns = Math.max(1, Math.round(sheetSize.width / Math.max(1, sheetSize.height)));
    return {
      frameWidth: Math.max(1, Math.floor(sheetSize.width / columns)),
      frameHeight: sheetSize.height,
    };
  }

  const rows = Math.max(1, Math.round(sheetSize.height / Math.max(1, sheetSize.width)));
  return {
    frameWidth: sheetSize.width,
    frameHeight: Math.max(1, Math.floor(sheetSize.height / rows)),
  };
}

function previewBoxSize(frameWidth: number, frameHeight: number, viewport: ViewportSize) {
  const ratio = Math.max(0.01, frameWidth / Math.max(1, frameHeight));
  const isCompact = viewport.width <= 760;
  const maxWidth = Math.min(viewport.width * (isCompact ? 0.88 : 0.7), isCompact ? 560 : 640);
  const maxHeight = Math.max(120, viewport.height - (isCompact ? 330 : 245));
  let width = maxWidth;
  let height = width / ratio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }

  return {
    height: Math.max(1, Math.round(height)),
    width: Math.max(1, Math.round(width)),
  };
}

export function SheetOnlySpritesheetPreview({
  checkerStyle,
  sheetDataUrl,
  sprite,
  title,
  onGeneratePreview,
}: SheetOnlySpritesheetPreviewProps) {
  const initialFrameSize = useMemo(() => sprite ? getFrameSize(sprite) : [256, 256], [sprite]);
  const [sheetSize, setSheetSize] = useState<SheetSize | null>(() => spriteSheetSize(sprite));
  const [frameWidth, setFrameWidth] = useState(initialFrameSize[0]);
  const [frameHeight, setFrameHeight] = useState(initialFrameSize[1]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 0, height: 0 });

  useEffect(() => {
    const nextSheetSize = spriteSheetSize(sprite);
    const [nextFrameWidth, nextFrameHeight] = sprite ? getFrameSize(sprite) : [256, 256];
    setSheetSize(nextSheetSize);
    setFrameWidth(nextFrameWidth);
    setFrameHeight(nextFrameHeight);
    setFrameIndex(0);
    setIsPlaying(true);
  }, [sheetDataUrl, sprite]);

  useEffect(() => {
    const updateViewportSize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);
    return () => window.removeEventListener("resize", updateViewportSize);
  }, []);

  useEffect(() => {
    if (!sheetDataUrl) return;

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const loadedSize = {
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      };
      setSheetSize(loadedSize);
      if (!sprite) {
        const inferred = inferFrameSize(loadedSize);
        setFrameWidth(inferred.frameWidth);
        setFrameHeight(inferred.frameHeight);
      }
    };
    image.src = sheetDataUrl;

    return () => {
      cancelled = true;
    };
  }, [sheetDataUrl, sprite]);

  useEffect(() => {
    if (!sheetSize) return;
    setFrameWidth(value => clampFrameSize(value, sheetSize.width));
    setFrameHeight(value => clampFrameSize(value, sheetSize.height));
  }, [sheetSize]);

  const safeFrameWidth = sheetSize ? clampFrameSize(frameWidth, sheetSize.width) : Math.max(1, frameWidth);
  const safeFrameHeight = sheetSize ? clampFrameSize(frameHeight, sheetSize.height) : Math.max(1, frameHeight);
  const columns = sheetSize
    ? Math.max(1, Math.floor(sheetSize.width / safeFrameWidth))
    : sprite ? spriteGridColumns(sprite) : 1;
  const rows = sheetSize
    ? Math.max(1, Math.floor(sheetSize.height / safeFrameHeight))
    : sprite ? spriteGridRows(sprite) : 1;
  const sheetFrameTotal = Math.max(1, columns * rows);
  const knownSpriteTotal = spriteFrameTotal(sprite);
  const frameTotal = knownSpriteTotal ? Math.min(knownSpriteTotal, sheetFrameTotal) : sheetFrameTotal;
  const activeFrameIndex = Math.min(frameIndex, Math.max(0, frameTotal - 1));
  const frameColumn = activeFrameIndex % columns;
  const frameRow = Math.floor(activeFrameIndex / columns);
  const previewSize = viewportSize.width && viewportSize.height
    ? previewBoxSize(safeFrameWidth, safeFrameHeight, viewportSize)
    : null;

  useEffect(() => {
    setFrameIndex(value => Math.min(value, Math.max(0, frameTotal - 1)));
  }, [frameTotal]);

  useEffect(() => {
    if (!isPlaying || frameTotal <= 1 || !sheetDataUrl) return;
    const id = window.setInterval(() => {
      setFrameIndex(value => (value + 1) % frameTotal);
    }, Math.max(80, Math.round(1000 / Math.max(1, sprite?.fps || 8))));
    return () => window.clearInterval(id);
  }, [frameTotal, isPlaying, sheetDataUrl, sprite?.fps]);

  const previewImageStyle: CSSProperties | undefined = sheetDataUrl && sheetSize ? {
    height: `${(sheetSize.height / safeFrameHeight) * 100}%`,
    transform: `translate(${-frameColumn * safeFrameWidth / sheetSize.width * 100}%, ${-frameRow * safeFrameHeight / sheetSize.height * 100}%)`,
    width: `${(sheetSize.width / safeFrameWidth) * 100}%`,
  } : undefined;

  const handleAutoSize = () => {
    if (!sheetSize) return;
    const inferred = inferFrameSize(sheetSize, sprite);
    setFrameWidth(inferred.frameWidth);
    setFrameHeight(inferred.frameHeight);
    setFrameIndex(0);
  };

  return (
    <div className="sheet-only-viewer">
      <section className="sheet-only-preview-stage" aria-label="Spritesheet frame preview">
        {sheetDataUrl ? (
          <div
            className="sheet-only-frame-preview"
            style={{
              ...checkerStyle,
              aspectRatio: `${safeFrameWidth} / ${safeFrameHeight}`,
              height: previewSize ? `${previewSize.height}px` : undefined,
              width: previewSize ? `${previewSize.width}px` : undefined,
            }}
          >
            {previewImageStyle ? (
              <img src={sheetDataUrl} alt={`${title} frame ${activeFrameIndex + 1}`} style={previewImageStyle} />
            ) : (
              <img src={sheetDataUrl} alt={`${title} spritesheet`} />
            )}
          </div>
        ) : (
          <button type="button" className="primary-button" onClick={onGeneratePreview}>
            Generate Sheet Preview
          </button>
        )}
      </section>

      {sheetDataUrl && (
        <section className="sheet-only-controls" aria-label="Spritesheet slicing controls">
          <div className="sheet-only-preview-copy">
            <strong>{title}</strong>
            <span>{activeFrameIndex + 1} / {frameTotal} frames / {columns} x {rows} grid</span>
          </div>
          <button type="button" className="sheet-only-icon-button" onClick={() => setIsPlaying(value => !value)}>
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button type="button" className="sheet-only-icon-button" onClick={handleAutoSize} disabled={!sheetSize}>
            <RotateCcw size={15} /> Auto
          </button>
          <label>
            Frame W
            <input
              type="number"
              min="1"
              max={sheetSize?.width || 4096}
              value={safeFrameWidth}
              onChange={event => setFrameWidth(clampFrameSize(Number(event.target.value), sheetSize?.width || 4096))}
            />
          </label>
          <label>
            Frame H
            <input
              type="number"
              min="1"
              max={sheetSize?.height || 4096}
              value={safeFrameHeight}
              onChange={event => setFrameHeight(clampFrameSize(Number(event.target.value), sheetSize?.height || 4096))}
            />
          </label>
          <label className="sheet-only-frame-range">
            Frame
            <input
              type="range"
              min="0"
              max={Math.max(0, frameTotal - 1)}
              step="1"
              value={activeFrameIndex}
              onChange={event => setFrameIndex(Number(event.target.value))}
            />
          </label>
        </section>
      )}
    </div>
  );
}
