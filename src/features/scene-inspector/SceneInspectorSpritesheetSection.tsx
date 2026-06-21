import { Download, Pause, Play, Save } from "lucide-react";
import { spritesheetFrameThumbStyle } from "../../domain/sprites/spriteUtils";
import type {
  ActionBinding,
  ActionTriggerType,
  AnimationClip,
  AnimationSprite,
  AssetRole,
  GameAsset,
  SceneLayer,
} from "../../types";

type SpritesheetGridPatch = {
  frameWidth?: number;
  frameHeight?: number;
  frameCount?: number;
  columns?: number;
};

type SceneInspectorSpritesheetSectionProps = {
  isPlaying: boolean;
  roleLabels: Record<AssetRole, string>;
  selectedAssetEditable: boolean;
  selectedLayer: SceneLayer;
  selectedLayerAsset?: GameAsset;
  selectedLayerClip?: AnimationClip;
  selectedLayerClipFps: number;
  selectedLayerFrameSize: number[];
  selectedLayerSprite: AnimationSprite;
  selectedLayerSpriteColumns: number;
  selectedLayerSpriteEditableGrid: boolean;
  selectedLayerSpriteFrameCount: number;
  selectedLayerSpriteFrameIndex: number;
  selectedLayerSpriteRows: number;
  selectedLayerSpriteSheetSize: number[];
  selectedLayerSpriteSource: string;
  triggerLabels: Record<ActionTriggerType, string>;
  getClipButtonText: (clip: AnimationClip) => string;
  onDownloadPng: () => void;
  onRebuildSpriteGrid: (patch: SpritesheetGridPatch) => void;
  onRestartPreview: () => void;
  onSaveAssetMetadata: (assetId: string) => void;
  onSelectFrame: (frameIndex: number) => void;
  onSetLayerAnimation: (layerId: string, clip: AnimationClip) => void;
  onSpriteMetadataChange: (patch: Partial<AnimationSprite>) => void;
  onTogglePreview: () => void;
  onUpdateAssetClipMetadata: (
    assetId: string,
    clipId: string,
    patch: Partial<AnimationClip>,
    bindingPatch?: Partial<ActionBinding>
  ) => void;
  onUpdateAssetMetadata: (assetId: string, patch: Partial<GameAsset>) => void;
  onUpdatePreviewFps: (fps: number) => void;
};

export function SceneInspectorSpritesheetSection({
  isPlaying,
  roleLabels,
  selectedAssetEditable,
  selectedLayer,
  selectedLayerAsset,
  selectedLayerClip,
  selectedLayerClipFps,
  selectedLayerFrameSize,
  selectedLayerSprite,
  selectedLayerSpriteColumns,
  selectedLayerSpriteEditableGrid,
  selectedLayerSpriteFrameCount,
  selectedLayerSpriteFrameIndex,
  selectedLayerSpriteRows,
  selectedLayerSpriteSheetSize,
  selectedLayerSpriteSource,
  triggerLabels,
  getClipButtonText,
  onDownloadPng,
  onRebuildSpriteGrid,
  onRestartPreview,
  onSaveAssetMetadata,
  onSelectFrame,
  onSetLayerAnimation,
  onSpriteMetadataChange,
  onTogglePreview,
  onUpdateAssetClipMetadata,
  onUpdateAssetMetadata,
  onUpdatePreviewFps,
}: SceneInspectorSpritesheetSectionProps) {
  return (
    <div className="compact-inspector-section spritesheet-inspector-section">
      <div className="spritesheet-section-heading">
        <em>Spritesheet</em>
        <button
          type="button"
          onClick={() => selectedLayerAsset && onSaveAssetMetadata(selectedLayerAsset.id)}
          disabled={!selectedLayerAsset || !selectedAssetEditable}
        >
          <Save size={13} /> Save
        </button>
      </div>

      <div className="spritesheet-param-grid">
        <span>Frames <strong>{selectedLayerSpriteFrameCount}</strong></span>
        <span>Frame <strong>{selectedLayerFrameSize[0]} x {selectedLayerFrameSize[1]}</strong></span>
        <span>Sheet <strong>{selectedLayerSpriteSheetSize.join(" x ") || "SVG"}</strong></span>
        <span>Grid <strong>{selectedLayerSpriteColumns} x {selectedLayerSpriteRows}</strong></span>
      </div>

      <div className="spritesheet-preview-controls">
        <button type="button" onClick={onTogglePreview}>
          {isPlaying ? <Pause size={13} /> : <Play size={13} />} {isPlaying ? "Pause" : "Play"}
        </button>
        <button type="button" onClick={onRestartPreview}>
          Restart
        </button>
        <button
          type="button"
          disabled={!selectedLayerSpriteSource}
          onClick={onDownloadPng}
        >
          <Download size={13} /> PNG
        </button>
      </div>

      <label>Preview FPS {selectedLayerClipFps}</label>
      <input
        type="range"
        min="1"
        max="60"
        step="1"
        value={selectedLayerClipFps}
        onChange={event => onUpdatePreviewFps(Number(event.target.value))}
      />

      {selectedLayerSprite.frames.length ? (
        <>
          <label>Current Frame {selectedLayerSpriteFrameIndex + 1} / {selectedLayerSpriteFrameCount}</label>
          <input
            type="range"
            min="0"
            max={Math.max(0, selectedLayerSprite.frames.length - 1)}
            step="1"
            value={selectedLayerSpriteFrameIndex}
            onChange={event => onSelectFrame(Number(event.target.value))}
          />
          <div className="spritesheet-frame-strip">
            {selectedLayerSprite.frames.slice(0, 24).map((frame, frameIndex) => {
              const frameThumbStyle = spritesheetFrameThumbStyle(selectedLayerSprite, frameIndex);
              return (
                <button
                  key={`${selectedLayerSprite.id}_${frameIndex}`}
                  type="button"
                  className={frameIndex === selectedLayerSpriteFrameIndex ? "active" : ""}
                  style={{ aspectRatio: `${selectedLayerFrameSize[0]} / ${selectedLayerFrameSize[1]}` }}
                  onClick={() => onSelectFrame(frameIndex)}
                  title={`Frame ${frameIndex + 1}`}
                >
                  {frameThumbStyle ? (
                    <span className="spritesheet-frame-thumb" style={frameThumbStyle} />
                  ) : (
                    <span dangerouslySetInnerHTML={{ __html: frame }} />
                  )}
                </button>
              );
            })}
            {selectedLayerSprite.frames.length > 24 && <i>+{selectedLayerSprite.frames.length - 24}</i>}
          </div>
        </>
      ) : null}

      {selectedLayerAsset && (
        <>
          <div className="compact-dual-fields">
            <label>
              Asset Name
              <input
                value={selectedLayerAsset.name}
                disabled={!selectedAssetEditable}
                onChange={event => onUpdateAssetMetadata(selectedLayerAsset.id, { name: event.target.value })}
              />
            </label>
            <label>
              Role
              <select
                value={selectedLayerAsset.role}
                disabled={!selectedAssetEditable}
                onChange={event => onUpdateAssetMetadata(selectedLayerAsset.id, { role: event.target.value as AssetRole })}
              >
                {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <label>Sprite Name</label>
          <input
            value={selectedLayerSprite.characterName}
            disabled={!selectedAssetEditable}
            onChange={event => onSpriteMetadataChange({ characterName: event.target.value })}
          />
        </>
      )}

      {selectedLayerAsset?.animations?.length ? (
        <>
          <label>Clip</label>
          <div className="spritesheet-clip-buttons">
            {selectedLayerAsset.animations.map(clip => (
              <button
                key={clip.id}
                type="button"
                className={clip.id === selectedLayerClip?.id ? "active" : ""}
                onClick={() => onSetLayerAnimation(selectedLayer.id, clip)}
              >
                {getClipButtonText(clip)}
              </button>
            ))}
          </div>
          <select
            value={selectedLayer.activeAnimationId || selectedLayerAsset.defaultAnimationId || selectedLayerClip?.id || ""}
            onChange={event => {
              const clip = selectedLayerAsset.animations?.find(item => item.id === event.target.value);
              if (clip) onSetLayerAnimation(selectedLayer.id, clip);
            }}
          >
            {selectedLayerAsset.animations.map(clip => (
              <option key={clip.id} value={clip.id}>{getClipButtonText(clip)}</option>
            ))}
          </select>
          {selectedLayerClip && (
            <>
              <label>Clip Name</label>
              <input
                value={selectedLayerClip.name}
                disabled={!selectedAssetEditable}
                onChange={event => onUpdateAssetClipMetadata(selectedLayerAsset.id, selectedLayerClip.id, { name: event.target.value })}
              />
              <div className="compact-dual-fields">
                <label>
                  Action
                  <input
                    value={selectedLayerClip.actionName}
                    disabled={!selectedAssetEditable}
                    onChange={event => onUpdateAssetClipMetadata(selectedLayerAsset.id, selectedLayerClip.id, { actionName: event.target.value }, { actionName: event.target.value })}
                  />
                </label>
                <label>
                  Direction
                  <select
                    value={selectedLayerClip.direction}
                    disabled={!selectedAssetEditable}
                    onChange={event => onUpdateAssetClipMetadata(selectedLayerAsset.id, selectedLayerClip.id, { direction: event.target.value as AnimationClip["direction"] })}
                  >
                    <option value="none">None</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </label>
              </div>
              <div className="compact-dual-fields">
                <label>
                  Trigger
                  <select
                    value={selectedLayerClip.binding?.triggerType || selectedLayerAsset.binding.triggerType}
                    disabled={!selectedAssetEditable}
                    onChange={event => onUpdateAssetClipMetadata(selectedLayerAsset.id, selectedLayerClip.id, {}, { triggerType: event.target.value as ActionTriggerType })}
                  >
                    {Object.entries(triggerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label>
                  Value
                  <input
                    value={selectedLayerClip.binding?.triggerValue || selectedLayerAsset.binding.triggerValue}
                    disabled={!selectedAssetEditable}
                    onChange={event => onUpdateAssetClipMetadata(selectedLayerAsset.id, selectedLayerClip.id, {}, { triggerValue: event.target.value })}
                  />
                </label>
              </div>
              <label>Game State</label>
              <input
                value={selectedLayerClip.binding?.gameState || selectedLayerAsset.binding.gameState}
                disabled={!selectedAssetEditable}
                onChange={event => onUpdateAssetClipMetadata(selectedLayerAsset.id, selectedLayerClip.id, {}, { gameState: event.target.value })}
              />
              <label className="compact-toggle">
                <input
                  type="checkbox"
                  checked={selectedLayerClip.loop}
                  disabled={!selectedAssetEditable}
                  onChange={event => onUpdateAssetClipMetadata(selectedLayerAsset.id, selectedLayerClip.id, { loop: event.target.checked })}
                />
                Loop clip
              </label>
              <button
                type="button"
                className="inspector-secondary-action"
                disabled={!selectedAssetEditable}
                onClick={() => onUpdateAssetMetadata(selectedLayerAsset.id, { defaultAnimationId: selectedLayerClip.id })}
              >
                Set As Default Clip
              </button>
            </>
          )}
        </>
      ) : (
        <span>Static sprite object: one frame, no animation clip.</span>
      )}

      <div className="spritesheet-grid-editor">
        <em>Frame Grid</em>
        <div className="compact-dual-fields">
          <label>
            Frame W
            <input
              type="number"
              min="1"
              value={selectedLayerFrameSize[0]}
              disabled={!selectedLayerSpriteEditableGrid}
              onChange={event => onRebuildSpriteGrid({ frameWidth: Number(event.target.value) })}
            />
          </label>
          <label>
            Frame H
            <input
              type="number"
              min="1"
              value={selectedLayerFrameSize[1]}
              disabled={!selectedLayerSpriteEditableGrid}
              onChange={event => onRebuildSpriteGrid({ frameHeight: Number(event.target.value) })}
            />
          </label>
        </div>
        <div className="compact-dual-fields">
          <label>
            Frames
            <input
              type="number"
              min="1"
              value={selectedLayerSpriteFrameCount}
              disabled={!selectedLayerSpriteEditableGrid}
              onChange={event => onRebuildSpriteGrid({ frameCount: Number(event.target.value) })}
            />
          </label>
          <label>
            Columns
            <input
              type="number"
              min="1"
              value={selectedLayerSpriteColumns}
              disabled={!selectedLayerSpriteEditableGrid}
              onChange={event => onRebuildSpriteGrid({ columns: Number(event.target.value) })}
            />
          </label>
        </div>
        <span>
          {selectedLayerSpriteEditableGrid
            ? `Source ${selectedLayerSpriteSheetSize[0]} x ${selectedLayerSpriteSheetSize[1]} / ${selectedLayerSpriteRows} rows`
            : selectedAssetEditable ? "Static images and SVG assets do not need grid slicing." : "Read-only asset. Import a copy to edit grid slicing."}
        </span>
      </div>

      {!selectedAssetEditable && (
        <span>Built-in spritesheet metadata is read-only. Imported assets can edit these values.</span>
      )}
    </div>
  );
}
