import { Layers, Settings, Trash2 } from "lucide-react";
import type { ChangeEvent } from "react";
import type { GameScene, GameStartUiLayer, GameStartUiSettings, StartUiLayerKind, StartUiTheme } from "../../../types";
import { START_UI_LAYER_KIND_OPTIONS, START_UI_THEME_OPTIONS } from "./startUiEditorOptions";
import { toggleLabel } from "./startUiLayerModel";

type StartUiInspectorProps = {
  designHeight: number;
  designWidth: number;
  draft: GameStartUiSettings;
  scenes: GameScene[];
  selectedLayer: GameStartUiLayer | null;
  onDeleteSelectedLayer: () => void;
  onNumberInput: (key: "saveSlots" | "musicVolume" | "sfxVolume") => (event: ChangeEvent<HTMLInputElement>) => void;
  onPatchDraft: (patch: Partial<GameStartUiSettings>) => void;
  onPatchLayer: (layerId: string, patch: Partial<GameStartUiLayer>) => void;
};

export function StartUiInspector({
  designHeight,
  designWidth,
  draft,
  scenes,
  selectedLayer,
  onDeleteSelectedLayer,
  onNumberInput,
  onPatchDraft,
  onPatchLayer,
}: StartUiInspectorProps) {
  return (
    <aside className="scene-start-ui-inspector">
      <div className="scene-start-ui-section">
        <strong>Screen</strong>
        <label>
          Title
          <input value={draft.title} onChange={event => onPatchDraft({ title: event.target.value })} />
        </label>
        <label>
          Subtitle
          <input value={draft.subtitle} onChange={event => onPatchDraft({ subtitle: event.target.value })} />
        </label>
        <label>
          Theme
          <select value={draft.theme} onChange={event => onPatchDraft({ theme: event.target.value as StartUiTheme })}>
            {START_UI_THEME_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          Start Scene
          <select value={draft.initialSceneId || ""} onChange={event => onPatchDraft({ initialSceneId: event.target.value })}>
            {scenes.map(scene => <option key={scene.id} value={scene.id}>{scene.name}</option>)}
          </select>
        </label>
        <div className="scene-start-ui-layer-grid two">
          <label>
            Width
            <input type="number" min="320" value={Math.round(designWidth)} onChange={event => onPatchDraft({ designWidth: Number(event.target.value) })} />
          </label>
          <label>
            Height
            <input type="number" min="180" value={Math.round(designHeight)} onChange={event => onPatchDraft({ designHeight: Number(event.target.value) })} />
          </label>
        </div>
        <label>
          Background URL
          <input value={draft.backgroundImageUrl || ""} onChange={event => onPatchDraft({ backgroundImageUrl: event.target.value })} placeholder="/generated/start_screen.png" />
        </label>
      </div>

      {selectedLayer && (
        <div className="scene-start-ui-section">
          <strong><Layers size={14} /> Layer</strong>
          <label>
            Name
            <input value={selectedLayer.name} onChange={event => onPatchLayer(selectedLayer.id, { name: event.target.value })} />
          </label>
          <label>
            Kind
            <select value={selectedLayer.kind} onChange={event => onPatchLayer(selectedLayer.id, { kind: event.target.value as StartUiLayerKind })}>
              {START_UI_LAYER_KIND_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Label
            <input value={selectedLayer.label || ""} onChange={event => onPatchLayer(selectedLayer.id, { label: event.target.value })} />
          </label>
          <label>
            Image URL
            <input value={selectedLayer.imageUrl || ""} onChange={event => onPatchLayer(selectedLayer.id, { imageUrl: event.target.value })} />
          </label>
          <div className="scene-start-ui-layer-grid four">
            <label>
              X
              <input type="number" value={selectedLayer.x} onChange={event => onPatchLayer(selectedLayer.id, { x: Number(event.target.value) })} />
            </label>
            <label>
              Y
              <input type="number" value={selectedLayer.y} onChange={event => onPatchLayer(selectedLayer.id, { y: Number(event.target.value) })} />
            </label>
            <label>
              W
              <input type="number" min="1" value={selectedLayer.width} onChange={event => onPatchLayer(selectedLayer.id, { width: Number(event.target.value) })} />
            </label>
            <label>
              H
              <input type="number" min="1" value={selectedLayer.height} onChange={event => onPatchLayer(selectedLayer.id, { height: Number(event.target.value) })} />
            </label>
          </div>
          <div className="scene-start-ui-layer-grid two">
            <label>
              Z
              <input type="number" value={selectedLayer.zIndex} onChange={event => onPatchLayer(selectedLayer.id, { zIndex: Number(event.target.value) })} />
            </label>
            <label>
              Opacity <span>{Math.round(selectedLayer.opacity * 100)}%</span>
              <input type="range" min="0" max="1" step="0.01" value={selectedLayer.opacity} onChange={event => onPatchLayer(selectedLayer.id, { opacity: Number(event.target.value) })} />
            </label>
          </div>
          <label className="scene-start-ui-toggle">
            <input type="checkbox" checked={selectedLayer.visible} onChange={event => onPatchLayer(selectedLayer.id, { visible: event.target.checked })} />
            Visible
          </label>
          <label className="scene-start-ui-toggle">
            <input type="checkbox" checked={Boolean(selectedLayer.locked)} onChange={event => onPatchLayer(selectedLayer.id, { locked: event.target.checked })} />
            Locked
          </label>
          {selectedLayer.sourceWidth && (
            <button type="button" className="ghost-button" onClick={() => onPatchLayer(selectedLayer.id, { sourceX: undefined, sourceY: undefined, sourceWidth: undefined, sourceHeight: undefined })}>
              Use Full Image
            </button>
          )}
          <button type="button" className="ghost-button danger" onClick={onDeleteSelectedLayer}>
            <Trash2 size={14} /> Delete Layer
          </button>
        </div>
      )}

      <div className="scene-start-ui-section">
        <strong>Menu</strong>
        <label>
          New Game Label
          <input value={draft.primaryActionLabel} onChange={event => onPatchDraft({ primaryActionLabel: event.target.value })} />
        </label>
        <label>
          Continue Label
          <input value={draft.continueActionLabel} onChange={event => onPatchDraft({ continueActionLabel: event.target.value })} />
        </label>
        <label>
          Load Label
          <input value={draft.loadActionLabel} onChange={event => onPatchDraft({ loadActionLabel: event.target.value })} />
        </label>
        <label>
          Settings Label
          <input value={draft.settingsActionLabel} onChange={event => onPatchDraft({ settingsActionLabel: event.target.value })} />
        </label>
        <label>
          Quit Label
          <input value={draft.quitActionLabel} onChange={event => onPatchDraft({ quitActionLabel: event.target.value })} />
        </label>
      </div>

      <div className="scene-start-ui-section compact">
        <strong><Settings size={14} /> Settings</strong>
        <label className="scene-start-ui-toggle enabled">
          <input type="checkbox" checked={draft.enabled} onChange={event => onPatchDraft({ enabled: event.target.checked })} />
          Start UI Enabled
        </label>
        <label>
          Save Slots
          <input type="number" min="1" max="12" value={draft.saveSlots} onChange={onNumberInput("saveSlots")} />
        </label>
        <label>
          Music <span>{draft.musicVolume}</span>
          <input type="range" min="0" max="100" value={draft.musicVolume} onChange={onNumberInput("musicVolume")} />
        </label>
        <label>
          SFX <span>{draft.sfxVolume}</span>
          <input type="range" min="0" max="100" value={draft.sfxVolume} onChange={onNumberInput("sfxVolume")} />
        </label>
        <label className="scene-start-ui-toggle">
          <input type="checkbox" checked={draft.autosave} onChange={event => onPatchDraft({ autosave: event.target.checked })} />
          Autosave {toggleLabel(draft.autosave)}
        </label>
        <label className="scene-start-ui-toggle">
          <input type="checkbox" checked={draft.confirmNewGame} onChange={event => onPatchDraft({ confirmNewGame: event.target.checked })} />
          Confirm New Game
        </label>
        <label className="scene-start-ui-toggle">
          <input type="checkbox" checked={draft.showContinue} onChange={event => onPatchDraft({ showContinue: event.target.checked })} />
          Show Continue
        </label>
        <label className="scene-start-ui-toggle">
          <input type="checkbox" checked={draft.showLoadGame} onChange={event => onPatchDraft({ showLoadGame: event.target.checked })} />
          Show Load Game
        </label>
        <label className="scene-start-ui-toggle">
          <input type="checkbox" checked={draft.showSettings} onChange={event => onPatchDraft({ showSettings: event.target.checked })} />
          Show Settings
        </label>
        <label className="scene-start-ui-toggle">
          <input type="checkbox" checked={draft.fullscreenToggle} onChange={event => onPatchDraft({ fullscreenToggle: event.target.checked })} />
          Fullscreen Toggle
        </label>
        <label className="scene-start-ui-toggle">
          <input type="checkbox" checked={draft.languageSelector} onChange={event => onPatchDraft({ languageSelector: event.target.checked })} />
          Language Selector
        </label>
        <label className="scene-start-ui-toggle">
          <input type="checkbox" checked={draft.showQuit} onChange={event => onPatchDraft({ showQuit: event.target.checked })} />
          Show Quit
        </label>
      </div>
    </aside>
  );
}
