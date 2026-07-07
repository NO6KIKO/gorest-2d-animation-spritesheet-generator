import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";
import { loadImageSize } from "../../../app/fileInput";
import { normalizeStartUiSettings } from "../../../domain/scene/startUiModel";
import type { GameScene, GameStartUiLayer, GameStartUiSettings, StartUiLayerKind } from "../../../types";
import { generateSplitLayersFromStartUiArtwork, uploadStartUiImage } from "./startUiArtworkProcessing";
import {
  buildCroppedStartUiTemplateLayers,
  buildTextStartUiLayoutLayers,
  clampStartUiValue,
  createTextStartUiButtonLayer,
  createUploadedStartUiLayer,
} from "./startUiLayerModel";

type DragState = {
  id: string;
  pointerX: number;
  pointerY: number;
  x: number;
  y: number;
};

type UseStartUiEditorOptions = {
  scenes: GameScene[];
  settings: GameStartUiSettings;
};

export function useStartUiEditor({ scenes, settings }: UseStartUiEditorOptions) {
  const [draft, setDraft] = useState<GameStartUiSettings>(() => normalizeStartUiSettings(settings, scenes));
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(settings.layers?.[1]?.id || settings.layers?.[0]?.id || null);
  const [isProcessingArtwork, setIsProcessingArtwork] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const normalized = normalizeStartUiSettings(settings, scenes);
    setDraft(normalized);
    setSelectedLayerId(current => current && normalized.layers?.some(layer => layer.id === current)
      ? current
      : normalized.layers?.[1]?.id || normalized.layers?.[0]?.id || null);
  }, [scenes, settings]);

  const selectedStartScene = useMemo(() => (
    scenes.find(scene => scene.id === draft.initialSceneId) || scenes[0]
  ), [draft.initialSceneId, scenes]);
  const designWidth = Math.max(1, draft.designWidth || 1672);
  const designHeight = Math.max(1, draft.designHeight || 941);
  const orderedLayers = useMemo(() => (
    [...(draft.layers || [])].sort((a, b) => a.zIndex - b.zIndex)
  ), [draft.layers]);
  const visibleLayers = orderedLayers.filter(layer => layer.visible && (layer.imageUrl || layer.label));
  const selectedLayer = useMemo(() => (
    (draft.layers || []).find(layer => layer.id === selectedLayerId) || null
  ), [draft.layers, selectedLayerId]);

  const patchDraft = (patch: Partial<GameStartUiSettings>) => {
    setDraft(prev => normalizeStartUiSettings({ ...prev, ...patch }, scenes));
  };

  const patchLayer = (layerId: string, patch: Partial<GameStartUiLayer>) => {
    setDraft(prev => normalizeStartUiSettings({
      ...prev,
      layers: (prev.layers || []).map(layer => layer.id === layerId ? { ...layer, ...patch } : layer),
    }, scenes));
  };

  const replaceLayers = (layers: GameStartUiLayer[], patch: Partial<GameStartUiSettings> = {}) => {
    patchDraft({ ...patch, layers });
    setSelectedLayerId(layers.find(layer => layer.kind !== "background")?.id || layers[0]?.id || null);
  };

  const handleWholeUiUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setIsProcessingArtwork(true);
    setUiError(null);
    try {
      const upload = await uploadStartUiImage(file, "whole_ui");
      const sourceSettings = normalizeStartUiSettings({
        ...draft,
        designWidth: upload.width,
        designHeight: upload.height,
        backgroundImageUrl: upload.url,
      }, scenes);
      const layers = await generateSplitLayersFromStartUiArtwork(upload.url, sourceSettings, upload.width, upload.height);
      replaceLayers(layers, { designWidth: upload.width, designHeight: upload.height, backgroundImageUrl: layers[0]?.imageUrl || upload.url });
    } catch (error) {
      setUiError(error instanceof Error ? error.message : "Could not auto split Start UI artwork.");
    } finally {
      setIsProcessingArtwork(false);
    }
  };

  const handleBackgroundUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setIsProcessingArtwork(true);
    setUiError(null);
    try {
      const upload = await uploadStartUiImage(file, "background");
      const nextSettings = normalizeStartUiSettings({ ...draft, backgroundImageUrl: upload.url }, scenes);
      replaceLayers(
        buildTextStartUiLayoutLayers(upload.url, nextSettings, upload.width, upload.height),
        { designWidth: upload.width, designHeight: upload.height, backgroundImageUrl: upload.url },
      );
    } catch (error) {
      setUiError(error instanceof Error ? error.message : "Could not upload Start UI background.");
    } finally {
      setIsProcessingArtwork(false);
    }
  };

  const handleLayerUpload = (kind: StartUiLayerKind) => async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setIsProcessingArtwork(true);
    setUiError(null);
    try {
      const upload = await uploadStartUiImage(file, kind);
      const layer = createUploadedStartUiLayer(kind, upload, draft, designWidth, designHeight);
      patchDraft({ layers: [...(draft.layers || []), layer] });
      setSelectedLayerId(layer.id);
    } catch (error) {
      setUiError(error instanceof Error ? error.message : "Could not upload Start UI layer.");
    } finally {
      setIsProcessingArtwork(false);
    }
  };

  const autoSplitCurrentArtwork = async () => {
    const sourceUrl = draft.backgroundImageUrl || draft.layers?.find(layer => layer.imageUrl)?.imageUrl;
    if (!sourceUrl) {
      setUiError("Add Start UI artwork first.");
      return;
    }
    setIsProcessingArtwork(true);
    setUiError(null);
    try {
      const [width, height] = await loadImageSize(sourceUrl).catch(() => [designWidth, designHeight] as [number, number]);
      const sourceSettings = normalizeStartUiSettings({ ...draft, designWidth: width, designHeight: height }, scenes);
      const layers = await generateSplitLayersFromStartUiArtwork(sourceUrl, sourceSettings, width, height);
      replaceLayers(layers, { designWidth: width, designHeight: height, backgroundImageUrl: layers[0]?.imageUrl || sourceUrl });
    } catch (error) {
      const layers = buildCroppedStartUiTemplateLayers(sourceUrl, draft, designWidth, designHeight);
      replaceLayers(layers, { backgroundImageUrl: sourceUrl });
      setUiError(error instanceof Error ? `${error.message} Using crop layers instead.` : "Using crop layers instead.");
    } finally {
      setIsProcessingArtwork(false);
    }
  };

  const autoLayoutFromBackground = async () => {
    const backgroundUrl = draft.backgroundImageUrl || draft.layers?.find(layer => layer.kind === "background" && layer.imageUrl)?.imageUrl || "";
    if (!backgroundUrl) {
      setUiError("Add a background first.");
      return;
    }
    const [width, height] = await loadImageSize(backgroundUrl).catch(() => [designWidth, designHeight] as [number, number]);
    const sourceSettings = normalizeStartUiSettings({ ...draft, designWidth: width, designHeight: height }, scenes);
    replaceLayers(
      buildTextStartUiLayoutLayers(backgroundUrl, sourceSettings, width, height),
      { designWidth: width, designHeight: height, backgroundImageUrl: backgroundUrl },
    );
    setUiError(null);
  };

  const addTextButtonLayer = () => {
    const layer = createTextStartUiButtonLayer(draft, designWidth, designHeight);
    patchDraft({ layers: [...(draft.layers || []), layer] });
    setSelectedLayerId(layer.id);
  };

  const deleteSelectedLayer = () => {
    if (!selectedLayer) return;
    replaceLayers((draft.layers || []).filter(layer => layer.id !== selectedLayer.id));
  };

  const pointFromEvent = (event: ReactPointerEvent<HTMLElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * designWidth,
      y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * designHeight,
    };
  };

  const startLayerDrag = (event: ReactPointerEvent<HTMLDivElement>, layer: GameStartUiLayer) => {
    setSelectedLayerId(layer.id);
    if (layer.locked) return;
    const pointer = pointFromEvent(event);
    dragRef.current = { id: layer.id, pointerX: pointer.x, pointerY: pointer.y, x: layer.x, y: layer.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const updateLayerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const layer = draft.layers?.find(item => item.id === drag.id);
    if (!layer) return;
    const pointer = pointFromEvent(event);
    patchLayer(drag.id, {
      x: Math.round(clampStartUiValue(drag.x + pointer.x - drag.pointerX, -layer.width * 0.9, designWidth - layer.width * 0.1)),
      y: Math.round(clampStartUiValue(drag.y + pointer.y - drag.pointerY, -layer.height * 0.9, designHeight - layer.height * 0.1)),
    });
    event.preventDefault();
  };

  const finishLayerDrag = () => {
    dragRef.current = null;
  };

  const handleNumberInput = (key: "saveSlots" | "musicVolume" | "sfxVolume") => (event: ChangeEvent<HTMLInputElement>) => {
    patchDraft({ [key]: Number(event.target.value) } as Partial<GameStartUiSettings>);
  };

  return {
    addTextButtonLayer,
    autoLayoutFromBackground,
    autoSplitCurrentArtwork,
    deleteSelectedLayer,
    designHeight,
    designWidth,
    draft,
    finishLayerDrag,
    handleBackgroundUpload,
    handleLayerUpload,
    handleNumberInput,
    handleWholeUiUpload,
    isProcessingArtwork,
    orderedLayers,
    patchDraft,
    patchLayer,
    selectedLayer,
    selectedLayerId,
    selectedStartScene,
    setSelectedLayerId,
    stageRef,
    startLayerDrag,
    uiError,
    updateLayerDrag,
    visibleLayers,
  };
}
