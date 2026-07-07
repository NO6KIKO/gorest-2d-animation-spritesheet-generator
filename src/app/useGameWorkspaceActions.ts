import { useEffect, type ChangeEvent, type Dispatch, type MouseEvent, type MutableRefObject, type PointerEvent, type SetStateAction } from "react";
import { isEditingTextTarget } from "./domEvents";
import { downloadDataUrl, downloadJson, downloadUrl } from "./downloads";
import { loadImageSize, readFileAsDataUrl } from "./fileInput";
import type { AppMode, SheetOnlySelectionKind, WorkspaceTab } from "./types";
import { INTERACTION_PRESETS } from "./workspaceConfig";
import {
  DEFAULT_BINDING as defaultBinding,
  createAsset,
  defaultGameStateForTrigger,
  defaultTriggerValueForType,
  safeName,
  splitTags,
} from "../domain/assets/assetModel";
import { createImportedSpritesheetAsset, createUploadedStaticObjectAsset } from "../domain/assets/assetImportFactory";
import {
  applyAssetClipMetadataPatch,
  deleteFrameFromSprite,
  rebuildSpritesheetGridSprite,
  replaceSpriteInAsset,
  type SpriteGridPatch,
} from "../domain/assets/assetSpriteOperations";
import {
  BOARDING_TRAIN_ASSET_ID,
  INSPECT_TRIGGER_ASSET_ID,
  SCENE_KIT_ASSETS,
} from "../domain/scene-kit/sceneKitAssets";
import {
  DEFAULT_INTERACTION_SETTINGS,
  NEON_CONTACT_SHADOW,
  NEON_LAYER_LIGHTING,
  NEON_SCENE_LIGHTING,
  isSceneVisualLayer,
  layerInteractionSettings,
  layerWorldBounds,
  resolveAssetSprite,
  sceneViewportHeight,
  sceneViewportWidth,
} from "../domain/scene/sceneModel";
import { createInteractionTriggerLayer, createSceneKitLayer, ensureSceneKitLayers } from "../domain/scene/sceneFactory";
import { resizeSceneFrame, type SceneFramePatch } from "../domain/scene/sceneFrame";
import {
  clearBackgroundLayerImage,
  disableLayerInteraction,
  reorderSceneLayerStack,
  type SceneObjectTarget,
} from "../domain/scene/sceneLayerOperations";
import { getFrameSize, spriteFrame } from "../domain/sprites/spriteUtils";
import { compileSpritesheetImage } from "../domain/sprites/spriteCanvas";
import { deleteGameAsset, saveGameAsset } from "../services/gameLibraryApi";
import { saveGeneratedImage, type RepositoryGeneratedImage } from "../services/generatedAssetsApi";
import { clamp, clampLayerScale } from "../shared/math";
import type { SceneVehiclePhase } from "../features/scene-flow";
import type { SceneSpritesheetEntry } from "../features/scene-spritesheets";
import type { SheetOnlyRecolorSaveRequest } from "../features/sheet-only-gallery";
import type {
  ActionBinding,
  ActionTriggerType,
  AnimationClip,
  AnimationSprite,
  AssetRole,
  GameAsset,
  GameScene,
  InteractionPreset,
  LayerInteractionSettings,
  SceneLayer,
} from "../types";

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

type UseGameWorkspaceActionsOptions = {
  activeFrame: number;
  activeSprite: AnimationSprite;
  appMode: AppMode;
  assetById: Map<string, GameAsset>;
  assets: GameAsset[];
  binding: ActionBinding;
  cameraMax: number;
  cameraMaxY: number;
  fps: number;
  importActionName: string;
  importAssetName: string;
  importColumns: number;
  importFileName: string;
  importFrameCount: number;
  importFrameHeight: number;
  importFrameWidth: number;
  importGameState: string;
  importLoop: boolean;
  importRole: AssetRole;
  importSheetDataUrl: string | null;
  importSheetSize: [number, number] | null;
  importTagsText: string;
  importTriggerType: ActionTriggerType;
  importTriggerValue: string;
  layerDragRef: MutableRefObject<string | null>;
  role: AssetRole;
  scene: GameScene;
  scenePanelResizeRef: MutableRefObject<ScenePanelResizeState | null>;
  scenePanelWidths: { layers: number; inspector: number };
  sceneStateRef: MutableRefObject<GameScene>;
  scenes: GameScene[];
  selectedAssetEditable: boolean;
  selectedInteractionZoneLayerId: string | null;
  selectedLayerId: string;
  selectedLayer: SceneLayer | undefined;
  selectedLayerAsset: GameAsset | undefined;
  selectedLayerClip: AnimationClip | undefined;
  selectedLayerFrameSize: number[];
  selectedLayerSprite: AnimationSprite | undefined;
  selectedLayerSpriteColumns: number;
  selectedLayerSpriteEditableGrid: boolean;
  selectedLayerSpriteFrameCount: number;
  selectedLayerSpriteSheetSize: number[];
  selectedLayerSpriteSource: string;
  sheetColumns: number;
  sheetDataUrl: string | null;
  sheetOnlyHasSelection: boolean;
  sheetOnlySelectedAssetId: string | null;
  sheetOnlySelectionKind: SheetOnlySelectionKind;
  tab: WorkspaceTab;
  tagsText: string;
  updateSceneLayer: (layerId: string, patch: Partial<SceneLayer>) => void;
  setActiveFrame: Dispatch<SetStateAction<number>>;
  setActiveSprite: Dispatch<SetStateAction<AnimationSprite>>;
  setAppMode: Dispatch<SetStateAction<AppMode>>;
  setAssets: Dispatch<SetStateAction<GameAsset[]>>;
  setBinding: Dispatch<SetStateAction<ActionBinding>>;
  setDraggedLayerId: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setExpandedSpritesheetKey: Dispatch<SetStateAction<string | null>>;
  setFps: Dispatch<SetStateAction<number>>;
  setImportActionName: Dispatch<SetStateAction<string>>;
  setImportAssetName: Dispatch<SetStateAction<string>>;
  setImportColumns: Dispatch<SetStateAction<number>>;
  setImportFileName: Dispatch<SetStateAction<string>>;
  setImportFrameCount: Dispatch<SetStateAction<number>>;
  setImportFrameHeight: Dispatch<SetStateAction<number>>;
  setImportFrameWidth: Dispatch<SetStateAction<number>>;
  setImportGameState: Dispatch<SetStateAction<string>>;
  setImportLoop: Dispatch<SetStateAction<boolean>>;
  setImportRole: Dispatch<SetStateAction<AssetRole>>;
  setImportSheetDataUrl: Dispatch<SetStateAction<string | null>>;
  setImportSheetSize: Dispatch<SetStateAction<[number, number] | null>>;
  setImportTagsText: Dispatch<SetStateAction<string>>;
  setImportTriggerType: Dispatch<SetStateAction<ActionTriggerType>>;
  setImportTriggerValue: Dispatch<SetStateAction<string>>;
  setIsBackpackOpen: Dispatch<SetStateAction<boolean>>;
  setIsLayerLibraryOpen: Dispatch<SetStateAction<boolean>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setIsSavingRecolorVariant: Dispatch<SetStateAction<boolean>>;
  setLayerDropTargetId: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setRepositoryImages: Dispatch<SetStateAction<RepositoryGeneratedImage[]>>;
  setRole: Dispatch<SetStateAction<AssetRole>>;
  setScene: Dispatch<SetStateAction<GameScene>>;
  setSceneContextMenu: Dispatch<SetStateAction<SceneContextMenuState | null>>;
  setScenes: Dispatch<SetStateAction<GameScene[]>>;
  setSelectedInteractionZoneLayerId: Dispatch<SetStateAction<string | null>>;
  setSelectedLayerId: Dispatch<SetStateAction<string>>;
  setSheetColumns: Dispatch<SetStateAction<number>>;
  setSheetDataUrl: Dispatch<SetStateAction<string | null>>;
  setSheetOnlyHasSelection: Dispatch<SetStateAction<boolean>>;
  setSheetOnlySelectedAssetId: Dispatch<SetStateAction<string | null>>;
  setSheetOnlySelectionKind: Dispatch<SetStateAction<SheetOnlySelectionKind>>;
  setSheetOnlySelectionTitle: Dispatch<SetStateAction<string>>;
  setSprites: Dispatch<SetStateAction<AnimationSprite[]>>;
  setTab: Dispatch<SetStateAction<WorkspaceTab>>;
  setTagsText: Dispatch<SetStateAction<string>>;
  setVehiclePhase: Dispatch<SetStateAction<SceneVehiclePhase>>;
};

export function useGameWorkspaceActions({
  activeFrame,
  activeSprite,
  appMode,
  assetById,
  assets,
  binding,
  cameraMax,
  cameraMaxY,
  fps,
  importActionName,
  importAssetName,
  importColumns,
  importFileName,
  importFrameCount,
  importFrameHeight,
  importFrameWidth,
  importGameState,
  importLoop,
  importRole,
  importSheetDataUrl,
  importSheetSize,
  importTagsText,
  importTriggerType,
  importTriggerValue,
  layerDragRef,
  role,
  scene,
  scenePanelResizeRef,
  scenePanelWidths,
  sceneStateRef,
  scenes,
  selectedAssetEditable,
  selectedInteractionZoneLayerId,
  selectedLayerId,
  selectedLayer,
  selectedLayerAsset,
  selectedLayerClip,
  selectedLayerFrameSize,
  selectedLayerSprite,
  selectedLayerSpriteColumns,
  selectedLayerSpriteEditableGrid,
  selectedLayerSpriteFrameCount,
  selectedLayerSpriteSheetSize,
  selectedLayerSpriteSource,
  sheetColumns,
  sheetDataUrl,
  sheetOnlyHasSelection,
  sheetOnlySelectedAssetId,
  sheetOnlySelectionKind,
  tab,
  tagsText,
  updateSceneLayer,
  setActiveFrame,
  setActiveSprite,
  setAppMode,
  setAssets,
  setBinding,
  setDraggedLayerId,
  setError,
  setExpandedSpritesheetKey,
  setFps,
  setImportActionName,
  setImportAssetName,
  setImportColumns,
  setImportFileName,
  setImportFrameCount,
  setImportFrameHeight,
  setImportFrameWidth,
  setImportGameState,
  setImportLoop,
  setImportRole,
  setImportSheetDataUrl,
  setImportSheetSize,
  setImportTagsText,
  setImportTriggerType,
  setImportTriggerValue,
  setIsBackpackOpen,
  setIsLayerLibraryOpen,
  setIsPlaying,
  setIsSavingRecolorVariant,
  setLayerDropTargetId,
  setNotice,
  setRepositoryImages,
  setRole,
  setScene,
  setSceneContextMenu,
  setScenes,
  setSelectedInteractionZoneLayerId,
  setSelectedLayerId,
  setSheetColumns,
  setSheetDataUrl,
  setSheetOnlyHasSelection,
  setSheetOnlySelectedAssetId,
  setSheetOnlySelectionKind,
  setSheetOnlySelectionTitle,
  setSprites,
  setTab,
  setTagsText,
  setVehiclePhase,
}: UseGameWorkspaceActionsOptions) {
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
      if (asset.id !== assetId) return asset;
      return applyAssetClipMetadataPatch(asset, clipId, patch, bindingPatch);
    }));
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

  const rebuildSelectedSpritesheetGrid = (patch: SpriteGridPatch) => {
    if (!selectedLayerAsset || !selectedLayerSprite) return;
    if (!selectedLayerSpriteEditableGrid) {
      setNotice("Only imported spritesheet images can rebuild their frame grid here.");
      return;
    }
    const rebuiltGrid = rebuildSpritesheetGridSprite({
      sprite: selectedLayerSprite,
      source: selectedLayerSpriteSource,
      sheetSize: selectedLayerSpriteSheetSize as [number, number],
      currentFrameSize: selectedLayerFrameSize as [number, number],
      currentFrameCount: selectedLayerSpriteFrameCount,
      currentColumns: selectedLayerSpriteColumns,
      patch,
    });
    if (!rebuiltGrid) {
      setNotice("Frame grid is larger than the spritesheet image. Reduce frame size, frame count, or columns.");
      return;
    }

    setAssets(prev => prev.map(asset => (
      asset.id === selectedLayerAsset.id ? replaceSpriteInAsset(asset, selectedLayerSprite.id, rebuiltGrid.sprite) : asset
    )));
    if (activeSprite.id === selectedLayerSprite.id) setActiveSprite(rebuiltGrid.sprite);
    setActiveFrame(prev => Math.min(prev, rebuiltGrid.frameCount - 1));
    setNotice(`Updated spritesheet grid: ${rebuiltGrid.frameCount} frames / ${rebuiltGrid.frameWidth} x ${rebuiltGrid.frameHeight}.`);
  };

  const deleteSheetOnlySpriteFrame = async (frameIndex: number) => {
    if (sheetOnlySelectionKind !== "sprite") return;
    if (activeSprite.frames.length <= 1) {
      setNotice("A spritesheet needs at least one frame.");
      return;
    }

    const asset = sheetOnlySelectedAssetId
      ? assets.find(item => item.id === sheetOnlySelectedAssetId)
      : assets.find(item =>
          item.sprite.id === activeSprite.id ||
          item.animations?.some(clip => clip.sprite.id === activeSprite.id)
        );
    if (!asset) {
      setNotice("This preview is not a saved asset, so frames cannot be deleted persistently.");
      return;
    }

    const nextSprite = deleteFrameFromSprite(activeSprite, frameIndex);
    if (!nextSprite) return;
    const nextAsset = replaceSpriteInAsset(asset, activeSprite.id, nextSprite);

    setActiveSprite(nextSprite);
    setActiveFrame(prev => Math.min(prev, nextSprite.frames.length - 1));
    setAssets(prev => prev.map(item => item.id === nextAsset.id ? nextAsset : item));
    setError(null);

    try {
      const data = await saveGameAsset(nextAsset, "Failed to save frame deletion");
      setAssets(data.library.assets);
      setNotice(`Deleted frame ${frameIndex + 1} and saved ${nextAsset.name}.`);
    } catch (err: any) {
      setError(err.message || "Failed to save frame deletion");
    }
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
        zoneWidth: selectedLayer.interaction?.zoneWidth || presetPatch.zoneWidth || Math.round(bounds.width || 160),
        zoneHeight: selectedLayer.interaction?.zoneHeight || presetPatch.zoneHeight || Math.round(bounds.height || 120),
        itemId: preset === "pickup" ? selectedLayer.interaction?.itemId || keyName : selectedLayer.interaction?.itemId,
        setStateKey: preset === "conditional" ? selectedLayer.interaction?.setStateKey || keyName : selectedLayer.interaction?.setStateKey,
        promptKey: presetPatch.triggerMode === "near-key" ? selectedLayer.interaction?.promptKey || "KeyE" : selectedLayer.interaction?.promptKey || base.promptKey,
      },
    });
    setNotice(`Applied interaction preset: ${label}`);
  };

  const updateSceneFrame = (patch: SceneFramePatch) => {
    setScene(prev => resizeSceneFrame(prev, patch));
  };

  const enableFollowCameraView = () => {
    const minScrollRoom = 160;
    if (scene.width <= 360 || scene.width - minScrollRoom < 240) {
      setNotice("Follow camera needs a world wider than the visible camera view.");
      return;
    }
    const viewportWidth = sceneViewportWidth(scene);
    const viewportHeight = sceneViewportHeight(scene);
    const currentRatio = viewportWidth / Math.max(1, viewportHeight);
    const targetViewportWidth = Math.round(clamp(Math.min(scene.width * 0.62, 1280), 240, scene.width - minScrollRoom));
    const targetViewportHeight = Math.round(clamp(targetViewportWidth / currentRatio, 240, scene.height));
    updateSceneFrame({
      viewportWidth: targetViewportWidth,
      viewportHeight: targetViewportHeight,
      viewportPreset: "custom",
    });
    setNotice(`Follow Camera view enabled: ${targetViewportWidth} x ${targetViewportHeight}. Scroll room ${Math.round(scene.width - targetViewportWidth)}px.`);
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
    const layerActionName = asset.binding?.actionName || asset.name;
    const layer: SceneLayer = {
      id: `layer_${safeName(layerActionName)}_${Date.now()}`,
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

  const handleLayerImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file to add as a static object.");
      return;
    }

    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file, "Could not read the uploaded image.");
      const [width, height] = await loadImageSize(dataUrl);
      const { asset, sprite } = createUploadedStaticObjectAsset({
        dataUrl,
        fileName: file.name,
        width,
        height,
      });
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
    setSheetOnlySelectedAssetId(asset?.id || null);
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
    setSheetOnlySelectedAssetId(null);
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

  const insertInteractionZone = (preset: InteractionPreset) => {
    const asset = SCENE_KIT_ASSETS.find(item => item.id === INSPECT_TRIGGER_ASSET_ID);
    if (!asset) return;
    const { label, ...presetPatch } = INTERACTION_PRESETS[preset];
    const playerLayer = scene.layers.find(layer => {
      if (!layer.visible || !layer.assetId || !isSceneVisualLayer(layer)) return false;
      return assetById.get(layer.assetId)?.role === "player";
    });
    const playerBounds = playerLayer ? layerWorldBounds(playerLayer, assetById.get(playerLayer.assetId!)) : null;
    const viewportW = sceneViewportWidth(scene);
    const viewportH = sceneViewportHeight(scene);
    const baseX = playerBounds?.centerX ?? scene.cameraX + viewportW * 0.5;
    const baseY = playerBounds?.centerY ?? (scene.cameraY || 0) + viewportH * 0.5;
    const toolOffsets: Partial<Record<InteractionPreset, { x: number; y: number }>> = {
      "light-zone": { x: 0, y: 0 },
      inspect: { x: -150, y: -20 },
      pickup: { x: -80, y: 76 },
      "scene-link": { x: 180, y: -4 },
      toggle: { x: 88, y: 84 },
      "dialogue-zone": { x: -8, y: 126 },
      "audio-zone": { x: -220, y: 44 },
      "camera-zone": { x: 260, y: 44 },
      "physics-zone": { x: 0, y: 160 },
    };
    const offset = toolOffsets[preset] || { x: 0, y: 0 };
    const anchorX = baseX + offset.x;
    const anchorY = baseY + offset.y;
    const isPlayerLight = preset === "light-zone" && Boolean(playerLayer);
    const cameraTargetX = Math.round(clamp(anchorX - viewportW * 0.5, 0, cameraMax));
    const cameraTargetY = Math.round(clamp(anchorY - viewportH * 0.5, 0, cameraMaxY));
    const layer = createInteractionTriggerLayer(
      scene,
      `layer_reusable_zone_${safeName(preset)}_${Date.now()}`,
      isPlayerLight ? "Light Zone / Player Halo" : label,
      Math.round(anchorX - 22),
      Math.round(anchorY + 22),
      presetPatch.promptText || label.replace(" Zone", ""),
      {
        ...presetPatch,
        enabled: true,
        hotspotVisible: false,
        zoneWidth: preset === "light-zone" ? 320 : presetPatch.zoneWidth,
        zoneHeight: preset === "light-zone" ? 250 : presetPatch.zoneHeight,
        zoneOffsetX: 0,
        zoneOffsetY: preset === "light-zone" ? -8 : 0,
        lightAttachToLayerId: preset === "light-zone" ? playerLayer?.id : undefined,
        cameraTargetX: preset === "camera-zone" ? cameraTargetX : presetPatch.cameraTargetX,
        cameraTargetY: preset === "camera-zone" ? cameraTargetY : presetPatch.cameraTargetY,
      }
    );
    insertAssetLayer(asset, {
      ...layer,
      opacity: preset === "light-zone" ? 0.08 : 0.18,
      zIndex: preset === "light-zone"
        ? (playerLayer ? playerLayer.zIndex + 1 : 44)
        : (playerLayer ? playerLayer.zIndex + 2 : 84),
    });
    setSelectedInteractionZoneLayerId(layer.id);
    setTab("scene");
    setNotice(isPlayerLight ? "Inserted reusable Light Zone attached to the player." : `Inserted reusable ${label}.`);
  };

  const insertFullSceneKit = () => {
    setScene(prev => ensureSceneKitLayers(prev));
    setVehiclePhase("approaching");
    setTab("scene");
    setNotice("Subway interaction kit is available: reusable eye inspect hotspots, ticket machine, backpack HUD, Line 13 sign, and boarding train.");
  };

  const reorderLayerStack = (sourceId: string, targetId: string) => {
    setScene(prev => reorderSceneLayerStack(prev, sourceId, targetId));
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

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImportSheetDataUrl(dataUrl);
      setImportFileName(file.name);
      const baseName = file.name.replace(/\.[^.]+$/, "");
      setImportAssetName(prev => (!prev.trim() || prev === "Imported Animation" ? baseName : prev));
      const sheetSize = await loadImageSize(dataUrl);
      setImportSheetSize(sheetSize);
      inferImportedFrameSize(sheetSize);
    } catch (err: any) {
      setError(err.message || "Could not read the uploaded file.");
    }
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

    const actionName = importActionName.trim() || "loop";
    const assetName = importAssetName.trim() || "Imported Animation";
    const { asset, sprite } = createImportedSpritesheetAsset({
      dataUrl: importSheetDataUrl,
      fileName: importFileName,
      assetName,
      actionName,
      frameWidth,
      frameHeight,
      frameCount,
      columns,
      sheetWidth,
      sheetHeight,
      role: importRole,
      triggerType: importTriggerType,
      triggerValue: importTriggerValue,
      gameState: importGameState,
      tagsText: importTagsText,
      loop: importLoop,
      fps,
    });

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

  const saveSheetOnlyRecolorVariant = async (request: SheetOnlyRecolorSaveRequest) => {
    if (!request.dataUrl || !request.paletteChanges.length) return;
    setError(null);
    setIsSavingRecolorVariant(true);

    try {
      const sourceTitle = request.title.trim() || activeSprite.characterName || "Spritesheet";
      const sourceAsset = sheetOnlySelectedAssetId
        ? assets.find(item => item.id === sheetOnlySelectedAssetId)
        : assets.find(item =>
            item.sprite.id === activeSprite.id ||
            item.animations?.some(clip => clip.sprite.id === activeSprite.id)
          );
      const sourceClip = sourceAsset?.animations?.find(clip => clip.sprite.id === activeSprite.id);
      const sourceBinding = sourceClip?.binding || sourceAsset?.binding || {
        actionName: "recolor",
        triggerType: "auto" as ActionTriggerType,
        triggerValue: "auto",
        gameState: "scene.recolor.loop",
      };
      const actionName = sourceClip?.actionName || sourceBinding.actionName || "recolor";
      const savedImage = await saveGeneratedImage(
        request.dataUrl,
        `${safeName(sourceTitle)}_recolor_${Date.now()}.png`,
        "Failed to save recolored spritesheet PNG"
      );
      const sourceTags = sourceAsset?.tags?.length ? sourceAsset.tags : splitTags(tagsText);
      const tags = Array.from(new Set([...sourceTags, "recolor", "variant"]));
      const paletteNote = request.paletteChanges
        .slice(0, 5)
        .map(change => `${change.name} ${change.from}->${change.to}`)
        .join(", ");
      const imported = createImportedSpritesheetAsset({
        dataUrl: savedImage.url,
        fileName: savedImage.name,
        assetName: `${sourceTitle} Recolor`,
        actionName,
        frameWidth: request.frameWidth,
        frameHeight: request.frameHeight,
        frameCount: request.frameCount,
        columns: request.columns,
        sheetWidth: request.sheetWidth,
        sheetHeight: request.sheetHeight,
        role: sourceAsset?.role || role,
        triggerType: sourceBinding.triggerType,
        triggerValue: sourceBinding.triggerValue || defaultTriggerValueForType(sourceBinding.triggerType),
        gameState: sourceBinding.gameState || defaultGameStateForTrigger(sourceBinding.triggerType, actionName),
        tagsText: tags.join(", "),
        loop: sourceClip?.loop ?? true,
        fps: sourceClip?.fps || activeSprite.fps || fps,
      });
      const sprite: AnimationSprite = {
        ...imported.sprite,
        rawSpritesheetPng: savedImage.url,
        description: `Palette recolor variant of ${sourceTitle}. ${paletteNote ? `Changed ${paletteNote}.` : ""}`.trim(),
        style: sourceClip?.sprite.style || sourceAsset?.sprite.style || imported.sprite.style,
        generationMode: "spritesheet-recolor-variant",
        proportionPolicy: "Recolor variant keeps the source spritesheet grid and alpha exactly; only mapped color groups changed.",
      };
      const animations = imported.asset.animations?.map(clip => ({
        ...clip,
        sprite,
        binding: {
          ...clip.binding,
          notes: "Palette recolor variant derived from the source spritesheet.",
        },
      }));
      const asset: GameAsset = {
        ...imported.asset,
        name: `${sourceTitle} Recolor / ${actionName}`,
        sprite,
        animations,
        binding: {
          ...imported.binding,
          notes: "Palette recolor variant derived from the source spritesheet.",
        },
        tags,
      };

      const data = await saveGameAsset(asset, "Failed to save recolor variant");
      const savedAsset = data.library.assets.find((item: GameAsset) => item.id === asset.id) || asset;
      const savedSprite = savedAsset.animations?.[0]?.sprite || savedAsset.sprite || sprite;
      setAssets(data.library.assets);
      setRepositoryImages(prev => [savedImage, ...prev.filter(image => image.url !== savedImage.url)]);
      setSprites(prev => [savedSprite, ...prev.filter(item => item.id !== savedSprite.id)]);
      setActiveSprite(savedSprite);
      setActiveFrame(0);
      setSheetColumns(request.columns);
      setSheetDataUrl(savedImage.url);
      setSheetOnlySelectionKind("sprite");
      setSheetOnlySelectionTitle(savedAsset.name);
      setSheetOnlySelectedAssetId(savedAsset.id);
      setNotice(`Saved recolor variant: ${savedAsset.name}`);
    } catch (err: any) {
      setError(err.message || "Failed to save recolor variant");
    } finally {
      setIsSavingRecolorVariant(false);
    }
  };

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
    setSheetOnlySelectedAssetId(null);
  };

  const returnToModePicker = () => {
    setIsPlaying(false);
    setAppMode("home");
  };

  const returnWithinGameWorkspace = () => {
    setIsPlaying(false);
    if (tab !== "scenes") {
      setIsBackpackOpen(false);
      setTab("scenes");
      return;
    }
    returnToModePicker();
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
        return asset.binding?.triggerType === "mouse" ? { asset, clip: undefined } : null;
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
    setNotice(`Mouse triggered action: ${matched.clip?.name || matched.asset.binding?.actionName || matched.asset.name}`);
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

  return {
    applyInteractionPreset,
    applyNeonLightingToSelectedLayer,
    clearLightingFromSelectedLayer,
    compileSheet,
    deleteAsset,
    deleteSceneObject,
    deleteSheetOnlySpriteFrame,
    downloadSelectedSceneItem,
    downloadSheet,
    enableFollowCameraView,
    finishLayerPointerReorder,
    handleImportFile,
    handleLayerImageUpload,
    inferImportedFrameSize,
    insertActiveSprite,
    insertAssetLayer,
    insertFullSceneKit,
    insertInteractionZone,
    insertSceneKitAsset,
    openGameMode,
    openSceneLayerContextMenu,
    openSheetOnlyMode,
    previewSceneSpritesheetEntry,
    rebuildSelectedSpritesheetGrid,
    removeSelectedLayer,
    reorderLayerStack,
    returnToModePicker,
    returnWithinGameWorkspace,
    saveAsset,
    saveAssetMetadata,
    saveImportedSpritesheet,
    saveSheetOnlyRecolorVariant,
    selectSheetOnlyImage,
    selectSheetOnlySprite,
    setLayerAnimation,
    startScenePanelResize,
    triggerMouseAction,
    updateAssetClipMetadata,
    updateAssetMetadata,
    updateImportActionName,
    updateImportTriggerType,
    updateLayerInteraction,
    updateSceneFrame,
    updateSceneLighting,
    updateSelectedLayerInteraction,
    updateSelectedLayerLighting,
    updateSelectedLayerShadow,
    updateSelectedSpriteMetadata,
    updateSelectedSpritesheetFps,
  };
}
