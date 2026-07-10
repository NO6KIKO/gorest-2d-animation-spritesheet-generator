import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeStartUiSettings } from "../../../domain/scene/startUiModel";
import type { GameScene, GameStartUiLayer, GameStartUiSettings } from "../../../types";
import {
  filterVisibleStartUiLayers,
  findStartUiLayer,
  getStartUiDesignSize,
  orderStartUiLayers,
  patchStartUiLayer,
  startUiSettingsSignature,
} from "./startUiEditorModel";
import { createTextStartUiButtonLayer } from "./startUiLayerModel";
import { useStartUiArtworkActions } from "./useStartUiArtworkActions";
import { useStartUiLayerInteraction } from "./useStartUiLayerInteraction";

type UseStartUiEditorOptions = {
  scenes: GameScene[];
  settings: GameStartUiSettings;
};

export function useStartUiEditor({ scenes, settings }: UseStartUiEditorOptions) {
  const [draft, setDraft] = useState<GameStartUiSettings>(() => normalizeStartUiSettings(settings, scenes));
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const settingsSignatureRef = useRef("");

  useEffect(() => {
    const nextSignature = startUiSettingsSignature(settings);
    if (settingsSignatureRef.current === nextSignature) return;
    settingsSignatureRef.current = nextSignature;
    const normalized = normalizeStartUiSettings(settings, scenes);
    setDraft(normalized);
    setSelectedLayerId(current => current && normalized.layers?.some(layer => layer.id === current)
      ? current
      : null);
  }, [scenes, settings]);

  const selectedStartScene = useMemo(() => (
    scenes.find(scene => scene.id === draft.initialSceneId) || scenes[0]
  ), [draft.initialSceneId, scenes]);
  const { designHeight, designWidth } = getStartUiDesignSize(draft);
  const orderedLayers = useMemo(() => orderStartUiLayers(draft.layers), [draft.layers]);
  const visibleLayers = useMemo(() => filterVisibleStartUiLayers(orderedLayers), [orderedLayers]);
  const selectedLayer = useMemo(
    () => findStartUiLayer(draft.layers, selectedLayerId),
    [draft.layers, selectedLayerId],
  );

  const patchDraft = (patch: Partial<GameStartUiSettings>) => {
    setDraft(previous => normalizeStartUiSettings({ ...previous, ...patch }, scenes));
  };

  const patchLayer = (layerId: string, patch: Partial<GameStartUiLayer>) => {
    setDraft(previous => normalizeStartUiSettings(patchStartUiLayer(previous, layerId, patch), scenes));
  };

  const replaceLayers = (
    layers: GameStartUiLayer[],
    patch: Partial<GameStartUiSettings> = {},
    nextSelectedLayerId: string | null = null,
  ) => {
    patchDraft({ ...patch, layers });
    setSelectedLayerId(nextSelectedLayerId);
  };

  const layerInteraction = useStartUiLayerInteraction({
    designHeight,
    designWidth,
    scenes,
    selectedLayer,
    setDraft,
    setSelectedLayerId,
    onPatchLayer: patchLayer,
  });

  const artwork = useStartUiArtworkActions({
    designHeight,
    designWidth,
    draft,
    scenes,
    onPatchDraft: patchDraft,
    onReplaceLayers: replaceLayers,
    onSelectLayer: setSelectedLayerId,
  });

  const addTextButtonLayer = () => {
    const layer = createTextStartUiButtonLayer(draft, designWidth, designHeight);
    patchDraft({ layers: [...(draft.layers || []), layer] });
    setSelectedLayerId(layer.id);
  };

  const deleteSelectedLayer = () => {
    if (!selectedLayer) return;
    replaceLayers((draft.layers || []).filter(layer => layer.id !== selectedLayer.id));
  };

  return {
    ...artwork,
    addTextButtonLayer,
    deleteSelectedLayer,
    designHeight,
    designWidth,
    draft,
    finishLayerDrag: layerInteraction.finishLayerDrag,
    handleStageKeyDown: layerInteraction.handleStageKeyDown,
    orderedLayers,
    patchDraft,
    patchLayer,
    selectedLayer,
    selectedLayerId,
    selectedStartScene,
    setSelectedLayerId,
    stageRef: layerInteraction.stageRef,
    startLayerDrag: layerInteraction.startLayerDrag,
    startSelectedLayerDrag: layerInteraction.clearLayerSelection,
    updateLayerDrag: layerInteraction.updateLayerDrag,
    visibleLayers,
  };
}
