import { Plus } from "lucide-react";

type ReusableSceneKitPanelProps = {
  boardingTrainAssetId: string;
  inspectTriggerAssetId: string;
  onInsertFullSceneKit: () => void;
  onInsertSceneKitAsset: (assetId: string) => void;
};

export function ReusableSceneKitPanel({
  boardingTrainAssetId,
  inspectTriggerAssetId,
  onInsertFullSceneKit,
  onInsertSceneKitAsset,
}: ReusableSceneKitPanelProps) {
  return (
    <section>
      <div className="section-title"><Plus size={17} /> Reusable Scene Kit</div>
      <div className="scene-kit-grid">
        <button type="button" className="primary-button" onClick={onInsertFullSceneKit}>Add Subway Kit</button>
        <button type="button" onClick={() => onInsertSceneKitAsset(inspectTriggerAssetId)}>Eye Inspect Hotspot</button>
        <button type="button" onClick={() => onInsertSceneKitAsset("asset_scene_ticket_machine")}>Ticket Machine</button>
        <button type="button" onClick={() => onInsertSceneKitAsset("asset_scene_backpack_ui")}>Backpack HUD</button>
        <button type="button" onClick={() => onInsertSceneKitAsset("asset_scene_station_sign_13")}>Platform 13 Sign</button>
        <button type="button" onClick={() => onInsertSceneKitAsset(boardingTrainAssetId)}>Boarding Train</button>
        <button type="button" onClick={() => onInsertSceneKitAsset("asset_scene_backpack_panel")}>Open Backpack Panel</button>
      </div>
      <div className="control-hint">These are reusable assets with saved trigger metadata. Eye Inspect Hotspot can be dragged anywhere and customized per layer.</div>
    </section>
  );
}
