import { forwardRef } from "react";
import type { SceneLightingSettings } from "../../types";

type SceneGlobalControlsProps = {
  cameraMax: number;
  cameraMaxY: number;
  cameraX: number;
  cameraY: number;
  lighting: SceneLightingSettings;
  sceneHeight: number;
  sceneWidth: number;
  viewportHeight: number;
  viewportWidth: number;
  onCameraXChange: (cameraX: number) => void;
  onCameraYChange: (cameraY: number) => void;
  onEnableFollowView: () => void;
  onLightingChange: (patch: Partial<SceneLightingSettings>) => void;
};

export const SceneGlobalControls = forwardRef<HTMLDivElement, SceneGlobalControlsProps>(function SceneGlobalControls({
  cameraMax,
  cameraMaxY,
  cameraX,
  cameraY,
  lighting,
  sceneHeight,
  sceneWidth,
  viewportHeight,
  viewportWidth,
  onCameraXChange,
  onCameraYChange,
  onEnableFollowView,
  onLightingChange,
}, ref) {
  const hasFollowScrollRoom = cameraMax > 0 || cameraMaxY > 0;

  return (
    <div ref={ref} className="scene-global-controls" aria-label="Scene global controls">
      <label className={hasFollowScrollRoom ? "" : "camera-follow-locked"}>
        <span>{hasFollowScrollRoom ? `Camera X ${Math.round(cameraX)} / ${cameraMax}` : `Follow locked: view ${Math.round(viewportWidth)}x${Math.round(viewportHeight)} / world ${Math.round(sceneWidth)}x${Math.round(sceneHeight)}`}</span>
        <input
          type="range"
          min="0"
          max={cameraMax}
          step="1"
          value={cameraX}
          onChange={event => onCameraXChange(Number(event.target.value))}
        />
        {!hasFollowScrollRoom && (sceneWidth > viewportWidth - 1 || sceneHeight > viewportHeight - 1) && (
          <button type="button" className="camera-follow-button" onClick={onEnableFollowView}>
            Enable Follow View
          </button>
        )}
      </label>
      {hasFollowScrollRoom && (
        <label>
          <span>Camera Y {Math.round(cameraY)} / {cameraMaxY}</span>
          <input
            type="range"
            min="0"
            max={cameraMaxY}
            step="1"
            value={cameraY}
            onChange={event => onCameraYChange(Number(event.target.value))}
          />
        </label>
      )}
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
