import type {
  GameStartUiEffects,
  StartUiButtonHoverEffect,
  StartUiEntranceEffect,
  StartUiTitleEffect,
  StartUiTransitionEffect,
} from "../../../types";
import {
  START_UI_BUTTON_HOVER_OPTIONS,
  START_UI_ENTRANCE_EFFECT_OPTIONS,
  START_UI_TITLE_EFFECT_OPTIONS,
  START_UI_TRANSITION_EFFECT_OPTIONS,
} from "./startUiEditorOptions";
import {
  StartUiRangeControl,
  StartUiSelectControl,
  StartUiToggleControl,
} from "./StartUiInspectorControls";
import type { PatchStartUiEffects } from "./startUiInspectorTypes";

type StartUiEffectGroupProps = {
  disabled: boolean;
  effects: GameStartUiEffects;
  onPatchEffects: PatchStartUiEffects;
};

function EffectGroupTitle({ children }: { children: string }) {
  return <span className="scene-start-ui-effect-group-title">{children}</span>;
}

export function StartUiAmbientEffectGroup({
  disabled,
  effects,
  onPatchEffects,
}: StartUiEffectGroupProps) {
  const flickerDisabled = disabled || !effects.flickerEnabled;
  return (
    <>
      <EffectGroupTitle>Ambient</EffectGroupTitle>
      <StartUiRangeControl
        label="Parallax"
        min={0}
        max={30}
        value={effects.parallaxStrength}
        valueLabel={`${effects.parallaxStrength}px`}
        disabled={disabled}
        onChange={parallaxStrength => onPatchEffects({ parallaxStrength })}
      />
      <StartUiToggleControl
        checked={effects.flickerEnabled}
        disabled={disabled}
        onChange={flickerEnabled => onPatchEffects({ flickerEnabled })}
      >
        Light Flicker
      </StartUiToggleControl>
      <div className="scene-start-ui-layer-grid two">
        <StartUiRangeControl
          label="Flicker"
          min={0}
          max={100}
          value={effects.flickerStrength}
          valueLabel={`${effects.flickerStrength}%`}
          disabled={flickerDisabled}
          onChange={flickerStrength => onPatchEffects({ flickerStrength })}
        />
        <StartUiRangeControl
          label="Interval"
          min={1}
          max={15}
          step={0.5}
          value={effects.flickerInterval}
          valueLabel={`${effects.flickerInterval}s`}
          disabled={flickerDisabled}
          onChange={flickerInterval => onPatchEffects({ flickerInterval })}
        />
      </div>
      <div className="scene-start-ui-layer-grid two">
        <StartUiRangeControl
          label="Vignette"
          min={0}
          max={100}
          value={effects.vignetteStrength}
          valueLabel={`${effects.vignetteStrength}%`}
          disabled={disabled}
          onChange={vignetteStrength => onPatchEffects({ vignetteStrength })}
        />
        <StartUiRangeControl
          label="Grain"
          min={0}
          max={100}
          value={effects.grainStrength}
          valueLabel={`${effects.grainStrength}%`}
          disabled={disabled}
          onChange={grainStrength => onPatchEffects({ grainStrength })}
        />
      </div>
    </>
  );
}

export function StartUiTitleEffectGroup({
  disabled,
  effects,
  onPatchEffects,
}: StartUiEffectGroupProps) {
  const motionDisabled = disabled || effects.titleEffect === "none";
  return (
    <>
      <EffectGroupTitle>Title</EffectGroupTitle>
      <StartUiSelectControl<StartUiTitleEffect>
        label="Motion"
        options={START_UI_TITLE_EFFECT_OPTIONS}
        value={effects.titleEffect}
        disabled={disabled}
        onChange={titleEffect => onPatchEffects({ titleEffect })}
      />
      <div className="scene-start-ui-layer-grid two">
        <StartUiRangeControl
          label="Strength"
          min={0}
          max={100}
          value={effects.titleStrength}
          valueLabel={`${effects.titleStrength}%`}
          disabled={motionDisabled}
          onChange={titleStrength => onPatchEffects({ titleStrength })}
        />
        <StartUiRangeControl
          label="Cycle"
          min={1}
          max={12}
          step={0.5}
          value={effects.titleSpeed}
          valueLabel={`${effects.titleSpeed}s`}
          disabled={motionDisabled}
          onChange={titleSpeed => onPatchEffects({ titleSpeed })}
        />
      </div>
    </>
  );
}

export function StartUiButtonEffectGroup({
  disabled,
  effects,
  onPatchEffects,
}: StartUiEffectGroupProps) {
  return (
    <>
      <EffectGroupTitle>Buttons</EffectGroupTitle>
      <StartUiSelectControl<StartUiButtonHoverEffect>
        label="Hover"
        options={START_UI_BUTTON_HOVER_OPTIONS}
        value={effects.buttonHoverEffect}
        disabled={disabled}
        onChange={buttonHoverEffect => onPatchEffects({ buttonHoverEffect })}
      />
      <div className="scene-start-ui-layer-grid two">
        <StartUiRangeControl
          label="Lift"
          min={0}
          max={12}
          value={effects.buttonLift}
          valueLabel={`${effects.buttonLift}px`}
          disabled={disabled || !effects.buttonHoverEffect.includes("lift")}
          onChange={buttonLift => onPatchEffects({ buttonLift })}
        />
        <StartUiRangeControl
          label="Glow"
          min={0}
          max={100}
          value={effects.buttonGlow}
          valueLabel={`${effects.buttonGlow}%`}
          disabled={disabled || !effects.buttonHoverEffect.includes("glow")}
          onChange={buttonGlow => onPatchEffects({ buttonGlow })}
        />
      </div>
      <StartUiRangeControl
        label="Press Scale"
        min={90}
        max={100}
        step={0.5}
        value={effects.buttonPressScale}
        valueLabel={`${effects.buttonPressScale}%`}
        disabled={disabled}
        onChange={buttonPressScale => onPatchEffects({ buttonPressScale })}
      />
    </>
  );
}

export function StartUiTimingEffectGroup({
  disabled,
  effects,
  onPatchEffects,
}: StartUiEffectGroupProps) {
  const entranceDisabled = disabled || effects.entranceEffect === "none";
  return (
    <>
      <EffectGroupTitle>Timing</EffectGroupTitle>
      <StartUiSelectControl<StartUiEntranceEffect>
        label="Entrance"
        options={START_UI_ENTRANCE_EFFECT_OPTIONS}
        value={effects.entranceEffect}
        disabled={disabled}
        onChange={entranceEffect => onPatchEffects({ entranceEffect })}
      />
      <div className="scene-start-ui-layer-grid two">
        <StartUiRangeControl
          label="Duration"
          min={100}
          max={2000}
          step={20}
          value={effects.entranceDuration}
          valueLabel={`${effects.entranceDuration}ms`}
          disabled={entranceDisabled}
          onChange={entranceDuration => onPatchEffects({ entranceDuration })}
        />
        <StartUiRangeControl
          label="Stagger"
          min={0}
          max={500}
          step={10}
          value={effects.entranceStagger}
          valueLabel={`${effects.entranceStagger}ms`}
          disabled={entranceDisabled}
          onChange={entranceStagger => onPatchEffects({ entranceStagger })}
        />
      </div>
      <StartUiSelectControl<StartUiTransitionEffect>
        label="Exit"
        options={START_UI_TRANSITION_EFFECT_OPTIONS}
        value={effects.transitionEffect}
        disabled={disabled}
        onChange={transitionEffect => onPatchEffects({ transitionEffect })}
      />
      <StartUiRangeControl
        label="Exit Duration"
        min={200}
        max={2500}
        step={50}
        value={effects.transitionDuration}
        valueLabel={`${effects.transitionDuration}ms`}
        disabled={disabled || effects.transitionEffect === "none"}
        onChange={transitionDuration => onPatchEffects({ transitionDuration })}
      />
      <StartUiToggleControl
        checked={effects.respectReducedMotion}
        disabled={disabled}
        onChange={respectReducedMotion => onPatchEffects({ respectReducedMotion })}
      >
        Respect Reduced Motion
      </StartUiToggleControl>
    </>
  );
}
