import { Monitor, Save, Settings, X } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { normalizeStartUiSettings } from "../../../domain/scene/startUiModel";
import type { GameScene, GameStartUiSettings, StartUiTheme } from "../../../types";

type SceneStartUiPanelProps = {
  isSaving?: boolean;
  scenes: GameScene[];
  settings: GameStartUiSettings;
  onClose: () => void;
  onSave: (settings: GameStartUiSettings) => void | Promise<void>;
};

const THEME_OPTIONS: Array<{ value: StartUiTheme; label: string }> = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "horror", label: "Horror" },
];

function toggleLabel(value: boolean) {
  return value ? "On" : "Off";
}

export function SceneStartUiPanel({
  isSaving = false,
  scenes,
  settings,
  onClose,
  onSave,
}: SceneStartUiPanelProps) {
  const [draft, setDraft] = useState<GameStartUiSettings>(() => normalizeStartUiSettings(settings, scenes));

  useEffect(() => {
    setDraft(normalizeStartUiSettings(settings, scenes));
  }, [scenes, settings]);

  const selectedStartScene = useMemo(() => (
    scenes.find(scene => scene.id === draft.initialSceneId) || scenes[0]
  ), [draft.initialSceneId, scenes]);

  const patchDraft = (patch: Partial<GameStartUiSettings>) => {
    setDraft(prev => normalizeStartUiSettings({ ...prev, ...patch }, scenes));
  };

  const handleNumberInput = (key: "saveSlots" | "musicVolume" | "sfxVolume") => (event: ChangeEvent<HTMLInputElement>) => {
    patchDraft({ [key]: Number(event.target.value) } as Partial<GameStartUiSettings>);
  };

  const menuButtons = [
    { visible: true, label: draft.primaryActionLabel },
    { visible: draft.showContinue, label: draft.continueActionLabel },
    { visible: draft.showLoadGame, label: draft.loadActionLabel },
    { visible: draft.showSettings, label: draft.settingsActionLabel },
    { visible: draft.showQuit, label: draft.quitActionLabel },
  ].filter(item => item.visible);

  return (
    <div className="scene-start-ui-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="scene-start-ui-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scene-start-ui-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="scene-start-ui-header">
          <div>
            <strong id="scene-start-ui-title"><Monitor size={16} /> Start UI</strong>
            <span>{selectedStartScene ? `Entry: ${selectedStartScene.name}` : "Entry: Not set"}</span>
          </div>
          <button type="button" aria-label="Close Start UI editor" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="scene-start-ui-body">
          <div className={`scene-start-ui-preview ${draft.theme}`}>
            {draft.backgroundImageUrl && <img src={draft.backgroundImageUrl} alt="" draggable={false} />}
            <div className="scene-start-ui-preview-content">
              <span>{draft.enabled ? "Enabled" : "Disabled"}</span>
              <h2>{draft.title}</h2>
              <p>{draft.subtitle}</p>
              <div className="scene-start-ui-menu">
                {menuButtons.map(item => (
                  <button type="button" key={item.label}>{item.label}</button>
                ))}
              </div>
              <small>{draft.saveSlots} save slots / Autosave {toggleLabel(draft.autosave)}</small>
            </div>
          </div>

          <div className="scene-start-ui-editor">
            <div className="scene-start-ui-section">
              <strong>Screen</strong>
              <label>
                Title
                <input value={draft.title} onChange={event => patchDraft({ title: event.target.value })} />
              </label>
              <label>
                Subtitle
                <input value={draft.subtitle} onChange={event => patchDraft({ subtitle: event.target.value })} />
              </label>
              <label>
                Theme
                <select value={draft.theme} onChange={event => patchDraft({ theme: event.target.value as StartUiTheme })}>
                  {THEME_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Start Scene
                <select value={draft.initialSceneId || ""} onChange={event => patchDraft({ initialSceneId: event.target.value })}>
                  {scenes.map(scene => (
                    <option key={scene.id} value={scene.id}>{scene.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Background URL
                <input value={draft.backgroundImageUrl || ""} onChange={event => patchDraft({ backgroundImageUrl: event.target.value })} placeholder="/generated/start_screen.png" />
              </label>
            </div>

            <div className="scene-start-ui-section">
              <strong>Menu</strong>
              <label>
                New Game Label
                <input value={draft.primaryActionLabel} onChange={event => patchDraft({ primaryActionLabel: event.target.value })} />
              </label>
              <label>
                Continue Label
                <input value={draft.continueActionLabel} onChange={event => patchDraft({ continueActionLabel: event.target.value })} />
              </label>
              <label>
                Load Label
                <input value={draft.loadActionLabel} onChange={event => patchDraft({ loadActionLabel: event.target.value })} />
              </label>
              <label>
                Settings Label
                <input value={draft.settingsActionLabel} onChange={event => patchDraft({ settingsActionLabel: event.target.value })} />
              </label>
              <label>
                Quit Label
                <input value={draft.quitActionLabel} onChange={event => patchDraft({ quitActionLabel: event.target.value })} />
              </label>
            </div>

            <div className="scene-start-ui-section compact">
              <strong>Save System</strong>
              <label>
                Save Slots
                <input type="number" min="1" max="12" value={draft.saveSlots} onChange={handleNumberInput("saveSlots")} />
              </label>
              <label className="scene-start-ui-toggle">
                <input type="checkbox" checked={draft.autosave} onChange={event => patchDraft({ autosave: event.target.checked })} />
                Autosave
              </label>
              <label className="scene-start-ui-toggle">
                <input type="checkbox" checked={draft.confirmNewGame} onChange={event => patchDraft({ confirmNewGame: event.target.checked })} />
                Confirm New Game
              </label>
              <label className="scene-start-ui-toggle">
                <input type="checkbox" checked={draft.showContinue} onChange={event => patchDraft({ showContinue: event.target.checked })} />
                Show Continue
              </label>
              <label className="scene-start-ui-toggle">
                <input type="checkbox" checked={draft.showLoadGame} onChange={event => patchDraft({ showLoadGame: event.target.checked })} />
                Show Load Game
              </label>
            </div>

            <div className="scene-start-ui-section compact">
              <strong><Settings size={14} /> Settings</strong>
              <label>
                Music <span>{draft.musicVolume}</span>
                <input type="range" min="0" max="100" value={draft.musicVolume} onChange={handleNumberInput("musicVolume")} />
              </label>
              <label>
                SFX <span>{draft.sfxVolume}</span>
                <input type="range" min="0" max="100" value={draft.sfxVolume} onChange={handleNumberInput("sfxVolume")} />
              </label>
              <label className="scene-start-ui-toggle">
                <input type="checkbox" checked={draft.showSettings} onChange={event => patchDraft({ showSettings: event.target.checked })} />
                Show Settings
              </label>
              <label className="scene-start-ui-toggle">
                <input type="checkbox" checked={draft.fullscreenToggle} onChange={event => patchDraft({ fullscreenToggle: event.target.checked })} />
                Fullscreen Toggle
              </label>
              <label className="scene-start-ui-toggle">
                <input type="checkbox" checked={draft.languageSelector} onChange={event => patchDraft({ languageSelector: event.target.checked })} />
                Language Selector
              </label>
              <label className="scene-start-ui-toggle">
                <input type="checkbox" checked={draft.showQuit} onChange={event => patchDraft({ showQuit: event.target.checked })} />
                Show Quit
              </label>
            </div>
          </div>
        </div>

        <footer className="scene-start-ui-footer">
          <label className="scene-start-ui-toggle enabled">
            <input type="checkbox" checked={draft.enabled} onChange={event => patchDraft({ enabled: event.target.checked })} />
            Start UI Enabled
          </label>
          <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
          <button type="button" className="primary-button" onClick={() => void onSave(draft)} disabled={isSaving}>
            <Save size={15} /> {isSaving ? "Saving" : "Save Start UI"}
          </button>
        </footer>
      </section>
    </div>
  );
}
