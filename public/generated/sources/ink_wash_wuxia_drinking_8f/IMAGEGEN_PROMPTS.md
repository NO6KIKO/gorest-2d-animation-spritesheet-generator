# Ink-wash wuxia drinking scene — ImageGen source notes

Generation mode: built-in ImageGen. The user-supplied four-panel image was used only as the character identity, costume, brushwork, mood, and drinking-action reference. The final scene assets are newly generated artwork.

## Drinking character spritesheet

Create exactly 8 genuinely redrawn sequential animation frames arranged as a strict 4-column by 2-row spritesheet, read left-to-right and top-to-bottom. Show the same adult Chinese wuxia man drinking from the same small dark ceramic wine cup.

Sequence: cup held calmly at upper chest; hand raises cup; cup approaches lips; first sip; drinking with a subtle head tilt; cup leaves lips and begins lowering; cup lowered with a faint relaxed smile; settle smoothly toward the first frame for a seamless loop.

Preserve the reference character's long black half-tied hair, loose windblown strands, refined narrow face, dark layered ancient Chinese robe, calm restrained expression, right-hand cup grip, body proportions, and cup design in every cell. Use extremely clear hand-drawn Chinese ink-wash anime rendering with crisp eyes, individual hair strands, clean hand anatomy, sharp robe folds, and subtle grayscale wash.

Keep a locked front-facing upper-body camera, head size, shoulder position, scale, and registration. Use a perfectly uniform `#FF00FF` chroma background across all cells and gutters. No extra people, limbs, hands, cups, scenery, shadows, dividers, captions, symbols, text, logo, or watermark.

The generated chroma source is preserved at:

`/generated/sources/ink_wash_wuxia_drinking_8f/ink_wash_wuxia_drinking_4x2_chroma.png`

Code was used only for chroma removal, alpha cleanup, proportional 4 x 2 cell detection, one global uniform scale, shared upper-body anchoring, 36-pixel safety padding, and row-major packing.

## Palace terrace background

Create an empty wide 16:9 ancient Chinese palace terrace overlooking a layered distant city. Include a weathered stone parapet, misty rooftops and towers, distant pale mountains, worn banners near the outer edges, and a few windblown autumn leaves. Match the refined ink-wash anime background treatment, cool grayscale palette, and restrained dusty brown-red accents. Keep the center quiet for the animated character. No people, silhouettes, hands, cups, text, panel borders, logos, or watermark.

The generated background is preserved at:

`/generated/ink_wash_palace_terrace_background_1672x941.png`
