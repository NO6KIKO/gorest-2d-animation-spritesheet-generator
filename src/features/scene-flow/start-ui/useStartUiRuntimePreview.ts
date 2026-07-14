import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_START_UI_EFFECTS } from "../../../domain/scene/startUiModel";
import { startUiActionIdForButtonGroup } from "../../../domain/scene/startUiRuntime";
import type { GameStartUiSettings, StartUiRuntimeActionId } from "../../../types";

type UseStartUiRuntimePreviewOptions = {
  onPreviewTransition: () => void;
  onRunAction: (actionId: StartUiRuntimeActionId) => void | Promise<void>;
  settings: GameStartUiSettings;
};

export function useStartUiRuntimePreview({
  onPreviewTransition,
  onRunAction,
  settings,
}: UseStartUiRuntimePreviewOptions) {
  const timeoutRef = useRef<number | null>(null);
  const [isRuntimePreviewing, setIsRuntimePreviewing] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<StartUiRuntimeActionId | null>(null);

  const clearPendingAction = useCallback(() => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setPendingActionId(null);
  }, []);

  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => {
    clearPendingAction();
    setIsRuntimePreviewing(false);
  }, [clearPendingAction, settings.id]);

  const toggleRuntimePreview = () => {
    clearPendingAction();
    setIsRuntimePreviewing(current => !current);
  };

  const activateButtonGroup = (buttonGroup: string) => {
    if (!isRuntimePreviewing || pendingActionId) return;
    const actionId = startUiActionIdForButtonGroup(buttonGroup, settings);
    if (!actionId) return;
    const effects = settings.effects || DEFAULT_START_UI_EFFECTS;
    const hasExitTransition = effects.enabled && effects.transitionEffect !== "none";
    const delayMs = hasExitTransition ? effects.transitionDuration : 90;
    setPendingActionId(actionId);
    if (hasExitTransition) onPreviewTransition();
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setPendingActionId(null);
      void onRunAction(actionId);
    }, delayMs);
  };

  return {
    activateButtonGroup,
    isRuntimePreviewing,
    pendingActionId,
    toggleRuntimePreview,
  };
}
