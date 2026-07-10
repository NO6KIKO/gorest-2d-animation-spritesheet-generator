import { Sparkles } from "lucide-react";
import { DEFAULT_START_UI_EFFECTS } from "../../../domain/scene/startUiModel";
import type { GameStartUiSettings } from "../../../types";
import {
  StartUiAmbientEffectGroup,
  StartUiButtonEffectGroup,
  StartUiTimingEffectGroup,
  StartUiTitleEffectGroup,
} from "./StartUiEffectGroups";
import { StartUiToggleControl } from "./StartUiInspectorControls";
import type { PatchStartUiDraft, PatchStartUiEffects } from "./startUiInspectorTypes";

type StartUiEffectsInspectorProps = {
  draft: GameStartUiSettings;
  onPatchDraft: PatchStartUiDraft;
};

export function StartUiEffectsInspector({ draft, onPatchDraft }: StartUiEffectsInspectorProps) {
  const effects = draft.effects || DEFAULT_START_UI_EFFECTS;
  const patchEffects: PatchStartUiEffects = patch => {
    onPatchDraft({ effects: { ...effects, ...patch } });
  };
  const effectsDisabled = !effects.enabled;
  const groupProps = { disabled: effectsDisabled, effects, onPatchEffects: patchEffects };

  return (
    <div className="scene-start-ui-section compact scene-start-ui-effects-section">
      <strong><Sparkles size={14} /> Effects</strong>
      <StartUiToggleControl checked={effects.enabled} emphasized onChange={enabled => patchEffects({ enabled })}>
        Enable Effects
      </StartUiToggleControl>
      <StartUiAmbientEffectGroup {...groupProps} />
      <StartUiTitleEffectGroup {...groupProps} />
      <StartUiButtonEffectGroup {...groupProps} />
      <StartUiTimingEffectGroup {...groupProps} />
    </div>
  );
}
