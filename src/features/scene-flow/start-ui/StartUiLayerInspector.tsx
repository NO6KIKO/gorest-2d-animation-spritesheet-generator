import { Layers, Trash2 } from "lucide-react";
import type { GameStartUiLayer, StartUiLayerKind } from "../../../types";
import { START_UI_LAYER_KIND_OPTIONS } from "./startUiEditorOptions";
import {
  StartUiRangeControl,
  StartUiSelectControl,
  StartUiToggleControl,
} from "./StartUiInspectorControls";
import type { PatchStartUiLayer } from "./startUiInspectorTypes";

type StartUiLayerInspectorProps = {
  layer: GameStartUiLayer;
  onDelete: () => void;
  onPatchLayer: PatchStartUiLayer;
};

export function StartUiLayerInspector({ layer, onDelete, onPatchLayer }: StartUiLayerInspectorProps) {
  const patchLayer = (patch: Partial<GameStartUiLayer>) => onPatchLayer(layer.id, patch);

  return (
    <div className="scene-start-ui-section">
      <strong><Layers size={14} /> Layer</strong>
      <label>
        Name
        <input value={layer.name} onChange={event => patchLayer({ name: event.target.value })} />
      </label>
      <StartUiSelectControl<StartUiLayerKind>
        label="Kind"
        options={START_UI_LAYER_KIND_OPTIONS}
        value={layer.kind}
        onChange={kind => patchLayer({ kind })}
      />
      <label>
        Label
        <input value={layer.label || ""} onChange={event => patchLayer({ label: event.target.value })} />
      </label>
      <label>
        Image URL
        <input value={layer.imageUrl || ""} onChange={event => patchLayer({ imageUrl: event.target.value })} />
      </label>
      <div className="scene-start-ui-layer-grid four">
        <label>
          X
          <input type="number" value={layer.x} onChange={event => patchLayer({ x: Number(event.target.value) })} />
        </label>
        <label>
          Y
          <input type="number" value={layer.y} onChange={event => patchLayer({ y: Number(event.target.value) })} />
        </label>
        <label>
          W
          <input type="number" min="1" value={layer.width} onChange={event => patchLayer({ width: Number(event.target.value) })} />
        </label>
        <label>
          H
          <input type="number" min="1" value={layer.height} onChange={event => patchLayer({ height: Number(event.target.value) })} />
        </label>
      </div>
      <div className="scene-start-ui-layer-grid two">
        <label>
          Z
          <input type="number" value={layer.zIndex} onChange={event => patchLayer({ zIndex: Number(event.target.value) })} />
        </label>
        <StartUiRangeControl
          label="Opacity"
          min={0}
          max={1}
          step={0.01}
          value={layer.opacity}
          valueLabel={`${Math.round(layer.opacity * 100)}%`}
          onChange={opacity => patchLayer({ opacity })}
        />
      </div>
      <StartUiToggleControl checked={layer.visible} onChange={visible => patchLayer({ visible })}>
        Visible
      </StartUiToggleControl>
      <StartUiToggleControl checked={Boolean(layer.locked)} onChange={locked => patchLayer({ locked })}>
        Locked
      </StartUiToggleControl>
      {layer.sourceWidth && (
        <button
          type="button"
          className="ghost-button"
          onClick={() => patchLayer({ sourceX: undefined, sourceY: undefined, sourceWidth: undefined, sourceHeight: undefined })}
        >
          Use Full Image
        </button>
      )}
      <button type="button" className="ghost-button danger" onClick={onDelete}>
        <Trash2 size={14} /> Delete Layer
      </button>
    </div>
  );
}
