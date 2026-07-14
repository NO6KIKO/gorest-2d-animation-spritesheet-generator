import type { CSSProperties } from "react";
import type { GameFlowConnection, GameFlowConnectionKind } from "../../../types";
import { SCENE_NODE_HEIGHT_PERCENT } from "../model/geometry";
import type { SceneFlowConnectionDraft } from "../hooks/useSceneFlowConnections";
import type { SceneFlowNode, SceneFlowPoint } from "../types";

type SceneFlowConnectionsLayerProps = {
  connections: GameFlowConnection[];
  draft: SceneFlowConnectionDraft | null;
  nodes: SceneFlowNode[];
  onSelectConnection: (connectionId: string) => void;
  selectedConnectionId: string | null;
};

type ConnectionGeometry = {
  path: string;
  labelPoint: SceneFlowPoint;
};

const EDGE_COLORS: Record<GameFlowConnectionKind | "selected" | "draft", string> = {
  "scene-transition": "#385f73",
  "ui-navigation": "#4d7656",
  "ui-overlay": "#9a682f",
  selected: "#3448cf",
  draft: "#3448cf",
};

function nodePortPoint(node: SceneFlowNode, side: "input" | "output"): SceneFlowPoint {
  return {
    x: side === "output" ? node.x + node.width : node.x,
    y: node.y + SCENE_NODE_HEIGHT_PERCENT / 2,
  };
}

function cubicPoint(
  start: SceneFlowPoint,
  controlOne: SceneFlowPoint,
  controlTwo: SceneFlowPoint,
  end: SceneFlowPoint,
  t: number,
): SceneFlowPoint {
  const inverse = 1 - t;
  return {
    x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * controlOne.x + 3 * inverse * t ** 2 * controlTwo.x + t ** 3 * end.x,
    y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * controlOne.y + 3 * inverse * t ** 2 * controlTwo.y + t ** 3 * end.y,
  };
}

function connectionGeometry(start: SceneFlowPoint, end: SceneFlowPoint, laneOffset = 0): ConnectionGeometry {
  const distance = Math.abs(end.x - start.x);
  const curve = Math.min(18, Math.max(4, distance * 0.45));
  const controlOne = { x: start.x + curve, y: start.y + laneOffset };
  const controlTwo = { x: end.x - curve, y: end.y + laneOffset };
  return {
    path: `M ${start.x} ${start.y} C ${controlOne.x} ${controlOne.y}, ${controlTwo.x} ${controlTwo.y}, ${end.x} ${end.y}`,
    labelPoint: cubicPoint(start, controlOne, controlTwo, end, 0.5),
  };
}

function edgeLabelStyle(point: SceneFlowPoint): CSSProperties {
  return {
    left: `${point.x}%`,
    top: `${point.y}%`,
  };
}

export function SceneFlowConnectionsLayer({
  connections,
  draft,
  nodes,
  onSelectConnection,
  selectedConnectionId,
}: SceneFlowConnectionsLayerProps) {
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const validConnections = connections.filter(connection => (
    nodeById.has(connection.sourceNodeId) && nodeById.has(connection.targetNodeId)
  ));
  const pairGroups = new Map<string, string[]>();
  for (const connection of validConnections) {
    const pairKey = `${connection.sourceNodeId}\u0000${connection.targetNodeId}`;
    pairGroups.set(pairKey, [...(pairGroups.get(pairKey) || []), connection.id]);
  }
  const geometries = validConnections.map(connection => {
    const source = nodeById.get(connection.sourceNodeId)!;
    const target = nodeById.get(connection.targetNodeId)!;
    const pairIds = pairGroups.get(`${connection.sourceNodeId}\u0000${connection.targetNodeId}`) || [];
    const pairIndex = pairIds.indexOf(connection.id);
    const laneOffset = (pairIndex - (pairIds.length - 1) / 2) * 2.2;
    return {
      connection,
      geometry: connectionGeometry(nodePortPoint(source, "output"), nodePortPoint(target, "input"), laneOffset),
    };
  });
  const draftSource = draft ? nodeById.get(draft.sourceNodeId) : undefined;
  const draftGeometry = draft && draftSource
    ? connectionGeometry(nodePortPoint(draftSource, "output"), draft.pointer)
    : null;

  return (
    <div className="scene-flow-connections" aria-label="Scene flow connections">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          {Object.entries(EDGE_COLORS).map(([id, color]) => (
            <marker
              key={id}
              id={`scene-flow-arrow-${id}`}
              markerHeight="7"
              markerUnits="strokeWidth"
              markerWidth="7"
              orient="auto"
              refX="6"
              refY="3.5"
              viewBox="0 0 7 7"
            >
              <path d="M 0 0 L 7 3.5 L 0 7 z" fill={color} />
            </marker>
          ))}
        </defs>
        {geometries.map(({ connection, geometry }) => {
          const isSelected = selectedConnectionId === connection.id;
          const marker = isSelected ? "selected" : connection.kind;
          return (
            <g key={connection.id}>
              <path
                className="scene-flow-edge-hit"
                d={geometry.path}
                onPointerDown={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  onSelectConnection(connection.id);
                }}
              />
              <path
                className={`scene-flow-edge ${connection.kind} ${isSelected ? "selected" : ""}`}
                d={geometry.path}
                markerEnd={`url(#scene-flow-arrow-${marker})`}
              />
            </g>
          );
        })}
        {draftGeometry && (
          <path
            className={`scene-flow-edge draft ${draft?.targetNodeId ? "valid" : ""}`}
            d={draftGeometry.path}
            markerEnd="url(#scene-flow-arrow-draft)"
          />
        )}
      </svg>

      <div className="scene-flow-edge-labels">
        {geometries.map(({ connection, geometry }) => (
          <button
            key={connection.id}
            type="button"
            className={`scene-flow-edge-label ${connection.kind} ${selectedConnectionId === connection.id ? "selected" : ""}`}
            style={edgeLabelStyle(geometry.labelPoint)}
            title={`${connection.label}: ${connection.sourceNodeId} to ${connection.targetNodeId}`}
            onPointerDown={event => event.stopPropagation()}
            onClick={() => onSelectConnection(connection.id)}
          >
            {connection.label}
          </button>
        ))}
      </div>
    </div>
  );
}
