import { Download, Lock, Unlock } from "lucide-react";
import type { AssetRole, GameAsset, SceneLayer } from "../../types";

type SceneInspectorHeaderProps = {
  layerCount: number;
  roleLabels: Record<AssetRole, string>;
  sceneName: string;
  selectedInteractionZoneLayer?: SceneLayer;
  selectedLayer?: SceneLayer;
  selectedLayerAsset?: GameAsset;
  selectedLayerIsAvatar: boolean;
  onDownloadSelectedItem: () => void;
  onToggleSelectedLayerLock: () => void;
};

export function SceneInspectorHeader({
  layerCount,
  roleLabels,
  sceneName,
  selectedInteractionZoneLayer,
  selectedLayer,
  selectedLayerAsset,
  selectedLayerIsAvatar,
  onDownloadSelectedItem,
  onToggleSelectedLayerLock,
}: SceneInspectorHeaderProps) {
  const title = selectedInteractionZoneLayer
    ? "Interaction Zone"
    : selectedLayer ? (selectedLayerIsAvatar ? "Avatar Inspector" : "Item Inspector") : sceneName;

  const subtitle = selectedInteractionZoneLayer
    ? `Owner: ${selectedInteractionZoneLayer.name}`
    : selectedLayer
      ? `${selectedLayer.name} / ${selectedLayerAsset ? roleLabels[selectedLayerAsset.role] : selectedLayer.type} / z${selectedLayer.zIndex}`
      : `${layerCount} layers`;

  return (
    <>
      <strong>{title}</strong>
      <span>{subtitle}</span>
      <button
        type="button"
        className="inspector-primary-action"
        onClick={onDownloadSelectedItem}
        disabled={!selectedLayer}
      >
        <Download size={15} /> Download Selected Item
      </button>
      {selectedLayer && (
        <button
          type="button"
          className="inspector-secondary-action"
          onClick={onToggleSelectedLayerLock}
        >
          {selectedLayer.locked ? <Unlock size={15} /> : <Lock size={15} />}
          {selectedLayer.locked ? "Unlock Layer" : "Lock Layer"}
        </button>
      )}
    </>
  );
}
