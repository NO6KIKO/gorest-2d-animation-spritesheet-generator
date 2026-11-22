import type { RigAnimationSummary, RigEntry, RigLibrary, AttachmentKey, Vec2Key, ScalarKey, DrawOrderKey, RuntimeTransform, RigAttachment, RigSlot, PlaybackMode, BoneTimeline, ClipPlaybackDefaults, RigClip, RigBone, RigPosePreset, RigManifest, EditorTransform, TransformMap, RandomPhase, AnimationPlayback, PlaybackMap, AttachmentOverrides, BonePose, BonePivot, ClipClaim } from "../types";

export const IDENTITY: EditorTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
export const IDENTITY_BONE_POSE: BonePose = { translate: [0, 0], rotate: 0, scale: [1, 1] };
export const DEFAULT_RANDOM_DELAY: [number, number] = [2.5, 6.5];
export const DEFAULT_REPEAT_DELAY: [number, number] = [0.08, 0.16];

export function resolveTimeline(timeline: AttachmentKey[] | undefined, time: number, fallback: string) {
  let attachment = fallback;
  for (const [keyTime, keyAttachment] of timeline || []) {
    if (keyTime > time) break;
    attachment = keyAttachment;
  }
  return attachment;
}

export function resolveVec2Timeline(
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

export function resolveScalarTimeline(timeline: ScalarKey[] | undefined, time: number) {
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

export function resolveDrawOrderTimeline(timeline: DrawOrderKey[] | undefined, time: number, fallback: string[]) {
  let order = fallback;
  for (const [keyTime, keyOrder] of timeline || []) {
    if (keyTime > time) break;
    order = keyOrder;
  }
  const known = new Set(fallback);
  const resolved = [...new Set(order.filter(name => known.has(name)))];
  return [...resolved, ...fallback.filter(name => !resolved.includes(name))];
}

export function timelineForSlot(clip: RigClip, slotName: string) {
  const slotTimeline = clip.attachmentTimelines?.[slotName];
  if (slotTimeline !== undefined) return slotTimeline;
  if (slotName === "eyes") return clip.eyeTimeline;
  if (slotName === "mouth") return clip.mouthTimeline;
  return undefined;
}

export function controlledSlots(clip: RigClip, slots: RigSlot[]) {
  return slots.filter(slot => timelineForSlot(clip, slot.name) !== undefined).map(slot => slot.name);
}

export function clipClaims(clip: RigClip, slots: RigSlot[]): ClipClaim[] {
  const claims = controlledSlots(clip, slots).map<ClipClaim>(slot => `slot:${slot}:attachment`);
  for (const [bone, timeline] of Object.entries(clip.boneTimelines || {}) as [string, BoneTimeline][]) {
    if (timeline.translate !== undefined) claims.push(`bone:${bone}:translate`);
    if (timeline.rotate !== undefined) claims.push(`bone:${bone}:rotate`);
    if (timeline.scale !== undefined) claims.push(`bone:${bone}:scale`);
  }
  if (clip.drawOrderTimeline !== undefined) claims.push("draw-order");
  return claims;
}

export function claimsConflict(left: ClipClaim[], right: ClipClaim[]) {
  const occupied = new Set(left);
  return right.some(claim => occupied.has(claim));
}

export function playbackMode(clip: RigClip): PlaybackMode {
  const configured = clip.playback?.mode;
  return configured === "once" || configured === "loop" || configured === "random"
    ? configured : clip.loop ? "loop" : "once";
}

export function clampSpeed(value: unknown) {
  return Math.max(0.1, Math.min(4, finite(value, 1)));
}

export function delayRange(value: unknown, fallback: [number, number]): [number, number] {
  if (!Array.isArray(value)) return fallback;
  const first = Math.max(0.02, Math.min(60, finite(value[0], fallback[0])));
  const second = Math.max(0.02, Math.min(60, finite(value[1], fallback[1])));
  return first <= second ? [first, second] : [second, first];
}

export function randomDelay(range: [number, number]) {
  return range[0] + Math.random() * (range[1] - range[0]);
}

export function defaultPlayback(clip: RigClip, enabled: boolean, activationOrder: number): AnimationPlayback {
  const mode = playbackMode(clip);
  return {
    enabled, playing: enabled, elapsed: 0, speed: clampSpeed(clip.playback?.speed), mode,
    randomPhase: mode === "random" ? "wait" : "burst",
    waitRemaining: mode === "random" ? randomDelay(delayRange(clip.playback?.randomDelay, DEFAULT_RANDOM_DELAY)) : 0,
    randomCanRepeat: true, activationOrder,
  };
}

export function isTransientOverlay(clip: RigClip, mode: PlaybackMode) {
  return mode === "once" && clip.playback?.transient === true;
}

export function initialPlayback(animations: RigClip[], slots: RigSlot[], defaultAnimation: string): PlaybackMap {
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

export function playbackSampleTime(state: AnimationPlayback) {
  return state.mode === "random" && state.randomPhase === "wait" ? 0 : state.elapsed;
}

export function isDormantRandomWait(state: AnimationPlayback) {
  return state.mode === "random" && state.randomPhase === "wait";
}

export function finite(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function fromRuntimeTransform(transform?: RuntimeTransform): EditorTransform {
  return {
    x: finite(transform?.translate?.[0], 0),
    y: finite(transform?.translate?.[1], 0),
    scaleX: finite(transform?.scale?.[0], 1),
    scaleY: finite(transform?.scale?.[1], 1),
  };
}

export function attachmentOptionsForSlot(manifest: RigManifest, slot: RigSlot) {
  const names = new Set<string>([slot.attachment, ...(slot.variants || [])]);
  for (const clip of manifest.animations) {
    for (const [, attachment] of timelineForSlot(clip, slot.name) || []) names.add(attachment);
  }
  return [...names].filter(name => Boolean(manifest.attachments[name]));
}

export function buildBonePivots(bones: RigBone[] | undefined) {
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

export function boneChain(name: string, pivots: Record<string, BonePivot>) {
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

/** Advance one frame. Paused tracks retain their identity and do not claim a new render. */
export function advancePlayback(previous: PlaybackMap, animations: RigClip[], delta: number): PlaybackMap {
  let changed = false;
  const next = { ...previous };
  for (const clip of animations) {
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

}
