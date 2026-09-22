"""Remove residual chroma spill from the generated clock-tower bell sheet."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageFilter


def cleanup(input_path: Path, output_path: Path) -> tuple[int, int]:
    image = Image.open(input_path).convert("RGBA")
    alpha = image.getchannel("A")
    transparent = alpha.point(lambda value: 255 if value < 8 else 0)
    near_transparent = transparent.filter(ImageFilter.MaxFilter(5))
    pixels = image.load()
    edge_pixels = near_transparent.load()
    removed_magenta = 0
    neutralized_green = 0

    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, opacity = pixels[x, y]
            if opacity == 0:
                pixels[x, y] = (0, 0, 0, 0)
                continue
            if edge_pixels[x, y] == 0:
                continue

            magenta_excess = min(red, blue) - green
            if magenta_excess > 7:
                strength = min(1.0, (magenta_excess - 7) / 13.0)
                opacity = round(opacity * (1.0 - strength))
                neutral = min(red, blue, green + 5)
                red = min(red, neutral)
                blue = min(blue, neutral)
                removed_magenta += 1

            green_excess = green - max(red, blue)
            if opacity > 0 and green_excess > 10:
                green = max(red, blue) + 4
                neutralized_green += 1

            pixels[x, y] = (red, green, blue, opacity)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, optimize=True)
    return removed_magenta, neutralized_green


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    removed_magenta, neutralized_green = cleanup(args.input, args.output)
    print(f"removed_magenta_edge_pixels={removed_magenta}")
    print(f"neutralized_green_edge_pixels={neutralized_green}")


if __name__ == "__main__":
    main()
