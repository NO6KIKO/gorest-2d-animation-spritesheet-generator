import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  clampSceneFlowPercent,
  clampSceneNodeWidth,
  clampSceneNodeX,
  clampSceneNodeY,
  SCENE_NODE_MIN_WIDTH_PERCENT,
} from "../model/geometry";
import type { SceneFlowNode, SceneFlowPoint } from "../types";

type SceneNodeLayout = SceneFlowPoint & {
  width: number;
};

type SceneNodeLayoutMap = Record<string, SceneNodeLayout>;

type SceneNodeDrag = {
  nodeId: string;
  pointerStart: SceneFlowPoint;
  startX: number;
  startY: number;
  width: number;
  moved: boolean;
  startLayouts: SceneNodeLayoutMap;
};

type SceneNodeResize = {
  edge: "left" | "right";
  nodeId: string;
  pointerStartX: number;
  startX: number;
  startY: number;
  startWidth: number;
  moved: boolean;
  startLayouts: SceneNodeLayoutMap;
};

type UseSceneFlowLayoutOptions = {
  nodes: SceneFlowNode[];
  onStatus: (message: string) => void;
};

const SCENE_FLOW_HISTORY_LIMIT = 80;

function cloneNodeLayouts(layouts: SceneNodeLayoutMap): SceneNodeLayoutMap {
  return Object.fromEntries(Object.entries(layouts).map(([nodeId, layout]) => [nodeId, { ...layout }]));
}

export function useSceneFlowLayout({ nodes, onStatus }: UseSceneFlowLayoutOptions) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const suppressNextClickRef = useRef(false);
  const nodeLayoutsRef = useRef<SceneNodeLayoutMap>({});
  const undoLayoutsRef = useRef<SceneNodeLayoutMap[]>([]);
  const redoLayoutsRef = useRef<SceneNodeLayoutMap[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState(nodes[0]?.id || "");
  const [nodeDrag, setNodeDrag] = useState<SceneNodeDrag | null>(null);
  const [nodeResize, setNodeResize] = useState<SceneNodeResize | null>(null);
  const [nodeLayouts, setNodeLayouts] = useState<SceneNodeLayoutMap>({});

  const nodeIds = useMemo(() => new Set(nodes.map(node => node.id)), [nodes]);
  const displayNodes = useMemo(() => nodes.map(node => {
    const layout = nodeLayouts[node.id];
    const width = clampSceneNodeWidth(layout?.width ?? node.width);
    return {
      ...node,
      x: clampSceneNodeX(layout?.x ?? node.x, width),
      y: clampSceneNodeY(layout?.y ?? node.y),
      width,
    };
  }), [nodeLayouts, nodes]);
  const activeSelectedNodeId = nodeIds.has(selectedNodeId) ? selectedNodeId : nodes[0]?.id || "";

  useEffect(() => {
    nodeLayoutsRef.current = nodeLayouts;
  }, [nodeLayouts]);

  const pointFromClient = useCallback((clientX: number, clientY: number): SceneFlowPoint => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clampSceneFlowPercent(((clientX - rect.left) / Math.max(1, rect.width)) * 100),
      y: clampSceneFlowPercent(((clientY - rect.top) / Math.max(1, rect.height)) * 100),
    };
  }, []);

  useEffect(() => {
    setNodeLayouts(currentLayouts => {
      const nextLayouts: Record<string, SceneNodeLayout> = {};
      for (const node of nodes) {
        const existing = currentLayouts[node.id];
        if (existing) {
          const width = clampSceneNodeWidth(existing.width);
          nextLayouts[node.id] = {
            x: clampSceneNodeX(existing.x, width),
            y: clampSceneNodeY(existing.y),
            width,
          };
        }
      }
      return nextLayouts;
    });
    undoLayoutsRef.current = [];
    redoLayoutsRef.current = [];
  }, [nodes]);

  const pushLayoutHistory = useCallback((previousLayouts: SceneNodeLayoutMap) => {
    undoLayoutsRef.current = [
      ...undoLayoutsRef.current,
      cloneNodeLayouts(previousLayouts),
    ].slice(-SCENE_FLOW_HISTORY_LIMIT);
    redoLayoutsRef.current = [];
  }, []);

  const startNodeDrag = useCallback((event: PointerEvent<HTMLElement>, node: SceneFlowNode) => {
    if (event.button !== 0 || nodeResize) return;
    const pointerStart = pointFromClient(event.clientX, event.clientY);
    const displayedNode = displayNodes.find(displayNode => displayNode.id === node.id) || node;
    setSelectedNodeId(node.id);
    suppressNextClickRef.current = false;
    setNodeDrag({
      nodeId: node.id,
      pointerStart,
      startX: displayedNode.x,
      startY: displayedNode.y,
      width: displayedNode.width,
      moved: false,
      startLayouts: cloneNodeLayouts(nodeLayoutsRef.current),
    });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [displayNodes, nodeResize, pointFromClient]);

  const updateNodeDragAt = useCallback((clientX: number, clientY: number) => {
    const pointer = pointFromClient(clientX, clientY);
    setNodeDrag(currentDrag => {
      if (!currentDrag) return currentDrag;
      const dx = pointer.x - currentDrag.pointerStart.x;
      const dy = pointer.y - currentDrag.pointerStart.y;
      const moved = currentDrag.moved || Math.hypot(dx, dy) > 1;
      if (moved) {
        suppressNextClickRef.current = true;
        setNodeLayouts(currentLayouts => ({
          ...currentLayouts,
          [currentDrag.nodeId]: {
            x: clampSceneNodeX(currentDrag.startX + dx, currentDrag.width),
            y: clampSceneNodeY(currentDrag.startY + dy),
            width: currentDrag.width,
          },
        }));
      }
      return { ...currentDrag, moved };
    });
  }, [pointFromClient]);

  const finishNodeDrag = useCallback(() => {
    setNodeDrag(currentDrag => {
      if (currentDrag?.moved) {
        pushLayoutHistory(currentDrag.startLayouts);
        onStatus("Card moved.");
      }
      return null;
    });
  }, [onStatus, pushLayoutHistory]);

  const startNodeResize = useCallback((
    event: PointerEvent<HTMLButtonElement>,
    node: SceneFlowNode,
    edge: "left" | "right",
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const pointerStart = pointFromClient(event.clientX, event.clientY);
    const displayedNode = displayNodes.find(displayNode => displayNode.id === node.id) || node;
    setSelectedNodeId(node.id);
    setNodeDrag(null);
    suppressNextClickRef.current = false;
    setNodeResize({
      edge,
      nodeId: node.id,
      pointerStartX: pointerStart.x,
      startX: displayedNode.x,
      startY: displayedNode.y,
      startWidth: displayedNode.width,
      moved: false,
      startLayouts: cloneNodeLayouts(nodeLayoutsRef.current),
    });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [displayNodes, pointFromClient]);

  const updateNodeResizeAt = useCallback((clientX: number, clientY: number) => {
    const pointer = pointFromClient(clientX, clientY);
    setNodeResize(currentResize => {
      if (!currentResize) return currentResize;
      const dx = pointer.x - currentResize.pointerStartX;
      const moved = currentResize.moved || Math.abs(dx) > 0.6;
      if (moved) {
        suppressNextClickRef.current = true;
        setNodeLayouts(currentLayouts => {
          let width = currentResize.startWidth;
          let x = currentResize.startX;

          if (currentResize.edge === "right") {
            width = clampSceneNodeWidth(Math.min(currentResize.startWidth + dx, 100 - currentResize.startX));
          } else {
            width = clampSceneNodeWidth(currentResize.startWidth - dx);
            x = clampSceneNodeX(currentResize.startX + currentResize.startWidth - width, width);
          }

          if (100 - x < SCENE_NODE_MIN_WIDTH_PERCENT) {
            x = 100 - SCENE_NODE_MIN_WIDTH_PERCENT;
            width = SCENE_NODE_MIN_WIDTH_PERCENT;
          }

          return {
            ...currentLayouts,
            [currentResize.nodeId]: {
              x,
              y: currentResize.startY,
              width,
            },
          };
        });
      }
      return { ...currentResize, moved };
    });
  }, [pointFromClient]);

  const finishNodeResize = useCallback(() => {
    setNodeResize(currentResize => {
      if (currentResize?.moved) {
        pushLayoutHistory(currentResize.startLayouts);
        onStatus("Card width adjusted.");
      }
      return null;
    });
  }, [onStatus, pushLayoutHistory]);

  const undoNodeLayoutChange = useCallback(() => {
    const previousLayouts = undoLayoutsRef.current[undoLayoutsRef.current.length - 1];
    if (!previousLayouts) {
      onStatus("Nothing to undo in 2D Canvas.");
      return;
    }
    redoLayoutsRef.current = [
      cloneNodeLayouts(nodeLayoutsRef.current),
      ...redoLayoutsRef.current,
    ].slice(0, SCENE_FLOW_HISTORY_LIMIT);
    undoLayoutsRef.current = undoLayoutsRef.current.slice(0, -1);
    setNodeDrag(null);
    setNodeResize(null);
    setNodeLayouts(cloneNodeLayouts(previousLayouts));
    onStatus("Undo 2D Canvas layout.");
  }, [onStatus]);

  const redoNodeLayoutChange = useCallback(() => {
    const nextLayouts = redoLayoutsRef.current[0];
    if (!nextLayouts) {
      onStatus("Nothing to redo in 2D Canvas.");
      return;
    }
    undoLayoutsRef.current = [
      ...undoLayoutsRef.current,
      cloneNodeLayouts(nodeLayoutsRef.current),
    ].slice(-SCENE_FLOW_HISTORY_LIMIT);
    redoLayoutsRef.current = redoLayoutsRef.current.slice(1);
    setNodeDrag(null);
    setNodeResize(null);
    setNodeLayouts(cloneNodeLayouts(nextLayouts));
    onStatus("Redo 2D Canvas layout.");
  }, [onStatus]);

  useEffect(() => {
    if (!nodeDrag) return;
    const handleMove = (event: globalThis.PointerEvent) => updateNodeDragAt(event.clientX, event.clientY);
    const handleUp = () => finishNodeDrag();
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [finishNodeDrag, nodeDrag, updateNodeDragAt]);

  useEffect(() => {
    if (!nodeResize) return;
    const handleMove = (event: globalThis.PointerEvent) => updateNodeResizeAt(event.clientX, event.clientY);
    const handleUp = () => finishNodeResize();
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [finishNodeResize, nodeResize, updateNodeResizeAt]);

  const consumeSuppressedClick = useCallback(() => {
    if (!suppressNextClickRef.current) return false;
    suppressNextClickRef.current = false;
    return true;
  }, []);

  return {
    activeSelectedNodeId,
    consumeSuppressedClick,
    displayNodes,
    draggedNodeId: nodeDrag?.moved ? nodeDrag.nodeId : undefined,
    railRef,
    resizingNodeId: nodeResize?.nodeId,
    setSelectedNodeId,
    startNodeDrag,
    startNodeResize,
    undoNodeLayoutChange,
    updateNodeDrag: (event: PointerEvent<HTMLElement>) => updateNodeDragAt(event.clientX, event.clientY),
    redoNodeLayoutChange,
    finishNodeDrag,
  };
}
