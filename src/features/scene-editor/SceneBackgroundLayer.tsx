import type { MouseEvent, PointerEvent } from "react";
import type { GameScene, SceneLayer } from "../../types";

type ResizeHandle = "nw" | "ne" | "sw" | "se";

type SceneBackgroundLayerProps = {
  backgroundLayer: SceneLayer;
  filter: string;
  scene: GameScene;
  selectedLayerId: string;
  spriteStageScale: number;
  stageScaleX: number;
  stageScaleY: number;
  onOpenContextMenu: (event: MouseEvent<HTMLElement>, layer: SceneLayer) => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement>, layer: SceneLayer) => void;
  onResizeStart: (
    event: PointerEvent<HTMLSpanElement>,
    layer: SceneLayer,
    assetWidth: number,
    assetHeight: number,
    handle: ResizeHandle
  ) => void;
  onSelectLayer: (layerId: string) => void;
};

function backgroundSizeForFit(fit?: SceneLayer["fit"]) {
  if (fit === "contain") return "contain";
  if (fit === "stretch") return "100% 100%";
  if (fit === "tile") return "auto";
  return "cover";
}

export function SceneBackgroundLayer({
  backgroundLayer,
  filter,
  scene,
  selectedLayerId,
  spriteStageScale,
  stageScaleX,
  stageScaleY,
  onOpenContextMenu,
  onPointerDown,
  onResizeStart,
  onSelectLayer,
}: SceneBackgroundLayerProps) {
  const baseWidth = backgroundLayer.width || scene.width;
  const baseHeight = backgroundLayer.height || scene.height;
  const width = baseWidth * backgroundLayer.scale * spriteStageScale;
  const height = baseHeight * backgroundLayer.scale * spriteStageScale;
  const left = (backgroundLayer.x - scene.cameraX * (backgroundLayer.parallax ?? 1)) * stageScaleX;
  const top = backgroundLayer.y * stageScaleY - height;

  return (
    <>
      <div
        className="scene-image-background"
        style={{
          left,
          top,
          width,
          height,
          opacity: backgroundLayer.opacity,
          zIndex: backgroundLayer.zIndex,
          filter,
          backgroundColor: backgroundLayer.imageUrl ? (backgroundLayer.color || "#08070d") : "#000",
        }}
      >
        {backgroundLayer.imageUrl ? (
          <div
            className="scene-image-background-fill"
            style={{
              backgroundImage: `url("${backgroundLayer.imageUrl}")`,
              backgroundSize: backgroundSizeForFit(backgroundLayer.fit),
              backgroundRepeat: backgroundLayer.fit === "tile" ? "repeat" : "no-repeat",
              backgroundPosition: backgroundLayer.position || "center center",
            }}
          />
        ) : null}
      </div>
      {!backgroundLayer.locked && (
        <div
          className={backgroundLayer.id === selectedLayerId ? "scene-background-transform selected" : "scene-background-transform"}
          style={{
            left,
            top,
            width,
            height,
            zIndex: Math.max(backgroundLayer.zIndex + 2, 2),
          }}
          onPointerDown={event => onPointerDown(event, backgroundLayer)}
          onClick={event => {
            event.stopPropagation();
            onSelectLayer(backgroundLayer.id);
          }}
          onContextMenu={event => onOpenContextMenu(event, backgroundLayer)}
        >
          {backgroundLayer.id === selectedLayerId && (
            <>
              <span className="scene-background-label">Background</span>
              <span className="resize-handle nw" title="Drag to resize background" onPointerDown={event => onResizeStart(event, backgroundLayer, baseWidth, baseHeight, "nw")} />
              <span className="resize-handle ne" title="Drag to resize background" onPointerDown={event => onResizeStart(event, backgroundLayer, baseWidth, baseHeight, "ne")} />
              <span className="resize-handle sw" title="Drag to resize background" onPointerDown={event => onResizeStart(event, backgroundLayer, baseWidth, baseHeight, "sw")} />
              <span className="resize-handle se" title="Drag to resize background" onPointerDown={event => onResizeStart(event, backgroundLayer, baseWidth, baseHeight, "se")} />
            </>
          )}
        </div>
      )}
    </>
  );
}
