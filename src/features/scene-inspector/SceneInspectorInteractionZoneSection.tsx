import type { GameAsset, LayerInteractionSettings, SceneLayer } from "../../types";

type LayerBounds = {
  width: number;
  height: number;
};

type SceneInspectorInteractionZoneSectionProps = {
  getLayerWorldBounds: (layer: SceneLayer, asset?: GameAsset) => LayerBounds;
  selectedInteractionZoneAsset?: GameAsset;
  selectedInteractionZoneLayer: SceneLayer;
  selectedInteractionZoneSettings: LayerInteractionSettings;
  onUpdateInteraction: (layerId: string, patch: Partial<LayerInteractionSettings>) => void;
};

export function SceneInspectorInteractionZoneSection({
  getLayerWorldBounds,
  selectedInteractionZoneAsset,
  selectedInteractionZoneLayer,
  selectedInteractionZoneSettings,
  onUpdateInteraction,
}: SceneInspectorInteractionZoneSectionProps) {
  const bounds = getLayerWorldBounds(selectedInteractionZoneLayer, selectedInteractionZoneAsset);

  return (
    <div className="compact-inspector-section interaction-zone-inspector">
      <em>Interaction Zone</em>
      <label>Zone X {selectedInteractionZoneSettings.zoneOffsetX || 0}px</label>
      <input
        type="range"
        min="-520"
        max="520"
        step="1"
        value={selectedInteractionZoneSettings.zoneOffsetX || 0}
        onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { zoneOffsetX: Number(event.target.value) })}
        disabled={selectedInteractionZoneLayer.locked}
      />
      <label>Zone Y {selectedInteractionZoneSettings.zoneOffsetY || 0}px</label>
      <input
        type="range"
        min="-360"
        max="360"
        step="1"
        value={selectedInteractionZoneSettings.zoneOffsetY || 0}
        onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { zoneOffsetY: Number(event.target.value) })}
        disabled={selectedInteractionZoneLayer.locked}
      />
      <div className="compact-dual-fields">
        <label>
          Width
          <input
            type="number"
            min="24"
            value={Math.round(selectedInteractionZoneSettings.zoneWidth || bounds.width || 160)}
            onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { zoneWidth: Number(event.target.value) })}
            disabled={selectedInteractionZoneLayer.locked}
          />
        </label>
        <label>
          Height
          <input
            type="number"
            min="24"
            value={Math.round(selectedInteractionZoneSettings.zoneHeight || bounds.height || 120)}
            onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { zoneHeight: Number(event.target.value) })}
            disabled={selectedInteractionZoneLayer.locked}
          />
        </label>
      </div>
      <span>Drag the zone directly on the scene to place it independently.</span>
    </div>
  );
}
