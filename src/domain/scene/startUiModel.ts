import type { GameScene, GameStartUiLayer, GameStartUiSettings } from "../../types";

const START_UI_CANVAS_WIDTH = 1672;
const START_UI_CANVAS_HEIGHT = 941;
const START_UI_BACKGROUND_URL = "/generated/start_ui_smile_graduates_background.png";
const START_UI_TITLE_URL = "/generated/start_ui_smile_graduates_title_layer.png";
const START_UI_NEW_GAME_URL = "/generated/start_ui_smile_graduates_new_game_layer.png";
const START_UI_LOAD_GAME_URL = "/generated/start_ui_smile_graduates_load_game_layer.png";
const START_UI_OPTION_URL = "/generated/start_ui_smile_graduates_option_layer.png";

export const DEFAULT_START_UI_LAYERS: GameStartUiLayer[] = [
  {
    id: "start_ui_layer_background",
    name: "Background",
    kind: "background",
    imageUrl: START_UI_BACKGROUND_URL,
    visible: true,
    x: 0,
    y: 0,
    width: START_UI_CANVAS_WIDTH,
    height: START_UI_CANVAS_HEIGHT,
    opacity: 1,
    zIndex: 0,
    locked: true,
  },
  {
    id: "start_ui_layer_title",
    name: "Title",
    kind: "title",
    imageUrl: START_UI_TITLE_URL,
    visible: true,
    x: 402,
    y: 52,
    width: 796,
    height: 396,
    opacity: 1,
    zIndex: 10,
  },
  {
    id: "start_ui_layer_new_game",
    name: "New Game",
    kind: "menu",
    imageUrl: START_UI_NEW_GAME_URL,
    visible: true,
    x: 542,
    y: 427,
    width: 581,
    height: 142,
    opacity: 1,
    zIndex: 20,
  },
  {
    id: "start_ui_layer_load_game",
    name: "Load Game",
    kind: "menu",
    imageUrl: START_UI_LOAD_GAME_URL,
    visible: true,
    x: 542,
    y: 570,
    width: 581,
    height: 142,
    opacity: 1,
    zIndex: 30,
  },
  {
    id: "start_ui_layer_option",
    name: "Option",
    kind: "menu",
    imageUrl: START_UI_OPTION_URL,
    visible: true,
    x: 542,
    y: 715,
    width: 581,
    height: 148,
    opacity: 1,
    zIndex: 40,
  },
];

export const DEFAULT_START_UI_SETTINGS: GameStartUiSettings = {
  id: "start_ui_main",
  enabled: true,
  title: "Smile for graduates",
  subtitle: "",
  theme: "dark",
  designWidth: START_UI_CANVAS_WIDTH,
  designHeight: START_UI_CANVAS_HEIGHT,
  backgroundImageUrl: START_UI_BACKGROUND_URL,
  layers: DEFAULT_START_UI_LAYERS,
  primaryActionLabel: "New Game",
  continueActionLabel: "Continue",
  loadActionLabel: "Load Game",
  settingsActionLabel: "Option",
  quitActionLabel: "Quit",
  showContinue: false,
  showLoadGame: true,
  showSettings: true,
  showQuit: false,
  saveSlots: 3,
  autosave: true,
  confirmNewGame: true,
  musicVolume: 70,
  sfxVolume: 80,
  fullscreenToggle: true,
  languageSelector: false,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function normalizeStartUiLayers(layers?: Partial<GameStartUiLayer>[]): GameStartUiLayer[] {
  const sourceLayers = Array.isArray(layers) && layers.length ? layers : DEFAULT_START_UI_LAYERS;
  return sourceLayers.map((layer, index) => {
    const fallback = DEFAULT_START_UI_LAYERS[index] || DEFAULT_START_UI_LAYERS[0];
    return {
      ...fallback,
      ...layer,
      id: layer.id || fallback.id || `start_ui_layer_${index + 1}`,
      name: layer.name || fallback.name || `Layer ${index + 1}`,
      kind: layer.kind || fallback.kind || "overlay",
      imageUrl: layer.imageUrl || fallback.imageUrl || "",
      visible: layer.visible ?? fallback.visible ?? true,
      x: Math.round(clampNumber(layer.x, -START_UI_CANVAS_WIDTH, START_UI_CANVAS_WIDTH * 2, fallback.x)),
      y: Math.round(clampNumber(layer.y, -START_UI_CANVAS_HEIGHT, START_UI_CANVAS_HEIGHT * 2, fallback.y)),
      width: Math.round(clampNumber(layer.width, 1, START_UI_CANVAS_WIDTH * 2, fallback.width)),
      height: Math.round(clampNumber(layer.height, 1, START_UI_CANVAS_HEIGHT * 2, fallback.height)),
      opacity: clampNumber(layer.opacity, 0, 1, fallback.opacity),
      zIndex: Math.round(clampNumber(layer.zIndex, -100, 1000, fallback.zIndex)),
    };
  });
}

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
    subtitle: settings?.subtitle ?? DEFAULT_START_UI_SETTINGS.subtitle,
    initialSceneId,
    designWidth: Math.round(clampNumber(settings?.designWidth, 320, 7680, DEFAULT_START_UI_SETTINGS.designWidth || START_UI_CANVAS_WIDTH)),
    designHeight: Math.round(clampNumber(settings?.designHeight, 180, 4320, DEFAULT_START_UI_SETTINGS.designHeight || START_UI_CANVAS_HEIGHT)),
    backgroundImageUrl: settings?.backgroundImageUrl || DEFAULT_START_UI_SETTINGS.backgroundImageUrl,
    layers: normalizeStartUiLayers(settings?.layers),
    saveSlots: Math.max(1, Math.min(12, Math.round(settings?.saveSlots || DEFAULT_START_UI_SETTINGS.saveSlots))),
    musicVolume: Math.max(0, Math.min(100, Math.round(settings?.musicVolume ?? DEFAULT_START_UI_SETTINGS.musicVolume))),
    sfxVolume: Math.max(0, Math.min(100, Math.round(settings?.sfxVolume ?? DEFAULT_START_UI_SETTINGS.sfxVolume))),
  };
}
