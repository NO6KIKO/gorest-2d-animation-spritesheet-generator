import { useRef, type Dispatch, type SetStateAction } from "react";
import type { WorkspaceTab } from "../../../app/types";
import { createDefaultScene, prepareSceneForEditor, sceneTimestampLabel } from "../../../domain/scene/sceneFactory";
import { normalizeGameFlowGraph, removeNodeFromGameFlowGraph } from "../../../domain/scene/sceneFlowGraph";
import { cloneSceneForHistory } from "../../../domain/scene/sceneHistory";
import { isSceneVisualLayer } from "../../../domain/scene/sceneModel";
import { normalizeStartUiCollection, normalizeStartUiSettings } from "../../../domain/scene/startUiModel";
import {
  deleteGameScene,
  deleteGameStartUi,
  saveGameScene,
  saveGameStartUi,
} from "../../../services/gameLibraryApi";
import type { GameAsset, GameFlowGraph, GameScene, GameStartUiSettings } from "../../../types";
import type { SceneFlowNode } from "../types";

export type SceneVehiclePhase = "approaching" | "ready" | "boarded";

type UseSceneFlowLibraryActionsOptions = {
  assetById: Map<string, GameAsset>;
  scene: GameScene;
  scenes: GameScene[];
  startUiSceneOptions: GameScene[];
  startUis: GameStartUiSettings[];
  setActiveStartUiId: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setFlowGraph: Dispatch<SetStateAction<GameFlowGraph>>;
  setIsBackpackOpen: Dispatch<SetStateAction<boolean>>;
  setIsSavingStartUi: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setScene: Dispatch<SetStateAction<GameScene>>;
  setScenes: Dispatch<SetStateAction<GameScene[]>>;
  setSelectedLayerId: Dispatch<SetStateAction<string>>;
  setStartUis: Dispatch<SetStateAction<GameStartUiSettings[]>>;
  setTab: Dispatch<SetStateAction<WorkspaceTab>>;
  setVehiclePhase: Dispatch<SetStateAction<SceneVehiclePhase>>;
};

function cloneStartUiSettings(settings: GameStartUiSettings) {
  if (typeof structuredClone === "function") return structuredClone(settings);
  return JSON.parse(JSON.stringify(settings)) as GameStartUiSettings;
}

export function useSceneFlowLibraryActions({
  assetById,
  scene,
  scenes,
  startUiSceneOptions,
  startUis,
  setActiveStartUiId,
  setError,
  setFlowGraph,
  setIsBackpackOpen,
  setIsSavingStartUi,
  setNotice,
  setScene,
  setScenes,
  setSelectedLayerId,
  setStartUis,
  setTab,
  setVehiclePhase,
}: UseSceneFlowLibraryActionsOptions) {
  const isCreatingSceneRef = useRef(false);

  const persistScene = async (sceneToSave: GameScene, successMessage: string) => {
    setError(null);
    try {
      const nextScene = {
        ...prepareSceneForEditor(sceneToSave),
        savedTime: sceneToSave.savedTime || new Date().toISOString(),
        updatedTime: new Date().toISOString(),
      };
      const data = await saveGameScene(nextScene);
      const savedScene = data.scene || nextScene;
      setScenes(data.library.scenes.map(prepareSceneForEditor));
      setScene(prepareSceneForEditor(savedScene));
      setSelectedLayerId("");
      setTab("scenes");
      setNotice(successMessage.replace("{name}", savedScene.name));
    } catch (err: any) {
      setError(err.message || "Failed to save scene");
    }
  };

  const saveScene = async () => {
    await persistScene(scene, "Scene updated: {name}");
  };

  const saveStartUiSettings = async (settings: GameStartUiSettings) => {
    setError(null);
    setIsSavingStartUi(true);
    try {
      const nextStartUi = normalizeStartUiSettings({
        ...settings,
        updatedTime: new Date().toISOString(),
      }, startUiSceneOptions);
      const data = await saveGameStartUi(nextStartUi);
      const normalizedStartUis = normalizeStartUiCollection(
        data.library.startUis,
        data.library.startUi || data.startUi || nextStartUi,
        startUiSceneOptions
      );
      setStartUis(normalizedStartUis);
      setActiveStartUiId(nextStartUi.id);
      if (Array.isArray(data.library.scenes)) setScenes(data.library.scenes.map(prepareSceneForEditor));
      setNotice("Start UI saved.");
    } catch (err: any) {
      setError(err.message || "Failed to save Start UI");
      throw err;
    } finally {
      setIsSavingStartUi(false);
    }
  };

  const saveCompletedScene = async () => {
    const now = new Date();
    const completedScene: GameScene = {
      ...prepareSceneForEditor(scene),
      id: `scene_completed_${Date.now()}`,
      name: `${scene.name || "Scene"} - Complete ${sceneTimestampLabel(now)}`,
      savedTime: now.toISOString(),
      updatedTime: now.toISOString(),
    };
    await persistScene(completedScene, "Completed scene saved: {name}");
  };

  const deleteScene = async (sceneId: string) => {
    setError(null);
    try {
      const data = await deleteGameScene(sceneId);
      const nextScenes = Array.isArray(data.library.scenes)
        ? data.library.scenes.map(prepareSceneForEditor)
        : [];
      setScenes(nextScenes);
      setFlowGraph(currentGraph => removeNodeFromGameFlowGraph(
        data.library.flowGraph ? normalizeGameFlowGraph(data.library.flowGraph) : currentGraph,
        sceneId,
      ));
      if (scene.id === sceneId) {
        const fallbackScene = nextScenes[0] || prepareSceneForEditor(createDefaultScene());
        setScene(fallbackScene);
        setSelectedLayerId("");
      }
      setIsBackpackOpen(false);
      setVehiclePhase("approaching");
      setTab("scenes");
      setNotice("Scene deleted.");
    } catch (err: any) {
      setError(err.message || "Failed to delete scene");
    }
  };

  const uniqueCopiedSceneName = (sourceName: string) => {
    const baseName = `${sourceName || "Scene"} Copy`;
    const usedNames = new Set([scene.name, ...scenes.map(savedScene => savedScene.name)].filter(Boolean));
    if (!usedNames.has(baseName)) return baseName;
    let copyIndex = 2;
    while (usedNames.has(`${baseName} ${copyIndex}`)) copyIndex += 1;
    return `${baseName} ${copyIndex}`;
  };

  const uniqueNewSceneName = () => {
    const usedNames = new Set([scene.name, ...scenes.map(savedScene => savedScene.name)].filter(Boolean));
    let sceneIndex = scenes.length + 1;
    let candidate = `New Scene ${sceneIndex}`;
    while (usedNames.has(candidate)) {
      sceneIndex += 1;
      candidate = `New Scene ${sceneIndex}`;
    }
    return candidate;
  };

  const uniqueStartUiTitle = (sourceTitle = "Start UI") => {
    const usedTitles = new Set(startUis.map(settings => settings.title).filter(Boolean));
    if (!usedTitles.has(sourceTitle)) return sourceTitle;
    let startUiIndex = 2;
    let candidate = `${sourceTitle} ${startUiIndex}`;
    while (usedTitles.has(candidate)) {
      startUiIndex += 1;
      candidate = `${sourceTitle} ${startUiIndex}`;
    }
    return candidate;
  };

  const saveSceneCopy = async (sourceScene: GameScene, successPrefix: string) => {
    setError(null);
    try {
      const now = new Date().toISOString();
      const cleanSource = prepareSceneForEditor(sourceScene);
      const sceneCopy: GameScene = {
        ...cloneSceneForHistory(cleanSource),
        id: `scene_copy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: uniqueCopiedSceneName(cleanSource.name),
        savedTime: now,
        updatedTime: now,
      };
      const data = await saveGameScene(sceneCopy, "Failed to save scene copy");
      const savedScene = data.scene || sceneCopy;
      setScenes(data.library.scenes.map(prepareSceneForEditor));
      setTab("scenes");
      setNotice(`${successPrefix}: ${savedScene.name}`);
    } catch (err: any) {
      setError(err.message || "Failed to save scene copy");
    }
  };

  const duplicateSceneNode = async (node: SceneFlowNode) => {
    if (!node.scene || node.isPlaceholder) {
      setNotice("Select a scene to duplicate.");
      return;
    }
    await saveSceneCopy(node.scene, "Scene duplicated");
  };

  const pasteSceneNode = async (sourceScene: GameScene) => {
    await saveSceneCopy(sourceScene, "Scene pasted");
  };

  const deleteSceneNode = async (node: SceneFlowNode) => {
    if (!node.scene || node.isPlaceholder) {
      setNotice("Select a scene to delete.");
      return;
    }
    const isSavedScene = scenes.some(savedScene => savedScene.id === node.scene?.id);
    if (!isSavedScene) {
      if (node.isCurrent) {
        const fallbackScene = scenes[0] || prepareSceneForEditor(createDefaultScene());
        setScene(fallbackScene);
        setSelectedLayerId("");
        setTab("scenes");
        setNotice("Current draft scene cleared.");
        return;
      }
      setNotice("This scene has not been saved yet.");
      return;
    }
    await deleteScene(node.scene.id);
  };

  const createStartUiNode = async () => {
    const nowTime = Date.now();
    const template = startUis[0]
      ? cloneStartUiSettings(startUis[0])
      : normalizeStartUiSettings(undefined, startUiSceneOptions);
    const nextStartUi = normalizeStartUiSettings({
      ...template,
      id: `start_ui_${nowTime}`,
      title: uniqueStartUiTitle("Start UI"),
      initialSceneId: scene.id,
      updatedTime: new Date(nowTime).toISOString(),
    }, startUiSceneOptions);
    await saveStartUiSettings(nextStartUi);
    setActiveStartUiId(nextStartUi.id);
    setTab("scenes");
    setNotice(`Start UI created: ${nextStartUi.title}`);
    return nextStartUi;
  };

  const duplicateStartUiNode = async (settings: GameStartUiSettings) => {
    const nowTime = Date.now();
    const copyTitle = uniqueStartUiTitle(`${settings.title || "Start UI"} Copy`);
    const nextStartUi = normalizeStartUiSettings({
      ...cloneStartUiSettings(settings),
      id: `start_ui_copy_${nowTime}_${Math.random().toString(36).slice(2, 8)}`,
      title: copyTitle,
      updatedTime: new Date(nowTime).toISOString(),
    }, startUiSceneOptions);
    await saveStartUiSettings(nextStartUi);
    setActiveStartUiId(nextStartUi.id);
    setTab("scenes");
    setNotice(`Start UI duplicated: ${nextStartUi.title}`);
  };

  const deleteStartUiNode = async (settings: GameStartUiSettings) => {
    setError(null);
    setIsSavingStartUi(true);
    try {
      const data = await deleteGameStartUi(settings.id);
      const normalizedStartUis = normalizeStartUiCollection(data.library.startUis, data.library.startUi, startUiSceneOptions);
      setStartUis(normalizedStartUis);
      setFlowGraph(currentGraph => removeNodeFromGameFlowGraph(
        data.library.flowGraph ? normalizeGameFlowGraph(data.library.flowGraph) : currentGraph,
        settings.id,
      ));
      setActiveStartUiId(normalizedStartUis[0]?.id || "start_ui_main");
      setTab("scenes");
      setNotice(`Start UI deleted: ${settings.title || "Start UI"}.`);
    } catch (err: any) {
      setError(err.message || "Failed to delete Start UI");
    } finally {
      setIsSavingStartUi(false);
    }
  };

  const startNewScene = async () => {
    if (isCreatingSceneRef.current) return;
    isCreatingSceneRef.current = true;
    setError(null);
    setNotice("Creating new scene...");
    const nowTime = Date.now();
    const now = new Date(nowTime);
    const base = prepareSceneForEditor(createDefaultScene());
    const playerLayers = scene.layers
      .filter(layer => {
        if (!layer.assetId || !isSceneVisualLayer(layer)) return false;
        return assetById.get(layer.assetId)?.role === "player";
      })
      .map((layer, index) => ({
        ...layer,
        id: `layer_player_scene_${nowTime}_${index}`,
        name: layer.name || "Player",
        x: 420 + index * 36,
        y: base.groundY + 2,
        zIndex: Math.max(layer.zIndex, 30),
        opacity: 1,
        parallax: 1,
        visible: true,
      }));
    const nextScene: GameScene = {
      ...base,
      id: `scene_new_${nowTime}`,
      name: uniqueNewSceneName(),
      cameraX: 0,
      cameraY: 0,
      savedTime: now.toISOString(),
      updatedTime: now.toISOString(),
      layers: [...base.layers, ...playerLayers],
    };
    try {
      const data = await saveGameScene(nextScene, "Failed to create new scene");
      const savedScene = prepareSceneForEditor(data.scene || nextScene);
      setScenes(data.library.scenes.map(prepareSceneForEditor));
      setScene(savedScene);
      setSelectedLayerId(playerLayers[0]?.id || "");
      setIsBackpackOpen(false);
      setVehiclePhase("approaching");
      setTab("scene");
      setNotice(playerLayers.length
        ? `New scene created: ${savedScene.name}. Current player copied in.`
        : `New scene created: ${savedScene.name}.`);
    } catch (err: any) {
      setError(err.message || "Failed to create new scene");
      setNotice("");
    } finally {
      isCreatingSceneRef.current = false;
    }
  };

  const loadSavedScene = (savedScene: GameScene) => {
    const cleanScene = prepareSceneForEditor(savedScene);
    setScene(cleanScene);
    setSelectedLayerId("");
    setIsBackpackOpen(false);
    setVehiclePhase("approaching");
    setTab("scene");
    setNotice(`Loaded scene: ${cleanScene.name}`);
  };

  return {
    createStartUiNode,
    deleteSceneNode,
    deleteStartUiNode,
    duplicateSceneNode,
    duplicateStartUiNode,
    loadSavedScene,
    pasteSceneNode,
    saveCompletedScene,
    saveScene,
    saveStartUiSettings,
    startNewScene,
  };
}
