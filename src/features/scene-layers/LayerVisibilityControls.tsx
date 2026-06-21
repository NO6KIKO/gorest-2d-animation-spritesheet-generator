import { Eye, EyeOff } from "lucide-react";
import type { SceneLayer } from "../../types";

type LayerVisibilityControlsProps = {
  selectedLayer: SceneLayer;
  onUpdateLayer: (layerId: string, patch: Partial<SceneLayer>) => void;
};

export function LayerVisibilityControls({ selectedLayer, onUpdateLayer }: LayerVisibilityControlsProps) {
  return (
    <>
      <label>Opacity {Math.round(selectedLayer.opacity * 100)}%</label>
      <input type="range" min="0.1" max="1" step="0.01" value={selectedLayer.opacity} onChange={event => onUpdateLayer(selectedLayer.id, { opacity: Number(event.target.value) })} />
      <label>Layer z-index</label>
      <input type="number" value={selectedLayer.zIndex} onChange={event => onUpdateLayer(selectedLayer.id, { zIndex: Number(event.target.value) })} disabled={selectedLayer.locked} />
      <button className="ghost-button full" type="button" onClick={() => onUpdateLayer(selectedLayer.id, { visible: !selectedLayer.visible })}>{selectedLayer.visible ? <EyeOff size={16} /> : <Eye size={16} />} {selectedLayer.visible ? "Hide" : "Show"}</button>
    </>
  );
}
