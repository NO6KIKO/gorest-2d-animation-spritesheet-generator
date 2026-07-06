import type { GameAsset, LayerInteractionSettings, SceneLayer } from "../../types";
import { isDialogueZoneInteraction } from "../../domain/scene/sceneModel";

type InteractionPromptBounds = {
  bottom: number;
  centerX: number;
  centerY: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

export type SceneInteractionPromptEntry = {
  asset: GameAsset;
  bounds: InteractionPromptBounds;
  interaction: LayerInteractionSettings;
  layer: SceneLayer;
};

export type SceneDialogueOverlayState = {
  layerId: string;
  lineIndex: number;
  lines: string[];
  portraitUrl?: string;
  promptKey: string;
  speaker: string;
};

type SceneStageOverlaysProps = {
  activeDialogue: SceneDialogueOverlayState | null;
  interactionToast: string;
  isBackpackOpen: boolean;
  nearbyInteraction: SceneInteractionPromptEntry | null;
  sceneCameraX: number;
  sceneCameraY: number;
  spriteStageScale: number;
  stageScaleX: number;
  stageScaleY: number;
  onAdvanceDialogue: () => void;
  onCloseBackpack: () => void;
  onTriggerNearbyInteraction: (entry: SceneInteractionPromptEntry) => void;
};

export function SceneStageOverlays({
  activeDialogue,
  interactionToast,
  isBackpackOpen,
  nearbyInteraction,
  sceneCameraX,
  sceneCameraY,
  spriteStageScale,
  stageScaleX,
  stageScaleY,
  onAdvanceDialogue,
  onCloseBackpack,
  onTriggerNearbyInteraction,
}: SceneStageOverlaysProps) {
  const dialogueLine = activeDialogue?.lines[activeDialogue.lineIndex] || "";
  const isDialoguePrompt = nearbyInteraction ? isDialogueZoneInteraction(nearbyInteraction.interaction) : false;

  return (
    <>
      {nearbyInteraction && (
        <button
          type="button"
          className={`interaction-prompt ${isDialoguePrompt ? "dialogue" : nearbyInteraction.interaction.promptStyle}`}
          style={{
            left: (nearbyInteraction.bounds.centerX - sceneCameraX * (nearbyInteraction.layer.parallax ?? 1)) * stageScaleX + nearbyInteraction.interaction.offsetX * spriteStageScale,
            top: Math.max(14, (nearbyInteraction.bounds.top - sceneCameraY * (nearbyInteraction.layer.parallax ?? 1)) * stageScaleY + nearbyInteraction.interaction.offsetY * spriteStageScale),
            zIndex: nearbyInteraction.layer.zIndex + 8,
            ["--prompt-font-size" as string]: `${nearbyInteraction.interaction.fontSize}px`,
            ["--prompt-scale" as string]: nearbyInteraction.interaction.promptScale,
          }}
          onClick={event => {
            event.stopPropagation();
            onTriggerNearbyInteraction(nearbyInteraction);
          }}
          title={isDialoguePrompt ? "Talk" : nearbyInteraction.interaction.promptText || "Inspect"}
        >
          {isDialoguePrompt ? (
            <span className="interaction-dialogue-dots" aria-hidden="true">...</span>
          ) : (
            <span className="interaction-eye" aria-hidden="true">
              <img src="/generated/ui_chinese_horror_eye_inspect_prompt.png" alt="" draggable={false} />
            </span>
          )}
          {!isDialoguePrompt && nearbyInteraction.interaction.showText && nearbyInteraction.interaction.promptText && (
            <strong>{nearbyInteraction.interaction.promptText}</strong>
          )}
        </button>
      )}
      {activeDialogue && (
        <button
          type="button"
          className={activeDialogue.portraitUrl ? "scene-dialogue-panel with-portrait" : "scene-dialogue-panel"}
          onClick={event => {
            event.stopPropagation();
            onAdvanceDialogue();
          }}
          title="Continue dialogue"
        >
          <span className="scene-dialogue-speaker">{activeDialogue.speaker}</span>
          {activeDialogue.portraitUrl && (
            <span className="scene-dialogue-portrait">
              <img src={activeDialogue.portraitUrl} alt="" draggable={false} />
            </span>
          )}
          <span className="scene-dialogue-text">{dialogueLine}</span>
          <span className="scene-dialogue-progress">
            {activeDialogue.lineIndex + 1} / {activeDialogue.lines.length}
          </span>
          <span className="scene-dialogue-key">{activeDialogue.promptKey.replace(/^Key/i, "")}</span>
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
