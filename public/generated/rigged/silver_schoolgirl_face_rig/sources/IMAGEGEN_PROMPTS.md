# Silver Schoolgirl rig extension — image generation sources

Generated with the built-in Codex image-generation tool on 2026-08-15. The chroma and alpha outputs in this directory are retained as reproducible source art; the rebuild script performs only chroma removal, registration, layer splitting, packing, and metadata generation.

## Registered action sheet

Reference: the earlier `silver_face_expressions_4x2_chroma.png` identity/layout sheet.

```text
Use case: identity-preserve
Asset type: registered 4-by-2 facial-action spritesheet source for a layered 2D game rig
Input images: Image 1 is the edit target, exact character identity reference, art-style reference, camera reference, registration reference, and 4-by-2 layout reference.
Primary request: Keep the exact same silver-haired schoolgirl in the exact same front-facing bust pose and replace only her facial features in eight cells.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background in every cell; uniform color only; no shadows, gradients, texture, reflections, floor plane, or lighting variation.
Style/medium: finely drawn high-detail anime raster illustration matching Image 1 exactly; crisp eyes, irises, eyelashes, eyebrows, lips, hair strands, clothing lines, and clean color edges.
Composition/framing: exactly 4 columns by 2 rows; one centered bust per cell; identical head size, body size, scale, camera, framing, anchor, and pixel registration in all eight cells.
Cell actions, left to right:
Top row cell 1: neutral face, both eyes look clearly toward the character's left; change only iris/pupil direction.
Top row cell 2: neutral face, both eyes look clearly toward the character's right; change only iris/pupil direction.
Top row cell 3: neutral face, both eyes look clearly upward; change only iris/pupil direction.
Top row cell 4: neutral face, both eyes look clearly downward; change only iris/pupil direction.
Bottom row cell 1: happy expression with softly relaxed eyes, neutral-soft brows, and a clearly drawn gentle upward smile.
Bottom row cell 2: surprised expression with wide open eyes, clearly raised eyebrows, and a small round O-shaped surprised mouth.
Bottom row cell 3: angry expression with focused eyes, both eyebrows drawn inward and downward, and a clearly drawn tight displeased mouth.
Bottom row cell 4: sad/worried expression with soft open eyes, both eyebrows drawn upward toward the inner corners, and a clearly drawn downturned mouth; no tears.
Constraints: change only eyes, eyebrows, and mouth; preserve the exact face shape, skin tone, nose, hair, outfit, shoulders, silhouette, palette, lighting, line weight, rendering detail, and cell registration from Image 1. Do not redesign the character. Do not shift, crop, rescale, rotate, squash, stretch, or change the camera. Keep generous flat green clearance around every bust. No text, labels, watermark, extra objects, extra characters, panel borders, or non-green background. Do not use #00ff00 anywhere in the character.
```

## Pure component sheet

Reference: `silver_face_actions_4x2_chroma.png` from the first generation.

```text
Use case: identity-preserve
Asset type: clean modular facial-feature component board for a layered 2D anime game rig
Input image: Image 1 is the exact character identity, eye style, eyebrow style, mouth style, color, and expression reference.
Primary request: Create one perfectly regular 4-column by 3-row component board on a flat solid #00ff00 background. Draw ONLY floating facial feature pixels. Do not draw any face skin, head, hair, nose, ears, neck, clothing, body, shadows, labels, borders, panel lines, or text.
Layout and cell content, left to right:
Row 1: a matched pair of this character's complete open eyes looking left; matched pair looking right; matched pair looking up; matched pair looking down. Each eye pair must include the full white sclera, magenta iris, pupil, highlights, upper/lower lash lines and nothing else. Keep both eyes separated with ample green space.
Row 2: a matched pair of this character's eyebrows raised; matched pair angled inward/down for anger; matched pair raised toward the inner corners for worried/sad; matched pair neutral. Eyebrows only, no eyes, eyelids, bangs, or skin.
Row 3: this character's gentle smiling mouth; small round surprised O mouth; tight displeased/angry mouth; downturned sad mouth. Mouth only, one centered mouth per cell, no nose, chin, skin, blush, or face outline.
Style/medium: match Image 1's high-detail crisp anime raster linework and colors exactly. Clean opaque feature interiors with smooth antialiased edges suitable for chroma removal.
Composition: exact equal-size cells, consistent feature scale across each row, centered within every cell, generous uniform #00ff00 clearance around each feature. The eye and eyebrow pairs must maintain the same left/right spacing and proportions as Image 1. No cell may contain anything except the requested feature and flat green.
Constraints: no full faces or portraits; no skin-colored plate behind the eyes, brows, or mouth; no hair strokes; no extra eyelashes outside the requested eyes; no text, symbols, watermark, decorative UI, background variation, gradient, texture, lighting, or shadow. Do not use #00ff00 inside any feature.
```
