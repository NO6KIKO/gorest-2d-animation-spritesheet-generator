import { useState, type ChangeEvent } from "react";
import { loadImageSize } from "../../../app/fileInput";
import { normalizeStartUiSettings } from "../../../domain/scene/startUiModel";
import type { GameScene, GameStartUiLayer, GameStartUiSettings, StartUiLayerKind } from "../../../types";
import { generateSplitLayersFromStartUiArtwork, uploadStartUiImage } from "./startUiArtworkProcessing";
import { formatStartUiSplitStatus } from "./startUiEditorMessages";
import type { PatchStartUiDraft } from "./startUiInspectorTypes";
import {
  buildCroppedStartUiTemplateLayers,
  buildTextStartUiLayoutLayers,
  createUploadedStartUiLayer,
} from "./startUiLayerModel";

type ReplaceStartUiLayers = (
  layers: GameStartUiLayer[],
  patch?: Partial<GameStartUiSettings>,
  nextSelectedLayerId?: string | null,
) => void;

type UseStartUiArtworkActionsOptions = {
  designHeight: number;
  designWidth: number;
  draft: GameStartUiSettings;
  scenes: GameScene[];
  onPatchDraft: PatchStartUiDraft;
  onReplaceLayers: ReplaceStartUiLayers;
  onSelectLayer: (layerId: string | null) => void;
};

export function useStartUiArtworkActions({
  designHeight,
  designWidth,
  draft,
  scenes,
  onPatchDraft,
  onReplaceLayers,
  onSelectLayer,
}: UseStartUiArtworkActionsOptions) {
  const [isProcessingArtwork, setIsProcessingArtwork] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [uiStatus, setUiStatus] = useState<string | null>(null);

  const handleWholeUiUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setIsProcessingArtwork(true);
    setUiError(null);
    setUiStatus(null);
    try {
      const upload = await uploadStartUiImage(file, "whole_ui");
      const sourceSettings = normalizeStartUiSettings({
        ...draft,
        designWidth: upload.width,
        designHeight: upload.height,
        backgroundImageUrl: upload.url,
      }, scenes);
      const split = await generateSplitLayersFromStartUiArtwork(upload.url, sourceSettings, upload.width, upload.height);
      onReplaceLayers(split.layers, {
        designWidth: upload.width,
        designHeight: upload.height,
        backgroundImageUrl: split.layers[0]?.imageUrl || upload.url,
      });
      setUiStatus(formatStartUiSplitStatus(split));
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
    setUiStatus(null);
    try {
      const upload = await uploadStartUiImage(file, "background");
      const nextSettings = normalizeStartUiSettings({ ...draft, backgroundImageUrl: upload.url }, scenes);
      onReplaceLayers(
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
    setUiStatus(null);
    try {
      const upload = await uploadStartUiImage(file, kind);
      const layer = createUploadedStartUiLayer(kind, upload, draft, designWidth, designHeight);
      onPatchDraft({ layers: [...(draft.layers || []), layer] });
      onSelectLayer(layer.id);
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
      setUiStatus(null);
      return;
    }
    setIsProcessingArtwork(true);
    setUiError(null);
    setUiStatus(null);
    try {
      const [width, height] = await loadImageSize(sourceUrl).catch(() => [designWidth, designHeight] as [number, number]);
      const sourceSettings = normalizeStartUiSettings({ ...draft, designWidth: width, designHeight: height }, scenes);
      const split = await generateSplitLayersFromStartUiArtwork(sourceUrl, sourceSettings, width, height);
      onReplaceLayers(split.layers, {
        designWidth: width,
        designHeight: height,
        backgroundImageUrl: split.layers[0]?.imageUrl || sourceUrl,
      });
      setUiStatus(formatStartUiSplitStatus(split));
    } catch (error) {
      onReplaceLayers(
        buildCroppedStartUiTemplateLayers(sourceUrl, draft, designWidth, designHeight),
        { backgroundImageUrl: sourceUrl },
      );
      setUiError(error instanceof Error ? `${error.message} Using crop layers instead.` : "Using crop layers instead.");
      setUiStatus(null);
    } finally {
      setIsProcessingArtwork(false);
    }
  };

  const autoLayoutFromBackground = async () => {
    const backgroundUrl = draft.backgroundImageUrl
      || draft.layers?.find(layer => layer.kind === "background" && layer.imageUrl)?.imageUrl
      || "";
    if (!backgroundUrl) {
      setUiError("Add a background first.");
      setUiStatus(null);
      return;
    }
    const [width, height] = await loadImageSize(backgroundUrl).catch(() => [designWidth, designHeight] as [number, number]);
    const sourceSettings = normalizeStartUiSettings({ ...draft, designWidth: width, designHeight: height }, scenes);
    onReplaceLayers(
      buildTextStartUiLayoutLayers(backgroundUrl, sourceSettings, width, height),
      { designWidth: width, designHeight: height, backgroundImageUrl: backgroundUrl },
    );
    setUiError(null);
    setUiStatus("Auto layout placed editable text layers over the background.");
  };

  return {
    autoLayoutFromBackground,
    autoSplitCurrentArtwork,
    handleBackgroundUpload,
    handleLayerUpload,
    handleWholeUiUpload,
    isProcessingArtwork,
    uiError,
    uiStatus,
  };
}
