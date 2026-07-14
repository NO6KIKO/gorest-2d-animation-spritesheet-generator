import { useRef, type Dispatch, type SetStateAction } from "react";
import type { WorkspaceTab } from "../../../app/types";
import {
  cloneAnimationScene,
  createDefaultAnimationScene,
  normalizeAnimationScene,
} from "../../../domain/scene/animationSceneModel";
import { normalizeGameFlowGraph, removeNodeFromGameFlowGraph } from "../../../domain/scene/sceneFlowGraph";
import { deleteAnimationScene, saveAnimationScene } from "../../../services/gameLibraryApi";
import type { AnimationScene, GameAsset, GameFlowGraph, GameScene } from "../../../types";
import type { SceneFlowNode } from "../types";

type UseAnimationSceneLibraryActionsOptions = {
  animationScene: AnimationScene;
  animationScenes: AnimationScene[];
  assets: GameAsset[];
  sourceScene: GameScene;
  setAnimationRunToken: Dispatch<SetStateAction<number>>;
  setAnimationScene: Dispatch<SetStateAction<AnimationScene>>;
  setAnimationScenes: Dispatch<SetStateAction<AnimationScene[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setFlowGraph: Dispatch<SetStateAction<GameFlowGraph>>;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setTab: Dispatch<SetStateAction<WorkspaceTab>>;
};

export function useAnimationSceneLibraryActions({
  animationScene,
  animationScenes,
  assets,
  sourceScene,
  setAnimationRunToken,
  setAnimationScene,
  setAnimationScenes,
  setError,
  setFlowGraph,
  setIsSaving,
  setNotice,
  setTab,
}: UseAnimationSceneLibraryActionsOptions) {
  const isCreatingRef = useRef(false);

  const libraryScenes = (items?: AnimationScene[]) => (
    Array.isArray(items) ? items.map(normalizeAnimationScene) : []
  );

  const uniqueName = (baseName: string) => {
    const usedNames = new Set(animationScenes.map(item => item.name));
    if (!usedNames.has(baseName)) return baseName;
    let index = 2;
    while (usedNames.has(`${baseName} ${index}`)) index += 1;
    return `${baseName} ${index}`;
  };

  const persistAnimationScene = async (sceneToSave: AnimationScene, successMessage: string) => {
    setError(null);
    setIsSaving(true);
    try {
      const normalized = normalizeAnimationScene({
        ...sceneToSave,
        updatedTime: new Date().toISOString(),
      });
      const data = await saveAnimationScene(normalized);
      const saved = normalizeAnimationScene(data.animationScene || normalized);
      setAnimationScene(saved);
      setAnimationScenes(libraryScenes(data.library.animationScenes));
      setNotice(successMessage.replace("{name}", saved.name));
      return saved;
    } catch (error: any) {
      setError(error.message || "Failed to save animation scene");
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const saveCurrentAnimationScene = async () => {
    await persistAnimationScene(animationScene, "Animation scene saved: {name}");
  };

  const createAnimationSceneNode = async () => {
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    const created = createDefaultAnimationScene(sourceScene, assets);
    created.name = uniqueName(created.name);
    try {
      const saved = await persistAnimationScene(created, "Animation scene created: {name}");
      setTab("animation-scene");
      return saved;
    } finally {
      isCreatingRef.current = false;
    }
  };

  const loadAnimationScene = (savedScene: AnimationScene, run = false) => {
    const normalized = normalizeAnimationScene(savedScene);
    setAnimationScene(normalized);
    setTab("animation-scene");
    if (run) setAnimationRunToken(value => value + 1);
    setNotice(`${run ? "Running" : "Loaded"} animation scene: ${normalized.name}`);
  };

  const duplicateAnimationSceneNode = async (node: SceneFlowNode) => {
    if (!node.animationScene || node.isPlaceholder) {
      setNotice("Select an animation scene to duplicate.");
      return;
    }
    const nowTime = Date.now();
    const copy = cloneAnimationScene(node.animationScene);
    copy.id = `animation_scene_copy_${nowTime}_${Math.random().toString(36).slice(2, 8)}`;
    copy.name = uniqueName(`${node.animationScene.name || "Animation Scene"} Copy`);
    copy.savedTime = new Date(nowTime).toISOString();
    copy.updatedTime = copy.savedTime;
    await persistAnimationScene(copy, "Animation scene duplicated: {name}");
    setTab("scenes");
  };

  const deleteAnimationSceneNode = async (node: SceneFlowNode) => {
    if (!node.animationScene || node.isPlaceholder) {
      setNotice("Select an animation scene to delete.");
      return;
    }
    setError(null);
    try {
      const data = await deleteAnimationScene(node.animationScene.id);
      const nextScenes = libraryScenes(data.library.animationScenes);
      setAnimationScenes(nextScenes);
      setFlowGraph(currentGraph => removeNodeFromGameFlowGraph(
        data.library.flowGraph ? normalizeGameFlowGraph(data.library.flowGraph) : currentGraph,
        node.animationScene!.id,
      ));
      if (animationScene.id === node.animationScene.id) {
        setAnimationScene(nextScenes[0] || createDefaultAnimationScene(sourceScene, assets));
      }
      setTab("scenes");
      setNotice(`Animation scene deleted: ${node.animationScene.name}.`);
    } catch (error: any) {
      setError(error.message || "Failed to delete animation scene");
    }
  };

  return {
    createAnimationSceneNode,
    deleteAnimationSceneNode,
    duplicateAnimationSceneNode,
    loadAnimationScene,
    saveCurrentAnimationScene,
  };
}
