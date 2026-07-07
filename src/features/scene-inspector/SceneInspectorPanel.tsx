import type {
  ActionBinding,
  ActionTriggerType,
  AnimationClip,
  AnimationSprite,
  AssetRole,
  GameAsset,
  LayerInteractionSettings,
  LayerLightingSettings,
  LayerShadowSettings,
  ScenePlaybackMode,
  SceneTimelineSettings,
  SceneLayer,
} from "../../types";
import { SceneInspectorAvatarSection } from "./SceneInspectorAvatarSection";
import { SceneInspectorBackgroundSection } from "./SceneInspectorBackgroundSection";
import { SceneInspectorHeader } from "./SceneInspectorHeader";
import { SceneInspectorInteractionZoneSection } from "./SceneInspectorInteractionZoneSection";
import { SceneInspectorItemSection } from "./SceneInspectorItemSection";
import { SceneInspectorLightingSection } from "./SceneInspectorLightingSection";
import { SceneInspectorSpritesheetSection } from "./SceneInspectorSpritesheetSection";
import { SceneInspectorTimelineSection } from "./SceneInspectorTimelineSection";
import { SceneInspectorTransformSection } from "./SceneInspectorTransformSection";

type LayerBounds = {
  width: number;
  height: number;
};

type SpritesheetGridPatch = {
  frameWidth?: number;
  frameHeight?: number;
  frameCount?: number;
  columns?: number;
};

type SceneInspectorPanelProps = {
  getClipButtonText: (clip: AnimationClip) => string;
  getLayerWorldBounds: (layer: SceneLayer, asset?: GameAsset) => LayerBounds;
  isPlaying: boolean;
  layerCount: number;
  playbackMode: ScenePlaybackMode;
  roleLabels: Record<AssetRole, string>;
  sceneName: string;
  sceneTimeline: SceneTimelineSettings;
  selectedAssetEditable: boolean;
  selectedInteractionZoneAsset?: GameAsset;
  selectedInteractionZoneLayer?: SceneLayer;
  selectedInteractionZoneLayerId: string | null;
  selectedInteractionZoneSettings: LayerInteractionSettings | null;
  selectedLayer?: SceneLayer;
  selectedLayerAsset?: GameAsset;
  selectedLayerClip?: AnimationClip;
  selectedLayerClipFps: number;
  selectedLayerFrameSize: number[];
  selectedLayerIsAvatar: boolean;
  selectedLayerIsVisual: boolean;
  selectedLayerLight: LayerLightingSettings;
  selectedLayerShadow: LayerShadowSettings;
  selectedLayerSprite?: AnimationSprite;
  selectedLayerSpriteColumns: number;
  selectedLayerSpriteEditableGrid: boolean;
  selectedLayerSpriteFrameCount: number;
  selectedLayerSpriteFrameIndex: number;
  selectedLayerSpriteRows: number;
  selectedLayerSpriteSheetSize: number[];
  selectedLayerSpriteSource: string;
  triggerLabels: Record<ActionTriggerType, string>;
  visualLayers: SceneLayer[];
  walkSpeed: number;
  onApplyNeonLighting: () => void;
  onClearLighting: () => void;
  onDownloadSelectedItem: () => void;
  onDownloadSpritePng: () => void;
  onPlayingChange: (isPlaying: boolean) => void;
  onPlaybackModeChange: (mode: ScenePlaybackMode) => void;
  onRebuildSpriteGrid: (patch: SpritesheetGridPatch) => void;
  onRestartSpritePreview: () => void;
  onSaveAssetMetadata: (assetId: string) => void;
  onSelectSpriteFrame: (frameIndex: number) => void;
  onSetLayerAnimation: (layerId: string, clip: AnimationClip) => void;
  onSpriteMetadataChange: (patch: Partial<AnimationSprite>) => void;
  onToggleSpritePreview: () => void;
  onToggleSelectedLayerLock: () => void;
  onUpdateAssetClipMetadata: (
    assetId: string,
    clipId: string,
    patch: Partial<AnimationClip>,
    bindingPatch?: Partial<ActionBinding>
  ) => void;
  onUpdateAssetMetadata: (assetId: string, patch: Partial<GameAsset>) => void;
  onUpdateInteraction: (layerId: string, patch: Partial<LayerInteractionSettings>) => void;
  onUpdateLayer: (layerId: string, patch: Partial<SceneLayer>) => void;
  onUpdateLighting: (patch: Partial<LayerLightingSettings>) => void;
  onUpdatePreviewFps: (fps: number) => void;
  onUpdateShadow: (patch: Partial<LayerShadowSettings>) => void;
  onUpdateTimeline: (patch: Partial<SceneTimelineSettings>) => void;
  onWalkSpeedChange: (walkSpeed: number) => void;
};

export function SceneInspectorPanel({
  getClipButtonText,
  getLayerWorldBounds,
  isPlaying,
  layerCount,
  playbackMode,
  roleLabels,
  sceneName,
  sceneTimeline,
  selectedAssetEditable,
  selectedInteractionZoneAsset,
  selectedInteractionZoneLayer,
  selectedInteractionZoneLayerId,
  selectedInteractionZoneSettings,
  selectedLayer,
  selectedLayerAsset,
  selectedLayerClip,
  selectedLayerClipFps,
  selectedLayerFrameSize,
  selectedLayerIsAvatar,
  selectedLayerIsVisual,
  selectedLayerLight,
  selectedLayerShadow,
  selectedLayerSprite,
  selectedLayerSpriteColumns,
  selectedLayerSpriteEditableGrid,
  selectedLayerSpriteFrameCount,
  selectedLayerSpriteFrameIndex,
  selectedLayerSpriteRows,
  selectedLayerSpriteSheetSize,
  selectedLayerSpriteSource,
  triggerLabels,
  visualLayers,
  walkSpeed,
  onApplyNeonLighting,
  onClearLighting,
  onDownloadSelectedItem,
  onDownloadSpritePng,
  onPlayingChange,
  onPlaybackModeChange,
  onRebuildSpriteGrid,
  onRestartSpritePreview,
  onSaveAssetMetadata,
  onSelectSpriteFrame,
  onSetLayerAnimation,
  onSpriteMetadataChange,
  onToggleSpritePreview,
  onToggleSelectedLayerLock,
  onUpdateAssetClipMetadata,
  onUpdateAssetMetadata,
  onUpdateInteraction,
  onUpdateLayer,
  onUpdateLighting,
  onUpdatePreviewFps,
  onUpdateShadow,
  onUpdateTimeline,
  onWalkSpeedChange,
}: SceneInspectorPanelProps) {
  return (
    <aside className="scene-mini-panel inspector-rail">
      <div className="compact-inspector">
        <SceneInspectorHeader
          layerCount={layerCount}
          roleLabels={roleLabels}
          sceneName={sceneName}
          selectedInteractionZoneLayer={selectedInteractionZoneLayer}
          selectedLayer={selectedLayer}
          selectedLayerAsset={selectedLayerAsset}
          selectedLayerIsAvatar={selectedLayerIsAvatar}
          onDownloadSelectedItem={onDownloadSelectedItem}
          onToggleSelectedLayerLock={onToggleSelectedLayerLock}
        />
        <SceneInspectorTimelineSection
          playbackMode={playbackMode}
          timeline={sceneTimeline}
          visualLayers={visualLayers}
          onPlaybackModeChange={onPlaybackModeChange}
          onTimelineChange={onUpdateTimeline}
        />
        {selectedLayer && (
          <>
            <SceneInspectorTransformSection
              selectedInteractionZoneLayerId={selectedInteractionZoneLayerId}
              selectedLayer={selectedLayer}
              onUpdateLayer={onUpdateLayer}
            />

            {selectedLayer.type === "background" && (
              <SceneInspectorBackgroundSection
                selectedLayer={selectedLayer}
                onUpdateLayer={onUpdateLayer}
              />
            )}

            {selectedInteractionZoneLayer && selectedInteractionZoneSettings && (
              <SceneInspectorInteractionZoneSection
                getLayerWorldBounds={getLayerWorldBounds}
                selectedInteractionZoneAsset={selectedInteractionZoneAsset}
                selectedInteractionZoneLayer={selectedInteractionZoneLayer}
                selectedInteractionZoneSettings={selectedInteractionZoneSettings}
                onUpdateInteraction={onUpdateInteraction}
              />
            )}

            {selectedLayerIsVisual && selectedLayerIsAvatar && (
              <SceneInspectorAvatarSection
                isPlaying={isPlaying}
                selectedLayer={selectedLayer}
                walkSpeed={walkSpeed}
                onPlayingChange={onPlayingChange}
                onWalkSpeedChange={onWalkSpeedChange}
              />
            )}

            {selectedLayerIsVisual && !selectedLayerIsAvatar && (
              <SceneInspectorItemSection
                selectedLayer={selectedLayer}
                onUpdateLayer={onUpdateLayer}
              />
            )}

            {selectedLayerIsVisual && selectedLayerSprite && (
              <SceneInspectorSpritesheetSection
                getClipButtonText={getClipButtonText}
                isPlaying={isPlaying}
                roleLabels={roleLabels}
                selectedAssetEditable={selectedAssetEditable}
                selectedLayer={selectedLayer}
                selectedLayerAsset={selectedLayerAsset}
                selectedLayerClip={selectedLayerClip}
                selectedLayerClipFps={selectedLayerClipFps}
                selectedLayerFrameSize={selectedLayerFrameSize}
                selectedLayerSprite={selectedLayerSprite}
                selectedLayerSpriteColumns={selectedLayerSpriteColumns}
                selectedLayerSpriteEditableGrid={selectedLayerSpriteEditableGrid}
                selectedLayerSpriteFrameCount={selectedLayerSpriteFrameCount}
                selectedLayerSpriteFrameIndex={selectedLayerSpriteFrameIndex}
                selectedLayerSpriteRows={selectedLayerSpriteRows}
                selectedLayerSpriteSheetSize={selectedLayerSpriteSheetSize}
                selectedLayerSpriteSource={selectedLayerSpriteSource}
                triggerLabels={triggerLabels}
                onDownloadPng={onDownloadSpritePng}
                onRebuildSpriteGrid={onRebuildSpriteGrid}
                onRestartPreview={onRestartSpritePreview}
                onSaveAssetMetadata={onSaveAssetMetadata}
                onSelectFrame={onSelectSpriteFrame}
                onSetLayerAnimation={onSetLayerAnimation}
                onSpriteMetadataChange={onSpriteMetadataChange}
                onTogglePreview={onToggleSpritePreview}
                onUpdateAssetClipMetadata={onUpdateAssetClipMetadata}
                onUpdateAssetMetadata={onUpdateAssetMetadata}
                onUpdatePreviewFps={onUpdatePreviewFps}
              />
            )}

            {selectedLayerIsVisual && !selectedLayer.locked && (
              <SceneInspectorLightingSection
                lighting={selectedLayerLight}
                shadow={selectedLayerShadow}
                onApplyNeonLighting={onApplyNeonLighting}
                onClearLighting={onClearLighting}
                onUpdateLighting={onUpdateLighting}
                onUpdateShadow={onUpdateShadow}
              />
            )}
          </>
        )}
      </div>
    </aside>
  );
}
