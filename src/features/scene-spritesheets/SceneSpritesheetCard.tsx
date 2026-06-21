import type { CSSProperties } from "react";
import { Download, Eye, EyeOff, Map as MapIcon, Play, Save } from "lucide-react";
import { spriteFrame } from "../../domain/sprites/spriteUtils";
import type {
  ActionBinding,
  ActionTriggerType,
  AnimationClip,
  AssetRole,
  GameAsset,
  SceneLayer,
} from "../../types";
import type { SceneSpritesheetEntry } from "./types";

type SceneSpritesheetCardProps = {
  activeFrame: number;
  checkerStyle: CSSProperties;
  editableAsset: boolean;
  entry: SceneSpritesheetEntry;
  isExpanded: boolean;
  roleLabels: Record<AssetRole, string>;
  triggerLabels: Record<ActionTriggerType, string>;
  onDownloadPng: (entry: SceneSpritesheetEntry) => void;
  onPreview: (entry: SceneSpritesheetEntry, openScene?: boolean) => void;
  onSaveAssetMetadata: (assetId: string) => void;
  onSetLayerAnimation: (layerId: string, clip: AnimationClip) => void;
  onTagsChange: (assetId: string, tagsText: string) => void;
  onToggleExpanded: (entryKey: string) => void;
  onUpdateAssetClipMetadata: (
    assetId: string,
    clipId: string,
    patch: Partial<AnimationClip>,
    bindingPatch?: Partial<ActionBinding>
  ) => void;
  onUpdateAssetMetadata: (assetId: string, patch: Partial<GameAsset>) => void;
  onUpdateSceneLayer: (layerId: string, patch: Partial<SceneLayer>) => void;
};

export function SceneSpritesheetCard({
  activeFrame,
  checkerStyle,
  editableAsset,
  entry,
  isExpanded,
  roleLabels,
  triggerLabels,
  onDownloadPng,
  onPreview,
  onSaveAssetMetadata,
  onSetLayerAnimation,
  onTagsChange,
  onToggleExpanded,
  onUpdateAssetClipMetadata,
  onUpdateAssetMetadata,
  onUpdateSceneLayer,
}: SceneSpritesheetCardProps) {
  const clipBinding = entry.clip?.binding || entry.asset.binding;
  const frameCount = entry.sprite.frames.length || 1;
  const assetClips = entry.asset.animations || [];

  return (
    <article className={isExpanded ? "spritesheet-inspector-card expanded" : "spritesheet-inspector-card"}>
      <button
        type="button"
        className="spritesheet-inspector-preview"
        style={checkerStyle}
        onClick={() => onPreview(entry)}
      >
        <div
          style={{ aspectRatio: `${entry.frameWidth} / ${entry.frameHeight}` }}
          dangerouslySetInnerHTML={{ __html: spriteFrame(entry.sprite, activeFrame) }}
        />
      </button>
      <div className="spritesheet-inspector-main">
        <div className="spritesheet-inspector-title">
          <div>
            <strong>{entry.clip?.name || entry.asset.name}</strong>
            <span>{entry.layer.name} / {roleLabels[entry.asset.role]} / {frameCount} frames / {entry.frameWidth} x {entry.frameHeight}</span>
          </div>
          <button
            type="button"
            className={isExpanded ? "active" : ""}
            onClick={() => onToggleExpanded(entry.key)}
          >
            Edit
          </button>
        </div>
        <div className="spritesheet-inspector-actions">
          <button type="button" onClick={() => onPreview(entry)}><Play size={13} /> Preview</button>
          <button type="button" onClick={() => onPreview(entry, true)}><MapIcon size={13} /> Locate Layer</button>
          <button type="button" onClick={() => onDownloadPng(entry)} disabled={!entry.sprite.spritesheetPng && !entry.sprite.rawSpritesheetPng}><Download size={13} /> PNG</button>
        </div>

        {isExpanded && (
          <div className="spritesheet-inspector-editor">
            {!editableAsset && (
              <div className="control-hint">This is a built-in scene kit asset. You can edit layer placement in the Scene tab, but persistent metadata editing is available for confirmed assets.</div>
            )}
            <div className="two-col">
              <div>
                <label>Asset Name</label>
                <input
                  value={entry.asset.name}
                  disabled={!editableAsset}
                  onChange={event => onUpdateAssetMetadata(entry.asset.id, { name: event.target.value })}
                />
              </div>
              <div>
                <label>Asset Role</label>
                <select
                  value={entry.asset.role}
                  disabled={!editableAsset}
                  onChange={event => onUpdateAssetMetadata(entry.asset.id, { role: event.target.value as AssetRole })}
                >
                  {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>

            <div className="two-col">
              <div>
                <label>Layer Clip</label>
                <select
                  value={entry.layer.activeAnimationId || entry.asset.defaultAnimationId || entry.clip?.id || ""}
                  onChange={event => {
                    const nextClip = entry.asset.animations?.find(clip => clip.id === event.target.value);
                    if (nextClip) onSetLayerAnimation(entry.layer.id, nextClip);
                  }}
                >
                  {assetClips.length
                    ? assetClips.map(clip => <option key={clip.id} value={clip.id}>{clip.name}</option>)
                    : <option value="">Single Sprite</option>}
                </select>
              </div>
              <div>
                <label>Default Clip</label>
                <select
                  value={entry.asset.defaultAnimationId || entry.clip?.id || ""}
                  disabled={!editableAsset || !entry.asset.animations?.length}
                  onChange={event => onUpdateAssetMetadata(entry.asset.id, { defaultAnimationId: event.target.value })}
                >
                  {assetClips.length
                    ? assetClips.map(clip => <option key={clip.id} value={clip.id}>{clip.name}</option>)
                    : <option value="">Single Sprite</option>}
                </select>
              </div>
            </div>

            <div className="two-col">
              <div>
                <label>Clip Name</label>
                <input
                  value={entry.clip?.name || entry.asset.binding.actionName}
                  disabled={!editableAsset}
                  onChange={event => entry.clip
                    ? onUpdateAssetClipMetadata(entry.asset.id, entry.clip.id, { name: event.target.value })
                    : onUpdateAssetMetadata(entry.asset.id, { binding: { ...entry.asset.binding, actionName: event.target.value } })
                  }
                />
              </div>
              <div>
                <label>Action Name</label>
                <input
                  value={entry.clip?.actionName || entry.asset.binding.actionName}
                  disabled={!editableAsset}
                  onChange={event => entry.clip
                    ? onUpdateAssetClipMetadata(entry.asset.id, entry.clip.id, { actionName: event.target.value }, { actionName: event.target.value })
                    : onUpdateAssetMetadata(entry.asset.id, { binding: { ...entry.asset.binding, actionName: event.target.value } })
                  }
                />
              </div>
            </div>

            <div className="two-col">
              <div>
                <label>Trigger Type</label>
                <select
                  value={clipBinding.triggerType}
                  disabled={!editableAsset}
                  onChange={event => entry.clip
                    ? onUpdateAssetClipMetadata(entry.asset.id, entry.clip.id, {}, { triggerType: event.target.value as ActionTriggerType })
                    : onUpdateAssetMetadata(entry.asset.id, { binding: { ...entry.asset.binding, triggerType: event.target.value as ActionTriggerType } })
                  }
                >
                  {Object.entries(triggerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div>
                <label>Trigger Value</label>
                <input
                  value={clipBinding.triggerValue}
                  disabled={!editableAsset}
                  onChange={event => entry.clip
                    ? onUpdateAssetClipMetadata(entry.asset.id, entry.clip.id, {}, { triggerValue: event.target.value })
                    : onUpdateAssetMetadata(entry.asset.id, { binding: { ...entry.asset.binding, triggerValue: event.target.value } })
                  }
                />
              </div>
            </div>

            <label>Game State</label>
            <input
              value={clipBinding.gameState}
              disabled={!editableAsset}
              onChange={event => entry.clip
                ? onUpdateAssetClipMetadata(entry.asset.id, entry.clip.id, {}, { gameState: event.target.value })
                : onUpdateAssetMetadata(entry.asset.id, { binding: { ...entry.asset.binding, gameState: event.target.value } })
              }
            />

            <div className="two-col">
              <div>
                <label>Direction</label>
                <select
                  value={entry.clip?.direction || "none"}
                  disabled={!editableAsset || !entry.clip}
                  onChange={event => entry.clip && onUpdateAssetClipMetadata(entry.asset.id, entry.clip.id, { direction: event.target.value as AnimationClip["direction"] })}
                >
                  <option value="none">None</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div>
                <label>Loop</label>
                <select
                  value={entry.clip?.loop ? "true" : "false"}
                  disabled={!editableAsset || !entry.clip}
                  onChange={event => entry.clip && onUpdateAssetClipMetadata(entry.asset.id, entry.clip.id, { loop: event.target.value === "true" })}
                >
                  <option value="true">Loop</option>
                  <option value="false">Play Once</option>
                </select>
              </div>
            </div>

            <label>Tags</label>
            <input
              value={entry.asset.tags.join(", ")}
              disabled={!editableAsset}
              onChange={event => onTagsChange(entry.asset.id, event.target.value)}
            />

            <div className="spritesheet-inspector-save-row">
              <button type="button" className="ghost-button" onClick={() => onSaveAssetMetadata(entry.asset.id)} disabled={!editableAsset}><Save size={14} /> Save Asset Metadata</button>
              <button type="button" className="ghost-button" onClick={() => onUpdateSceneLayer(entry.layer.id, { visible: !entry.layer.visible })}>{entry.layer.visible ? <EyeOff size={14} /> : <Eye size={14} />} {entry.layer.visible ? "Hide Layer" : "Show Layer"}</button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
