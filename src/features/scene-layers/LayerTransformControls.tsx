import type { SceneLayer } from "../../types";

type LayerTransformControlsProps = {
  selectedLayer: SceneLayer;
  onUpdateLayer: (layerId: string, patch: Partial<SceneLayer>) => void;
};

export function LayerTransformControls({ selectedLayer, onUpdateLayer }: LayerTransformControlsProps) {
  return (
    <>
      <label>Layer Name</label>
      <input value={selectedLayer.name} onChange={event => onUpdateLayer(selectedLayer.id, { name: event.target.value })} disabled={selectedLayer.locked} />
      <div className="two-col">
        <div>
          <label>X</label>
          <input type="number" value={Math.round(selectedLayer.x)} onChange={event => onUpdateLayer(selectedLayer.id, { x: Number(event.target.value) })} disabled={selectedLayer.locked} />
        </div>
        <div>
          <label>Y</label>
          <input type="number" value={Math.round(selectedLayer.y)} onChange={event => onUpdateLayer(selectedLayer.id, { y: Number(event.target.value) })} disabled={selectedLayer.locked} />
        </div>
      </div>
      <label>Scale {selectedLayer.scale.toFixed(2)}</label>
      <input type="range" min="0.05" max="2.5" step="0.01" value={selectedLayer.scale} onChange={event => onUpdateLayer(selectedLayer.id, { scale: Number(event.target.value) })} disabled={selectedLayer.locked} />
      <label>Parallax {(selectedLayer.parallax ?? 1).toFixed(2)}</label>
      <input type="range" min="0" max="1.25" step="0.01" value={selectedLayer.parallax ?? 1} onChange={event => onUpdateLayer(selectedLayer.id, { parallax: Number(event.target.value) })} disabled={selectedLayer.locked} />
      <div className="control-hint">Use 1 for normal world objects. Use 0 for fixed HUD/UI layers.</div>
    </>
  );
}
