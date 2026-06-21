import { ArrowLeft, CheckCircle2, Download, Map as MapIcon, Pause, Play, Plus, Save } from "lucide-react";

type WorkspaceTopbarProps = {
  isPlaying: boolean;
  onBack: () => void;
  onDownloadSheet: () => void;
  onOpenScenes: () => void;
  onSaveAsset: () => void;
  onSaveComplete: () => void;
  onSaveScene: () => void;
  onStartNewScene: () => void;
  onTogglePlay: () => void;
};

export function WorkspaceTopbar({
  isPlaying,
  onBack,
  onDownloadSheet,
  onOpenScenes,
  onSaveAsset,
  onSaveComplete,
  onSaveScene,
  onStartNewScene,
  onTogglePlay,
}: WorkspaceTopbarProps) {
  return (
    <header className="topbar">
      <button type="button" className="mode-back-button" onClick={onBack}>
        <ArrowLeft size={16} /> Back
      </button>
      <div className="topbar-title">
        <p className="eyebrow">2D Side-Scroller Asset Studio</p>
        <h1>Spritesheet Game Asset Pipeline</h1>
      </div>
      <div className="top-actions">
        <button type="button" onClick={onOpenScenes} className="ghost-button"><MapIcon size={16} /> Scenes</button>
        <button type="button" onClick={onTogglePlay} className="ghost-button">
          {isPlaying ? <Pause size={16} /> : <Play size={16} />} {isPlaying ? "Pause" : "Play"}
        </button>
        <button type="button" onClick={onSaveAsset} className="ghost-button"><CheckCircle2 size={16} /> Confirm Asset</button>
        <button type="button" onClick={onSaveScene} className="ghost-button"><Save size={16} /> Save Scene</button>
        <button type="button" onClick={onSaveComplete} className="ghost-button"><CheckCircle2 size={16} /> Save Complete</button>
        <button type="button" onClick={onStartNewScene} className="ghost-button"><Plus size={16} /> New Scene</button>
        <button type="button" onClick={onDownloadSheet} className="primary-button"><Download size={16} /> Download Sheet</button>
      </div>
    </header>
  );
}
