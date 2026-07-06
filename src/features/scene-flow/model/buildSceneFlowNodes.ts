import type { GameScene, SceneLayer } from "../../../types";
import { SCENE_NODE_WIDTH_PERCENT } from "./geometry";
import type { SceneFlowNode } from "../types";

const SCENE_NODE_POSITIONS = [
  { x: 8, y: 15 },
  { x: 25, y: 15 },
  { x: 42, y: 15 },
  { x: 25, y: 38 },
  { x: 42, y: 38 },
  { x: 59, y: 15 },
];

type BuildSceneFlowNodesOptions = {
  currentScene: GameScene;
  currentBackground?: SceneLayer;
  savedScenes: GameScene[];
};

function scenePreview(scene: GameScene, currentSceneId: string, currentBackground?: SceneLayer) {
  const background = scene.id === currentSceneId
    ? currentBackground
    : scene.layers?.find(layer => layer.type === "background");

  return {
    thumbnail: background?.imageUrl,
    backgroundColor: background?.color || "#f7f7f7",
  };
}

export function buildSceneFlowNodes({
  currentScene,
  currentBackground,
  savedScenes,
}: BuildSceneFlowNodesOptions): SceneFlowNode[] {
  const currentPreview = scenePreview(currentScene, currentScene.id, currentBackground);
  const savedSceneNodes = savedScenes.slice(0, SCENE_NODE_POSITIONS.length - 1).map((savedScene, index) => ({
    id: savedScene.id,
    title: savedScene.name || `Scene${index + 2}`,
    subtitle: "Animation / game scene",
    scene: savedScene,
    x: SCENE_NODE_POSITIONS[index + 1].x,
    y: SCENE_NODE_POSITIONS[index + 1].y,
    width: SCENE_NODE_WIDTH_PERCENT,
    ...scenePreview(savedScene, currentScene.id, currentBackground),
  }));

  const nodes: SceneFlowNode[] = [
    {
      id: currentScene.id,
      title: currentScene.name || "Current Scene",
      subtitle: "Current scene",
      scene: currentScene,
      isCurrent: true,
      x: SCENE_NODE_POSITIONS[0].x,
      y: SCENE_NODE_POSITIONS[0].y,
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
      title: "Scene2",
      subtitle: "Add a scene",
      isPlaceholder: true,
      x: SCENE_NODE_POSITIONS[1].x,
      y: SCENE_NODE_POSITIONS[1].y,
      width: SCENE_NODE_WIDTH_PERCENT,
      thumbnail: currentPreview.thumbnail,
      backgroundColor: currentPreview.backgroundColor,
    },
    {
      id: "placeholder_scene_3",
      title: "Scene3",
      subtitle: "Add a scene",
      isPlaceholder: true,
      x: SCENE_NODE_POSITIONS[2].x,
      y: SCENE_NODE_POSITIONS[2].y,
      width: SCENE_NODE_WIDTH_PERCENT,
      thumbnail: currentPreview.thumbnail,
      backgroundColor: currentPreview.backgroundColor,
    },
  ];
}
