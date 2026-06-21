import type { SceneLayer } from "../../types";

type BackgroundLayerControlsProps = {
  sceneHeight: number;
  sceneWidth: number;
  selectedLayer: SceneLayer;
  onUpdateLayer: (layerId: string, patch: Partial<SceneLayer>) => void;
};

export function BackgroundLayerControls({ sceneHeight, sceneWidth, selectedLayer, onUpdateLayer }: BackgroundLayerControlsProps) {
  return (
    <>
      <div className="two-col">
        <div>
          <label>Source Width</label>
          <input
            type="number"
            min="1"
            value={Math.round(selectedLayer.width || sceneWidth)}
            onChange={event => onUpdateLayer(selectedLayer.id, { width: Math.max(1, Number(event.target.value)) })}
            disabled={selectedLayer.locked}
          />
        </div>
        <div>
          <label>Source Height</label>
          <input
            type="number"
            min="1"
            value={Math.round(selectedLayer.height || sceneHeight)}
            onChange={event => onUpdateLayer(selectedLayer.id, { height: Math.max(1, Number(event.target.value)) })}
            disabled={selectedLayer.locked}
          />
        </div>
      </div>
      <label>Background Fit</label>
      <select
        value={selectedLayer.fit || "stretch"}
        onChange={event => onUpdateLayer(selectedLayer.id, { fit: event.target.value as SceneLayer["fit"] })}
        disabled={selectedLayer.locked}
      >
        <option value="stretch">Stretch to layer box</option>
        <option value="cover">Cover layer box</option>
        <option value="contain">Contain layer box</option>
        <option value="tile">Tile</option>
      </select>
      <label>Background Position</label>
      <input
        value={selectedLayer.position || "left center"}
        onChange={event => onUpdateLayer(selectedLayer.id, { position: event.target.value })}
        placeholder="left center / center center / 40% 50%"
        disabled={selectedLayer.locked}
      />
      <button
        type="button"
        className="ghost-button full"
        onClick={() => onUpdateLayer(selectedLayer.id, {
          x: 0,
          y: sceneHeight,
          width: sceneWidth,
          height: sceneHeight,
          scale: 1,
          fit: "stretch",
          position: "left center",
        })}
        disabled={selectedLayer.locked}
      >
        Fill Scene World
      </button>
      <div className="control-hint">Select the background layer, then drag the box or pull any corner handle to frame it like other objects.</div>
    </>
  );
}
