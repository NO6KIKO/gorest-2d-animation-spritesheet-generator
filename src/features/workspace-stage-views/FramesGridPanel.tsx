import type { CSSProperties } from "react";

type FramesGridPanelProps = {
  activeFrameIndex: number;
  checkerStyle: CSSProperties;
  frameRatio: string;
  frames: string[];
  onSelectFrame: (frameIndex: number) => void;
};

export function FramesGridPanel({ activeFrameIndex, checkerStyle, frameRatio, frames, onSelectFrame }: FramesGridPanelProps) {
  return (
    <div className="frames-grid">
      {frames.map((svg, idx) => (
        <button key={idx} type="button" className={`frame-tile ${idx === activeFrameIndex ? "active" : ""}`} onClick={() => onSelectFrame(idx)}>
          <div className="frame-canvas" style={{ ...checkerStyle, aspectRatio: frameRatio }}><div dangerouslySetInnerHTML={{ __html: svg }} /></div>
          <div className="frame-meta"><span>Frame {idx + 1}</span></div>
        </button>
      ))}
    </div>
  );
}
