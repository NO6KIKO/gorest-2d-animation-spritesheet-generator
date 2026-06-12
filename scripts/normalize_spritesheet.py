"""Normalize a redrawn spritesheet without changing character proportions.

Pipeline:
1. Remove chroma key if present.
2. Detect sprite layout from image dimensions and distances between visible sprites.
3. Crop each frame from detected grid boundaries, falling back to proportional grid if needed.
4. Normalize with one global uniform scale.
5. Align every frame to a fixed upper-body/root anchor so the character stays in place.

This script is the architectural guardrail against:
- non-uniform character compression/stretching
- per-frame bbox centering drift
- blindly assuming generated sheets are perfectly equal grids
"""

from __future__ import annotations

import argparse
import json
import statistics
import time
from pathlib import Path
from PIL import Image

PROPORTION_POLICY = "uniform_scale_preserve_input_character_proportions"
ROOT_ANCHOR_POLICY = "fixed_upper_body_centroid_anchor_character_position_stable"
GRID_POLICY = "auto_detect_grid_from_sprite_distances_then_fallback_proportional"


def remove_chroma_key(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    pix = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            green_score = g - max(r, b)
            magenta_score = min(r, b) - g
            if g > 130 and green_score > 35:
                if green_score > 82:
                    pix[x, y] = (r, g, b, 0)
                else:
                    alpha_cut = max(0, min(255, int((green_score - 35) / 47 * 255)))
                    pix[x, y] = (r, min(g, max(r, b) + 8), b, 255 - alpha_cut)
            elif r > 120 and b > 120 and g < 170 and magenta_score > 18:
                if magenta_score > 34:
                    pix[x, y] = (r, g, b, 0)
                else:
                    alpha_cut = max(0, min(255, int((magenta_score - 18) / 16 * 255)))
                    clean = max(g + 4, min(r, b))
                    pix[x, y] = (clean, g, clean, 255 - alpha_cut)
            elif a > 0 and r > 55 and b > 55 and g < 115 and min(r, b) - g > 12:
                if max(r, b) > 150 and min(r, b) - g > 28:
                    pix[x, y] = (r, g, b, 0)
                else:
                    clean = max(0, min(g + 10, min(r, b) - 36))
                    pix[x, y] = (clean, g, clean, a)
            elif g > 135 and b > 135 and r < 130 and min(g, b) - r > 38:
                cyan_score = min(g, b) - r
                if cyan_score > 72:
                    pix[x, y] = (r, g, b, 0)
                else:
                    alpha_cut = max(0, min(255, int((cyan_score - 38) / 34 * 255)))
                    clean = max(0, min(r + 8, min(g, b) - 24))
                    pix[x, y] = (r, clean, clean, 255 - alpha_cut)
    return img


def projection_runs(counts: list[int], threshold: int, merge_gap: int, min_size: int) -> list[tuple[int, int]]:
    runs: list[tuple[int, int]] = []
    start = None
    for idx, value in enumerate(counts):
        if value > threshold and start is None:
            start = idx
        elif value <= threshold and start is not None:
            runs.append((start, idx))
            start = None
    if start is not None:
        runs.append((start, len(counts)))

    merged: list[tuple[int, int]] = []
    for run in runs:
        if not merged:
            merged.append(run)
            continue
        prev = merged[-1]
        if run[0] - prev[1] <= merge_gap:
            merged[-1] = (prev[0], run[1])
        else:
            merged.append(run)
    return [run for run in merged if run[1] - run[0] >= min_size]


def boundaries_from_runs(runs: list[tuple[int, int]], expected: int, size: int) -> list[int] | None:
    if len(runs) != expected:
        return None
    centers = [(a + b) / 2 for a, b in runs]
    if len(centers) == 1:
        return [0, size]
    distances = [centers[i + 1] - centers[i] for i in range(len(centers) - 1)]
    median_distance = statistics.median(distances)
    if median_distance <= 0:
        return None
    bounds = [round(centers[0] - median_distance / 2)]
    for i in range(len(centers) - 1):
        bounds.append(round((centers[i] + centers[i + 1]) / 2))
    bounds.append(round(centers[-1] + median_distance / 2))
    bounds[0] = max(0, bounds[0])
    bounds[-1] = min(size, bounds[-1])
    if any(bounds[i + 1] <= bounds[i] for i in range(len(bounds) - 1)):
        return None
    return bounds


def proportional_bounds(size: int, count: int) -> list[int]:
    return [round(i * size / count) for i in range(count + 1)]


def detect_grid_bounds(img: Image.Image, columns: int, rows: int, force_proportional: bool = False) -> tuple[list[int], list[int], dict]:
    alpha = img.getchannel("A")
    pix = alpha.load()
    w, h = img.size
    if force_proportional:
        x_bounds = proportional_bounds(w, columns)
        y_bounds = proportional_bounds(h, rows)
        return x_bounds, y_bounds, {
            "mode": "proportional_forced",
            "xRuns": [],
            "yRuns": [],
            "xBounds": x_bounds,
            "yBounds": y_bounds,
        }
    x_counts = []
    for x in range(w):
        x_counts.append(sum(1 for y in range(h) if pix[x, y] > 24))
    y_counts = []
    for y in range(h):
        y_counts.append(sum(1 for x in range(w) if pix[x, y] > 24))

    x_threshold = max(3, round(h * 0.006))
    y_threshold = max(3, round(w * 0.006))
    x_runs = projection_runs(x_counts, x_threshold, merge_gap=max(6, w // 160), min_size=max(12, w // 80))
    y_runs = projection_runs(y_counts, y_threshold, merge_gap=max(6, h // 160), min_size=max(12, h // 80))

    x_bounds = boundaries_from_runs(x_runs, columns, w)
    y_bounds = boundaries_from_runs(y_runs, rows, h)
    mode = "auto_detected"
    if x_bounds is None or y_bounds is None:
        x_bounds = proportional_bounds(w, columns)
        y_bounds = proportional_bounds(h, rows)
        mode = "proportional_fallback"

    return x_bounds, y_bounds, {
        "mode": mode,
        "xRuns": x_runs,
        "yRuns": y_runs,
        "xBounds": x_bounds,
        "yBounds": y_bounds,
    }


def upper_body_anchor(alpha: Image.Image, bbox: tuple[int, int, int, int]) -> tuple[float, float]:
    bx0, by0, bx1, by1 = bbox
    bw, bh = bx1 - bx0, by1 - by0
    upper_y1 = by0 + int(bh * 0.58)
    pix = alpha.load()
    xs = ys = total = 0.0
    for y in range(by0, max(by0 + 1, upper_y1)):
        for x in range(bx0, bx1):
            a = pix[x, y]
            if a > 24:
                xs += x * a
                ys += y * a
                total += a
    if total:
        return xs / total, ys / total
    return (bx0 + bx1) / 2, by0 + bh * 0.32


def normalize_sheet(input_path: Path, output_path: Path, columns: int, rows: int, frame_width: int, frame_height: int, image_href: str, force_proportional: bool = False):
    img = remove_chroma_key(Image.open(input_path))
    w, h = img.size
    frame_count = columns * rows
    x_bounds, y_bounds, grid_detection = detect_grid_bounds(img, columns, rows, force_proportional)

    cells = []
    boxes = []
    anchors = []
    source_cells = []
    for row in range(rows):
        for col in range(columns):
            x0, x1 = x_bounds[col], x_bounds[col + 1]
            y0, y1 = y_bounds[row], y_bounds[row + 1]
            # Generated sheets often include thin separator lines. Drop those before bbox
            # measurement so a grid border cannot become the thing we scale.
            inset = max(1, round(min(x1 - x0, y1 - y0) * 0.01))
            crop_x0 = min(x1, x0 + inset)
            crop_y0 = min(y1, y0 + inset)
            crop_x1 = max(crop_x0 + 1, x1 - inset)
            crop_y1 = max(crop_y0 + 1, y1 - inset)
            cell = img.crop((crop_x0, crop_y0, crop_x1, crop_y1))
            alpha = cell.getchannel("A")
            bbox = alpha.getbbox()
            cells.append(cell)
            boxes.append(bbox)
            source_cells.append([crop_x0, crop_y0, crop_x1, crop_y1])
            anchors.append(upper_body_anchor(alpha, bbox) if bbox else None)

    valid = [box for box in boxes if box]
    if not valid:
        raise RuntimeError("No visible sprite pixels found after chroma removal")

    max_w = max(box[2] - box[0] for box in valid)
    max_h = max(box[3] - box[1] for box in valid)
    # One uniform scale only. The frame can be rectangular; the character never gets distorted.
    scale = min((frame_width - 12) / max_w, (frame_height - 12) / max_h)

    scaled_anchor_offsets = []
    for bbox, anchor in zip(boxes, anchors):
        if not bbox or not anchor:
            continue
        bx0, by0, _, _ = bbox
        ax, ay = anchor
        scaled_anchor_offsets.append(((ax - bx0) * scale, (ay - by0) * scale))
    target_anchor = (frame_width / 2, frame_height * 0.305)

    sheet = Image.new("RGBA", (frame_width * columns, frame_height * rows), (0, 0, 0, 0))
    frame_bboxes = []
    root_anchors = []
    for idx, (cell, bbox, anchor) in enumerate(zip(cells, boxes, anchors)):
        row = idx // columns
        col = idx % columns
        if not bbox or not anchor:
            frame_bboxes.append(None)
            root_anchors.append(None)
            continue
        bx0, by0, _, _ = bbox
        sprite = cell.crop(bbox)
        sw, sh = sprite.size
        nw = max(1, round(sw * scale))
        nh = max(1, round(sh * scale))
        sprite = sprite.resize((nw, nh), Image.Resampling.LANCZOS)
        ax, ay = anchor
        anchor_x = (ax - bx0) * scale
        anchor_y = (ay - by0) * scale
        local_x = round(target_anchor[0] - anchor_x)
        local_y = round(target_anchor[1] - anchor_y)
        if nw <= frame_width - 8:
            local_x = max(4, min(frame_width - nw - 4, local_x))
        else:
            local_x = (frame_width - nw) // 2
        if nh <= frame_height - 8:
            local_y = max(4, min(frame_height - nh - 4, local_y))
        else:
            local_y = (frame_height - nh) // 2
        px = col * frame_width + local_x
        py = row * frame_height + local_y
        sheet.alpha_composite(sprite, (px, py))
        frame_bboxes.append([local_x, local_y, nw, nh])
        root_anchors.append([round(target_anchor[0], 2), round(target_anchor[1], 2)])

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)

    frames = []
    for idx in range(frame_count):
        col = idx % columns
        row = idx // columns
        x = col * frame_width
        y = row * frame_height
        frames.append(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x} {y} {frame_width} {frame_height}" '
            f'width="{frame_width}" height="{frame_height}"><image href="{image_href}" x="0" y="0" '
            f'width="{frame_width * columns}" height="{frame_height * rows}" preserveAspectRatio="none"/></svg>'
        )

    return {
        "frameCount": frame_count,
        "cellSize": frame_width if frame_width == frame_height else None,
        "frameSize": [frame_width, frame_height],
        "sheetSize": [frame_width * columns, frame_height * rows],
        "sourceSheetSize": [img.size[0], img.size[1]],
        "sourceCells": source_cells,
        "frameBboxes": frame_bboxes,
        "rootAnchors": root_anchors,
        "gridPolicy": GRID_POLICY,
        "gridDetection": grid_detection,
        "proportionPolicy": PROPORTION_POLICY,
        "rootAnchorPolicy": ROOT_ANCHOR_POLICY,
        "normalization": "global_uniform_scale_fixed_root_anchor_auto_grid_no_nonuniform_scaling",
        "createdTime": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "frames": frames,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--image-href", required=True)
    parser.add_argument("--columns", type=int, default=4)
    parser.add_argument("--rows", type=int, default=4)
    parser.add_argument("--cell-size", type=int, default=256)
    parser.add_argument("--frame-width", type=int)
    parser.add_argument("--frame-height", type=int)
    parser.add_argument("--force-proportional-grid", action="store_true")
    parser.add_argument("--manifest-out", type=Path)
    args = parser.parse_args()

    frame_width = args.frame_width or args.cell_size
    frame_height = args.frame_height or args.cell_size
    meta = normalize_sheet(args.input, args.output, args.columns, args.rows, frame_width, frame_height, args.image_href, args.force_proportional_grid)
    if args.manifest_out:
        args.manifest_out.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False))


if __name__ == "__main__":
    main()
