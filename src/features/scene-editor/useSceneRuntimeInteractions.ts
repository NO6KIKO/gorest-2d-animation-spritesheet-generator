import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import { isEditingTextTarget } from "../../app/domEvents";
import { safeName } from "../../domain/assets/assetModel";
import { BOARDING_TRAIN_ASSET_ID } from "../../domain/scene-kit/sceneKitAssets";
import {
  interactionZoneBounds,
  interactionZoneContainsPoint,
  isCameraZoneInteraction,
  isPhysicsZoneInteraction,
  isSceneVisualLayer,
  layerInteractionSettings,
  layerWorldBounds,
  resolveAssetSprite,
  sceneViewportHeight,
  sceneViewportWidth,
  stateMatches,
  stateValueFromText,
} from "../../domain/scene/sceneModel";
import { getFrameSize } from "../../domain/sprites/spriteUtils";
import { clamp } from "../../shared/math";
import type { AnimationSprite, GameAsset, GameScene, LayerInteractionSettings, SceneLayer } from "../../types";
import type { SceneVehiclePhase } from "../scene-flow";
import type { SceneCameraVisualEffect } from "./SceneStageCanvas";
import type { SceneDialogueOverlayState, SceneInteractionPromptEntry } from "./SceneStageOverlays";

export type SceneHeldDirection = "left" | "right" | "up" | "down" | null;

type UseSceneRuntimeInteractionsOptions = {
  activeDialogue: SceneDialogueOverlayState | null;
  assetById: Map<string, GameAsset>;
  assets: GameAsset[];
  autoCameraInteraction: SceneInteractionPromptEntry | null;
  hasBoardingTrainLayer: boolean;
  heldDirection: SceneHeldDirection;
  interactionToast: string;
  loadSavedScene: (savedScene: GameScene) => void;
  nearbyInteraction: SceneInteractionPromptEntry | null;
  sceneStateRef: RefObject<GameScene>;
  scenes: GameScene[];
  vehiclePhase: SceneVehiclePhase;
  walkSpeed: number;
  setActiveDialogue: Dispatch<SetStateAction<SceneDialogueOverlayState | null>>;
  setActiveFrame: Dispatch<SetStateAction<number>>;
  setActiveSprite: Dispatch<SetStateAction<AnimationSprite>>;
  setCameraEffect: Dispatch<SetStateAction<SceneCameraVisualEffect | null>>;
  setHeldDirection: Dispatch<SetStateAction<SceneHeldDirection>>;
  setInteractionToast: Dispatch<SetStateAction<string>>;
  setIsBackpackOpen: Dispatch<SetStateAction<boolean>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setScene: Dispatch<SetStateAction<GameScene>>;
  setSelectedLayerId: Dispatch<SetStateAction<string>>;
  setVehiclePhase: Dispatch<SetStateAction<SceneVehiclePhase>>;
};

function interactionKeyMatches(event: KeyboardEvent, configuredKey = "KeyE") {
  const key = configuredKey.trim() || "KeyE";
  const normalizedCode = key.length === 1 ? `Key${key.toUpperCase()}` : key;
  return (
    event.code.toLowerCase() === normalizedCode.toLowerCase() ||
    event.key.toLowerCase() === key.toLowerCase()
  );
}

function dialogueLinesFromInteraction(interaction: LayerInteractionSettings, fallbackText: string) {
  const source = interaction.dialogueText || interaction.subtitle || fallbackText;
  const lines = source
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  return lines.length ? lines : [fallbackText || "There is nothing to say."];
}

export function useSceneRuntimeInteractions({
  activeDialogue,
  assetById,
  assets,
  autoCameraInteraction,
  hasBoardingTrainLayer,
  heldDirection,
  interactionToast,
  loadSavedScene,
  nearbyInteraction,
  sceneStateRef,
  scenes,
  vehiclePhase,
  walkSpeed,
  setActiveDialogue,
  setActiveFrame,
  setActiveSprite,
  setCameraEffect,
  setHeldDirection,
  setInteractionToast,
  setIsBackpackOpen,
  setIsPlaying,
  setNotice,
  setScene,
  setSelectedLayerId,
  setVehiclePhase,
}: UseSceneRuntimeInteractionsOptions) {
  const nearbyInteractionRef = useRef<SceneInteractionPromptEntry | null>(null);
  const activeDialogueRef = useRef<SceneDialogueOverlayState | null>(null);
  const triggerNearbyInteractionRef = useRef<(entry?: SceneInteractionPromptEntry | null) => void>(() => {});
  const cameraAnimationRef = useRef<number | null>(null);
  const cameraEffectTimerRef = useRef<number | null>(null);
  const activeAutoCameraZoneIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeDialogueRef.current = activeDialogue;
  }, [activeDialogue]);

  useEffect(() => {
    nearbyInteractionRef.current = nearbyInteraction;
  }, [nearbyInteraction]);

  useEffect(() => {
    if (!interactionToast) return;
    const id = window.setTimeout(() => setInteractionToast(""), 1800);
    return () => window.clearTimeout(id);
  }, [interactionToast, setInteractionToast]);

  const advanceDialogue = () => {
    setActiveDialogue(prev => {
      if (!prev) return null;
      if (prev.lineIndex < prev.lines.length - 1) {
        return { ...prev, lineIndex: prev.lineIndex + 1 };
      }
      setNotice("Dialogue closed.");
      return null;
    });
  };

  const playerCenterXForScene = (currentScene: GameScene) => {
    const playerLayer = currentScene.layers.find(layer => {
      if (!layer.visible || !layer.assetId || !isSceneVisualLayer(layer)) return false;
      return assetById.get(layer.assetId)?.role === "player";
    });
    if (!playerLayer) return undefined;
    return layerWorldBounds(playerLayer, assetById.get(playerLayer.assetId!)).centerX;
  };

  const playerCenterForScene = (currentScene: GameScene) => {
    const playerLayer = currentScene.layers.find(layer => {
      if (!layer.visible || !layer.assetId || !isSceneVisualLayer(layer)) return false;
      return assetById.get(layer.assetId)?.role === "player";
    });
    if (!playerLayer) return undefined;
    const bounds = layerWorldBounds(playerLayer, assetById.get(playerLayer.assetId!));
    return { x: bounds.centerX, y: bounds.centerY };
  };

  const cameraModeLabel = (mode: LayerInteractionSettings["cameraMode"] = "room-lock") => {
    if (mode === "room-lock") return "Room Lock";
    if (mode === "focus") return "Focus";
    if (mode === "pan") return "Pan";
    if (mode === "zoom") return "Zoom";
    if (mode === "shake") return "Shake";
    return "Return To Player";
  };

  const cameraXForInteraction = (
    entry: SceneInteractionPromptEntry,
    currentScene: GameScene,
    playerCenterX?: number
  ) => {
    const viewportW = sceneViewportWidth(currentScene);
    const maxCameraX = Math.max(0, currentScene.width - viewportW);
    const mode = entry.interaction.cameraMode || "room-lock";
    if (mode === "shake") return currentScene.cameraX;
    if (mode === "return-player") {
      const playerX = playerCenterX ?? playerCenterXForScene(currentScene);
      return clamp((playerX ?? entry.bounds.centerX) - viewportW * 0.42, 0, maxCameraX);
    }
    if (mode === "room-lock") {
      const roomMin = clamp(entry.bounds.left, 0, maxCameraX);
      const roomMax = clamp(entry.bounds.right - viewportW, 0, maxCameraX);
      if (entry.bounds.width > viewportW && roomMin <= roomMax) {
        const desired = (playerCenterX ?? entry.bounds.centerX) - viewportW * 0.5;
        return clamp(desired, roomMin, roomMax);
      }
      return clamp(entry.bounds.centerX - viewportW * 0.5, 0, maxCameraX);
    }
    const configuredX = typeof entry.interaction.cameraTargetX === "number" && Number.isFinite(entry.interaction.cameraTargetX)
      ? entry.interaction.cameraTargetX
      : undefined;
    return clamp(configuredX ?? entry.bounds.centerX - viewportW * 0.5, 0, maxCameraX);
  };

  const cameraYForInteraction = (
    entry: SceneInteractionPromptEntry,
    currentScene: GameScene,
    playerCenterY?: number
  ) => {
    const viewportH = sceneViewportHeight(currentScene);
    const maxCameraY = Math.max(0, currentScene.height - viewportH);
    const mode = entry.interaction.cameraMode || "room-lock";
    if (mode === "shake") return currentScene.cameraY || 0;
    if (mode === "return-player") {
      const playerCenter = playerCenterForScene(currentScene);
      return clamp((playerCenterY ?? playerCenter?.y ?? entry.bounds.centerY) - viewportH * 0.5, 0, maxCameraY);
    }
    if (mode === "room-lock") {
      const roomMin = clamp(entry.bounds.top, 0, maxCameraY);
      const roomMax = clamp(entry.bounds.bottom - viewportH, 0, maxCameraY);
      if (entry.bounds.height > viewportH && roomMin <= roomMax) {
        const desired = (playerCenterY ?? entry.bounds.centerY) - viewportH * 0.5;
        return clamp(desired, roomMin, roomMax);
      }
      return clamp(entry.bounds.centerY - viewportH * 0.5, 0, maxCameraY);
    }
    const configuredY = typeof entry.interaction.cameraTargetY === "number" && Number.isFinite(entry.interaction.cameraTargetY)
      ? entry.interaction.cameraTargetY
      : undefined;
    return clamp(configuredY ?? entry.bounds.centerY - viewportH * 0.5, 0, maxCameraY);
  };

  const animateSceneCamera = (targetX: number, targetY: number, durationMs = 0) => {
    if (cameraAnimationRef.current !== null) {
      window.cancelAnimationFrame(cameraAnimationRef.current);
      cameraAnimationRef.current = null;
    }
    const safeTargetX = Number(targetX.toFixed(2));
    const safeTargetY = Number(targetY.toFixed(2));
    const safeDurationMs = Math.max(0, durationMs);
    if (safeDurationMs <= 0) {
      setScene(prev => ({ ...prev, cameraX: safeTargetX, cameraY: safeTargetY }));
      return;
    }
    const startX = sceneStateRef.current.cameraX;
    const startY = sceneStateRef.current.cameraY || 0;
    const startedAt = performance.now();
    const step = (time: number) => {
      const progress = clamp((time - startedAt) / safeDurationMs, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextCameraX = Number((startX + (safeTargetX - startX) * eased).toFixed(2));
      const nextCameraY = Number((startY + (safeTargetY - startY) * eased).toFixed(2));
      setScene(prev => ({ ...prev, cameraX: nextCameraX, cameraY: nextCameraY }));
      if (progress < 1) {
        cameraAnimationRef.current = window.requestAnimationFrame(step);
      } else {
        cameraAnimationRef.current = null;
      }
    };
    cameraAnimationRef.current = window.requestAnimationFrame(step);
  };

  const playCameraEffect = (effect: Omit<SceneCameraVisualEffect, "id">) => {
    if (cameraEffectTimerRef.current !== null) window.clearTimeout(cameraEffectTimerRef.current);
    setCameraEffect(null);
    window.requestAnimationFrame(() => {
      setCameraEffect({ ...effect, id: Date.now() });
      cameraEffectTimerRef.current = window.setTimeout(() => setCameraEffect(null), effect.durationMs + 80);
    });
  };

  const runCameraZone = (entry: SceneInteractionPromptEntry) => {
    const mode = entry.interaction.cameraMode || "room-lock";
    const durationMs = entry.interaction.cameraDurationMs ?? 450;
    const currentScene = sceneStateRef.current;
    const targetX = cameraXForInteraction(entry, currentScene);
    const targetY = cameraYForInteraction(entry, currentScene);
    if (mode !== "shake") animateSceneCamera(targetX, targetY, mode === "pan" ? durationMs : Math.min(durationMs, 280));
    if (mode === "zoom") {
      playCameraEffect({
        durationMs,
        type: "zoom",
        zoom: clamp(entry.interaction.cameraZoom ?? 1.12, 1, 1.6),
      });
    }
    if (mode === "shake") {
      playCameraEffect({
        durationMs,
        shakeIntensity: clamp(entry.interaction.cameraShakeIntensity ?? 8, 1, 28),
        type: "shake",
      });
    }
    if (entry.interaction.subtitle) setInteractionToast(entry.interaction.subtitle);
    setNotice(`Camera Zone triggered: ${cameraModeLabel(mode)}.`);
  };

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
    if (actionType === "dialogue") {
      const lines = dialogueLinesFromInteraction(interaction, subtitle);
      setInteractionToast("");
      setActiveDialogue({
        layerId: layer.id,
        lineIndex: 0,
        lines,
        portraitUrl: interaction.dialoguePortraitUrl?.trim() || undefined,
        promptKey: interaction.promptKey || "KeyE",
        speaker: interaction.dialogueSpeaker || layer.name || "Unknown",
      });
      setNotice(`Dialogue started: ${interaction.dialogueSpeaker || layer.name || "Unknown"}`);
      return;
    }

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

    if (actionType === "play-audio") {
      const audioText = subtitle || interaction.audioLabel || promptText;
      const audioUrl = interaction.audioUrl?.trim();
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.volume = clamp(interaction.audioVolume ?? 0.7, 0, 1);
        audio.loop = Boolean(interaction.audioLoop);
        void audio.play().catch(() => {
          setNotice("Audio Zone has a URL, but the browser blocked playback until a direct user gesture.");
        });
      }
      setInteractionToast(audioText);
      setNotice(audioUrl ? `Audio Zone triggered: ${interaction.audioLabel || audioUrl}` : "Audio Zone triggered. Add an Audio URL in the inspector to play a file.");
      return;
    }

    if (actionType === "camera-focus") {
      runCameraZone(entry);
      return;
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
    if (!autoCameraInteraction) {
      activeAutoCameraZoneIdRef.current = null;
      return;
    }
    const interaction = autoCameraInteraction.interaction;
    const signature = [
      autoCameraInteraction.layer.id,
      interaction.cameraMode || "room-lock",
      interaction.cameraTargetX ?? "",
      interaction.cameraTargetY ?? "",
      interaction.cameraDurationMs ?? "",
      interaction.cameraZoom ?? "",
      interaction.cameraShakeIntensity ?? "",
    ].join(":");
    if (activeAutoCameraZoneIdRef.current === signature) return;
    activeAutoCameraZoneIdRef.current = signature;
    triggerNearbyInteractionRef.current(autoCameraInteraction);
  }, [
    autoCameraInteraction?.layer.id,
    autoCameraInteraction?.interaction.cameraMode,
    autoCameraInteraction?.interaction.cameraTargetX,
    autoCameraInteraction?.interaction.cameraTargetY,
    autoCameraInteraction?.interaction.cameraDurationMs,
    autoCameraInteraction?.interaction.cameraZoom,
    autoCameraInteraction?.interaction.cameraShakeIntensity,
  ]);

  useEffect(() => {
    return () => {
      if (cameraAnimationRef.current !== null) window.cancelAnimationFrame(cameraAnimationRef.current);
      if (cameraEffectTimerRef.current !== null) window.clearTimeout(cameraEffectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditingTextTarget(event.target)) return;

      const currentDialogue = activeDialogueRef.current;
      if (currentDialogue) {
        if (event.key === "Escape") {
          event.preventDefault();
          if (event.repeat) return;
          setActiveDialogue(null);
          setNotice("Dialogue closed.");
          return;
        }
        if (interactionKeyMatches(event, currentDialogue.promptKey) || event.code === "Enter" || event.code === "Space") {
          event.preventDefault();
          if (event.repeat) return;
          advanceDialogue();
          return;
        }
      }

      if (event.code === "KeyI") {
        event.preventDefault();
        if (event.repeat) return;
        setIsBackpackOpen(value => !value);
        setNotice("Backpack inventory toggled.");
        return;
      }

      const activeNearbyInteraction = nearbyInteractionRef.current;
      if (activeNearbyInteraction?.interaction?.triggerMode === "near-key") {
        if (interactionKeyMatches(event, String(activeNearbyInteraction.interaction.promptKey || "KeyE"))) {
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
        if (matchedLayer.clip.direction !== "none") {
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
        asset.binding?.triggerType === "keyboard" &&
        asset.binding.triggerValue.toLowerCase() === event.code.toLowerCase()
      );
      if (!matched) return;
      event.preventDefault();
      if (event.repeat) return;
      setActiveSprite(matched.sprite);
      setActiveFrame(0);
      setIsPlaying(true);
      setNotice(`Keyboard ${matched.binding?.triggerValue || event.code} triggered action: ${matched.binding?.actionName || matched.name}`);
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
            asset.animations?.find(item => item.actionName === "idle" && item.direction === triggeredClip.direction) ||
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
      setNotice(`Key released. Returning to ${matchedLayer.idleClip.name}.`);
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
        const viewportH = sceneViewportHeight(prev);
        const maxCameraX = Math.max(0, prev.width - viewportW);
        const maxCameraY = Math.max(0, prev.height - viewportH);
        const dx = heldDirection === "left" ? -1 : heldDirection === "right" ? 1 : 0;
        const dy = heldDirection === "up" ? -1 : heldDirection === "down" ? 1 : 0;
        const physicsZones = prev.layers
          .filter(layer => layer.visible && layer.assetId)
          .map(layer => {
            const asset = assetById.get(layer.assetId!);
            if (!asset) return null;
            const interaction = layerInteractionSettings(layer, asset);
            if (!interaction?.enabled || !isPhysicsZoneInteraction(interaction)) return null;
            return { bounds: interactionZoneBounds(layer, asset, interaction), interaction, layer };
          })
          .filter(Boolean);
        let focusX: number | null = null;
        let focusY: number | null = null;
        let playerLayerAfterMove: SceneLayer | null = null;
        const layers = prev.layers.map(layer => {
          if (!layer.assetId) return layer;
          const asset = assetById.get(layer.assetId);
          if (asset?.role !== "player") return layer;
          const sprite = resolveAssetSprite(asset, layer);
          const [spriteW, spriteH] = sprite ? getFrameSize(sprite) : [0, 0];
          const layerWidth = spriteW * layer.scale;
          const layerHeight = spriteH * layer.scale;
          const currentFootX = layer.x + layerWidth * 0.5;
          const currentFootY = layer.y;
          const tentativeFootX = currentFootX + dx * walkSpeed * delta;
          const tentativeFootY = currentFootY + dy * walkSpeed * delta;
          let speedScale = 1;
          let pullX = 0;
          let pullY = 0;

          physicsZones.forEach(entry => {
            if (!entry) return;
            const insideCurrent = interactionZoneContainsPoint(entry.bounds, entry.interaction, currentFootX, currentFootY);
            const insideTentative = interactionZoneContainsPoint(entry.bounds, entry.interaction, tentativeFootX, tentativeFootY);
            if (!insideCurrent && !insideTentative) return;
            if (entry.interaction.physicsMode === "slow") {
              speedScale = Math.min(speedScale, clamp(entry.interaction.physicsFriction ?? 0.55, 0.1, 0.95));
              return;
            }
            if (entry.interaction.physicsMode === "pull") {
              const strength = clamp(entry.interaction.physicsStrength ?? 1, 0, 2);
              const vectorX = entry.bounds.centerX - currentFootX;
              const vectorY = entry.bounds.centerY - currentFootY;
              const distance = Math.max(1, Math.hypot(vectorX, vectorY));
              pullX += (vectorX / distance) * walkSpeed * delta * strength;
              pullY += (vectorY / distance) * walkSpeed * delta * strength;
            }
          });

          let nextX = clamp(layer.x + dx * walkSpeed * delta * speedScale + pullX, 0, Math.max(0, prev.width - layerWidth));
          let nextY = clamp(layer.y + dy * walkSpeed * delta * speedScale + pullY, layerHeight, prev.height);
          const nextFootX = nextX + layerWidth * 0.5;
          const nextFootY = nextY;
          const blockedBySolidZone = physicsZones.some(entry => {
            if (!entry) return false;
            if ((entry.interaction.physicsMode || "solid") !== "solid") return false;
            const insideCurrent = interactionZoneContainsPoint(entry.bounds, entry.interaction, currentFootX, currentFootY);
            const insideNext = interactionZoneContainsPoint(entry.bounds, entry.interaction, nextFootX, nextFootY);
            return insideNext && !insideCurrent;
          });
          if (blockedBySolidZone) {
            nextX = layer.x;
            nextY = layer.y;
          }
          focusX = nextX + layerWidth * 0.5;
          focusY = nextY - layerHeight * 0.5;
          playerLayerAfterMove = { ...layer, x: Number(nextX.toFixed(2)), y: Number(nextY.toFixed(2)) };
          return playerLayerAfterMove;
        });
        if (focusX === null || focusY === null) return prev;
        let nextCameraX = clamp(focusX - viewportW * 0.42, 0, maxCameraX);
        let nextCameraY = clamp(focusY - viewportH * 0.5, 0, maxCameraY);
        if (playerLayerAfterMove) {
          const playerAsset = playerLayerAfterMove.assetId ? assetById.get(playerLayerAfterMove.assetId) : undefined;
          const playerBounds = layerWorldBounds(playerLayerAfterMove, playerAsset);
          const roomLockEntry = layers
            .filter(layer => layer.visible && layer.assetId && isSceneVisualLayer(layer))
            .map(layer => {
              const asset = assetById.get(layer.assetId!);
              if (!asset) return null;
              const interaction = layerInteractionSettings(layer, asset);
              if (!interaction?.enabled || !isCameraZoneInteraction(interaction) || interaction.triggerMode !== "auto") return null;
              if ((interaction.cameraMode || "room-lock") !== "room-lock") return null;
              const bounds = interactionZoneBounds(layer, asset, interaction);
              const inside =
                playerBounds.centerX >= bounds.left &&
                playerBounds.centerX <= bounds.right &&
                playerBounds.centerY >= bounds.top &&
                playerBounds.centerY <= bounds.bottom;
              if (!inside) return null;
              const distance = Math.hypot(playerBounds.centerX - bounds.centerX, playerBounds.centerY - bounds.centerY);
              return { asset, bounds, distance, interaction, layer };
            })
            .filter(Boolean)
            .sort((a, b) => a!.distance - b!.distance)[0];
          if (roomLockEntry) {
            const entry = {
              asset: roomLockEntry.asset,
              bounds: roomLockEntry.bounds,
              interaction: roomLockEntry.interaction,
              layer: roomLockEntry.layer,
            };
            const nextScene = { ...prev, layers };
            nextCameraX = cameraXForInteraction(entry, nextScene, focusX);
            nextCameraY = cameraYForInteraction(entry, nextScene, focusY);
          }
        }
        return {
          ...prev,
          cameraX: Number(nextCameraX.toFixed(2)),
          cameraY: Number(nextCameraY.toFixed(2)),
          layers,
        };
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

  return {
    advanceDialogue,
    triggerNearbyInteraction,
  };
}
