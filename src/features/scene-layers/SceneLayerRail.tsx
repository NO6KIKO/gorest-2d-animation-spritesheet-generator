import type { ChangeEvent, MouseEvent } from "react";
import { Eye, EyeOff, Lock, Plus, Unlock, Upload, X } from "lucide-react";
import { spriteFrame } from "../../domain/sprites/spriteUtils";
import type { AnimationSprite, GameAsset, SceneLayer } from "../../types";

type SceneLayerRailProps = {
  draggedLayerId: string | null;
  isLayerLibraryOpen: boolean;
  layerDropTargetId: string | null;
  layerLibraryAssets: GameAsset[];
  layers: SceneLayer[];
  selectedLayerId: string;
  onBeginLayerDrag: (layer: SceneLayer) => void;
  onCancelLayerDrag: () => void;
  onCloseLayerLibrary: () => void;
  onFinishLayerReorder: (clientX: number, clientY: number) => void;
  onInsertAsset: (asset: GameAsset) => void;
  onOpenLayerContextMenu: (event: MouseEvent<HTMLButtonElement>, layer: SceneLayer) => void;
  onSelectLayer: (layer: SceneLayer) => void;
  onToggleLayerLibrary: () => void;
  onUpdateLayer: (layerId: string, patch: Partial<SceneLayer>) => void;
  onUploadImage: (event: ChangeEvent<HTMLInputElement>) => void;
  resolveAssetSprite: (asset?: GameAsset, layer?: SceneLayer) => AnimationSprite | undefined;
};

export function SceneLayerRail({
  draggedLayerId,
  isLayerLibraryOpen,
  layerDropTargetId,
  layerLibraryAssets,
  layers,
  selectedLayerId,
  onBeginLayerDrag,
  onCancelLayerDrag,
  onCloseLayerLibrary,
  onFinishLayerReorder,
  onInsertAsset,
  onOpenLayerContextMenu,
  onSelectLayer,
  onToggleLayerLibrary,
  onUpdateLayer,
  onUploadImage,
  resolveAssetSprite,
}: SceneLayerRailProps) {
  return (
    <aside className="scene-mini-panel layer-rail">
      <div className="mini-panel-title layer-panel-title">
        <b>Layer</b>
        <div className="layer-panel-title-actions">
          <button
            type="button"
            className={isLayerLibraryOpen ? "mini-add-layer-button active" : "mini-add-layer-button"}
            title="Add layer"
            aria-label="Add layer"
            onClick={onToggleLayerLibrary}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      {isLayerLibraryOpen && (
        <div className="layer-add-popover" role="dialog" aria-label="Add asset">
          <div className="layer-add-popover-header">
            <strong>Add Asset</strong>
            <button
              type="button"
              className="icon-button"
              aria-label="Close add asset"
              onClick={onCloseLayerLibrary}
            >
              <X size={14} />
            </button>
          </div>
          <div className="layer-add-popover-actions">
            <label className="layer-upload-button">
              <Upload size={13} />
              <span>Upload Image</span>
              <input type="file" accept="image/*" onChange={onUploadImage} />
            </label>
          </div>
          <div className="layer-asset-grid">
            {layerLibraryAssets.length ? layerLibraryAssets.map(asset => {
              const previewSprite = resolveAssetSprite(asset);
              if (!previewSprite) return null;
              return (
                <button
                  key={asset.id}
                  type="button"
                  className="layer-asset-option"
                  title={asset.name}
                  onClick={() => onInsertAsset(asset)}
                >
                  <span className="layer-asset-thumb">
                    <span dangerouslySetInnerHTML={{ __html: spriteFrame(previewSprite, 0) }} />
                  </span>
                  <strong>{asset.name}</strong>
                </button>
              );
            }) : (
              <div className="layer-add-empty">No assets yet</div>
            )}
          </div>
        </div>
      )}
      <div className="mini-layer-list">
        {layers
          .slice()
          .sort((a, b) => b.zIndex - a.zIndex)
          .map(layer => {
            const canDragLayer = !layer.locked;
            return (
              <button
                key={layer.id}
                type="button"
                data-layer-row-id={layer.id}
                className={[
                  layer.id === selectedLayerId ? "active" : "",
                  draggedLayerId === layer.id ? "dragging" : "",
                  layerDropTargetId === layer.id ? "drop-target" : "",
                  !layer.visible ? "not-visible" : "",
                  !canDragLayer ? "locked" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => onSelectLayer(layer)}
                onContextMenu={event => {
                  onOpenLayerContextMenu(event, layer);
                }}
                onPointerDown={event => {
                  if (!canDragLayer || event.button !== 0) return;
                  onBeginLayerDrag(layer);
                }}
                onPointerUp={event => onFinishLayerReorder(event.clientX, event.clientY)}
                onPointerCancel={onCancelLayerDrag}
                title={canDragLayer ? `${layer.name} / drag to reorder depth` : `${layer.name} / locked`}
              >
                <span className="mini-layer-grip" aria-hidden="true">{canDragLayer ? "::" : "--"}</span>
                <span
                  className="mini-layer-visibility"
                  role="button"
                  tabIndex={0}
                  title={layer.visible ? "Hide layer" : "Show layer"}
                  onPointerDown={event => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    onUpdateLayer(layer.id, { visible: !layer.visible });
                  }}
                  onKeyDown={event => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    onUpdateLayer(layer.id, { visible: !layer.visible });
                  }}
                >
                  {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </span>
                <span
                  className="mini-layer-lock"
                  role="button"
                  tabIndex={0}
                  title={layer.locked ? "Unlock layer" : "Lock layer"}
                  aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                  onPointerDown={event => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    onUpdateLayer(layer.id, { locked: !layer.locked });
                  }}
                  onKeyDown={event => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    onUpdateLayer(layer.id, { locked: !layer.locked });
                  }}
                >
                  {layer.locked ? <Lock size={13} /> : <Unlock size={13} />}
                </span>
                <strong>{layer.name}</strong>
              </button>
            );
          })}
      </div>
    </aside>
  );
}
