import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type RefObject } from "react";
import type { GameFlowConnection } from "../../../types";
import { clampSceneFlowPercent } from "../model/geometry";
import { createSceneFlowConnection } from "../model/connections";
import type { SceneFlowNode, SceneFlowPoint } from "../types";

export type SceneFlowConnectionDraft = {
  pointer: SceneFlowPoint;
  sourceNodeId: string;
  targetNodeId?: string;
};

type UseSceneFlowConnectionsOptions = {
  connections: GameFlowConnection[];
  nodes: SceneFlowNode[];
  onConnectionsChange: (connections: GameFlowConnection[]) => void | Promise<void>;
  onStatus: (message: string) => void;
  railRef: RefObject<HTMLDivElement | null>;
};

export function useSceneFlowConnections({
  connections,
  nodes,
  onConnectionsChange,
  onStatus,
  railRef,
}: UseSceneFlowConnectionsOptions) {
  const [connectionDraft, setConnectionDraft] = useState<SceneFlowConnectionDraft | null>(null);
  const connectionDraftRef = useRef<SceneFlowConnectionDraft | null>(null);
  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const nodeById = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);
  const selectedConnection = useMemo(
    () => connections.find(connection => connection.id === selectedConnectionId),
    [connections, selectedConnectionId],
  );

  const pointFromClient = useCallback((clientX: number, clientY: number): SceneFlowPoint => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clampSceneFlowPercent(((clientX - rect.left) / Math.max(1, rect.width)) * 100),
      y: clampSceneFlowPercent(((clientY - rect.top) / Math.max(1, rect.height)) * 100),
    };
  }, [railRef]);

  const targetNodeAt = useCallback((clientX: number, clientY: number, sourceNodeId: string) => {
    const element = document.elementFromPoint(clientX, clientY);
    const nodeElement = element?.closest<HTMLElement>("[data-scene-node-id]");
    const targetNodeId = nodeElement?.dataset.sceneNodeId;
    if (!targetNodeId || targetNodeId === sourceNodeId) return undefined;
    const targetNode = nodeById.get(targetNodeId);
    return targetNode && !targetNode.isPlaceholder ? targetNode : undefined;
  }, [nodeById]);

  const startConnection = useCallback((event: PointerEvent<HTMLButtonElement>, sourceNode: SceneFlowNode) => {
    if (event.button !== 0 || sourceNode.isPlaceholder) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedConnectionId(null);
    const nextDraft = {
      pointer: pointFromClient(event.clientX, event.clientY),
      sourceNodeId: sourceNode.id,
    };
    connectionDraftRef.current = nextDraft;
    setConnectionDraft(nextDraft);
  }, [pointFromClient]);

  const finishConnection = useCallback((clientX: number, clientY: number) => {
    const currentDraft = connectionDraftRef.current;
    connectionDraftRef.current = null;
    setConnectionDraft(null);
    if (!currentDraft) return;
    const sourceNode = nodeById.get(currentDraft.sourceNodeId);
    const targetNode = targetNodeAt(clientX, clientY, currentDraft.sourceNodeId);
    if (!sourceNode || !targetNode) return;
    const currentConnections = connectionsRef.current;
    const nextConnection = createSceneFlowConnection(sourceNode, targetNode, currentConnections);
    setSelectedConnectionId(nextConnection.id);
    const nextConnections = [...currentConnections, nextConnection];
    connectionsRef.current = nextConnections;
    void onConnectionsChange(nextConnections);
    onStatus(`${sourceNode.title} connected to ${targetNode.title}.`);
  }, [nodeById, onConnectionsChange, onStatus, targetNodeAt]);

  const isConnecting = Boolean(connectionDraft);

  useEffect(() => {
    if (!isConnecting) return;
    const handleMove = (event: globalThis.PointerEvent) => {
      const currentDraft = connectionDraftRef.current;
      if (!currentDraft) return;
      const targetNode = targetNodeAt(event.clientX, event.clientY, currentDraft.sourceNodeId);
      const nextDraft = {
        ...currentDraft,
        pointer: pointFromClient(event.clientX, event.clientY),
        targetNodeId: targetNode?.id,
      };
      connectionDraftRef.current = nextDraft;
      setConnectionDraft(nextDraft);
    };
    const handleUp = (event: globalThis.PointerEvent) => finishConnection(event.clientX, event.clientY);
    const handleCancel = () => {
      connectionDraftRef.current = null;
      setConnectionDraft(null);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
    };
  }, [finishConnection, isConnecting, pointFromClient, targetNodeAt]);

  useEffect(() => {
    if (selectedConnectionId && !connections.some(connection => connection.id === selectedConnectionId)) {
      setSelectedConnectionId(null);
    }
  }, [connections, selectedConnectionId]);

  const updateConnection = useCallback((connectionId: string, patch: Partial<GameFlowConnection>) => {
    const nextConnections = connectionsRef.current.map(connection => connection.id === connectionId
      ? { ...connection, ...patch, id: connection.id, updatedTime: new Date().toISOString() }
      : connection);
    connectionsRef.current = nextConnections;
    void onConnectionsChange(nextConnections);
  }, [onConnectionsChange]);

  const deleteConnection = useCallback((connectionId = selectedConnectionId) => {
    if (!connectionId) return;
    const connection = connectionsRef.current.find(item => item.id === connectionId);
    const nextConnections = connectionsRef.current.filter(item => item.id !== connectionId);
    connectionsRef.current = nextConnections;
    void onConnectionsChange(nextConnections);
    setSelectedConnectionId(null);
    if (connection) onStatus(`Connection removed: ${connection.label}.`);
  }, [onConnectionsChange, onStatus, selectedConnectionId]);

  const cancelConnection = useCallback(() => {
    connectionDraftRef.current = null;
    setConnectionDraft(null);
  }, []);

  return {
    cancelConnection,
    connectionDraft,
    deleteConnection,
    selectedConnection,
    selectedConnectionId,
    setSelectedConnectionId,
    startConnection,
    updateConnection,
  };
}
