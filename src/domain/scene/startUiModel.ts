import type { GameScene, GameStartUiSettings } from "../../types";

export const DEFAULT_START_UI_SETTINGS: GameStartUiSettings = {
  id: "start_ui_main",
  enabled: true,
  title: "Gorest",
  subtitle: "A 2D narrative game",
  theme: "dark",
  primaryActionLabel: "New Game",
  continueActionLabel: "Continue",
  loadActionLabel: "Load Game",
  settingsActionLabel: "Settings",
  quitActionLabel: "Quit",
  showContinue: true,
  showLoadGame: true,
  showSettings: true,
  showQuit: true,
  saveSlots: 3,
  autosave: true,
  confirmNewGame: true,
  musicVolume: 70,
  sfxVolume: 80,
  fullscreenToggle: true,
  languageSelector: false,
};

export function normalizeStartUiSettings(
  settings?: Partial<GameStartUiSettings>,
  scenes: GameScene[] = []
): GameStartUiSettings {
  const initialSceneId = settings?.initialSceneId || scenes[0]?.id;
  return {
    ...DEFAULT_START_UI_SETTINGS,
    ...settings,
    id: settings?.id || DEFAULT_START_UI_SETTINGS.id,
    title: settings?.title || DEFAULT_START_UI_SETTINGS.title,
    subtitle: settings?.subtitle || DEFAULT_START_UI_SETTINGS.subtitle,
    initialSceneId,
    saveSlots: Math.max(1, Math.min(12, Math.round(settings?.saveSlots || DEFAULT_START_UI_SETTINGS.saveSlots))),
    musicVolume: Math.max(0, Math.min(100, Math.round(settings?.musicVolume ?? DEFAULT_START_UI_SETTINGS.musicVolume))),
    sfxVolume: Math.max(0, Math.min(100, Math.round(settings?.sfxVolume ?? DEFAULT_START_UI_SETTINGS.sfxVolume))),
  };
}
