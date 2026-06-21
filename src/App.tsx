import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent, type PointerEvent } from "react";
import { PRESET_SPRITES } from "./presets";
import { isEditingTextTarget } from "./app/domEvents";
import { downloadDataUrl, downloadJson, downloadUrl } from "./app/downloads";
import type { AppMode, BackgroundMode, SheetOnlySelectionKind, WorkspaceTab } from "./app/types";
import {
  DEFAULT_WALK_SPEED,
  INTERACTION_PRESETS,
  SHOW_SCENE_KIT_TOOLS,
  VIEWPORT_PRESETS,
  VIEWPORT_WIDTH,
  checkerStyle,
  roleLabels,
  triggerLabels,
} from "./app/workspaceConfig";
import {
  DEFAULT_BINDING as defaultBinding,
  clipButtonText,
  createAsset,
  defaultGameStateForTrigger,
  defaultTriggerValueForType,
  escapeHtmlAttribute,
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
  DEFAULT_INTERACTION_SETTINGS,
  NEON_CONTACT_SHADOW,
  NEON_LAYER_LIGHTING,
  NEON_SCENE_LIGHTING,
  formatViewportRatio,
  interactionZoneBounds,
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
  stateMatches,
  stateValueFromText,
} from "./domain/scene/sceneModel";
import {
  createDefaultScene,
  createSceneKitLayer,
  ensureSceneKitLayers,
  prepareSceneForEditor,
  sceneTimestampLabel,
} from "./domain/scene/sceneFactory";
import {
  SCENE_HISTORY_LIMIT,
  cloneSceneForHistory,
  cloneSceneLayer,
  sceneHistoryKey,
} from "./domain/scene/sceneHistory";
import {
  clearBackgroundLayerImage,
  createSceneLayerInstance,
  disableLayerInteraction,
  replaceBackgroundLayerSettings,
  type SceneObjectTarget,
} from "./domain/scene/sceneLayerOperations";
import {
  buildSpritesheetFrames,
  getFrameSize,
  spriteFrame,
  spriteFrameTotal,
  spriteGridColumns,
  spriteGridRows,
} from "./domain/sprites/spriteUtils";
import { compileSpritesheetImage } from "./domain/sprites/spriteCanvas";
import { CurrentActionPanel } from "./features/current-action";
import { SceneBackgroundLayer, SceneGlobalControls, SceneLightingStrip, SceneStageCanvas, SceneStageEnvironment, SceneStageOverlays, SceneToolbar, SceneVisualLayerStack } from "./features/scene-editor";
import { SceneInspectorPanel } from "./features/scene-inspector";
import { SceneLayerControlsPanel, SceneLayerRail } from "./features/scene-layers";
import { buildSceneFlowNodes, SceneFlowCanvas, type SceneFlowNode } from "./features/scene-flow";
import { SceneContextMenu } from "./features/scene-context-menu";
import { SceneSpritesheetCard, SceneSpritesheetsEmptyState, SceneSpritesheetsHeader, type SceneSpritesheetEntry } from "./features/scene-spritesheets";
import { ModePicker } from "./features/mode-picker";
import { buildSheetOnlyEntries, SheetOnlyGallery } from "./features/sheet-only-gallery";
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
import { WorkspaceTopbar } from "./features/workspace-topbar";
import {
  deleteGameAsset,
  deleteGameScene,
  fetchGameLibrary,
  fetchLatestSprite,
  saveGameAsset,
  saveGameScene,
} from "./services/gameLibraryApi";
import { fetchGeneratedAssets, type RepositoryGeneratedImage } from "./services/generatedAssetsApi";
import { clamp, clampLayerScale } from "./shared/math";
import {
  ActionBinding,
  ActionTriggerType,
  AnimationClip,
  AnimationSprite,
  AssetRole,
  GameAsset,
  GameLibrary,
  GameScene,
  InteractionPreset,
  LayerInteractionSettings,
  SceneLayer,
} from "./types";

type ResizeHandle = "nw" | "ne" | "sw" | "se";
type ScenePanelResizeHandle = "layers" | "inspector";
type ResizeState = {
  id: string;
  handle: ResizeHandle;
  anchorScreenX: number;
  anchorScreenY: number;
  assetWidth: number;
  assetHeight: number;
};
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
type SceneLayerClipboard = {
  layer: SceneLayer;
  sourceSceneId: string;
};
type HeldDirection = "left" | "right" | null;
type VehiclePhase = "approaching" | "ready" | "boarded";

export default function App() {
  const [sprites, setSprites] = useState<AnimationSprite[]>(PRESET_SPRITES);
  const [activeSprite, setActiveSprite] = useState<AnimationSprite>(PRESET_SPRITES[0]);
  const [assets, setAssets] = useState<GameAsset[]>([]);
  const [repositoryImages, setRepositoryImages] = useState<RepositoryGeneratedImage[]>([]);
  const [scenes, setScenes] = useState<GameScene[]>([]);
  const [scene, setScene] = useState<GameScene>(() => prepareSceneForEditor(createDefaultScene()));
  const [selectedLayerId, setSelectedLayerId] = useState<string>("layer_ground");
  const [selectedInteractionZoneLayerId, setSelectedInteractionZoneLayerId] = useState<string | null>(null);
  const [appMode, setAppMode] = useState<AppMode>("home");
  const [tab, setTab] = useState<WorkspaceTab>("scenes");
  const [activeFrame, setActiveFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [heldDirection, setHeldDirection] = useState<HeldDirection>(null);
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
  const [stageShellSize, setStageShellSize] = useState({ width: 0, height: 0 });
  const [sceneControlsHeight, setSceneControlsHeight] = useState(0);
  const [sceneContextMenu, setSceneContextMenu] = useState<SceneContextMenuState | null>(null);
  const [sceneClipboard, setSceneClipboard] = useState<SceneLayerClipboard | null>(null);
  const [isLayerLibraryOpen, setIsLayerLibraryOpen] = useState(false);
  const [sheetOnlyHasSelection, setSheetOnlyHasSelection] = useState(false);
  const [sheetOnlySelectionKind, setSheetOnlySelectionKind] = useState<SheetOnlySelectionKind>(null);
  const [sheetOnlySelectionTitle, setSheetOnlySelectionTitle] = useState("");
  const [interactionToast, setInteractionToast] = useState("");
  const [isBackpackOpen, setIsBackpackOpen] = useState(false);
  const [vehiclePhase, setVehiclePhase] = useState<VehiclePhase>("approaching");
  const [notice, setNotice] = useState("Confirmed spritesheets can be saved as game action assets.");
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const scenePanelResizeRef = useRef<ScenePanelResizeState | null>(null);
  const layerDragRef = useRef<string | null>(null);
  const zoneDragRef = useRef<{ id: string; startPointerX: number; startPointerY: number; startOffsetX: number; startOffsetY: number } | null>(null);
  const zoneResizeRef = useRef<{ id: string; handle: ResizeHandle; anchorWorldX: number; anchorWorldY: number } | null>(null);
  const stageShellRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sceneGlobalControlsRef = useRef<HTMLDivElement | null>(null);
  const sceneStateRef = useRef<GameScene>(scene);
  const selectedLayerIdRef = useRef(selectedLayerId);
  const sceneHistoryPastRef = useRef<GameScene[]>([]);
  const sceneHistoryFutureRef = useRef<GameScene[]>([]);
  const sceneHistoryLastRef = useRef<GameScene | null>(null);
  const sceneHistoryNavigationRef = useRef(false);
  const scenePasteCountRef = useRef(0);
  const nearbyInteractionRef = useRef<any>(null);
  const triggerNearbyInteractionRef = useRef<(entry?: any) => void>(() => {});

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
  const hasVisibleBackgroundImage = Boolean(backgroundLayer?.visible && backgroundLayer.imageUrl);
  const sceneFlowNodes = useMemo(() => buildSceneFlowNodes({
    currentScene: scene,
    currentBackground: backgroundLayer,
    savedScenes: savedSceneCards,
  }), [backgroundLayer, savedSceneCards, scene]);
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

  const scenePayload = useMemo(() => ({ ...scene, layers: [...scene.layers] }), [scene]);

  useEffect(() => {
    sceneStateRef.current = scene;
  }, [scene]);

  useEffect(() => {
    selectedLayerIdRef.current = selectedLayerId;
  }, [selectedLayerId]);

  useEffect(() => {
    const previousScene = sceneHistoryLastRef.current;
    const nextSnapshot = cloneSceneForHistory(scene);
    const isAutomaticSceneMotion = isPlaying || Boolean(heldDirection);

    if (!previousScene) {
      sceneHistoryLastRef.current = nextSnapshot;
      return;
    }

    if (previousScene.id !== scene.id) {
      sceneHistoryPastRef.current = [];
      sceneHistoryFutureRef.current = [];
      sceneHistoryLastRef.current = nextSnapshot;
      sceneHistoryNavigationRef.current = false;
      return;
    }

    if (sceneHistoryNavigationRef.current) {
      sceneHistoryNavigationRef.current = false;
      sceneHistoryLastRef.current = nextSnapshot;
      return;
    }

    if (sceneHistoryKey(previousScene) === sceneHistoryKey(scene)) {
      sceneHistoryLastRef.current = nextSnapshot;
      return;
    }

    if (!isAutomaticSceneMotion) {
      sceneHistoryPastRef.current = [...sceneHistoryPastRef.current, previousScene].slice(-SCENE_HISTORY_LIMIT);
      sceneHistoryFutureRef.current = [];
    }
    sceneHistoryLastRef.current = nextSnapshot;
  }, [heldDirection, isPlaying, scene]);

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
    const element = stageShellRef.current;
    const controls = sceneGlobalControlsRef.current;
    if (!element) return;
    const updateStageShellSize = () => {
      setStageShellSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
      setSceneControlsHeight(controls?.offsetHeight || 0);
    };
    updateStageShellSize();
    const observer = new ResizeObserver(updateStageShellSize);
    observer.observe(element);
    if (controls) observer.observe(controls);
    window.addEventListener("resize", updateStageShellSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateStageShellSize);
    };
  }, [tab, scenePanelWidths.layers, scenePanelWidths.inspector]);

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
    nearbyInteractionRef.current = nearbyInteraction;
  }, [nearbyInteraction]);

  useEffect(() => {
    const hasBuiltInSceneKitLayer = scene.layers.some(layer => layer.assetId && BUILT_IN_SCENE_KIT_ASSET_IDS.has(layer.assetId));
    if (!hasBuiltInSceneKitLayer) return;
    setScene(prev => prepareSceneForEditor(prev));
    setIsBackpackOpen(false);
  }, [scene.layers]);

  useEffect(() => {
    if (!interactionToast) return;
    const id = window.setTimeout(() => setInteractionToast(""), 1800);
    return () => window.clearTimeout(id);
  }, [interactionToast]);

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

  const triggerNearbyInteraction = (entry = nearbyInteractionRef.current || nearbyInteraction) => {
    if (!entry) return;
    if (entry.asset.id === BOARDING_TRAIN_ASSET_ID) {
      setVehiclePhase("boarded");
      setHeldDirection(null);
      setScene(prev => ({
        ...prev,
        layers: prev.layers.map(layer => {
          if (!layer.assetId) return layer;
          const asset = assetById.get(layer.assetId);
          if (asset?.role === "player") return { ...layer, opacity: 0.18 };
          if (layer.assetId === BOARDING_TRAIN_ASSET_ID) return { ...layer, zIndex: Math.max(layer.zIndex, 92) };
          return layer;
        }),
      }));
      setInteractionToast("Boarded the subway car");
      setNotice("Boarding triggered from the eye prompt. This vehicle can now be used as a scene-transition hook.");
      return;
    }
    const { layer, asset, interaction } = entry;
    const promptText = interaction.promptText || layer.name;
    const stateBag = sceneStateRef.current.state || {};
    const conditionKey = interaction.conditionStateKey?.trim();
    if (conditionKey && !stateMatches(stateBag[conditionKey], interaction.conditionStateValue)) {
      const failText = interaction.failSubtitle || "It does not seem ready yet.";
      setInteractionToast(failText);
      setNotice(`Interaction blocked by state: ${conditionKey}`);
      return;
    }

    const actionType = interaction.actionType || "subtitle";
    const subtitle = interaction.subtitle || promptText;
    if (actionType === "pickup-item") {
      const itemId = (interaction.itemId || safeName(layer.name)).trim();
      setScene(prev => ({
        ...prev,
        state: { ...(prev.state || {}), [itemId]: true },
        layers: prev.layers.map(item =>
          item.id === layer.id && interaction.hideLayerOnPickup !== false
            ? { ...item, visible: false }
            : item
        ),
      }));
      setSelectedLayerId("");
      setInteractionToast(subtitle || `Picked up ${layer.name}.`);
      setNotice(`Pickup stored in scene state: ${itemId}=true`);
      return;
    }

    if (actionType === "toggle-layer") {
      const targetLayerId = interaction.targetLayerId || layer.id;
      setScene(prev => ({
        ...prev,
        layers: prev.layers.map(item => item.id === targetLayerId ? { ...item, visible: !item.visible } : item),
      }));
      setInteractionToast(subtitle);
      setNotice(`Toggled layer visibility: ${targetLayerId}`);
      return;
    }

    if (actionType === "play-animation") {
      const targetLayerId = interaction.targetLayerId || layer.id;
      const targetLayer = sceneStateRef.current.layers.find(item => item.id === targetLayerId) || layer;
      const targetAsset = targetLayer.assetId ? assetById.get(targetLayer.assetId) : asset;
      const targetClip =
        targetAsset?.animations?.find(clip => clip.id === interaction.targetAnimationId) ||
        targetAsset?.animations?.find(clip => clip.id === targetAsset.defaultAnimationId) ||
        targetAsset?.animations?.[0];
      if (targetClip) {
        setScene(prev => ({
          ...prev,
          layers: prev.layers.map(item => item.id === targetLayerId ? { ...item, activeAnimationId: targetClip.id } : item),
        }));
        setActiveSprite(targetClip.sprite);
        setActiveFrame(0);
        setIsPlaying(true);
        setInteractionToast(subtitle);
        setNotice(`Played interaction animation: ${targetClip.name}`);
        return;
      }
    }

    if (actionType === "scene-link") {
      const targetScene = interaction.targetSceneId ? scenes.find(item => item.id === interaction.targetSceneId) : undefined;
      if (targetScene) {
        setInteractionToast(subtitle);
        loadSavedScene(targetScene);
        return;
      }
      setInteractionToast(interaction.failSubtitle || "No target scene is assigned yet.");
      setNotice("Scene-link interaction needs a target scene.");
      return;
    }

    if (actionType === "set-state") {
      const key = (interaction.setStateKey || conditionKey || safeName(promptText)).trim();
      const value = stateValueFromText(interaction.setStateValue || "true");
      setScene(prev => ({ ...prev, state: { ...(prev.state || {}), [key]: value } }));
      setInteractionToast(subtitle);
      setNotice(`Scene state updated: ${key}=${String(value)}`);
      return;
    }

    setInteractionToast(subtitle);
    setNotice(`Inspect triggered: ${promptText}`);
  };

  useEffect(() => {
    triggerNearbyInteractionRef.current = triggerNearbyInteraction;
  }, [triggerNearbyInteraction]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "KeyI") {
        event.preventDefault();
        if (event.repeat) return;
        setIsBackpackOpen(value => !value);
        setNotice("Backpack inventory toggled.");
        return;
      }

      const activeNearbyInteraction = nearbyInteractionRef.current;
      if (activeNearbyInteraction?.interaction?.triggerMode === "near-key") {
        const configuredKey = String(activeNearbyInteraction.interaction.promptKey || "KeyE").trim();
        const normalizedCode = configuredKey.length === 1 ? `Key${configuredKey.toUpperCase()}` : configuredKey;
        if (
          event.code.toLowerCase() === normalizedCode.toLowerCase() ||
          event.key.toLowerCase() === configuredKey.toLowerCase()
        ) {
          event.preventDefault();
          if (event.repeat) return;
          triggerNearbyInteractionRef.current(activeNearbyInteraction);
          return;
        }
      }

      const matchedLayer = sceneStateRef.current.layers
        .filter(layer => layer.visible && isSceneVisualLayer(layer) && layer.assetId)
        .map(layer => {
          const asset = assetById.get(layer.assetId!);
          const clip = asset?.animations?.find(item =>
            item.binding?.triggerType === "keyboard" &&
            item.binding.triggerValue.toLowerCase() === event.code.toLowerCase()
          );
          return asset && clip ? { layer, asset, clip } : null;
        })
        .find(Boolean);

      if (matchedLayer) {
        event.preventDefault();
        if (matchedLayer.clip.direction === "left" || matchedLayer.clip.direction === "right") {
          setHeldDirection(matchedLayer.clip.direction);
        }
        if (event.repeat) return;
        setScene(prev => ({
          ...prev,
          layers: prev.layers.map(layer => layer.id === matchedLayer.layer.id ? { ...layer, activeAnimationId: matchedLayer.clip.id } : layer),
        }));
        setActiveSprite(matchedLayer.clip.sprite);
        setActiveFrame(0);
        setIsPlaying(true);
        setNotice(`Keyboard ${matchedLayer.clip.binding?.triggerValue} triggered action: ${matchedLayer.clip.name}`);
        return;
      }

      const matched = assets.find(asset =>
        !asset.animations?.length &&
        asset.binding.triggerType === "keyboard" &&
        asset.binding.triggerValue.toLowerCase() === event.code.toLowerCase()
      );
      if (!matched) return;
      event.preventDefault();
      if (event.repeat) return;
      setActiveSprite(matched.sprite);
      setActiveFrame(0);
      setIsPlaying(true);
      setNotice(`Keyboard ${matched.binding.triggerValue} triggered action: ${matched.binding.actionName}`);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const matchedLayer = sceneStateRef.current.layers
        .filter(layer => layer.visible && isSceneVisualLayer(layer) && layer.assetId)
        .map(layer => {
          const asset = assetById.get(layer.assetId!);
          const triggeredClip = asset?.animations?.find(item =>
            item.binding?.triggerType === "keyboard" &&
            item.binding.triggerValue.toLowerCase() === event.code.toLowerCase()
          );
          if (!asset || !triggeredClip) return null;
          const idleClip =
            asset.animations?.find(item => item.id === asset.defaultAnimationId) ||
            asset.animations?.find(item => item.actionName === "idle");
          return idleClip ? { layer, idleClip } : null;
        })
        .find(Boolean);

      if (!matchedLayer) return;
      event.preventDefault();
      setHeldDirection(null);
      setScene(prev => ({
        ...prev,
        layers: prev.layers.map(layer => layer.id === matchedLayer.layer.id ? { ...layer, activeAnimationId: matchedLayer.idleClip.id } : layer),
      }));
      setActiveSprite(matchedLayer.idleClip.sprite);
      setActiveFrame(0);
      setIsPlaying(true);
      setNotice("Key released. Returning to idle breathing.");
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [assetById, assets]);

  useEffect(() => {
    if (!heldDirection) return;
    let frameId = 0;
    let lastTime = performance.now();
    const step = (time: number) => {
      const delta = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;
      setScene(prev => {
        const viewportW = sceneViewportWidth(prev);
        const maxCameraX = Math.max(0, prev.width - viewportW);
        const direction = heldDirection === "left" ? -1 : 1;
        let focusX: number | null = null;
        const layers = prev.layers.map(layer => {
          if (!layer.assetId) return layer;
          const asset = assetById.get(layer.assetId);
          if (asset?.role !== "player") return layer;
          const sprite = resolveAssetSprite(asset, layer);
          const [spriteW] = sprite ? getFrameSize(sprite) : [0, 0];
          const layerWidth = spriteW * layer.scale;
          const nextX = clamp(layer.x + direction * walkSpeed * delta, 0, Math.max(0, prev.width - layerWidth));
          focusX = nextX + layerWidth * 0.5;
          return { ...layer, x: Number(nextX.toFixed(2)) };
        });
        if (focusX === null) return prev;
        const nextCameraX = clamp(focusX - viewportW * 0.42, 0, maxCameraX);
        return { ...prev, cameraX: Number(nextCameraX.toFixed(2)), layers };
      });
      frameId = window.requestAnimationFrame(step);
    };
    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [assetById, heldDirection, walkSpeed]);

  useEffect(() => {
    if (vehiclePhase !== "approaching" || !hasBoardingTrainLayer) return;
    let frameId = 0;
    let lastTime = performance.now();
    const step = (time: number) => {
      const delta = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;
      let arrived = false;
      setScene(prev => {
        const viewportW = sceneViewportWidth(prev);
        const trainAsset = assetById.get(BOARDING_TRAIN_ASSET_ID);
        const playerLayer = prev.layers.find(layer => {
          if (!layer.visible || !layer.assetId || !isSceneVisualLayer(layer)) return false;
          return assetById.get(layer.assetId)?.role === "player";
        });
        const playerAsset = playerLayer?.assetId ? assetById.get(playerLayer.assetId) : undefined;
        const playerBounds = playerLayer ? layerWorldBounds(playerLayer, playerAsset) : null;
        const layers = prev.layers.map(layer => {
          if (layer.assetId !== BOARDING_TRAIN_ASSET_ID) return layer;
          const bounds = layerWorldBounds(layer, trainAsset);
          const maxLayerX = Math.max(40, prev.width - bounds.width);
          const targetX = playerBounds
            ? clamp(playerBounds.centerX - bounds.width * 0.46, 40, maxLayerX)
            : clamp(prev.cameraX + viewportW * 0.28, 40, maxLayerX);
          const nextX = Math.max(targetX, layer.x - 330 * delta);
          if (Math.abs(nextX - targetX) < 3) arrived = true;
          return { ...layer, x: Number(nextX.toFixed(2)) };
        });
        return { ...prev, layers };
      });
      if (arrived) {
        setVehiclePhase("ready");
        setInteractionToast("Subway car stopped");
        setNotice("The subway car has stopped in front of the player. Click the eye prompt to board.");
        return;
      }
      frameId = window.requestAnimationFrame(step);
    };
    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [assetById, hasBoardingTrainLayer, vehiclePhase]);

  const updateSceneLayer = (layerId: string, patch: Partial<SceneLayer>) => {
    setScene(prev => ({
      ...prev,
      layers: prev.layers.map(layer => layer.id === layerId ? { ...layer, ...patch } : layer),
    }));
  };

  const setLayerAnimation = (layerId: string, clip: AnimationClip) => {
    updateSceneLayer(layerId, { activeAnimationId: clip.id });
    setActiveSprite(clip.sprite);
    setActiveFrame(0);
    setIsPlaying(true);
    setNotice(`Switched action: ${clip.name}`);
  };

  const previewSceneSpritesheetEntry = (entry: SceneSpritesheetEntry, openScene = false) => {
    updateSceneLayer(entry.layer.id, { activeAnimationId: entry.clip?.id || entry.layer.activeAnimationId });
    setSelectedLayerId(entry.layer.id);
    setActiveSprite(entry.sprite);
    setActiveFrame(0);
    setIsPlaying(true);
    setExpandedSpritesheetKey(entry.key);
    if (openScene) setTab("scene");
    setNotice(`Previewing ${entry.asset.name} on layer ${entry.layer.name}.`);
  };

  const updateAssetMetadata = (assetId: string, patch: Partial<GameAsset>) => {
    if (!assets.some(asset => asset.id === assetId)) {
      setNotice("Built-in scene kit assets can be layered and animated, but save a copy before editing their library metadata.");
      return;
    }
    setAssets(prev => prev.map(asset => asset.id === assetId ? { ...asset, ...patch, updatedTime: new Date().toISOString() } : asset));
  };

  const updateAssetClipMetadata = (
    assetId: string,
    clipId: string,
    patch: Partial<AnimationClip>,
    bindingPatch?: Partial<ActionBinding>
  ) => {
    if (!assets.some(asset => asset.id === assetId)) {
      setNotice("Built-in scene kit assets can be previewed here, but their metadata is read-only.");
      return;
    }
    setAssets(prev => prev.map(asset => {
      if (asset.id !== assetId || !asset.animations?.length) return asset;
      const animations = asset.animations.map(clip => {
        if (clip.id !== clipId) return clip;
        return {
          ...clip,
          ...patch,
          binding: { ...clip.binding, ...bindingPatch },
        };
      });
      const defaultClip =
        animations.find(clip => clip.id === asset.defaultAnimationId) ||
        animations[0];
      return {
        ...asset,
        animations,
        sprite: defaultClip?.sprite || asset.sprite,
        binding: defaultClip?.binding || asset.binding,
        updatedTime: new Date().toISOString(),
      };
    }));
  };

  const replaceSpriteInAsset = (asset: GameAsset, spriteId: string, nextSprite: AnimationSprite): GameAsset => {
    const animations = asset.animations?.map(clip => (
      clip.sprite.id === spriteId ? { ...clip, sprite: nextSprite } : clip
    ));
    return {
      ...asset,
      sprite: asset.sprite.id === spriteId ? nextSprite : asset.sprite,
      animations,
      updatedTime: new Date().toISOString(),
    };
  };

  const updateSelectedSpriteMetadata = (patch: Partial<AnimationSprite>) => {
    if (!selectedLayerAsset || !selectedLayerSprite) return;
    if (!selectedAssetEditable) {
      setNotice("Built-in spritesheet metadata is read-only. Import or save a copy before editing it.");
      return;
    }
    const nextSprite = { ...selectedLayerSprite, ...patch };
    setAssets(prev => prev.map(asset => (
      asset.id === selectedLayerAsset.id ? replaceSpriteInAsset(asset, selectedLayerSprite.id, nextSprite) : asset
    )));
    if (activeSprite.id === selectedLayerSprite.id) setActiveSprite(nextSprite);
  };

  const updateSelectedSpritesheetFps = (nextValue: number) => {
    const nextFps = Math.max(1, Math.round(nextValue));
    setFps(nextFps);
    if (!selectedLayerAsset || !selectedAssetEditable) return;
    if (selectedLayerClip) {
      updateAssetClipMetadata(selectedLayerAsset.id, selectedLayerClip.id, { fps: nextFps });
      return;
    }
    updateSelectedSpriteMetadata({ fps: nextFps });
  };

  const rebuildSelectedSpritesheetGrid = (patch: {
    frameWidth?: number;
    frameHeight?: number;
    frameCount?: number;
    columns?: number;
  }) => {
    if (!selectedLayerAsset || !selectedLayerSprite) return;
    if (!selectedLayerSpriteEditableGrid) {
      setNotice("Only imported spritesheet images can rebuild their frame grid here.");
      return;
    }
    const source = selectedLayerSpriteSource;
    const [currentFrameWidth, currentFrameHeight] = selectedLayerFrameSize;
    const [sheetWidth, sheetHeight] = selectedLayerSpriteSheetSize;
    const frameWidth = Math.max(1, Math.round(patch.frameWidth ?? currentFrameWidth));
    const frameHeight = Math.max(1, Math.round(patch.frameHeight ?? currentFrameHeight));
    const frameCount = Math.max(1, Math.round(patch.frameCount ?? selectedLayerSpriteFrameCount));
    const columns = Math.max(1, Math.round(patch.columns ?? selectedLayerSpriteColumns));
    const rows = Math.max(1, Math.ceil(frameCount / columns));

    if (columns * frameWidth > sheetWidth + 1 || rows * frameHeight > sheetHeight + 1) {
      setNotice("Frame grid is larger than the spritesheet image. Reduce frame size, frame count, or columns.");
      return;
    }

    const nextSprite: AnimationSprite = {
      ...selectedLayerSprite,
      frameCount,
      frames: buildSpritesheetFrames(source, sheetWidth, sheetHeight, frameWidth, frameHeight, frameCount, columns),
      frameSize: [frameWidth, frameHeight],
      sheetSize: [sheetWidth, sheetHeight],
      gridColumns: columns,
      adaptiveFramePolicy: `${columns} columns, ${rows} rows, ${frameCount} active frames.`,
      updatedTime: new Date().toISOString(),
    } as AnimationSprite;

    setAssets(prev => prev.map(asset => (
      asset.id === selectedLayerAsset.id ? replaceSpriteInAsset(asset, selectedLayerSprite.id, nextSprite) : asset
    )));
    if (activeSprite.id === selectedLayerSprite.id) setActiveSprite(nextSprite);
    setActiveFrame(prev => Math.min(prev, frameCount - 1));
    setNotice(`Updated spritesheet grid: ${frameCount} frames / ${frameWidth} x ${frameHeight}.`);
  };

  const saveAssetMetadata = async (assetId: string) => {
    const asset = assets.find(item => item.id === assetId);
    if (!asset) {
      setNotice("This asset is built in. Save it as a confirmed asset first if you want persistent metadata edits.");
      return;
    }
    setError(null);
    try {
      const data = await saveGameAsset(asset, "Failed to save asset metadata");
      setAssets(data.library.assets);
      setNotice(`Saved spritesheet metadata: ${asset.name}`);
    } catch (err: any) {
      setError(err.message || "Failed to save asset metadata");
    }
  };

  const updateSceneLighting = (patch: Partial<NonNullable<GameScene["lighting"]>>) => {
    setScene(prev => ({
      ...prev,
      lighting: { ...NEON_SCENE_LIGHTING, ...prev.lighting, ...patch },
    }));
  };

  const updateSelectedLayerLighting = (patch: Partial<NonNullable<SceneLayer["lighting"]>>) => {
    if (!selectedLayer || selectedLayer.locked || !isSceneVisualLayer(selectedLayer)) return;
    updateSceneLayer(selectedLayer.id, {
      lighting: { ...NEON_LAYER_LIGHTING, ...selectedLayer.lighting, ...patch },
    });
  };

  const updateSelectedLayerShadow = (patch: Partial<NonNullable<SceneLayer["shadow"]>>) => {
    if (!selectedLayer || selectedLayer.locked || !isSceneVisualLayer(selectedLayer)) return;
    updateSceneLayer(selectedLayer.id, {
      shadow: { ...NEON_CONTACT_SHADOW, ...selectedLayer.shadow, ...patch },
    });
  };

  const updateLayerInteraction = (layerId: string, patch: Partial<LayerInteractionSettings>) => {
    setScene(prev => ({
      ...prev,
      layers: prev.layers.map(layer => {
        if (layer.id !== layerId || layer.locked || !isSceneVisualLayer(layer)) return layer;
        const asset = layer.assetId ? assetById.get(layer.assetId) : undefined;
        const base = layerInteractionSettings(layer, asset) || DEFAULT_INTERACTION_SETTINGS;
        return {
          ...layer,
          interaction: { ...base, ...layer.interaction, ...patch },
        };
      }),
    }));
  };

  const updateSelectedLayerInteraction = (patch: Partial<LayerInteractionSettings>) => {
    if (!selectedLayer || selectedLayer.locked || !isSceneVisualLayer(selectedLayer)) return;
    updateLayerInteraction(selectedLayer.id, patch);
  };

  const applyInteractionPreset = (preset: InteractionPreset) => {
    if (!selectedLayer || selectedLayer.locked || !isSceneVisualLayer(selectedLayer)) return;
    const { label, ...presetPatch } = INTERACTION_PRESETS[preset];
    const base = layerInteractionSettings(selectedLayer, selectedLayerAsset) || DEFAULT_INTERACTION_SETTINGS;
    const bounds = layerWorldBounds(selectedLayer, selectedLayerAsset);
    const keyName = safeName(selectedLayer.name || label);
    updateSceneLayer(selectedLayer.id, {
      interaction: {
        ...base,
        ...selectedLayer.interaction,
        ...presetPatch,
        enabled: true,
        zoneWidth: selectedLayer.interaction?.zoneWidth || Math.round(bounds.width || 160),
        zoneHeight: selectedLayer.interaction?.zoneHeight || Math.round(bounds.height || 120),
        itemId: preset === "pickup" ? selectedLayer.interaction?.itemId || keyName : selectedLayer.interaction?.itemId,
        setStateKey: preset === "conditional" ? selectedLayer.interaction?.setStateKey || keyName : selectedLayer.interaction?.setStateKey,
        promptKey: presetPatch.triggerMode === "near-key" ? selectedLayer.interaction?.promptKey || "KeyE" : selectedLayer.interaction?.promptKey || base.promptKey,
      },
    });
    setNotice(`Applied interaction preset: ${label}`);
  };

  const updateSceneFrame = (patch: Partial<Pick<GameScene, "viewportWidth" | "viewportHeight" | "viewportPreset">>) => {
    setScene(prev => {
      const requestedViewportWidth = patch.viewportWidth || prev.viewportWidth || VIEWPORT_WIDTH;
      const requestedViewportHeight = patch.viewportHeight || prev.viewportHeight || prev.height;
      const nextSceneWidth = Math.max(prev.width, requestedViewportWidth);
      const nextSceneHeight = Math.max(prev.height, requestedViewportHeight);
      const nextViewportWidth = Math.min(requestedViewportWidth, nextSceneWidth);
      const nextViewportHeight = requestedViewportHeight;
      return {
        ...prev,
        ...patch,
        width: nextSceneWidth,
        height: nextSceneHeight,
        viewportWidth: nextViewportWidth,
        viewportHeight: nextViewportHeight,
        cameraX: clamp(prev.cameraX, 0, Math.max(0, nextSceneWidth - nextViewportWidth)),
        layers: prev.layers.map(layer => {
          if (layer.type !== "background") return layer;
          const followsWorldWidth = !layer.width || Math.abs(layer.width - prev.width) <= 2;
          const followsWorldHeight = !layer.height || Math.abs(layer.height - prev.height) <= 2;
          return {
            ...layer,
            width: followsWorldWidth ? nextSceneWidth : layer.width,
            height: followsWorldHeight ? nextSceneHeight : layer.height,
            y: followsWorldHeight && Math.abs(layer.y - prev.height) <= 2 ? nextSceneHeight : layer.y,
          };
        }),
      };
    });
  };

  const saveAsset = async () => {
    setError(null);
    try {
      const asset = createAsset(activeSprite, role, binding, tagsText);
      const data = await saveGameAsset(asset);
      setAssets(data.library.assets);
      setNotice(`Saved action asset: ${asset.name}`);
    } catch (err: any) {
      setError(err.message || "Failed to save asset");
    }
  };

  const deleteAsset = async (assetId: string) => {
    setError(null);
    try {
      const data = await deleteGameAsset(assetId);
      setAssets(data.library.assets);
      setScenes(data.library.scenes);
      setScene(prev => ({ ...prev, layers: prev.layers.filter(layer => layer.assetId !== assetId) }));
      setNotice("Removed from the asset library.");
    } catch (err: any) {
      setError(err.message || "Failed to delete asset");
    }
  };

  const insertAssetLayer = (asset: GameAsset, overrides: Partial<SceneLayer> = {}) => {
    const assetSprite = resolveAssetSprite(asset);
    const [, assetHeight] = assetSprite ? getFrameSize(assetSprite) : [256, 256];
    const targetHeight = asset.role === "effect" ? 150 : asset.role === "player" ? 300 : 220;
    const defaultScale = clampLayerScale(targetHeight / Math.max(1, assetHeight));
    const layer: SceneLayer = {
      id: `layer_${safeName(asset.binding.actionName)}_${Date.now()}`,
      name: asset.name,
      type: asset.role === "effect" ? "effect" : "sprite",
      visible: true,
      assetId: asset.id,
      activeAnimationId: asset.defaultAnimationId || asset.animations?.[0]?.id,
      x: Math.round(scene.width * 0.45),
      y: scene.groundY + 2,
      scale: defaultScale,
      zIndex: asset.role === "effect" ? 42 : 30,
      opacity: 1,
      parallax: 1,
      ...overrides,
    };
    setScene(prev => ({ ...prev, layers: [...prev.layers, layer] }));
    setSelectedLayerId(layer.id);
    setSelectedInteractionZoneLayerId(null);
    if (assetSprite) {
      setActiveSprite(assetSprite);
      setActiveFrame(0);
    }
    setIsLayerLibraryOpen(false);
    setTab("scene");
    setNotice(`Inserted layer: ${asset.name}`);
  };

  const handleLayerImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file to add as a static object.");
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const image = new Image();
      image.onload = async () => {
        const now = new Date().toISOString();
        const baseName = file.name.replace(/\.[^.]+$/, "") || "Uploaded Object";
        const width = Math.max(1, image.naturalWidth || image.width || 256);
        const height = Math.max(1, image.naturalHeight || image.height || 256);
        const safeBase = safeName(baseName);
        const sprite: AnimationSprite = {
          id: `sprite_static_${safeBase}_${Date.now()}`,
          characterName: baseName,
          description: `Uploaded static object from ${file.name}.`,
          frameCount: 1,
          style: "Uploaded static object",
          frames: [`<img src="${dataUrl}" alt="${escapeHtmlAttribute(baseName)}" draggable="false" />`],
          createdTime: now,
          isPreset: false,
          spritesheetPng: dataUrl,
          rawSpritesheetPng: dataUrl,
          frameSize: [width, height],
          sheetSize: [width, height],
          generationMode: "uploaded-static-object",
          proportionPolicy: "Uploaded static object keeps its original pixel ratio and can be resized as a scene layer.",
        };
        const binding: ActionBinding = {
          actionName: "static",
          triggerType: "auto",
          triggerValue: "auto",
          gameState: `static.${safeBase}`,
          notes: "Static object uploaded from the Layer panel.",
        };
        const asset: GameAsset = {
          id: `asset_static_${safeBase}_${Date.now()}`,
          name: baseName,
          role: "prop",
          confirmed: true,
          savedTime: now,
          updatedTime: now,
          sprite,
          binding,
          tags: ["uploaded", "static-object"],
        };

        try {
          const data = await saveGameAsset(asset, "Failed to save uploaded object");
          const savedAsset = data.library.assets.find((item: GameAsset) => item.id === asset.id) || asset;
          setAssets(data.library.assets);
          setSprites(prev => [sprite, ...prev.filter(item => item.id !== sprite.id)]);
          insertAssetLayer(savedAsset);
          setNotice(`Uploaded and inserted: ${savedAsset.name}`);
        } catch (err: any) {
          setError(err.message || "Failed to save uploaded object");
        }
      };
      image.onerror = () => setError("Could not read the uploaded image size.");
      image.src = dataUrl;
    };
    reader.onerror = () => setError("Could not read the uploaded image.");
    reader.readAsDataURL(file);
  };

  const insertActiveSprite = () => {
    const tempAsset = assets.find(asset =>
      asset.sprite.id === activeSprite.id ||
      asset.animations?.some(clip => clip.sprite.id === activeSprite.id)
    );
    if (tempAsset) {
      insertAssetLayer(tempAsset);
      return;
    }
    setNotice("Save the current spritesheet as a confirmed asset before inserting it into the scene.");
  };

  const selectSheetOnlySprite = (previewSprite: AnimationSprite, title = previewSprite.characterName, asset?: GameAsset) => {
    if (!previewSprite?.frames.length) return;
    const defaultClip = asset?.animations?.find(clip => clip.id === asset.defaultAnimationId) || asset?.animations?.[0];
    setActiveSprite(previewSprite);
    setActiveFrame(0);
    setIsPlaying(false);
    setSheetOnlyHasSelection(true);
    setSheetOnlySelectionKind("sprite");
    setSheetOnlySelectionTitle(title);
    setSheetColumns(previewSprite.gridColumns || Math.min(4, previewSprite.frames.length || 4));
    setSheetDataUrl(previewSprite.spritesheetPng || previewSprite.rawSpritesheetPng || null);
    if (asset) {
      setRole(asset.role);
      setBinding(defaultClip?.binding || asset.binding || defaultBinding);
      setTagsText(asset.tags.join(", "));
    }
    setNotice(`Loaded spritesheet object: ${title}`);
  };

  const selectSheetOnlyImage = (imageUrl: string, title: string) => {
    setActiveFrame(0);
    setIsPlaying(false);
    setSheetOnlyHasSelection(true);
    setSheetOnlySelectionKind("image");
    setSheetOnlySelectionTitle(title);
    setSheetDataUrl(imageUrl);
    setNotice(`Loaded image: ${title}`);
  };

  const insertSceneKitAsset = (assetId: string) => {
    const asset = SCENE_KIT_ASSETS.find(item => item.id === assetId);
    if (!asset) return;
    insertAssetLayer(asset, createSceneKitLayer(scene, assetId, false));
    if (assetId === BOARDING_TRAIN_ASSET_ID) setVehiclePhase("approaching");
    setNotice(`Inserted reusable scene-kit layer: ${asset.name}`);
  };

  const insertFullSceneKit = () => {
    setScene(prev => ensureSceneKitLayers(prev));
    setVehiclePhase("approaching");
    setTab("scene");
    setNotice("Subway interaction kit is available: reusable eye inspect hotspots, ticket machine, backpack HUD, Line 13 sign, and boarding train.");
  };

  const reorderLayerStack = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setScene(prev => {
      const topFirst = [...prev.layers].sort((a, b) => b.zIndex - a.zIndex);
      const sourceIndex = topFirst.findIndex(layer => layer.id === sourceId);
      const targetIndex = topFirst.findIndex(layer => layer.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;
      const [source] = topFirst.splice(sourceIndex, 1);
      topFirst.splice(targetIndex, 0, source);
      const nextZ = new Map(topFirst.map((layer, index) => [layer.id, (topFirst.length - index) * 10]));
      return {
        ...prev,
        layers: prev.layers.map(layer => ({ ...layer, zIndex: nextZ.get(layer.id) ?? layer.zIndex })),
      };
    });
  };

  const finishLayerPointerReorder = (clientX: number, clientY: number) => {
    const sourceLayerId = layerDragRef.current;
    if (!sourceLayerId) return;
    const targetLayerId = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>("[data-layer-row-id]")
      ?.dataset.layerRowId;
    if (targetLayerId) reorderLayerStack(sourceLayerId, targetLayerId);
    layerDragRef.current = null;
    setDraggedLayerId(null);
    setLayerDropTargetId(null);
  };

  const startScenePanelResize = (event: PointerEvent<HTMLButtonElement>, handle: ScenePanelResizeHandle) => {
    event.preventDefault();
    event.stopPropagation();
    scenePanelResizeRef.current = {
      handle,
      startX: event.clientX,
      startLayerWidth: scenePanelWidths.layers,
      startInspectorWidth: scenePanelWidths.inspector,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.classList.add("resizing-scene-panels");
  };

  const inferImportedFrameSize = (sheetSize = importSheetSize, columns = importColumns, frameCount = importFrameCount) => {
    if (!sheetSize) {
      setNotice("Upload a spritesheet first so the frame size can be inferred.");
      return;
    }
    const safeColumns = Math.max(1, Math.round(columns));
    const rows = Math.max(1, Math.ceil(Math.max(1, frameCount) / safeColumns));
    setImportFrameWidth(Math.max(1, Math.floor(sheetSize[0] / safeColumns)));
    setImportFrameHeight(Math.max(1, Math.floor(sheetSize[1] / rows)));
  };

  const handleImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setImportSheetDataUrl(dataUrl);
      setImportFileName(file.name);
      const baseName = file.name.replace(/\.[^.]+$/, "");
      setImportAssetName(prev => (!prev.trim() || prev === "Imported Animation" ? baseName : prev));
      const image = new Image();
      image.onload = () => {
        const sheetSize: [number, number] = [image.naturalWidth || image.width, image.naturalHeight || image.height];
        setImportSheetSize(sheetSize);
        inferImportedFrameSize(sheetSize);
      };
      image.onerror = () => setError("Could not read the uploaded image size.");
      image.src = dataUrl;
    };
    reader.onerror = () => setError("Could not read the uploaded file.");
    reader.readAsDataURL(file);
  };

  const updateImportTriggerType = (triggerType: ActionTriggerType) => {
    setImportTriggerType(triggerType);
    setImportTriggerValue(defaultTriggerValueForType(triggerType));
    setImportGameState(defaultGameStateForTrigger(triggerType, importActionName));
    if (triggerType === "auto") setImportLoop(true);
  };

  const updateImportActionName = (nextActionName: string) => {
    setImportActionName(nextActionName);
    setImportGameState(prev =>
      prev === defaultGameStateForTrigger(importTriggerType, importActionName)
        ? defaultGameStateForTrigger(importTriggerType, nextActionName)
        : prev
    );
  };

  const saveImportedSpritesheet = async (insertAfterSave = false) => {
    setError(null);
    if (!importSheetDataUrl) {
      setError("Choose a spritesheet image first.");
      return;
    }
    const frameWidth = Math.max(1, Math.round(importFrameWidth));
    const frameHeight = Math.max(1, Math.round(importFrameHeight));
    const frameCount = Math.max(1, Math.round(importFrameCount));
    const columns = Math.max(1, Math.round(importColumns));
    const rows = Math.ceil(frameCount / columns);
    const sheetWidth = importSheetSize?.[0] || frameWidth * columns;
    const sheetHeight = importSheetSize?.[1] || frameHeight * rows;
    if (columns * frameWidth > sheetWidth + 1 || rows * frameHeight > sheetHeight + 1) {
      setError("The frame grid is larger than the uploaded spritesheet. Check frame size, columns, and frame count.");
      return;
    }

    const now = new Date().toISOString();
    const actionName = importActionName.trim() || "loop";
    const assetName = importAssetName.trim() || "Imported Animation";
    const binding: ActionBinding = {
      actionName,
      triggerType: importTriggerType,
      triggerValue: importTriggerValue.trim() || defaultTriggerValueForType(importTriggerType),
      gameState: importGameState.trim() || defaultGameStateForTrigger(importTriggerType, actionName),
      notes: importTriggerType === "auto" && importLoop
        ? "Imported spritesheet loops continuously while it is visible in the scene."
        : "Imported spritesheet action with configurable trigger metadata.",
    };
    const sprite: AnimationSprite = {
      id: `sprite_import_${safeName(assetName)}_${Date.now()}`,
      characterName: assetName,
      description: `Imported ${frameCount}-frame spritesheet from ${importFileName || "uploaded image"}.`,
      frameCount,
      style: "Imported spritesheet",
      frames: buildSpritesheetFrames(importSheetDataUrl, sheetWidth, sheetHeight, frameWidth, frameHeight, frameCount, columns),
      createdTime: now,
      isPreset: false,
      spritesheetPng: importSheetDataUrl,
      fps,
      gridColumns: columns,
      frameSize: [frameWidth, frameHeight],
      sheetSize: [sheetWidth, sheetHeight],
      generationMode: "uploaded-spritesheet",
      proportionPolicy: "Use the exact uploaded frame grid; do not stretch or recrop frames.",
      adaptiveFramePolicy: `${columns} columns, ${rows} rows, ${frameCount} active frames.`,
    };
    const clip: AnimationClip = {
      id: `clip_${safeName(actionName)}_${Date.now()}`,
      name: actionName,
      actionName,
      direction: "none",
      sprite,
      binding,
      loop: importLoop,
      fps,
    };
    const asset: GameAsset = {
      id: `asset_${safeName(assetName)}_${safeName(actionName)}_${Date.now()}`,
      name: `${assetName} / ${actionName}`,
      role: importRole,
      confirmed: true,
      savedTime: now,
      updatedTime: now,
      sprite,
      animations: [clip],
      defaultAnimationId: clip.id,
      binding,
      tags: splitTags(importTagsText),
    };

    try {
      const data = await saveGameAsset(asset, "Failed to import spritesheet asset");
      const savedAsset = data.library.assets.find((item: GameAsset) => item.id === asset.id) || asset;
      setAssets(data.library.assets);
      setSprites(prev => [sprite, ...prev.filter(item => item.id !== sprite.id)]);
      setActiveSprite(sprite);
      setActiveFrame(0);
      setSheetColumns(columns);
      setSheetDataUrl(importSheetDataUrl);
      if (insertAfterSave) insertAssetLayer(savedAsset);
      setNotice(insertAfterSave ? `Imported and inserted: ${asset.name}` : `Imported spritesheet asset: ${asset.name}`);
    } catch (err: any) {
      setError(err.message || "Failed to import spritesheet asset");
    }
  };

  const copyLayerToSceneClipboard = (layerId = selectedLayerIdRef.current) => {
    const layer = sceneStateRef.current.layers.find(item => item.id === layerId);
    if (!layer || !isTransformableSceneLayer(layer)) {
      setNotice("Select an item or background to copy.");
      setSceneContextMenu(null);
      return false;
    }
    setSceneClipboard({ layer: cloneSceneLayer(layer), sourceSceneId: sceneStateRef.current.id });
    scenePasteCountRef.current = 0;
    setSceneContextMenu(null);
    setNotice(`Copied: ${layer.name}`);
    return true;
  };

  const cutLayerToSceneClipboard = (layerId = selectedLayerIdRef.current) => {
    const layer = sceneStateRef.current.layers.find(item => item.id === layerId);
    if (!layer || !isTransformableSceneLayer(layer)) {
      setNotice("Select an item to cut.");
      setSceneContextMenu(null);
      return;
    }
    if (layer.locked) {
      setNotice("Unlock the layer before cutting it.");
      setSceneContextMenu(null);
      return;
    }
    if (layer.type === "background") {
      setNotice("Background cannot be cut. Copy it, then paste into another scene to replace background settings.");
      setSceneContextMenu(null);
      return;
    }
    setSceneClipboard({ layer: cloneSceneLayer(layer), sourceSceneId: sceneStateRef.current.id });
    scenePasteCountRef.current = 0;
    setScene(prev => ({ ...prev, layers: prev.layers.filter(item => item.id !== layer.id) }));
    setSelectedLayerId("");
    setSelectedInteractionZoneLayerId(null);
    setSceneContextMenu(null);
    setNotice(`Cut: ${layer.name}`);
  };

  const pasteLayerFromSceneClipboard = () => {
    if (!sceneClipboard) {
      setNotice("Nothing to paste.");
      setSceneContextMenu(null);
      return;
    }

    const sourceLayer = cloneSceneLayer(sceneClipboard.layer);
    if (sourceLayer.type === "background") {
      const targetBackground = sceneStateRef.current.layers.find(layer => layer.type === "background");
      if (!targetBackground) {
        setNotice("No background layer is available in this scene.");
        setSceneContextMenu(null);
        return;
      }
      if (targetBackground.locked) {
        setNotice("Unlock the background before pasting background settings.");
        setSceneContextMenu(null);
        return;
      }
      const replacement = replaceBackgroundLayerSettings(targetBackground, sourceLayer);
      setScene(prev => ({
        ...prev,
        layers: prev.layers.map(layer => layer.id === targetBackground.id ? replacement : layer),
      }));
      setSelectedLayerId(targetBackground.id);
      setSelectedInteractionZoneLayerId(null);
      setSceneContextMenu(null);
      setNotice(`Pasted background settings from ${sourceLayer.name}.`);
      return;
    }

    const offsetIndex = scenePasteCountRef.current + 1;
    const maxZ = Math.max(...sceneStateRef.current.layers.map(layer => layer.zIndex), sourceLayer.zIndex);
    const pastedLayer = createSceneLayerInstance(sourceLayer, "paste", offsetIndex, maxZ + 1);
    scenePasteCountRef.current = offsetIndex;
    setScene(prev => ({ ...prev, layers: [...prev.layers, pastedLayer] }));
    setSelectedLayerId(pastedLayer.id);
    setSelectedInteractionZoneLayerId(null);
    setSceneContextMenu(null);
    setNotice(`Pasted: ${sourceLayer.name}`);
  };

  const duplicateSceneLayer = (layerId = selectedLayerIdRef.current) => {
    const layer = sceneStateRef.current.layers.find(item => item.id === layerId);
    if (!layer || !isTransformableSceneLayer(layer)) {
      setNotice("Select an item to duplicate.");
      setSceneContextMenu(null);
      return;
    }
    if (layer.locked) {
      setNotice("Unlock the layer before duplicating it.");
      setSceneContextMenu(null);
      return;
    }
    if (layer.type === "background") {
      setNotice("Background uses a single editable layer. Copy and paste it into another scene to reuse settings.");
      setSceneContextMenu(null);
      return;
    }
    const maxZ = Math.max(...sceneStateRef.current.layers.map(item => item.zIndex), layer.zIndex);
    const copy = createSceneLayerInstance(layer, "copy", 1, maxZ + 1);
    setScene(prev => ({ ...prev, layers: [...prev.layers, copy] }));
    setSelectedLayerId(copy.id);
    setSelectedInteractionZoneLayerId(null);
    setSceneContextMenu(null);
    setNotice(`Duplicated: ${layer.name}`);
  };

  const duplicateSelectedLayer = () => duplicateSceneLayer(selectedLayerId);

  const openSceneLayerContextMenu = (
    event: MouseEvent<HTMLElement>,
    layer: SceneLayer,
    target: SceneObjectTarget = "layer",
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedLayerId(layer.id);
    setSelectedInteractionZoneLayerId(target === "interaction-zone" ? layer.id : null);
    const layerAsset = layer.assetId ? assetById.get(layer.assetId) : undefined;
    const layerSprite = resolveAssetSprite(layerAsset, layer);
    if (layerSprite) {
      setActiveSprite(layerSprite);
      setActiveFrame(0);
    }
    setSceneContextMenu({ x: event.clientX, y: event.clientY, layerId: layer.id, target });
  };

  const deleteSceneObject = (layerId: string, target: SceneObjectTarget) => {
    const layer = sceneStateRef.current.layers.find(item => item.id === layerId);
    if (!layer) return;
    if (target !== "interaction-zone" && layer.type === "background") {
      const hadBackgroundImage = Boolean(layer.imageUrl);
      setScene(prev => ({
        ...prev,
        background: "none",
        layers: prev.layers.map(item => item.id === layerId
          ? clearBackgroundLayerImage(item)
          : item),
      }));
      setSelectedLayerId(layerId);
      setSelectedInteractionZoneLayerId(null);
      setSceneContextMenu(null);
      setNotice(hadBackgroundImage ? "Deleted background image. Scene now uses the default black background." : "Background is already empty.");
      return;
    }
    if (layer.locked) {
      setNotice("Unlock the layer before deleting it.");
      setSceneContextMenu(null);
      return;
    }
    if (target === "interaction-zone") {
      setScene(prev => ({
        ...prev,
        layers: prev.layers.map(item => item.id === layerId
          ? disableLayerInteraction(item)
          : item),
      }));
      setSelectedInteractionZoneLayerId(null);
      setSceneContextMenu(null);
      setNotice(`Deleted interaction zone: ${layer.name}`);
      return;
    }
    setScene(prev => ({ ...prev, layers: prev.layers.filter(item => item.id !== layerId) }));
    setSelectedLayerId("");
    setSelectedInteractionZoneLayerId(null);
    setSceneContextMenu(null);
    setNotice(`Deleted layer: ${layer.name}`);
  };

  const removeSelectedLayer = () => {
    if (!selectedLayer) return;
    deleteSceneObject(selectedLayer.id, selectedInteractionZoneLayerId === selectedLayer.id ? "interaction-zone" : "layer");
  };

  const restoreSceneFromHistory = (nextScene: GameScene, message: string) => {
    const selectedId = selectedLayerIdRef.current;
    const selectedLayerStillExists = selectedId && nextScene.layers.some(layer => layer.id === selectedId);
    const fallbackLayer = [...nextScene.layers].sort((a, b) => b.zIndex - a.zIndex)[0];

    sceneHistoryNavigationRef.current = true;
    setScene(cloneSceneForHistory(nextScene));
    setSelectedLayerId(selectedLayerStillExists ? selectedId : fallbackLayer?.id || "");
    setSelectedInteractionZoneLayerId(null);
    setSceneContextMenu(null);
    setNotice(message);
  };

  const undoSceneChange = () => {
    const previousScene = sceneHistoryPastRef.current[sceneHistoryPastRef.current.length - 1];
    if (!previousScene) {
      setNotice("Nothing to undo.");
      return;
    }
    sceneHistoryPastRef.current = sceneHistoryPastRef.current.slice(0, -1);
    sceneHistoryFutureRef.current = [
      cloneSceneForHistory(sceneStateRef.current),
      ...sceneHistoryFutureRef.current,
    ].slice(0, SCENE_HISTORY_LIMIT);
    restoreSceneFromHistory(previousScene, "Undo");
  };

  const redoSceneChange = () => {
    const nextScene = sceneHistoryFutureRef.current[0];
    if (!nextScene) {
      setNotice("Nothing to redo.");
      return;
    }
    sceneHistoryFutureRef.current = sceneHistoryFutureRef.current.slice(1);
    sceneHistoryPastRef.current = [
      ...sceneHistoryPastRef.current,
      cloneSceneForHistory(sceneStateRef.current),
    ].slice(-SCENE_HISTORY_LIMIT);
    restoreSceneFromHistory(nextScene, "Redo");
  };

  useEffect(() => {
    const onHistoryKey = (event: KeyboardEvent) => {
      if (tab !== "scene") return;
      if (event.repeat || isEditingTextTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const modifierPressed = event.ctrlKey || event.metaKey;
      const isUndo = modifierPressed && key === "z" && !event.shiftKey;
      const isRedo = modifierPressed && (key === "y" || (key === "z" && event.shiftKey));
      if (!isUndo && !isRedo) return;
      event.preventDefault();
      event.stopPropagation();
      if (isUndo) {
        undoSceneChange();
        return;
      }
      redoSceneChange();
    };

    window.addEventListener("keydown", onHistoryKey, true);
    return () => window.removeEventListener("keydown", onHistoryKey, true);
  }, [tab]);

  useEffect(() => {
    const onClipboardKey = (event: KeyboardEvent) => {
      if (tab !== "scene") return;
      if (event.repeat || isEditingTextTarget(event.target)) return;
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (!["c", "x", "v", "d"].includes(key)) return;

      event.preventDefault();
      event.stopPropagation();
      if (key === "c") {
        copyLayerToSceneClipboard();
        return;
      }
      if (key === "x") {
        cutLayerToSceneClipboard();
        return;
      }
      if (key === "v") {
        pasteLayerFromSceneClipboard();
        return;
      }
      duplicateSceneLayer();
    };

    window.addEventListener("keydown", onClipboardKey, true);
    return () => window.removeEventListener("keydown", onClipboardKey, true);
  }, [sceneClipboard, tab]);

  useEffect(() => {
    const onDeleteKey = (event: KeyboardEvent) => {
      if (tab !== "scene") return;
      if (event.repeat || (event.key !== "Backspace" && event.key !== "Delete")) return;
      if (isEditingTextTarget(event.target)) return;
      if (!selectedLayerId) return;
      event.preventDefault();
      event.stopPropagation();
      deleteSceneObject(selectedLayerId, selectedInteractionZoneLayerId === selectedLayerId ? "interaction-zone" : "layer");
    };
    window.addEventListener("keydown", onDeleteKey, true);
    return () => window.removeEventListener("keydown", onDeleteKey, true);
  }, [selectedInteractionZoneLayerId, selectedLayerId, tab]);

  const persistScene = async (sceneToSave: GameScene, successMessage: string) => {
    setError(null);
    try {
      const nextScene = {
        ...prepareSceneForEditor(sceneToSave),
        savedTime: sceneToSave.savedTime || new Date().toISOString(),
        updatedTime: new Date().toISOString(),
      };
      const data = await saveGameScene(nextScene);
      const savedScene = data.scene || nextScene;
      setScenes(data.library.scenes.map(prepareSceneForEditor));
      setScene(prepareSceneForEditor(savedScene));
      setSelectedLayerId("");
      setTab("scenes");
      setNotice(successMessage.replace("{name}", savedScene.name));
    } catch (err: any) {
      setError(err.message || "Failed to save scene");
    }
  };

  const saveScene = async () => {
    await persistScene(scene, "Scene updated: {name}");
  };

  const saveCompletedScene = async () => {
    const now = new Date();
    const completedScene: GameScene = {
      ...prepareSceneForEditor(scene),
      id: `scene_completed_${Date.now()}`,
      name: `${scene.name || "Scene"} - Complete ${sceneTimestampLabel(now)}`,
      savedTime: now.toISOString(),
      updatedTime: now.toISOString(),
    };
    await persistScene(completedScene, "Completed scene saved: {name}");
  };

  const deleteScene = async (sceneId: string) => {
    setError(null);
    try {
      const data = await deleteGameScene(sceneId);
      const nextScenes = Array.isArray(data.library.scenes)
        ? data.library.scenes.map(prepareSceneForEditor)
        : [];
      setScenes(nextScenes);
      if (scene.id === sceneId) {
        const fallbackScene = nextScenes[0] || prepareSceneForEditor(createDefaultScene());
        setScene(fallbackScene);
        setSelectedLayerId("");
      }
      setIsBackpackOpen(false);
      setVehiclePhase("approaching");
      setTab("scenes");
      setNotice("Scene deleted.");
    } catch (err: any) {
      setError(err.message || "Failed to delete scene");
    }
  };

  const uniqueCopiedSceneName = (sourceName: string) => {
    const baseName = `${sourceName || "Scene"} Copy`;
    const usedNames = new Set([scene.name, ...scenes.map(savedScene => savedScene.name)].filter(Boolean));
    if (!usedNames.has(baseName)) return baseName;
    let copyIndex = 2;
    while (usedNames.has(`${baseName} ${copyIndex}`)) copyIndex += 1;
    return `${baseName} ${copyIndex}`;
  };

  const saveSceneCopy = async (sourceScene: GameScene, successPrefix: string) => {
    setError(null);
    try {
      const now = new Date().toISOString();
      const cleanSource = prepareSceneForEditor(sourceScene);
      const sceneCopy: GameScene = {
        ...cloneSceneForHistory(cleanSource),
        id: `scene_copy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: uniqueCopiedSceneName(cleanSource.name),
        savedTime: now,
        updatedTime: now,
      };
      const data = await saveGameScene(sceneCopy, "Failed to save scene copy");
      const savedScene = data.scene || sceneCopy;
      setScenes(data.library.scenes.map(prepareSceneForEditor));
      setTab("scenes");
      setNotice(`${successPrefix}: ${savedScene.name}`);
    } catch (err: any) {
      setError(err.message || "Failed to save scene copy");
    }
  };

  const duplicateSceneNode = async (node: SceneFlowNode) => {
    if (!node.scene || node.isPlaceholder) {
      setNotice("Select a scene to duplicate.");
      return;
    }
    await saveSceneCopy(node.scene, "Scene duplicated");
  };

  const pasteSceneNode = async (sourceScene: GameScene) => {
    await saveSceneCopy(sourceScene, "Scene pasted");
  };

  const deleteSceneNode = async (node: SceneFlowNode) => {
    if (!node.scene || node.isPlaceholder) {
      setNotice("Select a scene to delete.");
      return;
    }
    const isSavedScene = scenes.some(savedScene => savedScene.id === node.scene?.id);
    if (!isSavedScene) {
      if (node.isCurrent) {
        const fallbackScene = scenes[0] || prepareSceneForEditor(createDefaultScene());
        setScene(fallbackScene);
        setSelectedLayerId("");
        setTab("scenes");
        setNotice("Current draft scene cleared.");
        return;
      }
      setNotice("This scene has not been saved yet.");
      return;
    }
    await deleteScene(node.scene.id);
  };

  const startNewScene = () => {
    const now = new Date();
    const base = prepareSceneForEditor(createDefaultScene());
    const playerLayers = scene.layers
      .filter(layer => {
        if (!layer.assetId || !isSceneVisualLayer(layer)) return false;
        return assetById.get(layer.assetId)?.role === "player";
      })
      .map((layer, index) => ({
        ...layer,
        id: `layer_player_scene_${Date.now()}_${index}`,
        name: layer.name || "Player",
        x: 420 + index * 36,
        y: base.groundY + 2,
        zIndex: Math.max(layer.zIndex, 30),
        opacity: 1,
        parallax: 1,
        visible: true,
      }));
    const nextScene: GameScene = {
      ...base,
      id: `scene_draft_${Date.now()}`,
      name: `New Scene ${scenes.length + 1}`,
      cameraX: 0,
      savedTime: now.toISOString(),
      updatedTime: now.toISOString(),
      layers: [...base.layers, ...playerLayers],
    };
    setScene(nextScene);
    setSelectedLayerId(playerLayers[0]?.id || "");
    setIsBackpackOpen(false);
    setVehiclePhase("approaching");
    setTab("scene");
    setNotice(playerLayers.length ? "New scene created with the current player copied in." : "New empty scene created.");
  };

  const loadSavedScene = (savedScene: GameScene) => {
    const cleanScene = prepareSceneForEditor(savedScene);
    setScene(cleanScene);
    setSelectedLayerId("");
    setIsBackpackOpen(false);
    setVehiclePhase("approaching");
    setTab("scene");
    setNotice(`Loaded scene: ${cleanScene.name}`);
  };

  const compileSheet = async () => {
    const url = await compileSpritesheetImage(activeSprite, sheetColumns);
    if (!url) return null;
    setSheetDataUrl(url);
    return url;
  };

  const openGameMode = () => {
    setAppMode("game");
    setTab("scenes");
  };

  const openSheetOnlyMode = () => {
    setAppMode("sheet-only");
    setTab("sheet");
    setIsPlaying(false);
    setSheetOnlyHasSelection(false);
    setSheetOnlySelectionKind(null);
    setSheetOnlySelectionTitle("");
  };

  const returnToModePicker = () => {
    setIsPlaying(false);
    setAppMode("home");
  };

  useEffect(() => {
    if (appMode !== "sheet-only" || !sheetOnlyHasSelection || sheetOnlySelectionKind !== "sprite") return;
    if (activeSprite.spritesheetPng) {
      setSheetDataUrl(activeSprite.spritesheetPng);
      return;
    }
    setSheetDataUrl(null);
    void compileSheet().catch((err: any) => setError(err.message || "Failed to generate spritesheet preview"));
  }, [appMode, activeSprite.id, activeSprite.spritesheetPng, sheetOnlyHasSelection, sheetOnlySelectionKind]);

  const downloadSheet = async () => {
    try {
      const url = activeSprite.spritesheetPng || sheetDataUrl || await compileSheet();
      if (url) {
        const filename = `spritesheet_${safeName(activeSprite.characterName)}_${activeSprite.frames.length}f.png`;
        if (activeSprite.spritesheetPng && url === activeSprite.spritesheetPng) downloadUrl(url, filename);
        else downloadDataUrl(url, filename);
      }
    } catch (err: any) {
      setError(err.message || "Failed to export spritesheet");
    }
  };

  const downloadSelectedSceneItem = () => {
    if (!selectedLayer) {
      setNotice("Select an item first.");
      return;
    }

    if (selectedLayer.type === "background" && selectedLayer.imageUrl) {
      downloadUrl(selectedLayer.imageUrl, `item_${safeName(selectedLayer.name)}.png`);
      return;
    }

    const asset = selectedLayer.assetId ? assetById.get(selectedLayer.assetId) : undefined;
    const sprite = resolveAssetSprite(asset, selectedLayer);
    if (!asset || !sprite) {
      downloadJson(selectedLayer, `item_${safeName(selectedLayer.name)}.json`);
      return;
    }

    const pngUrl = sprite.spritesheetPng || sprite.rawSpritesheetPng;
    if (pngUrl) {
      downloadUrl(pngUrl, `item_${safeName(selectedLayer.name)}_spritesheet.png`);
      return;
    }

    const frameSvg = spriteFrame(sprite, activeFrame);
    downloadDataUrl(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(frameSvg)}`,
      `item_${safeName(selectedLayer.name)}_frame.svg`
    );
  };

  const triggerMouseAction = () => {
    const matched = assets
      .map(asset => {
        const clip = asset.animations?.find(item => item.binding?.triggerType === "mouse");
        if (clip) return { asset, clip };
        return asset.binding.triggerType === "mouse" ? { asset, clip: undefined } : null;
      })
      .find(Boolean);
    if (!matched) {
      setNotice("No mouse-triggered action is bound yet.");
      return;
    }
    if (matched.clip) {
      setScene(prev => ({
        ...prev,
        layers: prev.layers.map(layer => layer.assetId === matched.asset.id ? { ...layer, activeAnimationId: matched.clip!.id } : layer),
      }));
    }
    setActiveSprite(matched.clip?.sprite || resolveAssetSprite(matched.asset) || matched.asset.sprite);
    setActiveFrame(0);
    setIsPlaying(true);
    setNotice(`Mouse triggered action: ${matched.clip?.name || matched.asset.binding.actionName}`);
  };

  const clearSceneSelection = () => {
    dragRef.current = null;
    resizeRef.current = null;
    zoneDragRef.current = null;
    zoneResizeRef.current = null;
    setSelectedLayerId("");
    setSelectedInteractionZoneLayerId(null);
    setIsPlaying(false);
  };

  const stagePointerDown = (event: PointerEvent<HTMLDivElement>, layer: SceneLayer) => {
    if (layer.locked) return;
    event.stopPropagation();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const parallax = layer.parallax ?? 1;
    const pointerX = (event.clientX - rect.left) / stageScaleX + scene.cameraX * parallax;
    const pointerY = (event.clientY - rect.top) / stageScaleY;
    dragRef.current = { id: layer.id, dx: pointerX - layer.x, dy: pointerY - layer.y };
    resizeRef.current = null;
    setSelectedLayerId(layer.id);
    setSelectedInteractionZoneLayerId(null);
  };

  const startLayerResize = (
    event: PointerEvent<HTMLSpanElement>,
    layer: SceneLayer,
    assetWidth: number,
    assetHeight: number,
    handle: ResizeHandle
  ) => {
    if (layer.locked) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = null;
    const parallax = layer.parallax ?? 1;
    const left = (layer.x - scene.cameraX * parallax) * stageScaleX;
    const width = assetWidth * layer.scale * spriteStageScale;
    const height = assetHeight * layer.scale * spriteStageScale;
    const bottom = layer.y * stageScaleY;
    const top = bottom - height;
    const right = left + width;
    const anchorScreenX = handle === "nw" || handle === "sw" ? right : left;
    const anchorScreenY = handle === "nw" || handle === "ne" ? bottom : top;
    resizeRef.current = {
      id: layer.id,
      handle,
      anchorScreenX,
      anchorScreenY,
      assetWidth,
      assetHeight,
    };
    setSelectedLayerId(layer.id);
    setSelectedInteractionZoneLayerId(null);
  };

  const startInteractionZoneDrag = (event: PointerEvent<HTMLDivElement>, layer: SceneLayer, interaction: LayerInteractionSettings) => {
    if (layer.locked) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const parallax = layer.parallax ?? 1;
    const pointerX = (event.clientX - rect.left) / stageScaleX + scene.cameraX * parallax;
    const pointerY = (event.clientY - rect.top) / stageScaleY;
    dragRef.current = null;
    resizeRef.current = null;
    zoneResizeRef.current = null;
    zoneDragRef.current = {
      id: layer.id,
      startPointerX: pointerX,
      startPointerY: pointerY,
      startOffsetX: interaction.zoneOffsetX || 0,
      startOffsetY: interaction.zoneOffsetY || 0,
    };
    setSelectedLayerId(layer.id);
    setSelectedInteractionZoneLayerId(layer.id);
  };

  const startInteractionZoneResize = (
    event: PointerEvent<HTMLElement>,
    layer: SceneLayer,
    asset: GameAsset,
    interaction: LayerInteractionSettings,
    handle: ResizeHandle
  ) => {
    if (layer.locked) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const zone = interactionZoneBounds(layer, asset, interaction);
    dragRef.current = null;
    resizeRef.current = null;
    zoneDragRef.current = null;
    zoneResizeRef.current = {
      id: layer.id,
      handle,
      anchorWorldX: handle === "nw" || handle === "sw" ? zone.right : zone.left,
      anchorWorldY: handle === "nw" || handle === "ne" ? zone.bottom : zone.top,
    };
    setSelectedLayerId(layer.id);
    setSelectedInteractionZoneLayerId(layer.id);
  };

  const stagePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const zoneResize = zoneResizeRef.current;
    if (zoneResize) {
      const layerSnapshot = sceneStateRef.current.layers.find(layer => layer.id === zoneResize.id);
      const parallax = layerSnapshot?.parallax ?? 1;
      const pointerWorldX = (event.clientX - rect.left) / stageScaleX + scene.cameraX * parallax;
      const pointerWorldY = (event.clientY - rect.top) / stageScaleY;
      setScene(prev => {
        const layer = prev.layers.find(item => item.id === zoneResize.id);
        const asset = layer?.assetId ? assetById.get(layer.assetId) : undefined;
        if (!layer || !asset) return prev;
        const base = layerInteractionSettings(layer, asset) || DEFAULT_INTERACTION_SETTINGS;
        const width = Math.max(24, Math.abs(pointerWorldX - zoneResize.anchorWorldX));
        const height = Math.max(24, Math.abs(pointerWorldY - zoneResize.anchorWorldY));
        const centerX = (pointerWorldX + zoneResize.anchorWorldX) / 2;
        const centerY = (pointerWorldY + zoneResize.anchorWorldY) / 2;
        const layerBounds = layerWorldBounds(layer, asset);
        const interaction = {
          ...base,
          ...layer.interaction,
          zoneWidth: Math.round(width),
          zoneHeight: Math.round(height),
          zoneOffsetX: Math.round(centerX - layerBounds.centerX),
          zoneOffsetY: Math.round(centerY - layerBounds.centerY),
        };
        return {
          ...prev,
          layers: prev.layers.map(item => item.id === layer.id ? { ...item, interaction } : item),
        };
      });
      return;
    }

    const zoneDrag = zoneDragRef.current;
    if (zoneDrag) {
      const layerSnapshot = sceneStateRef.current.layers.find(layer => layer.id === zoneDrag.id);
      const parallax = layerSnapshot?.parallax ?? 1;
      const pointerWorldX = (event.clientX - rect.left) / stageScaleX + scene.cameraX * parallax;
      const pointerWorldY = (event.clientY - rect.top) / stageScaleY;
      const nextOffsetX = Math.round(zoneDrag.startOffsetX + pointerWorldX - zoneDrag.startPointerX);
      const nextOffsetY = Math.round(zoneDrag.startOffsetY + pointerWorldY - zoneDrag.startPointerY);
      setScene(prev => ({
        ...prev,
        layers: prev.layers.map(layer => {
          if (layer.id !== zoneDrag.id) return layer;
          const asset = layer.assetId ? assetById.get(layer.assetId) : undefined;
          const base = layerInteractionSettings(layer, asset) || DEFAULT_INTERACTION_SETTINGS;
          return {
            ...layer,
            interaction: { ...base, ...layer.interaction, zoneOffsetX: nextOffsetX, zoneOffsetY: nextOffsetY },
          };
        }),
      }));
      return;
    }

    const resize = resizeRef.current;
    if (resize) {
      const pointerScreenX = event.clientX - rect.left;
      const pointerScreenY = event.clientY - rect.top;
      const widthScreen = resize.handle === "nw" || resize.handle === "sw"
        ? resize.anchorScreenX - pointerScreenX
        : pointerScreenX - resize.anchorScreenX;
      const heightScreen = resize.handle === "nw" || resize.handle === "ne"
        ? resize.anchorScreenY - pointerScreenY
        : pointerScreenY - resize.anchorScreenY;
      const scaleFromWidth = widthScreen / Math.max(1, resize.assetWidth * spriteStageScale);
      const scaleFromHeight = heightScreen / Math.max(1, resize.assetHeight * spriteStageScale);
      const nextScale = clampLayerScale(Math.max(scaleFromWidth, scaleFromHeight));
      const scaledWidth = resize.assetWidth * nextScale * spriteStageScale;
      const scaledHeight = resize.assetHeight * nextScale * spriteStageScale;
      const layerSnapshot = sceneStateRef.current.layers.find(layer => layer.id === resize.id);
      const parallax = layerSnapshot?.parallax ?? 1;
      const x = resize.handle === "nw" || resize.handle === "sw"
        ? (resize.anchorScreenX - scaledWidth) / stageScaleX + scene.cameraX * parallax
        : resize.anchorScreenX / stageScaleX + scene.cameraX * parallax;
      const y = resize.handle === "nw" || resize.handle === "ne"
        ? resize.anchorScreenY / stageScaleY
        : (resize.anchorScreenY + scaledHeight) / stageScaleY;
      updateSceneLayer(resize.id, {
        x: Math.round(x),
        y: Math.round(y),
        scale: Number(nextScale.toFixed(3)),
      });
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const layerSnapshot = sceneStateRef.current.layers.find(layer => layer.id === drag.id);
    const parallax = layerSnapshot?.parallax ?? 1;
    updateSceneLayer(drag.id, {
      x: Math.round((event.clientX - rect.left) / stageScaleX + scene.cameraX * parallax - drag.dx),
      y: Math.round((event.clientY - rect.top) / stageScaleY - drag.dy),
    });
  };

  const applyNeonLightingToSelectedLayer = () => {
    if (!selectedLayer || selectedLayer.locked || !isSceneVisualLayer(selectedLayer)) return;
    updateSceneLayer(selectedLayer.id, {
      shadow: { ...NEON_CONTACT_SHADOW },
      lighting: { ...NEON_LAYER_LIGHTING },
    });
    setNotice("Applied neon station lighting to the selected layer.");
  };

  const clearLightingFromSelectedLayer = () => {
    if (!selectedLayer || selectedLayer.locked || !isSceneVisualLayer(selectedLayer)) return;
    updateSceneLayer(selectedLayer.id, {
      shadow: { ...NEON_CONTACT_SHADOW, enabled: false },
      lighting: { ...NEON_LAYER_LIGHTING, preset: "none" as const },
    });
    setNotice("Disabled simulated lighting on the selected layer.");
  };

  const bgClass = bgMode === "checker" ? "preview-bg checker" : `preview-bg ${bgMode}`;

  if (appMode === "home") {
    return <ModePicker onOpenGame={openGameMode} onOpenSheetOnly={openSheetOnlyMode} />;
  }

  if (appMode === "sheet-only") {
    return (
      <SheetOnlyGallery
        activeSpriteName={activeSprite.characterName}
        checkerStyle={checkerStyle}
        entries={sheetOnlyEntries}
        hasSelection={sheetOnlyHasSelection}
        selectionTitle={sheetOnlySelectionTitle}
        sheetDataUrl={sheetDataUrl}
        onBack={returnToModePicker}
        onGeneratePreview={() => void compileSheet()}
        onSelectImage={selectSheetOnlyImage}
        onSelectSprite={selectSheetOnlySprite}
        onShowAll={() => {
          setSheetOnlyHasSelection(false);
          setSheetOnlySelectionKind(null);
        }}
      />
    );
  }

  return (
    <div className={`blueprint-app ${tab === "scenes" || tab === "scene" ? "core-mode" : ""}`}>
      <WorkspaceTopbar
        isPlaying={isPlaying}
        onBack={returnToModePicker}
        onDownloadSheet={downloadSheet}
        onOpenScenes={() => setTab("scenes")}
        onSaveAsset={saveAsset}
        onSaveComplete={saveCompletedScene}
        onSaveScene={saveScene}
        onStartNewScene={startNewScene}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
      />

      <main className={`game-workspace ${tab === "scenes" || tab === "scene" ? "simple-workspace" : ""}`}>
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
              title={tab === "scenes" ? "Scene Library" : tab === "spritesheets" ? "Scene Spritesheets" : scene.name}
              viewportHeight={viewportHeight}
              viewportPreset={scene.viewportPreset}
              viewportPresets={VIEWPORT_PRESETS}
              viewportWidth={viewportWidth}
              onOpenSheet={async () => {
                setTab("sheet");
                if (!activeSprite.spritesheetPng && !sheetDataUrl) await compileSheet();
              }}
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
                onCreateScene={() => {
                  startNewScene();
                  setTab("scene");
                }}
                onDeleteScene={deleteSceneNode}
                onDuplicateScene={duplicateSceneNode}
                onOpenScene={node => {
                  if (node.isPlaceholder) {
                    startNewScene();
                    setTab("scene");
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
                    controls={(
                      <SceneGlobalControls
                        ref={sceneGlobalControlsRef}
                        cameraMax={cameraMax}
                        cameraX={scene.cameraX}
                        lighting={sceneLight}
                        onCameraXChange={value => setScene(prev => ({ ...prev, cameraX: value }))}
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
                    onPointerEnd={() => {
                      dragRef.current = null;
                      resizeRef.current = null;
                      zoneDragRef.current = null;
                      zoneResizeRef.current = null;
                    }}
                    onPointerMove={stagePointerMove}
                  >
                  {backgroundLayer?.visible && (
                    <SceneBackgroundLayer
                      backgroundLayer={backgroundLayer}
                      filter={sceneFilter(scene)}
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
                    lighting={sceneLight}
                    showLightingOverlay={Boolean(backgroundLayer?.visible && sceneLight.preset !== "none")}
                    stageScaleY={stageScaleY}
                  />
                  <SceneVisualLayerStack
                    activeFrame={activeFrame}
                    assetById={assetById}
                    contactShadow={NEON_CONTACT_SHADOW}
                    layers={scene.layers}
                    sceneCameraX={scene.cameraX}
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
                    interactionToast={interactionToast}
                    isBackpackOpen={isBackpackOpen}
                    nearbyInteraction={nearbyInteraction}
                    sceneCameraX={scene.cameraX}
                    spriteStageScale={spriteStageScale}
                    stageScaleX={stageScaleX}
                    stageScaleY={stageScaleY}
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
                  cameraX={scene.cameraX}
                  hasUnlockedVisualLayer={Boolean(selectedLayer && isSceneVisualLayer(selectedLayer) && !selectedLayer.locked)}
                  layerLighting={selectedLayerLight}
                  layerShadow={selectedLayerShadow}
                  sceneLighting={sceneLight}
                  onCameraXChange={value => setScene(prev => ({ ...prev, cameraX: value }))}
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
            cameraX={scene.cameraX}
            lighting={sceneLight}
            onApplyNeonStation={() => updateSceneLighting({ ...NEON_SCENE_LIGHTING })}
            onCameraXChange={value => setScene(prev => ({ ...prev, cameraX: value }))}
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
  );
}
