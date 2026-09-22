# Spade King Duel — ImageGen source notes

Generation mode: built-in ImageGen, guided by the supplied playing-card image as a high-level style and composition reference only. The people, clothing details, border ornament, and corridor design are original.

## Empty card background

Create an original vertical aged-ivory playing card, perfectly front-on against matte black. Use restrained Art Deco ink borders and a large central oval window into an empty, symmetrical retro-futurist corridor with ribbed panels, ceiling lights, and a distant centered door. Render it in sepia charcoal, fine engraved crosshatching, and weathered lithographic paper texture. Leave clean empty index panels at upper-left and lower-right. No people, silhouettes, weapons, letters, numbers, suits, logos, or watermark.

The generated empty background is preserved at:

`/generated/sources/spade_king_duel_card_background_raw.png`

Exact `K` and `♠` indices were composited afterward by `scripts/prepare_spade_king_card_background.py`; no environment art was programmatically drawn or altered.

## Two-character raise-guns spritesheet

Create exactly 8 sequential frames in a 4-column by 2-row sheet, read left-to-right, top-to-bottom. Every frame contains the same two original full-body adult men in profile, facing one another at fixed positions and scale. The left character wears a fitted charcoal suit and uses his right hand; the right character is slightly taller, wears a calf-length black coat, and uses his left hand. Preserve faces, hair, proportions, clothing, shoes, weapon designs, camera, baseline, and spacing in every frame.

Sequence: (1) hands and pistols lowered, (2) begin lifting, (3) low-ready, (4) forearms at lower chest, (5) muzzles pass upward through roughly 45 degrees, (6) arms nearly horizontal, (7) fully extended mutual aim, (8) settled final aim. Both characters move synchronously. No firing, recoil, muzzle flash, smoke, casings, impact, injury, blood, or gore.

Style: refined sepia charcoal and black-ink illustration with engraved hatching, matching the background. Canvas must be a perfectly uniform `#FF00FF` chroma field, including gutters. No floor, shadow, scenery, cell borders, labels, symbols, logo, or watermark. Exactly two people and two pistols per cell. Keep complete heads, hands, pistols, coat hems, legs, and shoes safely inside every cell.

The generated chroma source is preserved at:

`/generated/sources/spade_king_duel_pair_raise_8f/spade_king_duel_pair_raise_4x2_chroma.png`

Code was used only for chroma removal, edge cleanup, one global uniform scale, shared lower-body X registration, fixed feet baseline, safe padding, and row-major packing.
