import type { StartUiSplitResult } from "./startUiArtworkProcessing";

export function formatStartUiSplitStatus(split: StartUiSplitResult) {
  if (!split.usedSmartDetection) {
    return "Template split was used because no clear UI regions were detected.";
  }
  const suffix = split.detectedRegionCount === 1 ? "" : "s";
  return `Smart split detected ${split.detectedRegionCount} editable UI region${suffix}.`;
}
