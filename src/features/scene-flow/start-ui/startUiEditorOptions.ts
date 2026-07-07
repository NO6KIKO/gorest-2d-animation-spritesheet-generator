import type { StartUiLayerKind, StartUiTheme } from "../../../types";

export const START_UI_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";

export const START_UI_THEME_OPTIONS: Array<{ value: StartUiTheme; label: string }> = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "horror", label: "Horror" },
];

export const START_UI_LAYER_KIND_OPTIONS: Array<{ value: StartUiLayerKind; label: string }> = [
  { value: "background", label: "Background" },
  { value: "title", label: "Logo / Title" },
  { value: "menu", label: "Menu Button" },
  { value: "overlay", label: "Overlay" },
];
