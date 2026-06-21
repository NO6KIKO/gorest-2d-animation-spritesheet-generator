import type {
  AnimationClip,
  GameAsset,
  GameScene,
  InteractionPreset,
  LayerInteractionSettings,
  LayerLightingSettings,
  LayerShadowSettings,
  SceneLayer,
} from "../../types";
import { BackgroundLayerControls } from "./BackgroundLayerControls";
import { LayerInteractionControls } from "./LayerInteractionControls";
import { LayerStackList } from "./LayerStackList";
import { LayerTransformControls } from "./LayerTransformControls";
import { LayerVisibilityControls } from "./LayerVisibilityControls";
import { VisualLayerAnimationLightingControls } from "./VisualLayerAnimationLightingControls";

type LayerBounds = {
  width: number;
  height: number;
};

type SceneLayerControlsPanelProps = {
  draggedLayerId: string | null;
  getClipButtonText: (clip: AnimationClip) => string;
  getLayerWorldBounds: (layer: SceneLayer, asset?: GameAsset) => LayerBounds;
  interactionPresets: Record<string, { label: string }>;
  isVisualLayer: (layer: SceneLayer) => boolean;
  layers: SceneLayer[];
  sceneHeight: number;
  sceneState: Record<string, unknown>;
  sceneWidth: number;
  scenes: GameScene[];
  selectedLayer?: SceneLayer;
  selectedLayerAsset?: GameAsset;
  selectedLayerClip?: AnimationClip;
  selectedLayerId: string;
  selectedLayerInteraction: LayerInteractionSettings | null;
  selectedLayerLight: LayerLightingSettings;
  selectedLayerShadow: LayerShadowSettings;
  onApplyInteractionPreset: (preset: InteractionPreset) => void;
  onApplyNeonLighting: () => void;
  onClearLighting: () => void;
  onDragLayerEnd: () => void;
  onDragLayerStart: (layerId: string) => void;
  onReorderLayer: (sourceLayerId: string, targetLayerId: string) => void;
  onSelectLayer: (layer: SceneLayer) => void;
  onSetAnimation: (clip: AnimationClip) => void;
  onUpdateInteraction: (patch: Partial<LayerInteractionSettings>) => void;
  onUpdateLayer: (layerId: string, patch: Partial<SceneLayer>) => void;
  onUpdateLighting: (patch: Partial<LayerLightingSettings>) => void;
  onUpdateShadow: (patch: Partial<LayerShadowSettings>) => void;
};

export function SceneLayerControlsPanel({
  draggedLayerId,
  getClipButtonText,
  getLayerWorldBounds,
  interactionPresets,
  isVisualLayer,
  layers,
  sceneHeight,
  sceneState,
  sceneWidth,
  scenes,
  selectedLayer,
  selectedLayerAsset,
  selectedLayerClip,
  selectedLayerId,
  selectedLayerInteraction,
  selectedLayerLight,
  selectedLayerShadow,
  onApplyInteractionPreset,
  onApplyNeonLighting,
  onClearLighting,
  onDragLayerEnd,
  onDragLayerStart,
  onReorderLayer,
  onSelectLayer,
  onSetAnimation,
  onUpdateInteraction,
  onUpdateLayer,
  onUpdateLighting,
  onUpdateShadow,
}: SceneLayerControlsPanelProps) {
  return (
    <section>
      <LayerStackList
        draggedLayerId={draggedLayerId}
        layers={layers}
        selectedLayerId={selectedLayerId}
        onDragLayerEnd={onDragLayerEnd}
        onDragLayerStart={onDragLayerStart}
        onReorderLayer={onReorderLayer}
        onSelectLayer={onSelectLayer}
      />

      {selectedLayer && (
        <div className="layer-controls">
          <LayerTransformControls selectedLayer={selectedLayer} onUpdateLayer={onUpdateLayer} />
          {selectedLayer.type === "background" && (
            <BackgroundLayerControls
              sceneHeight={sceneHeight}
              sceneWidth={sceneWidth}
              selectedLayer={selectedLayer}
              onUpdateLayer={onUpdateLayer}
            />
          )}
          {!selectedLayer.locked && <div className="control-hint">You can also drag the selected layer's corner handles on the canvas to resize proportionally.</div>}
          {isVisualLayer(selectedLayer) && !selectedLayer.locked && (
            <LayerInteractionControls
              interaction={selectedLayerInteraction || undefined}
              interactionPresets={interactionPresets}
              sceneState={sceneState}
              scenes={scenes}
              selectedLayer={selectedLayer}
              selectedLayerAsset={selectedLayerAsset}
              visualLayers={layers.filter(item => isVisualLayer(item))}
              getLayerWorldBounds={getLayerWorldBounds}
              onApplyPreset={onApplyInteractionPreset}
              onUpdateInteraction={onUpdateInteraction}
            />
          )}
          {isVisualLayer(selectedLayer) && !selectedLayer.locked && (
            <VisualLayerAnimationLightingControls
              asset={selectedLayerAsset}
              lighting={selectedLayerLight}
              selectedClip={selectedLayerClip}
              shadow={selectedLayerShadow}
              getClipButtonText={getClipButtonText}
              onApplyNeonLighting={onApplyNeonLighting}
              onClearLighting={onClearLighting}
              onSetAnimation={onSetAnimation}
              onUpdateLighting={onUpdateLighting}
              onUpdateShadow={onUpdateShadow}
            />
          )}
          {!selectedLayer.locked && <div className="control-hint">You can also drag the selected layer's blue corner handle on the canvas to resize proportionally.</div>}
          <LayerVisibilityControls selectedLayer={selectedLayer} onUpdateLayer={onUpdateLayer} />
        </div>
      )}
    </section>
  );
}
