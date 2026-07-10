import type { GameScene, GameStartUiSettings } from "../../../types";
import { StartUiInspector, StartUiLayerRail, StartUiWorkbench, useStartUiEditor } from "../start-ui";

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
        uiStatus={editor.uiStatus}
        visibleLayers={editor.visibleLayers}
        onFinishLayerDrag={editor.finishLayerDrag}
        onSave={onSave}
        onStartLayerDrag={editor.startLayerDrag}
        onStartSelectedLayerDrag={editor.startSelectedLayerDrag}
        onStageKeyDown={editor.handleStageKeyDown}
        onUpdateLayerDrag={editor.updateLayerDrag}
      />

      <StartUiInspector
        designHeight={editor.designHeight}
        designWidth={editor.designWidth}
        draft={editor.draft}
        scenes={scenes}
        selectedLayer={editor.selectedLayer}
        onDeleteSelectedLayer={editor.deleteSelectedLayer}
        onPatchDraft={editor.patchDraft}
        onPatchLayer={editor.patchLayer}
      />
    </div>
  );
}
