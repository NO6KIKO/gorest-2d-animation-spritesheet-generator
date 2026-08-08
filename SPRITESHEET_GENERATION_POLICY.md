# Spritesheet Generation Policy

Use this file only when creating, editing, or debugging character/creature/mascot spritesheets. The browser is a result viewer; final character animation should come from drawn bitmap art plus deterministic post-processing.

## Non-Negotiables

- Visible character art must come from a finely drawn image-generation/redraw process.
- Do not use SVG, Canvas, PIL, CSS, procedural lines, local warps, puppet rigs, bobbing, rotation, or overlays as final character art.
- Code is allowed only after the art is drawn: chroma removal, alpha cleanup, grid/cell detection, uniform scaling, anchor normalization, packing, preview generation, and JSON wiring.
- Require extremely high clarity: sharp anime line work, eyes, tears, hair strands, mouth shapes, hands, accessories, fabric texture, and clean edges.
- Prefer downsampling from high-detail source art. Do not upscale blurry low-resolution frames and call them production-ready.
- Preserve identity, outfit, palette, silhouette, and proportions across all frames.

## Prompt Requirements

For redraw spritesheets, include:

- same character identity, outfit, palette, proportions, camera, framing, and scale across all cells
- extremely high clarity and crisp face/eye/hair/clothing details
- no simple/vector/flat/sketch/low-detail style unless requested
- no squashing, stretching, or chibi conversion unless requested
- stable frame registration: no random position jumps, camera shifts, or scale changes
- safe per-cell framing: the complete silhouette, including ears, hair, tail, feet, weapons, and effects, must occupy at most about 75% of each cell width and height
- keep at least 12% flat background between the complete silhouette and every cell edge; never touch or cross a cell boundary

For walk/run cycles, request actual key poses:

- 16-frame loop when possible
- contact, down, passing, up, opposite contact, opposite down, opposite passing, opposite up
- frame 16 should be the in-between before frame 1, not a duplicate held frame
- feet/hips should form a coherent gait; reject random pose variants

## Reference-Image Protocol

- Use the reference as identity/style anchor.
- Establish or preserve a canonical frame before generating motion.
- Do not turn a front-facing reference into side-view motion unless asked.
- A side-view walk from a front-only reference requires a separate turnaround/redesign step.

## Three-Row Object Rotate Mode

Treat requests such as `rotate`, `turntable`, `360 view`, `360-degree rotation`,
`three-row rotate`, `三行旋转`, `三行转台`, `环绕查看`, or `旋转视图` as an
**object-rotate spritesheet** when the user wants to inspect one character or
object from multiple directions. A short prompt such as “make this character
rotate in three rows” is sufficient; do not require the user to describe the
grid or interaction implementation.

Default object-rotate specification:

- Use three long horizontal rows and 16 columns: `16 x 3 = 48` unique views.
- Each row is one independently drawn camera-elevation layer, ordered top to
  bottom as `+30`, `0`, and `-30` degrees unless the reference requires a
  different declared set.
- Within every row, render a complete 360-degree horizontal turntable in
  consistent 22.5-degree azimuth steps from `0` through `337.5` degrees.
- The same column in all three rows must represent the same azimuth.
- Preserve character identity, pose, outfit/materials, palette, proportions,
  lighting, scale, and anchor across every view.
- Every cell must contain a genuinely drawn viewpoint. Do not create views by
  rotating, warping, mirroring, or overlaying one bitmap with code.
- Pack frames in row-major order with `gridColumns: 16`, `frameCount: 48`,
  `viewAzimuthFrames: 16`, `viewElevationFrames: 3`,
  `viewElevationAngles: [30, 0, -30]`, and `viewInitialElevation: 1`.
- Use `generationMode: "object-rotate"` and `viewMode: "object-rotate"` so the
  browser enables drag-to-rotate behavior instead of ordinary frame playback.
- Direct-manipulation input must match the viewer: horizontal drag wraps around
  the 16 azimuth views, while vertical drag selects among the three elevation
  rows using the viewer's object-rotate direction convention.

Object-rotate is not a normal animation spritesheet:

- Do not classify it as idle, walk, run, attack, expression, or another
  timeline animation.
- Do not auto-play all 48 frames as one animation loop; that would incorrectly
  sweep through elevation jumps between rows.
- Do not infer object-rotate from a generic request for a “spritesheet” alone.
  Use it only when the prompt includes rotation, turntable, multi-angle, 360,
  orbit, or equivalent intent.
- Conversely, `rotate` in the context of a character action (for example a
  spinning attack or rolling animation) remains a normal timeline animation
  unless the user asks for multi-angle viewing.
- Store elevation and azimuth metadata in the manifest so row meaning does not
  depend on the packed image layout alone.

## Normalization Rules

Always normalize redrawn sheets before final display:

1. Remove chroma/background first when needed.
2. Detect real source cells before splitting; do not assume a perfect equal grid unless detection fails.
3. Measure alpha or foreground clusters for every cell.
4. Reject and regenerate any source cell whose real alpha/foreground touches or comes within 2 px of a detected cell edge. Normalization cannot restore art that was already cut off.
5. Use one global uniform scale unless fixing a known source-generation error with documented metadata.
6. Preserve a final transparent safety border of roughly 8-10% of the shorter frame edge on every side. Derive the global scale from all frames and all sides of the shared anchor; do not clamp or recenter frames independently.
7. Use a stable root/face/head anchor appropriate to the asset:
   - full-body walk/run: root or upper-torso anchor, usually with bottom/feet kept inside frame
   - portrait/facial expression: face/head anchor and fixed head size
   - prop/static sprite: visible bbox centering is acceptable
8. Keep the requested final frame size, commonly 512x512 for high-detail portraits or 256x256 for compact game sprites.
9. Store useful metadata: `generationMode`, `sourceCells`/`gridDetection`, `frameSize`, `sheetSize`, `qualityPolicy`, `proportionPolicy`, `rootAnchorPolicy` or face/head-anchor policy, `safePadding`, `sourceEdgeRisks`, and raw sheet path.

## Auto Grid Detection

Before reading generated sheets:

- Analyze source geometry after background removal.
- Compute foreground projections or connected components.
- Derive row/column boundaries from real sprite clusters and gaps.
- Fall back to proportional splitting only when cluster detection fails.
- This prevents uneven generated spacing from causing cropped limbs, white/green edges, or animation jumps.

## Forbidden Final Outputs

- Whole-image drifting, floating, bobbing, scaling, or rotation as a character motion cycle.
- Fake expression changes drawn with code over one still image.
- Per-frame bbox centering for walk cycles; moving limbs must not drag the whole character.
- Non-uniform character scaling (`scaleX`/`scaleY`) that changes proportions.
- Low-detail or smeared faces, tears, hair, hands, or fabric.

## Acceptance Checks

- Inspect the final sheet at 100% scale, preferably on a dark background for transparency.
- Check hair edges, eyes, tears, mouth, hands, accessories, clothing, and alpha cleanup.
- Scrub/preview the animation for root drift, Y bounce, head-size pops, loop seams, and camera jumps.
- Keep raw and normalized sheets for debugging.
