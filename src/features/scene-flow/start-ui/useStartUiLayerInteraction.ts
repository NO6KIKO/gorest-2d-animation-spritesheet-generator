import {
  useRef,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import { normalizeStartUiSettings } from "../../../domain/scene/startUiModel";
import type { GameScene, GameStartUiLayer, GameStartUiSettings } from "../../../types";
import {
  createStartUiDragState,
  dragStartUiLayerPosition,
  moveStartUiLayerPosition,
  pointFromStartUiStage,
  type StartUiDragState,
} from "./startUiEditorModel";
import type { PatchStartUiLayer } from "./startUiInspectorTypes";

type UseStartUiLayerInteractionOptions = {
  designHeight: number;
  designWidth: number;
  scenes: GameScene[];
  selectedLayer: GameStartUiLayer | null;
  setDraft: Dispatch<SetStateAction<GameStartUiSettings>>;
  setSelectedLayerId: Dispatch<SetStateAction<string | null>>;
  onPatchLayer: PatchStartUiLayer;
};

export function useStartUiLayerInteraction({
  designHeight,
  designWidth,
  scenes,
  selectedLayer,
  setDraft,
  setSelectedLayerId,
  onPatchLayer,
}: UseStartUiLayerInteractionOptions) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<StartUiDragState | null>(null);

  const startLayerDrag = (event: ReactPointerEvent<HTMLDivElement>, layer: GameStartUiLayer) => {
    event.stopPropagation();
    setSelectedLayerId(layer.id);
    stageRef.current?.focus();
    if (layer.locked) return;
    const pointer = pointFromStartUiStage(event, stageRef.current, designWidth, designHeight);
    dragRef.current = createStartUiDragState(layer, pointer);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const clearLayerSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
    stageRef.current?.focus();
    setSelectedLayerId(null);
    dragRef.current = null;
    event.preventDefault();
  };

  const updateLayerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const pointer = pointFromStartUiStage(event, stageRef.current, designWidth, designHeight);
    setDraft(previous => {
      const layer = previous.layers?.find(item => item.id === drag.id);
      if (!layer) return previous;
      const position = dragStartUiLayerPosition(layer, drag, pointer, designWidth, designHeight);
      return normalizeStartUiSettings({
        ...previous,
        layers: (previous.layers || []).map(item => item.id === drag.id ? { ...item, ...position } : item),
      }, scenes);
    });
    event.preventDefault();
  };

  const finishLayerDrag = () => {
    dragRef.current = null;
  };

  const moveSelectedLayer = (deltaX: number, deltaY: number) => {
    if (!selectedLayer || selectedLayer.locked) return;
    onPatchLayer(
      selectedLayer.id,
      moveStartUiLayerPosition(selectedLayer, deltaX, deltaY, designWidth, designHeight),
    );
  };

  const handleStageKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!selectedLayer || selectedLayer.locked) return;
    const step = event.shiftKey ? 10 : 1;
    if (event.key === "ArrowLeft") moveSelectedLayer(-step, 0);
    else if (event.key === "ArrowRight") moveSelectedLayer(step, 0);
    else if (event.key === "ArrowUp") moveSelectedLayer(0, -step);
    else if (event.key === "ArrowDown") moveSelectedLayer(0, step);
    else return;
    event.preventDefault();
  };

  return {
    clearLayerSelection,
    finishLayerDrag,
    handleStageKeyDown,
    stageRef,
    startLayerDrag,
    updateLayerDrag,
  };
}
