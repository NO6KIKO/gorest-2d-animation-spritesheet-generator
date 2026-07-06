import type { MouseEvent, PointerEvent, ReactNode, Ref } from "react";
import type { SceneLayer } from "../../types";

export type SceneCameraVisualEffect = {
  durationMs: number;
  id: number;
  shakeIntensity?: number;
  type: "shake" | "zoom";
  zoom?: number;
};

type SceneStageCanvasProps = {
  backgroundLayer?: SceneLayer;
  cameraEffect?: SceneCameraVisualEffect | null;
  children: ReactNode;
  controls: ReactNode;
  controlsSpace: number;
  hasVisibleBackgroundImage: boolean;
  shellRef: Ref<HTMLDivElement>;
  stageHeight: number;
  stageRef: Ref<HTMLDivElement>;
  stageWidth: number;
  viewportHeight: number;
  viewportWidth: number;
  onClearSelection: () => void;
  onOpenBackgroundContextMenu: (event: MouseEvent<HTMLElement>, layer: SceneLayer) => void;
  onPointerEnd: () => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
};

export function SceneStageCanvas({
  backgroundLayer,
  cameraEffect,
  children,
  controls,
  controlsSpace,
  hasVisibleBackgroundImage,
  shellRef,
  stageHeight,
  stageRef,
  stageWidth,
  viewportHeight,
  viewportWidth,
  onClearSelection,
  onOpenBackgroundContextMenu,
  onPointerEnd,
  onPointerMove,
}: SceneStageCanvasProps) {
  return (
    <div
      ref={shellRef}
      className="scene-stage-shell"
      style={{ ["--scene-global-controls-space" as string]: `${controlsSpace}px` }}
    >
      <div
        ref={stageRef}
        className={`side-scroller-stage ${cameraEffect ? `camera-effect ${cameraEffect.type} camera-effect-${cameraEffect.id}` : ""}`}
        style={{
          width: stageWidth,
          height: stageHeight,
          aspectRatio: `${viewportWidth} / ${viewportHeight}`,
          background: hasVisibleBackgroundImage ? undefined : "#000",
          ["--camera-effect-duration" as string]: `${cameraEffect?.durationMs ?? 0}ms`,
          ["--camera-effect-zoom" as string]: cameraEffect?.zoom ?? 1.12,
          ["--camera-shake-distance" as string]: `${cameraEffect?.shakeIntensity ?? 8}px`,
        }}
        onClick={event => {
          const target = event.target as HTMLElement;
          if (!target.closest(".scene-sprite") && !target.closest(".scene-background-transform") && !target.closest(".interaction-zone-outline")) {
            onClearSelection();
          }
        }}
        onContextMenu={event => {
          const target = event.target as HTMLElement;
          if (target.closest(".scene-sprite") || target.closest(".scene-background-transform") || target.closest(".interaction-zone-outline")) return;
          if (backgroundLayer) onOpenBackgroundContextMenu(event, backgroundLayer);
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerLeave={onPointerEnd}
      >
        {children}
      </div>
      {controls}
    </div>
  );
}
