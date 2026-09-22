"""Add exact King-of-Spades indices to the generated empty card background.

The environment illustration remains untouched.  This helper only composites
typographic corner marks into the blank index panels intentionally requested
during image generation.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


INK = (20, 17, 12, 255)


def centered_text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, font: ImageFont.FreeTypeFont) -> None:
    box = draw.textbbox((0, 0), text, font=font)
    width = box[2] - box[0]
    height = box[3] - box[1]
    draw.text((xy[0] - width / 2 - box[0], xy[1] - height / 2 - box[1]), text, font=font, fill=INK)


def build_index_patch(size: tuple[int, int]) -> Image.Image:
    patch = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(patch)
    king_font = ImageFont.truetype(r"C:\Windows\Fonts\georgiab.ttf", 86)
    suit_font = ImageFont.truetype(r"C:\Windows\Fonts\seguisym.ttf", 58)
    cx = size[0] // 2
    centered_text(draw, (cx, 54), "K", king_font)
    centered_text(draw, (cx, 151), "♠", suit_font)
    return patch


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    card = Image.open(args.input).convert("RGBA")
    source_ratio = card.width / card.height
    if abs(source_ratio - 0.75) > 0.01:
        raise ValueError(f"Expected the approved 3:4 background, got {card.size}")
    if card.size != (1080, 1440):
        card = card.resize((1080, 1440), Image.Resampling.LANCZOS)

    index = build_index_patch((118, 224))
    card.alpha_composite(index, (120, 78))
    card.alpha_composite(index.rotate(180, resample=Image.Resampling.BICUBIC), (852, 1151))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    card.save(args.output)


if __name__ == "__main__":
    main()
