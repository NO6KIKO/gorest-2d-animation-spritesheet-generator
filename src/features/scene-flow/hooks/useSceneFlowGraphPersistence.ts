import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { normalizeGameFlowGraph } from "../../../domain/scene/sceneFlowGraph";
import { saveGameFlowGraph } from "../../../services/gameLibraryApi";
import type { GameFlowConnection, GameFlowGraph, GameFlowNodeLayout } from "../../../types";

type UseSceneFlowGraphPersistenceOptions = {
  flowGraph: GameFlowGraph;
  setError: Dispatch<SetStateAction<string | null>>;
  setFlowGraph: Dispatch<SetStateAction<GameFlowGraph>>;
};

export function useSceneFlowGraphPersistence({
  flowGraph,
  setError,
  setFlowGraph,
}: UseSceneFlowGraphPersistenceOptions) {
  const saveRevisionRef = useRef(0);
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  const persistFlowGraph = useCallback(async (nextGraph: GameFlowGraph) => {
    const revision = saveRevisionRef.current + 1;
    saveRevisionRef.current = revision;
    const normalizedGraph = normalizeGameFlowGraph({
      ...nextGraph,
      updatedTime: new Date().toISOString(),
    });
    setFlowGraph(normalizedGraph);
    setError(null);
    try {
      const request = saveQueueRef.current.then(() => saveGameFlowGraph(normalizedGraph));
      saveQueueRef.current = request.catch(() => undefined);
      const data = await request;
      if (saveRevisionRef.current !== revision) return;
      setFlowGraph(normalizeGameFlowGraph(data.flowGraph || data.library.flowGraph || normalizedGraph));
    } catch (error: any) {
      if (saveRevisionRef.current !== revision) return;
      setError(error.message || "Failed to save scene flow");
    }
  }, [setError, setFlowGraph]);

  const updateFlowConnections = useCallback((connections: GameFlowConnection[]) => {
    return persistFlowGraph({ ...flowGraph, connections });
  }, [flowGraph, persistFlowGraph]);

  const updateFlowNodeLayouts = useCallback((nodeLayouts: Record<string, GameFlowNodeLayout>) => {
    return persistFlowGraph({ ...flowGraph, nodeLayouts });
  }, [flowGraph, persistFlowGraph]);

  return {
    updateFlowConnections,
    updateFlowNodeLayouts,
  };
}
