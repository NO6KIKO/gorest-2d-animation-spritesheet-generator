import type { MouseEvent, PointerEvent, ReactNode, Ref } from "react";
import type { SceneLayer } from "../../types";

type SceneStageCanvasProps = {
  backgroundLayer?: SceneLayer;
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
        className="side-scroller-stage"
        style={{
          width: stageWidth,
          height: stageHeight,
          aspectRatio: `${viewportWidth} / ${viewportHeight}`,
          background: hasVisibleBackgroundImage ? undefined : "#000",
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
