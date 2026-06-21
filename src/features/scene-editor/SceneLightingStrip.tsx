import type { LayerLightingSettings, LayerShadowSettings, SceneLightingSettings } from "../../types";

type SceneLightingStripProps = {
  cameraMax: number;
  cameraX: number;
  hasUnlockedVisualLayer: boolean;
  layerLighting: LayerLightingSettings;
  layerShadow: LayerShadowSettings;
  sceneLighting: SceneLightingSettings;
  onCameraXChange: (value: number) => void;
  onLayerLightingChange: (patch: Partial<LayerLightingSettings>) => void;
  onLayerShadowChange: (patch: Partial<LayerShadowSettings>) => void;
  onSceneLightingChange: (patch: Partial<SceneLightingSettings>) => void;
};

export function SceneLightingStrip({
  cameraMax,
  cameraX,
  hasUnlockedVisualLayer,
  layerLighting,
  layerShadow,
  sceneLighting,
  onCameraXChange,
  onLayerLightingChange,
  onLayerShadowChange,
  onSceneLightingChange,
}: SceneLightingStripProps) {
  return (
    <div className="lighting-strip">
      <label>Global Brightness {sceneLighting.brightness.toFixed(2)}<input type="range" min="0.45" max="1.35" step="0.01" value={sceneLighting.brightness} onChange={event => onSceneLightingChange({ brightness: Number(event.target.value) })} /></label>
      <label>Magenta Ambience {Math.round(sceneLighting.ambience * 100)}%<input type="range" min="0" max="1" step="0.01" value={sceneLighting.ambience} onChange={event => onSceneLightingChange({ ambience: Number(event.target.value) })} /></label>
      <label>Camera X {Math.round(cameraX)} / {cameraMax}<input type="range" min="0" max={cameraMax} step="1" value={cameraX} onChange={event => onCameraXChange(Number(event.target.value))} /></label>
      {hasUnlockedVisualLayer && (
        <>
          <label>Character Brightness {layerLighting.brightness.toFixed(2)}<input type="range" min="0.25" max="1.35" step="0.01" value={layerLighting.brightness} onChange={event => onLayerLightingChange({ brightness: Number(event.target.value), preset: "neon-station" })} /></label>
          <label>Contact Shadow {Math.round(layerShadow.opacity * 100)}%<input type="range" min="0" max="1" step="0.01" value={layerShadow.opacity} onChange={event => onLayerShadowChange({ opacity: Number(event.target.value), enabled: Number(event.target.value) > 0 })} /></label>
        </>
      )}
    </div>
  );
}
