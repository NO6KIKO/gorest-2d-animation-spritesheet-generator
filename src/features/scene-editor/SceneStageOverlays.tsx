import type { LayerInteractionSettings, SceneLayer } from "../../types";

type InteractionPromptBounds = {
  centerX: number;
  top: number;
};

export type SceneInteractionPromptEntry = {
  bounds: InteractionPromptBounds;
  interaction: LayerInteractionSettings;
  layer: SceneLayer;
};

type SceneStageOverlaysProps = {
  interactionToast: string;
  isBackpackOpen: boolean;
  nearbyInteraction: SceneInteractionPromptEntry | null;
  sceneCameraX: number;
  spriteStageScale: number;
  stageScaleX: number;
  stageScaleY: number;
  onCloseBackpack: () => void;
  onTriggerNearbyInteraction: (entry: SceneInteractionPromptEntry) => void;
};

export function SceneStageOverlays({
  interactionToast,
  isBackpackOpen,
  nearbyInteraction,
  sceneCameraX,
  spriteStageScale,
  stageScaleX,
  stageScaleY,
  onCloseBackpack,
  onTriggerNearbyInteraction,
}: SceneStageOverlaysProps) {
  return (
    <>
      {nearbyInteraction && (
        <button
          type="button"
          className={`interaction-prompt ${nearbyInteraction.interaction.promptStyle}`}
          style={{
            left: (nearbyInteraction.bounds.centerX - sceneCameraX * (nearbyInteraction.layer.parallax ?? 1)) * stageScaleX + nearbyInteraction.interaction.offsetX * spriteStageScale,
            top: Math.max(14, nearbyInteraction.bounds.top * stageScaleY + nearbyInteraction.interaction.offsetY * spriteStageScale),
            zIndex: nearbyInteraction.layer.zIndex + 8,
            ["--prompt-font-size" as string]: `${nearbyInteraction.interaction.fontSize}px`,
            ["--prompt-scale" as string]: nearbyInteraction.interaction.promptScale,
          }}
          onClick={event => {
            event.stopPropagation();
            onTriggerNearbyInteraction(nearbyInteraction);
          }}
          title={nearbyInteraction.interaction.promptText || "Inspect"}
        >
          <span className="interaction-eye" aria-hidden="true">
            <img src="/generated/ui_chinese_horror_eye_inspect_prompt.png" alt="" draggable={false} />
          </span>
          {nearbyInteraction.interaction.showText && nearbyInteraction.interaction.promptText && (
            <strong>{nearbyInteraction.interaction.promptText}</strong>
          )}
        </button>
      )}
      {interactionToast && <div className="interaction-toast">{interactionToast}</div>}
      {isBackpackOpen && (
        <button
          type="button"
          className="backpack-panel-overlay"
          onClick={event => {
            event.stopPropagation();
            onCloseBackpack();
          }}
          title="Click to close backpack"
        >
          <img src="/generated/scene_kit_backpack_panel.png" alt="Open backpack inventory" draggable={false} />
        </button>
      )}
    </>
  );
}
