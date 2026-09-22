"""Build a genuine front-facing cutout Spine rig for Wei Yang.

Visible parts are extracted from an identity-preserving ImageGen component
atlas. Code is limited to background removal, alpha cleanup, uniform per-part
scaling, fixed-canvas registration, atlas packing, metadata wiring, and QA.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage


RIG_ID = "wei_yang_front_cutout_walk_rig"
REPLACED_RIG_ID = "wei_yang_fullbody_walk_rig"
RIG_NAME = "Wei Yang / Front Cutout Walk Spine"
PUBLIC_ROOT = f"/generated/rigged/{RIG_ID}"
SPINE_VERSION = "4.2.22"
CANVAS = (640, 1152)
FPS = 12
FRAME_COUNT = 8
DURATION = round(FRAME_COUNT / FPS, 6)
TIMES = [round(index / FPS, 6) for index in range(FRAME_COUNT + 1)]


@dataclass(frozen=True)
class PartSpec:
    name: str
    cell: int
    bone: str
    target: tuple[int, int, int, int]
    fill_holes: bool = False
    crop_top_fraction: float = 0.0


# Anatomical left is viewer-right; anatomical right is viewer-left.
PARTS = [
    PartSpec("head", 0, "head", (230, 52, 180, 198), True),
    PartSpec("torso", 1, "torso", (218, 238, 204, 318), True),
    PartSpec("skirt", 2, "skirt", (198, 520, 244, 190), True),
    PartSpec("bag", 3, "bag", (390, 438, 116, 132), True, 0.42),
    PartSpec("upper_arm_r", 4, "upper_arm_r", (205, 252, 72, 206), True),
    PartSpec("forearm_l", 5, "forearm_l", (396, 411, 56, 181), True),
    PartSpec("hand_l", 6, "hand_l", (405, 558, 44, 85), True),
    PartSpec("upper_arm_l", 7, "upper_arm_l", (363, 252, 72, 206), True),
    PartSpec("forearm_r", 8, "forearm_r", (188, 411, 56, 181), True),
    PartSpec("hand_r", 9, "hand_r", (191, 558, 44, 85), True),
    PartSpec("thigh_l", 10, "thigh_l", (322, 586, 80, 244), True),
    PartSpec("shin_l", 11, "shin_l", (326, 783, 70, 229), True),
    PartSpec("foot_r", 12, "foot_r", (207, 974, 116, 112), True),
    PartSpec("thigh_r", 13, "thigh_r", (238, 586, 80, 244), True),
    PartSpec("shin_r", 14, "shin_r", (244, 783, 70, 229), True),
    PartSpec("foot_l", 15, "foot_l", (317, 974, 116, 112), True),
]


BONES = [
    ("root", None, (320, 1090)),
    ("pelvis", "root", (320, 603)),
    ("torso", "pelvis", (320, 528)),
    ("skirt", "pelvis", (320, 603)),
    ("head", "torso", (320, 245)),
    ("bag", "torso", (425, 470)),
    ("upper_arm_r", "torso", (242, 275)),
    ("forearm_r", "upper_arm_r", (220, 432)),
    ("hand_r", "forearm_r", (207, 566)),
    ("upper_arm_l", "torso", (398, 275)),
    ("forearm_l", "upper_arm_l", (420, 432)),
    ("hand_l", "forearm_l", (433, 566)),
    ("thigh_r", "pelvis", (285, 607)),
    ("shin_r", "thigh_r", (282, 790)),
    ("foot_r", "shin_r", (277, 988)),
    ("thigh_l", "pelvis", (355, 607)),
    ("shin_l", "thigh_l", (358, 790)),
    ("foot_l", "shin_l", (363, 988)),
]


SLOT_ORDER = [
    "bag",
    # Children render behind their parents so the parent artwork hides the
    # deliberately extended overlap at knees, ankles, elbows, and wrists.
    "foot_r", "shin_r", "thigh_r",
    "foot_l", "shin_l", "thigh_l",
    "hand_l", "forearm_l", "upper_arm_l",
    "hand_r", "forearm_r", "upper_arm_r",
    "torso", "skirt",
    "head",
]


RIGHT_LEG_FRONT_ORDER = [
    "bag",
    "foot_l", "shin_l", "thigh_l",
    "foot_r", "shin_r", "thigh_r",
    *SLOT_ORDER[7:],
]


def parse_args() -> argparse.Namespace:
    repo = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--component-atlas",
        type=Path,
        default=repo / "public" / "generated" / "rigged" / RIG_ID / "sources" / "wei_yang_front_cutout_parts_raw.png",
    )
    parser.add_argument(
        "--identity-reference",
        type=Path,
        default=repo / "public" / "generated" / "wei_yang_idle_front_source_clean.png",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=repo / "public" / "generated" / "rigged" / RIG_ID,
    )
    parser.add_argument(
        "--library",
        type=Path,
        default=repo / "public" / "generated" / "rigged_2d_library.json",
    )
    return parser.parse_args()


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def sha256_pixels(image: Image.Image) -> str:
    return hashlib.sha256(image.tobytes()).hexdigest()


def grid_bounds(size: int) -> list[int]:
    return [round(index * size / 4) for index in range(5)]


def largest_subject_mask(rgb: np.ndarray, *, fill_holes: bool) -> np.ndarray:
    high = rgb.max(axis=2)
    low = rgb.min(axis=2)
    mean = rgb.mean(axis=2)
    # The generated source contains a baked neutral checker. Colored/dark pixels
    # seed the subject; the main connected component rejects checker noise.
    seed = ((high - low) > 7) | (mean < 225)
    seed[:2, :] = False
    seed[-2:, :] = False
    seed[:, :2] = False
    seed[:, -2:] = False
    seed = cv2.morphologyEx(seed.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8), iterations=1)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(seed, connectivity=8)
    if count <= 1:
        raise ValueError("No foreground component detected")
    candidates = [(int(stats[index, cv2.CC_STAT_AREA]), index) for index in range(1, count)]
    _, selected = max(candidates)
    mask = labels == selected
    mask = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8), iterations=1) > 0
    if fill_holes:
        mask = ndimage.binary_fill_holes(mask)
    # Remove isolated one-pixel artifacts while retaining crisp drawn edges.
    mask = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8), iterations=1) > 0
    return mask


def extract_part(atlas: Image.Image, spec: PartSpec) -> tuple[Image.Image, dict]:
    xs, ys = grid_bounds(atlas.width), grid_bounds(atlas.height)
    col, row = spec.cell % 4, spec.cell // 4
    cell_box = (xs[col], ys[row], xs[col + 1], ys[row + 1])
    cell = atlas.crop(cell_box).convert("RGB")
    top_cut = round(cell.height * spec.crop_top_fraction)
    working = cell.crop((0, top_cut, cell.width, cell.height))
    rgb = np.asarray(working, dtype=np.uint8)
    mask = largest_subject_mask(rgb, fill_holes=spec.fill_holes)
    coords = np.argwhere(mask)
    if coords.size == 0:
        raise ValueError(f"No subject for {spec.name}")
    top, left = (int(value) for value in coords.min(axis=0))
    bottom, right = (int(value) + 1 for value in coords.max(axis=0))
    pad = 3
    left, top = max(0, left - pad), max(0, top - pad)
    right, bottom = min(working.width, right + pad), min(working.height, bottom + pad)
    crop_rgb = rgb[top:bottom, left:right].copy()
    crop_mask = mask[top:bottom, left:right]
    rgba = np.zeros((bottom - top, right - left, 4), dtype=np.uint8)
    rgba[..., :3] = crop_rgb
    rgba[..., 3] = np.where(crop_mask, 255, 0).astype(np.uint8)
    rgba[~crop_mask, :3] = 0
    part = Image.fromarray(rgba, mode="RGBA")
    return part, {
        "name": spec.name,
        "sourceCellIndex": spec.cell,
        "sourceCell": list(cell_box),
        "sourceCrop": [left, top + top_cut, right, bottom + top_cut],
        "extractedSize": list(part.size),
        "sourceBackground": "baked neutral checker removed by connected foreground extraction",
    }


def fit_part(part: Image.Image, target: tuple[int, int, int, int], name: str) -> tuple[Image.Image, dict]:
    x, y, width, height = target
    scale = min(width / part.width, height / part.height)
    resized = part.resize(
        (max(1, round(part.width * scale)), max(1, round(part.height * scale))),
        Image.Resampling.LANCZOS,
    )
    placement_x = x + (width - resized.width) // 2
    if name == "head":
        placement_y = y + height - resized.height
    else:
        placement_y = y
    canvas = Image.new("RGBA", CANVAS)
    canvas.alpha_composite(resized, (placement_x, placement_y))
    alpha = canvas.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError(f"Registered part {name} is empty")
    return canvas, {
        "targetBox": list(target),
        "uniformScale": round(scale, 6),
        "registeredPlacement": [placement_x, placement_y],
        "registeredSize": list(resized.size),
        "alphaBounds": list(bbox),
        "sha256Pixels": sha256_pixels(canvas),
    }


def compose(attachments: dict[str, Image.Image]) -> Image.Image:
    result = Image.new("RGBA", CANVAS)
    for name in SLOT_ORDER:
        result.alpha_composite(attachments[name])
    return result


def build_thumbnail(composite: Image.Image, output: Path) -> None:
    thumb = Image.new("RGBA", (512, 512))
    bbox = composite.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("Composite is empty")
    subject = composite.crop(bbox)
    scale = min(460 / subject.width, 460 / subject.height)
    subject = subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        Image.Resampling.LANCZOS,
    )
    thumb.alpha_composite(subject, ((512 - subject.width) // 2, (512 - subject.height) // 2))
    thumb.save(output / "thumbnail.png", optimize=True)


def pack_tight_atlas(
    attachments: dict[str, Image.Image], output: Path
) -> tuple[str, dict[str, tuple[int, int, int, int]], dict[str, tuple[int, int, int, int]]]:
    crops: dict[str, Image.Image] = {}
    canvas_bounds: dict[str, tuple[int, int, int, int]] = {}
    for name in SLOT_ORDER:
        bbox = attachments[name].getchannel("A").getbbox()
        if bbox is None:
            raise ValueError(f"Empty attachment {name}")
        padded = (
            max(0, bbox[0] - 4), max(0, bbox[1] - 4),
            min(CANVAS[0], bbox[2] + 4), min(CANVAS[1], bbox[3] + 4),
        )
        crops[name] = attachments[name].crop(padded)
        canvas_bounds[name] = padded

    atlas_width = 1024
    placements: dict[str, tuple[int, int, int, int]] = {}
    x = y = row_height = 0
    for name in sorted(SLOT_ORDER, key=lambda value: crops[value].height, reverse=True):
        crop = crops[name]
        if x and x + crop.width > atlas_width:
            x = 0
            y += row_height + 4
            row_height = 0
        placements[name] = (x, y, crop.width, crop.height)
        x += crop.width + 4
        row_height = max(row_height, crop.height)
    used_height = y + row_height
    atlas_height = 2 ** math.ceil(math.log2(max(1, used_height)))
    atlas = Image.new("RGBA", (atlas_width, atlas_height))
    for name, (px, py, _, _) in placements.items():
        atlas.alpha_composite(crops[name], (px, py))
    texture_name = "wei-yang-front-cutout-rig.png"
    atlas.save(output / texture_name, optimize=True)

    lines = [
        texture_name,
        f"size: {atlas.width}, {atlas.height}",
        "format: RGBA8888",
        "filter: Linear, Linear",
        "repeat: none",
        "pma: false",
    ]
    for name in SLOT_ORDER:
        px, py, width, height = placements[name]
        lines.extend([name, f"bounds: {px}, {py}, {width}, {height}"])
    atlas_text = "\n".join(lines) + "\n"
    (output / "wei-yang-front-cutout-rig.atlas").write_text(atlas_text, encoding="utf-8")
    return atlas_text, placements, canvas_bounds


def scalar_keys(values: list[float]) -> list[list[float]]:
    return [[time, value] for time, value in zip(TIMES, values, strict=True)]


def translate_keys(xs: list[float], ys: list[float]) -> list[list[float]]:
    return [[time, x, y] for time, x, y in zip(TIMES, xs, ys, strict=True)]


def scale_keys(xs: list[float], ys: list[float]) -> list[list[float]]:
    return [[time, x, y] for time, x, y in zip(TIMES, xs, ys, strict=True)]


def build_walk_animation() -> dict:
    zeros = [0] * 9
    ones = [1] * 9
    timelines: dict[str, dict] = {
        "pelvis": {
            "translate": translate_keys([0, 4, 6, 4, 0, -4, -6, -4, 0], [0, 7, 3, -4, 0, 7, 3, -4, 0]),
            "rotate": scalar_keys([0, -1, -1.8, -1, 0, 1, 1.8, 1, 0]),
        },
        "torso": {
            "translate": translate_keys([0, -1, -2, -1, 0, 1, 2, 1, 0], zeros),
            "rotate": scalar_keys([0, 0.6, 1.1, 0.6, 0, -0.6, -1.1, -0.6, 0]),
        },
        "head": {
            "translate": translate_keys(zeros, [0, -1, 0, 1, 0, -1, 0, 1, 0]),
            "rotate": scalar_keys([0, 0.3, 0.6, 0.3, 0, -0.3, -0.6, -0.3, 0]),
        },
        "skirt": {"rotate": scalar_keys([0, 0.4, 1, 1.4, 0, -0.4, -1, -1.4, 0])},
        "bag": {"rotate": scalar_keys([0, 0.8, 2, 1.2, 0, -0.8, -2, -1.2, 0])},
        "upper_arm_l": {
            "rotate": scalar_keys([-8, -5, 0, 5, 8, 5, 0, -5, -8]),
            "translate": translate_keys(zeros, [-2, -1, 0, 1, 2, 1, 0, -1, -2]),
            "scale": scale_keys(ones, [0.99, 0.995, 1, 1.005, 1.01, 1.005, 1, 0.995, 0.99]),
        },
        "forearm_l": {"rotate": scalar_keys([0, 0, 2, 5, 8, 5, 2, 0, 0])},
        "hand_l": {"rotate": scalar_keys([0, 0, -0.5, -1, -2, -1, -0.5, 0, 0])},
        "upper_arm_r": {
            "rotate": scalar_keys([-8, -5, 0, 5, 8, 5, 0, -5, -8]),
            "translate": translate_keys(zeros, [2, 1, 0, -1, -2, -1, 0, 1, 2]),
            "scale": scale_keys(ones, [1.01, 1.005, 1, 0.995, 0.99, 0.995, 1, 1.005, 1.01]),
        },
        "forearm_r": {"rotate": scalar_keys([-8, -5, -2, 0, 0, 0, -2, -5, -8])},
        "hand_r": {"rotate": scalar_keys([2, 1, 0, 0, 0, 0, 0, 1, 2])},
        "thigh_l": {
            "translate": translate_keys(zeros, [2, -6, -2, 0, -3, 0, 1, 2, 2]),
            "rotate": scalar_keys([6, 4, 0, -4, -6, -4, 0, 4, 6]),
            "scale": scale_keys(ones, [1.008, 1.004, 1, 0.994, 0.988, 0.994, 1, 1.004, 1.008]),
        },
        "shin_l": {
            "translate": translate_keys(zeros, [0, 0, 0, -2, 0, -4, -14, -9, 0]),
            "rotate": scalar_keys([0, 0, 0, 2, 0, 5, 18, 11, 0]),
        },
        "foot_l": {"rotate": scalar_keys([0, 0, 0, -2, 0, -3, -8, -5, 0])},
        "thigh_r": {
            "translate": translate_keys(zeros, [-3, 0, 1, 2, 2, -6, -2, 0, -3]),
            "rotate": scalar_keys([6, 4, 0, -4, -6, -4, 0, 4, 6]),
            "scale": scale_keys(ones, [0.988, 0.994, 1, 1.004, 1.008, 1.004, 1, 0.994, 0.988]),
        },
        "shin_r": {
            "translate": translate_keys(zeros, [0, -4, -14, -9, 0, 0, 0, -2, 0]),
            "rotate": scalar_keys([0, -5, -18, -11, 0, 0, 0, -2, 0]),
        },
        "foot_r": {"rotate": scalar_keys([0, 3, 8, 5, 0, 0, 0, 2, 0])},
    }
    return {
        "name": "walk_front",
        "category": "Locomotion",
        "duration": DURATION,
        "loop": True,
        "boneTimelines": timelines,
        # Complete slot orders are easier for the Gorest preview to resolve;
        # the Spine export converts the same phase changes to native offsets.
        "drawOrderTimeline": [
            [0, SLOT_ORDER],
            [TIMES[2], RIGHT_LEG_FRONT_ORDER],
            [TIMES[6], SLOT_ORDER],
            [DURATION, SLOT_ORDER],
        ],
        "playback": {"mode": "loop", "speed": 1, "autoStart": True},
    }


def build_gorest_manifest(output: Path, reports: dict[str, dict]) -> dict:
    animation = build_walk_animation()
    attachments = {
        spec.name: {
            "file": f"attachments/{spec.name}.png",
            "canvas": list(CANVAS),
            "anchor": [0, 0],
            "transformBaked": True,
            "content": "independently drawn and registered front cutout part",
        }
        for spec in PARTS
    }
    pivots = {name: pivot for name, _, pivot in BONES}
    for spec in PARTS:
        attachments[spec.name]["anchor"] = list(pivots[spec.bone])
    slots = [{"name": name, "bone": name, "attachment": name} for name in SLOT_ORDER]
    manifest = {
        "schemaVersion": 5,
        "id": RIG_ID,
        "name": RIG_NAME,
        "characterName": "Wei Yang",
        "focus": "front-cutout-walk",
        "runtime": "gorest-attachment-bone-mixer-v3",
        "spineStatus": "spine-4.2-cutout-region-attachment-bundle",
        "previewSheetUrl": f"{PUBLIC_ROOT}/neutral_composite.png",
        "frameSize": list(CANVAS),
        "frameCount": FRAME_COUNT,
        "fps": FPS,
        "attachments": attachments,
        "slots": slots,
        "bones": [
            {"name": name, **({"parent": parent} if parent else {}), "pivot": list(pivot)}
            for name, parent, pivot in BONES
        ],
        "animations": [animation],
        "editorTransforms": {name: {"translate": [0, 0], "scale": [1, 1]} for name in SLOT_ORDER},
        "generationMode": "identity-preserving-imagegen-front-cutout-spine",
        "sourceComponentAtlas": f"{PUBLIC_ROOT}/sources/wei_yang_front_cutout_parts_raw.png",
        "identityReference": "/generated/wei_yang_idle_front_source_clean.png",
        "rootAnchorPolicy": "ground root plus explicit anatomical joint pivots on a shared 640x1152 canvas",
        "proportionPolicy": "uniform scaling per independently generated cutout component; no non-uniform bitmap stretch",
        "qualityPolicy": (
            "Every visible body part was redrawn by ImageGen from the canonical front reference with hidden joint overlap. "
            "Code removes the baked neutral checker, preserves aspect ratio, registers each transparent part, packs the "
            "atlas, and wires parent-child bone timelines."
        ),
        "componentReports": reports,
        "limitations": [
            "The Gorest browser preview supports translate, rotate, and scale bone timelines but not weighted mesh deformation or IK.",
            "The front walk swaps the leading leg draw order at the two passing phases.",
            "The downloadable Spine package uses independent tight-cropped region attachments on eighteen parented bones.",
            "Validate the download with a licensed Spine 4.2 runtime before shipping.",
        ],
    }
    write_json(output / "rig.json", manifest)
    return manifest


def build_spine_json(
    output: Path,
    animation: dict,
    canvas_bounds: dict[str, tuple[int, int, int, int]],
) -> dict:
    pivots = {name: pivot for name, _, pivot in BONES}
    parent_map = {name: parent for name, parent, _ in BONES}
    spine_bones = []
    for name, parent, pivot in BONES:
        entry: dict[str, object] = {"name": name}
        if parent:
            parent_pivot = pivots[parent]
            entry.update({"parent": parent, "x": pivot[0] - parent_pivot[0], "y": parent_pivot[1] - pivot[1]})
        spine_bones.append(entry)

    skin: dict[str, dict] = {}
    for spec in PARTS:
        left, top, right, bottom = canvas_bounds[spec.name]
        cx, cy = (left + right) / 2, (top + bottom) / 2
        px, py = pivots[spec.bone]
        skin[spec.name] = {
            spec.name: {
                "x": round(cx - px, 3),
                "y": round(py - cy, 3),
                "width": right - left,
                "height": bottom - top,
            }
        }

    spine_timelines: dict[str, dict] = {}
    for bone, channels in animation["boneTimelines"].items():
        result: dict[str, list[dict]] = {}
        if "translate" in channels:
            result["translate"] = [
                ({"x": x, "y": -y} if time == 0 else {"time": time, "x": x, "y": -y})
                for time, x, y in channels["translate"]
            ]
        if "rotate" in channels:
            result["rotate"] = [
                ({"value": -value} if time == 0 else {"time": time, "value": -value})
                for time, value in channels["rotate"]
            ]
        if "scale" in channels:
            result["scale"] = [
                ({"x": x, "y": y} if time == 0 else {"time": time, "x": x, "y": y})
                for time, x, y in channels["scale"]
            ]
        spine_timelines[bone] = result

    root_x, root_y = pivots["root"]
    spine = {
        "skeleton": {
            "spine": SPINE_VERSION,
            "fps": FPS,
            "x": -root_x,
            "y": -(CANVAS[1] - root_y),
            "width": CANVAS[0],
            "height": CANVAS[1],
            "images": "./",
        },
        "bones": spine_bones,
        "slots": [{"name": name, "bone": name, "attachment": name} for name in SLOT_ORDER],
        "skins": [{"name": "default", "attachments": skin}],
        "animations": {
            "walk_front": {
                "bones": spine_timelines,
                "drawOrder": [
                    {"time": 0},
                    {
                        "time": TIMES[2],
                        "offsets": [
                            {"slot": "foot_r", "offset": 3},
                            {"slot": "shin_r", "offset": 3},
                            {"slot": "thigh_r", "offset": 3},
                        ],
                    },
                    {"time": TIMES[6]},
                    {"time": DURATION},
                ],
            }
        },
    }
    write_json(output / "wei-yang-front-cutout-rig.json", spine)
    return spine


def library_entry() -> dict:
    return {
        "id": RIG_ID,
        "name": RIG_NAME,
        "characterName": "Wei Yang",
        "description": "Sixteen separately drawn body attachments on eighteen parented bones, animated as a front-facing walk cycle.",
        "focus": "front-cutout-walk",
        "thumbnailUrl": f"{PUBLIC_ROOT}/thumbnail.png",
        "previewSheetUrl": f"{PUBLIC_ROOT}/neutral_composite.png",
        "rigManifestUrl": f"{PUBLIC_ROOT}/rig.json",
        "spineJsonUrl": f"{PUBLIC_ROOT}/wei-yang-front-cutout-rig.json",
        "spineAtlasUrl": f"{PUBLIC_ROOT}/wei-yang-front-cutout-rig.atlas",
        "spineTextureUrl": f"{PUBLIC_ROOT}/wei-yang-front-cutout-rig.png",
        "frameSize": list(CANVAS),
        "frameCount": FRAME_COUNT,
        "fps": FPS,
        "animations": [{"name": "walk_front", "loop": True}],
        "defaultAnimation": "walk_front",
        "updatedTime": "2026-09-03T00:00:00.000Z",
        "tags": [
            "wei-yang", "silver-hair", "green-school-uniform", "front-view", "cutout",
            "separated-bones", "full-body", "walk-cycle", "spine-4.2",
        ],
    }


def merge_library(path: Path, entry: dict) -> dict:
    library = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"schemaVersion": 1, "rigs": []}
    rigs = [rig for rig in library.get("rigs", []) if rig.get("id") not in {RIG_ID, REPLACED_RIG_ID}]
    rigs.append(entry)
    merged = {**library, "schemaVersion": max(1, int(library.get("schemaVersion", 1))), "rigs": rigs}
    write_json(path, merged)
    return merged


def atlas_region_names(atlas_text: str) -> set[str]:
    lines = atlas_text.splitlines()
    return {
        line
        for index, line in enumerate(lines)
        if index >= 6 and line and not line.startswith("bounds:")
    }


def validate(
    output: Path,
    manifest: dict,
    spine: dict,
    atlas_text: str,
    reports: dict[str, dict],
    library: dict,
) -> dict:
    attachment_names = set(manifest["attachments"])
    slot_names = {slot["name"] for slot in manifest["slots"]}
    bone_names = {bone["name"] for bone in manifest["bones"]}
    spine_names = set(spine["skins"][0]["attachments"])
    animation = manifest["animations"][0]
    timeline_bones = set(animation["boneTimelines"])
    timeline_ends = [channel[-1][0] for channels in animation["boneTimelines"].values() for channel in channels.values()]
    draw_orders = animation["drawOrderTimeline"]
    checks = {
        "sixteenSeparateAttachments": len(attachment_names) == 16 and "full_body" not in attachment_names,
        "eighteenParentedBones": len(bone_names) == 18 and {"root", "pelvis", "torso", "head"} <= bone_names,
        "slotsMatchAttachments": slot_names == attachment_names,
        "slotBonesExist": all(slot["bone"] in bone_names for slot in manifest["slots"]),
        "allAttachmentFilesExist": all((output / attachment["file"]).exists() for attachment in manifest["attachments"].values()),
        "allPartsHaveAlpha": all(report["registered"]["alphaBounds"] for report in reports.values()),
        "allPartHashesUnique": len({report["registered"]["sha256Pixels"] for report in reports.values()}) == 16,
        "animationDrivesMultipleBones": len(timeline_bones) >= 14,
        "animationBonesExist": timeline_bones <= bone_names,
        "allTimelinesCloseAtDuration": all(abs(end - DURATION) < 1e-6 for end in timeline_ends),
        "drawOrderTimelineCloses": draw_orders[0][1] == draw_orders[-1][1]
        and abs(draw_orders[-1][0] - DURATION) < 1e-6
        and all(set(order) == slot_names and len(order) == len(slot_names) for _, order in draw_orders),
        "spineSkinEqualsAtlas": spine_names == atlas_region_names(atlas_text),
        "spineBonesMatchManifest": {bone["name"] for bone in spine["bones"]} == bone_names,
        "rootLibraryReplacedFrameSwap": any(rig.get("id") == RIG_ID for rig in library["rigs"])
        and not any(rig.get("id") == REPLACED_RIG_ID for rig in library["rigs"]),
        "neutralCompositeExists": (output / "neutral_composite.png").exists(),
    }
    qa = {
        "bundle": PUBLIC_ROOT,
        "sourceComponentAtlas": f"{PUBLIC_ROOT}/sources/wei_yang_front_cutout_parts_raw.png",
        "identityReference": "/generated/wei_yang_idle_front_source_clean.png",
        "frameSize": list(CANVAS),
        "attachmentCount": len(attachment_names),
        "boneCount": len(bone_names),
        "animatedBoneCount": len(timeline_bones),
        "fps": FPS,
        "duration": DURATION,
        "checks": checks,
        "pass": all(checks.values()),
        "parts": reports,
    }
    write_json(output / "qa_bundle_report.json", qa)
    if not qa["pass"]:
        raise RuntimeError("QA failed: " + ", ".join(name for name, passed in checks.items() if not passed))
    return qa


def main() -> None:
    args = parse_args()
    atlas_path = args.component_atlas.resolve()
    identity_path = args.identity_reference.resolve()
    output = args.output_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    attachment_dir = output / "attachments"
    attachment_dir.mkdir(parents=True, exist_ok=True)
    sources = output / "sources"
    sources.mkdir(parents=True, exist_ok=True)
    if not atlas_path.exists() or not identity_path.exists():
        raise FileNotFoundError(atlas_path if not atlas_path.exists() else identity_path)

    raw = Image.open(atlas_path).convert("RGB")
    attachments: dict[str, Image.Image] = {}
    reports: dict[str, dict] = {}
    extracted_preview = Image.new("RGBA", raw.size)
    xs, ys = grid_bounds(raw.width), grid_bounds(raw.height)
    for spec in PARTS:
        extracted, source_report = extract_part(raw, spec)
        canvas, registered_report = fit_part(extracted, spec.target, spec.name)
        canvas.save(attachment_dir / f"{spec.name}.png", optimize=True)
        attachments[spec.name] = canvas
        reports[spec.name] = {"source": source_report, "registered": registered_report, "bone": spec.bone}
        col, row = spec.cell % 4, spec.cell // 4
        thumb = extracted.copy()
        max_w, max_h = xs[col + 1] - xs[col] - 12, ys[row + 1] - ys[row] - 12
        scale = min(max_w / thumb.width, max_h / thumb.height, 1)
        thumb = thumb.resize((round(thumb.width * scale), round(thumb.height * scale)), Image.Resampling.LANCZOS)
        extracted_preview.alpha_composite(thumb, (xs[col] + (xs[col + 1] - xs[col] - thumb.width) // 2, ys[row] + (ys[row + 1] - ys[row] - thumb.height) // 2))
    extracted_preview.save(sources / "wei_yang_front_cutout_parts_alpha.png", optimize=True)
    if atlas_path.parent != sources:
        shutil.copy2(atlas_path, sources / "wei_yang_front_cutout_parts_raw.png")
    shutil.copy2(identity_path, sources / identity_path.name)

    neutral = compose(attachments)
    neutral.save(output / "neutral_composite.png", optimize=True)
    build_thumbnail(neutral, output)
    atlas_text, _, canvas_bounds = pack_tight_atlas(attachments, output)
    manifest = build_gorest_manifest(output, reports)
    spine = build_spine_json(output, manifest["animations"][0], canvas_bounds)
    entry = library_entry()
    write_json(output / "rigged_2d_library.json", {"schemaVersion": 1, "rigs": [entry]})
    library = merge_library(args.library.resolve(), entry)
    qa = validate(output, manifest, spine, atlas_text, reports, library)
    print(json.dumps({"output": str(output), "attachments": 16, "bones": 18, "qaPass": qa["pass"]}, indent=2))


if __name__ == "__main__":
    main()
