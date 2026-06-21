import { Film } from "lucide-react";

type MotionSpeedPanelProps = {
  fps: number;
  walkSpeed: number;
  onFpsChange: (value: number) => void;
  onWalkSpeedChange: (value: number) => void;
};

export function MotionSpeedPanel({ fps, walkSpeed, onFpsChange, onWalkSpeedChange }: MotionSpeedPanelProps) {
  return (
    <section>
      <div className="section-title"><Film size={17} /> Motion Speed</div>
      <div className="layer-controls">
        <label>Animation FPS {fps}</label>
        <input type="range" min="4" max="24" step="1" value={fps} onChange={event => onFpsChange(Number(event.target.value))} />
        <label>Walk Speed {walkSpeed} px/s</label>
        <input type="range" min="40" max="240" step="5" value={walkSpeed} onChange={event => onWalkSpeedChange(Number(event.target.value))} />
        <div className="control-hint">FPS controls spritesheet playback. Walk speed only controls A/D movement through the long scene.</div>
      </div>
    </section>
  );
}
