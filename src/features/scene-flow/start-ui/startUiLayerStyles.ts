import type { CSSProperties } from "react";
import type { GameStartUiLayer } from "../../../types";

export function startUiLayerStyle(layer: GameStartUiLayer, designWidth: number, designHeight: number): CSSProperties {
  return {
    height: `${layer.height / designHeight * 100}%`,
    left: `${layer.x / designWidth * 100}%`,
    opacity: layer.opacity,
    top: `${layer.y / designHeight * 100}%`,
    width: `${layer.width / designWidth * 100}%`,
    zIndex: layer.zIndex,
  };
}

export function startUiLayerCropStyle(layer: GameStartUiLayer, designWidth: number, designHeight: number): CSSProperties {
  const sourceWidth = Math.max(1, layer.sourceWidth || layer.width);
  const sourceHeight = Math.max(1, layer.sourceHeight || layer.height);
  const positionX = designWidth === sourceWidth ? 0 : ((layer.sourceX || 0) / (designWidth - sourceWidth)) * 100;
  const positionY = designHeight === sourceHeight ? 0 : ((layer.sourceY || 0) / (designHeight - sourceHeight)) * 100;
  return {
    backgroundImage: layer.imageUrl ? `url("${layer.imageUrl}")` : undefined,
    backgroundPosition: `${positionX}% ${positionY}%`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${designWidth / sourceWidth * 100}% ${designHeight / sourceHeight * 100}%`,
  };
}
