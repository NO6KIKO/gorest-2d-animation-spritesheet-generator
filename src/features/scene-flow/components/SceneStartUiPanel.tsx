import type { GameScene, GameStartUiSettings } from "../../../types";
import { StartUiInspector } from "../start-ui/StartUiInspector";
import { StartUiLayerRail } from "../start-ui/StartUiLayerRail";
import { StartUiWorkbench } from "../start-ui/StartUiWorkbench";
import { useStartUiEditor } from "../start-ui/useStartUiEditor";

type SceneStartUiPanelProps = {
  isSaving?: boolean;
  scenes: GameScene[];
  settings: GameStartUiSettings;
  onSave: (settings: GameStartUiSettings) => void | Promise<void>;
};

export function SceneStartUiPanel({
  isSaving = false,
  scenes,
  settings,
  onSave,
}: SceneStartUiPanelProps) {
  const editor = useStartUiEditor({ scenes, settings });

  return (
    <div className="scene-start-ui-page">
      <StartUiLayerRail
        isProcessingArtwork={editor.isProcessingArtwork}
        layers={editor.orderedLayers}
        selectedLayerId={editor.selectedLayerId}
        selectedStartScene={editor.selectedStartScene}
        title={editor.draft.title}
        onAddTextButtonLayer={editor.addTextButtonLayer}
        onAutoLayoutFromBackground={editor.autoLayoutFromBackground}
        onAutoSplitCurrentArtwork={editor.autoSplitCurrentArtwork}
        onBackgroundUpload={editor.handleBackgroundUpload}
        onLayerUpload={editor.handleLayerUpload}
        onSelectLayer={editor.setSelectedLayerId}
        onWholeUiUpload={editor.handleWholeUiUpload}
      />

      <StartUiWorkbench
        designHeight={editor.designHeight}
        designWidth={editor.designWidth}
        draft={editor.draft}
        isProcessingArtwork={editor.isProcessingArtwork}
        isSaving={isSaving}
        selectedLayerId={editor.selectedLayerId}
        stageRef={editor.stageRef}
        uiError={editor.uiError}
        visibleLayers={editor.visibleLayers}
        onFinishLayerDrag={editor.finishLayerDrag}
        onSave={onSave}
        onStartLayerDrag={editor.startLayerDrag}
        onUpdateLayerDrag={editor.updateLayerDrag}
      />

      <StartUiInspector
        designHeight={editor.designHeight}
        designWidth={editor.designWidth}
        draft={editor.draft}
        scenes={scenes}
        selectedLayer={editor.selectedLayer}
        onDeleteSelectedLayer={editor.deleteSelectedLayer}
        onNumberInput={editor.handleNumberInput}
        onPatchDraft={editor.patchDraft}
        onPatchLayer={editor.patchLayer}
      />
    </div>
  );
}
