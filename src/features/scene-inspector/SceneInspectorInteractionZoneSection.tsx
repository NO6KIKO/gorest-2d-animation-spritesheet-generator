import { interactionZoneLabel, isAudioZoneInteraction, isCameraZoneInteraction, isDialogueZoneInteraction, isLightZoneInteraction, isPhysicsZoneInteraction } from "../../domain/scene/sceneModel";
import type { GameAsset, InteractionCameraMode, InteractionPhysicsMode, InteractionZoneShape, LayerInteractionSettings, SceneLayer } from "../../types";

type LayerBounds = {
  width: number;
  height: number;
};

type SceneInspectorInteractionZoneSectionProps = {
  getLayerWorldBounds: (layer: SceneLayer, asset?: GameAsset) => LayerBounds;
  selectedInteractionZoneAsset?: GameAsset;
  selectedInteractionZoneLayer: SceneLayer;
  selectedInteractionZoneSettings: LayerInteractionSettings;
  onUpdateInteraction: (layerId: string, patch: Partial<LayerInteractionSettings>) => void;
};

export function SceneInspectorInteractionZoneSection({
  getLayerWorldBounds,
  selectedInteractionZoneAsset,
  selectedInteractionZoneLayer,
  selectedInteractionZoneSettings,
  onUpdateInteraction,
}: SceneInspectorInteractionZoneSectionProps) {
  const bounds = getLayerWorldBounds(selectedInteractionZoneLayer, selectedInteractionZoneAsset);
  const isLightZone = isLightZoneInteraction(selectedInteractionZoneSettings);
  const isAudioZone = isAudioZoneInteraction(selectedInteractionZoneSettings);
  const isCameraZone = isCameraZoneInteraction(selectedInteractionZoneSettings);
  const isDialogueZone = isDialogueZoneInteraction(selectedInteractionZoneSettings);
  const isPhysicsZone = isPhysicsZoneInteraction(selectedInteractionZoneSettings);
  const cameraMode = selectedInteractionZoneSettings.cameraMode || "room-lock";

  return (
    <div className="compact-inspector-section interaction-zone-inspector">
      <em>{interactionZoneLabel(selectedInteractionZoneSettings)}</em>
      <label>Zone Shape</label>
      <select
        value={selectedInteractionZoneSettings.zoneShape || "rect"}
        onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { zoneShape: event.target.value as InteractionZoneShape })}
        disabled={selectedInteractionZoneLayer.locked}
      >
        <option value="rect">Box / Rect</option>
        <option value="circle">Circle / Ellipse</option>
        <option value="polygon">Polygon</option>
        <option value="brush">Brush Circle</option>
      </select>
      {isLightZone && (
        <>
          <label>Light Color</label>
          <input
            type="color"
            value={selectedInteractionZoneSettings.lightColor || "#f4d38a"}
            onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { lightColor: event.target.value })}
            disabled={selectedInteractionZoneLayer.locked}
          />
          <label>Intensity {(selectedInteractionZoneSettings.lightIntensity ?? 0.65).toFixed(2)}</label>
          <input
            type="range"
            min="0"
            max="1.4"
            step="0.01"
            value={selectedInteractionZoneSettings.lightIntensity ?? 0.65}
            onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { lightIntensity: Number(event.target.value) })}
            disabled={selectedInteractionZoneLayer.locked}
          />
          <label>Falloff {(selectedInteractionZoneSettings.lightFalloff ?? 0.75).toFixed(2)}</label>
          <input
            type="range"
            min="0.35"
            max="0.95"
            step="0.01"
            value={selectedInteractionZoneSettings.lightFalloff ?? 0.75}
            onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { lightFalloff: Number(event.target.value) })}
            disabled={selectedInteractionZoneLayer.locked}
          />
        </>
      )}
      {isAudioZone && (
        <>
          <label>Audio Label</label>
          <input
            value={selectedInteractionZoneSettings.audioLabel || ""}
            onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { audioLabel: event.target.value })}
            disabled={selectedInteractionZoneLayer.locked}
          />
          <label>Audio URL</label>
          <input
            value={selectedInteractionZoneSettings.audioUrl || ""}
            onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { audioUrl: event.target.value })}
            disabled={selectedInteractionZoneLayer.locked}
          />
          <label>Volume {(selectedInteractionZoneSettings.audioVolume ?? 0.7).toFixed(2)}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={selectedInteractionZoneSettings.audioVolume ?? 0.7}
            onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { audioVolume: Number(event.target.value) })}
            disabled={selectedInteractionZoneLayer.locked}
          />
        </>
      )}
      {isCameraZone && (
        <>
          <label>Camera Mode</label>
          <select
            value={cameraMode}
            onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { cameraMode: event.target.value as InteractionCameraMode })}
            disabled={selectedInteractionZoneLayer.locked}
          >
            <option value="room-lock">Room Lock</option>
            <option value="focus">Focus</option>
            <option value="pan">Pan</option>
            <option value="zoom">Zoom</option>
            <option value="shake">Shake</option>
            <option value="return-player">Return To Player</option>
          </select>
          <label>Camera Target X</label>
          <input
            type="number"
            value={Math.round(selectedInteractionZoneSettings.cameraTargetX ?? selectedInteractionZoneLayer.x)}
            onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { cameraTargetX: Number(event.target.value) })}
            disabled={selectedInteractionZoneLayer.locked}
          />
          <label>Camera Target Y</label>
          <input
            type="number"
            value={Math.round(selectedInteractionZoneSettings.cameraTargetY ?? selectedInteractionZoneLayer.y)}
            onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { cameraTargetY: Number(event.target.value) })}
            disabled={selectedInteractionZoneLayer.locked}
          />
          <label>Camera Duration {selectedInteractionZoneSettings.cameraDurationMs || 450}ms</label>
          <input
            type="range"
            min="0"
            max="2000"
            step="50"
            value={selectedInteractionZoneSettings.cameraDurationMs || 450}
            onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { cameraDurationMs: Number(event.target.value) })}
            disabled={selectedInteractionZoneLayer.locked}
          />
          {cameraMode === "zoom" && (
            <>
              <label>Zoom Scale {(selectedInteractionZoneSettings.cameraZoom ?? 1.12).toFixed(2)}</label>
              <input
                type="range"
                min="1"
                max="1.6"
                step="0.01"
                value={selectedInteractionZoneSettings.cameraZoom ?? 1.12}
                onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { cameraZoom: Number(event.target.value) })}
                disabled={selectedInteractionZoneLayer.locked}
              />
            </>
          )}
          {cameraMode === "shake" && (
            <>
              <label>Shake Intensity {selectedInteractionZoneSettings.cameraShakeIntensity ?? 8}px</label>
              <input
                type="range"
                min="1"
                max="28"
                step="1"
                value={selectedInteractionZoneSettings.cameraShakeIntensity ?? 8}
                onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { cameraShakeIntensity: Number(event.target.value) })}
                disabled={selectedInteractionZoneLayer.locked}
              />
            </>
          )}
        </>
      )}
      {isDialogueZone && (
        <>
          <label>Speaker</label>
          <input
            value={selectedInteractionZoneSettings.dialogueSpeaker || ""}
            onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { dialogueSpeaker: event.target.value })}
            disabled={selectedInteractionZoneLayer.locked}
          />
          <label>Continue Key</label>
          <input
            value={selectedInteractionZoneSettings.promptKey || "KeyE"}
            onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { promptKey: event.target.value })}
            disabled={selectedInteractionZoneLayer.locked}
          />
          <label>Dialogue Lines</label>
          <textarea
            rows={5}
            value={selectedInteractionZoneSettings.dialogueText || selectedInteractionZoneSettings.subtitle || ""}
            onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { dialogueText: event.target.value })}
            disabled={selectedInteractionZoneLayer.locked}
          />
        </>
      )}
      {isPhysicsZone && (
        <>
          <label>Physics Mode</label>
          <select
            value={selectedInteractionZoneSettings.physicsMode || "solid"}
            onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { physicsMode: event.target.value as InteractionPhysicsMode })}
            disabled={selectedInteractionZoneLayer.locked}
          >
            <option value="solid">Solid Block</option>
            <option value="slow">Slow Area</option>
            <option value="pull">Auto Pull</option>
          </select>
          <label>Strength {(selectedInteractionZoneSettings.physicsStrength ?? 1).toFixed(2)}</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={selectedInteractionZoneSettings.physicsStrength ?? 1}
            onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { physicsStrength: Number(event.target.value) })}
            disabled={selectedInteractionZoneLayer.locked}
          />
          <label>Friction {(selectedInteractionZoneSettings.physicsFriction ?? 0.55).toFixed(2)}</label>
          <input
            type="range"
            min="0.1"
            max="0.95"
            step="0.05"
            value={selectedInteractionZoneSettings.physicsFriction ?? 0.55}
            onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { physicsFriction: Number(event.target.value) })}
            disabled={selectedInteractionZoneLayer.locked}
          />
        </>
      )}
      <label>Zone X {selectedInteractionZoneSettings.zoneOffsetX || 0}px</label>
      <input
        type="range"
        min="-520"
        max="520"
        step="1"
        value={selectedInteractionZoneSettings.zoneOffsetX || 0}
        onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { zoneOffsetX: Number(event.target.value) })}
        disabled={selectedInteractionZoneLayer.locked}
      />
      <label>Zone Y {selectedInteractionZoneSettings.zoneOffsetY || 0}px</label>
      <input
        type="range"
        min="-360"
        max="360"
        step="1"
        value={selectedInteractionZoneSettings.zoneOffsetY || 0}
        onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { zoneOffsetY: Number(event.target.value) })}
        disabled={selectedInteractionZoneLayer.locked}
      />
      <div className="compact-dual-fields">
        <label>
          Width
          <input
            type="number"
            min="24"
            value={Math.round(selectedInteractionZoneSettings.zoneWidth || bounds.width || 160)}
            onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { zoneWidth: Number(event.target.value) })}
            disabled={selectedInteractionZoneLayer.locked}
          />
        </label>
        <label>
          Height
          <input
            type="number"
            min="24"
            value={Math.round(selectedInteractionZoneSettings.zoneHeight || bounds.height || 120)}
            onChange={event => onUpdateInteraction(selectedInteractionZoneLayer.id, { zoneHeight: Number(event.target.value) })}
            disabled={selectedInteractionZoneLayer.locked}
          />
        </label>
      </div>
      <span>Drag the zone directly on the scene to place it independently.</span>
    </div>
  );
}
