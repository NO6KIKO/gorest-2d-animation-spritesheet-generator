import type { GameScene, GameStartUiSettings, StartUiTheme } from "../../../types";
import { START_UI_THEME_OPTIONS } from "./startUiEditorOptions";
import { StartUiSelectControl } from "./StartUiInspectorControls";
import type { PatchStartUiDraft } from "./startUiInspectorTypes";

type StartUiScreenInspectorProps = {
  designHeight: number;
  designWidth: number;
  draft: GameStartUiSettings;
  scenes: GameScene[];
  onPatchDraft: PatchStartUiDraft;
};

export function StartUiScreenInspector({
  designHeight,
  designWidth,
  draft,
  scenes,
  onPatchDraft,
}: StartUiScreenInspectorProps) {
  const sceneOptions = scenes.map(scene => ({ label: scene.name, value: scene.id }));

  return (
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
      <StartUiSelectControl<StartUiTheme>
        label="Theme"
        options={START_UI_THEME_OPTIONS}
        value={draft.theme}
        onChange={theme => onPatchDraft({ theme })}
      />
      <StartUiSelectControl
        label="Start Scene"
        options={sceneOptions}
        value={draft.initialSceneId || ""}
        onChange={initialSceneId => onPatchDraft({ initialSceneId })}
      />
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
  );
}
