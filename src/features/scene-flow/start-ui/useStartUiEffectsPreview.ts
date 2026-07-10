import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { GameStartUiEffects } from "../../../types";
import {
  CENTERED_START_UI_EFFECT_POINTER,
  type StartUiEffectPointer,
} from "./startUiEffectsModel";

type UseStartUiEffectsPreviewOptions = {
  effects: GameStartUiEffects;
  onFinishLayerDrag: () => void;
  onUpdateLayerDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export type StartUiEffectsPreviewController = {
  effectPointer: StartUiEffectPointer;
  entrancePreviewCycle: number;
  hoveredButtonGroup: string | null;
  isEffectsPreviewing: boolean;
  pressedButtonGroup: string | null;
  transitionPreviewCycle: number;
  finishPointerInteraction: () => void;
  handleStagePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  leaveButtonGroup: (group: string) => void;
  leaveStage: () => void;
  previewTransition: () => void;
  replayEntrance: () => void;
  setHoveredButtonGroup: (group: string) => void;
  setPressedButtonGroup: (group: string) => void;
  toggleEffectsPreview: () => void;
};

export function useStartUiEffectsPreview({
  effects,
  onFinishLayerDrag,
  onUpdateLayerDrag,
}: UseStartUiEffectsPreviewOptions): StartUiEffectsPreviewController {
  const [effectsPreviewEnabled, setEffectsPreviewEnabled] = useState(true);
  const [entrancePreviewCycle, setEntrancePreviewCycle] = useState(0);
  const [transitionPreviewCycle, setTransitionPreviewCycle] = useState(0);
  const [effectPointer, setEffectPointer] = useState<StartUiEffectPointer>(CENTERED_START_UI_EFFECT_POINTER);
  const [hoveredButtonGroup, setHoveredButtonGroupState] = useState<string | null>(null);
  const [pressedButtonGroup, setPressedButtonGroupState] = useState<string | null>(null);
  const isEffectsPreviewing = effects.enabled && effectsPreviewEnabled;

  useEffect(() => {
    if (isEffectsPreviewing) return;
    setEffectPointer(CENTERED_START_UI_EFFECT_POINTER);
    setHoveredButtonGroupState(null);
    setPressedButtonGroupState(null);
  }, [isEffectsPreviewing]);

  const toggleEffectsPreview = () => {
    setEffectsPreviewEnabled(current => {
      if (!current) setEntrancePreviewCycle(cycle => cycle + 1);
      return !current;
    });
  };

  const handleStagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    onUpdateLayerDrag(event);
    if (!isEffectsPreviewing || effects.parallaxStrength <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setEffectPointer({
      x: ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2,
      y: ((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2,
    });
  };

  const finishPointerInteraction = () => {
    setPressedButtonGroupState(null);
    onFinishLayerDrag();
  };

  const leaveStage = () => {
    setEffectPointer(CENTERED_START_UI_EFFECT_POINTER);
    setHoveredButtonGroupState(null);
    setPressedButtonGroupState(null);
  };

  const leaveButtonGroup = (group: string) => {
    setHoveredButtonGroupState(current => current === group ? null : current);
    setPressedButtonGroupState(current => current === group ? null : current);
  };

  return {
    effectPointer,
    entrancePreviewCycle,
    hoveredButtonGroup,
    isEffectsPreviewing,
    pressedButtonGroup,
    transitionPreviewCycle,
    finishPointerInteraction,
    handleStagePointerMove,
    leaveButtonGroup,
    leaveStage,
    previewTransition: () => setTransitionPreviewCycle(cycle => cycle + 1),
    replayEntrance: () => setEntrancePreviewCycle(cycle => cycle + 1),
    setHoveredButtonGroup: setHoveredButtonGroupState,
    setPressedButtonGroup: setPressedButtonGroupState,
    toggleEffectsPreview,
  };
}
