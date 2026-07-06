import type { GameScene, GameStartUiSettings } from "../../types";

export type SceneFlowNodeKind = "scene" | "start-ui";

export type SceneFlowNodePreviewLayer = {
  id: string;
  imageUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  zIndex: number;
};

export type SceneFlowNode = {
  id: string;
  kind: SceneFlowNodeKind;
  title: string;
  subtitle: string;
  scene?: GameScene;
  startUi?: GameStartUiSettings;
  isCurrent?: boolean;
  isPlaceholder?: boolean;
  x: number;
  y: number;
  width: number;
  thumbnail?: string;
  previewWidth?: number;
  previewHeight?: number;
  previewLayers?: SceneFlowNodePreviewLayer[];
  backgroundColor: string;
};

export type SceneFlowPoint = {
  x: number;
  y: number;
};
