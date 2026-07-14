import { Eye } from "lucide-react";
import { isAudioZoneInteraction, isCameraZoneInteraction, isDialogueZoneInteraction, isLightZoneInteraction, isPhysicsZoneInteraction } from "../../domain/scene/sceneModel";
import type {
  GameAsset,
  InteractionCameraMode,
  InteractionPreset,
  InteractionLightBlendMode,
  InteractionPhysicsMode,
  InteractionPromptStyle,
  InteractionZoneShape,
  LayerInteractionSettings,
  SceneLayer,
} from "../../types";

type InteractionPresetOption = {
  label: string;
};

type LayerInteractionControlsProps = {
  interaction?: LayerInteractionSettings;
  interactionPresets: Record<string, InteractionPresetOption>;
  sceneState: Record<string, unknown>;
  scenes: Array<{ id: string; name: string }>;
  selectedLayer: SceneLayer;
  selectedLayerAsset?: GameAsset;
  visualLayers: SceneLayer[];
  getLayerWorldBounds: (layer: SceneLayer, asset?: GameAsset) => { width: number; height: number };
  onApplyPreset: (preset: InteractionPreset) => void;
  onUpdateInteraction: (patch: Partial<LayerInteractionSettings>) => void;
};

export function LayerInteractionControls({
  interaction,
  interactionPresets,
  sceneState,
  scenes,
  selectedLayer,
  selectedLayerAsset,
  visualLayers,
  getLayerWorldBounds,
  onApplyPreset,
  onUpdateInteraction,
}: LayerInteractionControlsProps) {
  const isLightZone = isLightZoneInteraction(interaction);
  const isAudioZone = isAudioZoneInteraction(interaction);
  const isCameraZone = isCameraZoneInteraction(interaction);
  const isDialogueZone = isDialogueZoneInteraction(interaction);
  const isPhysicsZone = isPhysicsZoneInteraction(interaction);
  const cameraMode = interaction?.cameraMode || "room-lock";

  return (
    <div className="interaction-controls">
      <div className="section-title compact"><Eye size={15} /> Interaction Preset</div>
      <div className="preset-grid">
        {Object.entries(interactionPresets).map(([preset, config]) => (
          <button
            key={preset}
            type="button"
            className={interaction?.preset === preset ? "active" : ""}
            onClick={() => onApplyPreset(preset as InteractionPreset)}
          >
            {config.label}
          </button>
        ))}
      </div>
      {!interaction ? (
        <div className="control-hint">Choose a preset to turn this layer into an interactable object with its own editable trigger zone.</div>
      ) : (
        <>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={interaction.enabled}
              onChange={event => onUpdateInteraction({ enabled: event.target.checked })}
            />
            Enable interaction
          </label>
          <div className="two-col">
            <div>
              <label>Trigger Mode</label>
              <select value={interaction.triggerMode || "near-click"} onChange={event => onUpdateInteraction({ triggerMode: event.target.value as LayerInteractionSettings["triggerMode"] })}>
                <option value="near-click">Near + Click Eye</option>
                <option value="near-key">Near + Key</option>
                <option value="auto">Always Active</option>
                <option value="inventory">Inventory State</option>
                <option value="state">Scene State</option>
              </select>
            </div>
            <div>
              <label>Action Type</label>
              <select value={interaction.actionType || "subtitle"} onChange={event => onUpdateInteraction({ actionType: event.target.value as LayerInteractionSettings["actionType"] })}>
                <option value="subtitle">Show Subtitle</option>
                <option value="play-animation">Play Animation</option>
                <option value="toggle-layer">Toggle Layer</option>
                <option value="pickup-item">Pickup Item</option>
                <option value="scene-link">Door / Scene Link</option>
                <option value="set-state">Set State</option>
                <option value="light-zone">Light Zone</option>
                <option value="play-audio">Play Audio</option>
                <option value="camera-focus">Camera Zone</option>
                <option value="dialogue">Dialogue</option>
                <option value="physics-zone">Physics Zone</option>
              </select>
            </div>
          </div>
          {isLightZone && (
            <>
              <div className="section-title compact">Light Zone</div>
              <div className="two-col">
                <div>
                  <label>Light Color</label>
                  <input type="color" value={interaction.lightColor || "#f4d38a"} onChange={event => onUpdateInteraction({ lightColor: event.target.value })} />
                </div>
                <div>
                  <label>Zone Shape</label>
                  <select value={interaction.zoneShape || "circle"} onChange={event => onUpdateInteraction({ zoneShape: event.target.value as InteractionZoneShape })}>
                    <option value="circle">Circle / Ellipse</option>
                    <option value="rect">Soft Rect</option>
                  </select>
                </div>
              </div>
              <label>Light Intensity {(interaction.lightIntensity ?? 0.65).toFixed(2)}</label>
              <input type="range" min="0" max="1.4" step="0.01" value={interaction.lightIntensity ?? 0.65} onChange={event => onUpdateInteraction({ lightIntensity: Number(event.target.value) })} />
              <label>Light Falloff {(interaction.lightFalloff ?? 0.75).toFixed(2)}</label>
              <input type="range" min="0.35" max="0.95" step="0.01" value={interaction.lightFalloff ?? 0.75} onChange={event => onUpdateInteraction({ lightFalloff: Number(event.target.value) })} />
              <div className="two-col">
                <div>
                  <label>Blend Mode</label>
                  <select value={interaction.lightBlendMode || "screen"} onChange={event => onUpdateInteraction({ lightBlendMode: event.target.value as InteractionLightBlendMode })}>
                    <option value="screen">Screen</option>
                    <option value="plus-lighter">Plus Lighter</option>
                    <option value="normal">Normal</option>
                  </select>
                </div>
                <div>
                  <label>Attach To Layer</label>
                  <select value={interaction.lightAttachToLayerId || ""} onChange={event => onUpdateInteraction({ lightAttachToLayerId: event.target.value || undefined })}>
                    <option value="">Zone position</option>
                    {visualLayers.map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <label>Flicker {(interaction.lightFlicker || 0).toFixed(2)}</label>
              <input type="range" min="0" max="1" step="0.01" value={interaction.lightFlicker || 0} onChange={event => onUpdateInteraction({ lightFlicker: Number(event.target.value) })} />
            </>
          )}
          {isAudioZone && (
            <>
              <div className="section-title compact">Audio Zone</div>
              <label>Audio Label</label>
              <input value={interaction.audioLabel || ""} onChange={event => onUpdateInteraction({ audioLabel: event.target.value })} placeholder="Hallway hum" />
              <label>Audio URL</label>
              <input value={interaction.audioUrl || ""} onChange={event => onUpdateInteraction({ audioUrl: event.target.value })} placeholder="/generated/audio/hallway-hum.mp3" />
              <label>Volume {(interaction.audioVolume ?? 0.7).toFixed(2)}</label>
              <input type="range" min="0" max="1" step="0.01" value={interaction.audioVolume ?? 0.7} onChange={event => onUpdateInteraction({ audioVolume: Number(event.target.value) })} />
              <label className="checkbox-row">
                <input type="checkbox" checked={Boolean(interaction.audioLoop)} onChange={event => onUpdateInteraction({ audioLoop: event.target.checked })} />
                Loop audio
              </label>
            </>
          )}
          {isCameraZone && (
            <>
              <div className="section-title compact">Camera Zone</div>
              <label>Camera Mode</label>
              <select value={cameraMode} onChange={event => onUpdateInteraction({ cameraMode: event.target.value as InteractionCameraMode })}>
                <option value="room-lock">Room Lock</option>
                <option value="focus">Focus</option>
                <option value="pan">Pan</option>
                <option value="zoom">Zoom</option>
                <option value="shake">Shake</option>
                <option value="return-player">Return To Player</option>
              </select>
              <div className="two-col">
                <div>
                  <label>Target Camera X</label>
                  <input type="number" value={Math.round(interaction.cameraTargetX ?? selectedLayer.x)} onChange={event => onUpdateInteraction({ cameraTargetX: Number(event.target.value) })} />
                </div>
                <div>
                  <label>Target Camera Y</label>
                  <input type="number" value={Math.round(interaction.cameraTargetY ?? selectedLayer.y)} onChange={event => onUpdateInteraction({ cameraTargetY: Number(event.target.value) })} />
                </div>
              </div>
              <div className="two-col">
                <div>
                  <label>Duration MS</label>
                  <input type="number" min="0" step="50" value={interaction.cameraDurationMs || 450} onChange={event => onUpdateInteraction({ cameraDurationMs: Number(event.target.value) })} />
                </div>
              </div>
              {cameraMode === "zoom" && (
                <>
                  <label>Zoom Scale {(interaction.cameraZoom ?? 1.12).toFixed(2)}</label>
                  <input type="range" min="1" max="1.6" step="0.01" value={interaction.cameraZoom ?? 1.12} onChange={event => onUpdateInteraction({ cameraZoom: Number(event.target.value) })} />
                </>
              )}
              {cameraMode === "shake" && (
                <>
                  <label>Shake Intensity {interaction.cameraShakeIntensity ?? 8}px</label>
                  <input type="range" min="1" max="28" step="1" value={interaction.cameraShakeIntensity ?? 8} onChange={event => onUpdateInteraction({ cameraShakeIntensity: Number(event.target.value) })} />
                </>
              )}
            </>
          )}
          {isDialogueZone && (
            <>
              <div className="section-title compact">Dialogue Zone</div>
              <div className="two-col">
                <div>
                  <label>Speaker</label>
                  <input value={interaction.dialogueSpeaker || ""} onChange={event => onUpdateInteraction({ dialogueSpeaker: event.target.value })} placeholder="Unknown" />
                </div>
                <div>
                  <label>Continue Key</label>
                  <input value={interaction.promptKey || "KeyE"} onChange={event => onUpdateInteraction({ promptKey: event.target.value })} placeholder="KeyE" />
                </div>
              </div>
              <label>Dialogue Lines</label>
              <textarea
                rows={5}
                value={interaction.dialogueText || interaction.subtitle || ""}
                onChange={event => onUpdateInteraction({ dialogueText: event.target.value })}
                placeholder={"Who are you?\nWhy is this classroom connected to the ward?"}
              />
              <label>Portrait URL</label>
              <input value={interaction.dialoguePortraitUrl || ""} onChange={event => onUpdateInteraction({ dialoguePortraitUrl: event.target.value })} placeholder="/generated/portrait.png" />
            </>
          )}
          {isPhysicsZone && (
            <>
              <div className="section-title compact">Physics Zone</div>
              <div className="two-col">
                <div>
                  <label>Physics Mode</label>
                  <select value={interaction.physicsMode || "solid"} onChange={event => onUpdateInteraction({ physicsMode: event.target.value as InteractionPhysicsMode })}>
                    <option value="solid">Solid Block</option>
                    <option value="slow">Slow Area</option>
                    <option value="pull">Auto Pull</option>
                  </select>
                </div>
                <div>
                  <label>Zone Shape</label>
                  <select value={interaction.zoneShape || "rect"} onChange={event => onUpdateInteraction({ zoneShape: event.target.value as InteractionZoneShape })}>
                    <option value="rect">Box / Rect</option>
                    <option value="circle">Circle / Ellipse</option>
                    <option value="polygon">Polygon</option>
                    <option value="brush">Brush Circle</option>
                  </select>
                </div>
              </div>
              <label>Physics Strength {(interaction.physicsStrength ?? 1).toFixed(2)}</label>
              <input type="range" min="0" max="2" step="0.05" value={interaction.physicsStrength ?? 1} onChange={event => onUpdateInteraction({ physicsStrength: Number(event.target.value) })} />
              <label>Friction {(interaction.physicsFriction ?? 0.55).toFixed(2)}</label>
              <input type="range" min="0.1" max="0.95" step="0.05" value={interaction.physicsFriction ?? 0.55} onChange={event => onUpdateInteraction({ physicsFriction: Number(event.target.value) })} />
            </>
          )}
          <div className="two-col">
            <div>
              <label>Prompt Key</label>
              <input value={interaction.promptKey} onChange={event => onUpdateInteraction({ promptKey: event.target.value })} placeholder="KeyE" />
            </div>
            <div>
              <label>Prompt Style</label>
              <select value={interaction.promptStyle} onChange={event => onUpdateInteraction({ promptStyle: event.target.value as InteractionPromptStyle })}>
                <option value="horror">Horror Eye</option>
                <option value="minimal">Minimal</option>
                <option value="caption">Caption</option>
              </select>
            </div>
          </div>
          <label>Prompt Text</label>
          <input value={interaction.promptText} onChange={event => onUpdateInteraction({ promptText: event.target.value })} />
          <label>Subtitle Text</label>
          <textarea rows={2} value={interaction.subtitle || ""} onChange={event => onUpdateInteraction({ subtitle: event.target.value })} />
          <label>Failed Condition Subtitle</label>
          <textarea rows={2} value={interaction.failSubtitle || ""} onChange={event => onUpdateInteraction({ failSubtitle: event.target.value })} />
          <div className="two-col">
            <div>
              <label>Target Layer</label>
              <select value={interaction.targetLayerId || ""} onChange={event => onUpdateInteraction({ targetLayerId: event.target.value || undefined })}>
                <option value="">This layer</option>
                {visualLayers.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Target Scene</label>
              <select value={interaction.targetSceneId || ""} onChange={event => onUpdateInteraction({ targetSceneId: event.target.value || undefined })}>
                <option value="">None</option>
                {scenes.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
          </div>
          {selectedLayerAsset?.animations?.length ? (
            <>
              <label>Target Animation</label>
              <select value={interaction.targetAnimationId || ""} onChange={event => onUpdateInteraction({ targetAnimationId: event.target.value || undefined })}>
                <option value="">Default animation</option>
                {selectedLayerAsset.animations.map(clip => (
                  <option key={clip.id} value={clip.id}>{clip.name}</option>
                ))}
              </select>
            </>
          ) : null}
          <div className="two-col">
            <div>
              <label>Condition Key</label>
              <input value={interaction.conditionStateKey || ""} onChange={event => onUpdateInteraction({ conditionStateKey: event.target.value })} placeholder="has_key" />
            </div>
            <div>
              <label>Condition Value</label>
              <input value={interaction.conditionStateValue || ""} onChange={event => onUpdateInteraction({ conditionStateValue: event.target.value })} placeholder="true" />
            </div>
          </div>
          <div className="two-col">
            <div>
              <label>Item ID</label>
              <input value={interaction.itemId || ""} onChange={event => onUpdateInteraction({ itemId: event.target.value })} placeholder="old_key" />
            </div>
            <div>
              <label>Set State</label>
              <input value={interaction.setStateKey || ""} onChange={event => onUpdateInteraction({ setStateKey: event.target.value })} placeholder="door_open" />
            </div>
          </div>
          <label>Set State Value</label>
          <input value={interaction.setStateValue || ""} onChange={event => onUpdateInteraction({ setStateValue: event.target.value })} placeholder="true / false / text / number" />
          <label className="checkbox-row">
            <input type="checkbox" checked={interaction.showText} onChange={event => onUpdateInteraction({ showText: event.target.checked })} />
            Show prompt text beside the eye
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={interaction.hotspotVisible !== false} onChange={event => onUpdateInteraction({ hotspotVisible: event.target.checked })} />
            Show hotspot marker layer
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={interaction.hideLayerOnPickup !== false} onChange={event => onUpdateInteraction({ hideLayerOnPickup: event.target.checked })} />
            Hide this layer after pickup
          </label>
          {!isPhysicsZone && !isLightZone && (
            <div className="two-col">
              <div>
                <label>Zone Shape</label>
                <select value={interaction.zoneShape || "rect"} onChange={event => onUpdateInteraction({ zoneShape: event.target.value as InteractionZoneShape })}>
                  <option value="rect">Box / Rect</option>
                  <option value="circle">Circle / Ellipse</option>
                  <option value="polygon">Polygon</option>
                  <option value="brush">Brush Circle</option>
                </select>
              </div>
            </div>
          )}
          <div className="two-col">
            <div>
              <label>Zone Width</label>
              <input type="number" min="24" value={Math.round(interaction.zoneWidth || getLayerWorldBounds(selectedLayer, selectedLayerAsset).width || 160)} onChange={event => onUpdateInteraction({ zoneWidth: Number(event.target.value) })} />
            </div>
            <div>
              <label>Zone Height</label>
              <input type="number" min="24" value={Math.round(interaction.zoneHeight || getLayerWorldBounds(selectedLayer, selectedLayerAsset).height || 120)} onChange={event => onUpdateInteraction({ zoneHeight: Number(event.target.value) })} />
            </div>
          </div>
          <div className="two-col">
            <div>
              <label>Zone X {interaction.zoneOffsetX || 0}px</label>
              <input type="range" min="-420" max="420" step="1" value={interaction.zoneOffsetX || 0} onChange={event => onUpdateInteraction({ zoneOffsetX: Number(event.target.value) })} />
            </div>
            <div>
              <label>Zone Y {interaction.zoneOffsetY || 0}px</label>
              <input type="range" min="-260" max="260" step="1" value={interaction.zoneOffsetY || 0} onChange={event => onUpdateInteraction({ zoneOffsetY: Number(event.target.value) })} />
            </div>
          </div>
          <label>Text Font Size {interaction.fontSize}px</label>
          <input type="range" min="8" max="24" step="1" value={interaction.fontSize} onChange={event => onUpdateInteraction({ fontSize: Number(event.target.value) })} />
          <label>Prompt Scale {interaction.promptScale.toFixed(2)}</label>
          <input type="range" min="0.45" max="1.45" step="0.01" value={interaction.promptScale} onChange={event => onUpdateInteraction({ promptScale: Number(event.target.value) })} />
          <label>Trigger Radius {interaction.triggerRadius}px</label>
          <input type="range" min="60" max="520" step="5" value={interaction.triggerRadius} onChange={event => onUpdateInteraction({ triggerRadius: Number(event.target.value) })} />
          <div className="two-col">
            <div>
              <label>Prompt X {interaction.offsetX}px</label>
              <input type="range" min="-220" max="220" step="1" value={interaction.offsetX} onChange={event => onUpdateInteraction({ offsetX: Number(event.target.value) })} />
            </div>
            <div>
              <label>Prompt Y {interaction.offsetY}px</label>
              <input type="range" min="-180" max="80" step="1" value={interaction.offsetY} onChange={event => onUpdateInteraction({ offsetY: Number(event.target.value) })} />
            </div>
          </div>
          <div className="state-preview">
            {Object.entries(sceneState || {}).map(([key, value]) => (
              <span key={key}>{key}: {String(value)}</span>
            ))}
          </div>
          <div className="control-hint">Interaction zones are independent from the image. Use them for clickable radios, doors, boxes, and hidden investigation areas.</div>
        </>
      )}
    </div>
  );
}
