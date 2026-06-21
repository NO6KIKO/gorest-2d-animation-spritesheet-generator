import { Pause, Play, Save } from "lucide-react";

type SceneSpritesheetsHeaderProps = {
  clipCount: number;
  isPlaying: boolean;
  onSaveScene: () => void;
  onTogglePlay: () => void;
};

export function SceneSpritesheetsHeader({ clipCount, isPlaying, onSaveScene, onTogglePlay }: SceneSpritesheetsHeaderProps) {
  return (
    <div className="scene-library-header">
      <div>
        <p className="eyebrow">Scene Spritesheets</p>
        <h3>{clipCount} animation clips in this scene</h3>
      </div>
      <div className="scene-library-actions">
        <button type="button" className="ghost-button" onClick={onTogglePlay}>
          {isPlaying ? <Pause size={16} /> : <Play size={16} />} {isPlaying ? "Pause All" : "Play All"}
        </button>
        <button type="button" className="primary-button" onClick={onSaveScene}><Save size={16} /> Save Scene</button>
      </div>
    </div>
  );
}
