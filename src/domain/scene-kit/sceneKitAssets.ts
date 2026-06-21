import type { AnimationSprite, GameAsset } from "../../types";

export const BOARDING_TRAIN_ASSET_ID = "asset_scene_boarding_train";
export const INSPECT_TRIGGER_ASSET_ID = "asset_scene_e_trigger_point";

export const BUILT_IN_SCENE_KIT_ASSET_IDS = new Set([
  INSPECT_TRIGGER_ASSET_ID,
  "asset_scene_ticket_machine",
  "asset_scene_backpack_ui",
  "asset_scene_backpack_panel",
  "asset_scene_station_sign_13",
  BOARDING_TRAIN_ASSET_ID,
]);

const SCENE_KIT_TIMESTAMP = "2026-06-10T00:00:00.000Z";

const SCENE_KIT_PNG_SOURCES: Record<string, { url: string; width: number; height: number }> = {
  sprite_scene_ticket_machine: { url: "/generated/scene_kit_ticket_machine.png", width: 392, height: 1541 },
  sprite_scene_backpack_ui: { url: "/generated/scene_kit_backpack_icon.png", width: 274, height: 315 },
  sprite_scene_station_sign_13: { url: "/generated/scene_kit_platform_13_sign.png", width: 589, height: 384 },
  sprite_scene_backpack_panel: { url: "/generated/scene_kit_backpack_panel.png", width: 729, height: 438 },
  sprite_scene_boarding_train: { url: "/generated/scene_kit_boarding_train.png", width: 1868, height: 547 },
};

function createStaticSprite(id: string, characterName: string, frameWidth: number, frameHeight: number, svgBody: string): AnimationSprite {
  const pngSource = SCENE_KIT_PNG_SOURCES[id];
  if (pngSource) {
    return {
      id,
      characterName,
      description: `Reusable PNG scene-kit asset: ${characterName}.`,
      frameCount: 1,
      style: "Generated PNG scene prop",
      frames: [
        `<img src="${pngSource.url}" alt="${characterName}" draggable="false" />`,
      ],
      createdTime: SCENE_KIT_TIMESTAMP,
      isPreset: true,
      spritesheetPng: pngSource.url,
      rawSpritesheetPng: pngSource.url,
      frameSize: [pngSource.width, pngSource.height],
      sheetSize: [pngSource.width, pngSource.height],
      generationMode: "png-scene-kit",
      proportionPolicy: "PNG asset keeps its generated pixel ratio and can be resized as a layer.",
    };
  }
  return {
    id,
    characterName,
    description: `Reusable scene-kit prop: ${characterName}.`,
    frameCount: 1,
    style: "Neon subway scene prop",
    frames: [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${frameWidth}" height="${frameHeight}" viewBox="0 0 ${frameWidth} ${frameHeight}">${svgBody}</svg>`,
    ],
    createdTime: SCENE_KIT_TIMESTAMP,
    isPreset: true,
    frameSize: [frameWidth, frameHeight],
    sheetSize: [frameWidth, frameHeight],
    generationMode: "built-in-scene-kit",
    proportionPolicy: "Static prop keeps its designed frame ratio and can be resized as a layer.",
  };
}

function createStaticAsset(asset: Omit<GameAsset, "savedTime" | "updatedTime" | "confirmed">): GameAsset {
  return {
    ...asset,
    confirmed: true,
    savedTime: SCENE_KIT_TIMESTAMP,
    updatedTime: SCENE_KIT_TIMESTAMP,
  };
}

const TICKET_MACHINE_SPRITE = createStaticSprite(
  "sprite_scene_ticket_machine",
  "Ruined Ticket Machine",
  392,
  1541,
  `
    <defs>
      <linearGradient id="tmBody" x1="0" x2="1" y1="0" y2="1">
        <stop stop-color="#2a1a31" offset="0"/>
        <stop stop-color="#18111e" offset="0.5"/>
        <stop stop-color="#05060b" offset="1"/>
      </linearGradient>
      <linearGradient id="tmGlow" x1="0" x2="1">
        <stop stop-color="#ff356a" offset="0"/>
        <stop stop-color="#9b55ff" offset="1"/>
      </linearGradient>
      <filter id="tmSoftGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="tmGrime" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="21"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer><feFuncA type="table" tableValues="0 0.15"/></feComponentTransfer>
      </filter>
    </defs>
    <ellipse cx="110" cy="340" rx="82" ry="14" fill="#01020a" opacity="0.45"/>
    <rect x="37" y="26" width="146" height="316" rx="12" fill="url(#tmBody)" stroke="#4d405b" stroke-width="3"/>
    <path d="M48 54h124v44H48z" fill="#140b1b" stroke="#d23d67" stroke-width="2" filter="url(#tmSoftGlow)"/>
    <text x="110" y="83" text-anchor="middle" font-family="Inter,Arial" font-size="19" font-weight="800" fill="#ffc7d6">TICKETS</text>
    <rect x="56" y="118" width="108" height="58" rx="5" fill="#08111c" stroke="#764c91" stroke-width="2"/>
    <path d="M66 136h88M66 152h62" stroke="#ff4d7c" stroke-width="4" stroke-linecap="round" opacity="0.72"/>
    <rect x="55" y="194" width="48" height="38" rx="5" fill="#121621" stroke="#705d77" stroke-width="2"/>
    <rect x="117" y="194" width="48" height="38" rx="5" fill="#10131b" stroke="#705d77" stroke-width="2"/>
    <circle cx="79" cy="213" r="8" fill="#ff4979" filter="url(#tmSoftGlow)"/>
    <rect x="126" y="207" width="30" height="8" rx="4" fill="#d9b889"/>
    <rect x="59" y="252" width="102" height="30" rx="5" fill="#080910" stroke="#5b5265" stroke-width="2"/>
    <path d="M69 266h68" stroke="#8f7d90" stroke-width="4" stroke-linecap="round"/>
    <path d="M42 307h136" stroke="url(#tmGlow)" stroke-width="3" opacity="0.7"/>
    <path d="M57 37c21-9 85-8 108 0M48 293c25 11 98 10 123 0" stroke="#ffffff" stroke-width="1.2" opacity="0.08"/>
    <path d="M70 104l-14 225M160 108l-16 222" stroke="#000" stroke-width="3" opacity="0.22"/>
    <path d="M36 39c-10 55-10 217 1 292M184 47c9 80 8 185-4 288" stroke="#120b16" stroke-width="3" opacity="0.78"/>
    <path d="M31 76h-15M185 96h18M36 167H18M184 246h23M46 319H26" stroke="#25172a" stroke-width="6" stroke-linecap="round"/>
    <path d="M47 42h124l12 18M39 93c38 7 104 7 141-2M39 242c43 8 96 7 139-1M45 334c36 9 95 9 129 0" stroke="#ffffff" stroke-width="1" opacity="0.055"/>
    <path d="M61 108h12M172 101h10M49 192h11M170 288h12M80 323h10M137 44h15" stroke="#ff356a" stroke-width="2" opacity="0.32"/>
    <path d="M31 58l-9 23M197 117l-12 32M23 236l10 34M187 310l14 19" stroke="#4d2f55" stroke-width="2" opacity="0.62"/>
    <rect x="37" y="26" width="146" height="316" fill="#fff" filter="url(#tmGrime)" opacity="0.48"/>
  `
);

const BACKPACK_UI_SPRITE = createStaticSprite(
  "sprite_scene_backpack_ui",
  "Ruined Backpack HUD",
  96,
  96,
  `
    <defs>
      <linearGradient id="bagPanel" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#24162c" offset="0"/>
        <stop stop-color="#080b12" offset="1"/>
      </linearGradient>
      <linearGradient id="bagGlow" x1="0" x2="1">
        <stop stop-color="#ff356a" offset="0"/>
        <stop stop-color="#9b55ff" offset="1"/>
      </linearGradient>
      <filter id="bagSoftGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="bagNoise" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="9"/>
        <feComponentTransfer><feFuncA type="table" tableValues="0 0.12"/></feComponentTransfer>
      </filter>
    </defs>
    <rect x="6" y="6" width="84" height="84" rx="14" fill="#05060c" opacity="0.7"/>
    <rect x="8" y="7" width="80" height="80" rx="13" fill="url(#bagPanel)" stroke="#53445c" stroke-width="2" opacity="0.97"/>
    <path d="M18 20h60M12 74h72" stroke="#2a2030" stroke-width="4" opacity="0.9"/>
    <path d="M32 36c1-14 8-23 17-23s15 9 16 23" fill="none" stroke="#887b8f" stroke-width="6" stroke-linecap="round"/>
    <path d="M32 36c2-10 7-17 17-17s15 7 17 17" fill="none" stroke="#15111a" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M24 34h49l-4 42H28z" fill="#241f2d" stroke="#9a8da2" stroke-width="2"/>
    <rect x="31" y="45" width="35" height="24" rx="3" fill="#111620" stroke="#4d4557" stroke-width="1.5"/>
    <path d="M36 54h25M39 63h16" stroke="url(#bagGlow)" stroke-width="3.5" stroke-linecap="round" filter="url(#bagSoftGlow)"/>
    <path d="M26 39l-7 25M72 39l7 24" stroke="#3b3142" stroke-width="4" stroke-linecap="round"/>
    <circle cx="73" cy="23" r="8" fill="#ff356a" filter="url(#bagSoftGlow)"/>
    <text x="73" y="27" text-anchor="middle" font-family="Arial" font-size="10" font-weight="900" fill="#150713">I</text>
    <path d="M21 32h10M70 33h10M21 58h8M72 57h8M39 79h13" stroke="#ff356a" stroke-width="1.7" opacity="0.32"/>
    <rect x="8" y="7" width="80" height="80" fill="#fff" filter="url(#bagNoise)" opacity="0.5"/>
  `
);

const STATION_SIGN_13_SPRITE = createStaticSprite(
  "sprite_scene_station_sign_13",
  "Platform 13 Hanging Sign",
  320,
  150,
  `
    <defs>
      <linearGradient id="signFace" x1="0" x2="1" y1="0" y2="1">
        <stop stop-color="#27152a" offset="0"/>
        <stop stop-color="#12111a" offset="0.56"/>
        <stop stop-color="#06070c" offset="1"/>
      </linearGradient>
      <filter id="signGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="signGrime" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="3" seed="13"/>
        <feComponentTransfer><feFuncA type="table" tableValues="0 0.18"/></feComponentTransfer>
      </filter>
    </defs>
    <path d="M54 0v25M266 0v25" stroke="#5b415f" stroke-width="2" opacity="0.55"/>
    <path d="M58 0v24M270 0v24" stroke="#1a1320" stroke-width="5"/>
    <rect x="14" y="18" width="292" height="106" rx="6" fill="url(#signFace)" stroke="#4a3b5b" stroke-width="3"/>
    <rect x="28" y="32" width="58" height="58" rx="7" fill="#ff416f" filter="url(#signGlow)"/>
    <text x="57" y="72" text-anchor="middle" font-family="Inter,Arial" font-size="32" font-weight="900" fill="#130915">13</text>
    <text x="105" y="56" font-family="Inter,Arial" font-size="23" font-weight="900" fill="#ffd3de">PLATFORM 13</text>
    <text x="106" y="84" font-family="Inter,Arial" font-size="13" font-weight="800" fill="#8e88a2">LOWER RING / TICKET HALL</text>
    <path d="M25 105h270" stroke="#873d64" stroke-width="3" opacity="0.7"/>
    <path d="M109 101h120" stroke="#ff4779" stroke-width="3" opacity="0.65" filter="url(#signGlow)"/>
    <path d="M14 126h292" stroke="#05050a" stroke-width="8" opacity="0.8"/>
    <path d="M23 28c54-10 218-9 276 2M27 116c70 8 197 8 267-2" stroke="#ffffff" stroke-width="1" opacity="0.07"/>
    <path d="M31 26h9M231 28h11M283 112h12M116 117h18M172 31h20" stroke="#ff386e" stroke-width="2" opacity="0.34"/>
    <path d="M98 64h15M262 53h24M250 72h18M249 89h31" stroke="#6d5e70" stroke-width="3" stroke-linecap="round"/>
    <rect x="14" y="18" width="292" height="106" fill="#fff" filter="url(#signGrime)" opacity="0.5"/>
  `
);

const BACKPACK_PANEL_SPRITE = createStaticSprite(
  "sprite_scene_backpack_panel",
  "Open Backpack Inventory Panel",
  769,
  464,
  ""
);

const BOARDING_TRAIN_SPRITE = createStaticSprite(
  "sprite_scene_boarding_train",
  "Arriving Subway Car",
  1868,
  547,
  ""
);

export const INTERACTION_TRIGGER_SPRITE = createStaticSprite(
  "sprite_scene_e_trigger_point",
  "Reusable Eye Inspect Hotspot",
  80,
  80,
  `
    <defs>
      <filter id="hotspotShadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.42"/>
      </filter>
    </defs>
    <circle cx="40" cy="40" r="30" fill="rgba(13,15,18,.34)" stroke="rgba(255,255,255,.76)" stroke-width="3" stroke-dasharray="6 5" filter="url(#hotspotShadow)"/>
    <circle cx="40" cy="40" r="17" fill="rgba(5,5,6,.62)" stroke="rgba(255,255,255,.42)" stroke-width="2"/>
    <path d="M40 13v13M40 54v13M13 40h13M54 40h13" stroke="#f3f0e8" stroke-width="3" stroke-linecap="round" opacity=".82"/>
    <ellipse cx="40" cy="40" rx="21" ry="13" fill="rgba(244,240,232,.86)" stroke="rgba(20,20,20,.82)" stroke-width="3"/>
    <circle cx="40" cy="40" r="6" fill="#141416"/>
    <circle cx="42" cy="38" r="2" fill="#f4f0e8" opacity=".8"/>
  `
);

export const SCENE_KIT_ASSETS: GameAsset[] = [
  createStaticAsset({
    id: INSPECT_TRIGGER_ASSET_ID,
    name: "Eye Inspect Hotspot / Reusable",
    role: "prop",
    sprite: INTERACTION_TRIGGER_SPRITE,
    defaultAnimationId: "clip_e_trigger_idle",
    animations: [
      {
        id: "clip_eye_inspect_idle",
        name: "Eye Inspect Idle",
        actionName: "interact",
        direction: "none",
        sprite: INTERACTION_TRIGGER_SPRITE,
        binding: {
          actionName: "interact",
          triggerType: "mouse",
          triggerValue: "click",
          gameState: "hotspot.nearby",
          notes: "Reusable invisible/visible inspect hotspot. Drag it into the scene, set prompt text/style/radius on the layer, and click the eye icon when the player is nearby.",
        },
        loop: false,
      },
    ],
    binding: {
      actionName: "interact",
      triggerType: "mouse",
      triggerValue: "click",
      gameState: "hotspot.nearby",
      notes: "Reusable inspect hotspot with configurable eye prompt text, prompt style, font size, trigger radius, and prompt offset.",
    },
    tags: ["scene-kit", "interaction-trigger", "inspect-hotspot", "hotspot", "reusable"],
  }),
  createStaticAsset({
    id: "asset_scene_ticket_machine",
    name: "Ruined Ticket Machine / Interact",
    role: "prop",
    sprite: TICKET_MACHINE_SPRITE,
    defaultAnimationId: "clip_ticket_machine_idle",
    animations: [
      {
        id: "clip_ticket_machine_idle",
        name: "Ticket Machine Idle",
        actionName: "interact",
        direction: "none",
        sprite: TICKET_MACHINE_SPRITE,
        binding: {
          actionName: "interact",
          triggerType: "mouse",
          triggerValue: "click",
          gameState: "ticketMachine.nearby",
          notes: "Reusable inspectable prop. When the player is near it, the scene shows a clickable eye prompt.",
        },
        loop: false,
      },
    ],
    binding: {
      actionName: "interact",
      triggerType: "mouse",
      triggerValue: "click",
      gameState: "ticketMachine.nearby",
      notes: "Reusable inspectable prop. When the player is near it, the scene shows a clickable eye prompt.",
    },
    tags: ["scene-kit", "interactable", "inspectable", "ticket-machine", "reusable"],
  }),
  createStaticAsset({
    id: "asset_scene_backpack_ui",
    name: "Backpack HUD / Inventory",
    role: "prop",
    sprite: BACKPACK_UI_SPRITE,
    defaultAnimationId: "clip_backpack_hud_idle",
    animations: [
      {
        id: "clip_backpack_hud_idle",
        name: "Backpack HUD Idle",
        actionName: "inventory_hud",
        direction: "none",
        sprite: BACKPACK_UI_SPRITE,
        binding: {
          actionName: "inventory_hud",
          triggerType: "state",
          triggerValue: "inventory.visible",
          gameState: "ui.backpack",
          notes: "Screen-space HUD layer. Uses parallax 0 so it stays fixed while the camera moves.",
        },
        loop: false,
      },
    ],
    binding: {
      actionName: "inventory_hud",
      triggerType: "state",
      triggerValue: "inventory.visible",
      gameState: "ui.backpack",
      notes: "Screen-space HUD layer. Uses parallax 0 so it stays fixed while the camera moves.",
    },
    tags: ["scene-kit", "ui", "backpack", "reusable"],
  }),
  createStaticAsset({
    id: "asset_scene_backpack_panel",
    name: "Open Backpack Inventory Panel / UI",
    role: "prop",
    sprite: BACKPACK_PANEL_SPRITE,
    defaultAnimationId: "clip_backpack_panel_open",
    animations: [
      {
        id: "clip_backpack_panel_open",
        name: "Open Backpack Panel",
        actionName: "inventory_open",
        direction: "none",
        sprite: BACKPACK_PANEL_SPRITE,
        binding: {
          actionName: "inventory_open",
          triggerType: "state",
          triggerValue: "inventory.open",
          gameState: "ui.backpack.open",
          notes: "PNG overlay shown when the backpack HUD icon is clicked or I is pressed.",
        },
        loop: false,
      },
    ],
    binding: {
      actionName: "inventory_open",
      triggerType: "state",
      triggerValue: "inventory.open",
      gameState: "ui.backpack.open",
      notes: "PNG overlay shown when the backpack HUD icon is clicked or I is pressed.",
    },
    tags: ["scene-kit", "ui", "backpack-panel", "png", "reusable"],
  }),
  createStaticAsset({
    id: "asset_scene_station_sign_13",
    name: "Platform 13 Hanging Sign / Prop",
    role: "prop",
    sprite: STATION_SIGN_13_SPRITE,
    defaultAnimationId: "clip_station_sign_13_idle",
    animations: [
      {
        id: "clip_station_sign_13_idle",
        name: "Platform 13 Sign Idle",
        actionName: "station_sign",
        direction: "none",
        sprite: STATION_SIGN_13_SPRITE,
        binding: {
          actionName: "station_sign",
          triggerType: "state",
          triggerValue: "station.line13",
          gameState: "scene.stationSign",
          notes: "Reusable subway sign prop.",
        },
        loop: false,
      },
    ],
    binding: {
      actionName: "station_sign",
      triggerType: "state",
      triggerValue: "station.line13",
      gameState: "scene.stationSign",
      notes: "Reusable subway sign prop.",
    },
    tags: ["scene-kit", "station-sign", "line-13", "reusable"],
  }),
  createStaticAsset({
    id: BOARDING_TRAIN_ASSET_ID,
    name: "Arriving Subway Car / Board",
    role: "prop",
    sprite: BOARDING_TRAIN_SPRITE,
    defaultAnimationId: "clip_boarding_train_idle",
    animations: [
      {
        id: "clip_boarding_train_idle",
        name: "Boarding Train Ready",
        actionName: "board_vehicle",
        direction: "none",
        sprite: BOARDING_TRAIN_SPRITE,
        binding: {
          actionName: "board_vehicle",
          triggerType: "mouse",
          triggerValue: "click",
          gameState: "vehicle.readyToBoard",
          notes: "Reusable side-view boarding vehicle. It renders in front of the player, but window alpha must stay transparent so the player can walk behind it and remain visible through the glass. Click the eye prompt to board when nearby.",
        },
        loop: false,
      },
    ],
    binding: {
      actionName: "board_vehicle",
      triggerType: "mouse",
      triggerValue: "click",
      gameState: "vehicle.readyToBoard",
      notes: "Reusable side-view boarding vehicle. It approaches from the foreground, accepts a click on the nearby eye prompt once stopped, and keeps transparent windows for behind-player visibility.",
    },
    tags: ["scene-kit", "vehicle", "boarding", "interactable", "inspectable", "png", "transparent-windows", "side-view", "reusable"],
  }),
];
