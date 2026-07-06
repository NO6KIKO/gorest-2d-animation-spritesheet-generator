import { Paintbrush, RotateCcw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  analyzeSpritesheetPalette,
  getPaletteChanges,
  hexToRgb,
  recolorSpritesheet,
  rgbToHsl,
  updateSwatchFromHsl,
  type SpritePaletteAnalysis,
  type SpritePaletteChange,
  type SpritePaletteSwatch,
} from "../../domain/sprites/spriteRecolor";

type SheetOnlyRecolorPanelProps = {
  sourceUrl: string;
  isSaving?: boolean;
  onPreviewChange: (dataUrl: string | null, changes: SpritePaletteChange[]) => void;
  onSaveVariant: () => void;
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function normalizeHexInput(value: string) {
  const rgb = hexToRgb(value);
  if (!rgb) return null;
  return `#${[rgb.r, rgb.g, rgb.b].map(channel => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function SheetOnlyRecolorPanel({
  sourceUrl,
  isSaving = false,
  onPreviewChange,
  onSaveVariant,
}: SheetOnlyRecolorPanelProps) {
  const [analysis, setAnalysis] = useState<SpritePaletteAnalysis | null>(null);
  const [swatches, setSwatches] = useState<SpritePaletteSwatch[]>([]);
  const [activeSwatchId, setActiveSwatchId] = useState("");
  const [status, setStatus] = useState<"idle" | "analyzing" | "ready" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setAnalysis(null);
    setSwatches([]);
    setActiveSwatchId("");
    setError("");
    onPreviewChange(null, []);

    if (!sourceUrl) {
      setStatus("idle");
      return () => {
        cancelled = true;
      };
    }

    setStatus("analyzing");
    analyzeSpritesheetPalette(sourceUrl)
      .then(nextAnalysis => {
        if (cancelled) return;
        setAnalysis(nextAnalysis);
        setSwatches(nextAnalysis.swatches);
        setActiveSwatchId(nextAnalysis.swatches[0]?.id || "");
        setStatus("ready");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setStatus("error");
        setError(err.message || "Palette analysis failed.");
      });

    return () => {
      cancelled = true;
    };
  }, [sourceUrl, onPreviewChange]);

  const changes = useMemo(() => getPaletteChanges(swatches), [swatches]);
  const changeSignature = useMemo(() => (
    changes.map(change => `${change.id}:${change.to}`).join("|")
  ), [changes]);
  const activeSwatch = swatches.find(swatch => swatch.id === activeSwatchId) || swatches[0];
  const activeColor = normalizeHexInput(activeSwatch?.targetHex || "") || "#000000";
  const activeHsl = useMemo(() => {
    const rgb = hexToRgb(activeColor);
    return rgb ? rgbToHsl(rgb) : { h: 0, s: 0, l: 0 };
  }, [activeColor]);

  useEffect(() => {
    const nextChanges = getPaletteChanges(swatches);
    if (!analysis || !nextChanges.length) {
      onPreviewChange(null, []);
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        onPreviewChange(recolorSpritesheet(analysis, swatches), nextChanges);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Recolor render failed.");
      }
    }, 40);

    return () => window.clearTimeout(timer);
  }, [analysis, changeSignature, onPreviewChange]);

  const updateActiveSwatch = (patch: Partial<SpritePaletteSwatch>) => {
    if (!activeSwatch) return;
    setSwatches(prev => prev.map(swatch => (
      swatch.id === activeSwatch.id ? { ...swatch, ...patch } : swatch
    )));
  };

  const updateActiveSwatchHsl = (patch: Parameters<typeof updateSwatchFromHsl>[1]) => {
    if (!activeSwatch) return;
    setSwatches(prev => prev.map(swatch => (
      swatch.id === activeSwatch.id ? updateSwatchFromHsl(swatch, patch) : swatch
    )));
  };

  const resetActiveSwatch = () => {
    if (!activeSwatch) return;
    updateActiveSwatch({ targetHex: activeSwatch.sourceHex });
  };

  const resetAll = () => {
    setSwatches(prev => prev.map(swatch => ({ ...swatch, targetHex: swatch.sourceHex })));
  };

  return (
    <section className="sheet-only-recolor-panel" aria-label="Spritesheet palette recolor">
      <div className="sheet-only-recolor-heading">
        <strong><Paintbrush size={14} /> Palette</strong>
        <span>{status === "analyzing" ? "Analyzing" : changes.length ? `${changes.length} changed` : "Original"}</span>
      </div>

      {status === "error" && <div className="sheet-only-recolor-error">{error}</div>}

      {status !== "error" && (
        <>
          <div className="sheet-only-palette-grid" aria-label="Detected spritesheet colors">
            {swatches.map(swatch => (
              <button
                type="button"
                key={swatch.id}
                className={swatch.id === activeSwatch?.id ? "active" : ""}
                title={`${swatch.name} ${swatch.sourceHex}`}
                style={{ backgroundColor: swatch.targetHex }}
                onClick={() => setActiveSwatchId(swatch.id)}
              />
            ))}
            {status === "analyzing" && Array.from({ length: 8 }, (_, index) => (
              <i key={index} />
            ))}
          </div>

          {activeSwatch && (
            <div className="sheet-only-color-editor">
              <div className="sheet-only-color-row">
                <label>
                  Target
                  <input
                    type="color"
                    value={activeColor}
                    onChange={event => updateActiveSwatch({ targetHex: event.target.value })}
                  />
                </label>
                <label>
                  Hex
                  <input
                    type="text"
                    value={activeSwatch.targetHex}
                    onChange={event => {
                      const hex = normalizeHexInput(event.target.value);
                      updateActiveSwatch({ targetHex: hex || event.target.value });
                    }}
                  />
                </label>
              </div>

              <label>
                Hue <span>{Math.round(activeHsl.h)}</span>
                <input
                  type="range"
                  min="0"
                  max="359"
                  step="1"
                  value={Math.round(activeHsl.h)}
                  onChange={event => updateActiveSwatchHsl({ h: Number(event.target.value) })}
                />
              </label>
              <label>
                Saturation <span>{formatPercent(activeHsl.s)}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={Math.round(activeHsl.s * 100)}
                  onChange={event => updateActiveSwatchHsl({ s: Number(event.target.value) / 100 })}
                />
              </label>
              <label>
                Lightness <span>{formatPercent(activeHsl.l)}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={Math.round(activeHsl.l * 100)}
                  onChange={event => updateActiveSwatchHsl({ l: Number(event.target.value) / 100 })}
                />
              </label>

              <div className="sheet-only-recolor-actions">
                <button type="button" onClick={resetActiveSwatch} disabled={!changes.some(change => change.id === activeSwatch.id)}>
                  <RotateCcw size={13} /> Color
                </button>
                <button type="button" onClick={resetAll} disabled={!changes.length}>
                  <RotateCcw size={13} /> All
                </button>
                <button type="button" onClick={onSaveVariant} disabled={!changes.length || isSaving}>
                  <Save size={13} /> {isSaving ? "Saving" : "Variant"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
