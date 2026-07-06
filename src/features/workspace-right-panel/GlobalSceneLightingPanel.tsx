import { Eye } from "lucide-react";
import type { SceneLightingSettings } from "../../types";

type GlobalSceneLightingPanelProps = {
  cameraMax: number;
  cameraMaxY: number;
  cameraX: number;
  cameraY: number;
  lighting: SceneLightingSettings;
  onApplyNeonStation: () => void;
  onCameraXChange: (value: number) => void;
  onCameraYChange: (value: number) => void;
  onDisableGlobalLighting: () => void;
  onLightingChange: (patch: Partial<SceneLightingSettings>) => void;
};

export function GlobalSceneLightingPanel({
  cameraMax,
  cameraMaxY,
  cameraX,
  cameraY,
  lighting,
  onApplyNeonStation,
  onCameraXChange,
  onCameraYChange,
  onDisableGlobalLighting,
  onLightingChange,
}: GlobalSceneLightingPanelProps) {
  return (
    <section>
      <div className="section-title"><Eye size={17} /> Global Scene Lighting</div>
      <div className="layer-controls">
        <label>Global Brightness {lighting.brightness.toFixed(2)}</label>
        <input type="range" min="0.45" max="1.35" step="0.01" value={lighting.brightness} onChange={event => onLightingChange({ brightness: Number(event.target.value) })} />
        <label>Global Contrast {lighting.contrast.toFixed(2)}</label>
        <input type="range" min="0.65" max="1.45" step="0.01" value={lighting.contrast} onChange={event => onLightingChange({ contrast: Number(event.target.value) })} />
        <label>Global Saturation {lighting.saturate.toFixed(2)}</label>
        <input type="range" min="0.35" max="1.5" step="0.01" value={lighting.saturate} onChange={event => onLightingChange({ saturate: Number(event.target.value) })} />
        <label>Magenta Ambience {Math.round(lighting.ambience * 100)}%</label>
        <input type="range" min="0" max="1" step="0.01" value={lighting.ambience} onChange={event => onLightingChange({ ambience: Number(event.target.value) })} />
        <label>Vignette {Math.round(lighting.vignette * 100)}%</label>
        <input type="range" min="0" max="0.75" step="0.01" value={lighting.vignette} onChange={event => onLightingChange({ vignette: Number(event.target.value) })} />
        <label>Neon Glow {lighting.glow.toFixed(2)}</label>
        <input type="range" min="0.25" max="1.8" step="0.01" value={lighting.glow} onChange={event => onLightingChange({ glow: Number(event.target.value) })} />
        <label>Explore Camera X {Math.round(cameraX)} / {cameraMax}</label>
        <input type="range" min="0" max={cameraMax} step="1" value={cameraX} onChange={event => onCameraXChange(Number(event.target.value))} />
        <label>Explore Camera Y {Math.round(cameraY)} / {cameraMaxY}</label>
        <input type="range" min="0" max={cameraMaxY} step="1" value={cameraY} onChange={event => onCameraYChange(Number(event.target.value))} />
        <div className="lighting-buttons">
          <button type="button" onClick={onApplyNeonStation}>Neon Station</button>
          <button type="button" onClick={onDisableGlobalLighting}>Disable Global</button>
        </div>
      </div>
    </section>
  );
}
