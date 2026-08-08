"""Normalize multiple drawn turnaround sheets into one object-rotate spritesheet.

The source art is never redrawn or warped. The script detects the real source
grid, removes disconnected cross-cell debris, applies one global uniform scale,
and translates every view onto one shared upper-body pivot in X and Y.
"""

from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

from normalize_spritesheet import detect_grid_bounds, upper_body_anchor


PIVOT_POLICY = "shared_upper_body_alpha_centroid_xy_object_rotation_pivot"
PROPORTION_POLICY = "one_global_uniform_scale_preserve_generated_proportions"
COMPONENT_POLICY = "keep_largest_connected_subject_component_and_one_pixel_alpha_fringe"


def parse_layer(value: str) -> tuple[float, Path]:
    angle, separator, path = value.partition("=")
    if not separator or not path:
        raise argparse.ArgumentTypeError("layer must use ANGLE=PATH, for example 30=source.png")
    try:
        parsed_angle = float(angle)
    except ValueError as error:
        raise argparse.ArgumentTypeError(f"invalid layer angle: {angle}") from error
    return parsed_angle, Path(path)


def keep_main_component(cell: Image.Image, alpha_threshold: int) -> tuple[Image.Image, dict]:
    rgba = cell.convert("RGBA")
    alpha = rgba.getchannel("A")
    width, height = rgba.size
    pixels = alpha.load()
    visited = bytearray(width * height)
    largest: list[tuple[int, int]] = []
    component_sizes: list[int] = []

    for y in range(height):
        for x in range(width):
            offset = y * width + x
            if visited[offset] or pixels[x, y] <= alpha_threshold:
                continue
            queue = deque([(x, y)])
            visited[offset] = 1
            component: list[tuple[int, int]] = []
            while queue:
                px, py = queue.popleft()
                component.append((px, py))
                for ny in range(max(0, py - 1), min(height, py + 2)):
                    for nx in range(max(0, px - 1), min(width, px + 2)):
                        next_offset = ny * width + nx
                        if visited[next_offset] or pixels[nx, ny] <= alpha_threshold:
                            continue
                        visited[next_offset] = 1
                        queue.append((nx, ny))
            component_sizes.append(len(component))
            if len(component) > len(largest):
                largest = component

    if not largest:
        raise RuntimeError("No visible subject component found in a detected source cell")

    mask = Image.new("L", rgba.size, 0)
    mask_pixels = mask.load()
    for x, y in largest:
        mask_pixels[x, y] = 255
    # Restore the main component's antialiased fringe without bringing back
    # disconnected pixels from neighbouring generated cells.
    mask = mask.filter(ImageFilter.MaxFilter(3))
    cleaned_alpha = Image.new("L", rgba.size, 0)
    cleaned_alpha.paste(alpha, mask=mask)
    rgba.putalpha(cleaned_alpha)
    return rgba, {
        "componentCount": len(component_sizes),
        "mainComponentPixels": len(largest),
        "removedComponentPixels": sum(component_sizes) - len(largest),
    }


def normalize_object_rotate(
    layers: list[tuple[float, Path]],
    output_path: Path,
    manifest_path: Path,
    image_href: str,
    source_columns: int,
    source_rows: int,
    frame_size: int,
    pack_columns: int,
    safe_padding: int,
    alpha_threshold: int,
) -> dict:
    if not layers:
        raise ValueError("At least one --layer is required")
    if source_columns * source_rows <= 0:
        raise ValueError("Source grid dimensions must be positive")
    if safe_padding < 0 or safe_padding * 2 >= frame_size:
        raise ValueError("safe padding must be non-negative and smaller than half the frame")

    expected_frames_per_layer = source_columns * source_rows
    source_layers = []
    frames = []
    for elevation, source_path in layers:
        source = Image.open(source_path).convert("RGBA")
        x_bounds, y_bounds, grid_detection = detect_grid_bounds(source, source_columns, source_rows)
        layer_meta = {
            "elevation": elevation,
            "path": str(source_path).replace("\\", "/"),
            "sourceSize": list(source.size),
            "gridDetection": grid_detection,
        }
        source_layers.append(layer_meta)
        for source_index in range(expected_frames_per_layer):
            column = source_index % source_columns
            row = source_index // source_columns
            source_cell = [
                x_bounds[column],
                y_bounds[row],
                x_bounds[column + 1],
                y_bounds[row + 1],
            ]
            cell = source.crop(tuple(source_cell))
            cleaned, component_meta = keep_main_component(cell, alpha_threshold)
            alpha = cleaned.getchannel("A")
            bbox = alpha.getbbox()
            if not bbox:
                raise RuntimeError(f"No visible subject at elevation {elevation}, source frame {source_index}")
            pivot = upper_body_anchor(alpha, bbox)
            left, top, right, bottom = bbox
            source_margins = {
                "left": left,
                "top": top,
                "right": cleaned.width - right,
                "bottom": cleaned.height - bottom,
            }
            if min(source_margins.values()) <= 2:
                raise RuntimeError(
                    f"Main subject touches an auto-detected cell edge at elevation {elevation}, "
                    f"source frame {source_index}: {source_margins}"
                )
            frames.append({
                "elevation": elevation,
                "azimuth": source_index * (360 / expected_frames_per_layer),
                "sourceFrame": source_index,
                "sourceCell": source_cell,
                "sourceBbox": list(bbox),
                "sourceMargins": source_margins,
                "sourcePivot": list(pivot),
                "componentCleanup": component_meta,
                "image": cleaned,
                "bbox": bbox,
                "pivot": pivot,
            })

    effective_padding = safe_padding + 2
    target_x = frame_size / 2
    max_left = max(frame["pivot"][0] - frame["bbox"][0] for frame in frames)
    max_right = max(frame["bbox"][2] - frame["pivot"][0] for frame in frames)
    max_top = max(frame["pivot"][1] - frame["bbox"][1] for frame in frames)
    max_bottom = max(frame["bbox"][3] - frame["pivot"][1] for frame in frames)
    limits = [
        1.0,
        (target_x - effective_padding) / max_left,
        (frame_size - effective_padding - target_x) / max_right,
        (frame_size - effective_padding * 2) / (max_top + max_bottom),
    ]
    global_scale = min(limits)
    if global_scale <= 0:
        raise RuntimeError("Shared pivot and safe padding leave no room for the subject")
    target_y = effective_padding + max_top * global_scale

    frame_count = len(frames)
    pack_rows = (frame_count + pack_columns - 1) // pack_columns
    sheet = Image.new(
        "RGBA",
        (pack_columns * frame_size, pack_rows * frame_size),
        (0, 0, 0, 0),
    )
    final_margins = []
    manifest_frames = []
    for index, frame in enumerate(frames):
        left, top, right, bottom = frame["bbox"]
        sprite = frame["image"].crop(frame["bbox"])
        scaled_size = (
            max(1, round(sprite.width * global_scale)),
            max(1, round(sprite.height * global_scale)),
        )
        sprite = sprite.resize(scaled_size, Image.Resampling.LANCZOS)
        pivot_x = (frame["pivot"][0] - left) * global_scale
        pivot_y = (frame["pivot"][1] - top) * global_scale
        placement_x = round(target_x - pivot_x)
        placement_y = round(target_y - pivot_y)
        normalized = Image.new("RGBA", (frame_size, frame_size), (0, 0, 0, 0))
        normalized.alpha_composite(sprite, (placement_x, placement_y))
        normalized_bbox = normalized.getchannel("A").getbbox()
        if not normalized_bbox:
            raise RuntimeError(f"Normalized frame {index} is empty")
        n_left, n_top, n_right, n_bottom = normalized_bbox
        margins = {
            "left": n_left,
            "top": n_top,
            "right": frame_size - n_right,
            "bottom": frame_size - n_bottom,
        }
        if min(margins.values()) < safe_padding:
            raise RuntimeError(f"Normalized frame {index} violates safe padding: {margins}")
        final_margins.append(margins)

        packed_x = (index % pack_columns) * frame_size
        packed_y = (index // pack_columns) * frame_size
        sheet.alpha_composite(normalized, (packed_x, packed_y))
        manifest_frames.append({
            "frame": index,
            "elevation": frame["elevation"],
            "azimuth": frame["azimuth"],
            "sourceFrame": frame["sourceFrame"],
            "sourceCell": frame["sourceCell"],
            "sourceBbox": frame["sourceBbox"],
            "sourceMargins": frame["sourceMargins"],
            "sourcePivot": frame["sourcePivot"],
            "componentCleanup": frame["componentCleanup"],
            "normalizedPlacement": [n_left, n_top, n_right - n_left, n_bottom - n_top],
            "normalizedPivot": [target_x, target_y],
            "finalMargins": margins,
            "packedCell": [packed_x, packed_y, packed_x + frame_size, packed_y + frame_size],
        })

    minimum_margins = {
        edge: min(frame[edge] for frame in final_margins)
        for edge in ("left", "top", "right", "bottom")
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)

    manifest = {
        "version": 2,
        "frameCount": frame_count,
        "azimuthFrames": expected_frames_per_layer,
        "elevationAngles": [angle for angle, _ in layers],
        "frameSize": [frame_size, frame_size],
        "packColumns": pack_columns,
        "sheetSize": list(sheet.size),
        "globalScale": global_scale,
        "safePadding": safe_padding,
        "normalizedPivot": [target_x, target_y],
        "pivotPolicy": PIVOT_POLICY,
        "proportionPolicy": PROPORTION_POLICY,
        "componentPolicy": COMPONENT_POLICY,
        "sourceLayers": source_layers,
        "sourceEdgeRiskCount": 0,
        "finalMinimumMargins": minimum_margins,
        "imageHref": image_href,
        "frames": manifest_frames,
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {
        "frameCount": frame_count,
        "globalScale": global_scale,
        "normalizedPivot": [target_x, target_y],
        "finalMinimumMargins": minimum_margins,
        "sourceEdgeRiskCount": 0,
        "removedComponentPixels": sum(
            frame["componentCleanup"]["removedComponentPixels"] for frame in manifest_frames
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--layer", action="append", required=True, type=parse_layer, help="ANGLE=PATH; repeat in desired elevation order")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--manifest-out", required=True, type=Path)
    parser.add_argument("--image-href", required=True)
    parser.add_argument("--source-columns", type=int, default=4)
    parser.add_argument("--source-rows", type=int, default=4)
    parser.add_argument("--frame-size", type=int, default=320)
    parser.add_argument("--pack-columns", type=int, default=10)
    parser.add_argument("--safe-padding", type=int, default=28)
    parser.add_argument("--alpha-threshold", type=int, default=8)
    args = parser.parse_args()
    summary = normalize_object_rotate(
        args.layer,
        args.output,
        args.manifest_out,
        args.image_href,
        args.source_columns,
        args.source_rows,
        args.frame_size,
        args.pack_columns,
        args.safe_padding,
        args.alpha_threshold,
    )
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
