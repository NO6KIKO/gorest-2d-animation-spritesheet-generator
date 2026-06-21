import type { ActionTriggerType, AssetRole, InteractionPreset, LayerInteractionSettings } from "../types";

export type ViewportPresetIcon = "phone" | "tablet" | "desktop";

export type ViewportPreset = {
  id: string;
  label: string;
  width: number;
  height: number;
  icon: ViewportPresetIcon;
  note: string;
};

export const VIEWPORT_WIDTH = 1280;
export const DEFAULT_WALK_SPEED = 120;
export const SHOW_SCENE_KIT_TOOLS = false;

export const INTERACTION_PRESETS: Record<InteractionPreset, Partial<LayerInteractionSettings> & { label: string }> = {
  inspect: {
    label: "Inspect",
    preset: "inspect",
    triggerMode: "near-click",
    actionType: "subtitle",
    promptText: "Inspect",
    subtitle: "There is something worth inspecting here.",
    showText: false,
  },
  pickup: {
    label: "Pickup",
    preset: "pickup",
    triggerMode: "near-click",
    actionType: "pickup-item",
    promptText: "Pick up",
    subtitle: "Picked up an item.",
    showText: false,
    hideLayerOnPickup: true,
  },
  toggle: {
    label: "Toggle",
    preset: "toggle",
    triggerMode: "near-click",
    actionType: "toggle-layer",
    promptText: "Use",
    subtitle: "Something changed.",
  },
  "scene-link": {
    label: "Door / Scene Link",
    preset: "scene-link",
    triggerMode: "near-click",
    actionType: "scene-link",
    promptText: "Enter",
    subtitle: "Moving to another scene.",
  },
  animated: {
    label: "Animated Prop",
    preset: "animated",
    triggerMode: "near-click",
    actionType: "play-animation",
    promptText: "Activate",
    subtitle: "The object starts moving.",
  },
  conditional: {
    label: "Conditional",
    preset: "conditional",
    triggerMode: "near-click",
    actionType: "set-state",
    promptText: "Inspect",
    subtitle: "The condition is satisfied.",
    failSubtitle: "It does not seem ready yet.",
  },
};

export const VIEWPORT_PRESETS: ViewportPreset[] = [
  { id: "iphone-portrait", label: "Phone Portrait", width: 390, height: 844, icon: "phone", note: "9:19.5" },
  { id: "phone-landscape", label: "Phone Wide", width: 844, height: 390, icon: "phone", note: "19.5:9" },
  { id: "portrait-720p", label: "Portrait 720p", width: 720, height: 1280, icon: "phone", note: "9:16" },
  { id: "portrait-1080p", label: "Portrait 1080p", width: 1080, height: 1920, icon: "phone", note: "9:16" },
  { id: "ipad-portrait", label: "iPad Portrait", width: 768, height: 1024, icon: "tablet", note: "3:4" },
  { id: "ipad-pro-portrait", label: "iPad Pro Portrait", width: 820, height: 1180, icon: "tablet", note: "11-inch" },
  { id: "ipad", label: "iPad Wide", width: 1024, height: 768, icon: "tablet", note: "4:3" },
  { id: "ipad-wide", label: "iPad Pro Wide", width: 1180, height: 820, icon: "tablet", note: "11-inch" },
  { id: "desktop", label: "Desktop 720p", width: 1280, height: 720, icon: "desktop", note: "16:9" },
  { id: "desktop-1080p", label: "Desktop 1080p", width: 1920, height: 1080, icon: "desktop", note: "16:9" },
  { id: "wide", label: "Ultrawide", width: 1440, height: 720, icon: "desktop", note: "2:1" },
];

export const checkerStyle = {
  backgroundImage:
    "linear-gradient(45deg, #d6d9de 25%, transparent 25%), linear-gradient(-45deg, #d6d9de 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d6d9de 75%), linear-gradient(-45deg, transparent 75%, #d6d9de 75%)",
  backgroundSize: "22px 22px",
  backgroundPosition: "0 0, 0 11px, 11px -11px, -11px 0",
  backgroundColor: "#f6f7f9",
};

export const triggerLabels: Record<ActionTriggerType, string> = {
  mouse: "Mouse",
  keyboard: "Keyboard",
  auto: "Auto",
  state: "State",
};

export const roleLabels: Record<AssetRole, string> = {
  player: "Player",
  npc: "NPC",
  effect: "Effect",
  prop: "Prop",
  background: "Background",
};
