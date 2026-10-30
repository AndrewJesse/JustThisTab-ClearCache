"""Regenerate icons/*.png. Optional; requires Pillow. Not used at runtime."""

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "icons"
BLUE = (29, 78, 216, 255)
WHITE = (255, 255, 255, 255)


def draw_icon(size: int) -> Image.Image:
    scale = 8
    canvas = size * scale
    image = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    margin = canvas * 0.04
    draw.rounded_rectangle(
        [margin, margin, canvas - margin - 1, canvas - margin - 1],
        radius=canvas * 0.24,
        fill=BLUE,
    )

    center = canvas / 2
    radius = canvas * 0.25
    stroke = max(scale * 2, int(canvas * 0.078))
    box = [center - radius, center - radius, center + radius, center + radius]
    # Clockwise from the upper-right gap around to just before the arrow head.
    draw.arc(box, start=55, end=305, fill=WHITE, width=stroke)
    arrow_head(draw, center, center, radius, 55, stroke)
    return image.resize((size, size), Image.Resampling.LANCZOS)


def arrow_head(draw: ImageDraw.ImageDraw, cx: float, cy: float, radius: float, angle: float, stroke: int) -> None:
    theta = math.radians(angle)
    px = cx + radius * math.cos(theta)
    py = cy + radius * math.sin(theta)
    # Screen y grows downward; this tangent follows the arc clockwise.
    tangent = (-math.sin(theta), math.cos(theta))
    normal = (-tangent[1], tangent[0])
    tip = stroke * 2.15
    side = stroke * 1.35
    draw.polygon(
        [
            (px + tangent[0] * tip, py + tangent[1] * tip),
            (px + normal[0] * side, py + normal[1] * side),
            (px - normal[0] * side, py - normal[1] * side),
        ],
        fill=WHITE,
    )


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for size in (16, 32, 48, 128):
        path = OUT / f"icon{size}.png"
        draw_icon(size).save(path, "PNG")
        print(path)


if __name__ == "__main__":
    main()
