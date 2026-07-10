import type { GameScene, GameStartUiLayer, GameStartUiSettings } from "../../../types";
import { StartUiEffectsInspector } from "./StartUiEffectsInspector";
import { StartUiLayerInspector } from "./StartUiLayerInspector";
import { StartUiMenuInspector } from "./StartUiMenuInspector";
import { StartUiRuntimeInspector } from "./StartUiRuntimeInspector";
import { StartUiScreenInspector } from "./StartUiScreenInspector";
import type { PatchStartUiDraft, PatchStartUiLayer } from "./startUiInspectorTypes";

type StartUiInspectorProps = {
  designHeight: number;
  designWidth: number;
  draft: GameStartUiSettings;
  scenes: GameScene[];
  selectedLayer: GameStartUiLayer | null;
  onDeleteSelectedLayer: () => void;
  onPatchDraft: PatchStartUiDraft;
  onPatchLayer: PatchStartUiLayer;
};

export function StartUiInspector({
  designHeight,
  designWidth,
  draft,
  scenes,
  selectedLayer,
  onDeleteSelectedLayer,
  onPatchDraft,
  onPatchLayer,
}: StartUiInspectorProps) {
  return (
    <aside className="scene-start-ui-inspector">
      <StartUiScreenInspector
        designHeight={designHeight}
        designWidth={designWidth}
        draft={draft}
        scenes={scenes}
        onPatchDraft={onPatchDraft}
      />
      {selectedLayer && (
        <StartUiLayerInspector
          layer={selectedLayer}
          onDelete={onDeleteSelectedLayer}
          onPatchLayer={onPatchLayer}
        />
      )}
      <StartUiEffectsInspector draft={draft} onPatchDraft={onPatchDraft} />
      <StartUiMenuInspector draft={draft} onPatchDraft={onPatchDraft} />
      <StartUiRuntimeInspector draft={draft} onPatchDraft={onPatchDraft} />
    </aside>
  );
}
