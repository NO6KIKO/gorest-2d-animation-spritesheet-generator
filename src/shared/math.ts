export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export const MIN_LAYER_SCALE = 0.05;
export const MAX_LAYER_SCALE = 5;

export function clampLayerScale(value: number) {
  return clamp(value, MIN_LAYER_SCALE, MAX_LAYER_SCALE);
}
