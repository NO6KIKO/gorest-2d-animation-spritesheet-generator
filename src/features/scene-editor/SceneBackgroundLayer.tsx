import type { MouseEvent, PointerEvent } from "react";
import type { SceneInteractionLightEntry } from "./SceneStageEnvironment";
import type { GameScene, SceneLayer } from "../../types";

type ResizeHandle = "nw" | "ne" | "sw" | "se";

type SceneBackgroundLayerProps = {
  backgroundLayer: SceneLayer;
  filter: string;
  interactionLights?: Array<SceneInteractionLightEntry | null>;
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

function hexToRgb(hex = "#ffffff") {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!match) return { r: 255, g: 255, b: 255 };
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

export function SceneBackgroundLayer({
  backgroundLayer,
  filter,
  interactionLights = [],
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
  const top = (backgroundLayer.y - (scene.cameraY || 0) * (backgroundLayer.parallax ?? 1)) * stageScaleY - height;
  const backgroundImageStyle = backgroundLayer.imageUrl ? {
    backgroundImage: `url("${backgroundLayer.imageUrl}")`,
    backgroundSize: backgroundSizeForFit(backgroundLayer.fit),
    backgroundRepeat: backgroundLayer.fit === "tile" ? "repeat" : "no-repeat",
    backgroundPosition: backgroundLayer.position || "center center",
  } : undefined;

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
            style={backgroundImageStyle}
          />
        ) : null}
      </div>
      {backgroundLayer.imageUrl && interactionLights.map(entry => {
        if (!entry) return null;
        const { bounds, interaction, layer } = entry;
        const lightLeft = (bounds.left - scene.cameraX * (layer.parallax ?? 1)) * stageScaleX;
        const lightTop = (bounds.top - (scene.cameraY || 0) * (layer.parallax ?? 1)) * stageScaleY;
        const lightWidth = bounds.width * stageScaleX;
        const lightHeight = bounds.height * stageScaleY;
        const color = hexToRgb(interaction.lightColor || "#f4d38a");
        const intensity = Math.max(0, Math.min(1.4, interaction.lightIntensity ?? 0.65));
        const falloff = Math.max(0.35, Math.min(0.95, interaction.lightFalloff ?? 0.78));
        const softStop = Math.round(falloff * 100);
        const coreStop = Math.round(Math.max(22, softStop * 0.58));
        const maskShape = interaction.zoneShape === "circle" ? "circle" : "ellipse";
        const maskImage = `radial-gradient(${maskShape} at 50% 50%, #000 0%, #000 ${coreStop}%, rgba(0, 0, 0, .78) ${softStop}%, transparent 100%)`;
        const flicker = Math.max(0, Math.min(1, interaction.lightFlicker || 0));

        return (
          <div
            key={`background-lightmap-${layer.id}`}
            className={`scene-background-lightmap ${interaction.zoneShape === "circle" ? "circle" : "rect"} ${flicker ? "flicker" : ""}`}
            style={{
              left: lightLeft,
              top: lightTop,
              width: lightWidth,
              height: lightHeight,
              zIndex: Math.max(backgroundLayer.zIndex + 8, 8),
              opacity: Math.min(1, 0.34 + intensity * 0.5),
              maskImage,
              WebkitMaskImage: maskImage,
              ["--light-color" as string]: `${color.r}, ${color.g}, ${color.b}`,
              ["--lightmap-brightness" as string]: `${1.32 + intensity * 0.74}`,
              ["--lightmap-contrast" as string]: `${1.02 + intensity * 0.14}`,
              ["--lightmap-saturation" as string]: `${1.02 + intensity * 0.18}`,
              ["--light-flicker-opacity" as string]: `${Math.max(0.42, 0.34 + intensity * 0.5 - flicker * 0.18)}`,
            }}
          >
            <div
              className="scene-background-lightmap-fill"
              style={{
                ...backgroundImageStyle,
                left: left - lightLeft,
                top: top - lightTop,
                width,
                height,
              }}
            />
          </div>
        );
      })}
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
