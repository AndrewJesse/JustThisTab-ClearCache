"""Regenerate icons/*.png. Optional; requires Pillow. Not used at runtime.

A grey trash can with a small orange flame, on a transparent background,
so the toolbar icon stays uncluttered.
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "icons"

GREY = (118, 118, 118, 255)
GREY_DARK = (78, 78, 78, 255)
LID = (168, 168, 168, 255)
SLOT = (232, 232, 232, 255)
FLAME = (249, 115, 22, 255)
FLAME_CORE = (255, 214, 153, 255)


def draw_icon(size: int) -> Image.Image:
    scale = 8
    canvas = size * scale
    image = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    def box(x0: float, y0: float, x1: float, y1: float) -> list[float]:
        return [x0 / 128 * canvas, y0 / 128 * canvas, x1 / 128 * canvas, y1 / 128 * canvas]

    def pt(x: float, y: float) -> tuple[float, float]:
        return (x / 128 * canvas, y / 128 * canvas)

    draw.polygon(
        [pt(36, 54), pt(92, 54), pt(84, 116), pt(44, 116)],
        fill=GREY,
    )
    slot_w = 6
    for x in (50, 62, 74):
        draw.rounded_rectangle(box(x, 68, x + slot_w, 102), radius=canvas * 0.012, fill=SLOT)

    draw.rounded_rectangle(box(26, 40, 102, 54), radius=canvas * 0.03, fill=LID)
    draw.rounded_rectangle(box(52, 30, 76, 44), radius=canvas * 0.025, fill=GREY_DARK)

    draw.polygon(
        [pt(64, 4), pt(82, 28), pt(70, 22), pt(74, 34), pt(64, 24), pt(54, 34), pt(58, 22), pt(46, 28)],
        fill=FLAME,
    )
    draw.polygon(
        [pt(64, 12), pt(72, 26), pt(64, 20), pt(56, 26)],
        fill=FLAME_CORE,
    )
    return image.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for size in (16, 32, 48, 128):
        path = OUT / f"icon{size}.png"
        draw_icon(size).save(path, "PNG")
        print(path)


if __name__ == "__main__":
    main()
