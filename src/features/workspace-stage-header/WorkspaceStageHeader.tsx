import { Film, Map as MapIcon, Monitor, Play } from "lucide-react";
import type { WorkspaceTab } from "../../app/types";

type ViewportPresetOption = {
  id: string;
  label: string;
  width: number;
  height: number;
};

type WorkspaceStageHeaderProps = {
  activeTab: WorkspaceTab;
  title: string;
  viewportHeight: number;
  viewportPreset: string;
  viewportPresets: ViewportPresetOption[];
  viewportWidth: number;
  onOpenSheet: () => void | Promise<void>;
  onTabChange: (tab: WorkspaceTab) => void;
  onViewportHeightChange: (height: number) => void;
  onViewportPresetChange: (presetId: string) => void;
  onViewportWidthChange: (width: number) => void;
};

export function WorkspaceStageHeader({
  activeTab,
  title,
  viewportHeight,
  viewportPreset,
  viewportPresets,
  viewportWidth,
  onOpenSheet,
  onTabChange,
  onViewportHeightChange,
  onViewportPresetChange,
  onViewportWidthChange,
}: WorkspaceStageHeaderProps) {
  return (
    <div className="stage-header">
      <div>
        <p className="eyebrow">Scene Composer</p>
        <h2>{title}</h2>
      </div>
      <div className="workspace-tabs">
        <div className="tabs primary-tabs">
          <button className={activeTab === "scenes" ? "active" : ""} onClick={() => onTabChange("scenes")}><MapIcon size={15} /> 2D Canvas</button>
          <button className={activeTab === "scene" ? "active" : ""} onClick={() => onTabChange("scene")}><MapIcon size={15} /> 2D Scene</button>
          {activeTab === "scene" && (
            <div className="scene-size-controls" aria-label="2D Scene screen size">
              <Monitor size={15} />
              <select
                aria-label="Screen size preset"
                value={viewportPreset}
                onChange={event => onViewportPresetChange(event.target.value)}
              >
                <option value="custom">Custom</option>
                {viewportPresets.map(preset => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label} / {preset.width} x {preset.height}
                  </option>
                ))}
              </select>
              <input aria-label="Screen width" type="number" min="240" value={Math.round(viewportWidth)} onChange={event => onViewportWidthChange(Number(event.target.value))} />
              <span>x</span>
              <input aria-label="Screen height" type="number" min="240" value={Math.round(viewportHeight)} onChange={event => onViewportHeightChange(Number(event.target.value))} />
            </div>
          )}
        </div>
        <div className="tabs advanced-tabs">
          <button className={activeTab === "spritesheets" ? "active" : ""} onClick={() => onTabChange("spritesheets")}><Film size={15} /> Spritesheets</button>
          <button className={activeTab === "preview" ? "active" : ""} onClick={() => onTabChange("preview")}><Play size={15} /> Action</button>
          <button className={activeTab === "frames" ? "active" : ""} onClick={() => onTabChange("frames")}>Frames</button>
          <button className={activeTab === "sheet" ? "active" : ""} onClick={() => void onOpenSheet()}>Sheet</button>
          <button className={activeTab === "blueprint" ? "active" : ""} onClick={() => onTabChange("blueprint")}>Blueprint</button>
        </div>
      </div>
    </div>
  );
}
