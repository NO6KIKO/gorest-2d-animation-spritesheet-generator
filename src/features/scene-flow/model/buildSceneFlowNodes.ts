import type { GameScene, GameStartUiSettings, SceneLayer } from "../../../types";
import { SCENE_NODE_WIDTH_PERCENT } from "./geometry";
import type { SceneFlowNode } from "../types";

const FLOW_COLUMNS = [8, 25, 42, 59, 76];
const START_UI_ROW_Y = 4;
const SCENE_ROW_Y = 15;
const FLOW_ROW_GAP = 23;

type BuildSceneFlowNodesOptions = {
  currentScene: GameScene;
  currentBackground?: SceneLayer;
  savedScenes: GameScene[];
  startUis?: GameStartUiSettings[];
};

function flowPosition(index: number, rowY: number) {
  return {
    x: FLOW_COLUMNS[index % FLOW_COLUMNS.length],
    y: rowY + Math.floor(index / FLOW_COLUMNS.length) * FLOW_ROW_GAP,
  };
}

function scenePreview(scene: GameScene, currentSceneId: string, currentBackground?: SceneLayer) {
  const background = scene.id === currentSceneId
    ? currentBackground
    : scene.layers?.find(layer => layer.type === "background");

  return {
    thumbnail: background?.imageUrl,
    backgroundColor: background?.color || "#f7f7f7",
  };
}

function startUiPreview(startUi: GameStartUiSettings) {
  const visibleLayers = [...(startUi.layers || [])]
    .filter(layer => layer.visible && layer.imageUrl)
    .sort((a, b) => a.zIndex - b.zIndex);
  return {
    thumbnail: startUi.backgroundImageUrl || visibleLayers[0]?.imageUrl,
    backgroundColor: startUi.theme === "light" ? "#f7f7f7" : "#111827",
    previewWidth: startUi.designWidth || 1672,
    previewHeight: startUi.designHeight || 941,
    previewLayers: visibleLayers.map(layer => ({
      id: layer.id,
      imageUrl: layer.imageUrl,
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
      opacity: layer.opacity,
      zIndex: layer.zIndex,
    })),
  };
}

export function buildSceneFlowNodes({
  currentScene,
  currentBackground,
  savedScenes,
  startUis = [],
}: BuildSceneFlowNodesOptions): SceneFlowNode[] {
  const currentPreview = scenePreview(currentScene, currentScene.id, currentBackground);
  const startUiNodes = startUis.map((startUi, index) => ({
    id: startUi.id,
    kind: "start-ui" as const,
    title: startUi.title || `Start UI ${index + 1}`,
    subtitle: startUi.initialSceneId ? "Start UI / game entry" : "Start UI / choose entry",
    startUi,
    x: flowPosition(index, START_UI_ROW_Y).x,
    y: flowPosition(index, START_UI_ROW_Y).y,
    width: SCENE_NODE_WIDTH_PERCENT,
    ...startUiPreview(startUi),
  }));
  const sceneBaseY = startUiNodes.length
    ? START_UI_ROW_Y + Math.ceil(startUiNodes.length / FLOW_COLUMNS.length) * FLOW_ROW_GAP
    : SCENE_ROW_Y;
  const savedSceneNodes = savedScenes.map((savedScene, index) => ({
    id: savedScene.id,
    kind: "scene" as const,
    title: savedScene.name || `Scene${index + 2}`,
    subtitle: "Animation / game scene",
    scene: savedScene,
    x: flowPosition(index + 1, sceneBaseY).x,
    y: flowPosition(index + 1, sceneBaseY).y,
    width: SCENE_NODE_WIDTH_PERCENT,
    ...scenePreview(savedScene, currentScene.id, currentBackground),
  }));

  const nodes: SceneFlowNode[] = [
    ...startUiNodes,
    {
      id: currentScene.id,
      kind: "scene",
      title: currentScene.name || "Current Scene",
      subtitle: "Current scene",
      scene: currentScene,
      isCurrent: true,
      x: flowPosition(0, sceneBaseY).x,
      y: flowPosition(0, sceneBaseY).y,
      width: SCENE_NODE_WIDTH_PERCENT,
      ...currentPreview,
    },
    ...savedSceneNodes,
  ];

  if (savedSceneNodes.length) return nodes;

  return [
    ...nodes,
    {
      id: "placeholder_scene_2",
      kind: "scene",
      title: "Scene2",
      subtitle: "Add a scene",
      isPlaceholder: true,
      x: flowPosition(1, sceneBaseY).x,
      y: flowPosition(1, sceneBaseY).y,
      width: SCENE_NODE_WIDTH_PERCENT,
      thumbnail: currentPreview.thumbnail,
      backgroundColor: currentPreview.backgroundColor,
    },
    {
      id: "placeholder_scene_3",
      kind: "scene",
      title: "Scene3",
      subtitle: "Add a scene",
      isPlaceholder: true,
      x: flowPosition(2, sceneBaseY).x,
      y: flowPosition(2, sceneBaseY).y,
      width: SCENE_NODE_WIDTH_PERCENT,
      thumbnail: currentPreview.thumbnail,
      backgroundColor: currentPreview.backgroundColor,
    },
  ];
}
