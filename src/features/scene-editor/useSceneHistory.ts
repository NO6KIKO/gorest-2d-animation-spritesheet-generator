import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { isEditingTextTarget } from "../../app/domEvents";
import {
  SCENE_HISTORY_LIMIT,
  cloneSceneForHistory,
  sceneHistoryKey,
} from "../../domain/scene/sceneHistory";
import type { GameScene } from "../../types";

type UseSceneHistoryParams = {
  enabled: boolean;
  isAutomaticSceneMotion: boolean;
  scene: GameScene;
  sceneStateRef: MutableRefObject<GameScene>;
  selectedLayerIdRef: MutableRefObject<string>;
  setNotice: (notice: string) => void;
  setScene: Dispatch<SetStateAction<GameScene>>;
  setSceneContextMenu: (menu: null) => void;
  setSelectedInteractionZoneLayerId: Dispatch<SetStateAction<string | null>>;
  setSelectedLayerId: Dispatch<SetStateAction<string>>;
};

export function useSceneHistory({
  enabled,
  isAutomaticSceneMotion,
  scene,
  sceneStateRef,
  selectedLayerIdRef,
  setNotice,
  setScene,
  setSceneContextMenu,
  setSelectedInteractionZoneLayerId,
  setSelectedLayerId,
}: UseSceneHistoryParams) {
  const sceneHistoryPastRef = useRef<GameScene[]>([]);
  const sceneHistoryFutureRef = useRef<GameScene[]>([]);
  const sceneHistoryLastRef = useRef<GameScene | null>(null);
  const sceneHistoryNavigationRef = useRef(false);

  useEffect(() => {
    const previousScene = sceneHistoryLastRef.current;
    const nextSnapshot = cloneSceneForHistory(scene);

    if (!previousScene) {
      sceneHistoryLastRef.current = nextSnapshot;
      return;
    }

    if (previousScene.id !== scene.id) {
      sceneHistoryPastRef.current = [];
      sceneHistoryFutureRef.current = [];
      sceneHistoryLastRef.current = nextSnapshot;
      sceneHistoryNavigationRef.current = false;
      return;
    }

    if (sceneHistoryNavigationRef.current) {
      sceneHistoryNavigationRef.current = false;
      sceneHistoryLastRef.current = nextSnapshot;
      return;
    }

    if (sceneHistoryKey(previousScene) === sceneHistoryKey(scene)) {
      sceneHistoryLastRef.current = nextSnapshot;
      return;
    }

    if (!isAutomaticSceneMotion) {
      sceneHistoryPastRef.current = [...sceneHistoryPastRef.current, previousScene].slice(-SCENE_HISTORY_LIMIT);
      sceneHistoryFutureRef.current = [];
    }
    sceneHistoryLastRef.current = nextSnapshot;
  }, [isAutomaticSceneMotion, scene]);

  const restoreSceneFromHistory = useCallback((nextScene: GameScene, message: string) => {
    const selectedId = selectedLayerIdRef.current;
    const selectedLayerStillExists = selectedId && nextScene.layers.some(layer => layer.id === selectedId);
    const fallbackLayer = [...nextScene.layers].sort((a, b) => b.zIndex - a.zIndex)[0];

    sceneHistoryNavigationRef.current = true;
    setScene(cloneSceneForHistory(nextScene));
    setSelectedLayerId(selectedLayerStillExists ? selectedId : fallbackLayer?.id || "");
    setSelectedInteractionZoneLayerId(null);
    setSceneContextMenu(null);
    setNotice(message);
  }, [selectedLayerIdRef, setNotice, setScene, setSceneContextMenu, setSelectedInteractionZoneLayerId, setSelectedLayerId]);

  const undoSceneChange = useCallback(() => {
    const previousScene = sceneHistoryPastRef.current[sceneHistoryPastRef.current.length - 1];
    if (!previousScene) {
      setNotice("Nothing to undo.");
      return;
    }
    sceneHistoryPastRef.current = sceneHistoryPastRef.current.slice(0, -1);
    sceneHistoryFutureRef.current = [
      cloneSceneForHistory(sceneStateRef.current),
      ...sceneHistoryFutureRef.current,
    ].slice(0, SCENE_HISTORY_LIMIT);
    restoreSceneFromHistory(previousScene, "Undo");
  }, [restoreSceneFromHistory, sceneStateRef, setNotice]);

  const redoSceneChange = useCallback(() => {
    const nextScene = sceneHistoryFutureRef.current[0];
    if (!nextScene) {
      setNotice("Nothing to redo.");
      return;
    }
    sceneHistoryFutureRef.current = sceneHistoryFutureRef.current.slice(1);
    sceneHistoryPastRef.current = [
      ...sceneHistoryPastRef.current,
      cloneSceneForHistory(sceneStateRef.current),
    ].slice(-SCENE_HISTORY_LIMIT);
    restoreSceneFromHistory(nextScene, "Redo");
  }, [restoreSceneFromHistory, sceneStateRef, setNotice]);

  useEffect(() => {
    if (!enabled) return;
    const onHistoryKey = (event: KeyboardEvent) => {
      if (event.repeat || isEditingTextTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const modifierPressed = event.ctrlKey || event.metaKey;
      const isUndo = modifierPressed && key === "z" && !event.shiftKey;
      const isRedo = modifierPressed && (key === "y" || (key === "z" && event.shiftKey));
      if (!isUndo && !isRedo) return;
      event.preventDefault();
      event.stopPropagation();
      if (isUndo) {
        undoSceneChange();
        return;
      }
      redoSceneChange();
    };

    window.addEventListener("keydown", onHistoryKey, true);
    return () => window.removeEventListener("keydown", onHistoryKey, true);
  }, [enabled, redoSceneChange, undoSceneChange]);

  return {
    redoSceneChange,
    undoSceneChange,
  };
}
