import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { PRESET_SPRITES } from "./presets";
import { downloadJson, downloadUrl } from "./app/downloads";
import type { AppMode, BackgroundMode, SheetOnlySelectionKind, WorkspaceTab } from "./app/types";
import { useGameWorkspaceActions } from "./app/useGameWorkspaceActions";
import {
  DEFAULT_WALK_SPEED,
  INTERACTION_PRESETS,
  SHOW_SCENE_KIT_TOOLS,
  VIEWPORT_PRESETS,
  checkerStyle,
  roleLabels,
  triggerLabels,
} from "./app/workspaceConfig";
import {
  DEFAULT_BINDING as defaultBinding,
  clipButtonText,
  defaultGameStateForTrigger,
  defaultTriggerValueForType,
  safeName,
  splitTags,
} from "./domain/assets/assetModel";
import {
  BOARDING_TRAIN_ASSET_ID,
  BUILT_IN_SCENE_KIT_ASSET_IDS,
  INSPECT_TRIGGER_ASSET_ID,
  SCENE_KIT_ASSETS,
} from "./domain/scene-kit/sceneKitAssets";
import {
  backgroundLayerFilter,
  combineFilters,
  NEON_CONTACT_SHADOW,
  NEON_LAYER_LIGHTING,
  NEON_SCENE_LIGHTING,
  formatViewportRatio,
  interactionZoneBounds,
  isCameraZoneInteraction,
  isLightZoneInteraction,
  isSceneVisualLayer,
  isTransformableSceneLayer,
  layerInteractionSettings,
  layerWorldBounds,
  resolveAssetClip,
  resolveAssetSprite,
  sceneFilter,
  sceneLayerRenderFilter,
  sceneLighting,
  sceneViewportHeight,
  sceneViewportWidth,
} from "./domain/scene/sceneModel";
import {
  createDefaultScene,
  prepareSceneForEditor,
} from "./domain/scene/sceneFactory";
import { normalizeStartUiCollection, normalizeStartUiSettings } from "./domain/scene/startUiModel";
import {
  type SceneObjectTarget,
} from "./domain/scene/sceneLayerOperations";
import {
  getFrameSize,
  spriteFrame,
  spriteFrameTotal,
  spriteGridColumns,
  spriteGridRows,
} from "./domain/sprites/spriteUtils";
import { CommunityHelp } from "./features/community-help";
import { CurrentActionPanel } from "./features/current-action";
import { SceneBackgroundLayer, SceneGlobalControls, SceneLightingStrip, SceneStageCanvas, SceneStageEnvironment, SceneStageOverlays, SceneToolbar, SceneVisualLayerStack, useSceneHistory, useSceneRuntimeInteractions, useSceneStageLayout, useSceneStagePointerInteractions, type SceneCameraVisualEffect, type SceneDialogueOverlayState, type SceneHeldDirection, type SceneInteractionPromptEntry } from "./features/scene-editor";
import { SceneInspectorPanel } from "./features/scene-inspector";
import { SceneLayerControlsPanel, SceneLayerRail, useSceneLayerClipboard } from "./features/scene-layers";
import { buildSceneFlowNodes, SceneFlowCanvas, SceneStartUiPanel, useSceneFlowLibraryActions, type SceneVehiclePhase } from "./features/scene-flow";
import { SceneContextMenu } from "./features/scene-context-menu";
import { SceneSpritesheetCard, SceneSpritesheetsEmptyState, SceneSpritesheetsHeader, type SceneSpritesheetEntry } from "./features/scene-spritesheets";
import { ModePicker } from "./features/mode-picker";
import { buildSheetOnlyEntries, SheetOnlyGallery, type SheetOnlyRecolorSaveRequest } from "./features/sheet-only-gallery";
import { SpritesheetImporterPanel } from "./features/spritesheet-importer";
import { WorkspaceStageHeader } from "./features/workspace-stage-header";
import {
  AvailableSpritesPanel,
  ConfirmedAssetsPanel,
  GlobalSceneLightingPanel,
  MotionSpeedPanel,
  ReusableSceneKitPanel,
  SimulationScreenPanel,
} from "./features/workspace-right-panel";
import { ActionPreviewPanel, BlueprintPanel, FramesGridPanel, SheetPreviewPanel } from "./features/workspace-stage-views";
import { TriggerTestPanel, WorkspaceMessages } from "./features/workspace-sidebar";
import {
  fetchGameLibrary,
  fetchLatestSprite,
} from "./services/gameLibraryApi";
import { fetchGeneratedAssets, type RepositoryGeneratedImage } from "./services/generatedAssetsApi";
import { clamp } from "./shared/math";
import {
  ActionBinding,
  ActionTriggerType,
  AnimationSprite,
  AssetRole,
  GameAsset,
  GameLibrary,
  GameScene,
  GameStartUiSettings,
} from "./types";

type ScenePanelResizeHandle = "layers" | "inspector";
type ScenePanelResizeState = {
  handle: ScenePanelResizeHandle;
  startX: number;
  startLayerWidth: number;
  startInspectorWidth: number;
};
type SceneContextMenuState = {
  x: number;
  y: number;
  layerId: string;
  target: SceneObjectTarget;
};
export default function App() {
  const [sprites, setSprites] = useState<AnimationSprite[]>(PRESET_SPRITES);
  const [activeSprite, setActiveSprite] = useState<AnimationSprite>(PRESET_SPRITES[0]);
  const [assets, setAssets] = useState<GameAsset[]>([]);
  const [repositoryImages, setRepositoryImages] = useState<RepositoryGeneratedImage[]>([]);
  const [scenes, setScenes] = useState<GameScene[]>([]);
  const [scene, setScene] = useState<GameScene>(() => prepareSceneForEditor(createDefaultScene()));
  const [startUis, setStartUis] = useState<GameStartUiSettings[]>(() => [normalizeStartUiSettings(undefined)]);
  const [activeStartUiId, setActiveStartUiId] = useState("start_ui_main");
  const [selectedLayerId, setSelectedLayerId] = useState<string>("layer_ground");
  const [selectedInteractionZoneLayerId, setSelectedInteractionZoneLayerId] = useState<string | null>(null);
  const [appMode, setAppMode] = useState<AppMode>("home");
  const [tab, setTab] = useState<WorkspaceTab>("scenes");
  const [activeFrame, setActiveFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [heldDirection, setHeldDirection] = useState<SceneHeldDirection>(null);
  const [fps, setFps] = useState(12);
  const [walkSpeed, setWalkSpeed] = useState(DEFAULT_WALK_SPEED);
  const [bgMode, setBgMode] = useState<BackgroundMode>("checker");
  const [sheetDataUrl, setSheetDataUrl] = useState<string | null>(null);
  const [sheetColumns, setSheetColumns] = useState(4);
  const [binding, setBinding] = useState<ActionBinding>(defaultBinding);
  const [role, setRole] = useState<AssetRole>("player");
  const [tagsText, setTagsText] = useState("confirmed, side-scroller");
  const [importSheetDataUrl, setImportSheetDataUrl] = useState<string | null>(null);
  const [importSheetSize, setImportSheetSize] = useState<[number, number] | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [importAssetName, setImportAssetName] = useState("Imported Animation");
  const [importActionName, setImportActionName] = useState("loop");
  const [importFrameWidth, setImportFrameWidth] = useState(256);
  const [importFrameHeight, setImportFrameHeight] = useState(256);
  const [importFrameCount, setImportFrameCount] = useState(12);
  const [importColumns, setImportColumns] = useState(4);
  const [importRole, setImportRole] = useState<AssetRole>("effect");
  const [importTriggerType, setImportTriggerType] = useState<ActionTriggerType>("auto");
  const [importTriggerValue, setImportTriggerValue] = useState(defaultTriggerValueForType("auto"));
  const [importGameState, setImportGameState] = useState(defaultGameStateForTrigger("auto", "loop"));
  const [importTagsText, setImportTagsText] = useState("imported, spritesheet");
  const [importLoop, setImportLoop] = useState(true);
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [layerDropTargetId, setLayerDropTargetId] = useState<string | null>(null);
  const [expandedSpritesheetKey, setExpandedSpritesheetKey] = useState<string | null>(null);
  const [scenePanelWidths, setScenePanelWidths] = useState({ layers: 120, inspector: 220 });
  const [sceneContextMenu, setSceneContextMenu] = useState<SceneContextMenuState | null>(null);
  const [isLayerLibraryOpen, setIsLayerLibraryOpen] = useState(false);
  const [isSavingStartUi, setIsSavingStartUi] = useState(false);
  const [sheetOnlyHasSelection, setSheetOnlyHasSelection] = useState(false);
  const [sheetOnlySelectionKind, setSheetOnlySelectionKind] = useState<SheetOnlySelectionKind>(null);
  const [sheetOnlySelectionTitle, setSheetOnlySelectionTitle] = useState("");
  const [sheetOnlySelectedAssetId, setSheetOnlySelectedAssetId] = useState<string | null>(null);
  const [isSavingRecolorVariant, setIsSavingRecolorVariant] = useState(false);
  const [interactionToast, setInteractionToast] = useState("");
  const [activeDialogue, setActiveDialogue] = useState<SceneDialogueOverlayState | null>(null);
  const [cameraEffect, setCameraEffect] = useState<SceneCameraVisualEffect | null>(null);
  const [isBackpackOpen, setIsBackpackOpen] = useState(false);
  const [vehiclePhase, setVehiclePhase] = useState<SceneVehiclePhase>("approaching");
  const [notice, setNotice] = useState("Confirmed spritesheets can be saved as game action assets.");
  const [error, setError] = useState<string | null>(null);
  const scenePanelResizeRef = useRef<ScenePanelResizeState | null>(null);
  const layerDragRef = useRef<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sceneStateRef = useRef<GameScene>(scene);
  const selectedLayerIdRef = useRef(selectedLayerId);

  useSceneHistory({
    enabled: tab === "scene",
    isAutomaticSceneMotion: isPlaying || Boolean(heldDirection),
    scene,
    sceneStateRef,
    selectedLayerIdRef,
    setNotice,
    setScene,
    setSceneContextMenu,
    setSelectedInteractionZoneLayerId,
    setSelectedLayerId,
  });

  const {
    copyLayerToSceneClipboard,
    cutLayerToSceneClipboard,
    duplicateSceneLayer,
    duplicateSelectedLayer,
    pasteLayerFromSceneClipboard,
    sceneClipboard,
  } = useSceneLayerClipboard({
    enabled: tab === "scene",
    sceneStateRef,
    selectedLayerIdRef,
    setNotice,
    setScene,
    setSceneContextMenu,
    setSelectedInteractionZoneLayerId,
    setSelectedLayerId,
  });
  const {
    sceneControlsHeight,
    sceneGlobalControlsRef,
    stageShellRef,
    stageShellSize,
  } = useSceneStageLayout({
    inspectorWidth: scenePanelWidths.inspector,
    layerWidth: scenePanelWidths.layers,
    tab,
  });

  const frames = activeSprite.frames || [];
  const activeSpriteFrameIndex = frames.length ? activeFrame % frames.length : 0;
  const currentFrame = spriteFrame(activeSprite, activeFrame);
  const [frameW, frameH] = getFrameSize(activeSprite);
  const frameRatio = `${frameW} / ${frameH}`;
  const isTallFrame = frameH > frameW * 1.25;
  const selectedLayer = scene.layers.find(layer => layer.id === selectedLayerId);
  const backgroundLayer = scene.layers.find(layer => layer.type === "background");
  const groundLayer = scene.layers.find(layer => layer.type === "ground");

  useEffect(() => {
    if (selectedLayer || !scene.layers.length) return;
    const topLayer = [...scene.layers].sort((a, b) => b.zIndex - a.zIndex)[0];
    if (topLayer) setSelectedLayerId(topLayer.id);
  }, [scene.layers, selectedLayer]);
  const sceneLight = sceneLighting(scene);
  const selectedLayerLight = selectedLayer?.lighting || NEON_LAYER_LIGHTING;
  const selectedLayerShadow = selectedLayer?.shadow || NEON_CONTACT_SHADOW;
  const viewportWidth = sceneViewportWidth(scene);
  const viewportHeight = sceneViewportHeight(scene);
  const stageFitScale = (() => {
    if (!stageShellSize.width || !stageShellSize.height) return 1;
    const availableWidth = Math.max(180, stageShellSize.width - 28);
    const controlsSpace = sceneControlsHeight ? sceneControlsHeight + 32 : 112;
    const availableHeight = Math.max(180, stageShellSize.height - controlsSpace);
    return Math.min(1, availableWidth / Math.max(1, viewportWidth), availableHeight / Math.max(1, viewportHeight));
  })();
  const stageSize = {
    width: Math.max(1, Math.round(viewportWidth * stageFitScale)),
    height: Math.max(1, Math.round(viewportHeight * stageFitScale)),
  };
  const selectedViewportPreset = VIEWPORT_PRESETS.find(preset => preset.id === scene.viewportPreset);
  const viewportRatioLabel = formatViewportRatio(viewportWidth, viewportHeight);
  const cameraMax = Math.max(0, scene.width - viewportWidth);
  const cameraMaxY = Math.max(0, scene.height - viewportHeight);
  const stageScaleX = stageSize.width / Math.max(1, viewportWidth);
  const stageScaleY = stageSize.height / Math.max(1, viewportHeight);
  const spriteStageScale = Math.min(stageScaleX, stageScaleY);
  const compactScenePanels = stageShellSize.width > 0 && stageShellSize.width < 340;
  const sceneLayerPanelWidth = compactScenePanels ? Math.min(scenePanelWidths.layers, 84) : scenePanelWidths.layers;
  const sceneInspectorPanelWidth = compactScenePanels ? Math.min(scenePanelWidths.inspector, 148) : scenePanelWidths.inspector;
  const sceneCenterMinWidth = compactScenePanels ? 220 : 180;

  const allAssets = useMemo(() => {
    return [...SCENE_KIT_ASSETS, ...assets];
  }, [assets]);

  const assetById = useMemo(() => {
    return new Map(allAssets.map(asset => [asset.id, asset]));
  }, [allAssets]);

  const {
    clearPointerState,
    clearSceneSelection,
    stagePointerDown,
    stagePointerMove,
    startInteractionZoneDrag,
    startInteractionZoneResize,
    startLayerResize,
    updateSceneLayer,
  } = useSceneStagePointerInteractions({
    assetById,
    scene,
    sceneStateRef,
    spriteStageScale,
    stageRef,
    stageScaleX,
    stageScaleY,
    setIsPlaying,
    setScene,
    setSelectedInteractionZoneLayerId,
    setSelectedLayerId,
  });

  const layerLibraryAssets = useMemo(() => {
    return assets.filter(asset => Boolean(resolveAssetSprite(asset)?.frames.length));
  }, [assets]);

  const selectedInteractionZoneLayer = selectedInteractionZoneLayerId
    ? scene.layers.find(layer => layer.id === selectedInteractionZoneLayerId)
    : undefined;
  const selectedInteractionZoneAsset = selectedInteractionZoneLayer?.assetId
    ? assetById.get(selectedInteractionZoneLayer.assetId)
    : undefined;
  const selectedInteractionZoneSettings = selectedInteractionZoneLayer
    ? layerInteractionSettings(selectedInteractionZoneLayer, selectedInteractionZoneAsset)
    : null;

  useEffect(() => {
    if (!selectedInteractionZoneLayerId) return;
    if (scene.layers.some(layer => layer.id === selectedInteractionZoneLayerId && layer.interaction?.enabled)) return;
    setSelectedInteractionZoneLayerId(null);
  }, [scene.layers, selectedInteractionZoneLayerId]);

  const sceneSpritesheetEntries = useMemo<SceneSpritesheetEntry[]>(() => {
    return scene.layers
      .filter(layer => layer.assetId && isSceneVisualLayer(layer))
      .flatMap(layer => {
        const asset = assetById.get(layer.assetId!);
        if (!asset) return [];
        const clips = asset.animations?.length ? asset.animations : [undefined];
        return clips.map(clip => {
          const sprite = clip?.sprite || asset.sprite;
          const [frameWidth, frameHeight] = getFrameSize(sprite);
          return {
            key: `${layer.id}_${clip?.id || asset.sprite.id}`,
            layer,
            asset,
            clip,
            sprite,
            frameWidth,
            frameHeight,
          };
        });
      });
  }, [assetById, scene.layers]);

  const sheetOnlyEntries = useMemo(() => buildSheetOnlyEntries({
    assets,
    repositoryImages,
    sprites,
  }), [assets, repositoryImages, sprites]);

  const selectedLayerAsset = selectedLayer?.assetId ? assetById.get(selectedLayer.assetId) : undefined;
  const selectedLayerClip = resolveAssetClip(selectedLayerAsset, selectedLayer);
  const selectedLayerInteraction = selectedLayer ? layerInteractionSettings(selectedLayer, selectedLayerAsset) : null;
  const selectedLayerSprite = resolveAssetSprite(selectedLayerAsset, selectedLayer);
  const selectedAssetEditable = Boolean(selectedLayerAsset && assets.some(asset => asset.id === selectedLayerAsset.id));
  const selectedLayerSpriteFrameIndex = selectedLayerSprite?.frames.length ? activeFrame % selectedLayerSprite.frames.length : 0;
  const selectedLayerFrameSize = selectedLayerSprite ? getFrameSize(selectedLayerSprite) : [0, 0];
  const selectedLayerSpriteFrameCount = spriteFrameTotal(selectedLayerSprite);
  const selectedLayerSpriteColumns = spriteGridColumns(selectedLayerSprite);
  const selectedLayerSpriteRows = spriteGridRows(selectedLayerSprite);
  const selectedLayerSpriteSheetSize = selectedLayerSprite?.sheetSize || selectedLayerFrameSize;
  const selectedLayerSpriteSource = selectedLayerSprite?.rawSpritesheetPng || selectedLayerSprite?.spritesheetPng || "";
  const selectedLayerClipFps = Math.round(selectedLayerClip?.fps || selectedLayerSprite?.fps || fps);
  const selectedLayerSpriteEditableGrid = Boolean(selectedAssetEditable && selectedLayerSpriteSource && selectedLayerSprite?.sheetSize?.length);
  const selectedLayerIsAvatar = selectedLayerAsset?.role === "player" || selectedLayerAsset?.role === "npc";
  const savedSceneCards = useMemo(() => scenes.filter(savedScene => savedScene.id !== scene.id), [scene.id, scenes]);
  const startUiSceneOptions = useMemo(() => {
    const sceneMap = new Map<string, GameScene>();
    [scene, ...scenes].forEach(item => {
      if (item?.id && !sceneMap.has(item.id)) sceneMap.set(item.id, item);
    });
    return Array.from(sceneMap.values());
  }, [scene, scenes]);
  const hasVisibleBackgroundImage = Boolean(backgroundLayer?.visible && backgroundLayer.imageUrl);
  const sceneFlowNodes = useMemo(() => buildSceneFlowNodes({
    currentScene: scene,
    currentBackground: backgroundLayer,
    savedScenes: savedSceneCards,
    startUis,
  }), [backgroundLayer, savedSceneCards, scene, startUis]);
  const activeStartUi = useMemo(() => (
    startUis.find(settings => settings.id === activeStartUiId) || startUis[0] || normalizeStartUiSettings(undefined, startUiSceneOptions)
  ), [activeStartUiId, startUiSceneOptions, startUis]);
  const {
    createStartUiNode,
    deleteSceneNode,
    deleteStartUiNode,
    duplicateSceneNode,
    duplicateStartUiNode,
    loadSavedScene,
    pasteSceneNode,
    saveCompletedScene,
    saveScene,
    saveStartUiSettings,
    startNewScene,
  } = useSceneFlowLibraryActions({
    assetById,
    scene,
    scenes,
    startUiSceneOptions,
    startUis,
    setActiveStartUiId,
    setError,
    setIsBackpackOpen,
    setIsSavingStartUi,
    setNotice,
    setScene,
    setScenes,
    setSelectedLayerId,
    setStartUis,
    setTab,
    setVehiclePhase,
  });
  const sceneFrameCount = useMemo(() => {
    return scene.layers.reduce((maxFrameCount, layer) => {
      if (!layer.visible || !isSceneVisualLayer(layer)) return maxFrameCount;
      const asset = layer.assetId ? assetById.get(layer.assetId) : undefined;
      const sprite = resolveAssetSprite(asset, layer);
      return Math.max(maxFrameCount, sprite?.frames.length || 0);
    }, activeSprite.frames.length || 0);
  }, [activeSprite.frames.length, assetById, scene.layers]);
  const sceneHasAutoPlayingLayer = useMemo(() => {
    return scene.layers.some(layer => {
      if (!layer.visible || !isSceneVisualLayer(layer)) return false;
      const asset = layer.assetId ? assetById.get(layer.assetId) : undefined;
      const clip = resolveAssetClip(asset, layer);
      return clip?.loop === true && clip.binding?.triggerType === "auto";
    });
  }, [assetById, scene.layers]);
  const hasBoardingTrainLayer = useMemo(() => {
    return scene.layers.some(layer => layer.visible && layer.assetId === BOARDING_TRAIN_ASSET_ID);
  }, [scene.layers]);
  const interactionLightZones = useMemo(() => {
    return scene.layers
      .filter(layer => layer.visible && layer.assetId && isSceneVisualLayer(layer))
      .map(layer => {
        const asset = assetById.get(layer.assetId!);
        if (!asset) return null;
        const interaction = layerInteractionSettings(layer, asset);
        if (!interaction?.enabled || !isLightZoneInteraction(interaction)) return null;
        const attachedLayer = interaction.lightAttachToLayerId
          ? scene.layers.find(item => item.id === interaction.lightAttachToLayerId && item.visible)
          : undefined;
        if (attachedLayer) {
          const attachedAsset = attachedLayer.assetId ? assetById.get(attachedLayer.assetId) : undefined;
          const attachedBounds = layerWorldBounds(attachedLayer, attachedAsset);
          const width = Math.max(24, interaction.zoneWidth || attachedBounds.width || 220);
          const height = Math.max(24, interaction.zoneHeight || attachedBounds.height || 180);
          return {
            layer,
            interaction,
            bounds: {
              left: attachedBounds.centerX - width / 2 + (interaction.zoneOffsetX || 0),
              right: attachedBounds.centerX + width / 2 + (interaction.zoneOffsetX || 0),
              top: attachedBounds.centerY - height / 2 + (interaction.zoneOffsetY || 0),
              bottom: attachedBounds.centerY + height / 2 + (interaction.zoneOffsetY || 0),
              width,
              height,
              centerX: attachedBounds.centerX + (interaction.zoneOffsetX || 0),
              centerY: attachedBounds.centerY + (interaction.zoneOffsetY || 0),
            },
          };
        }
        return { layer, interaction, bounds: interactionZoneBounds(layer, asset, interaction) };
      })
      .filter(Boolean);
  }, [assetById, scene.layers]);
  const nearbyInteraction = useMemo(() => {
    const playerLayer = scene.layers.find(layer => {
      if (!layer.visible || !layer.assetId || !isSceneVisualLayer(layer)) return false;
      return assetById.get(layer.assetId)?.role === "player";
    });
    if (!playerLayer) return null;
    const playerAsset = assetById.get(playerLayer.assetId!);
    const playerBounds = layerWorldBounds(playerLayer, playerAsset);
    const interactableLayers = scene.layers
      .filter(layer => layer.visible && layer.assetId && isSceneVisualLayer(layer))
      .map(layer => {
        const asset = assetById.get(layer.assetId!);
        if (!asset) return null;
        const interaction = layerInteractionSettings(layer, asset);
        if (!interaction?.enabled || asset.role === "player") return null;
        if (interaction.triggerMode === "auto" || isLightZoneInteraction(interaction)) return null;
        if (asset.id === BOARDING_TRAIN_ASSET_ID && vehiclePhase !== "ready") return null;
        const bounds = interactionZoneBounds(layer, asset, interaction);
        const dx = Math.max(bounds.left - playerBounds.centerX, playerBounds.centerX - bounds.right, 0);
        const dy = Math.max(bounds.top - playerBounds.centerY, playerBounds.centerY - bounds.bottom, 0);
        const distance = Math.hypot(dx, dy);
        return { layer, asset, bounds, distance, interaction };
      })
      .filter(Boolean)
      .sort((a, b) => a!.distance - b!.distance);
    const nearest = interactableLayers[0];
    if (!nearest || nearest.distance > nearest.interaction.triggerRadius) return null;
    return nearest;
  }, [assetById, scene.layers, vehiclePhase]);
  const autoCameraInteraction = useMemo<SceneInteractionPromptEntry | null>(() => {
    const playerLayer = scene.layers.find(layer => {
      if (!layer.visible || !layer.assetId || !isSceneVisualLayer(layer)) return false;
      return assetById.get(layer.assetId)?.role === "player";
    });
    if (!playerLayer) return null;
    const playerAsset = assetById.get(playerLayer.assetId!);
    const playerBounds = layerWorldBounds(playerLayer, playerAsset);
    const interactableLayers = scene.layers
      .filter(layer => layer.visible && layer.assetId && isSceneVisualLayer(layer))
      .map(layer => {
        const asset = assetById.get(layer.assetId!);
        if (!asset) return null;
        const interaction = layerInteractionSettings(layer, asset);
        if (!interaction?.enabled || !isCameraZoneInteraction(interaction) || interaction.triggerMode !== "auto") return null;
        const bounds = interactionZoneBounds(layer, asset, interaction);
        const inside =
          playerBounds.centerX >= bounds.left &&
          playerBounds.centerX <= bounds.right &&
          playerBounds.centerY >= bounds.top &&
          playerBounds.centerY <= bounds.bottom;
        if (!inside) return null;
        const distance = Math.hypot(playerBounds.centerX - bounds.centerX, playerBounds.centerY - bounds.centerY);
        return { layer, asset, bounds, distance, interaction };
      })
      .filter(Boolean)
      .sort((a, b) => a!.distance - b!.distance);
    const nearest = interactableLayers[0];
    return nearest ? { asset: nearest.asset, bounds: nearest.bounds, interaction: nearest.interaction, layer: nearest.layer } : null;
  }, [assetById, scene.layers]);

  const scenePayload = useMemo(() => ({ ...scene, layers: [...scene.layers] }), [scene]);
  const { advanceDialogue, triggerNearbyInteraction } = useSceneRuntimeInteractions({
    activeDialogue,
    assetById,
    assets,
    autoCameraInteraction,
    hasBoardingTrainLayer,
    heldDirection,
    interactionToast,
    loadSavedScene,
    nearbyInteraction,
    sceneStateRef,
    scenes,
    vehiclePhase,
    walkSpeed,
    setActiveDialogue,
    setActiveFrame,
    setActiveSprite,
    setCameraEffect,
    setHeldDirection,
    setInteractionToast,
    setIsBackpackOpen,
    setIsPlaying,
    setNotice,
    setScene,
    setSelectedLayerId,
    setVehiclePhase,
  });

  useEffect(() => {
    sceneStateRef.current = scene;
  }, [scene]);

  useEffect(() => {
    selectedLayerIdRef.current = selectedLayerId;
  }, [selectedLayerId]);

  useEffect(() => {
    if (!sceneContextMenu) return;
    const closeMenu = () => setSceneContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [sceneContextMenu]);

  useEffect(() => {
    const handleMove = (event: globalThis.PointerEvent) => {
      if (layerDragRef.current) {
        const targetLayerId = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest<HTMLElement>("[data-layer-row-id]")
          ?.dataset.layerRowId;
        setLayerDropTargetId(targetLayerId && targetLayerId !== layerDragRef.current ? targetLayerId : null);
      }

      const resize = scenePanelResizeRef.current;
      if (!resize) return;
      const deltaX = event.clientX - resize.startX;
      setScenePanelWidths({
        layers: resize.handle === "layers"
          ? clamp(resize.startLayerWidth + deltaX, 88, 260)
          : resize.startLayerWidth,
        inspector: resize.handle === "inspector"
          ? clamp(resize.startInspectorWidth - deltaX, 150, 360)
          : resize.startInspectorWidth,
      });
    };
    const handleUp = (event: globalThis.PointerEvent) => {
      if (layerDragRef.current) {
        finishLayerPointerReorder(event.clientX, event.clientY);
      }
      scenePanelResizeRef.current = null;
      document.body.classList.remove("resizing-scene-panels");
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, []);

  useEffect(() => {
    const hasBuiltInSceneKitLayer = scene.layers.some(layer => layer.assetId && BUILT_IN_SCENE_KIT_ASSET_IDS.has(layer.assetId));
    if (!hasBuiltInSceneKitLayer) return;
    setScene(prev => prepareSceneForEditor(prev));
    setIsBackpackOpen(false);
  }, [scene.layers]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchLatestSprite().catch(() => null),
      fetchGameLibrary().catch(() => ({ assets: [], scenes: [] })),
      fetchGeneratedAssets().catch(() => []),
    ]).then(([latestSprite, libraryData, generatedFiles]: [AnimationSprite | null, GameLibrary, RepositoryGeneratedImage[]]) => {
      if (cancelled) return;
      if (latestSprite) {
        setSprites(prev => [latestSprite, ...prev.filter(sprite => sprite.id !== latestSprite.id)]);
        setActiveSprite(latestSprite);
      }
      if (Array.isArray(libraryData.assets)) setAssets(libraryData.assets);
      setRepositoryImages(generatedFiles);
      const normalizedStartUis = normalizeStartUiCollection(libraryData.startUis, libraryData.startUi, libraryData.scenes || []);
      setStartUis(normalizedStartUis);
      setActiveStartUiId(current => normalizedStartUis.some(settings => settings.id === current)
        ? current
        : normalizedStartUis[0]?.id || "start_ui_main");
      if (Array.isArray(libraryData.scenes) && libraryData.scenes.length) {
        const firstScene = libraryData.scenes[0];
        setScenes(libraryData.scenes.map(prepareSceneForEditor));
        setScene(prepareSceneForEditor(firstScene));
        setSelectedLayerId("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const playbackFrameCount = Math.max(1, sceneFrameCount);
    if ((!isPlaying && !sceneHasAutoPlayingLayer) || playbackFrameCount <= 1) return;
    const id = window.setInterval(() => {
      setActiveFrame(prev => (prev + 1) % playbackFrameCount);
    }, 1000 / Math.max(1, selectedLayerClipFps));
    return () => window.clearInterval(id);
  }, [isPlaying, sceneHasAutoPlayingLayer, sceneFrameCount, selectedLayerClipFps, activeSprite.id]);

  useEffect(() => {
    setActiveFrame(0);
    setSheetColumns(Math.min(4, activeSprite.frames.length || 4));
    setSheetDataUrl(activeSprite.spritesheetPng || null);
  }, [activeSprite.id]);

  const {
    applyInteractionPreset, applyNeonLightingToSelectedLayer, clearLightingFromSelectedLayer, compileSheet,
    deleteAsset, deleteSceneObject, deleteSheetOnlySpriteFrame, downloadSelectedSceneItem,
    enableFollowCameraView, finishLayerPointerReorder, handleImportFile, handleLayerImageUpload,
    inferImportedFrameSize, insertActiveSprite, insertAssetLayer, insertFullSceneKit,
    insertInteractionZone, insertSceneKitAsset, openGameMode, openSceneLayerContextMenu,
    openSheetOnlyMode, previewSceneSpritesheetEntry, rebuildSelectedSpritesheetGrid, removeSelectedLayer,
    reorderLayerStack, returnToModePicker, returnWithinGameWorkspace, saveAsset,
    saveAssetMetadata, saveImportedSpritesheet, saveSheetOnlyRecolorVariant, selectSheetOnlyImage,
    selectSheetOnlySprite, setLayerAnimation, startScenePanelResize, triggerMouseAction, updateAssetClipMetadata, updateAssetMetadata,
    updateImportActionName, updateImportTriggerType, updateLayerInteraction, updateSceneFrame,
    updateSceneLighting, updateSelectedLayerInteraction, updateSelectedLayerLighting,
    updateSelectedLayerShadow, updateSelectedSpriteMetadata, updateSelectedSpritesheetFps,
  } = useGameWorkspaceActions({
    activeFrame, activeSprite, appMode, assetById, assets, binding, cameraMax, cameraMaxY, fps, role, scene,
    scenePanelResizeRef, scenePanelWidths, sceneStateRef, scenes, tab, tagsText, updateSceneLayer,
    importActionName, importAssetName, importColumns, importFileName, importFrameCount, importFrameHeight,
    importFrameWidth, importGameState, importLoop, importRole, importSheetDataUrl, importSheetSize,
    importTagsText, importTriggerType, importTriggerValue,
    layerDragRef, selectedAssetEditable, selectedInteractionZoneLayerId, selectedLayer, selectedLayerAsset,
    selectedLayerId, selectedLayerClip, selectedLayerFrameSize, selectedLayerSprite, selectedLayerSpriteColumns,
    selectedLayerSpriteEditableGrid, selectedLayerSpriteFrameCount, selectedLayerSpriteSheetSize,
    selectedLayerSpriteSource, sheetColumns, sheetDataUrl, sheetOnlyHasSelection, sheetOnlySelectedAssetId,
    sheetOnlySelectionKind,
    setActiveFrame, setActiveSprite, setAppMode, setAssets, setBinding, setDraggedLayerId, setError,
    setExpandedSpritesheetKey, setFps, setImportActionName, setImportAssetName, setImportColumns,
    setImportFileName, setImportFrameCount, setImportFrameHeight, setImportFrameWidth, setImportGameState,
    setImportLoop, setImportRole, setImportSheetDataUrl, setImportSheetSize, setImportTagsText,
    setImportTriggerType, setImportTriggerValue, setIsBackpackOpen, setIsLayerLibraryOpen, setIsPlaying,
    setIsSavingRecolorVariant, setLayerDropTargetId, setNotice, setRepositoryImages, setRole, setScene,
    setSceneContextMenu, setScenes, setSelectedInteractionZoneLayerId, setSelectedLayerId, setSheetColumns,
    setSheetDataUrl, setSheetOnlyHasSelection, setSheetOnlySelectedAssetId, setSheetOnlySelectionKind,
    setSheetOnlySelectionTitle, setSprites, setTab, setTagsText, setVehiclePhase,
  });
  const bgClass = bgMode === "checker" ? "preview-bg checker" : `preview-bg ${bgMode}`;

  if (appMode === "home") {
    return (
      <Fragment>
        <ModePicker onOpenGame={openGameMode} onOpenSheetOnly={openSheetOnlyMode} />
        <CommunityHelp />
      </Fragment>
    );
  }

  if (appMode === "sheet-only") {
    return (
      <Fragment>
        <SheetOnlyGallery
          activeSpriteName={activeSprite.characterName}
          checkerStyle={checkerStyle}
          entries={sheetOnlyEntries}
          hasSelection={sheetOnlyHasSelection}
          selectionTitle={sheetOnlySelectionTitle}
          selectedSprite={sheetOnlySelectionKind === "sprite" ? activeSprite : undefined}
          sheetDataUrl={sheetDataUrl}
          isSavingRecolorVariant={isSavingRecolorVariant}
          onDeleteSpriteFrame={deleteSheetOnlySpriteFrame}
          onBack={returnToModePicker}
          onGeneratePreview={() => void compileSheet()}
          onSaveRecolorVariant={saveSheetOnlyRecolorVariant}
          onSelectImage={selectSheetOnlyImage}
          onSelectSprite={selectSheetOnlySprite}
          onShowAll={() => {
            setSheetOnlyHasSelection(false);
            setSheetOnlySelectionKind(null);
            setSheetOnlySelectedAssetId(null);
          }}
        />
        <CommunityHelp />
      </Fragment>
    );
  }

  return (
    <Fragment>
      <div className={`blueprint-app ${tab === "scenes" || tab === "scene" || tab === "start-ui" ? "core-mode" : ""}`}>
      <main className={`game-workspace ${tab === "scenes" || tab === "scene" || tab === "start-ui" ? "simple-workspace" : ""}`}>
        <aside className="panel left-panel utility-panel">
          <CurrentActionPanel
            activeFrame={activeFrame}
            activeSprite={activeSprite}
            binding={binding}
            checkerStyle={checkerStyle}
            frameHeight={frameH}
            frameWidth={frameW}
            role={role}
            roleLabels={roleLabels}
            tagsText={tagsText}
            triggerLabels={triggerLabels}
            onBindingChange={setBinding}
            onInsertActiveSprite={insertActiveSprite}
            onRoleChange={setRole}
            onSaveAsset={saveAsset}
            onTagsTextChange={setTagsText}
          />

          <SpritesheetImporterPanel
            actionName={importActionName}
            assetName={importAssetName}
            columns={importColumns}
            fileName={importFileName}
            frameCount={importFrameCount}
            frameHeight={importFrameHeight}
            frameWidth={importFrameWidth}
            gameState={importGameState}
            importLoop={importLoop}
            role={importRole}
            roleLabels={roleLabels}
            sheetSize={importSheetSize}
            tagsText={importTagsText}
            triggerLabels={triggerLabels}
            triggerType={importTriggerType}
            triggerValue={importTriggerValue}
            onActionNameChange={updateImportActionName}
            onAssetNameChange={setImportAssetName}
            onColumnsChange={setImportColumns}
            onFileChange={handleImportFile}
            onFrameCountChange={setImportFrameCount}
            onFrameHeightChange={setImportFrameHeight}
            onFrameWidthChange={setImportFrameWidth}
            onGameStateChange={setImportGameState}
            onInferFrameSize={() => inferImportedFrameSize()}
            onLoopChange={setImportLoop}
            onRoleChange={setImportRole}
            onSave={() => saveImportedSpritesheet(false)}
            onSaveAndInsert={() => saveImportedSpritesheet(true)}
            onTagsTextChange={setImportTagsText}
            onTriggerTypeChange={updateImportTriggerType}
            onTriggerValueChange={setImportTriggerValue}
          />

          <TriggerTestPanel onTriggerMouseAction={triggerMouseAction} />
          <WorkspaceMessages error={error} notice={notice} />
        </aside>

        <section className="canvas-stage">
          <div className="blueprint-grid">
            <WorkspaceStageHeader
              activeTab={tab}
              viewportHeight={viewportHeight}
              viewportPreset={scene.viewportPreset}
              viewportPresets={VIEWPORT_PRESETS}
              viewportWidth={viewportWidth}
              onBack={returnWithinGameWorkspace}
              onInsertInteractionZone={insertInteractionZone}
              onOpenSheet={async () => {
                setTab("sheet");
                if (!activeSprite.spritesheetPng && !sheetDataUrl) await compileSheet();
              }}
              onSaveScene={saveScene}
              onStartNewScene={startNewScene}
              onTabChange={setTab}
              onViewportHeightChange={height => updateSceneFrame({ viewportHeight: height, viewportPreset: "custom" })}
              onViewportPresetChange={presetId => {
                const preset = VIEWPORT_PRESETS.find(item => item.id === presetId);
                if (preset) updateSceneFrame({ viewportWidth: preset.width, viewportHeight: preset.height, viewportPreset: preset.id });
              }}
              onViewportWidthChange={width => updateSceneFrame({ viewportWidth: width, viewportPreset: "custom" })}
            />

            {tab === "scenes" && (
              <SceneFlowCanvas
                nodes={sceneFlowNodes}
                onCreateScene={startNewScene}
                onCreateStartUi={createStartUiNode}
                onDeleteScene={deleteSceneNode}
                onDeleteStartUi={deleteStartUiNode}
                onDuplicateScene={duplicateSceneNode}
                onDuplicateStartUi={duplicateStartUiNode}
                onOpenStartUi={settings => {
                  setActiveStartUiId(settings.id);
                  setTab("start-ui");
                }}
                onOpenScene={node => {
                  if (node.isPlaceholder) {
                    void startNewScene();
                    return;
                  }
                  if (node.scene && !node.isCurrent) loadSavedScene(node.scene);
                  setTab("scene");
                }}
                onPasteScene={pasteSceneNode}
                onSaveCurrent={saveCompletedScene}
                onStatus={setNotice}
              />
            )}

            {tab === "start-ui" && (
              <SceneStartUiPanel
                isSaving={isSavingStartUi}
                scenes={startUiSceneOptions}
                settings={activeStartUi}
                onSave={saveStartUiSettings}
              />
            )}

            {tab === "scene" && (
              <div className="scene-editor">
                <div
                  className="scene-wireframe"
                  style={{
                    gridTemplateColumns: `${sceneLayerPanelWidth}px 8px minmax(${sceneCenterMinWidth}px, 1fr) 8px ${sceneInspectorPanelWidth}px`,
                  }}
                >
                  <SceneLayerRail
                    draggedLayerId={draggedLayerId}
                    isLayerLibraryOpen={isLayerLibraryOpen}
                    layerDropTargetId={layerDropTargetId}
                    layerLibraryAssets={layerLibraryAssets}
                    layers={scene.layers}
                    selectedLayerId={selectedLayerId}
                    resolveAssetSprite={resolveAssetSprite}
                    onBeginLayerDrag={layer => {
                      setSelectedLayerId(layer.id);
                      setSelectedInteractionZoneLayerId(null);
                      const layerAsset = layer.assetId ? assetById.get(layer.assetId) : undefined;
                      const layerSprite = resolveAssetSprite(layerAsset, layer);
                      if (layerSprite) {
                        setActiveSprite(layerSprite);
                        setActiveFrame(0);
                      }
                      layerDragRef.current = layer.id;
                      setDraggedLayerId(layer.id);
                    }}
                    onCancelLayerDrag={() => {
                      layerDragRef.current = null;
                      setDraggedLayerId(null);
                      setLayerDropTargetId(null);
                    }}
                    onCloseLayerLibrary={() => setIsLayerLibraryOpen(false)}
                    onFinishLayerReorder={finishLayerPointerReorder}
                    onInsertAsset={insertAssetLayer}
                    onOpenLayerContextMenu={openSceneLayerContextMenu}
                    onSelectLayer={layer => {
                      setSelectedLayerId(layer.id);
                      setSelectedInteractionZoneLayerId(null);
                      const layerAsset = layer.assetId ? assetById.get(layer.assetId) : undefined;
                      const layerSprite = resolveAssetSprite(layerAsset, layer);
                      if (layerSprite) setActiveSprite(layerSprite);
                    }}
                    onToggleLayerLibrary={() => setIsLayerLibraryOpen(value => !value)}
                    onUpdateLayer={updateSceneLayer}
                    onUploadImage={handleLayerImageUpload}
                  />
                  <button
                    type="button"
                    className="scene-resizer left"
                    aria-label="Resize layer panel"
                    title="Drag to resize Layers"
                    onPointerDown={event => startScenePanelResize(event, "layers")}
                  />
                  <SceneStageCanvas
                    backgroundLayer={backgroundLayer}
                    cameraEffect={cameraEffect}
                    controls={(
                      <SceneGlobalControls
                        ref={sceneGlobalControlsRef}
                        cameraMax={cameraMax}
                        cameraMaxY={cameraMaxY}
                        cameraX={scene.cameraX}
                        cameraY={scene.cameraY || 0}
                        lighting={sceneLight}
                        sceneHeight={scene.height}
                        sceneWidth={scene.width}
                        viewportHeight={viewportHeight}
                        viewportWidth={viewportWidth}
                        onCameraXChange={value => setScene(prev => ({ ...prev, cameraX: value }))}
                        onCameraYChange={value => setScene(prev => ({ ...prev, cameraY: value }))}
                        onEnableFollowView={enableFollowCameraView}
                        onLightingChange={updateSceneLighting}
                      />
                    )}
                    controlsSpace={sceneControlsHeight ? sceneControlsHeight + 28 : 98}
                    hasVisibleBackgroundImage={hasVisibleBackgroundImage}
                    shellRef={stageShellRef}
                    stageHeight={stageSize.height}
                    stageRef={stageRef}
                    stageWidth={stageSize.width}
                    viewportHeight={viewportHeight}
                    viewportWidth={viewportWidth}
                    onClearSelection={clearSceneSelection}
                    onOpenBackgroundContextMenu={openSceneLayerContextMenu}
                    onPointerEnd={clearPointerState}
                    onPointerMove={stagePointerMove}
                  >
                  {backgroundLayer?.visible && (
                    <SceneBackgroundLayer
                      backgroundLayer={backgroundLayer}
                      filter={combineFilters(sceneFilter(scene), backgroundLayerFilter(backgroundLayer))}
                      interactionLights={interactionLightZones}
                      scene={scene}
                      selectedLayerId={selectedLayerId}
                      spriteStageScale={spriteStageScale}
                      stageScaleX={stageScaleX}
                      stageScaleY={stageScaleY}
                      onOpenContextMenu={openSceneLayerContextMenu}
                      onPointerDown={stagePointerDown}
                      onResizeStart={startLayerResize}
                      onSelectLayer={layerId => {
                        setSelectedLayerId(layerId);
                        setSelectedInteractionZoneLayerId(null);
                      }}
                    />
                  )}
                  <SceneStageEnvironment
                    groundLayer={groundLayer}
                    groundY={scene.groundY}
                    interactionLights={interactionLightZones}
                    lighting={sceneLight}
                    sceneCameraX={scene.cameraX}
                    sceneCameraY={scene.cameraY || 0}
                    showLightingOverlay={Boolean(backgroundLayer?.visible && sceneLight.preset !== "none")}
                    stageScaleX={stageScaleX}
                    stageScaleY={stageScaleY}
                  />
                  <SceneVisualLayerStack
                    activeFrame={activeFrame}
                    assetById={assetById}
                    contactShadow={NEON_CONTACT_SHADOW}
                    layers={scene.layers}
                    sceneCameraX={scene.cameraX}
                    sceneCameraY={scene.cameraY || 0}
                    selectedInteractionZoneLayerId={selectedInteractionZoneLayerId}
                    selectedLayerId={selectedLayerId}
                    spriteStageScale={spriteStageScale}
                    stageScaleX={stageScaleX}
                    stageScaleY={stageScaleY}
                    getInteraction={layerInteractionSettings}
                    getInteractionZoneBounds={interactionZoneBounds}
                    getRenderFilter={(layer, asset) => sceneLayerRenderFilter(scene, layer, asset)}
                    resolveAssetSprite={resolveAssetSprite}
                    onInteractionZoneClick={(targetLayer, sprite) => {
                      setSelectedLayerId(targetLayer.id);
                      setSelectedInteractionZoneLayerId(targetLayer.id);
                      setActiveSprite(sprite);
                      setActiveFrame(0);
                    }}
                    onInteractionZoneDragStart={startInteractionZoneDrag}
                    onInteractionZoneResizeStart={startInteractionZoneResize}
                    onLayerContextMenu={openSceneLayerContextMenu}
                    onLayerPointerDown={stagePointerDown}
                    onLayerResizeStart={startLayerResize}
                    onLayerSelect={(targetLayer, sprite) => {
                      setSelectedLayerId(targetLayer.id);
                      setActiveSprite(sprite);
                      setActiveFrame(0);
                    }}
                    onZoneContextMenu={(event, targetLayer) => openSceneLayerContextMenu(event, targetLayer, "interaction-zone")}
                  />
                  <SceneStageOverlays
                    activeDialogue={activeDialogue}
                    interactionToast={interactionToast}
                    isBackpackOpen={isBackpackOpen}
                    nearbyInteraction={activeDialogue ? null : nearbyInteraction}
                    sceneCameraX={scene.cameraX}
                    sceneCameraY={scene.cameraY || 0}
                    spriteStageScale={spriteStageScale}
                    stageScaleX={stageScaleX}
                    stageScaleY={stageScaleY}
                    onAdvanceDialogue={advanceDialogue}
                    onCloseBackpack={() => setIsBackpackOpen(false)}
                    onTriggerNearbyInteraction={triggerNearbyInteraction}
                  />
                  </SceneStageCanvas>
                  <button
                    type="button"
                    className="scene-resizer right"
                    aria-label="Resize inspector panel"
                    title="Drag to resize Inspector"
                    onPointerDown={event => startScenePanelResize(event, "inspector")}
                  />
                  <SceneInspectorPanel
                    getClipButtonText={clipButtonText}
                    getLayerWorldBounds={layerWorldBounds}
                    isPlaying={isPlaying}
                    layerCount={scene.layers.length}
                    roleLabels={roleLabels}
                    sceneName={scene.name}
                    selectedAssetEditable={selectedAssetEditable}
                    selectedInteractionZoneAsset={selectedInteractionZoneAsset}
                    selectedInteractionZoneLayer={selectedInteractionZoneLayer}
                    selectedInteractionZoneLayerId={selectedInteractionZoneLayerId}
                    selectedInteractionZoneSettings={selectedInteractionZoneSettings}
                    selectedLayer={selectedLayer}
                    selectedLayerAsset={selectedLayerAsset}
                    selectedLayerClip={selectedLayerClip}
                    selectedLayerClipFps={selectedLayerClipFps}
                    selectedLayerFrameSize={selectedLayerFrameSize}
                    selectedLayerIsAvatar={selectedLayerIsAvatar}
                    selectedLayerIsVisual={Boolean(selectedLayer && isSceneVisualLayer(selectedLayer))}
                    selectedLayerLight={selectedLayerLight}
                    selectedLayerShadow={selectedLayerShadow}
                    selectedLayerSprite={selectedLayerSprite}
                    selectedLayerSpriteColumns={selectedLayerSpriteColumns}
                    selectedLayerSpriteEditableGrid={selectedLayerSpriteEditableGrid}
                    selectedLayerSpriteFrameCount={selectedLayerSpriteFrameCount}
                    selectedLayerSpriteFrameIndex={selectedLayerSpriteFrameIndex}
                    selectedLayerSpriteRows={selectedLayerSpriteRows}
                    selectedLayerSpriteSheetSize={selectedLayerSpriteSheetSize}
                    selectedLayerSpriteSource={selectedLayerSpriteSource}
                    triggerLabels={triggerLabels}
                    walkSpeed={walkSpeed}
                    onApplyNeonLighting={applyNeonLightingToSelectedLayer}
                    onClearLighting={clearLightingFromSelectedLayer}
                    onDownloadSelectedItem={downloadSelectedSceneItem}
                    onDownloadSpritePng={() => selectedLayerSpriteSource && selectedLayerSprite && downloadUrl(selectedLayerSpriteSource, `spritesheet_${safeName(selectedLayerSprite.characterName)}.png`)}
                    onPlayingChange={setIsPlaying}
                    onRebuildSpriteGrid={rebuildSelectedSpritesheetGrid}
                    onRestartSpritePreview={() => {
                      if (!selectedLayerSprite) return;
                      setActiveSprite(selectedLayerSprite);
                      setActiveFrame(0);
                      setIsPlaying(true);
                    }}
                    onSaveAssetMetadata={saveAssetMetadata}
                    onSelectSpriteFrame={frameIndex => {
                      if (!selectedLayerSprite) return;
                      setIsPlaying(false);
                      setActiveSprite(selectedLayerSprite);
                      setActiveFrame(frameIndex);
                    }}
                    onSetLayerAnimation={setLayerAnimation}
                    onSpriteMetadataChange={updateSelectedSpriteMetadata}
                    onToggleSelectedLayerLock={() => selectedLayer && updateSceneLayer(selectedLayer.id, { locked: !selectedLayer.locked })}
                    onToggleSpritePreview={() => {
                      if (!selectedLayerSprite) return;
                      setIsPlaying(value => !value);
                      setActiveSprite(selectedLayerSprite);
                    }}
                    onUpdateAssetClipMetadata={updateAssetClipMetadata}
                    onUpdateAssetMetadata={updateAssetMetadata}
                    onUpdateInteraction={updateLayerInteraction}
                    onUpdateLayer={updateSceneLayer}
                    onUpdateLighting={updateSelectedLayerLighting}
                    onUpdatePreviewFps={updateSelectedSpritesheetFps}
                    onUpdateShadow={updateSelectedLayerShadow}
                    onWalkSpeedChange={setWalkSpeed}
                  />
                </div>
                <SceneToolbar
                  sceneName={scene.name}
                  onDuplicateSelectedLayer={duplicateSelectedLayer}
                  onExportScene={() => downloadJson(scenePayload, `scene_${safeName(scene.name)}.json`)}
                  onInsertActiveSprite={insertActiveSprite}
                  onRemoveSelectedLayer={removeSelectedLayer}
                  onSceneNameChange={name => setScene(prev => ({ ...prev, name }))}
                />
                <SceneLightingStrip
                  cameraMax={cameraMax}
                  cameraMaxY={cameraMaxY}
                  cameraX={scene.cameraX}
                  cameraY={scene.cameraY || 0}
                  hasUnlockedVisualLayer={Boolean(selectedLayer && isSceneVisualLayer(selectedLayer) && !selectedLayer.locked)}
                  layerLighting={selectedLayerLight}
                  layerShadow={selectedLayerShadow}
                  sceneLighting={sceneLight}
                  onCameraXChange={value => setScene(prev => ({ ...prev, cameraX: value }))}
                  onCameraYChange={value => setScene(prev => ({ ...prev, cameraY: value }))}
                  onLayerLightingChange={updateSelectedLayerLighting}
                  onLayerShadowChange={updateSelectedLayerShadow}
                  onSceneLightingChange={updateSceneLighting}
                />
              </div>
            )}

            {tab === "spritesheets" && (
              <div className="spritesheet-library-page">
                <SceneSpritesheetsHeader
                  clipCount={sceneSpritesheetEntries.length}
                  isPlaying={isPlaying}
                  onSaveScene={saveScene}
                  onTogglePlay={() => setIsPlaying(value => !value)}
                />

                <div className="spritesheet-library-grid">
                  {sceneSpritesheetEntries.map(entry => (
                    <Fragment key={entry.key}>
                      <SceneSpritesheetCard
                        activeFrame={activeFrame}
                        checkerStyle={checkerStyle}
                        editableAsset={assets.some(asset => asset.id === entry.asset.id)}
                        entry={entry}
                        isExpanded={expandedSpritesheetKey === entry.key}
                        roleLabels={roleLabels}
                        triggerLabels={triggerLabels}
                        onDownloadPng={item => downloadUrl(item.sprite.spritesheetPng || item.sprite.rawSpritesheetPng || "", `spritesheet_${safeName(item.sprite.characterName)}.png`)}
                        onPreview={previewSceneSpritesheetEntry}
                        onSaveAssetMetadata={saveAssetMetadata}
                        onSetLayerAnimation={setLayerAnimation}
                        onTagsChange={(assetId, tagsText) => updateAssetMetadata(assetId, { tags: splitTags(tagsText) })}
                        onToggleExpanded={entryKey => setExpandedSpritesheetKey(expandedSpritesheetKey === entryKey ? null : entryKey)}
                        onUpdateAssetClipMetadata={updateAssetClipMetadata}
                        onUpdateAssetMetadata={updateAssetMetadata}
                        onUpdateSceneLayer={updateSceneLayer}
                      />
                    </Fragment>
                  ))}
                </div>

                {!sceneSpritesheetEntries.length && <SceneSpritesheetsEmptyState />}
              </div>
            )}

            {tab === "preview" && (
              <ActionPreviewPanel
                activeFrameIndex={activeSpriteFrameIndex}
                backgroundClassName={bgClass}
                backgroundMode={bgMode}
                frameCount={frames.length}
                frameRatio={frameRatio}
                isPlaying={isPlaying}
                isTallFrame={isTallFrame}
                svgFrame={currentFrame}
                onBackgroundModeChange={setBgMode}
                onNextFrame={() => setActiveFrame(value => (value + 1) % frames.length)}
                onPreviousFrame={() => setActiveFrame(value => (value === 0 ? frames.length - 1 : value - 1))}
                onSelectFrame={frameIndex => {
                  setIsPlaying(false);
                  setActiveFrame(frameIndex);
                }}
                onTogglePlay={() => setIsPlaying(value => !value)}
              />
            )}

            {tab === "frames" && (
              <FramesGridPanel
                activeFrameIndex={activeSpriteFrameIndex}
                checkerStyle={checkerStyle}
                frameRatio={frameRatio}
                frames={frames}
                onSelectFrame={frameIndex => {
                  setActiveFrame(frameIndex);
                  setIsPlaying(false);
                }}
              />
            )}

            {tab === "sheet" && (
              <SheetPreviewPanel
                sheetDataUrl={sheetDataUrl}
                sheetInfo={`${activeSprite.sheetSize?.join(" x ") || `${frameW * sheetColumns} x ${frameH * Math.ceil(activeSprite.frames.length / sheetColumns)}`} / frame ${frameW} x ${frameH}px / ${activeSprite.frames.length} frames`}
                onGenerateSheet={() => void compileSheet()}
              />
            )}

            {tab === "blueprint" && (
              <BlueprintPanel
                actionBindingText={`${triggerLabels[binding.triggerType]} / ${binding.triggerValue} / ${binding.gameState}`}
                assetCount={assets.length}
                currentActionText={`${activeSprite.characterName} / ${activeSprite.frames.length} frames / ${frameW} x ${frameH}`}
                sceneCount={scenes.length}
                onExportLibrary={() => downloadJson({ assets, scenes: [scene] }, "game_asset_library_export.json")}
              />
            )}
          </div>
        </section>

        <aside className="panel right-panel utility-panel">
          <MotionSpeedPanel
            fps={fps}
            walkSpeed={walkSpeed}
            onFpsChange={setFps}
            onWalkSpeedChange={setWalkSpeed}
          />

          <GlobalSceneLightingPanel
            cameraMax={cameraMax}
            cameraMaxY={cameraMaxY}
            cameraX={scene.cameraX}
            cameraY={scene.cameraY || 0}
            lighting={sceneLight}
            onApplyNeonStation={() => updateSceneLighting({ ...NEON_SCENE_LIGHTING })}
            onCameraXChange={value => setScene(prev => ({ ...prev, cameraX: value }))}
            onCameraYChange={value => setScene(prev => ({ ...prev, cameraY: value }))}
            onDisableGlobalLighting={() => updateSceneLighting({ ...NEON_SCENE_LIGHTING, preset: "none" as const })}
            onLightingChange={updateSceneLighting}
          />

          {SHOW_SCENE_KIT_TOOLS && (
            <ReusableSceneKitPanel
              boardingTrainAssetId={BOARDING_TRAIN_ASSET_ID}
              inspectTriggerAssetId={INSPECT_TRIGGER_ASSET_ID}
              onInsertFullSceneKit={insertFullSceneKit}
              onInsertSceneKitAsset={insertSceneKitAsset}
            />
          )}

          <SimulationScreenPanel
            backgroundFit={backgroundLayer?.fit}
            backgroundPosition={backgroundLayer?.position}
            selectedViewportPresetLabel={selectedViewportPreset?.label || "Custom"}
            viewportHeight={viewportHeight}
            viewportPreset={scene.viewportPreset}
            viewportPresets={VIEWPORT_PRESETS}
            viewportRatioLabel={viewportRatioLabel}
            viewportWidth={viewportWidth}
            onBackgroundFitChange={fit => backgroundLayer && updateSceneLayer(backgroundLayer.id, { fit })}
            onBackgroundPositionChange={position => backgroundLayer && updateSceneLayer(backgroundLayer.id, { position })}
            onViewportHeightChange={height => updateSceneFrame({ viewportHeight: height, viewportPreset: "custom" })}
            onViewportPresetChange={preset => updateSceneFrame({ viewportWidth: preset.width, viewportHeight: preset.height, viewportPreset: preset.id })}
            onViewportWidthChange={width => updateSceneFrame({ viewportWidth: width, viewportPreset: "custom" })}
          />

          <SceneLayerControlsPanel
            draggedLayerId={draggedLayerId}
            getClipButtonText={clipButtonText}
            getLayerWorldBounds={layerWorldBounds}
            interactionPresets={INTERACTION_PRESETS}
            isVisualLayer={isSceneVisualLayer}
            layers={scene.layers}
            sceneHeight={scene.height}
            sceneState={scene.state || {}}
            sceneWidth={scene.width}
            scenes={scenes}
            selectedLayer={selectedLayer}
            selectedLayerAsset={selectedLayerAsset}
            selectedLayerClip={selectedLayerClip}
            selectedLayerId={selectedLayerId}
            selectedLayerInteraction={selectedLayerInteraction}
            selectedLayerLight={selectedLayerLight}
            selectedLayerShadow={selectedLayerShadow}
            onApplyInteractionPreset={applyInteractionPreset}
            onApplyNeonLighting={applyNeonLightingToSelectedLayer}
            onClearLighting={clearLightingFromSelectedLayer}
            onDragLayerEnd={() => setDraggedLayerId(null)}
            onDragLayerStart={setDraggedLayerId}
            onReorderLayer={reorderLayerStack}
            onSelectLayer={layer => {
              setSelectedLayerId(layer.id);
              setSelectedInteractionZoneLayerId(null);
              const layerAsset = layer.assetId ? assetById.get(layer.assetId) : undefined;
              const layerSprite = resolveAssetSprite(layerAsset, layer);
              if (layerSprite) setActiveSprite(layerSprite);
            }}
            onSetAnimation={clip => selectedLayer && setLayerAnimation(selectedLayer.id, clip)}
            onUpdateInteraction={updateSelectedLayerInteraction}
            onUpdateLayer={updateSceneLayer}
            onUpdateLighting={updateSelectedLayerLighting}
            onUpdateShadow={updateSelectedLayerShadow}
          />

          <ConfirmedAssetsPanel
            activeFrame={activeFrame}
            assets={assets}
            checkerStyle={checkerStyle}
            roleLabels={roleLabels}
            triggerLabels={triggerLabels}
            getAssetPreviewSprite={asset => resolveAssetSprite(asset) || asset.sprite}
            onDeleteAsset={deleteAsset}
            onInsertAsset={insertAssetLayer}
            onPreviewSprite={setActiveSprite}
          />

          <AvailableSpritesPanel
            activeSpriteId={activeSprite.id}
            checkerStyle={checkerStyle}
            sprites={sprites}
            onSelectSprite={setActiveSprite}
          />
        </aside>
      </main>
      {sceneContextMenu && (
        <SceneContextMenu
          clipboard={sceneClipboard}
          layers={scene.layers}
          menu={sceneContextMenu}
          isTransformableLayer={isTransformableSceneLayer}
          onCopyLayer={copyLayerToSceneClipboard}
          onCutLayer={cutLayerToSceneClipboard}
          onDeleteObject={deleteSceneObject}
          onDuplicateLayer={duplicateSceneLayer}
          onPasteLayer={pasteLayerFromSceneClipboard}
        />
      )}
      </div>
      <CommunityHelp />
    </Fragment>
  );
}
