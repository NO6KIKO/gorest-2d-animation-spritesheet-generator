export type RigAnimationSummary = { name: string; loop?: boolean };
export type RigEntry = {
  id: string; name: string; characterName?: string; description?: string; focus?: string;
  thumbnailUrl: string; previewSheetUrl?: string; rigManifestUrl: string;
  spineJsonUrl?: string; spineAtlasUrl?: string; spineTextureUrl?: string;
  frameSize: [number, number]; frameCount: number; fps: number;
  animations: RigAnimationSummary[]; defaultAnimation: string; tags?: string[];
};
export type RigLibrary = { schemaVersion: number; rigs: RigEntry[] };
export type AttachmentKey = [time: number, attachment: string];
export type Vec2Key = [time: number, x: number, y: number];
export type ScalarKey = [time: number, value: number];
export type DrawOrderKey = [time: number, slots: string[]];
export type RuntimeTransform = { translate: [number, number]; scale: [number, number] };
export type RigAttachment = {
  file: string; canvas: [number, number]; anchor: [number, number];
  runtimeTransform?: RuntimeTransform;
  mesh?: import('./model/weightedMesh').WeightedMesh;
};
export type RigSlot = { name: string; bone: string; attachment: string; variants?: string[] };
export type PlaybackMode = "once" | "loop" | "random";
export type BoneTimeline = { translate?: Vec2Key[]; rotate?: ScalarKey[]; scale?: Vec2Key[] };
export type ClipPlaybackDefaults = {
  mode?: PlaybackMode; speed?: number; autoStart?: boolean; transient?: boolean;
  randomDelay?: [minSeconds: number, maxSeconds: number];
  randomRepeatChance?: number; randomRepeatDelay?: [minSeconds: number, maxSeconds: number];
  repeatChance?: number; repeatDelay?: [minSeconds: number, maxSeconds: number];
};
export type RigClip = {
  name: string; category?: string; duration: number; loop?: boolean;
  attachmentTimelines?: Record<string, AttachmentKey[]>;
  eyeTimeline?: AttachmentKey[]; mouthTimeline?: AttachmentKey[];
  boneTimelines?: Record<string, BoneTimeline>;
  drawOrderTimeline?: DrawOrderKey[];
  playback?: ClipPlaybackDefaults;
};
export type RigBone = { name: string; parent?: string; x?: number; y?: number; pivot?: [number, number] };
export type RigPosePreset = { id: string; name: string; attachments: Record<string, string> };
export type RigManifest = {
  schemaVersion: number; id?: string; runtime: string;
  attachments: Record<string, RigAttachment>; slots: RigSlot[]; animations: RigClip[];
  editorTransforms?: Record<string, RuntimeTransform>;
  bones?: RigBone[]; posePresets?: RigPosePreset[];
};
export type EditorTransform = { x: number; y: number; scaleX: number; scaleY: number };
export type TransformMap = Record<string, EditorTransform>;
export type RandomPhase = "wait" | "burst";
export type AnimationPlayback = {
  enabled: boolean; playing: boolean; elapsed: number; speed: number; mode: PlaybackMode;
  randomPhase: RandomPhase; waitRemaining: number; randomCanRepeat: boolean; activationOrder: number;
};
export type PlaybackMap = Record<string, AnimationPlayback>;
export type AttachmentOverrides = Record<string, string>;
export type BonePose = { translate: [number, number]; rotate: number; scale: [number, number] };
export type BonePivot = { x: number; y: number; parent?: string };
export type ClipClaim = `slot:${string}:attachment` | `bone:${string}:translate` | `bone:${string}:rotate` | `bone:${string}:scale` | "draw-order";
