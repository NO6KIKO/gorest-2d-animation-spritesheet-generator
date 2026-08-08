import { ChevronDown, Download, FileImage, Film, Pause, Play, RotateCcw, Trash2, Video } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { downloadUrl } from "../../app/downloads";
import {
  getFrameSize,
  spriteFrame,
  spriteFrameTotal,
  spriteGridColumns,
  spriteGridRows,
  spritesheetFrameThumbStyle,
} from "../../domain/sprites/spriteUtils";
import type { SpritePaletteChange } from "../../domain/sprites/spriteRecolor";
import type { AnimationSprite } from "../../types";
import { exportSpriteGif, exportSpriteVideo, type SpriteMediaExportSettings } from "./exportSpriteMedia";
import { SheetOnlyRecolorPanel } from "./SheetOnlyRecolorPanel";

type SheetSize = {
  width: number;
  height: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

type ObjectRotateDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  startAzimuth: number;
  startElevation: number;
};

type SheetOnlySpritesheetPreviewProps = {
  checkerStyle: CSSProperties;
  sheetDataUrl: string | null;
  sprite?: AnimationSprite;
  title: string;
  isSavingRecolorVariant?: boolean;
  onDeleteFrame?: (frameIndex: number) => void;
  onGeneratePreview: () => void;
  onSaveRecolorVariant?: (request: SheetOnlyRecolorSaveRequest) => void;
};

export type SheetOnlyRecolorSaveRequest = {
  dataUrl: string;
  sourceUrl: string;
  title: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  columns: number;
  sheetWidth: number;
  sheetHeight: number;
  paletteChanges: SpritePaletteChange[];
};

const SOURCE_PREVIEW_MAX_HEIGHT = 296;

function wrapIndex(value: number, total: number) {
  const safeTotal = Math.max(1, total);
  return ((value % safeTotal) + safeTotal) % safeTotal;
}

function objectRotateInitialFrame(sprite?: AnimationSprite) {
  if (sprite?.viewMode !== "object-rotate") return 0;
  const frameTotal = Math.max(1, spriteFrameTotal(sprite));
  const azimuthFrames = Math.max(1, Math.min(frameTotal, Math.round(sprite.viewAzimuthFrames || frameTotal)));
  const elevationFrames = Math.max(1, Math.min(Math.ceil(frameTotal / azimuthFrames), Math.round(sprite.viewElevationFrames || 1)));
  const azimuth = wrapIndex(Math.round(sprite.viewInitialAzimuth || 0), azimuthFrames);
  const elevation = Math.max(0, Math.min(elevationFrames - 1, Math.round(sprite.viewInitialElevation || 0)));
  return Math.min(frameTotal - 1, elevation * azimuthFrames + azimuth);
}

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

function safeFilename(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    || "spritesheet";
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

function sourceFrameThumbStyle(sourceUrl: string, columns: number, rows: number, frameIndex: number): CSSProperties {
  const column = frameIndex % columns;
  const row = Math.floor(frameIndex / columns);
  const x = columns <= 1 ? 0 : (column / (columns - 1)) * 100;
  const y = rows <= 1 ? 0 : (row / (rows - 1)) * 100;
  return {
    backgroundImage: `url("${sourceUrl.replace(/["\\]/g, "\\$&")}")`,
    backgroundPosition: `${x}% ${y}%`,
    backgroundSize: `${columns * 100}% ${rows * 100}%`,
  };
}

function frameSvgThumbStyle(frameSvg: string): CSSProperties | undefined {
  const viewBoxMatch = frameSvg.match(/viewBox="([\d.\-\s]+)"/);
  const imageMatch = frameSvg.match(/<image[^>]+href="([^"]+)"[^>]*>/);
  if (!viewBoxMatch || !imageMatch) return undefined;

  const [x, y, frameWidth, frameHeight] = viewBoxMatch[1].trim().split(/\s+/).map(Number);
  if (![x, y, frameWidth, frameHeight].every(Number.isFinite) || frameWidth <= 0 || frameHeight <= 0) return undefined;

  const imageTag = imageMatch[0];
  const widthMatch = imageTag.match(/\bwidth="([\d.]+)"/);
  const heightMatch = imageTag.match(/\bheight="([\d.]+)"/);
  const sheetWidth = Number(widthMatch?.[1]);
  const sheetHeight = Number(heightMatch?.[1]);
  if (!Number.isFinite(sheetWidth) || !Number.isFinite(sheetHeight) || sheetWidth <= 0 || sheetHeight <= 0) return undefined;

  const positionX = sheetWidth <= frameWidth ? 0 : (x / (sheetWidth - frameWidth)) * 100;
  const positionY = sheetHeight <= frameHeight ? 0 : (y / (sheetHeight - frameHeight)) * 100;
  return {
    backgroundImage: `url("${imageMatch[1].replace(/["\\]/g, "\\$&")}")`,
    backgroundPosition: `${positionX}% ${positionY}%`,
    backgroundSize: `${sheetWidth / frameWidth * 100}% ${sheetHeight / frameHeight * 100}%`,
  };
}

function sourceActiveFrameBoxStyle(
  frameSvg: string,
  sheetSize: SheetSize | null,
  fallback: CSSProperties | undefined
): CSSProperties | undefined {
  if (!frameSvg || !sheetSize) return fallback;
  const match = frameSvg.match(/viewBox="([\d.\-\s]+)"/);
  if (!match) return fallback;
  const [x, y, width, height] = match[1].trim().split(/\s+/).map(Number);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return fallback;
  return {
    height: `${height / sheetSize.height * 100}%`,
    left: `${x / sheetSize.width * 100}%`,
    top: `${y / sheetSize.height * 100}%`,
    width: `${width / sheetSize.width * 100}%`,
  };
}

function sourcePreviewSizeStyle(sheetSize: SheetSize | null): CSSProperties | undefined {
  if (!sheetSize) return undefined;
  const ratio = sheetSize.width / sheetSize.height;
  if (!Number.isFinite(ratio) || ratio <= 0) return undefined;
  return {
    aspectRatio: `${sheetSize.width} / ${sheetSize.height}`,
    width: `min(100%, ${Math.round(SOURCE_PREVIEW_MAX_HEIGHT * ratio)}px)`,
  };
}

export function SheetOnlySpritesheetPreview({
  checkerStyle,
  sheetDataUrl,
  sprite,
  title,
  isSavingRecolorVariant = false,
  onDeleteFrame,
  onGeneratePreview,
  onSaveRecolorVariant,
}: SheetOnlySpritesheetPreviewProps) {
  const initialFrameSize = useMemo(() => sprite ? getFrameSize(sprite) : [256, 256], [sprite]);
  const [sheetSize, setSheetSize] = useState<SheetSize | null>(() => spriteSheetSize(sprite));
  const [frameWidth, setFrameWidth] = useState(initialFrameSize[0]);
  const [frameHeight, setFrameHeight] = useState(initialFrameSize[1]);
  const [frameIndex, setFrameIndex] = useState(() => objectRotateInitialFrame(sprite));
  const [isPlaying, setIsPlaying] = useState(() => sprite?.viewMode !== "object-rotate");
  const [isObjectRotateDragging, setIsObjectRotateDragging] = useState(false);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<"" | "gif" | "video">("");
  const [downloadError, setDownloadError] = useState("");
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const [recolorPreviewUrl, setRecolorPreviewUrl] = useState<string | null>(null);
  const [recolorChanges, setRecolorChanges] = useState<SpritePaletteChange[]>([]);
  const objectRotateDragRef = useRef<ObjectRotateDrag | null>(null);

  useEffect(() => {
    const nextSheetSize = spriteSheetSize(sprite);
    const [nextFrameWidth, nextFrameHeight] = sprite ? getFrameSize(sprite) : [256, 256];
    setSheetSize(nextSheetSize);
    setFrameWidth(nextFrameWidth);
    setFrameHeight(nextFrameHeight);
    setFrameIndex(objectRotateInitialFrame(sprite));
    setIsPlaying(sprite?.viewMode !== "object-rotate");
    setIsObjectRotateDragging(false);
    objectRotateDragRef.current = null;
    setIsDownloadMenuOpen(false);
    setDownloadError("");
    setRecolorPreviewUrl(null);
    setRecolorChanges([]);
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
  const isObjectRotate = sprite?.viewMode === "object-rotate";
  const objectRotateAzimuthFrames = isObjectRotate
    ? Math.max(1, Math.min(frameTotal, Math.round(sprite.viewAzimuthFrames || frameTotal)))
    : frameTotal;
  const objectRotateElevationFrames = isObjectRotate
    ? Math.max(1, Math.min(Math.ceil(frameTotal / objectRotateAzimuthFrames), Math.round(sprite.viewElevationFrames || 1)))
    : 1;
  const objectRotateAzimuth = activeFrameIndex % objectRotateAzimuthFrames;
  const objectRotateElevation = Math.min(
    objectRotateElevationFrames - 1,
    Math.floor(activeFrameIndex / objectRotateAzimuthFrames)
  );
  const objectRotateAzimuthDegrees = Math.round(objectRotateAzimuth / objectRotateAzimuthFrames * 360);
  const objectRotateElevationDegrees = sprite?.viewElevationAngles?.[objectRotateElevation]
    ?? (objectRotateElevationFrames <= 1
      ? 0
      : Math.round(60 - objectRotateElevation / (objectRotateElevationFrames - 1) * 120));
  const objectRotateElevationLabel = `${objectRotateElevationDegrees > 0 ? "+" : ""}${objectRotateElevationDegrees}°`;
  const frameColumn = activeFrameIndex % columns;
  const frameRow = Math.floor(activeFrameIndex / columns);
  const previewSize = viewportSize.width && viewportSize.height
    ? previewBoxSize(safeFrameWidth, safeFrameHeight, viewportSize)
    : null;
  const displayedSheetDataUrl = recolorPreviewUrl || sheetDataUrl;
  const downloadSourceUrl = displayedSheetDataUrl || sprite?.rawSpritesheetPng || sprite?.spritesheetPng || "";
  const downloadBaseName = safeFilename(title || sprite?.characterName || "spritesheet");
  const activeSpriteFrame = !recolorPreviewUrl && sprite ? spriteFrame(sprite, activeFrameIndex) : "";
  const canDeleteFrame = Boolean(sprite?.frames?.length && onDeleteFrame && frameTotal > 1);

  const handleObjectRotatePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isObjectRotate || frameTotal <= 1 || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    objectRotateDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startAzimuth: objectRotateAzimuth,
      startElevation: objectRotateElevation,
    };
    setIsPlaying(false);
    setIsObjectRotateDragging(true);
  };

  const handleObjectRotatePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = objectRotateDragRef.current;
    if (!isObjectRotate || !drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const horizontalSensitivity = Math.max(4, Math.round(sprite?.viewDragSensitivity || 18));
    const verticalSensitivity = Math.max(
      12,
      Math.round(sprite?.viewVerticalDragSensitivity || horizontalSensitivity * 3)
    );
    const azimuthStep = Math.round((event.clientX - drag.startX) / horizontalSensitivity);
    // Turntable dragging follows direct manipulation: moving the pointer up
    // moves toward the lower sheet rows, while moving it down moves upward.
    const elevationStep = -Math.round((event.clientY - drag.startY) / verticalSensitivity);
    const nextAzimuth = wrapIndex(drag.startAzimuth + azimuthStep, objectRotateAzimuthFrames);
    const nextElevation = Math.max(
      0,
      Math.min(objectRotateElevationFrames - 1, drag.startElevation + elevationStep)
    );
    setFrameIndex(Math.min(frameTotal - 1, nextElevation * objectRotateAzimuthFrames + nextAzimuth));
  };

  const finishObjectRotateDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = objectRotateDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    objectRotateDragRef.current = null;
    setIsObjectRotateDragging(false);
  };

  useEffect(() => {
    setFrameIndex(value => Math.min(value, Math.max(0, frameTotal - 1)));
  }, [frameTotal]);

  useEffect(() => {
    if (!isPlaying || frameTotal <= 1 || !displayedSheetDataUrl) return;
    const id = window.setInterval(() => {
      setFrameIndex(value => {
        if (!isObjectRotate) return (value + 1) % frameTotal;
        const elevation = Math.min(
          objectRotateElevationFrames - 1,
          Math.floor(value / objectRotateAzimuthFrames)
        );
        const azimuth = wrapIndex(value + 1, objectRotateAzimuthFrames);
        return Math.min(frameTotal - 1, elevation * objectRotateAzimuthFrames + azimuth);
      });
    }, Math.max(80, Math.round(1000 / Math.max(1, sprite?.fps || 8))));
    return () => window.clearInterval(id);
  }, [displayedSheetDataUrl, frameTotal, isObjectRotate, isPlaying, objectRotateAzimuthFrames, objectRotateElevationFrames, sprite?.fps]);

  const previewImageStyle: CSSProperties | undefined = displayedSheetDataUrl && sheetSize ? {
    height: `${(sheetSize.height / safeFrameHeight) * 100}%`,
    transform: `translate(${-frameColumn * safeFrameWidth / sheetSize.width * 100}%, ${-frameRow * safeFrameHeight / sheetSize.height * 100}%)`,
    width: `${(sheetSize.width / safeFrameWidth) * 100}%`,
  } : undefined;
  const sourceActiveFrameFallbackStyle: CSSProperties | undefined = sheetSize ? {
    height: `${safeFrameHeight / sheetSize.height * 100}%`,
    left: `${frameColumn * safeFrameWidth / sheetSize.width * 100}%`,
    top: `${frameRow * safeFrameHeight / sheetSize.height * 100}%`,
    width: `${safeFrameWidth / sheetSize.width * 100}%`,
  } : undefined;
  const sourceActiveFrameStyle = sourceActiveFrameBoxStyle(activeSpriteFrame, sheetSize, sourceActiveFrameFallbackStyle);

  const handleAutoSize = () => {
    if (!sheetSize) return;
    const inferred = inferFrameSize(sheetSize, sprite);
    setFrameWidth(inferred.frameWidth);
    setFrameHeight(inferred.frameHeight);
    setFrameIndex(0);
  };

  const mediaExportSettings = (extension: string): SpriteMediaExportSettings => ({
    columns,
    filename: `${downloadBaseName}_${frameTotal}f.${extension}`,
    fps: Math.max(1, Math.round(sprite?.fps || 8)),
    frameCount: frameTotal,
    frameHeight: safeFrameHeight,
    frameWidth: safeFrameWidth,
    sourceUrl: downloadSourceUrl,
  });

  const handleRecolorPreviewChange = useCallback((dataUrl: string | null, changes: SpritePaletteChange[]) => {
    setRecolorPreviewUrl(dataUrl);
    setRecolorChanges(changes);
  }, []);

  const handleSaveRecolorVariant = () => {
    if (!onSaveRecolorVariant || !recolorPreviewUrl || !sheetSize) return;
    onSaveRecolorVariant({
      dataUrl: recolorPreviewUrl,
      sourceUrl: sheetDataUrl || "",
      title,
      frameWidth: safeFrameWidth,
      frameHeight: safeFrameHeight,
      frameCount: frameTotal,
      columns,
      sheetWidth: sheetSize.width,
      sheetHeight: sheetSize.height,
      paletteChanges: recolorChanges,
    });
  };

  const handleDownloadSheet = () => {
    if (!downloadSourceUrl) return;
    setDownloadError("");
    setIsDownloadMenuOpen(false);
    downloadUrl(downloadSourceUrl, `${downloadBaseName}_spritesheet.png`);
  };

  const handleExportMedia = (kind: "gif" | "video") => {
    if (!downloadSourceUrl) return;
    setDownloadError("");
    setIsDownloadMenuOpen(false);
    setExportStatus(kind);
    try {
      if (kind === "gif") {
        exportSpriteGif(mediaExportSettings("gif"));
      } else {
        exportSpriteVideo(mediaExportSettings("webm"));
      }
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Export failed.");
    } finally {
      window.setTimeout(() => setExportStatus(""), 1500);
    }
  };

  return (
    <div className="sheet-only-viewer">
      <section className="sheet-only-preview-stage" aria-label="Spritesheet frame preview">
        {displayedSheetDataUrl ? (
          <div
            className={`sheet-only-frame-preview ${isObjectRotate ? "object-rotate" : ""} ${isObjectRotateDragging ? "dragging" : ""}`}
            onPointerDown={handleObjectRotatePointerDown}
            onPointerMove={handleObjectRotatePointerMove}
            onPointerUp={finishObjectRotateDrag}
            onPointerCancel={finishObjectRotateDrag}
            style={{
              ...checkerStyle,
              aspectRatio: `${safeFrameWidth} / ${safeFrameHeight}`,
              height: previewSize ? `${previewSize.height}px` : undefined,
              width: previewSize ? `${previewSize.width}px` : undefined,
            }}
            title={isObjectRotate ? "Hold the left mouse button and drag to rotate" : undefined}
          >
            {activeSpriteFrame ? (
              <div className="sheet-only-frame-svg" dangerouslySetInnerHTML={{ __html: activeSpriteFrame }} />
            ) : previewImageStyle ? (
              <img src={displayedSheetDataUrl} alt={`${title} frame ${activeFrameIndex + 1}`} style={previewImageStyle} />
            ) : (
              <img src={displayedSheetDataUrl} alt={`${title} spritesheet`} />
            )}
            {isObjectRotate && (
              <div className="sheet-only-object-rotate-hud" aria-hidden="true">
                <span>Drag ↔ / ↕ to rotate</span>
                <strong>{objectRotateAzimuthDegrees}° · {objectRotateElevationLabel}</strong>
              </div>
            )}
          </div>
        ) : (
          <button type="button" className="primary-button" onClick={onGeneratePreview}>
            Generate Sheet Preview
          </button>
        )}
      </section>

      {sheetDataUrl && (
        <SheetOnlyRecolorPanel
          sourceUrl={sheetDataUrl}
          isSaving={isSavingRecolorVariant}
          onPreviewChange={handleRecolorPreviewChange}
          onSaveVariant={handleSaveRecolorVariant}
        />
      )}

      {displayedSheetDataUrl && (
        <aside className="sheet-only-slice-panel" aria-label="Spritesheet frame tools">
          <div className="sheet-only-source-header">
            <strong>P1 / Source</strong>
            <span>{recolorPreviewUrl ? "Recolor" : sheetSize ? `${sheetSize.width} x ${sheetSize.height}` : ""}</span>
          </div>
          <div
            className="sheet-only-source-preview"
            style={{
              ...checkerStyle,
              ...sourcePreviewSizeStyle(sheetSize),
            }}
          >
            <img src={displayedSheetDataUrl} alt={`${title} source spritesheet`} />
            {sourceActiveFrameStyle && <span className="sheet-only-source-active-frame" style={sourceActiveFrameStyle} />}
          </div>

          <div className="sheet-only-frames-header">
            <strong>Frames</strong>
            <span>{frameTotal} / {frameTotal}</span>
          </div>
          <div className="sheet-only-frames-grid">
            {Array.from({ length: frameTotal }, (_, frameListIndex) => {
              const frameSvg = !recolorPreviewUrl && sprite ? spriteFrame(sprite, frameListIndex) : "";
              const svgThumbStyle = frameSvg ? frameSvgThumbStyle(frameSvg) : undefined;
              const spriteThumbStyle = !recolorPreviewUrl && sprite ? spritesheetFrameThumbStyle(sprite, frameListIndex) : undefined;
              const sourceThumbStyle = !frameSvg && displayedSheetDataUrl
                ? sourceFrameThumbStyle(downloadSourceUrl, columns, rows, frameListIndex)
                : undefined;
              const thumbStyle = svgThumbStyle || spriteThumbStyle || sourceThumbStyle;
              return (
                <div
                  key={`${sprite?.id || downloadSourceUrl}_${frameListIndex}`}
                  className={`sheet-only-frame-tile ${frameListIndex === activeFrameIndex ? "active" : ""}`}
                >
                  <button
                    type="button"
                    className="sheet-only-frame-select"
                    style={{ aspectRatio: `${safeFrameWidth} / ${safeFrameHeight}` }}
                    onClick={() => setFrameIndex(frameListIndex)}
                    title={`Frame ${frameListIndex + 1}`}
                  >
                    <span className="sheet-only-frame-thumb" style={thumbStyle} />
                  </button>
                  <div className="sheet-only-frame-meta">
                    <span>Frame {frameListIndex + 1}</span>
                    <button
                      type="button"
                      aria-label={`Delete frame ${frameListIndex + 1}`}
                      title="Delete frame"
                      disabled={!canDeleteFrame}
                      onClick={() => onDeleteFrame?.(frameListIndex)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      )}

      {displayedSheetDataUrl && (
        <section className="sheet-only-controls" aria-label="Spritesheet slicing controls">
          <div className="sheet-only-preview-copy">
            <strong>{title}</strong>
            <span>
              {isObjectRotate
                ? `${activeFrameIndex + 1} / ${frameTotal} views / ${objectRotateAzimuthDegrees}° azimuth / ${objectRotateElevationLabel} elevation`
                : `${activeFrameIndex + 1} / ${frameTotal} frames / ${columns} x ${rows} grid`}
            </span>
          </div>
          <div className="sheet-only-download-control">
            <button
              type="button"
              className="sheet-only-icon-button sheet-only-download-button"
              aria-expanded={isDownloadMenuOpen}
              aria-haspopup="menu"
              title="Download"
              disabled={!downloadSourceUrl || Boolean(exportStatus)}
              onClick={() => setIsDownloadMenuOpen(value => !value)}
            >
              <Download size={15} />
              {exportStatus ? "Exporting" : "Download"}
              <ChevronDown size={13} />
            </button>
            {isDownloadMenuOpen && (
              <div className="sheet-only-download-menu" role="menu">
                <button type="button" role="menuitem" onClick={handleDownloadSheet}>
                  <FileImage size={14} /> Spritesheet
                </button>
                <button type="button" role="menuitem" onClick={() => handleExportMedia("gif")}>
                  <Film size={14} /> GIF
                </button>
                <button type="button" role="menuitem" onClick={() => handleExportMedia("video")}>
                  <Video size={14} /> Video
                </button>
              </div>
            )}
            {downloadError && <span className="sheet-only-download-error">{downloadError}</span>}
          </div>
          <button type="button" className="sheet-only-icon-button" onClick={() => setIsPlaying(value => !value)}>
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            {isObjectRotate ? (isPlaying ? "Stop rotate" : "Auto rotate") : (isPlaying ? "Pause" : "Play")}
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
