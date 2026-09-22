# Wei Yang / Front Cutout Walk Spine

Front-facing 12 fps walk loop for the silver-haired schoolgirl. The character
uses 16 independent transparent region attachments on 18 parented bones.

## Spine 4.2 bundle

- `wei-yang-front-cutout-rig.json`
- `wei-yang-front-cutout-rig.atlas`
- `wei-yang-front-cutout-rig.png`

The `walk_front` animation is an 8-pose, 0.666667-second loop. It animates 17
bones with translate, rotate, and scale timelines and swaps the leading-leg
draw order at the passing poses.

## Editable sources and preview

- `attachments/`: 16 registered 640 x 1152 RGBA cutout parts
- `rig.json`: Gorest live-preview manifest
- `neutral_composite.png`: setup-pose assembly
- `sources/`: canonical identity reference, ImageGen component sheet, extracted
  alpha sheet, and the exact generation prompts
- `qa_bundle_report.json`: deterministic structure and asset checks

This is a rigid region-attachment cutout rig. It intentionally does not use
weighted meshes or IK. Validate it with the matching licensed Spine 4.2
runtime before shipping a game build.
