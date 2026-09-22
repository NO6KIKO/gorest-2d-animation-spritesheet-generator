# Clock Tower Scene — Image Generation Notes

Built-in image generation was used for all visible artwork. The user's screenshot was used only as a broad visual-style reference; no screenshot UI, text, characters, signage, or identifiable building design was copied.

## Background

- Original 16:9, side-on, stage-like interior of an old stone-and-timber clock tower at dusk.
- Symmetrical framing, arched windows, distant rooftops, dark wood, modest gearwork, paper grain, deep teal shadows, and selective amber light.
- The central mounting bay was intentionally left without a bell so the interactive animated layer can occupy it without a double image.
- No people, text, logo, watermark, UI, modern objects, or church iconography.

## Bell spritesheet

- One antique bronze bell with a fixed wooden yoke, internal clapper, and side striking hammer.
- Eight sequential frames in a 4 x 2 grid: rest, draw-back, acceleration, impact glint, rebound/swing, clapper contact, diminishing oscillation, return to rest.
- Same identity, ornament, patina, scale, camera, dusk lighting, and top-center yoke anchor in every frame.
- Flat magenta chroma source with generous cell gutters; no text, numbers, borders, watermark, checkerboard, or background scenery.

## Deterministic post-processing

`scripts/normalize_spritesheet.py` removes the magenta key, detects the real gaps between the generated drawings instead of assuming equal source cells, checks source edges, applies one shared anchor and one global scale, then packs eight transparent 384 x 512 frames into the final 1536 x 1024 sheet. `scripts/cleanup_clock_tower_bell_alpha.py` removes residual edge spill from the magenta matte. The generated manifest records the exact source boundaries and frame boxes and reports zero source-edge risks.
