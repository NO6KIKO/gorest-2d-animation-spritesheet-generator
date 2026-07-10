import type { GameStartUiSettings } from "../../../types";
import type { PatchStartUiDraft } from "./startUiInspectorTypes";

type StartUiMenuInspectorProps = {
  draft: GameStartUiSettings;
  onPatchDraft: PatchStartUiDraft;
};

export function StartUiMenuInspector({ draft, onPatchDraft }: StartUiMenuInspectorProps) {
  return (
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
  );
}
