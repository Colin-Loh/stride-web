#!/usr/bin/env python3
"""Draw Shooshy's two accessories against each healthy and obese run pose.

Pillow is required. Accessory geometry shares the still-art 4px grid and
palette; each pose follows its own eye/crown landmarks. The matching frame's
alpha>127 silhouette limits the opaque overlay to four pixels beyond the body.
"""
from pathlib import Path

from PIL import Image, ImageFilter

from make_cosmetics import paint_shooshy

ROOT = Path(__file__).resolve().parents[2]
SPRITES = ROOT / "public" / "sprites"
OUTPUT = ROOT / "public" / "cosmetics" / "run"
PREVIEW = ROOT / "docs" / "art" / "run-overlays"
W, H, GRID, FRAMES = 236, 196, 4, 8
ITEMS = ("shooshy-black-sunglasses", "shooshy-sushi-hat")

# Independent frame landmarks in logical pixels. Frame zero is the still-art
# reference. Both health sheets retain the head and eyes in the same poses.
# Frame three's lifted head needs a higher crown and eye line.
POSES = ((0, 0), (4, 0), (4, 0), (4, -2),
         (4, 0), (4, 0), (2, 0), (1, 0))


def draw_item(item: str, offset: tuple[int, int]) -> Image.Image:
    logical = Image.new("RGBA", (W // GRID, H // GRID))
    paint_shooshy(item, logical)
    shifted = Image.new("RGBA", logical.size)
    shifted.paste(logical, offset)
    return shifted.resize((W, H), Image.Resampling.NEAREST)


def within_body(overlay: Image.Image, body: Image.Image) -> Image.Image:
    mask = body.getchannel("A").point(lambda alpha: 255 if alpha > 127 else 0)
    allowed = mask.filter(ImageFilter.MaxFilter(9))
    pixels = overlay.load()
    for y in range(0, H, GRID):
        for x in range(0, W, GRID):
            if any(pixels[x + dx, y + dy][3] and not allowed.getpixel((x + dx, y + dy))
                   for dy in range(GRID) for dx in range(GRID)):
                for dy in range(GRID):
                    for dx in range(GRID):
                        pixels[x + dx, y + dy] = (0, 0, 0, 0)
    return overlay


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    for health in ("healthy", "obese"):
        filename = "shooshy-run.png" if health == "healthy" else "shooshy-run-obese.png"
        with Image.open(SPRITES / filename) as source:
            sprite = source.convert("RGBA")
        assert sprite.size == (FRAMES * W, H), (filename, sprite.size)
        sheets = {item: Image.new("RGBA", sprite.size) for item in ITEMS}
        contact = Image.new("RGB", (FRAMES * (W // 2) + 32,
                                    len(ITEMS) * (H // 2 + 24) + 20), "#103124")
        for index, offset in enumerate(POSES):
            body = sprite.crop((index * W, 0, (index + 1) * W, H))
            for row, item in enumerate(ITEMS):
                overlay = within_body(draw_item(item, offset), body)
                sheets[item].paste(overlay, (index * W, 0))
                stage = Image.new("RGBA", (W, H), "#1a3d2e")
                stage.alpha_composite(body)
                stage.alpha_composite(overlay)
                contact.paste(stage.resize((W // 2, H // 2), Image.Resampling.NEAREST).convert("RGB"),
                              (16 + index * (W // 2), 12 + row * (H // 2 + 24)))
        for item, sheet in sheets.items():
            sheet.save(OUTPUT / f"{item}-{health}.png", optimize=True)
        contact.save(PREVIEW / f"shooshy-{health}.png", optimize=True)


if __name__ == "__main__":
    main()
