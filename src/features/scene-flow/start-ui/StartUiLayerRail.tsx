import { Eye, EyeOff, ImagePlus, Layers, Lock, Monitor, Plus, Upload } from "lucide-react";
import type { ChangeEvent } from "react";
import type { GameScene, GameStartUiLayer, StartUiLayerKind } from "../../../types";
import { START_UI_IMAGE_ACCEPT } from "./startUiEditorOptions";

type StartUiLayerRailProps = {
  isProcessingArtwork: boolean;
  layers: GameStartUiLayer[];
  selectedLayerId: string | null;
  selectedStartScene?: GameScene;
  title: string;
  onAddTextButtonLayer: () => void;
  onAutoLayoutFromBackground: () => void | Promise<void>;
  onAutoSplitCurrentArtwork: () => void | Promise<void>;
  onBackgroundUpload: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onLayerUpload: (kind: StartUiLayerKind) => (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onSelectLayer: (layerId: string) => void;
  onWholeUiUpload: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
};

export function StartUiLayerRail({
  isProcessingArtwork,
  layers,
  selectedLayerId,
  selectedStartScene,
  title,
  onAddTextButtonLayer,
  onAutoLayoutFromBackground,
  onAutoSplitCurrentArtwork,
  onBackgroundUpload,
  onLayerUpload,
  onSelectLayer,
  onWholeUiUpload,
}: StartUiLayerRailProps) {
  return (
    <aside className="scene-start-ui-layer-rail">
      <div className="scene-start-ui-page-title">
        <strong><Monitor size={16} /> {title || "Start UI"}</strong>
        <span>{selectedStartScene ? selectedStartScene.name : "No entry scene"}</span>
      </div>

      <div className="scene-start-ui-upload-grid">
        <label className="scene-start-ui-file-button">
          <Upload size={14} /> Whole UI
          <input type="file" accept={START_UI_IMAGE_ACCEPT} onChange={onWholeUiUpload} />
        </label>
        <label className="scene-start-ui-file-button">
          <ImagePlus size={14} /> Background
          <input type="file" accept={START_UI_IMAGE_ACCEPT} onChange={onBackgroundUpload} />
        </label>
        <label className="scene-start-ui-file-button">
          <ImagePlus size={14} /> Logo
          <input type="file" accept={START_UI_IMAGE_ACCEPT} onChange={onLayerUpload("title")} />
        </label>
        <label className="scene-start-ui-file-button">
          <ImagePlus size={14} /> Button
          <input type="file" accept={START_UI_IMAGE_ACCEPT} onChange={onLayerUpload("menu")} />
        </label>
      </div>

      <div className="scene-start-ui-action-stack">
        <button type="button" className="ghost-button" onClick={() => void onAutoSplitCurrentArtwork()} disabled={isProcessingArtwork}>
          <Layers size={14} /> Auto Split
        </button>
        <button type="button" className="ghost-button" onClick={() => void onAutoLayoutFromBackground()} disabled={isProcessingArtwork}>
          <Monitor size={14} /> Auto Layout
        </button>
        <button type="button" className="ghost-button" onClick={onAddTextButtonLayer}>
          <Plus size={14} /> Text Button
        </button>
      </div>

      <div className="scene-start-ui-layer-list canvas-list">
        {layers.map(layer => (
          <button
            key={layer.id}
            type="button"
            className={`scene-start-ui-layer-row ${selectedLayerId === layer.id ? "selected" : ""}`}
            onClick={() => onSelectLayer(layer.id)}
          >
            {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>{layer.name}</span>
            {layer.locked && <Lock size={12} />}
          </button>
        ))}
      </div>
    </aside>
  );
}
