import type {
  GameFlowConnection,
  GameFlowConnectionKind,
  GameFlowGraph,
  GameFlowNodeLayout,
  GameFlowTriggerType,
  GameScene,
  GameStartUiSettings,
} from "../../types";

const CONNECTION_KINDS: GameFlowConnectionKind[] = ["scene-transition", "ui-navigation", "ui-overlay"];
const TRIGGER_TYPES: GameFlowTriggerType[] = ["auto", "interaction", "button", "system"];

function finiteNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeNodeLayouts(layouts: unknown): Record<string, GameFlowNodeLayout> {
  if (!layouts || typeof layouts !== "object" || Array.isArray(layouts)) return {};
  return Object.fromEntries(Object.entries(layouts).flatMap(([nodeId, rawLayout]) => {
    if (!rawLayout || typeof rawLayout !== "object" || Array.isArray(rawLayout)) return [];
    const layout = rawLayout as Partial<GameFlowNodeLayout>;
    return [[nodeId, {
      x: finiteNumber(layout.x, 0),
      y: finiteNumber(layout.y, 0),
      width: finiteNumber(layout.width, 9),
    }]];
  }));
}

function normalizeConnection(connection: Partial<GameFlowConnection>, index: number): GameFlowConnection | null {
  if (!connection.sourceNodeId || !connection.targetNodeId) return null;
  const kind = CONNECTION_KINDS.includes(connection.kind as GameFlowConnectionKind)
    ? connection.kind as GameFlowConnectionKind
    : "scene-transition";
  const trigger = TRIGGER_TYPES.includes(connection.trigger as GameFlowTriggerType)
    ? connection.trigger as GameFlowTriggerType
    : kind === "scene-transition" ? "interaction" : "button";
  return {
    id: connection.id || `flow_connection_${index + 1}`,
    sourceNodeId: connection.sourceNodeId,
    targetNodeId: connection.targetNodeId,
    kind,
    trigger,
    label: connection.label?.trim() || defaultFlowConnectionLabel(kind),
    sourceRefId: connection.sourceRefId,
    pauseSource: connection.pauseSource ?? kind === "ui-overlay",
    returnToSource: connection.returnToSource ?? kind === "ui-overlay",
    updatedTime: connection.updatedTime,
  };
}

export function defaultFlowConnectionLabel(kind: GameFlowConnectionKind) {
  if (kind === "ui-navigation") return "Open";
  if (kind === "ui-overlay") return "Open UI";
  return "Enter";
}

export function createEmptyGameFlowGraph(): GameFlowGraph {
  return {
    version: 1,
    connections: [],
    nodeLayouts: {},
  };
}

export function normalizeGameFlowGraph(graph?: Partial<GameFlowGraph> | null): GameFlowGraph {
  const connections = Array.isArray(graph?.connections)
    ? graph.connections
      .map(normalizeConnection)
      .filter((connection): connection is GameFlowConnection => Boolean(connection))
    : [];
  return {
    version: 1,
    connections,
    nodeLayouts: normalizeNodeLayouts(graph?.nodeLayouts),
    updatedTime: graph?.updatedTime,
  };
}

export function removeNodeFromGameFlowGraph(graph: GameFlowGraph, nodeId: string): GameFlowGraph {
  const normalizedGraph = normalizeGameFlowGraph(graph);
  const nodeLayouts = { ...normalizedGraph.nodeLayouts };
  delete nodeLayouts[nodeId];
  return {
    ...normalizedGraph,
    connections: normalizedGraph.connections.filter(connection => (
      connection.sourceNodeId !== nodeId && connection.targetNodeId !== nodeId
    )),
    nodeLayouts,
  };
}

export function inferGameFlowGraph(
  scenes: GameScene[],
  startUis: GameStartUiSettings[],
): GameFlowGraph {
  const validSceneIds = new Set(scenes.map(scene => scene.id));
  const connections: GameFlowConnection[] = [];

  for (const startUi of startUis) {
    if (!startUi.initialSceneId || !validSceneIds.has(startUi.initialSceneId)) continue;
    connections.push({
      id: `flow_entry_${startUi.id}_${startUi.initialSceneId}`,
      sourceNodeId: startUi.id,
      targetNodeId: startUi.initialSceneId,
      kind: "ui-navigation",
      trigger: "button",
      label: startUi.primaryActionLabel || "Start",
      sourceRefId: "primary-action",
    });
  }

  for (const scene of scenes) {
    for (const layer of scene.layers || []) {
      const interaction = layer.interaction;
      if (!interaction?.enabled || interaction.actionType !== "scene-link" || !interaction.targetSceneId) continue;
      if (!validSceneIds.has(interaction.targetSceneId)) continue;
      connections.push({
        id: `flow_scene_${scene.id}_${layer.id}_${interaction.targetSceneId}`,
        sourceNodeId: scene.id,
        targetNodeId: interaction.targetSceneId,
        kind: "scene-transition",
        trigger: interaction.triggerMode === "auto" ? "auto" : "interaction",
        label: interaction.promptText || layer.name || "Enter",
        sourceRefId: layer.id,
      });
    }
  }

  return {
    version: 1,
    connections,
    nodeLayouts: {},
  };
}
