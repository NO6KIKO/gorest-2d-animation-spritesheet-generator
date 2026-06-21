import type { SceneLayer } from "../../types";

type SceneInspectorAvatarSectionProps = {
  isPlaying: boolean;
  selectedLayer: SceneLayer;
  walkSpeed: number;
  onPlayingChange: (isPlaying: boolean) => void;
  onWalkSpeedChange: (walkSpeed: number) => void;
};

export function SceneInspectorAvatarSection({
  isPlaying,
  selectedLayer,
  walkSpeed,
  onPlayingChange,
  onWalkSpeedChange,
}: SceneInspectorAvatarSectionProps) {
  return (
    <div className="compact-inspector-section avatar-inspector-section">
      <em>Avatar</em>
      <label>Walk Speed {walkSpeed}px/s</label>
      <input
        type="range"
        min="40"
        max="260"
        step="5"
        value={walkSpeed}
        onChange={event => onWalkSpeedChange(Number(event.target.value))}
        disabled={selectedLayer.locked}
      />
      <label className="compact-toggle">
        <input
          type="checkbox"
          checked={isPlaying}
          onChange={event => onPlayingChange(event.target.checked)}
        />
        Preview animation
      </label>
    </div>
  );
}
