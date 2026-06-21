import type { SceneLayer } from "../../types";

type SceneInspectorItemSectionProps = {
  selectedLayer: SceneLayer;
  onUpdateLayer: (layerId: string, patch: Partial<SceneLayer>) => void;
};

export function SceneInspectorItemSection({
  selectedLayer,
  onUpdateLayer,
}: SceneInspectorItemSectionProps) {
  return (
    <div className="compact-inspector-section item-inspector-section">
      <em>Item</em>
      <label>Layer Type</label>
      <select
        value={selectedLayer.type}
        onChange={event => onUpdateLayer(selectedLayer.id, { type: event.target.value as SceneLayer["type"] })}
        disabled={selectedLayer.locked}
      >
        <option value="sprite">Sprite</option>
        <option value="effect">Effect</option>
        <option value="foreground">Foreground</option>
        <option value="background">Background</option>
      </select>
      <label>Parallax {(selectedLayer.parallax ?? 1).toFixed(2)}</label>
      <input
        type="range"
        min="0"
        max="1.25"
        step="0.01"
        value={selectedLayer.parallax ?? 1}
        onChange={event => onUpdateLayer(selectedLayer.id, { parallax: Number(event.target.value) })}
        disabled={selectedLayer.locked}
      />
    </div>
  );
}
