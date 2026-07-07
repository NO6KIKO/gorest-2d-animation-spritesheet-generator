import { CheckCircle2, Clipboard, Copy, Monitor, Plus, Scissors, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import type { GameScene, GameStartUiSettings } from "../../../types";
import { useSceneFlowLayout } from "../hooks/useSceneFlowLayout";
import type { SceneFlowNode } from "../types";
import { SceneFlowNodeCard } from "./SceneFlowNodeCard";

type SceneFlowCanvasProps = {
  nodes: SceneFlowNode[];
  onCreateScene: () => void | Promise<void>;
  onCreateStartUi: () => GameStartUiSettings | void | Promise<GameStartUiSettings | void>;
  onDeleteScene: (node: SceneFlowNode) => void | Promise<void>;
  onDeleteStartUi: (settings: GameStartUiSettings) => void | Promise<void>;
  onDuplicateScene: (node: SceneFlowNode) => void | Promise<void>;
  onDuplicateStartUi: (settings: GameStartUiSettings) => void | Promise<void>;
  onOpenScene: (node: SceneFlowNode) => void;
  onOpenStartUi: (settings: GameStartUiSettings) => void;
  onPasteScene: (scene: GameScene) => void | Promise<void>;
  onSaveCurrent: () => void;
  onStatus: (message: string) => void;
};

type SceneFlowContextMenu = {
  x: number;
  y: number;
  nodeId?: string;
};

function cloneScene(scene: GameScene) {
  if (typeof structuredClone === "function") return structuredClone(scene);
  return JSON.parse(JSON.stringify(scene)) as GameScene;
}

function isEditingTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element?.closest("input, textarea, select, [contenteditable='true']"));
}

export function SceneFlowCanvas({
  nodes,
  onCreateScene,
  onCreateStartUi,
  onDeleteScene,
  onDeleteStartUi,
  onDuplicateScene,
  onDuplicateStartUi,
  onOpenScene,
  onOpenStartUi,
  onPasteScene,
  onSaveCurrent,
  onStatus,
}: SceneFlowCanvasProps) {
  const [sceneClipboard, setSceneClipboard] = useState<GameScene | null>(null);
  const [contextMenu, setContextMenu] = useState<SceneFlowContextMenu | null>(null);
  const {
    activeSelectedNodeId,
    consumeSuppressedClick,
    displayNodes,
    draggedNodeId,
    finishNodeDrag,
    railRef,
    resizingNodeId,
    redoNodeLayoutChange,
    setSelectedNodeId,
    startNodeDrag,
    startNodeResize,
    undoNodeLayoutChange,
    updateNodeDrag,
  } = useSceneFlowLayout({
    nodes,
    onStatus,
  });
  const selectedNode = useMemo(
    () => displayNodes.find(node => node.id === activeSelectedNodeId),
    [activeSelectedNodeId, displayNodes],
  );
  const contextNode = contextMenu?.nodeId
    ? displayNodes.find(node => node.id === contextMenu.nodeId)
    : undefined;

  const copyNode = (node = selectedNode) => {
    if (!node?.scene || node.isPlaceholder) {
      onStatus("Select a scene to copy.");
      return;
    }
    setSceneClipboard(cloneScene(node.scene));
    onStatus(`Copied scene: ${node.title}`);
  };

  const cutNode = async (node = selectedNode) => {
    if (!node?.scene || node.isPlaceholder) {
      onStatus("Select a scene to cut.");
      return;
    }
    setSceneClipboard(cloneScene(node.scene));
    await onDeleteScene(node);
  };

  const pasteNode = async () => {
    if (!sceneClipboard) {
      onStatus("No copied scene to paste.");
      return;
    }
    await onPasteScene(cloneScene(sceneClipboard));
  };

  const duplicateNode = async (node = selectedNode) => {
    if (node?.startUi) {
      await onDuplicateStartUi(node.startUi);
      return;
    }
    if (!node?.scene || node.isPlaceholder) {
      onStatus("Select a scene to duplicate.");
      return;
    }
    await onDuplicateScene(node);
  };

  const deleteNode = async (node = selectedNode) => {
    if (node?.startUi) {
      await onDeleteStartUi(node.startUi);
      return;
    }
    if (!node?.scene || node.isPlaceholder) {
      onStatus("Select a scene to delete.");
      return;
    }
    await onDeleteScene(node);
  };

  const openNodeMenu = (event: MouseEvent<HTMLElement>, node: SceneFlowNode) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedNodeId(node.id);
    setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
  };

  const openNode = (node: SceneFlowNode) => {
    if (node.startUi) {
      onOpenStartUi(node.startUi);
      return;
    }
    onOpenScene(node);
  };

  const openStartUiEditor = async () => {
    const existingStartUiNode = displayNodes.find(node => node.startUi);
    if (existingStartUiNode?.startUi) {
      setSelectedNodeId(existingStartUiNode.id);
      onOpenStartUi(existingStartUiNode.startUi);
      return;
    }

    const createdStartUi = await onCreateStartUi();
    if (createdStartUi) {
      setSelectedNodeId(createdStartUi.id);
      onOpenStartUi(createdStartUi);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isEditingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const modifierPressed = event.ctrlKey || event.metaKey;
      const isUndo = modifierPressed && !event.altKey && key === "z" && !event.shiftKey;
      const isRedo = modifierPressed && !event.altKey && (key === "y" || (key === "z" && event.shiftKey));

      if (isUndo || isRedo) {
        event.preventDefault();
        event.stopPropagation();
        if (isUndo) undoNodeLayoutChange();
        if (isRedo) redoNodeLayoutChange();
        return;
      }

      if (modifierPressed && !event.altKey && !event.shiftKey && ["c", "x", "v", "d"].includes(key)) {
        event.preventDefault();
        event.stopPropagation();
        if (key === "c") copyNode();
        if (key === "x") void cutNode();
        if (key === "v") void pasteNode();
        if (key === "d") void duplicateNode();
        return;
      }

      if ((event.key === "Backspace" || event.key === "Delete") && selectedNode?.scene && !selectedNode.isPlaceholder) {
        event.preventDefault();
        event.stopPropagation();
        void deleteNode();
        return;
      }

      if ((event.key === "Backspace" || event.key === "Delete") && selectedNode?.startUi) {
        event.preventDefault();
        event.stopPropagation();
        void deleteNode();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [redoNodeLayoutChange, sceneClipboard, selectedNode, undoNodeLayoutChange]);

  useEffect(() => {
    if (!contextMenu) return;
    const closeMenu = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu]);

  return (
    <div className="scene-library">
      <div className="scene-flow-toolbar">
        <button type="button" className="primary-button" onClick={onSaveCurrent}>
          <CheckCircle2 size={16} /> Save Current
        </button>
        <button type="button" className="ghost-button" onClick={() => void onCreateScene()}>
          <Plus size={16} /> New Scene
        </button>
        <button type="button" className="ghost-button" onClick={() => void openStartUiEditor()}>
          <Monitor size={16} /> Start UI
        </button>
      </div>

      <div className="scene-flow-canvas">
        <div
          ref={railRef}
          className="scene-flow-rail"
          onContextMenu={event => {
            event.preventDefault();
            setContextMenu({ x: event.clientX, y: event.clientY });
          }}
          onPointerMoveCapture={updateNodeDrag}
          onPointerUpCapture={finishNodeDrag}
          onPointerCancelCapture={finishNodeDrag}
        >
          {displayNodes.map(node => (
            <SceneFlowNodeCard
              key={node.id}
              isMoving={draggedNodeId === node.id}
              isResizing={resizingNodeId === node.id}
              isSelected={activeSelectedNodeId === node.id}
              node={node}
              onConsumeSuppressedClick={consumeSuppressedClick}
              onContextMenu={openNodeMenu}
              onOpen={openNode}
              onSelect={setSelectedNodeId}
              onStartNodeDrag={startNodeDrag}
              onStartResize={startNodeResize}
            />
          ))}
        </div>

        {contextMenu && (
          <div
            className="scene-flow-context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onPointerDown={event => event.stopPropagation()}
          >
            <div className="scene-flow-context-title">
              {contextNode?.title || "2D Canvas"}
            </div>
            <button
              type="button"
              disabled={!contextNode?.scene || contextNode.isPlaceholder}
              onClick={() => {
                copyNode(contextNode);
                setContextMenu(null);
              }}
            >
              <Copy size={14} /> Copy <kbd>Ctrl C</kbd>
            </button>
            <button
              type="button"
              disabled={!contextNode?.scene || contextNode.isPlaceholder}
              onClick={() => {
                void cutNode(contextNode);
                setContextMenu(null);
              }}
            >
              <Scissors size={14} /> Cut <kbd>Ctrl X</kbd>
            </button>
            <button
              type="button"
              disabled={!sceneClipboard}
              onClick={() => {
                void pasteNode();
                setContextMenu(null);
              }}
            >
              <Clipboard size={14} /> Paste <kbd>Ctrl V</kbd>
            </button>
            <button
              type="button"
              disabled={!contextNode || contextNode.isPlaceholder || (!contextNode.scene && !contextNode.startUi)}
              onClick={() => {
                void duplicateNode(contextNode);
                setContextMenu(null);
              }}
            >
              <Copy size={14} /> Duplicate <kbd>Ctrl D</kbd>
            </button>
            <div className="scene-flow-context-separator" />
            <button
              type="button"
              className="danger"
              disabled={!contextNode || contextNode.isPlaceholder || (!contextNode.scene && !contextNode.startUi)}
              onClick={() => {
                void deleteNode(contextNode);
                setContextMenu(null);
              }}
            >
              <Trash2 size={14} /> Delete <kbd>Del</kbd>
            </button>
          </div>
        )}

        <div className="scene-flow-empty-note">
          {`${nodes.length} cards in this canvas`}
        </div>
      </div>

    </div>
  );
}
