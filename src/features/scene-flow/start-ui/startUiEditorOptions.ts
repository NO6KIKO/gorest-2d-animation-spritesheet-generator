import type {
  StartUiButtonHoverEffect,
  StartUiEntranceEffect,
  StartUiLayerKind,
  StartUiTheme,
  StartUiTitleEffect,
  StartUiTransitionEffect,
} from "../../../types";

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

export const START_UI_TITLE_EFFECT_OPTIONS: Array<{ value: StartUiTitleEffect; label: string }> = [
  { value: "none", label: "None" },
  { value: "breathe", label: "Breathe" },
  { value: "glitch", label: "Rare Glitch" },
];

export const START_UI_BUTTON_HOVER_OPTIONS: Array<{ value: StartUiButtonHoverEffect; label: string }> = [
  { value: "none", label: "None" },
  { value: "lift", label: "Lift" },
  { value: "glow", label: "Glow" },
  { value: "lift-glow", label: "Lift + Glow" },
];

export const START_UI_ENTRANCE_EFFECT_OPTIONS: Array<{ value: StartUiEntranceEffect; label: string }> = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade In" },
  { value: "rise", label: "Rise + Fade" },
];

export const START_UI_TRANSITION_EFFECT_OPTIONS: Array<{ value: StartUiTransitionEffect; label: string }> = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade to Black" },
  { value: "lights-out", label: "Lights Out" },
];
