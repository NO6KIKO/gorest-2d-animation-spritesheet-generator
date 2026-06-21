import { Eye } from "lucide-react";
import type {
  GameAsset,
  GameScene,
  InteractionPreset,
  InteractionPromptStyle,
  LayerInteractionSettings,
  SceneLayer,
} from "../../types";

type InteractionPresetOption = {
  label: string;
};

type LayerInteractionControlsProps = {
  interaction?: LayerInteractionSettings;
  interactionPresets: Record<string, InteractionPresetOption>;
  sceneState: Record<string, unknown>;
  scenes: GameScene[];
  selectedLayer: SceneLayer;
  selectedLayerAsset?: GameAsset;
  visualLayers: SceneLayer[];
  getLayerWorldBounds: (layer: SceneLayer, asset?: GameAsset) => { width: number; height: number };
  onApplyPreset: (preset: InteractionPreset) => void;
  onUpdateInteraction: (patch: Partial<LayerInteractionSettings>) => void;
};

export function LayerInteractionControls({
  interaction,
  interactionPresets,
  sceneState,
  scenes,
  selectedLayer,
  selectedLayerAsset,
  visualLayers,
  getLayerWorldBounds,
  onApplyPreset,
  onUpdateInteraction,
}: LayerInteractionControlsProps) {
  return (
    <div className="interaction-controls">
      <div className="section-title compact"><Eye size={15} /> Interaction Preset</div>
      <div className="preset-grid">
        {Object.entries(interactionPresets).map(([preset, config]) => (
          <button
            key={preset}
            type="button"
            className={interaction?.preset === preset ? "active" : ""}
            onClick={() => onApplyPreset(preset as InteractionPreset)}
          >
            {config.label}
          </button>
        ))}
      </div>
      {!interaction ? (
        <div className="control-hint">Choose a preset to turn this layer into an interactable object with its own editable trigger zone.</div>
      ) : (
        <>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={interaction.enabled}
              onChange={event => onUpdateInteraction({ enabled: event.target.checked })}
            />
            Enable interaction
          </label>
          <div className="two-col">
            <div>
              <label>Trigger Mode</label>
              <select value={interaction.triggerMode || "near-click"} onChange={event => onUpdateInteraction({ triggerMode: event.target.value as LayerInteractionSettings["triggerMode"] })}>
                <option value="near-click">Near + Click Eye</option>
                <option value="near-key">Near + Key</option>
                <option value="inventory">Inventory State</option>
                <option value="state">Scene State</option>
              </select>
            </div>
            <div>
              <label>Action Type</label>
              <select value={interaction.actionType || "subtitle"} onChange={event => onUpdateInteraction({ actionType: event.target.value as LayerInteractionSettings["actionType"] })}>
                <option value="subtitle">Show Subtitle</option>
                <option value="play-animation">Play Animation</option>
                <option value="toggle-layer">Toggle Layer</option>
                <option value="pickup-item">Pickup Item</option>
                <option value="scene-link">Door / Scene Link</option>
                <option value="set-state">Set State</option>
              </select>
            </div>
          </div>
          <div className="two-col">
            <div>
              <label>Prompt Key</label>
              <input value={interaction.promptKey} onChange={event => onUpdateInteraction({ promptKey: event.target.value })} placeholder="KeyE" />
            </div>
            <div>
              <label>Prompt Style</label>
              <select value={interaction.promptStyle} onChange={event => onUpdateInteraction({ promptStyle: event.target.value as InteractionPromptStyle })}>
                <option value="horror">Horror Eye</option>
                <option value="minimal">Minimal</option>
                <option value="caption">Caption</option>
              </select>
            </div>
          </div>
          <label>Prompt Text</label>
          <input value={interaction.promptText} onChange={event => onUpdateInteraction({ promptText: event.target.value })} />
          <label>Subtitle Text</label>
          <textarea rows={2} value={interaction.subtitle || ""} onChange={event => onUpdateInteraction({ subtitle: event.target.value })} />
          <label>Failed Condition Subtitle</label>
          <textarea rows={2} value={interaction.failSubtitle || ""} onChange={event => onUpdateInteraction({ failSubtitle: event.target.value })} />
          <div className="two-col">
            <div>
              <label>Target Layer</label>
              <select value={interaction.targetLayerId || ""} onChange={event => onUpdateInteraction({ targetLayerId: event.target.value || undefined })}>
                <option value="">This layer</option>
                {visualLayers.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Target Scene</label>
              <select value={interaction.targetSceneId || ""} onChange={event => onUpdateInteraction({ targetSceneId: event.target.value || undefined })}>
                <option value="">None</option>
                {scenes.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
          </div>
          {selectedLayerAsset?.animations?.length ? (
            <>
              <label>Target Animation</label>
              <select value={interaction.targetAnimationId || ""} onChange={event => onUpdateInteraction({ targetAnimationId: event.target.value || undefined })}>
                <option value="">Default animation</option>
                {selectedLayerAsset.animations.map(clip => (
                  <option key={clip.id} value={clip.id}>{clip.name}</option>
                ))}
              </select>
            </>
          ) : null}
          <div className="two-col">
            <div>
              <label>Condition Key</label>
              <input value={interaction.conditionStateKey || ""} onChange={event => onUpdateInteraction({ conditionStateKey: event.target.value })} placeholder="has_key" />
            </div>
            <div>
              <label>Condition Value</label>
              <input value={interaction.conditionStateValue || ""} onChange={event => onUpdateInteraction({ conditionStateValue: event.target.value })} placeholder="true" />
            </div>
          </div>
          <div className="two-col">
            <div>
              <label>Item ID</label>
              <input value={interaction.itemId || ""} onChange={event => onUpdateInteraction({ itemId: event.target.value })} placeholder="old_key" />
            </div>
            <div>
              <label>Set State</label>
              <input value={interaction.setStateKey || ""} onChange={event => onUpdateInteraction({ setStateKey: event.target.value })} placeholder="door_open" />
            </div>
          </div>
          <label>Set State Value</label>
          <input value={interaction.setStateValue || ""} onChange={event => onUpdateInteraction({ setStateValue: event.target.value })} placeholder="true / false / text / number" />
          <label className="checkbox-row">
            <input type="checkbox" checked={interaction.showText} onChange={event => onUpdateInteraction({ showText: event.target.checked })} />
            Show prompt text beside the eye
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={interaction.hotspotVisible !== false} onChange={event => onUpdateInteraction({ hotspotVisible: event.target.checked })} />
            Show hotspot marker layer
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={interaction.hideLayerOnPickup !== false} onChange={event => onUpdateInteraction({ hideLayerOnPickup: event.target.checked })} />
            Hide this layer after pickup
          </label>
          <div className="two-col">
            <div>
              <label>Zone Width</label>
              <input type="number" min="24" value={Math.round(interaction.zoneWidth || getLayerWorldBounds(selectedLayer, selectedLayerAsset).width || 160)} onChange={event => onUpdateInteraction({ zoneWidth: Number(event.target.value) })} />
            </div>
            <div>
              <label>Zone Height</label>
              <input type="number" min="24" value={Math.round(interaction.zoneHeight || getLayerWorldBounds(selectedLayer, selectedLayerAsset).height || 120)} onChange={event => onUpdateInteraction({ zoneHeight: Number(event.target.value) })} />
            </div>
          </div>
          <div className="two-col">
            <div>
              <label>Zone X {interaction.zoneOffsetX || 0}px</label>
              <input type="range" min="-420" max="420" step="1" value={interaction.zoneOffsetX || 0} onChange={event => onUpdateInteraction({ zoneOffsetX: Number(event.target.value) })} />
            </div>
            <div>
              <label>Zone Y {interaction.zoneOffsetY || 0}px</label>
              <input type="range" min="-260" max="260" step="1" value={interaction.zoneOffsetY || 0} onChange={event => onUpdateInteraction({ zoneOffsetY: Number(event.target.value) })} />
            </div>
          </div>
          <label>Text Font Size {interaction.fontSize}px</label>
          <input type="range" min="8" max="24" step="1" value={interaction.fontSize} onChange={event => onUpdateInteraction({ fontSize: Number(event.target.value) })} />
          <label>Prompt Scale {interaction.promptScale.toFixed(2)}</label>
          <input type="range" min="0.45" max="1.45" step="0.01" value={interaction.promptScale} onChange={event => onUpdateInteraction({ promptScale: Number(event.target.value) })} />
          <label>Trigger Radius {interaction.triggerRadius}px</label>
          <input type="range" min="60" max="520" step="5" value={interaction.triggerRadius} onChange={event => onUpdateInteraction({ triggerRadius: Number(event.target.value) })} />
          <div className="two-col">
            <div>
              <label>Prompt X {interaction.offsetX}px</label>
              <input type="range" min="-220" max="220" step="1" value={interaction.offsetX} onChange={event => onUpdateInteraction({ offsetX: Number(event.target.value) })} />
            </div>
            <div>
              <label>Prompt Y {interaction.offsetY}px</label>
              <input type="range" min="-180" max="80" step="1" value={interaction.offsetY} onChange={event => onUpdateInteraction({ offsetY: Number(event.target.value) })} />
            </div>
          </div>
          <div className="state-preview">
            {Object.entries(sceneState || {}).map(([key, value]) => (
              <span key={key}>{key}: {String(value)}</span>
            ))}
          </div>
          <div className="control-hint">Interaction zones are independent from the image. Use them for clickable radios, doors, boxes, and hidden investigation areas.</div>
        </>
      )}
    </div>
  );
}
