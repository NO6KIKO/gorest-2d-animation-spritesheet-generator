import type { GameStartUiSettings, StartUiRuntimeActionId } from "../../types";

export type StartUiRuntimeActionOption = {
  id: StartUiRuntimeActionId;
  label: string;
};

export function normalizeStartUiActionLabel(value?: string) {
  return (value || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function startUiRuntimeActionOptions(settings: GameStartUiSettings): StartUiRuntimeActionOption[] {
  return [
    { id: "primary-action", label: settings.primaryActionLabel || "New Game" },
    { id: "continue-action", label: settings.continueActionLabel || "Continue" },
    { id: "load-action", label: settings.loadActionLabel || "Load Game" },
    { id: "settings-action", label: settings.settingsActionLabel || "Settings" },
    { id: "quit-action", label: settings.quitActionLabel || "Quit" },
  ];
}

export function startUiActionIdForButtonGroup(
  buttonGroup: string,
  settings: GameStartUiSettings,
): StartUiRuntimeActionId | null {
  const normalizedGroup = normalizeStartUiActionLabel(buttonGroup);
  return startUiRuntimeActionOptions(settings).find(option => (
    normalizeStartUiActionLabel(option.label) === normalizedGroup
  ))?.id || null;
}
