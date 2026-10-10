#!/usr/bin/env python3
"""Draw per-pose Chase accessories against the matching run-frame silhouette.

Pillow is required. Logical pixels are 4x4 source pixels; the frame's mask
limits each block to pixels no farther than four source pixels from Chase.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SPRITES = ROOT / "public" / "sprites"
OUTPUT = ROOT / "public" / "cosmetics" / "run"
PREVIEW = ROOT / "docs" / "art" / "run-overlays"
W, H, GRID, FRAMES = 296, 222, 4, 7
ITEMS = ("chase-black-sunglasses", "chase-sushi-hat")
INK = "#221105"  # Opaque edge of Chase, frame zero at (96, 84).
GLASS, REFLECTION, GLINT = "#101821", "#34495a", "#a5d1d5"
RICE, RICE_SHADE = "#fff1d8", "#dccdb1"
SALMON, SALMON_LIGHT, SALMON_DARK = "#f28a68", "#ffc09b", "#c85e48"
NORI, NORI_LIGHT = "#273e36", "#568376"

# Independently fitted frame landmarks: left lens/eye line and hat crown.
# The head moves and squashes between frames, especially 2 and 5.
LANDMARKS = {
    "healthy": (
        ((50, 17), (51, 7)),
        ((50, 19), (51, 9)),
        ((47, 25), (48, 16)),
        ((47, 20), (48, 11)),
        ((52, 19), (52, 9)),
        ((49, 14), (50, 4)),
        ((53, 16), (53, 6)),
    ),
    "obese": (
        ((51, 21), (51, 11)),
        ((50, 23), (50, 13)),
        ((47, 29), (47, 19)),
        ((47, 24), (47, 14)),
        ((52, 23), (52, 13)),
        ((49, 18), (49, 8)),
        ((53, 20), (53, 10)),
    ),
}


def draw_item(item: str, eye: tuple[int, int], crown: tuple[int, int]) -> Image.Image:
    """Compose one frame on a logical canvas, with no resampling artefacts."""
    canvas = Image.new("RGBA", (W // GRID, (H + GRID - 1) // GRID))
    pen = ImageDraw.Draw(canvas)

    def polygon(origin: tuple[int, int], points: tuple[tuple[int, int], ...], colour: str) -> None:
        pen.polygon([(origin[0] + x, origin[1] + y) for x, y in points], fill=colour)

    def rect(origin: tuple[int, int], box: tuple[int, int, int, int], colour: str) -> None:
        x, y = origin
        a, b, c, d = box
        pen.rectangle((x + a, y + b, x + c, y + d), fill=colour)

    if item == ITEMS[0]:
        # Two lenses, bridge, temple; side view follows this pose's eye line.
        polygon(eye, ((-1, 0), (2, -1), (6, -1), (8, 0), (10, -1),
                      (14, -1), (17, 1), (16, 6), (14, 7), (10, 7),
                      (8, 5), (6, 7), (2, 7), (0, 5)), INK)
        rect(eye, (1, 0, 6, 5), GLASS)
        rect(eye, (9, 0, 14, 5), GLASS)
        rect(eye, (2, 1, 4, 1), REFLECTION)
        rect(eye, (10, 1, 12, 1), REFLECTION)
        rect(eye, (2, 1, 2, 1), GLINT)
        rect(eye, (10, 1, 10, 1), GLINT)
        rect(eye, (7, 1, 8, 1), INK)
    elif item == ITEMS[1]:
        # Salmon nigiri stays on the head even while the head bobs.
        polygon(crown, ((-8, 2), (-5, -1), (6, -1), (10, 2),
                        (11, 8), (8, 11), (-6, 11), (-10, 8)), INK)
        polygon(crown, ((-7, 3), (-4, 0), (6, 0), (9, 3),
                        (9, 8), (7, 10), (-5, 10), (-8, 7)), RICE)
        rect(crown, (-6, 8, 7, 9), RICE_SHADE)
        polygon(crown, ((-8, 2), (-7, -3), (-3, -5), (4, -5),
                        (9, -3), (10, 1), (7, 4), (-4, 4)), INK)
        polygon(crown, ((-7, 1), (-6, -2), (-2, -4), (4, -4),
                        (8, -2), (9, 1), (6, 3), (-4, 3)), SALMON)
        rect(crown, (-4, -3, 4, -3), SALMON_LIGHT)
        rect(crown, (-5, 1, -2, 1), SALMON_LIGHT)
        rect(crown, (3, 2, 6, 2), SALMON_LIGHT)
        rect(crown, (-7, 3, -4, 3), SALMON_DARK)
        polygon(crown, ((0, -4), (3, -4), (3, 9), (1, 11),
                        (-2, 9), (-2, 0)), INK)
        rect(crown, (-1, -3, 2, 8), NORI)
        rect(crown, (-1, -2, -1, 3), NORI_LIGHT)
    else:
        raise ValueError(item)
    return canvas.resize((W, canvas.height * GRID), Image.Resampling.NEAREST).crop((0, 0, W, H))


def within_body(overlay: Image.Image, body: Image.Image) -> Image.Image:
    # MaxFilter(9) admits four pixels beyond the same frame's alpha>127 body.
    mask = body.getchannel("A").point(lambda alpha: 255 if alpha > 127 else 0)
    allowed = mask.filter(ImageFilter.MaxFilter(9))
    pixels = overlay.load()
    for y in range(0, H, GRID):
        for x in range(0, W, GRID):
            if any(pixels[x + dx, y + dy][3] and not allowed.getpixel((x + dx, y + dy))
                   for dy in range(min(GRID, H - y)) for dx in range(GRID)):
                for dy in range(min(GRID, H - y)):
                    for dx in range(GRID):
                        pixels[x + dx, y + dy] = (0, 0, 0, 0)
    return overlay


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    for health in LANDMARKS:
        filename = "shiba-run.png" if health == "healthy" else "shiba-run-obese.png"
        with Image.open(SPRITES / filename) as source:
            sprite = source.convert("RGBA")
        sheets = {item: Image.new("RGBA", (FRAMES * W, H)) for item in ITEMS}
        contact = Image.new("RGB", (FRAMES * (W // 2) + 32, len(ITEMS) * (H // 2 + 24) + 20), "#103124")
        for index, (eye, crown) in enumerate(LANDMARKS[health]):
            body = sprite.crop((index * W, 0, (index + 1) * W, H))
            for row, item in enumerate(ITEMS):
                overlay = within_body(draw_item(item, eye, crown), body)
                sheets[item].paste(overlay, (index * W, 0))
                stage = Image.new("RGBA", (W, H), "#1a3d2e")
                stage.alpha_composite(body)
                stage.alpha_composite(overlay)
                contact.paste(stage.resize((W // 2, H // 2), Image.Resampling.NEAREST).convert("RGB"),
                              (16 + index * (W // 2), 12 + row * (H // 2 + 24)))
        for item, sheet in sheets.items():
            sheet.save(OUTPUT / f"{item}-{health}.png", optimize=True)
        contact.save(PREVIEW / f"chase-{health}.png", optimize=True)


if __name__ == "__main__":
    main()
