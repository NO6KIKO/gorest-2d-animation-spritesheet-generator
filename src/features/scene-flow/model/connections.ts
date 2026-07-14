import { defaultFlowConnectionLabel } from "../../../domain/scene/sceneFlowGraph";
import type {
  GameFlowConnection,
  GameFlowConnectionKind,
  GameFlowTriggerType,
} from "../../../types";
import type { SceneFlowNode } from "../types";

export const FLOW_CONNECTION_KIND_LABELS: Record<GameFlowConnectionKind, string> = {
  "scene-transition": "Scene transition",
  "ui-navigation": "UI navigation",
  "ui-overlay": "UI overlay",
};

export const FLOW_TRIGGER_LABELS: Record<GameFlowTriggerType, string> = {
  auto: "Automatic",
  interaction: "Interaction",
  button: "Button",
  system: "System",
};

export function connectionKindForNodes(source: SceneFlowNode, target: SceneFlowNode): GameFlowConnectionKind {
  if (source.kind !== "start-ui" && target.kind !== "start-ui") return "scene-transition";
  if (source.kind !== "start-ui" && target.kind === "start-ui") return "ui-overlay";
  return "ui-navigation";
}

export function connectionTriggerForKind(kind: GameFlowConnectionKind): GameFlowTriggerType {
  if (kind === "scene-transition") return "interaction";
  if (kind === "ui-overlay") return "system";
  return "button";
}

function nextConnectionLabel(
  kind: GameFlowConnectionKind,
  source: SceneFlowNode,
  existingConnections: GameFlowConnection[],
) {
  const baseLabel = source.kind === "start-ui" && kind === "ui-navigation"
    ? source.startUi?.primaryActionLabel || "Start"
    : defaultFlowConnectionLabel(kind);
  const duplicateCount = existingConnections.filter(connection => (
    connection.sourceNodeId === source.id && connection.label.startsWith(baseLabel)
  )).length;
  return duplicateCount ? `${baseLabel} ${duplicateCount + 1}` : baseLabel;
}

export function createSceneFlowConnection(
  source: SceneFlowNode,
  target: SceneFlowNode,
  existingConnections: GameFlowConnection[],
): GameFlowConnection {
  const kind = connectionKindForNodes(source, target);
  const now = Date.now();
  return {
    id: `flow_${now}_${Math.random().toString(36).slice(2, 8)}`,
    sourceNodeId: source.id,
    targetNodeId: target.id,
    kind,
    trigger: source.kind === "animation" && kind === "scene-transition"
      ? "auto"
      : connectionTriggerForKind(kind),
    label: nextConnectionLabel(kind, source, existingConnections),
    sourceRefId: source.kind === "start-ui" ? "primary-action" : undefined,
    pauseSource: kind === "ui-overlay",
    returnToSource: kind === "ui-overlay",
    updatedTime: new Date(now).toISOString(),
  };
}
