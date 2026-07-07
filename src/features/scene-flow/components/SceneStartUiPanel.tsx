import { Eye, EyeOff, ImagePlus, Layers, Lock, Monitor, Plus, Save, Settings, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { loadImageSize, readFileAsDataUrl } from "../../../app/fileInput";
import { normalizeStartUiSettings } from "../../../domain/scene/startUiModel";
import { saveGeneratedImage } from "../../../services/generatedAssetsApi";
import type { GameScene, GameStartUiLayer, GameStartUiSettings, StartUiLayerKind, StartUiTheme } from "../../../types";

type SceneStartUiPanelProps = {
  isSaving?: boolean;
  scenes: GameScene[];
  settings: GameStartUiSettings;
  onSave: (settings: GameStartUiSettings) => void | Promise<void>;
};

type AutoSplitRegion = {
  suffix: string;
  name: string;
  kind: StartUiLayerKind;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  locked?: boolean;
};

type DragState = {
  id: string;
  pointerX: number;
  pointerY: number;
  x: number;
  y: number;
};

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";

const THEME_OPTIONS: Array<{ value: StartUiTheme; label: string }> = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "horror", label: "Horror" },
];

const LAYER_KIND_OPTIONS: Array<{ value: StartUiLayerKind; label: string }> = [
  { value: "background", label: "Background" },
  { value: "title", label: "Logo / Title" },
  { value: "menu", label: "Menu Button" },
  { value: "overlay", label: "Overlay" },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toggleLabel(value: boolean) {
  return value ? "On" : "Off";
}

function safeFilenamePart(value: string) {
  const cleaned = value
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return cleaned.slice(0, 46) || "artwork";
}

function imageExtension(file: File) {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  return "png";
}

function makeLayerId(prefix: string) {
  return `start_ui_layer_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function menuRegions(settings: GameStartUiSettings, designWidth: number, designHeight: number) {
  const menuItems = [
    { suffix: "new_game", label: settings.primaryActionLabel || "New Game" },
    settings.showContinue ? { suffix: "continue", label: settings.continueActionLabel || "Continue" } : null,
    settings.showLoadGame ? { suffix: "load_game", label: settings.loadActionLabel || "Load Game" } : null,
    settings.showSettings ? { suffix: "settings", label: settings.settingsActionLabel || "Settings" } : null,
    settings.showQuit ? { suffix: "quit", label: settings.quitActionLabel || "Quit" } : null,
  ].filter(Boolean) as Array<{ suffix: string; label: string }>;

  const buttonWidth = Math.round(designWidth * 0.36);
  const buttonHeight = Math.round(designHeight * 0.105);
  const gap = Math.round(designHeight * 0.035);
  const totalHeight = menuItems.length * buttonHeight + Math.max(0, menuItems.length - 1) * gap;
  const startY = Math.round(designHeight * 0.53 - totalHeight * 0.5);
  const x = Math.round((designWidth - buttonWidth) * 0.5);

  return menuItems.map((item, index) => ({
    suffix: item.suffix,
    name: item.label,
    kind: "menu" as const,
    label: item.label,
    x,
    y: startY + index * (buttonHeight + gap),
    width: buttonWidth,
    height: buttonHeight,
    zIndex: 20 + index * 10,
  }));
}

function autoSplitRegions(settings: GameStartUiSettings, designWidth: number, designHeight: number): AutoSplitRegion[] {
  return [
    {
      suffix: "background",
      name: "Background",
      kind: "background",
      x: 0,
      y: 0,
      width: designWidth,
      height: designHeight,
      zIndex: 0,
      locked: true,
    },
    {
      suffix: "logo",
      name: "Logo / Title",
      kind: "title",
      label: settings.title || "Title",
      x: Math.round(designWidth * 0.24),
      y: Math.round(designHeight * 0.06),
      width: Math.round(designWidth * 0.52),
      height: Math.round(designHeight * 0.34),
      zIndex: 10,
    },
    ...menuRegions(settings, designWidth, designHeight),
  ];
}

function regionToLayer(region: AutoSplitRegion, imageUrl: string, useCrop: boolean): GameStartUiLayer {
  const isBackground = region.kind === "background";
  return {
    id: makeLayerId(region.suffix),
    name: region.name,
    kind: region.kind,
    imageUrl: isBackground || useCrop ? imageUrl : "",
    label: region.label,
    visible: true,
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    opacity: 1,
    zIndex: region.zIndex,
    locked: region.locked,
    sourceX: !isBackground && useCrop ? region.x : undefined,
    sourceY: !isBackground && useCrop ? region.y : undefined,
    sourceWidth: !isBackground && useCrop ? region.width : undefined,
    sourceHeight: !isBackground && useCrop ? region.height : undefined,
  };
}

function buildCroppedTemplateLayers(sourceUrl: string, settings: GameStartUiSettings, designWidth: number, designHeight: number) {
  return autoSplitRegions(settings, designWidth, designHeight).map(region => regionToLayer(region, sourceUrl, true));
}

function buildTextLayoutLayers(backgroundUrl: string, settings: GameStartUiSettings, designWidth: number, designHeight: number) {
  return autoSplitRegions(settings, designWidth, designHeight).map(region => regionToLayer(region, backgroundUrl, false));
}

function layerStyle(layer: GameStartUiLayer, designWidth: number, designHeight: number): CSSProperties {
  return {
    height: `${layer.height / designHeight * 100}%`,
    left: `${layer.x / designWidth * 100}%`,
    opacity: layer.opacity,
    top: `${layer.y / designHeight * 100}%`,
    width: `${layer.width / designWidth * 100}%`,
    zIndex: layer.zIndex,
  };
}

function layerCropStyle(layer: GameStartUiLayer, designWidth: number, designHeight: number): CSSProperties {
  const sourceWidth = Math.max(1, layer.sourceWidth || layer.width);
  const sourceHeight = Math.max(1, layer.sourceHeight || layer.height);
  const positionX = designWidth === sourceWidth ? 0 : ((layer.sourceX || 0) / (designWidth - sourceWidth)) * 100;
  const positionY = designHeight === sourceHeight ? 0 : ((layer.sourceY || 0) / (designHeight - sourceHeight)) * 100;
  return {
    backgroundImage: layer.imageUrl ? `url("${layer.imageUrl}")` : undefined,
    backgroundPosition: `${positionX}% ${positionY}%`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${designWidth / sourceWidth * 100}% ${designHeight / sourceHeight * 100}%`,
  };
}

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read Start UI artwork."));
    image.src = src;
  });
}

async function saveCanvasPng(canvas: HTMLCanvasElement, name: string) {
  const file = await saveGeneratedImage(canvas.toDataURL("image/png"), `${name}.png`, "Failed to save Start UI layer image");
  return file.url;
}

async function generateSplitLayersFromArtwork(sourceUrl: string, settings: GameStartUiSettings, designWidth: number, designHeight: number) {
  const image = await loadCanvasImage(sourceUrl);
  const width = Math.max(1, Math.round(designWidth));
  const height = Math.max(1, Math.round(designHeight));
  const naturalWidth = Math.max(1, image.naturalWidth || image.width || width);
  const naturalHeight = Math.max(1, image.naturalHeight || image.height || height);
  const scaleX = naturalWidth / width;
  const scaleY = naturalHeight / height;
  const regions = autoSplitRegions(settings, width, height);
  const timestamp = Date.now();

  const backgroundCanvas = document.createElement("canvas");
  backgroundCanvas.width = width;
  backgroundCanvas.height = height;
  const backgroundContext = backgroundCanvas.getContext("2d");
  if (!backgroundContext) throw new Error("Could not create Start UI canvas.");
  backgroundContext.drawImage(image, 0, 0, width, height);

  regions.filter(region => region.kind !== "background").forEach(region => {
    backgroundContext.save();
    backgroundContext.beginPath();
    backgroundContext.rect(region.x, region.y, region.width, region.height);
    backgroundContext.clip();
    backgroundContext.filter = "blur(22px)";
    backgroundContext.drawImage(image, -32, -32, width + 64, height + 64);
    backgroundContext.filter = "none";
    backgroundContext.fillStyle = settings.theme === "light" ? "rgba(248, 250, 252, .34)" : "rgba(5, 8, 14, .34)";
    backgroundContext.fillRect(region.x, region.y, region.width, region.height);
    backgroundContext.restore();
  });

  const backgroundUrl = await saveCanvasPng(backgroundCanvas, `start_ui_autosplit_background_${timestamp}`);
  const layers: GameStartUiLayer[] = [regionToLayer(regions[0], backgroundUrl, false)];

  for (const region of regions.slice(1)) {
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = Math.max(1, region.width);
    cropCanvas.height = Math.max(1, region.height);
    const cropContext = cropCanvas.getContext("2d");
    if (!cropContext) continue;
    cropContext.drawImage(
      image,
      region.x * scaleX,
      region.y * scaleY,
      region.width * scaleX,
      region.height * scaleY,
      0,
      0,
      region.width,
      region.height,
    );
    const imageUrl = await saveCanvasPng(cropCanvas, `start_ui_autosplit_${region.suffix}_${timestamp}`);
    layers.push({
      ...regionToLayer(region, imageUrl, false),
      imageUrl,
    });
  }

  return layers;
}

function renderLayerArtwork(layer: GameStartUiLayer) {
  if (layer.imageUrl && !layer.sourceWidth) {
    return <img src={layer.imageUrl} alt="" draggable={false} />;
  }
  if (layer.label) {
    return <span className={`scene-start-ui-text-layer ${layer.kind}`}>{layer.label}</span>;
  }
  return null;
}

export function SceneStartUiPanel({
  isSaving = false,
  scenes,
  settings,
  onSave,
}: SceneStartUiPanelProps) {
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

  const uploadStartUiImage = async (file: File, prefix: string) => {
    const dataUrl = await readFileAsDataUrl(file, "Could not read the Start UI image.");
    const [width, height] = await loadImageSize(dataUrl, "Could not read the Start UI image size.");
    const saved = await saveGeneratedImage(
      dataUrl,
      `start_ui_${prefix}_${Date.now()}_${safeFilenamePart(file.name)}.${imageExtension(file)}`,
      "Failed to save Start UI image",
    );
    return { url: saved.url, width, height };
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
      const layers = await generateSplitLayersFromArtwork(upload.url, sourceSettings, upload.width, upload.height);
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
        buildTextLayoutLayers(upload.url, nextSettings, upload.width, upload.height),
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
      const width = Math.round(Math.min(upload.width, designWidth * (kind === "title" ? 0.52 : 0.36)));
      const height = Math.round(Math.min(upload.height, designHeight * (kind === "title" ? 0.32 : 0.12)));
      const layer: GameStartUiLayer = {
        id: makeLayerId(kind),
        name: kind === "title" ? "Logo / Title" : "Menu Button",
        kind,
        imageUrl: upload.url,
        label: kind === "title" ? draft.title : draft.primaryActionLabel,
        visible: true,
        x: Math.round((designWidth - width) * 0.5),
        y: Math.round(designHeight * (kind === "title" ? 0.1 : 0.56)),
        width,
        height,
        opacity: 1,
        zIndex: kind === "title" ? 12 : 45,
      };
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
      const layers = await generateSplitLayersFromArtwork(sourceUrl, sourceSettings, width, height);
      replaceLayers(layers, { designWidth: width, designHeight: height, backgroundImageUrl: layers[0]?.imageUrl || sourceUrl });
    } catch (error) {
      const layers = buildCroppedTemplateLayers(sourceUrl, draft, designWidth, designHeight);
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
      buildTextLayoutLayers(backgroundUrl, sourceSettings, width, height),
      { designWidth: width, designHeight: height, backgroundImageUrl: backgroundUrl },
    );
    setUiError(null);
  };

  const addTextButtonLayer = () => {
    const layer: GameStartUiLayer = {
      id: makeLayerId("button"),
      name: draft.primaryActionLabel || "Button",
      kind: "menu",
      imageUrl: "",
      label: draft.primaryActionLabel || "New Game",
      visible: true,
      x: Math.round(designWidth * 0.32),
      y: Math.round(designHeight * 0.6),
      width: Math.round(designWidth * 0.36),
      height: Math.round(designHeight * 0.1),
      opacity: 1,
      zIndex: 50,
    };
    patchDraft({ layers: [...(draft.layers || []), layer] });
    setSelectedLayerId(layer.id);
  };

  const deleteSelectedLayer = () => {
    if (!selectedLayer) return;
    const layers = (draft.layers || []).filter(layer => layer.id !== selectedLayer.id);
    replaceLayers(layers);
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
      x: Math.round(clamp(drag.x + pointer.x - drag.pointerX, -layer.width * 0.9, designWidth - layer.width * 0.1)),
      y: Math.round(clamp(drag.y + pointer.y - drag.pointerY, -layer.height * 0.9, designHeight - layer.height * 0.1)),
    });
    event.preventDefault();
  };

  const finishLayerDrag = () => {
    dragRef.current = null;
  };

  const handleNumberInput = (key: "saveSlots" | "musicVolume" | "sfxVolume") => (event: ChangeEvent<HTMLInputElement>) => {
    patchDraft({ [key]: Number(event.target.value) } as Partial<GameStartUiSettings>);
  };

  return (
    <div className="scene-start-ui-page">
      <aside className="scene-start-ui-layer-rail">
        <div className="scene-start-ui-page-title">
          <strong><Monitor size={16} /> {draft.title || "Start UI"}</strong>
          <span>{selectedStartScene ? selectedStartScene.name : "No entry scene"}</span>
        </div>

        <div className="scene-start-ui-upload-grid">
          <label className="scene-start-ui-file-button">
            <Upload size={14} /> Whole UI
            <input type="file" accept={IMAGE_ACCEPT} onChange={handleWholeUiUpload} />
          </label>
          <label className="scene-start-ui-file-button">
            <ImagePlus size={14} /> Background
            <input type="file" accept={IMAGE_ACCEPT} onChange={handleBackgroundUpload} />
          </label>
          <label className="scene-start-ui-file-button">
            <ImagePlus size={14} /> Logo
            <input type="file" accept={IMAGE_ACCEPT} onChange={handleLayerUpload("title")} />
          </label>
          <label className="scene-start-ui-file-button">
            <ImagePlus size={14} /> Button
            <input type="file" accept={IMAGE_ACCEPT} onChange={handleLayerUpload("menu")} />
          </label>
        </div>

        <div className="scene-start-ui-action-stack">
          <button type="button" className="ghost-button" onClick={() => void autoSplitCurrentArtwork()} disabled={isProcessingArtwork}>
            <Layers size={14} /> Auto Split
          </button>
          <button type="button" className="ghost-button" onClick={() => void autoLayoutFromBackground()} disabled={isProcessingArtwork}>
            <Monitor size={14} /> Auto Layout
          </button>
          <button type="button" className="ghost-button" onClick={addTextButtonLayer}>
            <Plus size={14} /> Text Button
          </button>
        </div>

        <div className="scene-start-ui-layer-list canvas-list">
          {orderedLayers.map(layer => (
            <button
              key={layer.id}
              type="button"
              className={`scene-start-ui-layer-row ${selectedLayerId === layer.id ? "selected" : ""}`}
              onClick={() => setSelectedLayerId(layer.id)}
            >
              {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
              <span>{layer.name}</span>
              {layer.locked && <Lock size={12} />}
            </button>
          ))}
        </div>
      </aside>

      <section className="scene-start-ui-workbench">
        <div className="scene-start-ui-canvas-toolbar">
          <div>
            <strong>Start UI</strong>
            <span>{Math.round(designWidth)} x {Math.round(designHeight)}</span>
          </div>
          <button type="button" className="primary-button" onClick={() => void onSave(draft)} disabled={isSaving || isProcessingArtwork}>
            <Save size={15} /> {isSaving ? "Saving" : "Save Start UI"}
          </button>
        </div>

        <div className={`scene-start-ui-canvas-shell ${draft.theme}`}>
          <div
            ref={stageRef}
            className="scene-start-ui-design-stage"
            style={{ aspectRatio: `${designWidth} / ${designHeight}`, maxWidth: `${designWidth}px` }}
            onPointerMoveCapture={updateLayerDrag}
            onPointerUpCapture={finishLayerDrag}
            onPointerCancelCapture={finishLayerDrag}
          >
            {visibleLayers.map(layer => (
              <div
                key={layer.id}
                className={`scene-start-ui-canvas-layer ${layer.kind} ${selectedLayerId === layer.id ? "selected" : ""} ${layer.locked ? "locked" : ""} ${layer.sourceWidth ? "cropped" : ""}`}
                style={{
                  ...layerStyle(layer, designWidth, designHeight),
                  ...(layer.sourceWidth ? layerCropStyle(layer, designWidth, designHeight) : {}),
                }}
                onPointerDown={event => startLayerDrag(event, layer)}
              >
                {renderLayerArtwork(layer)}
              </div>
            ))}
          </div>
        </div>
        {uiError && <div className="scene-start-ui-inline-error">{uiError}</div>}
      </section>

      <aside className="scene-start-ui-inspector">
        <div className="scene-start-ui-section">
          <strong>Screen</strong>
          <label>
            Title
            <input value={draft.title} onChange={event => patchDraft({ title: event.target.value })} />
          </label>
          <label>
            Subtitle
            <input value={draft.subtitle} onChange={event => patchDraft({ subtitle: event.target.value })} />
          </label>
          <label>
            Theme
            <select value={draft.theme} onChange={event => patchDraft({ theme: event.target.value as StartUiTheme })}>
              {THEME_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Start Scene
            <select value={draft.initialSceneId || ""} onChange={event => patchDraft({ initialSceneId: event.target.value })}>
              {scenes.map(scene => <option key={scene.id} value={scene.id}>{scene.name}</option>)}
            </select>
          </label>
          <div className="scene-start-ui-layer-grid two">
            <label>
              Width
              <input type="number" min="320" value={Math.round(designWidth)} onChange={event => patchDraft({ designWidth: Number(event.target.value) })} />
            </label>
            <label>
              Height
              <input type="number" min="180" value={Math.round(designHeight)} onChange={event => patchDraft({ designHeight: Number(event.target.value) })} />
            </label>
          </div>
          <label>
            Background URL
            <input value={draft.backgroundImageUrl || ""} onChange={event => patchDraft({ backgroundImageUrl: event.target.value })} placeholder="/generated/start_screen.png" />
          </label>
        </div>

        {selectedLayer && (
          <div className="scene-start-ui-section">
            <strong><Layers size={14} /> Layer</strong>
            <label>
              Name
              <input value={selectedLayer.name} onChange={event => patchLayer(selectedLayer.id, { name: event.target.value })} />
            </label>
            <label>
              Kind
              <select value={selectedLayer.kind} onChange={event => patchLayer(selectedLayer.id, { kind: event.target.value as StartUiLayerKind })}>
                {LAYER_KIND_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              Label
              <input value={selectedLayer.label || ""} onChange={event => patchLayer(selectedLayer.id, { label: event.target.value })} />
            </label>
            <label>
              Image URL
              <input value={selectedLayer.imageUrl || ""} onChange={event => patchLayer(selectedLayer.id, { imageUrl: event.target.value })} />
            </label>
            <div className="scene-start-ui-layer-grid four">
              <label>
                X
                <input type="number" value={selectedLayer.x} onChange={event => patchLayer(selectedLayer.id, { x: Number(event.target.value) })} />
              </label>
              <label>
                Y
                <input type="number" value={selectedLayer.y} onChange={event => patchLayer(selectedLayer.id, { y: Number(event.target.value) })} />
              </label>
              <label>
                W
                <input type="number" min="1" value={selectedLayer.width} onChange={event => patchLayer(selectedLayer.id, { width: Number(event.target.value) })} />
              </label>
              <label>
                H
                <input type="number" min="1" value={selectedLayer.height} onChange={event => patchLayer(selectedLayer.id, { height: Number(event.target.value) })} />
              </label>
            </div>
            <div className="scene-start-ui-layer-grid two">
              <label>
                Z
                <input type="number" value={selectedLayer.zIndex} onChange={event => patchLayer(selectedLayer.id, { zIndex: Number(event.target.value) })} />
              </label>
              <label>
                Opacity <span>{Math.round(selectedLayer.opacity * 100)}%</span>
                <input type="range" min="0" max="1" step="0.01" value={selectedLayer.opacity} onChange={event => patchLayer(selectedLayer.id, { opacity: Number(event.target.value) })} />
              </label>
            </div>
            <label className="scene-start-ui-toggle">
              <input type="checkbox" checked={selectedLayer.visible} onChange={event => patchLayer(selectedLayer.id, { visible: event.target.checked })} />
              Visible
            </label>
            <label className="scene-start-ui-toggle">
              <input type="checkbox" checked={Boolean(selectedLayer.locked)} onChange={event => patchLayer(selectedLayer.id, { locked: event.target.checked })} />
              Locked
            </label>
            {selectedLayer.sourceWidth && (
              <button type="button" className="ghost-button" onClick={() => patchLayer(selectedLayer.id, { sourceX: undefined, sourceY: undefined, sourceWidth: undefined, sourceHeight: undefined })}>
                Use Full Image
              </button>
            )}
            <button type="button" className="ghost-button danger" onClick={deleteSelectedLayer}>
              <Trash2 size={14} /> Delete Layer
            </button>
          </div>
        )}

        <div className="scene-start-ui-section">
          <strong>Menu</strong>
          <label>
            New Game Label
            <input value={draft.primaryActionLabel} onChange={event => patchDraft({ primaryActionLabel: event.target.value })} />
          </label>
          <label>
            Continue Label
            <input value={draft.continueActionLabel} onChange={event => patchDraft({ continueActionLabel: event.target.value })} />
          </label>
          <label>
            Load Label
            <input value={draft.loadActionLabel} onChange={event => patchDraft({ loadActionLabel: event.target.value })} />
          </label>
          <label>
            Settings Label
            <input value={draft.settingsActionLabel} onChange={event => patchDraft({ settingsActionLabel: event.target.value })} />
          </label>
          <label>
            Quit Label
            <input value={draft.quitActionLabel} onChange={event => patchDraft({ quitActionLabel: event.target.value })} />
          </label>
        </div>

        <div className="scene-start-ui-section compact">
          <strong><Settings size={14} /> Settings</strong>
          <label className="scene-start-ui-toggle enabled">
            <input type="checkbox" checked={draft.enabled} onChange={event => patchDraft({ enabled: event.target.checked })} />
            Start UI Enabled
          </label>
          <label>
            Save Slots
            <input type="number" min="1" max="12" value={draft.saveSlots} onChange={handleNumberInput("saveSlots")} />
          </label>
          <label>
            Music <span>{draft.musicVolume}</span>
            <input type="range" min="0" max="100" value={draft.musicVolume} onChange={handleNumberInput("musicVolume")} />
          </label>
          <label>
            SFX <span>{draft.sfxVolume}</span>
            <input type="range" min="0" max="100" value={draft.sfxVolume} onChange={handleNumberInput("sfxVolume")} />
          </label>
          <label className="scene-start-ui-toggle">
            <input type="checkbox" checked={draft.autosave} onChange={event => patchDraft({ autosave: event.target.checked })} />
            Autosave {toggleLabel(draft.autosave)}
          </label>
          <label className="scene-start-ui-toggle">
            <input type="checkbox" checked={draft.confirmNewGame} onChange={event => patchDraft({ confirmNewGame: event.target.checked })} />
            Confirm New Game
          </label>
          <label className="scene-start-ui-toggle">
            <input type="checkbox" checked={draft.showContinue} onChange={event => patchDraft({ showContinue: event.target.checked })} />
            Show Continue
          </label>
          <label className="scene-start-ui-toggle">
            <input type="checkbox" checked={draft.showLoadGame} onChange={event => patchDraft({ showLoadGame: event.target.checked })} />
            Show Load Game
          </label>
          <label className="scene-start-ui-toggle">
            <input type="checkbox" checked={draft.showSettings} onChange={event => patchDraft({ showSettings: event.target.checked })} />
            Show Settings
          </label>
          <label className="scene-start-ui-toggle">
            <input type="checkbox" checked={draft.fullscreenToggle} onChange={event => patchDraft({ fullscreenToggle: event.target.checked })} />
            Fullscreen Toggle
          </label>
          <label className="scene-start-ui-toggle">
            <input type="checkbox" checked={draft.languageSelector} onChange={event => patchDraft({ languageSelector: event.target.checked })} />
            Language Selector
          </label>
          <label className="scene-start-ui-toggle">
            <input type="checkbox" checked={draft.showQuit} onChange={event => patchDraft({ showQuit: event.target.checked })} />
            Show Quit
          </label>
        </div>
      </aside>
    </div>
  );
}
