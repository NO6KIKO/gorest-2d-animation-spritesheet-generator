# Wei Yang front cutout source prompts

Generation mode: OpenAI built-in ImageGen, identity-preserving edit from
`/generated/wei_yang_idle_front_source_clean.png`.

## Component sheet

Create an identity-preserving production cutout sheet for a 2D Spine rig from the attached canonical character reference. Preserve the exact same young woman: silver-white short bob haircut with straight bangs, mauve-pink eyes, dark forest-green double-breasted school uniform jacket and vest, white shirt, dark tie, gray pleated skirt, gold sleeve badge, brown crossbody satchel, black knee socks, and black double-strap loafers. Front-facing orthographic view, neutral expression, clean anime game-art rendering, consistent lighting and linework.

Place exactly 16 disconnected body components in a clean 4 x 4 invisible grid, centered inside each cell with generous transparent-looking checkerboard margins and no overlaps between cells. Row 1: head with hair and face (no neck), sleeveless torso/jacket/neck/shirt/tie with the diagonal bag strap but no arms, skirt, satchel with strap tail. Row 2: anatomical left upper arm, anatomical left forearm/sleeve, anatomical left hand, anatomical right upper arm with the gold badge. Row 3: anatomical right forearm/sleeve, anatomical right hand, anatomical left bare thigh, anatomical left lower leg with black knee sock. Row 4: anatomical left shoe/foot, anatomical right bare thigh, anatomical right lower leg with black knee sock, anatomical right shoe/foot.

Each limb part must be drawn straight in a neutral front pose and include hidden overlap beyond both joint boundaries so rotations never reveal gaps. Preserve front/back orientation and left/right costume details. No labels, numbers, guide lines, grid lines, shadows, ground, scenery, extra objects, duplicate parts, or assembled full character. True transparent background outside every component.

## Transparency cleanup edit

Remove only the baked checkerboard background from this component sheet and return genuine transparent alpha outside all 16 character components. Preserve every component exactly: same pixels, proportions, linework, colors, placement, 4 x 4 arrangement, and no cropping. Do not add, redraw, move, merge, label, or omit anything. Output RGBA PNG with a fully transparent background.

The service returned a flattened neutral checker for both generations. The build script therefore performs deterministic connected-component background extraction, alpha cleanup, uniform scaling, fixed-canvas registration, atlas packing, and metadata wiring. It does not draw or reconstruct character art.
