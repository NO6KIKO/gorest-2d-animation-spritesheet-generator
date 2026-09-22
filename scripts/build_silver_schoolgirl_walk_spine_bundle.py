"""Build Wei Yang's full-body walk as a Gorest rig and Spine 4.2 bundle.

The visible motion comes from the existing image-generated, head-locked walk
sheet. This script only performs permitted post-processing: cyan edge cleanup,
fixed-canvas registration, sheet splitting, atlas packing, metadata wiring, and
QA reporting.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


RIG_ID = "wei_yang_fullbody_walk_rig"
RIG_NAME = "Wei Yang / Full-Body Walk Rig"
SPINE_VERSION = "4.2.22"
SOURCE_FRAME = (608, 1055)
SOURCE_GRID = (4, 2)
CANVAS = (640, 1152)
PAD = (16, 48)
ROOT_ANCHOR = (320, 1072)
FPS = 12
FRAME_COUNT = 8
FRAME_NAMES = [f"walk_right_{index:02d}" for index in range(FRAME_COUNT)]
PUBLIC_ROOT = f"/generated/rigged/{RIG_ID}"


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source-sheet",
        type=Path,
        default=repo_root / "public" / "generated" / "wei_yang_walk_right_one_cycle_headlocked_sheet.png",
    )
    parser.add_argument(
        "--identity-reference",
        type=Path,
        default=repo_root / "public" / "generated" / "wei_yang_idle_front_source_clean.png",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=repo_root / "public" / "generated" / "rigged" / RIG_ID,
    )
    parser.add_argument(
        "--library",
        type=Path,
        default=repo_root / "public" / "generated" / "rigged_2d_library.json",
    )
    return parser.parse_args()


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def image_hash(image: Image.Image) -> str:
    return hashlib.sha256(image.tobytes()).hexdigest()


def cleanup_cyan_edge(image: Image.Image) -> tuple[Image.Image, dict[str, int]]:
    """Remove cyan key residue only near transparent silhouette edges."""

    rgba = image.convert("RGBA")
    source = np.asarray(rgba, dtype=np.uint8).copy()
    alpha_image = rgba.getchannel("A")
    transparent = alpha_image.point(lambda value: 255 if value < 8 else 0)
    near_transparent = np.asarray(transparent.filter(ImageFilter.MaxFilter(7)), dtype=np.uint8) > 0

    red = source[..., 0].astype(np.int16)
    green = source[..., 1].astype(np.int16)
    blue = source[..., 2].astype(np.int16)
    opacity = source[..., 3].astype(np.float32)
    cyan_score = np.minimum(green, blue) - red
    cyan_balance = np.abs(green - blue)
    candidate = (
        near_transparent
        & (opacity > 0)
        & (np.minimum(green, blue) > 70)
        & (cyan_score > 36)
        & (cyan_balance < 80)
    )
    strength = np.clip((cyan_score.astype(np.float32) - 36.0) / 40.0, 0.0, 1.0)
    strength = np.where(candidate, strength, 0.0)
    cleaned_opacity = np.rint(opacity * (1.0 - strength)).astype(np.uint8)

    # Pull surviving antialiased edge colors away from cyan without touching the
    # interior forest-green uniform.
    target = np.clip(red + 8, 0, 255).astype(np.float32)
    for channel in (1, 2):
        values = source[..., channel].astype(np.float32)
        source[..., channel] = np.rint(values * (1.0 - strength) + target * strength).astype(np.uint8)
    source[..., 3] = np.minimum(source[..., 3], cleaned_opacity)
    hidden = source[..., 3] == 0
    source[hidden, :3] = 0
    cleaned = Image.fromarray(source, mode="RGBA")
    return cleaned, {
        "candidatePixels": int(candidate.sum()),
        "fullyRemovedPixels": int((candidate & (source[..., 3] == 0)).sum()),
        "partiallyCleanedPixels": int((candidate & (source[..., 3] > 0)).sum()),
    }


def split_and_register(source: Image.Image, output: Path) -> tuple[list[Image.Image], list[dict]]:
    expected = (SOURCE_FRAME[0] * SOURCE_GRID[0], SOURCE_FRAME[1] * SOURCE_GRID[1])
    if source.size != expected:
        raise ValueError(f"Expected source sheet {expected}, got {source.size}")

    frame_dir = output / "frames"
    frame_dir.mkdir(parents=True, exist_ok=True)
    frames: list[Image.Image] = []
    reports: list[dict] = []
    for index, name in enumerate(FRAME_NAMES):
        column, row = index % SOURCE_GRID[0], index // SOURCE_GRID[0]
        left, top = column * SOURCE_FRAME[0], row * SOURCE_FRAME[1]
        raw = source.crop((left, top, left + SOURCE_FRAME[0], top + SOURCE_FRAME[1]))
        source_bbox = raw.getchannel("A").getbbox()
        cleaned, cleanup_report = cleanup_cyan_edge(raw)
        canvas = Image.new("RGBA", CANVAS)
        canvas.alpha_composite(cleaned, PAD)
        bbox = canvas.getchannel("A").getbbox()
        if bbox is None:
            raise ValueError(f"Frame {index} has no visible pixels")
        safe_padding = {
            "left": bbox[0],
            "top": bbox[1],
            "right": CANVAS[0] - bbox[2],
            "bottom": CANVAS[1] - bbox[3],
        }
        canvas.save(frame_dir / f"{name}.png", optimize=True)
        frames.append(canvas)
        reports.append(
            {
                "index": index,
                "name": name,
                "sourceCell": [left, top, SOURCE_FRAME[0], SOURCE_FRAME[1]],
                "sourceAlphaBounds": list(source_bbox) if source_bbox else None,
                "registeredAlphaBounds": list(bbox),
                "safePadding": safe_padding,
                "minSafePadding": min(safe_padding.values()),
                "sourceEdgeRisk": bool(
                    source_bbox
                    and (
                        source_bbox[0] <= 2
                        or source_bbox[1] <= 2
                        or SOURCE_FRAME[0] - source_bbox[2] <= 2
                        or SOURCE_FRAME[1] - source_bbox[3] <= 2
                    )
                ),
                "cleanup": cleanup_report,
                "sha256Pixels": image_hash(canvas),
            }
        )
    return frames, reports


def build_thumbnail(frame: Image.Image, output: Path) -> None:
    thumbnail = Image.new("RGBA", (512, 512))
    scale = min(460 / frame.height, 460 / frame.width)
    resized = frame.resize(
        (max(1, round(frame.width * scale)), max(1, round(frame.height * scale))),
        Image.Resampling.LANCZOS,
    )
    thumbnail.alpha_composite(resized, ((512 - resized.width) // 2, (512 - resized.height) // 2))
    thumbnail.save(output / "thumbnail.png", optimize=True)


def build_atlas(frames: list[Image.Image], output: Path) -> tuple[Image.Image, str, dict[str, tuple[int, int]]]:
    columns = 4
    rows = math.ceil(len(frames) / columns)
    atlas = Image.new("RGBA", (columns * CANVAS[0], rows * CANVAS[1]))
    placements: dict[str, tuple[int, int]] = {}
    for index, (name, frame) in enumerate(zip(FRAME_NAMES, frames, strict=True)):
        x, y = (index % columns) * CANVAS[0], (index // columns) * CANVAS[1]
        atlas.alpha_composite(frame, (x, y))
        placements[name] = (x, y)
    texture_name = "wei-yang-walk-rig.png"
    atlas.save(output / texture_name, optimize=True)
    lines = [
        texture_name,
        f"size: {atlas.width}, {atlas.height}",
        "format: RGBA8888",
        "filter: Linear, Linear",
        "repeat: none",
        "pma: false",
    ]
    for name in FRAME_NAMES:
        x, y = placements[name]
        lines.extend([name, f"bounds: {x}, {y}, {CANVAS[0]}, {CANVAS[1]}"])
    atlas_text = "\n".join(lines) + "\n"
    (output / "wei-yang-walk-rig.atlas").write_text(atlas_text, encoding="utf-8")
    return atlas, atlas_text, placements


def attachment_timeline() -> list[list[object]]:
    keys = [[round(index / FPS, 6), name] for index, name in enumerate(FRAME_NAMES)]
    keys.append([round(FRAME_COUNT / FPS, 6), FRAME_NAMES[0]])
    return keys


def library_entry() -> dict:
    return {
        "id": RIG_ID,
        "name": RIG_NAME,
        "characterName": "Wei Yang",
        "description": (
            "Eight registered, fully drawn side-view frames form a seamless full-body walk cycle "
            "with a locked head scale and foot baseline."
        ),
        "focus": "full-body-walk",
        "thumbnailUrl": f"{PUBLIC_ROOT}/thumbnail.png",
        "previewSheetUrl": f"{PUBLIC_ROOT}/wei-yang-walk-rig.png",
        "rigManifestUrl": f"{PUBLIC_ROOT}/rig.json",
        "spineJsonUrl": f"{PUBLIC_ROOT}/wei-yang-walk-rig.json",
        "spineAtlasUrl": f"{PUBLIC_ROOT}/wei-yang-walk-rig.atlas",
        "spineTextureUrl": f"{PUBLIC_ROOT}/wei-yang-walk-rig.png",
        "frameSize": list(CANVAS),
        "frameCount": FRAME_COUNT,
        "fps": FPS,
        "animations": [{"name": "walk_right", "loop": True}],
        "defaultAnimation": "walk_right",
        "updatedTime": "2026-09-03T00:00:00.000Z",
        "tags": [
            "wei-yang",
            "silver-hair",
            "green-school-uniform",
            "full-body",
            "walk-cycle",
            "frame-attachments",
            "spine-4.2",
        ],
    }


def build_gorest_manifest(output: Path, frame_reports: list[dict]) -> dict:
    timeline = attachment_timeline()
    attachments = {
        name: {
            "file": f"frames/{name}.png",
            "canvas": list(CANVAS),
            "anchor": list(ROOT_ANCHOR),
            "transformBaked": True,
            "content": "registered full-body drawn walk frame",
        }
        for name in FRAME_NAMES
    }
    slot = {
        "name": "full_body",
        "bone": "root",
        "attachment": FRAME_NAMES[0],
        "variants": FRAME_NAMES[1:],
    }
    poses = [
        "contact_a",
        "down_a",
        "passing_a",
        "up_a",
        "contact_b",
        "down_b",
        "passing_b",
        "up_b",
    ]
    manifest = {
        "schemaVersion": 4,
        "id": RIG_ID,
        "name": RIG_NAME,
        "characterName": "Wei Yang",
        "focus": "full-body-walk",
        "runtime": "gorest-attachment-bone-mixer-v2",
        "spineStatus": "spine-4.2-region-attachment-bundle",
        "previewSheetUrl": f"{PUBLIC_ROOT}/wei-yang-walk-rig.png",
        "frameSize": list(CANVAS),
        "frameCount": FRAME_COUNT,
        "fps": FPS,
        "attachments": attachments,
        "slots": [slot],
        "bones": [{"name": "root", "pivot": list(ROOT_ANCHOR)}],
        "animations": [
            {
                "name": "walk_right",
                "category": "Locomotion",
                "duration": round(FRAME_COUNT / FPS, 6),
                "loop": True,
                "attachmentTimelines": {"full_body": timeline},
                "playback": {"mode": "loop", "speed": 1, "autoStart": True},
            }
        ],
        "posePresets": [
            {"id": pose, "name": pose.replace("_", " ").title(), "attachments": {"full_body": name}}
            for pose, name in zip(poses, FRAME_NAMES, strict=True)
        ],
        "editorTransforms": {"full_body": {"translate": [0, 0], "scale": [1, 1]}},
        "generationMode": "spine-frame-attachment-rig-from-existing-drawn-walk-cycle",
        "sourceSheet": "/generated/wei_yang_walk_right_one_cycle_headlocked_sheet.png",
        "identityReference": "/generated/wei_yang_idle_front_source_clean.png",
        "normalization": {
            "sourceFrameSize": list(SOURCE_FRAME),
            "registeredFrameSize": list(CANVAS),
            "fixedPadding": list(PAD),
            "rootAnchor": list(ROOT_ANCHOR),
            "rootAnchorPolicy": "fixed foot baseline and shared full-body canvas; no per-frame recentering",
            "safePaddingTarget": "at least 8% of the 640 px shorter edge",
        },
        "qualityPolicy": (
            "Visible character motion is retained from the existing image-generated Wei Yang walk cycle. "
            "Code only removes residual cyan at transparent edges, zeroes hidden RGB, pads every frame "
            "onto one fixed canvas, splits frames, packs the atlas, and wires attachment timelines."
        ),
        "frameQA": frame_reports,
        "limitations": [
            "This portable Spine export uses region-attachment frame swapping rather than mesh deformation or IK.",
            "The browser preview uses Gorest's attachment mixer; validate the download with a licensed Spine 4.2 runtime.",
            "The bundle contains the genuinely drawn right-facing cycle; engines may flip the actor transform for leftward travel.",
        ],
    }
    write_json(output / "rig.json", manifest)
    return manifest


def build_spine_json(output: Path) -> dict:
    center_y_from_root = ROOT_ANCHOR[1] - CANVAS[1] / 2
    attachments = {
        name: {
            "x": 0,
            "y": center_y_from_root,
            "width": CANVAS[0],
            "height": CANVAS[1],
        }
        for name in FRAME_NAMES
    }
    spine_keys = []
    for time, name in attachment_timeline():
        key = {"name": name}
        if time:
            key["time"] = time
        spine_keys.append(key)
    spine = {
        "skeleton": {
            "spine": SPINE_VERSION,
            "x": -ROOT_ANCHOR[0],
            "y": -(CANVAS[1] - ROOT_ANCHOR[1]),
            "width": CANVAS[0],
            "height": CANVAS[1],
            "images": "./",
        },
        "bones": [{"name": "root"}],
        "slots": [{"name": "full_body", "bone": "root", "attachment": FRAME_NAMES[0]}],
        "skins": [
            {
                "name": "default",
                "attachments": {"full_body": attachments},
            }
        ],
        "animations": {
            "walk_right": {
                "slots": {"full_body": {"attachment": spine_keys}},
            }
        },
    }
    write_json(output / "wei-yang-walk-rig.json", spine)
    return spine


def merge_library(library_path: Path, entry: dict) -> dict:
    if library_path.exists():
        library = json.loads(library_path.read_text(encoding="utf-8"))
    else:
        library = {"schemaVersion": 1, "rigs": []}
    rigs = [rig for rig in library.get("rigs", []) if rig.get("id") != entry["id"]]
    rigs.append(entry)
    library = {**library, "schemaVersion": max(1, int(library.get("schemaVersion", 1))), "rigs": rigs}
    write_json(library_path, library)
    return library


def validate_bundle(
    output: Path,
    manifest: dict,
    spine: dict,
    atlas_text: str,
    frame_reports: list[dict],
    library: dict,
) -> dict:
    atlas_names = {
        line
        for index, line in enumerate(atlas_text.splitlines())
        if index >= 6 and line and not line.startswith("bounds:")
    }
    spine_names = set(spine["skins"][0]["attachments"]["full_body"])
    timeline_names = {name for _, name in manifest["animations"][0]["attachmentTimelines"]["full_body"]}
    min_padding = min(report["minSafePadding"] for report in frame_reports)
    unique_hashes = len({report["sha256Pixels"] for report in frame_reports})
    duration = manifest["animations"][0]["duration"]
    final_key_time = manifest["animations"][0]["attachmentTimelines"]["full_body"][-1][0]
    checks = {
        "attachmentCount": len(manifest["attachments"]) == FRAME_COUNT,
        "allFrameFilesExist": all((output / "frames" / f"{name}.png").exists() for name in FRAME_NAMES),
        "allFramesUnique": unique_hashes == FRAME_COUNT,
        "noSourceCellEdgeRisks": not any(report["sourceEdgeRisk"] for report in frame_reports),
        "safePaddingAtLeastEightPercent": min_padding >= math.floor(CANVAS[0] * 0.08),
        "timelineReferencesAttachments": timeline_names <= set(manifest["attachments"]),
        "timelineReturnsToFirstFrame": manifest["animations"][0]["attachmentTimelines"]["full_body"][-1][1]
        == FRAME_NAMES[0],
        "timelineEndsAtDuration": abs(final_key_time - duration) < 1e-6,
        "spineSkinEqualsAtlas": spine_names == atlas_names,
        "spineAnimationNamesMatchManifest": set(spine["animations"])
        == {animation["name"] for animation in manifest["animations"]},
        "rootAnchorWithinCanvas": 0 <= ROOT_ANCHOR[0] <= CANVAS[0] and 0 <= ROOT_ANCHOR[1] <= CANVAS[1],
        "rootLibraryContainsRig": any(rig.get("id") == RIG_ID for rig in library.get("rigs", [])),
    }
    report = {
        "bundle": PUBLIC_ROOT,
        "sourceSheet": "/generated/wei_yang_walk_right_one_cycle_headlocked_sheet.png",
        "identityReference": "/generated/wei_yang_idle_front_source_clean.png",
        "frameCount": FRAME_COUNT,
        "fps": FPS,
        "duration": duration,
        "registeredFrameSize": list(CANVAS),
        "rootAnchor": list(ROOT_ANCHOR),
        "minimumSafePaddingPx": min_padding,
        "uniqueFrameHashes": unique_hashes,
        "checks": checks,
        "pass": all(checks.values()),
        "frames": frame_reports,
    }
    write_json(output / "qa_bundle_report.json", report)
    if not report["pass"]:
        failed = [name for name, passed in checks.items() if not passed]
        raise RuntimeError(f"Bundle QA failed: {', '.join(failed)}")
    return report


def main() -> None:
    args = parse_args()
    source_path = args.source_sheet.resolve()
    identity_path = args.identity_reference.resolve()
    output = args.output_dir.resolve()
    library_path = args.library.resolve()
    if not source_path.exists():
        raise FileNotFoundError(source_path)
    if not identity_path.exists():
        raise FileNotFoundError(identity_path)
    output.mkdir(parents=True, exist_ok=True)
    (output / "sources").mkdir(parents=True, exist_ok=True)

    source = Image.open(source_path).convert("RGBA")
    frames, frame_reports = split_and_register(source, output)
    shutil.copy2(source_path, output / "sources" / source_path.name)
    shutil.copy2(identity_path, output / "sources" / identity_path.name)
    build_thumbnail(frames[0], output)
    _, atlas_text, _ = build_atlas(frames, output)
    manifest = build_gorest_manifest(output, frame_reports)
    spine = build_spine_json(output)
    entry = library_entry()
    write_json(output / "rigged_2d_library.json", {"schemaVersion": 1, "rigs": [entry]})
    library = merge_library(library_path, entry)
    report = validate_bundle(output, manifest, spine, atlas_text, frame_reports, library)
    print(
        json.dumps(
            {
                "output": str(output),
                "frames": len(frames),
                "minimumSafePaddingPx": report["minimumSafePaddingPx"],
                "qaPass": report["pass"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
