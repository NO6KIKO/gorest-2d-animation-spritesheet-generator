import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Box,
  Camera,
  DoorOpen,
  Eye,
  Film,
  Hand,
  Lightbulb,
  Map as MapIcon,
  MessageSquareText,
  Monitor,
  MousePointer2,
  Play,
  Plus,
  Save,
  ToggleLeft,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import type { WorkspaceTab } from "../../app/types";
import type { InteractionPreset } from "../../types";

type ViewportPresetOption = {
  id: string;
  label: string;
  width: number;
  height: number;
};

type WorkspaceStageHeaderProps = {
  activeTab: WorkspaceTab;
  viewportHeight: number;
  viewportPreset: string;
  viewportPresets: ViewportPresetOption[];
  viewportWidth: number;
  onBack: () => void;
  onInsertInteractionZone: (preset: InteractionPreset) => void;
  onOpenSheet: () => void | Promise<void>;
  onSaveScene: () => void;
  onStartNewScene: () => void | Promise<void>;
  onTabChange: (tab: WorkspaceTab) => void;
  onViewportHeightChange: (height: number) => void;
  onViewportPresetChange: (presetId: string) => void;
  onViewportWidthChange: (width: number) => void;
};

type StageZoneTool = {
  preset: InteractionPreset;
  label: string;
  className: string;
  Icon: LucideIcon;
};

const STAGE_ZONE_TOOLS: StageZoneTool[] = [
  { preset: "light-zone", label: "Add Light Zone", className: "light", Icon: Lightbulb },
  { preset: "inspect", label: "Add Inspect Zone", className: "inspect", Icon: Eye },
  { preset: "pickup", label: "Add Pickup Zone", className: "pickup", Icon: Hand },
  { preset: "scene-link", label: "Add Door Zone", className: "door", Icon: DoorOpen },
  { preset: "toggle", label: "Add Switch Zone", className: "switch", Icon: ToggleLeft },
  { preset: "dialogue-zone", label: "Add Dialogue Zone", className: "dialogue", Icon: MessageSquareText },
  { preset: "audio-zone", label: "Add Audio Zone", className: "audio", Icon: Volume2 },
  { preset: "camera-zone", label: "Add Camera Zone", className: "camera", Icon: Camera },
  { preset: "physics-zone", label: "Add Physics Zone", className: "physics", Icon: Box },
];

export function WorkspaceStageHeader({
  activeTab,
  viewportHeight,
  viewportPreset,
  viewportPresets,
  viewportWidth,
  onBack,
  onInsertInteractionZone,
  onOpenSheet,
  onSaveScene,
  onStartNewScene,
  onTabChange,
  onViewportHeightChange,
  onViewportPresetChange,
  onViewportWidthChange,
}: WorkspaceStageHeaderProps) {
  const [isZoneMenuOpen, setIsZoneMenuOpen] = useState(false);
  const zonePickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isZoneMenuOpen) return;
    const closeZoneMenu = (event: globalThis.PointerEvent) => {
      if (zonePickerRef.current?.contains(event.target as Node)) return;
      setIsZoneMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsZoneMenuOpen(false);
    };
    window.addEventListener("pointerdown", closeZoneMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeZoneMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isZoneMenuOpen]);

  useEffect(() => {
    if (activeTab !== "scene") setIsZoneMenuOpen(false);
  }, [activeTab]);

  return (
    <div className="stage-header">
      <button type="button" className="mode-back-button stage-back-button" onClick={onBack}>
        <ArrowLeft size={16} /> Back
      </button>
      <div className="workspace-tabs">
        <div className="stage-mode-row">
          {activeTab === "scene" && (
            <div ref={zonePickerRef} className="stage-zone-picker" aria-label="Add interaction zone">
              <button
                type="button"
                className={`stage-square-tool-button zone-picker-trigger ${isZoneMenuOpen ? "active" : ""}`}
                onClick={() => setIsZoneMenuOpen(open => !open)}
                aria-haspopup="menu"
                aria-expanded={isZoneMenuOpen}
                aria-label="Interaction Zones"
                title="Interaction Zones"
              >
                <MousePointer2 size={18} />
              </button>
              {isZoneMenuOpen && (
                <div className="stage-zone-menu" role="menu">
                  {STAGE_ZONE_TOOLS.map(({ preset, label, className, Icon }) => (
                    <button
                      key={preset}
                      type="button"
                      className={`stage-zone-menu-item ${className}`}
                      role="menuitem"
                      onClick={() => {
                        onInsertInteractionZone(preset);
                        setIsZoneMenuOpen(false);
                      }}
                    >
                      <Icon size={16} />
                      <span>{label.replace("Add ", "")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="tabs primary-tabs">
            <button className={activeTab === "scenes" ? "active" : ""} onClick={() => onTabChange("scenes")}><MapIcon size={15} /> 2D Canvas</button>
            <button className={activeTab === "scene" ? "active" : ""} onClick={() => onTabChange("scene")}><MapIcon size={15} /> 2D Scene</button>
            <button className={activeTab === "start-ui" ? "active" : ""} onClick={() => onTabChange("start-ui")}><Monitor size={15} /> Start UI</button>
          </div>
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
      {activeTab === "scene" && (
        <div className="stage-header-actions">
          <button type="button" className="ghost-button" onClick={onSaveScene}><Save size={15} /> Save Scene</button>
          <button type="button" className="ghost-button" onClick={() => void onStartNewScene()}><Plus size={15} /> New Scene</button>
        </div>
      )}
    </div>
  );
}
