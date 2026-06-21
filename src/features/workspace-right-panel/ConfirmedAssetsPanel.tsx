import type { CSSProperties } from "react";
import { CheckCircle2, Play, Plus, Trash2 } from "lucide-react";
import { spriteFrame } from "../../domain/sprites/spriteUtils";
import type { ActionTriggerType, AnimationSprite, AssetRole, GameAsset } from "../../types";

type ConfirmedAssetsPanelProps = {
  activeFrame: number;
  assets: GameAsset[];
  checkerStyle: CSSProperties;
  roleLabels: Record<AssetRole, string>;
  triggerLabels: Record<ActionTriggerType, string>;
  getAssetPreviewSprite: (asset: GameAsset) => AnimationSprite;
  onDeleteAsset: (assetId: string) => void;
  onInsertAsset: (asset: GameAsset) => void;
  onPreviewSprite: (sprite: AnimationSprite) => void;
};

export function ConfirmedAssetsPanel({
  activeFrame,
  assets,
  checkerStyle,
  roleLabels,
  triggerLabels,
  getAssetPreviewSprite,
  onDeleteAsset,
  onInsertAsset,
  onPreviewSprite,
}: ConfirmedAssetsPanelProps) {
  return (
    <section>
      <div className="section-title"><CheckCircle2 size={17} /> Confirmed Assets</div>
      <div className="sprite-list">
        {assets.map(asset => {
          const previewSprite = getAssetPreviewSprite(asset);
          return (
            <div key={asset.id} className="sprite-card asset-card">
              <button type="button" className="mini-preview" style={checkerStyle} onClick={() => onPreviewSprite(previewSprite)}>
                <div dangerouslySetInnerHTML={{ __html: spriteFrame(previewSprite, activeFrame) }} />
              </button>
              <div>
                <strong>{asset.name}</strong>
                <span>{roleLabels[asset.role]} / {asset.animations?.length || 1} clips / {triggerLabels[asset.binding.triggerType]} {asset.binding.triggerValue}</span>
                <div className="asset-actions">
                  <button type="button" onClick={() => onInsertAsset(asset)}><Plus size={13} /> Insert</button>
                  <button type="button" onClick={() => onPreviewSprite(previewSprite)}><Play size={13} /> Preview</button>
                  <button type="button" onClick={() => onDeleteAsset(asset.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          );
        })}
        {!assets.length && <div className="empty-state">No confirmed assets yet.</div>}
      </div>
    </section>
  );
}
