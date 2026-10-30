"""Regenerate icons/*.png. Optional; requires Pillow. Not used at runtime.

A grey trash can with a small orange flame, drawn as exact pixels so the
16 and 32 toolbar sizes stay crisp. Larger sizes are the same sprite
scaled with nearest-neighbor, which keeps hard edges and avoids the
blue fringe a filtered downscale leaves on the flame.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "icons"

# 16×16. The flame sits above the lid with a clear gap so it does not
# melt into the can at toolbar size.
SPRITE = [
    "................",
    "......CC........",
    ".....COOOC......",
    "....CCCCCCC.....",
    ".....CCCCC......",
    "................",
    "...HHHHHHHHH....",
    ".LLLLLLLLLLLLLL.",
    ".LLLLLLLLLLLLLL.",
    "..BBBBBBBBBBBB..",
    "..BWWBBWWBBWWB..",
    "..BWWBBWWBBWWB..",
    "..BWWBBWWBBWWB..",
    "..BBBBBBBBBBBB..",
    "...BBBBBBBBBB...",
    "................",
]

COLORS = {
    ".": (0, 0, 0, 0),
    "C": (234, 88, 12, 255),
    "O": (255, 176, 64, 255),
    "H": (58, 62, 66, 255),
    "L": (176, 180, 184, 255),
    "B": (108, 112, 116, 255),
    "W": (242, 244, 246, 255),
}


def sprite_image() -> Image.Image:
    for row in SPRITE:
        if len(row) != 16:
            raise SystemExit(f"sprite row is {len(row)} wide: {row}")
    if len(SPRITE) != 16:
        raise SystemExit(f"sprite is {len(SPRITE)} tall")
    image = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(SPRITE):
        for x, cell in enumerate(row):
            image.putpixel((x, y), COLORS[cell])
    return image


def main() -> None:
    OUT.mkdir(exist_ok=True)
    base = sprite_image()
    for size in (16, 32, 48, 128):
        if size % 16 != 0:
            raise SystemExit(f"{size} is not an integer multiple of 16")
        image = base.resize((size, size), Image.Resampling.NEAREST)
        path = OUT / f"icon{size}.png"
        image.save(path, "PNG")
        print(path)


if __name__ == "__main__":
    main()
