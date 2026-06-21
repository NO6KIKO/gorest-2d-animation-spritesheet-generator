import type { AnimationClip, GameAsset, LayerLightingSettings, LayerShadowSettings } from "../../types";

type VisualLayerAnimationLightingControlsProps = {
  asset?: GameAsset;
  lighting: LayerLightingSettings;
  selectedClip?: AnimationClip;
  shadow: LayerShadowSettings;
  getClipButtonText: (clip: AnimationClip) => string;
  onApplyNeonLighting: () => void;
  onClearLighting: () => void;
  onSetAnimation: (clip: AnimationClip) => void;
  onUpdateLighting: (patch: Partial<LayerLightingSettings>) => void;
  onUpdateShadow: (patch: Partial<LayerShadowSettings>) => void;
};

export function VisualLayerAnimationLightingControls({
  asset,
  lighting,
  selectedClip,
  shadow,
  getClipButtonText,
  onApplyNeonLighting,
  onClearLighting,
  onSetAnimation,
  onUpdateLighting,
  onUpdateShadow,
}: VisualLayerAnimationLightingControlsProps) {
  return (
    <>
      {asset?.animations?.length ? (
        <div className="clip-switcher">
          <label>Animation Clip</label>
          <div className="clip-buttons">
            {asset.animations.map(clip => (
              <button
                key={clip.id}
                type="button"
                className={clip.id === selectedClip?.id ? "active" : ""}
                onClick={() => onSetAnimation(clip)}
              >
                {getClipButtonText(clip)}
              </button>
            ))}
          </div>
          <div className="control-hint">A/D switches between left and right walk. Release the key to return to idle breathing.</div>
        </div>
      ) : null}
      <label>Character Brightness {lighting.brightness.toFixed(2)}</label>
      <input type="range" min="0.25" max="1.35" step="0.01" value={lighting.brightness} onChange={event => onUpdateLighting({ brightness: Number(event.target.value), preset: "neon-station" })} />
      <label>Character Contrast {lighting.contrast.toFixed(2)}</label>
      <input type="range" min="0.55" max="1.55" step="0.01" value={lighting.contrast} onChange={event => onUpdateLighting({ contrast: Number(event.target.value), preset: "neon-station" })} />
      <label>Character Saturation {lighting.saturate.toFixed(2)}</label>
      <input type="range" min="0.25" max="1.5" step="0.01" value={lighting.saturate} onChange={event => onUpdateLighting({ saturate: Number(event.target.value), preset: "neon-station" })} />
      <label>Red Edge Light {Math.round(lighting.edgeLightOpacity * 100)}%</label>
      <input type="range" min="0" max="0.75" step="0.01" value={lighting.edgeLightOpacity} onChange={event => onUpdateLighting({ edgeLightOpacity: Number(event.target.value), preset: "neon-station" })} />
      <label>Purple Rim Light {Math.round(lighting.rimLightOpacity * 100)}%</label>
      <input type="range" min="0" max="0.75" step="0.01" value={lighting.rimLightOpacity} onChange={event => onUpdateLighting({ rimLightOpacity: Number(event.target.value), preset: "neon-station" })} />
      <label>Contact Shadow {Math.round(shadow.opacity * 100)}%</label>
      <input type="range" min="0" max="1" step="0.01" value={shadow.opacity} onChange={event => onUpdateShadow({ opacity: Number(event.target.value), enabled: Number(event.target.value) > 0 })} />
      <label>Lighting Preset</label>
      <div className="lighting-buttons">
        <button type="button" onClick={onApplyNeonLighting}>Neon Station</button>
        <button type="button" onClick={onClearLighting}>Disable Lighting</button>
      </div>
      <div className="control-hint">Neon Station adds a soft contact shadow, darker ambient tint, and red/purple edge lighting.</div>
    </>
  );
}
