import { Download } from "lucide-react";

type BlueprintPanelProps = {
  actionBindingText: string;
  assetCount: number;
  currentActionText: string;
  sceneCount: number;
  onExportLibrary: () => void;
};

export function BlueprintPanel({ actionBindingText, assetCount, currentActionText, sceneCount, onExportLibrary }: BlueprintPanelProps) {
  return (
    <div className="source-panel">
      <div><strong>Asset Library:</strong> {assetCount} confirmed assets, {sceneCount} saved scenes.</div>
      <div><strong>Current Action:</strong> {currentActionText}</div>
      <div><strong>Action Binding:</strong> {actionBindingText}</div>
      <div><strong>Layer Rules:</strong> Background, ground, character, effects, and foreground are separated into layers; character and effect layers can be dragged, resized, sorted, and hidden.</div>
      <div><strong>Save Path:</strong> D:\2d-animation-spritesheet-generator\public\generated\game_asset_library.json</div>
      <button type="button" className="ghost-button" onClick={onExportLibrary}><Download size={16} /> Export Full Library JSON</button>
    </div>
  );
}
