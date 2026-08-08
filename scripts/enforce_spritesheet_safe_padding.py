"""Add a uniform safety border to an already normalized packed spritesheet.

Every cell is transformed by the same scale around the same source anchor and
placed on the same target anchor. This preserves registration and proportions;
it never redraws or independently recenters individual frames.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


SAFE_FRAME_POLICY = "global_uniform_scale_around_shared_anchor_with_minimum_edge_padding"
SOURCE_EDGE_POLICY = "source_edge_contact_requires_regeneration_to_restore_missing_art"
RESAMPLE_GUARD = 3


def frame_boxes(
    sheet: Image.Image,
    frame_width: int,
    frame_height: int,
    columns: int,
    frame_count: int,
) -> list[tuple[int, int, int, int] | None]:
    boxes = []
    for index in range(frame_count):
        x = (index % columns) * frame_width
        y = (index // columns) * frame_height
        cell = sheet.crop((x, y, x + frame_width, y + frame_height))
        boxes.append(cell.getchannel("A").getbbox())
    return boxes


def source_edge_risks(manifest: dict, threshold: int) -> list[dict]:
    risks = []
    for index, frame in enumerate(manifest.get("frames", [])):
        cell = frame.get("sourceCell")
        bbox = frame.get("bbox")
        if not cell or not bbox:
            continue
        width = cell[2] - cell[0]
        height = cell[3] - cell[1]
        margins = {
            "left": bbox[0],
            "top": bbox[1],
            "right": width - bbox[2],
            "bottom": height - bbox[3],
        }
        edges = [edge for edge, margin in margins.items() if margin <= threshold]
        frame["sourceMargins"] = margins
        frame["sourceEdgeRisk"] = bool(edges)
        if edges:
            risks.append({
                "frame": index,
                "elevation": frame.get("elevation"),
                "azimuth": frame.get("azimuth"),
                "margins": margins,
                "edges": edges,
            })
    return risks


def enforce_padding(
    input_path: Path,
    output_path: Path,
    manifest_path: Path,
    manifest_output_path: Path,
    safe_padding: int,
    source_anchor_x: float | None,
    source_anchor_y: float | None,
    target_anchor_x: float | None,
    target_anchor_y: float | None,
    source_edge_threshold: int,
) -> dict:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    frame_width, frame_height = manifest["frameSize"]
    columns = manifest["packColumns"]
    frame_count = manifest["frameCount"]
    rows = (frame_count + columns - 1) // columns
    if safe_padding < 0 or safe_padding * 2 >= min(frame_width, frame_height):
        raise ValueError("safe padding must be non-negative and smaller than half the frame")

    sheet = Image.open(input_path).convert("RGBA")
    expected_size = (columns * frame_width, rows * frame_height)
    if sheet.size != expected_size:
        raise ValueError(f"sheet size {sheet.size} does not match manifest layout {expected_size}")

    boxes = frame_boxes(sheet, frame_width, frame_height, columns, frame_count)
    sx = float(source_anchor_x if source_anchor_x is not None else manifest.get("headAnchorX", frame_width / 2))
    sy = float(source_anchor_y if source_anchor_y is not None else manifest.get("baselineY", frame_height - safe_padding))
    tx = float(target_anchor_x if target_anchor_x is not None else frame_width / 2)
    # Lanczos can emit a very faint 2-3 px alpha halo outside the transformed
    # silhouette. Reserve that filter radius so measured output still satisfies
    # the user-facing safe padding value.
    effective_padding = safe_padding + RESAMPLE_GUARD
    ty = float(target_anchor_y if target_anchor_y is not None else frame_height - effective_padding)

    existing_margins = []
    for bbox in boxes:
        if not bbox:
            continue
        left, top, right, bottom = bbox
        existing_margins.append(min(left, top, frame_width - right, frame_height - bottom))
    already_safe_and_registered = (
        existing_margins
        and min(existing_margins) >= safe_padding
        and abs(sx - tx) < 0.001
        and abs(sy - ty) < 0.001
    )

    limits = [1.0]
    if not already_safe_and_registered:
        for bbox in boxes:
            if not bbox:
                continue
            left, top, right, bottom = bbox
            extents = (
                (sx - left, tx - effective_padding),
                (right - sx, frame_width - effective_padding - tx),
                (sy - top, ty - effective_padding),
                (bottom - sy, frame_height - effective_padding - ty),
            )
            for extent, available in extents:
                if extent > 0:
                    limits.append(available / extent)
    scale = min(limits)
    if scale <= 0:
        raise RuntimeError("safe padding leaves no room for the shared anchor")

    resized_width = max(1, round(frame_width * scale))
    resized_height = max(1, round(frame_height * scale))
    paste_x = round(tx - sx * scale)
    paste_y = round(ty - sy * scale)
    result = Image.new("RGBA", sheet.size, (0, 0, 0, 0))
    final_boxes = []
    for index in range(frame_count):
        source_x = (index % columns) * frame_width
        source_y = (index // columns) * frame_height
        cell = sheet.crop((source_x, source_y, source_x + frame_width, source_y + frame_height))
        resized = cell.resize((resized_width, resized_height), Image.Resampling.LANCZOS)
        normalized = Image.new("RGBA", (frame_width, frame_height), (0, 0, 0, 0))
        normalized.alpha_composite(resized, (paste_x, paste_y))
        target_x = (index % columns) * frame_width
        target_y = (index // columns) * frame_height
        result.alpha_composite(normalized, (target_x, target_y))
        final_boxes.append(normalized.getchannel("A").getbbox())

    old_scale = float(manifest.get("globalScale", 1.0))
    manifest["globalScale"] = old_scale * scale
    manifest["safePadding"] = safe_padding
    manifest["safeFramePolicy"] = SAFE_FRAME_POLICY
    manifest["sourceEdgePolicy"] = SOURCE_EDGE_POLICY
    manifest["sourceEdgeThreshold"] = source_edge_threshold
    manifest["headAnchorX"] = tx
    manifest["baselineY"] = ty
    manifest["safePaddingTransform"] = {
        "appliedScale": scale,
        "resampleGuard": RESAMPLE_GUARD,
        "sourceAnchor": [sx, sy],
        "targetAnchor": [tx, ty],
    }
    risks = source_edge_risks(manifest, source_edge_threshold)
    manifest["sourceEdgeRisks"] = risks

    margins = []
    for index, bbox in enumerate(final_boxes):
        if not bbox:
            continue
        left, top, right, bottom = bbox
        frame_margins = {
            "left": left,
            "top": top,
            "right": frame_width - right,
            "bottom": frame_height - bottom,
        }
        margins.append(frame_margins)
        frames = manifest.get("frames", [])
        if index < len(frames):
            frames[index]["normalizedPlacement"] = [left, top, right - left, bottom - top]
            frames[index]["normalizedHeadAnchor"] = [tx, None]
            frames[index]["normalizedBaselineY"] = ty

    if not margins:
        raise RuntimeError("No visible sprite pixels found in the packed sheet")
    final_minimum_margins = {
        edge: min(item[edge] for item in margins)
        for edge in ("left", "top", "right", "bottom")
    }
    if min(final_minimum_margins.values()) < safe_padding:
        raise RuntimeError(
            f"Final alpha margin check failed: {final_minimum_margins}; expected at least {safe_padding}px on every edge."
        )
    manifest["finalMinimumMargins"] = final_minimum_margins

    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path)
    manifest_output_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_output_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {
        "frameCount": frame_count,
        "appliedScale": scale,
        "globalScale": manifest["globalScale"],
        "safePadding": safe_padding,
        "finalMinimumMargins": manifest["finalMinimumMargins"],
        "sourceEdgeRiskCount": len(risks),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--manifest-out", type=Path)
    parser.add_argument("--safe-padding", type=int, required=True)
    parser.add_argument("--source-anchor-x", type=float)
    parser.add_argument("--source-anchor-y", type=float)
    parser.add_argument("--target-anchor-x", type=float)
    parser.add_argument("--target-anchor-y", type=float)
    parser.add_argument("--source-edge-threshold", type=int, default=2)
    args = parser.parse_args()
    summary = enforce_padding(
        args.input,
        args.output,
        args.manifest,
        args.manifest_out or args.manifest,
        args.safe_padding,
        args.source_anchor_x,
        args.source_anchor_y,
        args.target_anchor_x,
        args.target_anchor_y,
        args.source_edge_threshold,
    )
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
