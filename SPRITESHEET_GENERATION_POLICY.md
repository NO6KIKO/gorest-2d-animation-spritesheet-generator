# Spritesheet Generation Policy

This project treats the browser as a result viewer. For character motion requests from a reference image, especially walking/running cycles, do not use local pseudo-rig deformation as the final output.

## Required path for reference-image walking/running

Use Codex image redraw generation to create one complete spritesheet image first, then store and display it:

1. Use the reference image as identity guidance.
2. Generate one large 4x4 or 4x3 redrawn spritesheet image.
3. Preserve character identity, outfit, palette, and proportions across all cells.
4. Each cell must be a real redrawn animation frame, not a warped copy of the source image.
5. Remove chroma-key/background locally when needed.
6. Save the final transparent PNG under `public/generated/`.
7. Write `public/generated/latest_sprite.json` with `generationMode: "codex_image_redraw_spritesheet"`.
8. The browser reads `/api/spritesheet/latest` and only displays/slices/downloads the result.

## Forbidden as final output

- Whole-image drifting, floating, bobbing, scaling, or rotation as a walking cycle.
- Local pseudo-rig cutting of a single front-facing image into torso/arms/legs for final walking output.
- Returning `local_reference_image_spritesheet` for reference-image walk/run requests.

Local procedural or pseudo-rig methods are acceptable only for quick non-walk previews or explicit draft/debug output.

## Post-processing requirements for redrawn sheets

Every redrawn spritesheet must be normalized before it is shown as the final browser result:

1. Split the generated sheet by proportional 4x4 or 4x3 grid boundaries.
2. Remove chroma/background first when needed.
3. Measure the visible alpha bounding box for every cell.
4. Use one global scale for all frames, never per-frame scaling.
5. Place every frame on a strict 256x256 transparent canvas.
6. Use bottom-center anchoring for full-body character sprites.
7. Save the normalized sheet as a 1024x1024 PNG for 16 frames or a 1024x768 PNG for 12 frames.
8. Update `latest_sprite.json` so `spritesheetPng` points to the normalized sheet.
9. Keep the raw generated sheet as `rawSpritesheetPng` for inspection.

## Continuity requirements for redraw prompts

A walking cycle prompt must request actual key poses, not just generic walking:

- 16 frames in a loopable cycle.
- Include contact, down, passing, up, opposite contact, opposite down, opposite passing, opposite up poses.
- Feet must alternate and visibly contact the ground.
- Body height must change smoothly, no random position jumps.
- Outfit, hair, face, palette, and proportions must remain consistent.
- Same camera, same framing, same scale, full body visible in every cell.
- Reject or regenerate if frames are just pose variants with no coherent gait.

## Reference continuity protocol

For a supplied character reference image, do not generate a full walking sheet as an unconstrained one-shot unless the user explicitly accepts rough drafts.

Use this sequence instead:

1. Establish a canonical frame from the reference image first.
   - Same identity, hair, face, clothing, colors, body proportions, and accessories.
   - Same scale and full-body framing.
   - This is frame 1 / the identity lock.

2. Decide the walking camera before generation.
   - If the reference is front-facing, default to a front-facing walk-in-place / march cycle.
   - Do not suddenly convert a front reference into a side-view walk unless the user asks for side view.
   - Side-view walking from a front-only reference requires a separate character-turnaround/redesign step.

3. Generate key poses before filling all frames.
   Required 8-pose loop structure for a 16-frame walk:
   - 1: contact pose, matches canonical identity closely
   - 3: down pose
   - 5: passing pose
   - 7: up pose
   - 9: opposite contact pose
   - 11: opposite down pose
   - 13: opposite passing pose
   - 15: opposite up pose
   Frames 2/4/6/8/10/12/14/16 are in-betweens.

4. Tail-frame rule.
   - Do not make frame 16 identical to frame 1.
   - Frame 16 should be the in-between immediately before frame 1, so playback loops smoothly without a held duplicate.
   - If using a duplicated first frame for preview, exclude the duplicate from the exported spritesheet.

5. Continuity checks before accepting output.
   - Frame 1 and frame 16 must be visually adjacent in motion.
   - No sudden camera angle change.
   - No random outfit/accessory changes.
   - Feet and hips must progress through a coherent gait.
   - If the model changes identity or perspective, reject and regenerate with stricter key-pose guidance.

## Character scale and proportion lock

For any user-supplied character image, preserve the original character proportions as a hard invariant.

Rules:

1. Never use non-uniform scaling on a character.
   - Forbidden: separate `scaleX` and `scaleY` for fitting a person into a cell.
   - Forbidden: CSS/SVG/image resizing that changes the character aspect ratio.
   - Required: one uniform scale value applied equally to width and height.

2. Preserve the input character's full-body proportion.
   - Head-to-body ratio, leg length, shoulder width, clothing silhouette, and shoe size must remain consistent with the supplied reference unless the user explicitly asks for stylization.
   - Do not compress tall portrait characters into a squat sprite.
   - Do not stretch short/wide characters into a tall sprite.

3. The 256x256 cell is a container, not a shape constraint.
   - Fit the full character inside the cell with padding.
   - Use transparent margins when needed.
   - Do not distort the character to fill the square.

4. Normalization must use uniform scaling.
   - Measure alpha bounding boxes per cell.
   - Pick one global uniform scale for the whole sheet.
   - Place each frame with a stable bottom-center anchor.
   - Never resize a frame independently in a way that changes relative character scale.

5. Prompt requirement for redraws.
   Every character redraw spritesheet prompt must include:
   - preserve original body proportions and silhouette
   - no squashing, stretching, or chibi conversion unless requested
   - same height-to-width ratio across all frames
   - full body visible with transparent padding instead of distortion

6. Manifest requirement.
   `latest_sprite.json` should include `proportionPolicy: "uniform_scale_preserve_input_character_proportions"` for accepted character spritesheets.

## Root anchor stability

For character walking/running spritesheets, the character must stay fixed in the frame. Legs and arms may move, but the body/root position must not drift.

Required normalization:

1. Do not center each frame using the full-body bounding box. A stepping leg changes the bbox and causes visible drift.
2. Estimate a stable root anchor from the upper body/head/torso region.
3. Align every frame to the same root anchor coordinate, usually around the visual body center.
4. Preserve one global uniform scale across all frames.
5. Keep bottom/feet inside the cell with padding, but do not let moving feet drag the body center.
6. Store `rootAnchorPolicy` in `latest_sprite.json` for any accepted walking spritesheet.

Forbidden:

- Per-frame bbox centering for walk cycles.
- Letting a forward foot or wide pose shift the entire character left/right.
- Making the character root float across frames.

## Auto grid detection before reading frames

Before reading or normalizing a generated spritesheet, analyze the source image geometry instead of assuming a perfect equal grid.

Required process:

1. Remove the chroma/background first so sprite pixels are detectable.
2. Read the full image width and height.
3. Compute alpha-pixel projections on X and Y axes.
4. Detect visible sprite clusters and the transparent gaps between them.
5. Derive row/column boundaries from the distances between cluster centers.
6. Only fall back to proportional 4x4/4x3 splitting if cluster detection fails.
7. Store the detected `sourceCells`, `gridDetection`, and `gridPolicy` in `latest_sprite.json`.
8. Normalize after detection using global uniform scale and fixed root anchor.

This prevents generated sheets with uneven margins or spacing from being cut at the wrong positions.
