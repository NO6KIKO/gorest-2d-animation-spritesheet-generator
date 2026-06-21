import { Monitor, Smartphone, Tablet } from "lucide-react";
import type { SceneLayer } from "../../types";

type ViewportPresetIcon = "phone" | "tablet" | "desktop";

type ViewportPresetOption = {
  id: string;
  icon: ViewportPresetIcon;
  label: string;
  note: string;
  width: number;
  height: number;
};

type SimulationScreenPanelProps = {
  backgroundFit: SceneLayer["fit"] | undefined;
  backgroundPosition: string | undefined;
  selectedViewportPresetLabel: string;
  viewportHeight: number;
  viewportPreset: string;
  viewportPresets: ViewportPresetOption[];
  viewportRatioLabel: string;
  viewportWidth: number;
  onBackgroundFitChange: (fit: SceneLayer["fit"]) => void;
  onBackgroundPositionChange: (position: string) => void;
  onViewportHeightChange: (height: number) => void;
  onViewportPresetChange: (preset: ViewportPresetOption) => void;
  onViewportWidthChange: (width: number) => void;
};

function ViewportPresetIconView({ icon }: { icon: ViewportPresetIcon }) {
  if (icon === "phone") return <Smartphone size={15} />;
  if (icon === "tablet") return <Tablet size={15} />;
  return <Monitor size={15} />;
}

export function SimulationScreenPanel({
  backgroundFit,
  backgroundPosition,
  selectedViewportPresetLabel,
  viewportHeight,
  viewportPreset,
  viewportPresets,
  viewportRatioLabel,
  viewportWidth,
  onBackgroundFitChange,
  onBackgroundPositionChange,
  onViewportHeightChange,
  onViewportPresetChange,
  onViewportWidthChange,
}: SimulationScreenPanelProps) {
  return (
    <section>
      <div className="section-title"><Monitor size={17} /> Simulation Screen</div>
      <div className="screen-frame-summary">
        <strong>{Math.round(viewportWidth)} x {Math.round(viewportHeight)}</strong>
        <span>{selectedViewportPresetLabel} / {viewportRatioLabel}</span>
      </div>
      <div className="device-preset-grid">
        {viewportPresets.map(preset => (
          <button
            key={preset.id}
            type="button"
            className={viewportPreset === preset.id ? "active" : ""}
            onClick={() => onViewportPresetChange(preset)}
          >
            <span className="device-preset-title"><ViewportPresetIconView icon={preset.icon} /> {preset.label}</span>
            <span className="device-preset-meta">{preset.width} x {preset.height} / {preset.note}</span>
          </button>
        ))}
      </div>
      <div className="two-col">
        <div>
          <label>Frame Width</label>
          <input type="number" min="240" value={Math.round(viewportWidth)} onChange={event => onViewportWidthChange(Number(event.target.value))} />
        </div>
        <div>
          <label>Frame Height</label>
          <input type="number" min="240" value={Math.round(viewportHeight)} onChange={event => onViewportHeightChange(Number(event.target.value))} />
        </div>
      </div>
      <label>Background Fit</label>
      <select value={backgroundFit || "stretch"} onChange={event => onBackgroundFitChange(event.target.value as SceneLayer["fit"])}>
        <option value="stretch">Stretch to world</option>
        <option value="cover">Cover frame</option>
        <option value="contain">Contain frame</option>
        <option value="tile">Tile</option>
      </select>
      <label>Background Position</label>
      <input
        value={backgroundPosition || "left center"}
        onChange={event => onBackgroundPositionChange(event.target.value)}
        placeholder="left center / center center / 40% 50%"
      />
      <div className="control-hint">The scene world can stay wide while this frame controls the visible screen size for desktop, tablet, and phone previews.</div>
    </section>
  );
}
