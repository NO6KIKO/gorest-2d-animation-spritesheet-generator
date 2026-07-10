import type { GameStartUiEffects } from "../../../types";

type StartUiEffectOverlaysProps = {
  effects: GameStartUiEffects;
  isEffectsPreviewing: boolean;
  transitionPreviewCycle: number;
};

export function StartUiEffectOverlays({
  effects,
  isEffectsPreviewing,
  transitionPreviewCycle,
}: StartUiEffectOverlaysProps) {
  if (!isEffectsPreviewing) return null;

  return (
    <>
      <div className="scene-start-ui-effect-overlays" aria-hidden="true">
        {effects.flickerEnabled && effects.flickerStrength > 0 && <span className="scene-start-ui-effect-flicker" />}
        {effects.vignetteStrength > 0 && <span className="scene-start-ui-effect-vignette" />}
        {effects.grainStrength > 0 && <span className="scene-start-ui-effect-grain" />}
      </div>

      {effects.transitionEffect !== "none" && transitionPreviewCycle > 0 && (
        <div
          key={`${effects.transitionEffect}-${transitionPreviewCycle}`}
          className={`scene-start-ui-transition-preview ${effects.transitionEffect}`}
          aria-hidden="true"
        />
      )}
    </>
  );
}
