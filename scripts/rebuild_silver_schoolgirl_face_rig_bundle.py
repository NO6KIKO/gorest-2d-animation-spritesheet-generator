"""Rebuild the Silver Schoolgirl face rig with expressions and bone motion.

All visible facial variants come from identity-preserving image-generated
action and component sheets. Code only removes chroma, registers the supplied
components, splits the existing portrait into head/torso layers, packs the
atlas, and wires metadata.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


CANVAS = (512, 512)
RIG_ID = "silver_schoolgirl_face_rig"
PUBLIC_ROOT = f"/generated/rigged/{RIG_ID}"

EXISTING_FEATURES = [
    "left_brow",
    "right_brow",
    "left_eye_open",
    "left_eye_half",
    "left_eye_closed",
    "right_eye_open",
    "right_eye_half",
    "right_eye_closed",
    "nose",
    "mouth_closed",
    "mouth_small",
    "mouth_medium",
    "mouth_wide",
]

NEW_FEATURE_SOURCES = {
    "left_eye_gaze_left": (0, 0, "left_eye"),
    "right_eye_gaze_left": (0, 0, "right_eye"),
    "left_eye_gaze_right": (0, 1, "left_eye"),
    "right_eye_gaze_right": (0, 1, "right_eye"),
    "left_eye_gaze_up": (0, 2, "left_eye"),
    "right_eye_gaze_up": (0, 2, "right_eye"),
    "left_eye_gaze_down": (0, 3, "left_eye"),
    "right_eye_gaze_down": (0, 3, "right_eye"),
    "left_brow_raised": (1, 0, "left_brow"),
    "right_brow_raised": (1, 0, "right_brow"),
    "left_brow_frown": (1, 1, "left_brow"),
    "right_brow_frown": (1, 1, "right_brow"),
    "left_brow_worried": (1, 2, "left_brow"),
    "right_brow_worried": (1, 2, "right_brow"),
    "mouth_smile": (2, 0, "mouth"),
    "mouth_angry": (2, 2, "mouth"),
    "mouth_sad": (2, 3, "mouth"),
}

ATTACHMENT_NAMES = [
    "portrait_torso",
    "portrait_head",
    "left_brow",
    "left_brow_raised",
    "left_brow_frown",
    "left_brow_worried",
    "right_brow",
    "right_brow_raised",
    "right_brow_frown",
    "right_brow_worried",
    "left_eye_open",
    "left_eye_half",
    "left_eye_closed",
    "left_eye_gaze_left",
    "left_eye_gaze_right",
    "left_eye_gaze_up",
    "left_eye_gaze_down",
    "right_eye_open",
    "right_eye_half",
    "right_eye_closed",
    "right_eye_gaze_left",
    "right_eye_gaze_right",
    "right_eye_gaze_up",
    "right_eye_gaze_down",
    "nose",
    "mouth_closed",
    "mouth_small",
    "mouth_medium",
    "mouth_wide",
    "mouth_smile",
    "mouth_angry",
    "mouth_sad",
]

SLOTS = [
    {"name": "portrait_torso", "bone": "head", "attachment": "portrait_torso"},
    {"name": "portrait_head", "bone": "head", "attachment": "portrait_head"},
    {
        "name": "left_brow",
        "bone": "head",
        "attachment": "left_brow",
        "variants": ["left_brow", "left_brow_raised", "left_brow_frown", "left_brow_worried"],
    },
    {
        "name": "right_brow",
        "bone": "head",
        "attachment": "right_brow",
        "variants": ["right_brow", "right_brow_raised", "right_brow_frown", "right_brow_worried"],
    },
    {
        "name": "left_eye",
        "bone": "head",
        "attachment": "left_eye_open",
        "variants": [
            "left_eye_open", "left_eye_half", "left_eye_closed",
            "left_eye_gaze_left", "left_eye_gaze_right", "left_eye_gaze_up", "left_eye_gaze_down",
        ],
    },
    {
        "name": "right_eye",
        "bone": "head",
        "attachment": "right_eye_open",
        "variants": [
            "right_eye_open", "right_eye_half", "right_eye_closed",
            "right_eye_gaze_left", "right_eye_gaze_right", "right_eye_gaze_up", "right_eye_gaze_down",
        ],
    },
    {"name": "nose", "bone": "head", "attachment": "nose"},
    {
        "name": "mouth",
        "bone": "head",
        "attachment": "mouth_closed",
        "variants": [
            "mouth_closed", "mouth_small", "mouth_medium", "mouth_wide",
            "mouth_smile", "mouth_angry", "mouth_sad",
        ],
    },
]


def attachment_keys(*items: tuple[float, str]) -> list[list[object]]:
    return [[time, name] for time, name in items]


BLINK_LEFT = attachment_keys(
    (0.0, "left_eye_open"), (0.08, "left_eye_half"), (0.14, "left_eye_closed"),
    (0.22, "left_eye_half"), (0.30, "left_eye_open"), (0.32, "left_eye_open"),
)
BLINK_RIGHT = attachment_keys(
    (0.0, "right_eye_open"), (0.08, "right_eye_half"), (0.14, "right_eye_closed"),
    (0.22, "right_eye_half"), (0.30, "right_eye_open"), (0.32, "right_eye_open"),
)
WINK_LEFT = attachment_keys(
    (0.0, "left_eye_open"), (0.10, "left_eye_half"), (0.18, "left_eye_closed"),
    (0.34, "left_eye_closed"), (0.42, "left_eye_half"), (0.50, "left_eye_open"),
    (0.72, "left_eye_open"),
)
WINK_RIGHT = attachment_keys(
    (0.0, "right_eye_open"), (0.10, "right_eye_half"), (0.18, "right_eye_closed"),
    (0.34, "right_eye_closed"), (0.42, "right_eye_half"), (0.50, "right_eye_open"),
    (0.72, "right_eye_open"),
)
TALK = attachment_keys(
    (0.0, "mouth_closed"), (0.14, "mouth_small"), (0.30, "mouth_medium"),
    (0.48, "mouth_wide"), (0.65, "mouth_medium"), (0.82, "mouth_small"),
    (1.0, "mouth_closed"),
)
TALK_SOFT = attachment_keys(
    (0.0, "mouth_closed"), (0.18, "mouth_small"), (0.36, "mouth_closed"),
    (0.52, "mouth_small"), (0.70, "mouth_medium"), (0.86, "mouth_small"),
    (1.02, "mouth_closed"), (1.20, "mouth_closed"),
)
TALK_EMPHASIS = attachment_keys(
    (0.0, "mouth_closed"), (0.10, "mouth_medium"), (0.22, "mouth_wide"),
    (0.34, "mouth_medium"), (0.46, "mouth_small"), (0.56, "mouth_wide"),
    (0.70, "mouth_medium"), (0.80, "mouth_small"), (0.90, "mouth_closed"),
)


def hold_clip(name: str, category: str, timelines: dict[str, str]) -> dict:
    return {
        "name": name,
        "category": category,
        "duration": 1.0,
        "loop": True,
        "attachmentTimelines": {
            slot: [[0.0, attachment], [1.0, attachment]]
            for slot, attachment in timelines.items()
        },
        "playback": {"mode": "loop", "autoStart": False},
    }


ANIMATIONS = [
    {
        "name": "idle_blink", "category": "Eyes", "duration": 0.32, "loop": False,
        "attachmentTimelines": {"left_eye": BLINK_LEFT, "right_eye": BLINK_RIGHT},
        "playback": {
            "mode": "random", "randomDelay": [2.2, 5.8], "repeatChance": 0.18,
            "repeatDelay": [0.10, 0.18],
            "autoStart": True,
        },
    },
    {
        "name": "talk_soft", "category": "Mouth", "duration": 1.20, "loop": True,
        "attachmentTimelines": {"mouth": TALK_SOFT},
        "playback": {"mode": "loop", "autoStart": True},
    },
    {
        "name": "blink", "category": "Eyes", "duration": 0.32, "loop": False,
        "attachmentTimelines": {"left_eye": BLINK_LEFT, "right_eye": BLINK_RIGHT},
        "playback": {"mode": "once", "autoStart": False, "transient": True},
    },
    {
        "name": "wink_left", "category": "Eyes", "duration": 0.72, "loop": False,
        "attachmentTimelines": {"left_eye": WINK_LEFT},
        "playback": {"mode": "once", "autoStart": False, "transient": True},
    },
    {
        "name": "wink_right", "category": "Eyes", "duration": 0.72, "loop": False,
        "attachmentTimelines": {"right_eye": WINK_RIGHT},
        "playback": {"mode": "once", "autoStart": False, "transient": True},
    },
    {
        "name": "talk", "category": "Mouth", "duration": 1.0, "loop": True,
        "attachmentTimelines": {"mouth": TALK},
        "playback": {"mode": "loop", "autoStart": False},
    },
    {
        "name": "talk_emphasis", "category": "Mouth", "duration": 0.90, "loop": True,
        "attachmentTimelines": {"mouth": TALK_EMPHASIS},
        "playback": {"mode": "loop", "autoStart": False},
    },
    hold_clip("gaze_left", "Gaze", {"left_eye": "left_eye_gaze_left", "right_eye": "right_eye_gaze_left"}),
    hold_clip("gaze_right", "Gaze", {"left_eye": "left_eye_gaze_right", "right_eye": "right_eye_gaze_right"}),
    hold_clip("gaze_up", "Gaze", {"left_eye": "left_eye_gaze_up", "right_eye": "right_eye_gaze_up"}),
    hold_clip("gaze_down", "Gaze", {"left_eye": "left_eye_gaze_down", "right_eye": "right_eye_gaze_down"}),
    hold_clip("brow_raise", "Brows", {"left_brow": "left_brow_raised", "right_brow": "right_brow_raised"}),
    hold_clip("brow_frown", "Brows", {"left_brow": "left_brow_frown", "right_brow": "right_brow_frown"}),
    hold_clip("brow_worried", "Brows", {"left_brow": "left_brow_worried", "right_brow": "right_brow_worried"}),
    hold_clip("emotion_happy", "Expressions", {"mouth": "mouth_smile"}),
    hold_clip("emotion_surprised", "Expressions", {
        "left_brow": "left_brow_raised", "right_brow": "right_brow_raised", "mouth": "mouth_medium",
    }),
    hold_clip("emotion_angry", "Expressions", {
        "left_brow": "left_brow_frown", "right_brow": "right_brow_frown", "mouth": "mouth_angry",
    }),
    hold_clip("emotion_sad", "Expressions", {
        "left_brow": "left_brow_worried", "right_brow": "right_brow_worried", "mouth": "mouth_sad",
    }),
    {
        "name": "head_nod", "category": "Head", "duration": 0.80, "loop": False,
        "boneTimelines": {"head": {
            "translate": [[0.0, 0, 0], [0.16, 0, 5], [0.32, 0, -3], [0.50, 0, 2], [0.68, 0, 0], [0.80, 0, 0]],
            "rotate": [[0.0, 0], [0.16, 2.0], [0.32, -1.5], [0.50, 0.8], [0.68, 0], [0.80, 0]],
        }},
        "playback": {"mode": "once", "autoStart": False, "transient": True},
    },
    {
        "name": "head_shake", "category": "Head", "duration": 0.90, "loop": False,
        "boneTimelines": {"head": {
            "translate": [[0.0, 0, 0], [0.14, -4, 0], [0.28, 4, 0], [0.42, -3, 0], [0.56, 3, 0], [0.72, -1, 0], [0.86, 0, 0], [0.90, 0, 0]],
            "rotate": [[0.0, 0], [0.14, -2.5], [0.28, 2.5], [0.42, -2.0], [0.56, 1.5], [0.72, -0.5], [0.86, 0], [0.90, 0]],
        }},
        "playback": {"mode": "once", "autoStart": False, "transient": True},
    },
    {
        "name": "head_tilt", "category": "Head", "duration": 1.20, "loop": False,
        "boneTimelines": {"head": {"rotate": [[0.0, 0], [0.30, -7], [0.85, -7], [1.15, 0], [1.20, 0]]}},
        "playback": {"mode": "once", "autoStart": False, "transient": True},
    },
]

POSE_PRESETS = [
    {"id": "neutral", "name": "Neutral", "attachments": {
        "left_brow": "left_brow", "right_brow": "right_brow",
        "left_eye": "left_eye_open", "right_eye": "right_eye_open", "mouth": "mouth_closed",
    }},
    {"id": "look_left", "name": "Look left", "attachments": {"left_eye": "left_eye_gaze_left", "right_eye": "right_eye_gaze_left"}},
    {"id": "look_right", "name": "Look right", "attachments": {"left_eye": "left_eye_gaze_right", "right_eye": "right_eye_gaze_right"}},
    {"id": "look_up", "name": "Look up", "attachments": {"left_eye": "left_eye_gaze_up", "right_eye": "right_eye_gaze_up"}},
    {"id": "look_down", "name": "Look down", "attachments": {"left_eye": "left_eye_gaze_down", "right_eye": "right_eye_gaze_down"}},
    {"id": "happy", "name": "Happy", "attachments": {"mouth": "mouth_smile"}},
    {"id": "surprised", "name": "Surprised", "attachments": {"left_brow": "left_brow_raised", "right_brow": "right_brow_raised", "mouth": "mouth_medium"}},
    {"id": "angry", "name": "Angry", "attachments": {"left_brow": "left_brow_frown", "right_brow": "right_brow_frown", "mouth": "mouth_angry"}},
    {"id": "sad", "name": "Sad", "attachments": {"left_brow": "left_brow_worried", "right_brow": "right_brow_worried", "mouth": "mouth_sad"}},
]


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[1]
    default_bundle = repo_root / "public" / "generated" / "rigged" / RIG_ID
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, default=default_bundle)
    parser.add_argument("--action-sheet", type=Path, default=default_bundle / "sources" / "silver_face_actions_4x2_alpha.png")
    parser.add_argument("--raw-action-sheet", type=Path, default=default_bundle / "sources" / "silver_face_actions_4x2_chroma.png")
    parser.add_argument("--component-sheet", type=Path, default=default_bundle / "sources" / "silver_face_components_4x3_alpha.png")
    parser.add_argument("--raw-component-sheet", type=Path, default=default_bundle / "sources" / "silver_face_components_4x3_chroma.png")
    parser.add_argument("--output-dir", type=Path, default=default_bundle)
    return parser.parse_args()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def copy_if_different(source: Path, destination: Path) -> None:
    if source.resolve() != destination.resolve():
        shutil.copy2(source, destination)


def zero_hidden_rgb(image: Image.Image) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA")).copy()
    rgba[rgba[..., 3] == 0, :3] = 0
    return Image.fromarray(rgba)


def normalize_action_frames(sheet_path: Path, target_base: Image.Image) -> list[np.ndarray]:
    sheet = Image.open(sheet_path).convert("RGBA")
    cells: list[Image.Image] = []
    for index in range(8):
        column, row = index % 4, index // 4
        x0 = round(column * sheet.width / 4)
        x1 = round((column + 1) * sheet.width / 4)
        y0 = round(row * sheet.height / 2)
        y1 = round((row + 1) * sheet.height / 2)
        cell = sheet.crop((x0, y0, x1, y1))
        data = np.asarray(cell).copy()
        data[:3, :, 3] = 0
        data[-3:, :, 3] = 0
        data[:, :3, 3] = 0
        data[:, -3:, 3] = 0
        cells.append(Image.fromarray(data))

    bboxes = [cell.getchannel("A").getbbox() for cell in cells]
    if any(bbox is None for bbox in bboxes):
        raise RuntimeError("Generated action sheet contains an empty cell")
    target_bbox = target_base.getchannel("A").getbbox()
    if not target_bbox:
        raise RuntimeError("Target face base is empty")
    target_width = target_bbox[2] - target_bbox[0]
    target_height = target_bbox[3] - target_bbox[1]
    maximum_width = max(bbox[2] - bbox[0] for bbox in bboxes if bbox)
    maximum_height = max(bbox[3] - bbox[1] for bbox in bboxes if bbox)
    scale = min(target_width / maximum_width, target_height / maximum_height)
    target_center = ((target_bbox[0] + target_bbox[2]) / 2, (target_bbox[1] + target_bbox[3]) / 2)

    normalized: list[np.ndarray] = []
    for cell, bbox in zip(cells, bboxes):
        assert bbox is not None
        crop = cell.crop(bbox)
        crop = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", CANVAS)
        x = round(target_center[0] - crop.width / 2)
        y = round(target_center[1] - crop.height / 2)
        canvas.alpha_composite(crop, (x, y))
        normalized.append(np.asarray(zero_hidden_rgb(canvas)))
    return normalized


def component_cell(sheet: Image.Image, row: int, column: int) -> Image.Image:
    x0 = round(column * sheet.width / 4)
    x1 = round((column + 1) * sheet.width / 4)
    y0 = round(row * sheet.height / 3)
    y1 = round((row + 1) * sheet.height / 3)
    return sheet.crop((x0, y0, x1, y1))


def register_component(
    component: Image.Image,
    maximum_size: tuple[int, int],
    center: tuple[int, int],
    path: Path,
) -> dict:
    component = zero_hidden_rgb(component)
    bbox = component.getchannel("A").getbbox()
    if not bbox:
        raise RuntimeError(f"Empty generated component for {path.name}")
    crop = component.crop(bbox)
    scale = min(maximum_size[0] / crop.width, maximum_size[1] / crop.height)
    crop = crop.resize(
        (max(1, round(crop.width * scale)), max(1, round(crop.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", CANVAS)
    x = round(center[0] - crop.width / 2)
    y = round(center[1] - crop.height / 2)
    canvas.alpha_composite(crop, (x, y))
    canvas = zero_hidden_rgb(canvas)
    canvas.save(path)
    alpha = np.asarray(canvas.getchannel("A"))
    final_bbox = canvas.getchannel("A").getbbox()
    return {
        "sourceBbox": list(bbox),
        "registeredBbox": list(final_bbox) if final_bbox else None,
        "alphaPixels": int((alpha > 0).sum()),
    }


def extract_new_features(component_sheet_path: Path, output: Path) -> dict[str, dict]:
    sheet = Image.open(component_sheet_path).convert("RGBA")
    metadata: dict[str, dict] = {}
    for name, (row, column, kind) in NEW_FEATURE_SOURCES.items():
        cell = component_cell(sheet, row, column)
        if kind.startswith("left_"):
            component = cell.crop((0, 0, cell.width // 2, cell.height))
        elif kind.startswith("right_"):
            component = cell.crop((cell.width // 2, 0, cell.width, cell.height))
        else:
            component = cell

        if "eye" in kind:
            maximum_size = (58, 42)
            center = (198, 221) if kind == "left_eye" else (296, 221)
        elif "brow" in kind:
            maximum_size = (56, 18)
            center_y = 189 if name.endswith(("raised", "worried")) else 193
            center = (196, center_y) if kind == "left_brow" else (296, center_y)
        elif kind == "mouth":
            maximum_size = (30, 18)
            center = (248, 282)
        else:
            raise ValueError(kind)

        metadata[name] = {
            "sourceCell": [row, column],
            **register_component(component, maximum_size, center, output / f"{name}.png"),
        }
    return metadata


def split_portrait(base: Image.Image, torso_reference: Image.Image) -> tuple[Image.Image, Image.Image]:
    base_rgba = np.asarray(base.convert("RGBA")).copy()
    torso_alpha = np.asarray(torso_reference.convert("RGBA"))[..., 3]
    torso_mask = (torso_alpha > 16)
    torso_mask[:300, :] = False
    torso = np.zeros_like(base_rgba)
    head = np.zeros_like(base_rgba)
    torso[torso_mask] = base_rgba[torso_mask]
    head[~torso_mask] = base_rgba[~torso_mask]
    torso[torso[..., 3] == 0, :3] = 0
    head[head[..., 3] == 0, :3] = 0
    return Image.fromarray(torso), Image.fromarray(head)


def image_stats(path: Path) -> dict:
    image = Image.open(path).convert("RGBA")
    rgba = np.asarray(image)
    alpha = rgba[..., 3]
    bbox = image.getchannel("A").getbbox()
    hidden = (alpha == 0) & np.any(rgba[..., :3] != 0, axis=2)
    values = rgba[..., :3].astype(np.int16)
    red, green, blue = values[..., 0], values[..., 1], values[..., 2]
    skin = (
        (alpha > 0) & (red > 220) & (green > 188) & (blue > 166)
        & ((red - green) > 4) & ((red - green) < 55)
        & ((green - blue) > -2) & ((green - blue) < 40)
    )
    return {
        "size": list(image.size),
        "mode": image.mode,
        "alphaBbox": list(bbox) if bbox else None,
        "alphaPixels": int((alpha > 0).sum()),
        "hiddenRgbUnderZeroAlphaPixels": int(hidden.sum()),
        "skinTonePixels": int(skin.sum()),
    }


def compose(output: Path, overrides: dict[str, str] | None = None) -> Image.Image:
    overrides = overrides or {}
    image = Image.new("RGBA", CANVAS)
    order = [
        ("portrait_torso", "portrait_torso"),
        ("portrait_head", "portrait_head"),
        ("left_brow", "left_brow"),
        ("right_brow", "right_brow"),
        ("left_eye", "left_eye_open"),
        ("right_eye", "right_eye_open"),
        ("nose", "nose"),
        ("mouth", "mouth_closed"),
    ]
    for slot, fallback in order:
        image.alpha_composite(Image.open(output / f"{overrides.get(slot, fallback)}.png").convert("RGBA"))
    return image


def checkerboard(size: tuple[int, int], step: int = 12) -> Image.Image:
    image = Image.new("RGB", size, (247, 247, 247))
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], step):
        for x in range(0, size[0], step):
            if (x // step + y // step) % 2:
                draw.rectangle((x, y, x + step - 1, y + step - 1), fill=(214, 214, 214))
    return image


def build_component_sheet(output: Path, names: list[str]) -> None:
    tile_width, tile_height, columns = 320, 180, 4
    rows = math.ceil(len(names) / columns)
    atlas = Image.new("RGB", (tile_width * columns, tile_height * rows), "white")
    font = ImageFont.load_default()
    for index, name in enumerate(names):
        tile = checkerboard((tile_width, tile_height), 10).convert("RGBA")
        attachment = Image.open(output / f"{name}.png").convert("RGBA")
        bbox = attachment.getbbox()
        if bbox:
            crop = attachment.crop((max(0, bbox[0] - 4), max(0, bbox[1] - 4), min(512, bbox[2] + 4), min(512, bbox[3] + 4)))
            scale = min((tile_width - 24) / crop.width, (tile_height - 40) / crop.height)
            crop = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.Resampling.NEAREST)
            tile.alpha_composite(crop, ((tile_width - crop.width) // 2, 24 + (tile_height - 24 - crop.height) // 2))
        draw = ImageDraw.Draw(tile)
        draw.rectangle((0, 0, tile_width, 22), fill=(25, 25, 25, 255))
        draw.text((8, 6), name, fill="white", font=font)
        atlas.paste(tile.convert("RGB"), ((index % columns) * tile_width, (index // columns) * tile_height))
    atlas.save(output / "feature_components_check.png")


def spine_keys(timeline: list[list[object]]) -> list[dict]:
    keys: list[dict] = []
    for time, attachment in timeline:
        key: dict[str, object] = {"name": attachment}
        if float(time) != 0:
            key["time"] = time
        keys.append(key)
    return keys


def spine_animation(animation: dict) -> dict:
    result: dict[str, object] = {}
    attachment_timelines = animation.get("attachmentTimelines", {})
    if attachment_timelines:
        result["slots"] = {
            slot: {"attachment": spine_keys(timeline)}
            for slot, timeline in attachment_timelines.items()
        }
    bone_timelines = animation.get("boneTimelines", {})
    if bone_timelines:
        bones: dict[str, dict] = {}
        for bone, timelines in bone_timelines.items():
            entry: dict[str, list[dict]] = {}
            if "translate" in timelines:
                entry["translate"] = [
                    ({"x": x, "y": -y} if time == 0 else {"time": time, "x": x, "y": -y})
                    for time, x, y in timelines["translate"]
                ]
            if "rotate" in timelines:
                entry["rotate"] = [
                    ({"value": -value} if time == 0 else {"time": time, "value": -value})
                    for time, value in timelines["rotate"]
                ]
            bones[bone] = entry
        result["bones"] = bones
    return result


def animation_end_times_valid(animation: dict) -> bool:
    duration = float(animation["duration"])
    timelines: list[list] = list(animation.get("attachmentTimelines", {}).values())
    for bone in animation.get("boneTimelines", {}).values():
        timelines.extend(bone.values())
    return all(timeline and abs(float(timeline[-1][0]) - duration) < 1e-6 for timeline in timelines)


def atlas_region_names(atlas_text: str) -> set[str]:
    names: set[str] = set()
    lines = atlas_text.splitlines()
    for index, line in enumerate(lines):
        if index < 6 or not line or line.startswith(("size:", "format:", "filter:", "repeat:", "pma:", "bounds:")):
            continue
        if index + 1 < len(lines) and lines[index + 1].startswith("bounds:"):
            names.add(line)
    return names


def main() -> None:
    args = parse_args()
    source = args.source_dir.resolve()
    output = args.output_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    (output / "sources").mkdir(parents=True, exist_ok=True)

    base = Image.open(source / "face_base.png").convert("RGBA")
    torso_reference = Image.open(source / "torso.png").convert("RGBA")
    torso, head = split_portrait(base, torso_reference)
    zero_hidden_rgb(torso).save(output / "portrait_torso.png")
    zero_hidden_rgb(head).save(output / "portrait_head.png")
    copy_if_different(source / "face_base.png", output / "face_base.png")
    copy_if_different(source / "torso.png", output / "torso.png")

    for name in EXISTING_FEATURES:
        copy_if_different(source / f"{name}.png", output / f"{name}.png")

    normalized_frames = normalize_action_frames(args.action_sheet, base)
    normalized_sheet = Image.new("RGBA", (2048, 1024))
    for index, frame in enumerate(normalized_frames):
        normalized_sheet.alpha_composite(Image.fromarray(frame), ((index % 4) * 512, (index // 4) * 512))
    normalized_sheet.save(output / "sources" / "silver_face_actions_4x2_normalized.png")
    copy_if_different(args.action_sheet, output / "sources" / "silver_face_actions_4x2_alpha.png")
    copy_if_different(args.raw_action_sheet, output / "sources" / "silver_face_actions_4x2_chroma.png")
    copy_if_different(args.component_sheet, output / "sources" / "silver_face_components_4x3_alpha.png")
    copy_if_different(args.raw_component_sheet, output / "sources" / "silver_face_components_4x3_chroma.png")
    prompt_notes = source / "sources" / "IMAGEGEN_PROMPTS.md"
    if prompt_notes.exists():
        copy_if_different(prompt_notes, output / "sources" / "IMAGEGEN_PROMPTS.md")

    new_feature_qa = extract_new_features(args.component_sheet, output)

    attachments = {
        name: {
            "file": f"{name}.png",
            "canvas": list(CANVAS),
            "anchor": [256, 256],
            "transformBaked": True,
            "content": "registered portrait layer" if name.startswith("portrait_") else "drawn feature pixels only; no skin plate",
        }
        for name in ATTACHMENT_NAMES
    }

    manifest = {
        "schemaVersion": 4,
        "id": RIG_ID,
        "name": "Silver Schoolgirl / Expressive Feature Rig",
        "characterName": "Wei Yang",
        "focus": "face-closeup",
        "runtime": "gorest-attachment-bone-mixer-v2",
        "spineStatus": "spine-4.2-region-attachment-bundle",
        "previewSheetUrl": f"{PUBLIC_ROOT}/pure_feature_preview_sheet.png",
        "frameSize": list(CANVAS),
        "frameCount": 16,
        "fps": 12,
        "attachments": attachments,
        "slots": SLOTS,
        "bones": [
            {"name": "root", "x": 256, "y": 460},
            {"name": "head", "parent": "root", "x": 0, "y": -125},
        ],
        "animations": ANIMATIONS,
        "posePresets": POSE_PRESETS,
        "editorTransforms": {slot["name"]: {"translate": [0, 0], "scale": [1, 1]} for slot in SLOTS},
        "qualityPolicy": (
            "All gaze, brow, and emotion variants are derived from identity-preserving image-generated "
            "action and component sheets and retained in registered 512x512 coordinates. Code only removed "
            "chroma, normalized and registered supplied components, split the existing drawn portrait by alpha "
            "mask, packed the atlas, and wired animation metadata."
        ),
        "limitations": [
            "Gaze attachments replace the complete open eye and therefore conflict with blink/wink tracks.",
            "Head clips move the complete registered portrait around the head pivot because the source art has no occlusion-filled neck layer.",
            "Random scheduling, transient overlays, speed controls, and manual pose presets are Gorest runtime metadata rather than Spine JSON features.",
            "The browser mixer supports attachment and bone timelines; the bundled Spine export remains experimental.",
        ],
    }
    (output / "rig.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    neutral = compose(output)
    neutral.save(output / "layer_composite_check.png")
    neutral.save(output / "thumbnail.png")

    preview_presets = [
        {},
        {"left_eye": "left_eye_half", "right_eye": "right_eye_half"},
        {"left_eye": "left_eye_closed", "right_eye": "right_eye_closed"},
        POSE_PRESETS[1]["attachments"], POSE_PRESETS[2]["attachments"], POSE_PRESETS[3]["attachments"], POSE_PRESETS[4]["attachments"],
        POSE_PRESETS[5]["attachments"], POSE_PRESETS[6]["attachments"], POSE_PRESETS[7]["attachments"], POSE_PRESETS[8]["attachments"],
        {"left_eye": "left_eye_closed"}, {"right_eye": "right_eye_closed"},
        {"mouth": "mouth_small"}, {"mouth": "mouth_wide"},
        {"left_brow": "left_brow_raised", "right_brow": "right_brow_raised"},
    ]
    preview = Image.new("RGBA", (2048, 2048))
    for index, preset in enumerate(preview_presets):
        preview.alpha_composite(compose(output, preset), ((index % 4) * 512, (index // 4) * 512))
    preview.save(output / "pure_feature_preview_sheet.png")
    build_component_sheet(output, list(NEW_FEATURE_SOURCES))

    atlas_columns = 8
    atlas_rows = math.ceil(len(ATTACHMENT_NAMES) / atlas_columns)
    atlas_texture = Image.new("RGBA", (atlas_columns * 512, atlas_rows * 512))
    placements: dict[str, tuple[int, int]] = {}
    for index, name in enumerate(ATTACHMENT_NAMES):
        x, y = (index % atlas_columns) * 512, (index // atlas_columns) * 512
        atlas_texture.alpha_composite(Image.open(output / f"{name}.png").convert("RGBA"), (x, y))
        placements[name] = (x, y)
    atlas_texture.save(output / "silver-face-pure-rig.png")
    atlas_lines = [
        "silver-face-pure-rig.png",
        f"size: {atlas_texture.width}, {atlas_texture.height}",
        "format: RGBA8888",
        "filter: Linear, Linear",
        "repeat: none",
        "pma: false",
    ]
    for name in ATTACHMENT_NAMES:
        x, y = placements[name]
        atlas_lines.extend([name, f"bounds: {x}, {y}, 512, 512"])
    atlas_text = "\n".join(atlas_lines) + "\n"
    (output / "silver-face-pure-rig.atlas").write_text(atlas_text, encoding="utf-8")

    def spine_attachment_map(names: list[str], y: float = 0) -> dict:
        return {
            name: {"width": 512, "height": 512, **({"y": y} if y else {})}
            for name in names
        }

    spine_json = {
        "skeleton": {"spine": "4.2.22", "x": -256, "y": -256, "width": 512, "height": 512, "images": "./"},
        "bones": [{"name": "root"}, {"name": "head", "parent": "root", "y": -79}],
        "slots": [{"name": slot["name"], "bone": slot["bone"], "attachment": slot["attachment"]} for slot in SLOTS],
        "skins": [{
            "name": "default",
            "attachments": {
                slot["name"]: spine_attachment_map(
                    [slot["attachment"], *slot.get("variants", [])],
                    79 if slot["bone"] == "head" else 0,
                )
                for slot in SLOTS
            },
        }],
        "animations": {animation["name"]: spine_animation(animation) for animation in ANIMATIONS},
    }
    (output / "silver-face-pure-rig.json").write_text(json.dumps(spine_json, indent=2), encoding="utf-8")

    library = {
        "schemaVersion": 1,
        "rigs": [{
            "id": RIG_ID,
            "name": manifest["name"],
            "characterName": manifest["characterName"],
            "description": "32 registered portrait and facial attachments with multi-track gaze, expressions, speech, random blink, and pivoted portrait motion.",
            "focus": "face-closeup",
            "thumbnailUrl": f"{PUBLIC_ROOT}/thumbnail.png",
            "previewSheetUrl": manifest["previewSheetUrl"],
            "rigManifestUrl": f"{PUBLIC_ROOT}/rig.json",
            "spineJsonUrl": f"{PUBLIC_ROOT}/silver-face-pure-rig.json",
            "spineAtlasUrl": f"{PUBLIC_ROOT}/silver-face-pure-rig.atlas",
            "spineTextureUrl": f"{PUBLIC_ROOT}/silver-face-pure-rig.png",
            "frameSize": list(CANVAS),
            "frameCount": 16,
            "fps": 12,
            "animations": [{"name": animation["name"], "loop": animation.get("loop", False)} for animation in ANIMATIONS],
            "defaultAnimation": "idle_blink",
            "updatedTime": "2026-08-16T05:30:00.000Z",
            "tags": [
                "silver-hair", "school-uniform", "face-closeup", "pure-features", "expressions",
                "gaze", "random-blink", "bone-motion", "spine-4.2",
            ],
        }],
    }
    (output / "rigged_2d_library.json").write_text(json.dumps(library, indent=2), encoding="utf-8")

    attachment_stats = {name: image_stats(output / f"{name}.png") for name in ATTACHMENT_NAMES}
    manifest_names = set(manifest["attachments"])
    spine_skin = spine_json["skins"][0]["attachments"]
    spine_names = {name for slot in spine_skin.values() for name in slot}
    atlas_names = atlas_region_names(atlas_text)
    timeline_attachments = {
        attachment
        for animation in ANIMATIONS
        for timeline in animation.get("attachmentTimelines", {}).values()
        for _, attachment in timeline
    }
    timeline_bones = {
        bone
        for animation in ANIMATIONS
        for bone in animation.get("boneTimelines", {})
    }
    animation_names = {animation["name"] for animation in ANIMATIONS}
    library_animation_names = {animation["name"] for animation in library["rigs"][0]["animations"]}
    source_hashes = {name: sha256(output / f"{name}.png") for name in ATTACHMENT_NAMES}
    spine_head = next(bone for bone in spine_json["bones"] if bone["name"] == "head")
    manifest_root = next(bone for bone in manifest["bones"] if bone["name"] == "root")
    manifest_head = next(bone for bone in manifest["bones"] if bone["name"] == "head")
    spine_head_attachments = [
        attachment
        for slot in SLOTS if slot["bone"] == "head"
        for attachment in spine_skin[slot["name"]].values()
    ]

    reconstructed = Image.new("RGBA", CANVAS)
    reconstructed.alpha_composite(Image.open(output / "portrait_torso.png").convert("RGBA"))
    reconstructed.alpha_composite(Image.open(output / "portrait_head.png").convert("RGBA"))
    reconstruction_equal = np.array_equal(np.asarray(reconstructed), np.asarray(base))
    new_names = set(NEW_FEATURE_SOURCES)
    checks = {
        "attachmentCountIs32": len(manifest_names) == 32,
        "slotCountIs8": len(SLOTS) == 8,
        "manifestEqualsSpineSkin": manifest_names == spine_names,
        "manifestEqualsAtlas": manifest_names == atlas_names,
        "animationNamesMatchSpine": animation_names == set(spine_json["animations"]),
        "animationNamesMatchLibrary": animation_names == library_animation_names,
        "timelineAttachmentReferencesExist": timeline_attachments <= manifest_names,
        "timelineBoneReferencesExist": timeline_bones <= {bone["name"] for bone in manifest["bones"]},
        "allTimelineEndsMatchDuration": all(animation_end_times_valid(animation) for animation in ANIMATIONS),
        "allSlotsShareSafePortraitMotion": all(slot["bone"] == "head" for slot in SLOTS),
        "browserHeadPivotIsExpected": [manifest_root["x"] + manifest_head["x"], manifest_root["y"] + manifest_head["y"]] == [256, 335],
        "spineHeadPivotMatchesBrowser": spine_head.get("y") == -79 and all(item.get("y") == 79 for item in spine_head_attachments),
        "allCanvases512Rgba": all(item["size"] == [512, 512] and item["mode"] == "RGBA" for item in attachment_stats.values()),
        "allAttachmentsHaveNoHiddenRgb": all(item["hiddenRgbUnderZeroAlphaPixels"] == 0 for item in attachment_stats.values()),
        "newFeaturesRemainSparse": all(attachment_stats[name]["alphaPixels"] < 5000 for name in new_names),
        "newFeaturesHaveNoLargeSkinPlate": all(attachment_stats[name]["skinTonePixels"] < 2500 for name in new_names),
        "portraitSplitReconstructsOriginal": reconstruction_equal,
    }
    report = {
        "bundle": PUBLIC_ROOT,
        "sourceActionSheet": f"{PUBLIC_ROOT}/sources/silver_face_actions_4x2_chroma.png",
        "sourceComponentSheet": f"{PUBLIC_ROOT}/sources/silver_face_components_4x3_chroma.png",
        "normalizedActionSheet": f"{PUBLIC_ROOT}/sources/silver_face_actions_4x2_normalized.png",
        "canvas": list(CANVAS),
        "attachments": ATTACHMENT_NAMES,
        "slots": [slot["name"] for slot in SLOTS],
        "animations": sorted(animation_names),
        "newFeatureExtraction": new_feature_qa,
        "attachmentStats": attachment_stats,
        "attachmentSha256": source_hashes,
        "checks": checks,
        "pass": all(checks.values()),
    }
    (output / "qa_bundle_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    if not report["pass"]:
        failed = [name for name, passed in checks.items() if not passed]
        raise RuntimeError(f"Bundle QA failed: {failed}")

    print(json.dumps({
        "output": str(output),
        "attachments": len(ATTACHMENT_NAMES),
        "slots": len(SLOTS),
        "animations": len(ANIMATIONS),
        "atlas": list(atlas_texture.size),
        "qaPass": report["pass"],
    }, indent=2))


if __name__ == "__main__":
    main()
