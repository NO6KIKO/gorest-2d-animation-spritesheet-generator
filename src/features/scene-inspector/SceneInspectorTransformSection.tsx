import type { SceneLayer } from "../../types";

type SceneInspectorTransformSectionProps = {
  selectedInteractionZoneLayerId: string | null;
  selectedLayer: SceneLayer;
  onUpdateLayer: (layerId: string, patch: Partial<SceneLayer>) => void;
};

export function SceneInspectorTransformSection({
  selectedInteractionZoneLayerId,
  selectedLayer,
  onUpdateLayer,
}: SceneInspectorTransformSectionProps) {
  const disabled = selectedLayer.locked || selectedInteractionZoneLayerId === selectedLayer.id;

  return (
    <div className="compact-inspector-section">
      <em>Transform</em>
      <label>Scale {selectedLayer.scale.toFixed(2)}</label>
      <input
        type="range"
        min="0.05"
        max="2.5"
        step="0.01"
        value={selectedLayer.scale}
        onChange={event => onUpdateLayer(selectedLayer.id, { scale: Number(event.target.value) })}
        disabled={disabled}
      />
      <label>Opacity {Math.round(selectedLayer.opacity * 100)}%</label>
      <input
        type="range"
        min="0.1"
        max="1"
        step="0.01"
        value={selectedLayer.opacity}
        onChange={event => onUpdateLayer(selectedLayer.id, { opacity: Number(event.target.value) })}
        disabled={disabled}
      />
    </div>
  );
}
