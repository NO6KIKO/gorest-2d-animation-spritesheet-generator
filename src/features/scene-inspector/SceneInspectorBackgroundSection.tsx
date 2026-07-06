import { backgroundLightingForLayer, DEFAULT_BACKGROUND_LIGHTING } from "../../domain/scene/sceneModel";
import type { SceneLayer } from "../../types";

type SceneInspectorBackgroundSectionProps = {
  selectedLayer: SceneLayer;
  onUpdateLayer: (layerId: string, patch: Partial<SceneLayer>) => void;
};

export function SceneInspectorBackgroundSection({
  selectedLayer,
  onUpdateLayer,
}: SceneInspectorBackgroundSectionProps) {
  const lighting = backgroundLightingForLayer(selectedLayer);
  const disabled = selectedLayer.locked;

  const updateBrightness = (brightness: number) => {
    onUpdateLayer(selectedLayer.id, {
      lighting: {
        ...lighting,
        preset: "background-adjust",
        brightness,
      },
    });
  };

  return (
    <div className="compact-inspector-section">
      <em>Background</em>
      <label>Brightness {Math.round(lighting.brightness * 100)}%</label>
      <input
        type="range"
        min="0.15"
        max="1.6"
        step="0.01"
        value={lighting.brightness}
        onChange={event => updateBrightness(Number(event.target.value))}
        disabled={disabled}
      />
      <button
        type="button"
        className="inspector-secondary-action"
        onClick={() => onUpdateLayer(selectedLayer.id, { lighting: { ...DEFAULT_BACKGROUND_LIGHTING } })}
        disabled={disabled}
      >
        Reset Brightness
      </button>
    </div>
  );
}
