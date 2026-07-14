import { ArrowRight, DoorOpen, PanelTopOpen, PanelsTopLeft, Trash2, X } from "lucide-react";
import { startUiRuntimeActionOptions } from "../../../domain/scene/startUiRuntime";
import type { GameFlowConnection, GameFlowConnectionKind, GameFlowTriggerType } from "../../../types";
import {
  FLOW_CONNECTION_KIND_LABELS,
  FLOW_TRIGGER_LABELS,
  connectionTriggerForKind,
} from "../model/connections";
import type { SceneFlowNode } from "../types";

type SceneFlowConnectionInspectorProps = {
  connection: GameFlowConnection;
  onClose: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<GameFlowConnection>) => void;
  sourceNode?: SceneFlowNode;
  targetNode?: SceneFlowNode;
};

const KIND_OPTIONS: Array<{
  kind: GameFlowConnectionKind;
  icon: typeof DoorOpen;
}> = [
  { kind: "scene-transition", icon: DoorOpen },
  { kind: "ui-navigation", icon: PanelsTopLeft },
  { kind: "ui-overlay", icon: PanelTopOpen },
];

function kindIsAvailable(kind: GameFlowConnectionKind, sourceNode?: SceneFlowNode, targetNode?: SceneFlowNode) {
  if (kind === "scene-transition") return sourceNode?.kind !== "start-ui" && targetNode?.kind !== "start-ui";
  if (kind === "ui-overlay") return targetNode?.kind === "start-ui";
  return true;
}

export function SceneFlowConnectionInspector({
  connection,
  onClose,
  onDelete,
  onUpdate,
  sourceNode,
  targetNode,
}: SceneFlowConnectionInspectorProps) {
  const updateKind = (kind: GameFlowConnectionKind) => {
    onUpdate({
      kind,
      trigger: sourceNode?.kind === "animation" && kind === "scene-transition"
        ? "auto"
        : connectionTriggerForKind(kind),
      pauseSource: kind === "ui-overlay",
      returnToSource: kind === "ui-overlay",
    });
  };

  return (
    <aside className="scene-flow-connection-inspector" aria-label="Connection settings">
      <header>
        <div>
          <span>Connection</span>
          <strong>{connection.label}</strong>
        </div>
        <button type="button" className="icon-button" title="Close connection settings" onClick={onClose}>
          <X size={16} />
        </button>
      </header>

      <div className="scene-flow-connection-route">
        <strong>{sourceNode?.title || "Missing source"}</strong>
        <ArrowRight size={15} />
        <strong>{targetNode?.title || "Missing target"}</strong>
      </div>

      <section>
        <label>Relationship</label>
        <div className="scene-flow-relationship-segments" role="group" aria-label="Relationship type">
          {KIND_OPTIONS.map(({ kind, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              className={connection.kind === kind ? "active" : ""}
              disabled={!kindIsAvailable(kind, sourceNode, targetNode)}
              title={FLOW_CONNECTION_KIND_LABELS[kind]}
              onClick={() => updateKind(kind)}
            >
              <Icon size={15} />
              <span>{FLOW_CONNECTION_KIND_LABELS[kind]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="scene-flow-connection-fields">
        {sourceNode?.startUi && (
          <label>
            <span>Source action</span>
            <select
              value={connection.sourceRefId || "primary-action"}
              onChange={event => onUpdate({ sourceRefId: event.target.value })}
            >
              {startUiRuntimeActionOptions(sourceNode.startUi).map(action => (
                <option key={action.id} value={action.id}>{action.label}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>Label</span>
          <input
            key={`${connection.id}:${connection.label}`}
            type="text"
            defaultValue={connection.label}
            onBlur={event => {
              const label = event.currentTarget.value.trim();
              if (label && label !== connection.label) onUpdate({ label });
            }}
          />
        </label>
        <label>
          <span>Trigger</span>
          <select
            value={connection.trigger}
            onChange={event => onUpdate({ trigger: event.target.value as GameFlowTriggerType })}
          >
            {(Object.keys(FLOW_TRIGGER_LABELS) as GameFlowTriggerType[]).map(trigger => (
              <option key={trigger} value={trigger}>{FLOW_TRIGGER_LABELS[trigger]}</option>
            ))}
          </select>
        </label>
      </section>

      {connection.kind === "ui-overlay" && (
        <section className="scene-flow-overlay-options">
          <label>
            <input
              type="checkbox"
              checked={connection.pauseSource ?? true}
              onChange={event => onUpdate({ pauseSource: event.target.checked })}
            />
            <span>Pause source scene</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={connection.returnToSource ?? true}
              onChange={event => onUpdate({ returnToSource: event.target.checked })}
            />
            <span>Return when closed</span>
          </label>
        </section>
      )}

      <footer>
        <button type="button" className="danger-button" onClick={onDelete}>
          <Trash2 size={15} /> Delete connection
        </button>
      </footer>
    </aside>
  );
}
