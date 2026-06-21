import type { DragEvent } from "react";
import { Eye, EyeOff, Layers } from "lucide-react";
import type { SceneLayer } from "../../types";

type LayerStackListProps = {
  draggedLayerId: string | null;
  layers: SceneLayer[];
  selectedLayerId: string;
  onDragLayerEnd: () => void;
  onDragLayerStart: (layerId: string) => void;
  onReorderLayer: (sourceLayerId: string, targetLayerId: string) => void;
  onSelectLayer: (layer: SceneLayer) => void;
};

export function LayerStackList({
  draggedLayerId,
  layers,
  selectedLayerId,
  onDragLayerEnd,
  onDragLayerStart,
  onReorderLayer,
  onSelectLayer,
}: LayerStackListProps) {
  return (
    <>
      <div className="section-title"><Layers size={17} /> Layers</div>
      <div className="control-hint">Drag unlocked layer rows to decide what renders above or below. Top rows render in front.</div>
      <div className="layer-list">
        {layers
          .slice()
          .sort((a, b) => b.zIndex - a.zIndex)
          .map(layer => {
            const canDragLayer = !layer.locked;
            return (
              <button
                key={layer.id}
                type="button"
                draggable={canDragLayer}
                className={`${layer.id === selectedLayerId ? "layer-row active" : "layer-row"} ${draggedLayerId === layer.id ? "dragging" : ""}`}
                onClick={() => onSelectLayer(layer)}
                onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                  if (!canDragLayer) {
                    event.preventDefault();
                    return;
                  }
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", layer.id);
                  onDragLayerStart(layer.id);
                }}
                onDragOver={event => {
                  if (!draggedLayerId || !canDragLayer || draggedLayerId === layer.id) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={event => {
                  event.preventDefault();
                  const sourceId = event.dataTransfer.getData("text/plain") || draggedLayerId;
                  if (sourceId && canDragLayer) onReorderLayer(sourceId, layer.id);
                  onDragLayerEnd();
                }}
                onDragEnd={onDragLayerEnd}
              >
                <span className="drag-grip" title={canDragLayer ? "Drag to reorder" : "Locked layer"}>{canDragLayer ? "::" : "--"}</span>
                <span>{layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}</span>
                <strong>{layer.name}</strong>
                <em>{layer.type} / z{layer.zIndex}</em>
              </button>
            );
          })}
      </div>
    </>
  );
}
