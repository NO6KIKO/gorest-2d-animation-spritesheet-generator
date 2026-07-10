import { Settings } from "lucide-react";
import type { GameStartUiSettings } from "../../../types";
import { StartUiRangeControl, StartUiToggleControl } from "./StartUiInspectorControls";
import type { PatchStartUiDraft } from "./startUiInspectorTypes";
import { toggleLabel } from "./startUiPresentation";

type StartUiRuntimeInspectorProps = {
  draft: GameStartUiSettings;
  onPatchDraft: PatchStartUiDraft;
};

export function StartUiRuntimeInspector({ draft, onPatchDraft }: StartUiRuntimeInspectorProps) {
  return (
    <div className="scene-start-ui-section compact">
      <strong><Settings size={14} /> Settings</strong>
      <StartUiToggleControl checked={draft.enabled} emphasized onChange={enabled => onPatchDraft({ enabled })}>
        Start UI Enabled
      </StartUiToggleControl>
      <label>
        Save Slots
        <input type="number" min="1" max="12" value={draft.saveSlots} onChange={event => onPatchDraft({ saveSlots: Number(event.target.value) })} />
      </label>
      <StartUiRangeControl
        label="Music"
        min={0}
        max={100}
        value={draft.musicVolume}
        onChange={musicVolume => onPatchDraft({ musicVolume })}
      />
      <StartUiRangeControl
        label="SFX"
        min={0}
        max={100}
        value={draft.sfxVolume}
        onChange={sfxVolume => onPatchDraft({ sfxVolume })}
      />
      <StartUiToggleControl checked={draft.autosave} onChange={autosave => onPatchDraft({ autosave })}>
        Autosave {toggleLabel(draft.autosave)}
      </StartUiToggleControl>
      <StartUiToggleControl checked={draft.confirmNewGame} onChange={confirmNewGame => onPatchDraft({ confirmNewGame })}>
        Confirm New Game
      </StartUiToggleControl>
      <StartUiToggleControl checked={draft.showContinue} onChange={showContinue => onPatchDraft({ showContinue })}>
        Show Continue
      </StartUiToggleControl>
      <StartUiToggleControl checked={draft.showLoadGame} onChange={showLoadGame => onPatchDraft({ showLoadGame })}>
        Show Load Game
      </StartUiToggleControl>
      <StartUiToggleControl checked={draft.showSettings} onChange={showSettings => onPatchDraft({ showSettings })}>
        Show Settings
      </StartUiToggleControl>
      <StartUiToggleControl checked={draft.fullscreenToggle} onChange={fullscreenToggle => onPatchDraft({ fullscreenToggle })}>
        Fullscreen Toggle
      </StartUiToggleControl>
      <StartUiToggleControl checked={draft.languageSelector} onChange={languageSelector => onPatchDraft({ languageSelector })}>
        Language Selector
      </StartUiToggleControl>
      <StartUiToggleControl checked={draft.showQuit} onChange={showQuit => onPatchDraft({ showQuit })}>
        Show Quit
      </StartUiToggleControl>
    </div>
  );
}
