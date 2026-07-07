import { type CSSProperties, type Key, type MouseEvent, type PointerEvent } from "react";
import type { SceneFlowNode } from "../types";

type SceneFlowNodeCardProps = {
  isMoving: boolean;
  isSelected: boolean;
  isResizing: boolean;
  key?: Key;
  node: SceneFlowNode;
  onConsumeSuppressedClick: () => boolean;
  onContextMenu: (event: MouseEvent<HTMLElement>, node: SceneFlowNode) => void;
  onOpen: (node: SceneFlowNode) => void;
  onSelect: (nodeId: string) => void;
  onStartNodeDrag: (event: PointerEvent<HTMLElement>, node: SceneFlowNode) => void;
  onStartResize: (event: PointerEvent<HTMLButtonElement>, node: SceneFlowNode, edge: "left" | "right") => void;
};

function previewLayerStyle(node: SceneFlowNode, layer: NonNullable<SceneFlowNode["previewLayers"]>[number]): CSSProperties {
  const previewWidth = Math.max(1, node.previewWidth || 1);
  const previewHeight = Math.max(1, node.previewHeight || 1);
  return {
    height: `${layer.height / previewHeight * 100}%`,
    left: `${layer.x / previewWidth * 100}%`,
    opacity: layer.opacity,
    top: `${layer.y / previewHeight * 100}%`,
    width: `${layer.width / previewWidth * 100}%`,
    zIndex: layer.zIndex,
  };
}

function previewLayerBackgroundStyle(node: SceneFlowNode, layer: NonNullable<SceneFlowNode["previewLayers"]>[number]): CSSProperties {
  const previewWidth = Math.max(1, node.previewWidth || 1);
  const previewHeight = Math.max(1, node.previewHeight || 1);
  const sourceWidth = Math.max(1, layer.sourceWidth || layer.width);
  const sourceHeight = Math.max(1, layer.sourceHeight || layer.height);
  const positionX = previewWidth === sourceWidth ? 0 : ((layer.sourceX || 0) / (previewWidth - sourceWidth)) * 100;
  const positionY = previewHeight === sourceHeight ? 0 : ((layer.sourceY || 0) / (previewHeight - sourceHeight)) * 100;
  return {
    backgroundImage: layer.imageUrl ? `url("${layer.imageUrl}")` : undefined,
    backgroundPosition: `${positionX}% ${positionY}%`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${previewWidth / sourceWidth * 100}% ${previewHeight / sourceHeight * 100}%`,
  };
}

export function SceneFlowNodeCard({
  isMoving,
  isSelected,
  isResizing,
  node,
  onConsumeSuppressedClick,
  onContextMenu,
  onOpen,
  onSelect,
  onStartNodeDrag,
  onStartResize,
}: SceneFlowNodeCardProps) {
  return (
    <article
      className={[
        "scene-flow-node",
        node.kind === "start-ui" ? "start-ui" : "",
        isSelected ? "selected" : "",
        node.isCurrent ? "current" : "",
        node.isPlaceholder ? "placeholder" : "",
        isMoving ? "moving" : "",
        isResizing ? "resizing" : "",
      ].filter(Boolean).join(" ")}
      data-scene-node-id={node.id}
      style={{ left: `${node.x}%`, top: `${node.y}%`, width: `${node.width}%` }}
      onContextMenu={event => onContextMenu(event, node)}
    >
      <button
        type="button"
        className="scene-flow-open"
        onPointerDown={event => onStartNodeDrag(event, node)}
        onClick={event => {
          if (onConsumeSuppressedClick()) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onSelect(node.id);
        }}
        onDoubleClick={() => {
          if (onConsumeSuppressedClick()) return;
          onSelect(node.id);
          onOpen(node);
        }}
      >
        <span
          className={`scene-node-preview ${node.previewLayers?.length ? "layered" : ""}`}
          style={{
            backgroundImage: !node.previewLayers?.length && node.thumbnail ? `url("${node.thumbnail}")` : undefined,
            backgroundColor: node.backgroundColor,
          }}
        >
          {Boolean(node.previewLayers?.length) && (
            <span className="scene-node-preview-layer-stage">
              {node.previewLayers?.map(layer => (
                layer.imageUrl ? (
                  <span
                    key={layer.id}
                    aria-hidden="true"
                    className={`scene-node-preview-layer ${layer.sourceWidth ? "cropped" : ""}`}
                    style={{
                      ...previewLayerStyle(node, layer),
                      ...(layer.sourceWidth ? previewLayerBackgroundStyle(node, layer) : {}),
                    }}
                  >
                    {!layer.sourceWidth && <img alt="" draggable={false} src={layer.imageUrl} />}
                  </span>
                ) : (
                  <span
                    key={layer.id}
                    className={`scene-node-preview-layer text-layer ${layer.kind || ""}`}
                    style={previewLayerStyle(node, layer)}
                  >
                    {layer.label}
                  </span>
                )
              ))}
            </span>
          )}
        </span>
        <strong>{node.title}</strong>
        <span>{node.subtitle}</span>
      </button>

      <button
        type="button"
        className="scene-node-resize-handle left"
        aria-label="Resize scene width from left"
        onPointerDown={event => onStartResize(event, node, "left")}
      />
      <button
        type="button"
        className="scene-node-resize-handle right"
        aria-label="Resize scene width from right"
        onPointerDown={event => onStartResize(event, node, "right")}
      />
    </article>
  );
}
