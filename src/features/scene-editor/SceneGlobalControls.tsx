import { forwardRef } from "react";
import type { SceneLightingSettings } from "../../types";

type SceneGlobalControlsProps = {
  cameraMax: number;
  cameraX: number;
  lighting: SceneLightingSettings;
  onCameraXChange: (cameraX: number) => void;
  onLightingChange: (patch: Partial<SceneLightingSettings>) => void;
};

export const SceneGlobalControls = forwardRef<HTMLDivElement, SceneGlobalControlsProps>(function SceneGlobalControls({
  cameraMax,
  cameraX,
  lighting,
  onCameraXChange,
  onLightingChange,
}, ref) {
  return (
    <div ref={ref} className="scene-global-controls" aria-label="Scene global controls">
      <label>
        <span>Camera X {Math.round(cameraX)} / {cameraMax}</span>
        <input
          type="range"
          min="0"
          max={cameraMax}
          step="1"
          value={cameraX}
          onChange={event => onCameraXChange(Number(event.target.value))}
        />
      </label>
      <label>
        <span>Global Brightness {lighting.brightness.toFixed(2)}</span>
        <input
          type="range"
          min="0.45"
          max="1.35"
          step="0.01"
          value={lighting.brightness}
          onChange={event => onLightingChange({ brightness: Number(event.target.value) })}
        />
      </label>
      <label>
        <span>Magenta Ambience {Math.round(lighting.ambience * 100)}%</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={lighting.ambience}
          onChange={event => onLightingChange({ ambience: Number(event.target.value) })}
        />
      </label>
      <label>
        <span>Glow {lighting.glow.toFixed(2)}</span>
        <input
          type="range"
          min="0.5"
          max="1.8"
          step="0.01"
          value={lighting.glow}
          onChange={event => onLightingChange({ glow: Number(event.target.value) })}
        />
      </label>
      <label>
        <span>Vignette {Math.round(lighting.vignette * 100)}%</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={lighting.vignette}
          onChange={event => onLightingChange({ vignette: Number(event.target.value) })}
        />
      </label>
    </div>
  );
});
