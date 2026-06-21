import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { isEditingTextTarget } from "../../app/domEvents";
import { isTransformableSceneLayer } from "../../domain/scene/sceneModel";
import { cloneSceneLayer } from "../../domain/scene/sceneHistory";
import {
  createSceneLayerInstance,
  replaceBackgroundLayerSettings,
} from "../../domain/scene/sceneLayerOperations";
import type { GameScene, SceneLayer } from "../../types";

type SceneLayerClipboard = {
  layer: SceneLayer;
  sourceSceneId: string;
};

type UseSceneLayerClipboardParams = {
  enabled: boolean;
  sceneStateRef: MutableRefObject<GameScene>;
  selectedLayerIdRef: MutableRefObject<string>;
  setNotice: (notice: string) => void;
  setScene: Dispatch<SetStateAction<GameScene>>;
  setSceneContextMenu: (menu: null) => void;
  setSelectedInteractionZoneLayerId: Dispatch<SetStateAction<string | null>>;
  setSelectedLayerId: Dispatch<SetStateAction<string>>;
};

export function useSceneLayerClipboard({
  enabled,
  sceneStateRef,
  selectedLayerIdRef,
  setNotice,
  setScene,
  setSceneContextMenu,
  setSelectedInteractionZoneLayerId,
  setSelectedLayerId,
}: UseSceneLayerClipboardParams) {
  const [sceneClipboard, setSceneClipboard] = useState<SceneLayerClipboard | null>(null);
  const scenePasteCountRef = useRef(0);

  const copyLayerToSceneClipboard = useCallback((layerId = selectedLayerIdRef.current) => {
    const layer = sceneStateRef.current.layers.find(item => item.id === layerId);
    if (!layer || !isTransformableSceneLayer(layer)) {
      setNotice("Select an item or background to copy.");
      setSceneContextMenu(null);
      return false;
    }
    setSceneClipboard({ layer: cloneSceneLayer(layer), sourceSceneId: sceneStateRef.current.id });
    scenePasteCountRef.current = 0;
    setSceneContextMenu(null);
    setNotice(`Copied: ${layer.name}`);
    return true;
  }, [sceneStateRef, selectedLayerIdRef, setNotice, setSceneContextMenu]);

  const cutLayerToSceneClipboard = useCallback((layerId = selectedLayerIdRef.current) => {
    const layer = sceneStateRef.current.layers.find(item => item.id === layerId);
    if (!layer || !isTransformableSceneLayer(layer)) {
      setNotice("Select an item to cut.");
      setSceneContextMenu(null);
      return;
    }
    if (layer.locked) {
      setNotice("Unlock the layer before cutting it.");
      setSceneContextMenu(null);
      return;
    }
    if (layer.type === "background") {
      setNotice("Background cannot be cut. Copy it, then paste into another scene to replace background settings.");
      setSceneContextMenu(null);
      return;
    }
    setSceneClipboard({ layer: cloneSceneLayer(layer), sourceSceneId: sceneStateRef.current.id });
    scenePasteCountRef.current = 0;
    setScene(prev => ({ ...prev, layers: prev.layers.filter(item => item.id !== layer.id) }));
    setSelectedLayerId("");
    setSelectedInteractionZoneLayerId(null);
    setSceneContextMenu(null);
    setNotice(`Cut: ${layer.name}`);
  }, [sceneStateRef, selectedLayerIdRef, setNotice, setScene, setSceneContextMenu, setSelectedInteractionZoneLayerId, setSelectedLayerId]);

  const pasteLayerFromSceneClipboard = useCallback(() => {
    if (!sceneClipboard) {
      setNotice("Nothing to paste.");
      setSceneContextMenu(null);
      return;
    }

    const sourceLayer = cloneSceneLayer(sceneClipboard.layer);
    if (sourceLayer.type === "background") {
      const targetBackground = sceneStateRef.current.layers.find(layer => layer.type === "background");
      if (!targetBackground) {
        setNotice("No background layer is available in this scene.");
        setSceneContextMenu(null);
        return;
      }
      if (targetBackground.locked) {
        setNotice("Unlock the background before pasting background settings.");
        setSceneContextMenu(null);
        return;
      }
      const replacement = replaceBackgroundLayerSettings(targetBackground, sourceLayer);
      setScene(prev => ({
        ...prev,
        layers: prev.layers.map(layer => layer.id === targetBackground.id ? replacement : layer),
      }));
      setSelectedLayerId(targetBackground.id);
      setSelectedInteractionZoneLayerId(null);
      setSceneContextMenu(null);
      setNotice(`Pasted background settings from ${sourceLayer.name}.`);
      return;
    }

    const offsetIndex = scenePasteCountRef.current + 1;
    const maxZ = Math.max(...sceneStateRef.current.layers.map(layer => layer.zIndex), sourceLayer.zIndex);
    const pastedLayer = createSceneLayerInstance(sourceLayer, "paste", offsetIndex, maxZ + 1);
    scenePasteCountRef.current = offsetIndex;
    setScene(prev => ({ ...prev, layers: [...prev.layers, pastedLayer] }));
    setSelectedLayerId(pastedLayer.id);
    setSelectedInteractionZoneLayerId(null);
    setSceneContextMenu(null);
    setNotice(`Pasted: ${sourceLayer.name}`);
  }, [sceneClipboard, sceneStateRef, setNotice, setScene, setSceneContextMenu, setSelectedInteractionZoneLayerId, setSelectedLayerId]);

  const duplicateSceneLayer = useCallback((layerId = selectedLayerIdRef.current) => {
    const layer = sceneStateRef.current.layers.find(item => item.id === layerId);
    if (!layer || !isTransformableSceneLayer(layer)) {
      setNotice("Select an item to duplicate.");
      setSceneContextMenu(null);
      return;
    }
    if (layer.locked) {
      setNotice("Unlock the layer before duplicating it.");
      setSceneContextMenu(null);
      return;
    }
    if (layer.type === "background") {
      setNotice("Background uses a single editable layer. Copy and paste it into another scene to reuse settings.");
      setSceneContextMenu(null);
      return;
    }
    const maxZ = Math.max(...sceneStateRef.current.layers.map(item => item.zIndex), layer.zIndex);
    const copy = createSceneLayerInstance(layer, "copy", 1, maxZ + 1);
    setScene(prev => ({ ...prev, layers: [...prev.layers, copy] }));
    setSelectedLayerId(copy.id);
    setSelectedInteractionZoneLayerId(null);
    setSceneContextMenu(null);
    setNotice(`Duplicated: ${layer.name}`);
  }, [sceneStateRef, selectedLayerIdRef, setNotice, setScene, setSceneContextMenu, setSelectedInteractionZoneLayerId, setSelectedLayerId]);

  const duplicateSelectedLayer = useCallback(() => {
    duplicateSceneLayer(selectedLayerIdRef.current);
  }, [duplicateSceneLayer, selectedLayerIdRef]);

  useEffect(() => {
    if (!enabled) return;
    const onClipboardKey = (event: KeyboardEvent) => {
      if (event.repeat || isEditingTextTarget(event.target)) return;
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (!["c", "x", "v", "d"].includes(key)) return;

      event.preventDefault();
      event.stopPropagation();
      if (key === "c") {
        copyLayerToSceneClipboard();
        return;
      }
      if (key === "x") {
        cutLayerToSceneClipboard();
        return;
      }
      if (key === "v") {
        pasteLayerFromSceneClipboard();
        return;
      }
      duplicateSceneLayer();
    };

    window.addEventListener("keydown", onClipboardKey, true);
    return () => window.removeEventListener("keydown", onClipboardKey, true);
  }, [copyLayerToSceneClipboard, cutLayerToSceneClipboard, duplicateSceneLayer, enabled, pasteLayerFromSceneClipboard]);

  return {
    copyLayerToSceneClipboard,
    cutLayerToSceneClipboard,
    duplicateSceneLayer,
    duplicateSelectedLayer,
    pasteLayerFromSceneClipboard,
    sceneClipboard,
  };
}
