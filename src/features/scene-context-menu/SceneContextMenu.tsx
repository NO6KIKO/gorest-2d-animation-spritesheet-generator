import { Clipboard, Copy, Scissors, Trash2 } from "lucide-react";
import type { SceneLayer } from "../../types";

type SceneContextMenuTarget = "layer" | "interaction-zone";

type SceneContextMenuState = {
  x: number;
  y: number;
  layerId: string;
  target: SceneContextMenuTarget;
};

type SceneLayerClipboard = {
  layer: SceneLayer;
  sourceSceneId: string;
};

type SceneContextMenuProps = {
  clipboard: SceneLayerClipboard | null;
  layers: SceneLayer[];
  menu: SceneContextMenuState;
  isTransformableLayer: (layer: SceneLayer) => boolean;
  onCopyLayer: (layerId: string) => void;
  onCutLayer: (layerId: string) => void;
  onDeleteObject: (layerId: string, target: SceneContextMenuTarget) => void;
  onDuplicateLayer: (layerId: string) => void;
  onPasteLayer: () => void;
};

export function SceneContextMenu({
  clipboard,
  layers,
  menu,
  isTransformableLayer,
  onCopyLayer,
  onCutLayer,
  onDeleteObject,
  onDuplicateLayer,
  onPasteLayer,
}: SceneContextMenuProps) {
  const menuLayer = layers.find(layer => layer.id === menu.layerId);
  const isZoneMenu = menu.target === "interaction-zone";
  const isEditableLayerMenu = Boolean(menuLayer && !isZoneMenu && isTransformableLayer(menuLayer));
  const isBackgroundMenu = Boolean(menuLayer && !isZoneMenu && menuLayer.type === "background");
  const currentBackgroundLayer = layers.find(layer => layer.type === "background");
  const pasteNeedsUnlockedBackground = clipboard?.layer.type === "background" && currentBackgroundLayer?.locked;
  const copyDisabled = !isEditableLayerMenu;
  const cutDisabled = !isEditableLayerMenu || Boolean(menuLayer?.locked) || menuLayer?.type === "background";
  const pasteDisabled = !clipboard || Boolean(pasteNeedsUnlockedBackground);
  const duplicateDisabled = !isEditableLayerMenu || Boolean(menuLayer?.locked) || menuLayer?.type === "background";
  const deleteDisabled = !menuLayer || (Boolean(menuLayer.locked) && !isBackgroundMenu);
  const contextHint = (() => {
    if (isZoneMenu) return "Select the owner item for copy, cut, paste, and duplicate.";
    if (!menuLayer) return "No scene object selected.";
    if (!isTransformableLayer(menuLayer)) return "This layer cannot be copied or duplicated.";
    if (menuLayer.type === "background") return "Delete clears the image and keeps the default black scene background.";
    if (menuLayer.locked) return "Unlock before cutting, duplicating, or deleting.";
    if (!clipboard) return "Copy or cut an item before pasting.";
    return "";
  })();

  return (
    <div
      className="scene-context-menu"
      style={{ left: menu.x, top: menu.y }}
      role="menu"
      onPointerDown={event => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onContextMenu={event => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="scene-context-menu-title">
        {isZoneMenu ? "Interaction Zone" : menuLayer?.name || "Scene Object"}
      </div>
      <button
        type="button"
        role="menuitem"
        disabled={copyDisabled}
        onClick={() => menuLayer && onCopyLayer(menuLayer.id)}
      >
        <Copy size={14} /> Copy <kbd>Ctrl C</kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={cutDisabled}
        onClick={() => menuLayer && onCutLayer(menuLayer.id)}
      >
        <Scissors size={14} /> Cut <kbd>Ctrl X</kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={pasteDisabled}
        onClick={onPasteLayer}
      >
        <Clipboard size={14} /> Paste <kbd>Ctrl V</kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={duplicateDisabled}
        onClick={() => menuLayer && onDuplicateLayer(menuLayer.id)}
      >
        <Copy size={14} /> Duplicate <kbd>Ctrl D</kbd>
      </button>
      <div className="scene-context-menu-separator" />
      <button
        type="button"
        role="menuitem"
        disabled={deleteDisabled}
        onClick={() => onDeleteObject(menu.layerId, menu.target)}
      >
        <Trash2 size={14} /> {isZoneMenu ? "Delete Interaction Zone" : "Delete"}
      </button>
      {contextHint && (
        <span>{contextHint}</span>
      )}
    </div>
  );
}
