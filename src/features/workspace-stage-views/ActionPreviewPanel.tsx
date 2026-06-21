import type { BackgroundMode } from "../../app/types";

type ActionPreviewPanelProps = {
  activeFrameIndex: number;
  backgroundClassName: string;
  backgroundMode: BackgroundMode;
  frameCount: number;
  frameRatio: string;
  isPlaying: boolean;
  isTallFrame: boolean;
  svgFrame: string;
  onBackgroundModeChange: (mode: BackgroundMode) => void;
  onNextFrame: () => void;
  onPreviousFrame: () => void;
  onSelectFrame: (frameIndex: number) => void;
  onTogglePlay: () => void;
};

const backgroundModes: Array<{ label: string; value: BackgroundMode }> = [
  { label: "Grid", value: "checker" },
  { label: "Dark", value: "dark" },
  { label: "Light", value: "light" },
  { label: "Green", value: "green" },
];

export function ActionPreviewPanel({
  activeFrameIndex,
  backgroundClassName,
  backgroundMode,
  frameCount,
  frameRatio,
  isPlaying,
  isTallFrame,
  svgFrame,
  onBackgroundModeChange,
  onNextFrame,
  onPreviousFrame,
  onSelectFrame,
  onTogglePlay,
}: ActionPreviewPanelProps) {
  return (
    <div className="simulator-row">
      <div className={backgroundClassName}>
        {svgFrame ? (
          <div
            className={`sprite-render ${isTallFrame ? "tall" : ""}`}
            style={{ aspectRatio: frameRatio }}
            dangerouslySetInnerHTML={{ __html: svgFrame }}
          />
        ) : <span>No frames</span>}
      </div>
      <div className="timeline-panel">
        <div className="big-frame">{String(activeFrameIndex + 1).padStart(2, "0")}<span>/{frameCount}</span></div>
        <input type="range" min="0" max={Math.max(0, frameCount - 1)} value={activeFrameIndex} onChange={event => onSelectFrame(Number(event.target.value))} />
        <div className="player-controls">
          <button type="button" onClick={onPreviousFrame}>Previous Frame</button>
          <button type="button" onClick={onTogglePlay}>{isPlaying ? "Pause" : "Play"}</button>
          <button type="button" onClick={onNextFrame}>Next Frame</button>
        </div>
        <div className="bg-buttons">
          {backgroundModes.map(mode => (
            <button key={mode.value} type="button" className={backgroundMode === mode.value ? "active" : ""} onClick={() => onBackgroundModeChange(mode.value)}>
              {mode.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
