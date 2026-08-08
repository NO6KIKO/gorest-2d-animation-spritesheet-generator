"""Repack the existing drawn raccoon turntable as a long three-row sheet."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

from normalize_object_rotate_spritesheet import keep_main_component


ROOT = Path(__file__).resolve().parents[1]
SHEET_PATH = ROOT / "public/generated/cute_gray_raccoon_720_80v.png"
MANIFEST_PATH = ROOT / "public/generated/cute_gray_raccoon_720_80v_manifest.json"
SELECTED_ELEVATIONS = (30, 0, -30)
AZIMUTH_FRAMES = 16


def main() -> None:
    source = Image.open(SHEET_PATH).convert("RGBA")
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    frame_width, frame_height = manifest["frameSize"]
    frames_by_view = {
        (frame["elevation"], frame["azimuth"]): frame
        for frame in manifest["frames"]
    }

    output = Image.new(
        "RGBA",
        (AZIMUTH_FRAMES * frame_width, len(SELECTED_ELEVATIONS) * frame_height),
        (0, 0, 0, 0),
    )
    output_frames = []
    for row, elevation in enumerate(SELECTED_ELEVATIONS):
        for column in range(AZIMUTH_FRAMES):
            azimuth = column * (360 / AZIMUTH_FRAMES)
            source_frame = frames_by_view[(elevation, azimuth)]
            left, top, right, bottom = source_frame["packedCell"]
            frame_image = source.crop((left, top, right, bottom))
            frame_image, cleanup = keep_main_component(frame_image, alpha_threshold=8)
            packed_cell = [
                column * frame_width,
                row * frame_height,
                (column + 1) * frame_width,
                (row + 1) * frame_height,
            ]
            output.alpha_composite(frame_image, (packed_cell[0], packed_cell[1]))
            updated = dict(source_frame)
            updated["frame"] = row * AZIMUTH_FRAMES + column
            updated["packedCell"] = packed_cell
            updated["repackComponentCleanup"] = cleanup
            output_frames.append(updated)

    output.save(SHEET_PATH)
    manifest.update({
        "version": 3,
        "frameCount": len(output_frames),
        "azimuthFrames": AZIMUTH_FRAMES,
        "elevationAngles": list(SELECTED_ELEVATIONS),
        "packColumns": AZIMUTH_FRAMES,
        "sheetSize": list(output.size),
        "layout": "three_long_turntable_rows",
        "frames": output_frames,
    })
    manifest["sourceLayers"] = [
        layer for layer in manifest.get("sourceLayers", [])
        if layer.get("elevation") in SELECTED_ELEVATIONS
    ]
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "sheetSize": list(output.size),
        "frameCount": len(output_frames),
        "elevationAngles": list(SELECTED_ELEVATIONS),
    }))


if __name__ == "__main__":
    main()
