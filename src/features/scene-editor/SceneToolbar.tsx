import { Copy, Download, Plus, Trash2 } from "lucide-react";

type SceneToolbarProps = {
  sceneName: string;
  onDuplicateSelectedLayer: () => void;
  onExportScene: () => void;
  onInsertActiveSprite: () => void;
  onRemoveSelectedLayer: () => void;
  onSceneNameChange: (name: string) => void;
};

export function SceneToolbar({
  sceneName,
  onDuplicateSelectedLayer,
  onExportScene,
  onInsertActiveSprite,
  onRemoveSelectedLayer,
  onSceneNameChange,
}: SceneToolbarProps) {
  return (
    <div className="scene-toolbar">
      <input
        className="scene-name-input"
        value={sceneName}
        onChange={event => onSceneNameChange(event.target.value)}
        aria-label="Scene name"
      />
      <button className="ghost-button" type="button" onClick={onInsertActiveSprite}><Plus size={16} /> Insert Current Action</button>
      <button className="ghost-button" type="button" onClick={onDuplicateSelectedLayer}><Copy size={16} /> Duplicate Layer</button>
      <button className="ghost-button" type="button" onClick={onRemoveSelectedLayer}><Trash2 size={16} /> Delete Layer</button>
      <button className="ghost-button" type="button" onClick={onExportScene}><Download size={16} /> Export Scene JSON</button>
    </div>
  );
}
