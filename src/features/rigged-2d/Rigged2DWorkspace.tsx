import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArrowLeft, Box, ChevronLeft, Code2, Download, Layers3, Move, Pause, Play, RefreshCw, RotateCcw, Sparkles } from "lucide-react";

type RigAnimationSummary = { name: string; loop?: boolean };
type RigEntry = {
  id: string; name: string; characterName?: string; description?: string; focus?: string;
  thumbnailUrl: string; previewSheetUrl?: string; rigManifestUrl: string;
  spineJsonUrl?: string; spineAtlasUrl?: string; spineTextureUrl?: string;
  frameSize: [number, number]; frameCount: number; fps: number;
  animations: RigAnimationSummary[]; defaultAnimation: string; tags?: string[];
};
type RigLibrary = { schemaVersion: number; rigs: RigEntry[] };
type AttachmentKey = [time: number, attachment: string];
type Vec2Key = [time: number, x: number, y: number];
type ScalarKey = [time: number, value: number];
type DrawOrderKey = [time: number, slots: string[]];
type RuntimeTransform = { translate: [number, number]; scale: [number, number] };
type RigAttachment = {
  file: string; canvas: [number, number]; anchor: [number, number];
  runtimeTransform?: RuntimeTransform;
};
type RigSlot = { name: string; bone: string; attachment: string; variants?: string[] };
type PlaybackMode = "once" | "loop" | "random";
type BoneTimeline = { translate?: Vec2Key[]; rotate?: ScalarKey[]; scale?: Vec2Key[] };
type ClipPlaybackDefaults = {
  mode?: PlaybackMode; speed?: number; autoStart?: boolean; transient?: boolean;
  randomDelay?: [minSeconds: number, maxSeconds: number];
  randomRepeatChance?: number; randomRepeatDelay?: [minSeconds: number, maxSeconds: number];
  repeatChance?: number; repeatDelay?: [minSeconds: number, maxSeconds: number];
};
type RigClip = {
  name: string; category?: string; duration: number; loop?: boolean;
  attachmentTimelines?: Record<string, AttachmentKey[]>;
  eyeTimeline?: AttachmentKey[]; mouthTimeline?: AttachmentKey[];
  boneTimelines?: Record<string, BoneTimeline>;
  drawOrderTimeline?: DrawOrderKey[];
  playback?: ClipPlaybackDefaults;
};
type RigBone = { name: string; parent?: string; x?: number; y?: number; pivot?: [number, number] };
type RigPosePreset = { id: string; name: string; attachments: Record<string, string> };
type RigManifest = {
  schemaVersion: number; id?: string; runtime: string;
  attachments: Record<string, RigAttachment>; slots: RigSlot[]; animations: RigClip[];
  editorTransforms?: Record<string, RuntimeTransform>;
  bones?: RigBone[]; posePresets?: RigPosePreset[];
};
type EditorTransform = { x: number; y: number; scaleX: number; scaleY: number };
type TransformMap = Record<string, EditorTransform>;
type RandomPhase = "wait" | "burst";
type AnimationPlayback = {
  enabled: boolean; playing: boolean; elapsed: number; speed: number; mode: PlaybackMode;
  randomPhase: RandomPhase; waitRemaining: number; randomCanRepeat: boolean; activationOrder: number;
};
type PlaybackMap = Record<string, AnimationPlayback>;
type AttachmentOverrides = Record<string, string>;
type BonePose = { translate: [number, number]; rotate: number; scale: [number, number] };
type BonePivot = { x: number; y: number; parent?: string };
type ClipClaim = `slot:${string}:attachment` | `bone:${string}:translate` | `bone:${string}:rotate` | `bone:${string}:scale` | "draw-order";

const LIBRARY_URL = "/generated/rigged_2d_library.json";
const IDENTITY: EditorTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
const IDENTITY_BONE_POSE: BonePose = { translate: [0, 0], rotate: 0, scale: [1, 1] };
const DEFAULT_RANDOM_DELAY: [number, number] = [2.5, 6.5];
const DEFAULT_REPEAT_DELAY: [number, number] = [0.08, 0.16];
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function resolveTimeline(timeline: AttachmentKey[] | undefined, time: number, fallback: string) {
  let attachment = fallback;
  for (const [keyTime, keyAttachment] of timeline || []) {
    if (keyTime > time) break;
    attachment = keyAttachment;
  }
  return attachment;
}

function resolveVec2Timeline(
  timeline: Vec2Key[] | undefined,
  time: number,
  fallback: [number, number] = [0, 0],
): [number, number] {
  if (!timeline?.length) return fallback;
  if (time < timeline[0][0]) return fallback;
  for (let index = 0; index < timeline.length - 1; index += 1) {
    const current = timeline[index];
    const next = timeline[index + 1];
    if (time > next[0]) continue;
    const span = Math.max(0.000001, next[0] - current[0]);
    const mix = Math.max(0, Math.min(1, (time - current[0]) / span));
    return [current[1] + (next[1] - current[1]) * mix, current[2] + (next[2] - current[2]) * mix];
  }
  const last = timeline[timeline.length - 1];
  return [last[1], last[2]];
}

function resolveScalarTimeline(timeline: ScalarKey[] | undefined, time: number) {
  if (!timeline?.length || time < timeline[0][0]) return 0;
  for (let index = 0; index < timeline.length - 1; index += 1) {
    const current = timeline[index];
    const next = timeline[index + 1];
    if (time > next[0]) continue;
    const span = Math.max(0.000001, next[0] - current[0]);
    const mix = Math.max(0, Math.min(1, (time - current[0]) / span));
    return current[1] + (next[1] - current[1]) * mix;
  }
  return timeline[timeline.length - 1][1];
}

function resolveDrawOrderTimeline(timeline: DrawOrderKey[] | undefined, time: number, fallback: string[]) {
  let order = fallback;
  for (const [keyTime, keyOrder] of timeline || []) {
    if (keyTime > time) break;
    order = keyOrder;
  }
  const known = new Set(fallback);
  const resolved = [...new Set(order.filter(name => known.has(name)))];
  return [...resolved, ...fallback.filter(name => !resolved.includes(name))];
}

function timelineForSlot(clip: RigClip, slotName: string) {
  const slotTimeline = clip.attachmentTimelines?.[slotName];
  if (slotTimeline !== undefined) return slotTimeline;
  if (slotName === "eyes") return clip.eyeTimeline;
  if (slotName === "mouth") return clip.mouthTimeline;
  return undefined;
}

function controlledSlots(clip: RigClip, slots: RigSlot[]) {
  return slots.filter(slot => timelineForSlot(clip, slot.name) !== undefined).map(slot => slot.name);
}

function clipClaims(clip: RigClip, slots: RigSlot[]): ClipClaim[] {
  const claims = controlledSlots(clip, slots).map<ClipClaim>(slot => `slot:${slot}:attachment`);
  for (const [bone, timeline] of Object.entries(clip.boneTimelines || {}) as [string, BoneTimeline][]) {
    if (timeline.translate !== undefined) claims.push(`bone:${bone}:translate`);
    if (timeline.rotate !== undefined) claims.push(`bone:${bone}:rotate`);
    if (timeline.scale !== undefined) claims.push(`bone:${bone}:scale`);
  }
  if (clip.drawOrderTimeline !== undefined) claims.push("draw-order");
  return claims;
}

function claimsConflict(left: ClipClaim[], right: ClipClaim[]) {
  const occupied = new Set(left);
  return right.some(claim => occupied.has(claim));
}

function playbackMode(clip: RigClip): PlaybackMode {
  const configured = clip.playback?.mode;
  return configured === "once" || configured === "loop" || configured === "random"
    ? configured : clip.loop ? "loop" : "once";
}

function clampSpeed(value: unknown) {
  return Math.max(0.1, Math.min(4, finite(value, 1)));
}

function delayRange(value: unknown, fallback: [number, number]): [number, number] {
  if (!Array.isArray(value)) return fallback;
  const first = Math.max(0.02, Math.min(60, finite(value[0], fallback[0])));
  const second = Math.max(0.02, Math.min(60, finite(value[1], fallback[1])));
  return first <= second ? [first, second] : [second, first];
}

function randomDelay(range: [number, number]) {
  return range[0] + Math.random() * (range[1] - range[0]);
}

function defaultPlayback(clip: RigClip, enabled: boolean, activationOrder: number): AnimationPlayback {
  const mode = playbackMode(clip);
  return {
    enabled, playing: enabled, elapsed: 0, speed: clampSpeed(clip.playback?.speed), mode,
    randomPhase: mode === "random" ? "wait" : "burst",
    waitRemaining: mode === "random" ? randomDelay(delayRange(clip.playback?.randomDelay, DEFAULT_RANDOM_DELAY)) : 0,
    randomCanRepeat: true, activationOrder,
  };
}

function isTransientOverlay(clip: RigClip, mode: PlaybackMode) {
  return mode === "once" && clip.playback?.transient === true;
}

function initialPlayback(animations: RigClip[], slots: RigSlot[], defaultAnimation: string): PlaybackMap {
  const ordered = [
    ...animations.filter(animation => animation.name === defaultAnimation),
    ...animations.filter(animation => animation.name !== defaultAnimation),
  ];
  const claimedResources = new Set<ClipClaim>();
  const enabled = new Set<string>();
  for (const animation of ordered) {
    const claims = clipClaims(animation, slots);
    if (animation.name !== defaultAnimation && claims.length === 0) continue;
    if (animation.name !== defaultAnimation && animation.playback?.autoStart === false) continue;
    if (animation.name !== defaultAnimation && animation.playback?.transient && animation.playback.autoStart !== true) continue;
    if (claims.some(claim => claimedResources.has(claim))) continue;
    enabled.add(animation.name);
    claims.forEach(claim => claimedResources.add(claim));
  }
  let activationOrder = 0;
  return Object.fromEntries(animations.map(animation => [
    animation.name, defaultPlayback(animation, enabled.has(animation.name), ++activationOrder),
  ]));
}

function playbackSampleTime(state: AnimationPlayback) {
  return state.mode === "random" && state.randomPhase === "wait" ? 0 : state.elapsed;
}

function isDormantRandomWait(state: AnimationPlayback) {
  return state.mode === "random" && state.randomPhase === "wait";
}

function attachmentUrl(manifestUrl: string, file: string) {
  return new URL(file, new URL(manifestUrl, window.location.href)).toString();
}

function finite(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function fromRuntimeTransform(transform?: RuntimeTransform): EditorTransform {
  return {
    x: finite(transform?.translate?.[0], 0),
    y: finite(transform?.translate?.[1], 0),
    scaleX: finite(transform?.scale?.[0], 1),
    scaleY: finite(transform?.scale?.[1], 1),
  };
}

function storageKey(rigId: string) {
  return `gorest-rig-transform-editor:${rigId}:v2`;
}

function attachmentOptionsForSlot(manifest: RigManifest, slot: RigSlot) {
  const names = new Set<string>([slot.attachment, ...(slot.variants || [])]);
  for (const clip of manifest.animations) {
    for (const [, attachment] of timelineForSlot(clip, slot.name) || []) names.add(attachment);
  }
  return [...names].filter(name => Boolean(manifest.attachments[name]));
}

function buildBonePivots(bones: RigBone[] | undefined) {
  const definitions = new Map((bones || []).map(bone => [bone.name, bone]));
  const pivots: Record<string, BonePivot> = {};
  const resolving = new Set<string>();
  const resolve = (name: string): BonePivot => {
    if (pivots[name]) return pivots[name];
    const bone = definitions.get(name);
    if (!bone || resolving.has(name)) return { x: 0, y: 0 };
    resolving.add(name);
    const parent = bone.parent ? resolve(bone.parent) : { x: 0, y: 0 };
    const explicitPivot = Array.isArray(bone.pivot) ? bone.pivot : undefined;
    const pivot = {
      x: explicitPivot ? finite(explicitPivot[0], parent.x) : parent.x + finite(bone.x, 0),
      y: explicitPivot ? finite(explicitPivot[1], parent.y) : parent.y + finite(bone.y, 0),
      parent: bone.parent,
    };
    resolving.delete(name);
    pivots[name] = pivot;
    return pivot;
  };
  for (const name of definitions.keys()) resolve(name);
  return pivots;
}

function boneChain(name: string, pivots: Record<string, BonePivot>) {
  const chain: string[] = [];
  const visited = new Set<string>();
  let current: string | undefined = name;
  while (current && pivots[current] && !visited.has(current)) {
    visited.add(current);
    chain.unshift(current);
    current = pivots[current].parent;
  }
  return chain;
}

function humanize(value: string) {
  return value.replace(/[_-]+/g, " ");
}

export function Rigged2DWorkspace({ onBack }: { onBack: () => void }) {
  const [library, setLibrary] = useState<RigLibrary>({ schemaVersion: 1, rigs: [] });
  const [selected, setSelected] = useState<RigEntry | null>(null);
  const [manifest, setManifest] = useState<RigManifest | null>(null);
  const [playback, setPlayback] = useState<PlaybackMap>({});
  const [error, setError] = useState("");
  const [transforms, setTransforms] = useState<TransformMap>({});
  const [baseTransforms, setBaseTransforms] = useState<TransformMap>({});
  const [selectedSlot, setSelectedSlot] = useState("");
  const [lockAspect, setLockAspect] = useState(true);
  const [attachmentOverrides, setAttachmentOverrides] = useState<AttachmentOverrides>({});
  const [selectedPreset, setSelectedPreset] = useState("");
  const lastFrameTime = useRef<number | null>(null);
  const activationOrder = useRef(0);
  const drag = useRef<null | {
    pointerId: number; slot: string; clientX: number; clientY: number;
    start: EditorTransform; pixelsPerCanvasX: number; pixelsPerCanvasY: number;
  }>(null);

  const load = () => {
    setError("");
    fetch(`${LIBRARY_URL}?t=${Date.now()}`, { cache: "no-store" })
      .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
      .then((data: RigLibrary) => setLibrary({ schemaVersion: data.schemaVersion || 1, rigs: Array.isArray(data.rigs) ? data.rigs : [] }))
      .catch(() => setError("No generated Rigged 2D library is available yet. Ask Codex to generate a character rig."));
  };

  useEffect(load, []);
  useEffect(() => {
    setManifest(null);
    setTransforms({});
    setBaseTransforms({});
    setSelectedSlot("");
    setPlayback({});
    setAttachmentOverrides({});
    setSelectedPreset("");
    activationOrder.current = 0;
    if (!selected) return;
    let cancelled = false;
    fetch(`${selected.rigManifestUrl}?t=${Date.now()}`, { cache: "no-store" })
      .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
      .then((data: RigManifest) => {
        if (cancelled) return;
        const baseline: TransformMap = {};
        for (const slot of data.slots) {
          baseline[slot.name] = fromRuntimeTransform(
            data.editorTransforms?.[slot.name] || data.attachments[slot.attachment]?.runtimeTransform,
          );
        }
        const initial: TransformMap = Object.fromEntries(
          Object.entries(baseline).map(([name, value]) => [name, { ...value }]),
        );
        try {
          const saved = JSON.parse(localStorage.getItem(storageKey(selected.id)) || "null") as TransformMap | null;
          if (saved) {
            for (const slot of data.slots) {
              const value = saved[slot.name];
              if (!value) continue;
              initial[slot.name] = {
                x: finite(value.x, initial[slot.name].x),
                y: finite(value.y, initial[slot.name].y),
                scaleX: finite(value.scaleX, initial[slot.name].scaleX),
                scaleY: finite(value.scaleY, initial[slot.name].scaleY),
              };
            }
          }
        } catch { /* Ignore malformed local editor state. */ }
        setManifest(data);
        setBaseTransforms(baseline);
        setTransforms(initial);
        setSelectedSlot(data.slots[0]?.name || "");
        const initialAnimation = data.animations.some(animation => animation.name === selected.defaultAnimation)
          ? selected.defaultAnimation : data.animations[0]?.name || "";
        setPlayback(initialPlayback(data.animations, data.slots, initialAnimation));
        activationOrder.current = data.animations.length;
        Object.values(data.attachments).forEach(attachment => {
          const image = new Image();
          image.src = attachmentUrl(selected.rigManifestUrl, attachment.file);
        });
      })
      .catch(() => { if (!cancelled) setError("The generated attachment rig could not be loaded."); });
    return () => { cancelled = true; };
  }, [selected]);

  useEffect(() => {
    if (!selected || !manifest || Object.keys(transforms).length === 0) return;
    localStorage.setItem(storageKey(selected.id), JSON.stringify(transforms));
  }, [manifest, selected, transforms]);

  const activeTracks = useMemo(() => (manifest?.animations || []).flatMap(clip => {
    const state = playback[clip.name];
    return state?.enabled ? [{ clip, state }] : [];
  }).sort((left, right) => left.state.activationOrder - right.state.activationOrder), [manifest, playback]);
  const animationGroups = useMemo(() => {
    const groups = new Map<string, RigClip[]>();
    for (const clip of manifest?.animations || []) {
      const category = clip.category?.trim() || "General";
      groups.set(category, [...(groups.get(category) || []), clip]);
    }
    return [...groups.entries()];
  }, [manifest]);
  const anyTrackPlaying = activeTracks.some(track => track.state.playing);
  useEffect(() => {
    if (!manifest || !anyTrackPlaying) { lastFrameTime.current = null; return; }
    let animationFrame = 0;
    const tick = (now: number) => {
      if (lastFrameTime.current === null) lastFrameTime.current = now;
      const delta = Math.min((now - lastFrameTime.current) / 1000, 0.1);
      lastFrameTime.current = now;
      setPlayback(previous => {
        let changed = false;
        const next = { ...previous };
        for (const clip of manifest.animations) {
          const state = previous[clip.name];
          if (!state?.enabled || !state.playing) continue;
          const duration = Math.max(0, finite(clip.duration, 0));
          if (duration <= 0) {
            next[clip.name] = {
              ...state, elapsed: 0, playing: false,
              enabled: isTransientOverlay(clip, state.mode) ? false : state.enabled,
            };
            changed = true;
            continue;
          }
          if (state.mode === "random") {
            if (state.randomPhase === "wait") {
              const waitRemaining = state.waitRemaining - delta;
              next[clip.name] = waitRemaining > 0
                ? { ...state, waitRemaining }
                : {
                  ...state, randomPhase: "burst", waitRemaining: 0,
                  elapsed: Math.min(duration, Math.max(0, -waitRemaining) * state.speed),
                };
            } else {
              const elapsed = state.elapsed + delta * state.speed;
              if (elapsed < duration) {
                next[clip.name] = { ...state, elapsed };
              } else {
                const repeatChance = Math.max(0, Math.min(1, finite(
                  clip.playback?.randomRepeatChance ?? clip.playback?.repeatChance, 0,
                )));
                const shouldRepeat = state.randomCanRepeat && Math.random() < repeatChance;
                const range = shouldRepeat
                  ? delayRange(clip.playback?.randomRepeatDelay ?? clip.playback?.repeatDelay, DEFAULT_REPEAT_DELAY)
                  : delayRange(clip.playback?.randomDelay, DEFAULT_RANDOM_DELAY);
                next[clip.name] = {
                  ...state, elapsed: 0, randomPhase: "wait", waitRemaining: randomDelay(range),
                  randomCanRepeat: !shouldRepeat,
                };
              }
            }
            changed = true;
            continue;
          }
          const elapsed = state.mode === "loop"
            ? (state.elapsed + delta * state.speed) % duration
            : Math.min(state.elapsed + delta * state.speed, duration);
          const complete = state.mode === "once" && elapsed >= duration;
          next[clip.name] = {
            ...state, elapsed, playing: !complete,
            enabled: complete && isTransientOverlay(clip, state.mode) ? false : state.enabled,
          };
          changed = true;
        }
        return changed ? next : previous;
      });
      animationFrame = window.requestAnimationFrame(tick);
    };
    animationFrame = window.requestAnimationFrame(tick);
    return () => { window.cancelAnimationFrame(animationFrame); lastFrameTime.current = null; };
  }, [anyTrackPlaying, manifest]);

  const slotAttachmentOptions = useMemo<Record<string, string[]>>(() => {
    if (!manifest) return {};
    return Object.fromEntries(manifest.slots.map(slot => [slot.name, attachmentOptionsForSlot(manifest, slot)]));
  }, [manifest]);

  const bonePivots = useMemo(() => buildBonePivots(manifest?.bones), [manifest]);
  const activeBonePoses = useMemo(() => {
    const poses: Record<string, BonePose> = {};
    for (const { clip, state } of activeTracks) {
      if (isDormantRandomWait(state)) continue;
      const sampleTime = playbackSampleTime(state);
      for (const [bone, timeline] of Object.entries(clip.boneTimelines || {}) as [string, BoneTimeline][]) {
        const current = poses[bone] || {
          ...IDENTITY_BONE_POSE,
          translate: [...IDENTITY_BONE_POSE.translate] as [number, number],
          scale: [...IDENTITY_BONE_POSE.scale] as [number, number],
        };
        poses[bone] = {
          translate: timeline.translate !== undefined
            ? resolveVec2Timeline(timeline.translate, sampleTime) : current.translate,
          rotate: timeline.rotate !== undefined
            ? resolveScalarTimeline(timeline.rotate, sampleTime) : current.rotate,
          scale: timeline.scale !== undefined
            ? resolveVec2Timeline(timeline.scale, sampleTime, [1, 1]) : current.scale,
        };
      }
    }
    return poses;
  }, [activeTracks]);

  const activeLayers = useMemo(() => {
    if (!selected || !manifest) return [];
    const setupOrder = manifest.slots.map(slot => slot.name);
    let drawOrder = setupOrder;
    for (const track of activeTracks) {
      if (isDormantRandomWait(track.state) || track.clip.drawOrderTimeline === undefined) continue;
      drawOrder = resolveDrawOrderTimeline(track.clip.drawOrderTimeline, playbackSampleTime(track.state), drawOrder);
    }
    const slots = new Map<string, RigSlot>(manifest.slots.map(slot => [slot.name, slot]));
    return drawOrder.flatMap(slotName => {
      const slot = slots.get(slotName);
      if (!slot) return [];
      let active = slot.attachment;
      for (const track of activeTracks) {
        if (isDormantRandomWait(track.state)) continue;
        const timeline = timelineForSlot(track.clip, slot.name);
        if (timeline === undefined) continue;
        const resolved = resolveTimeline(timeline, playbackSampleTime(track.state), active);
        if (manifest.attachments[resolved]) active = resolved;
      }
      const override = attachmentOverrides[slot.name];
      if (override && slotAttachmentOptions[slot.name]?.includes(override)) active = override;
      const attachment = manifest.attachments[active];
      return attachment ? [{
        slot: slot.name, bone: slot.bone, attachment: active,
        url: attachmentUrl(selected.rigManifestUrl, attachment.file),
        transform: transforms[slot.name] || IDENTITY,
      }] : [];
    });
  }, [activeTracks, attachmentOverrides, manifest, selected, slotAttachmentOptions, transforms]);

  const currentTransform = transforms[selectedSlot] || IDENTITY;
  const toggleAnimation = (name: string) => {
    if (!manifest) return;
    const animation = manifest.animations.find(item => item.name === name);
    if (!animation) return;
    const nextActivationOrder = ++activationOrder.current;
    setPlayback(previous => {
      const current = previous[name] || defaultPlayback(animation, false, nextActivationOrder);
      if (current.enabled) return { ...previous, [name]: { ...current, enabled: false, playing: false } };
      const claims = clipClaims(animation, manifest.slots);
      const overlay = isTransientOverlay(animation, current.mode);
      const next = { ...previous };
      for (const other of manifest.animations) {
        const state = next[other.name];
        if (other.name === name || !state?.enabled) continue;
        if (!claimsConflict(claims, clipClaims(other, manifest.slots))) continue;
        if (overlay && !isTransientOverlay(other, state.mode)) continue;
        next[other.name] = { ...state, enabled: false, playing: false };
      }
      next[name] = {
        ...current, enabled: true, playing: true, elapsed: 0, activationOrder: nextActivationOrder,
        randomPhase: current.mode === "random" ? "wait" : "burst",
        waitRemaining: current.mode === "random"
          ? randomDelay(delayRange(animation.playback?.randomDelay, DEFAULT_RANDOM_DELAY)) : 0,
        randomCanRepeat: true,
      };
      return next;
    });
  };
  const toggleAllPlayback = () => {
    const shouldPlay = !anyTrackPlaying;
    setPlayback(previous => {
      const next: PlaybackMap = {};
      for (const name of Object.keys(previous)) {
        const state = previous[name];
        if (!state.enabled) {
          next[name] = state;
          continue;
        }
        const clip = manifest?.animations.find(animation => animation.name === name);
        const elapsed = shouldPlay && clip && state.mode === "once" && state.elapsed >= clip.duration ? 0 : state.elapsed;
        next[name] = { ...state, elapsed, playing: shouldPlay };
      }
      return next;
    });
  };
  const toggleTrackPlayback = (clip: RigClip) => {
    setPlayback(previous => {
      const state = previous[clip.name];
      if (!state?.enabled) return previous;
      const elapsed = !state.playing && state.mode === "once" && state.elapsed >= clip.duration ? 0 : state.elapsed;
      return { ...previous, [clip.name]: { ...state, elapsed, playing: !state.playing } };
    });
  };
  const seekTrack = (clip: RigClip, value: number) => {
    setPlayback(previous => {
      const state = previous[clip.name];
      if (!state) return previous;
      return { ...previous, [clip.name]: {
        ...state,
        elapsed: Math.max(0, Math.min(value, Math.max(0, clip.duration))),
        playing: false, randomPhase: "burst", waitRemaining: 0, randomCanRepeat: true,
      } };
    });
  };
  const updateTrackSpeed = (clip: RigClip, value: number) => {
    setPlayback(previous => {
      const state = previous[clip.name];
      return state ? { ...previous, [clip.name]: { ...state, speed: clampSpeed(value) } } : previous;
    });
  };
  const updateTrackMode = (clip: RigClip, mode: PlaybackMode) => {
    if (!manifest) return;
    const nextActivationOrder = ++activationOrder.current;
    setPlayback(previous => {
      const state = previous[clip.name];
      if (!state) return previous;
      const next = { ...previous };
      const overlay = isTransientOverlay(clip, mode);
      if (state.enabled && !overlay) {
        const claims = clipClaims(clip, manifest.slots);
        for (const other of manifest.animations) {
          const otherState = next[other.name];
          if (other.name === clip.name || !otherState?.enabled) continue;
          if (claimsConflict(claims, clipClaims(other, manifest.slots))) {
            next[other.name] = { ...otherState, enabled: false, playing: false };
          }
        }
      }
      next[clip.name] = {
        ...state, mode, elapsed: 0, activationOrder: nextActivationOrder,
        randomPhase: mode === "random" ? "wait" : "burst",
        waitRemaining: mode === "random"
          ? randomDelay(delayRange(clip.playback?.randomDelay, DEFAULT_RANDOM_DELAY)) : 0,
        randomCanRepeat: true,
      };
      return next;
    });
  };
  const updateAttachmentOverride = (slotName: string, attachment: string) => {
    setSelectedPreset("");
    setAttachmentOverrides(previous => {
      const next = { ...previous };
      if (!attachment || !slotAttachmentOptions[slotName]?.includes(attachment)) delete next[slotName];
      else next[slotName] = attachment;
      return next;
    });
  };
  const clearAttachmentOverrides = () => {
    setAttachmentOverrides({});
    setSelectedPreset("");
  };
  const applyPosePreset = (preset: RigPosePreset) => {
    if (!manifest) return;
    const next: AttachmentOverrides = {};
    for (const [slotName, attachment] of Object.entries(preset.attachments || {})) {
      if (slotAttachmentOptions[slotName]?.includes(attachment)) next[slotName] = attachment;
    }
    setAttachmentOverrides(next);
    setSelectedPreset(preset.id);
  };
  const updateTransform = (slot: string, patch: Partial<EditorTransform>) => {
    setTransforms(previous => ({ ...previous, [slot]: { ...(previous[slot] || IDENTITY), ...patch } }));
  };
  const updateScale = (axis: "scaleX" | "scaleY", value: number) => {
    const safe = Math.max(0.05, Math.min(5, finite(value, 1)));
    updateTransform(selectedSlot, lockAspect ? { scaleX: safe, scaleY: safe } : { [axis]: safe });
  };
  const resetSelected = () => updateTransform(selectedSlot, baseTransforms[selectedSlot] || IDENTITY);
  const resetAll = () => {
    if (!manifest) return;
    setTransforms(Object.fromEntries(manifest.slots.map(slot => [slot.name, { ...(baseTransforms[slot.name] || IDENTITY) }])));
  };

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!selectedSlot) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId, slot: selectedSlot,
      clientX: event.clientX, clientY: event.clientY,
      start: { ...(transforms[selectedSlot] || IDENTITY) },
      pixelsPerCanvasX: Math.max(1, selected.frameSize[0]) / rect.width,
      pixelsPerCanvasY: Math.max(1, selected.frameSize[1]) / rect.height,
    };
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    updateTransform(active.slot, {
      x: Math.round((active.start.x + (event.clientX - active.clientX) * active.pixelsPerCanvasX) * 10) / 10,
      y: Math.round((active.start.y + (event.clientY - active.clientY) * active.pixelsPerCanvasY) * 10) / 10,
    });
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };

  const exportAdjustedRig = () => {
    if (!manifest || !selected) return;
    const adjusted = JSON.parse(JSON.stringify(manifest)) as RigManifest;
    adjusted.editorTransforms = {};
    for (const slot of adjusted.slots) {
      const value = transforms[slot.name] || IDENTITY;
      const runtimeTransform: RuntimeTransform = {
        translate: [value.x, value.y], scale: [value.scaleX, value.scaleY],
      };
      adjusted.editorTransforms[slot.name] = runtimeTransform;
      for (const attachmentName of [slot.attachment, ...(slot.variants || [])]) {
        if (adjusted.attachments[attachmentName]) adjusted.attachments[attachmentName].runtimeTransform = runtimeTransform;
      }
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(adjusted, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selected.id}.adjusted-rig.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const renderActiveLayer = (layer: {
    slot: string; bone: string; attachment: string; url: string; transform: EditorTransform;
  }) => {
    if (!selected) return null;
    let content: ReactNode = <img
      className="rig-layer-image"
      src={layer.url}
      alt=""
      data-slot={layer.slot}
      data-attachment={layer.attachment}
      style={{
        left: `${layer.transform.x / Math.max(1, selected.frameSize[0]) * 100}%`,
        top: `${layer.transform.y / Math.max(1, selected.frameSize[1]) * 100}%`,
        transform: `scale(${layer.transform.scaleX}, ${layer.transform.scaleY})`,
      }}
    />;
    const chain = boneChain(layer.bone, bonePivots);
    for (let index = chain.length - 1; index >= 0; index -= 1) {
      const bone = chain[index];
      const pose = activeBonePoses[bone];
      const pivot = bonePivots[bone];
      if (!pose || !pivot) continue;
      const translateX = pose.translate[0] / Math.max(1, selected.frameSize[0]) * 100;
      const translateY = pose.translate[1] / Math.max(1, selected.frameSize[1]) * 100;
      content = <div
        className="rig-bone-motion"
        data-bone={bone}
        style={{
          transformOrigin: `${pivot.x / Math.max(1, selected.frameSize[0]) * 100}% ${pivot.y / Math.max(1, selected.frameSize[1]) * 100}%`,
          transform: `translate(${translateX}%, ${translateY}%) rotate(${pose.rotate}deg) scale(${pose.scale[0]}, ${pose.scale[1]})`,
        }}
      >{content}</div>;
    }
    return <div className="rig-layer-stack" data-slot-stack={layer.slot} key={layer.slot}>{content}</div>;
  };

  if (!selected) return <main className="rig-library-page">
    <button type="button" className="rig-floating-back" onClick={onBack}><ArrowLeft size={18}/> Back</button>
    <header className="rig-library-hero">
      <p>Rigged 2D Animation</p><h1>Codex-generated character rigs</h1>
      <span>No manual upload / Generated and registered by Codex</span>
    </header>
    <section className="rig-library-grid" aria-label="Generated Rigged 2D character library">
      <button type="button" className="rig-codex-card" onClick={() => window.alert("Tell Codex which character and motion you want. Codex will generate the layers, rig data, preview, and library entry for you.")}>
        <Sparkles size={34}/><strong>Generate with Codex</strong><span>Describe a character, reference, expression, or motion in chat.</span>
      </button>
      {library.rigs.map(rig => <button type="button" className="rig-library-card" key={rig.id} onClick={() => { setError(""); setSelected(rig); }}>
        <img className="rig-card-thumb" src={rig.thumbnailUrl} alt=""/>
        <span className="rig-card-copy"><strong>{rig.name}</strong><small>{humanize(rig.focus || "character")} / layered attachment rig / {rig.animations.length} animations</small></span>
      </button>)}
    </section>
    {error && <p className="rig-library-status">{error}</p>}
    <button type="button" className="rig-library-refresh" onClick={load}><RefreshCw size={16}/> Reload generated library</button>
  </main>;

  return <main className="rig-detail-page">
    <header className="rig-detail-header">
      <button type="button" onClick={() => setSelected(null)}><ChevronLeft size={18}/> All rigs</button>
      <div><p>Rigged 2D / {humanize(selected.focus || "character")}</p><h1>{selected.name}</h1></div>
      <span>Live layers / Multi-track mixer</span>
    </header>
    <section className="rig-detail-layout">
      <section className="rig-preview-panel">
        <div className="rig-frame-stage">
          <div
            className={`rig-layer-canvas${selectedSlot ? " is-editing" : ""}`}
            style={{ aspectRatio: `${Math.max(1, selected.frameSize[0])} / ${Math.max(1, selected.frameSize[1])}` }}
            aria-label="Live layered attachment rig preview. Drag to move the selected layer."
            onPointerDown={beginDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {activeLayers.map(renderActiveLayer)}
            {selectedSlot && <span className="rig-editing-badge"><Move size={13}/> Dragging edits: {selectedSlot}</span>}
            {!manifest && <span className="rig-layer-loading">Loading generated layers...</span>}
          </div>
        </div>
        <div className="rig-player-panel">
          <div className="rig-player-bar">
            <button type="button" onClick={toggleAllPlayback} disabled={activeTracks.length === 0}>{anyTrackPlaying ? <Pause size={17}/> : <Play size={17}/>} {anyTrackPlaying ? "Pause all" : "Play all"}</button>
            <span>{activeTracks.length ? `${activeTracks.map(track => track.clip.name).join(" + ")} / layered playback` : "Enable an animation track to preview it."}</span>
            <small>{activeTracks.length} active</small>
          </div>
          {activeTracks.map(({ clip, state }) => {
            const speedOptions = SPEED_OPTIONS.includes(state.speed) ? SPEED_OPTIONS : [...SPEED_OPTIONS, state.speed].sort((a, b) => a - b);
            const status = state.mode === "random" && state.randomPhase === "wait"
              ? `next in ${Math.max(0, state.waitRemaining).toFixed(1)}s`
              : `${state.elapsed.toFixed(2)} / ${Math.max(0, finite(clip.duration, 0)).toFixed(2)}s`;
            return <div className="rig-player-track" key={clip.name}>
              <button type="button" onClick={() => toggleTrackPlayback(clip)} aria-label={`${state.playing ? "Pause" : "Play"} ${clip.name}`}>
                {state.playing ? <Pause size={14}/> : <Play size={14}/>} {clip.name}
              </button>
              <span>{status}</span>
              <select aria-label={`${clip.name} playback speed`} value={state.speed} onChange={event => updateTrackSpeed(clip, Number(event.target.value))}>
                {speedOptions.map(speed => <option value={speed} key={speed}>{speed}x</option>)}
              </select>
              <select aria-label={`${clip.name} playback mode`} value={state.mode} onChange={event => updateTrackMode(clip, event.target.value as PlaybackMode)}>
                <option value="once">Once</option><option value="loop">Loop</option><option value="random">Random</option>
              </select>
              <input aria-label={`${clip.name} animation time`} type="range" min="0" max={clip.duration || 1} step="0.01" value={state.elapsed} onChange={event => seekTrack(clip, Number(event.target.value))}/>
            </div>;
          })}
        </div>
      </section>
      <aside className="rig-info-panel">
        <div className="rig-info-title"><Layers3 size={18}/><strong>Layer transform editor</strong></div>
        <p>Select a slot, then drag it on the canvas or enter exact values. Every attachment variant in that slot moves and scales with it.</p>

        <div className="rig-editor-slots" role="list" aria-label="Editable layer groups">
          {manifest?.slots.map(slot => <button
            type="button"
            role="listitem"
            className={selectedSlot === slot.name ? "is-active" : ""}
            key={slot.name}
            onClick={() => setSelectedSlot(slot.name)}
          ><b>{slot.name}</b><small>{slot.variants ? `${slot.variants.length} linked variants` : "1 attachment"}</small></button>)}
        </div>

        <div className="rig-transform-fields">
          <label>X <input type="number" step="1" value={currentTransform.x} onChange={event => updateTransform(selectedSlot, { x: finite(event.target.value, 0) })}/><span>px</span></label>
          <label>Y <input type="number" step="1" value={currentTransform.y} onChange={event => updateTransform(selectedSlot, { y: finite(event.target.value, 0) })}/><span>px</span></label>
          <label>Width <input type="number" min="5" max="500" step="1" value={Math.round(currentTransform.scaleX * 1000) / 10} onChange={event => updateScale("scaleX", finite(event.target.value, 100) / 100)}/><span>%</span></label>
          <label>Height <input type="number" min="5" max="500" step="1" value={Math.round(currentTransform.scaleY * 1000) / 10} onChange={event => updateScale("scaleY", finite(event.target.value, 100) / 100)}/><span>%</span></label>
        </div>
        <label className="rig-aspect-lock"><input type="checkbox" checked={lockAspect} onChange={event => setLockAspect(event.target.checked)}/> Lock width and height proportions</label>
        <div className="rig-nudge-grid" aria-label="Nudge selected group">
          <button type="button" aria-label="Nudge up" onClick={() => updateTransform(selectedSlot, { y: currentTransform.y - 1 })}>&uarr;</button>
          <button type="button" aria-label="Nudge left" onClick={() => updateTransform(selectedSlot, { x: currentTransform.x - 1 })}>&larr;</button>
          <button type="button" aria-label="Nudge down" onClick={() => updateTransform(selectedSlot, { y: currentTransform.y + 1 })}>&darr;</button>
          <button type="button" aria-label="Nudge right" onClick={() => updateTransform(selectedSlot, { x: currentTransform.x + 1 })}>&rarr;</button>
        </div>
        <div className="rig-editor-actions">
          <button type="button" onClick={resetSelected}><RotateCcw size={14}/> Reset selected</button>
          <button type="button" onClick={resetAll}><RotateCcw size={14}/> Reset all</button>
          <button type="button" className="is-primary" onClick={exportAdjustedRig}><Download size={14}/> Export adjusted rig JSON</button>
        </div>
        <p className="rig-save-note">Adjustments are saved automatically in this browser for <b>{selected.id}</b>. Export writes the same transform to every variant in a linked group.</p>

        {(manifest?.posePresets?.length || Object.values(slotAttachmentOptions as Record<string, string[]>).some(options => options.length > 1)) ? <>
          <h2>Manual pose</h2>
          <p className="rig-animation-help">Manual choices mask animation output without stopping the tracks. Return a slot to Auto to reveal the live mix.</p>
          {manifest?.posePresets?.length ? <div className="rig-pose-presets" aria-label="Pose presets">
            <button type="button" className={!selectedPreset && Object.keys(attachmentOverrides).length === 0 ? "is-active" : ""} onClick={clearAttachmentOverrides}>Auto / live</button>
            {manifest.posePresets.map(preset => <button
              type="button"
              className={selectedPreset === preset.id ? "is-active" : ""}
              key={preset.id}
              onClick={() => applyPosePreset(preset)}
            >{preset.name}</button>)}
          </div> : null}
          <div className="rig-attachment-overrides">
            {manifest?.slots.flatMap(slot => {
              const options = slotAttachmentOptions[slot.name] || [];
              return options.length > 1 ? [<label key={slot.name}>
                <span>{humanize(slot.name)}</span>
                <select value={attachmentOverrides[slot.name] || ""} onChange={event => updateAttachmentOverride(slot.name, event.target.value)}>
                  <option value="">Auto / live track</option>
                  {options.map(attachment => <option value={attachment} key={attachment}>{humanize(attachment)}</option>)}
                </select>
              </label>] : [];
            })}
          </div>
          {Object.keys(attachmentOverrides).length > 0 ? <button type="button" className="rig-clear-overrides" onClick={clearAttachmentOverrides}><RotateCcw size={13}/> Clear manual pose</button> : null}
        </> : null}

        <h2>Animation tracks</h2>
        <p className="rig-animation-help">Independent attachment and bone channels mix together. A regular conflict replaces the earlier track; a transient one-shot briefly overlays it and then reveals it again.</p>
        <div className="rig-animation-list">{animationGroups.map(([category, animations]) => <section className="rig-animation-group" key={category}>
          <h3>{category}</h3>
          <div className="rig-animation-group-buttons">{animations.map(animation => {
            const state = playback[animation.name];
            const isActive = Boolean(state?.enabled);
            const claims = manifest ? clipClaims(animation, manifest.slots) : [];
            return <button
              className={isActive ? "is-active" : ""}
              type="button"
              key={animation.name}
              aria-pressed={isActive}
              title={claims.length ? `Controls: ${claims.map(claim => claim.replace(/^(slot|bone):/, "").replace(/:/g, " ")).join(", ")}` : "No playable timeline"}
              onClick={() => toggleAnimation(animation.name)}
            >{isActive ? <Layers3 size={13}/> : <Play size={13}/>} {animation.name}{state ? ` / ${state.mode}` : ""}{isTransientOverlay(animation, state?.mode ?? playbackMode(animation)) ? " / overlay" : ""}{isActive ? " / active" : ""}</button>;
          })}</div>
        </section>)}</div>
        <h2>Bundle</h2>
        <div className="rig-downloads">
          <a href={selected.rigManifestUrl} download><Code2 size={15}/> Original Gorest rig JSON</a>
          {selected.spineJsonUrl && <a href={selected.spineJsonUrl} download><Box size={15}/> Spine 4.2 JSON</a>}
          {selected.spineAtlasUrl && <a href={selected.spineAtlasUrl} download><Download size={15}/> Atlas</a>}
          {selected.spineTextureUrl && <a href={selected.spineTextureUrl} download><Download size={15}/> Texture PNG</a>}
        </div>
        {error && <p className="rig-library-status">{error}</p>}
        <p className="rig-license-note">This editor changes post-bake slot transforms only. It does not add a manual asset upload path. The Spine-format export remains experimental until validated with the matching licensed Spine 4.2 Runtime.</p>
      </aside>
    </section>
  </main>;
}
