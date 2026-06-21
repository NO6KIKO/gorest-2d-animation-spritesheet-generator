import type { LayerLightingSettings, LayerShadowSettings } from "../../types";

type SceneInspectorLightingSectionProps = {
  lighting: LayerLightingSettings;
  shadow: LayerShadowSettings;
  onApplyNeonLighting: () => void;
  onClearLighting: () => void;
  onUpdateLighting: (patch: Partial<LayerLightingSettings>) => void;
  onUpdateShadow: (patch: Partial<LayerShadowSettings>) => void;
};

export function SceneInspectorLightingSection({
  lighting,
  shadow,
  onApplyNeonLighting,
  onClearLighting,
  onUpdateLighting,
  onUpdateShadow,
}: SceneInspectorLightingSectionProps) {
  return (
    <div className="compact-inspector-section">
      <em>Lighting</em>
      <div className="compact-action-row">
        <button type="button" onClick={onApplyNeonLighting}>Neon</button>
        <button type="button" onClick={onClearLighting}>Off</button>
      </div>
      <label>Brightness {lighting.brightness.toFixed(2)}</label>
      <input
        type="range"
        min="0.25"
        max="1.35"
        step="0.01"
        value={lighting.brightness}
        onChange={event => onUpdateLighting({ brightness: Number(event.target.value), preset: "neon-station" })}
      />
      <label>Contrast {lighting.contrast.toFixed(2)}</label>
      <input
        type="range"
        min="0.55"
        max="1.55"
        step="0.01"
        value={lighting.contrast}
        onChange={event => onUpdateLighting({ contrast: Number(event.target.value), preset: "neon-station" })}
      />
      <label>Saturation {lighting.saturate.toFixed(2)}</label>
      <input
        type="range"
        min="0.25"
        max="1.5"
        step="0.01"
        value={lighting.saturate}
        onChange={event => onUpdateLighting({ saturate: Number(event.target.value), preset: "neon-station" })}
      />
      <label>Edge Light {Math.round(lighting.edgeLightOpacity * 100)}%</label>
      <input
        type="range"
        min="0"
        max="0.75"
        step="0.01"
        value={lighting.edgeLightOpacity}
        onChange={event => onUpdateLighting({ edgeLightOpacity: Number(event.target.value), preset: "neon-station" })}
      />
      <label>Contact Shadow {Math.round(shadow.opacity * 100)}%</label>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={shadow.opacity}
        onChange={event => onUpdateShadow({ opacity: Number(event.target.value), enabled: Number(event.target.value) > 0 })}
      />
    </div>
  );
}
