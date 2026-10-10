#!/usr/bin/env python3
"""Draw Chase's still-frame accessories and their shop icons.

Run from any directory with Pillow installed. Shapes are drawn on a single 4px
grid and enlarged with nearest-neighbour sampling. PNGs have binary alpha and
no metadata. The review sheet composites each accessory over the first frame
of Chase's run sheet at the app's 0.5x still scale.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "cosmetics"
GRID = 4
SIZE = (296, 222)
IDS = ("chase-black-sunglasses", "chase-hotdog", "chase-sushi-hat")

# The outline is sampled from the opaque edge of public/sprites/shiba-run.png,
# frame zero, at (96, 84): RGB (34, 17, 5). Other colours belong to the items.
INK = "#221105"
GLASS = "#101821"
GLASS_LIGHT = "#34495a"
GLINT = "#a5d1d5"
BUN = "#e5a658"
BUN_LIGHT = "#f8cb82"
BUN_DARK = "#ad612f"
SAUSAGE = "#ab3d30"
SAUSAGE_LIGHT = "#df6950"
MUSTARD = "#ffd34b"
RICE = "#fff1d8"
RICE_SHADE = "#dccdb1"
SALMON = "#f28a68"
SALMON_LIGHT = "#ffc09b"
SALMON_DARK = "#c85e48"
NORI = "#273e36"
NORI_LIGHT = "#568376"


def paint(name: str, canvas: Image.Image) -> None:
    """Use one logical-pixel grid for all item shapes, including their outline."""
    pen = ImageDraw.Draw(canvas)

    def poly(points: list[tuple[int, int]], colour: str) -> None:
        pen.polygon(points, fill=colour)

    def box(x0: int, y0: int, x1: int, y1: int, colour: str) -> None:
        pen.rectangle((x0, y0, x1, y1), fill=colour)

    if name == "chase-black-sunglasses":
        # Side view: two squared lenses follow the eye line, with a stepped
        # bridge and a temple arm disappearing toward the far ear.
        poly([(49, 17), (52, 16), (56, 16), (58, 17), (60, 16),
              (64, 16), (67, 18), (66, 21), (64, 23), (60, 23),
              (58, 21), (56, 23), (52, 23), (50, 21)], INK)
        box(51, 17, 56, 21, GLASS)
        box(59, 17, 64, 21, GLASS)
        box(52, 18, 54, 18, GLASS_LIGHT)
        box(60, 18, 62, 18, GLASS_LIGHT)
        box(52, 18, 52, 18, GLINT)
        box(60, 18, 60, 18, GLINT)
        box(57, 18, 58, 18, INK)
        box(49, 18, 50, 18, GLASS)
    elif name == "chase-hotdog":
        # The bun wraps Chase's torso, not his face, legs or fluffy tail.
        # Its front tip curves upward at the neck. A sausage and mustard
        # zigzag make the silhouette read as a costume rather than a coat.
        poly([(24, 22), (40, 21), (48, 23), (52, 26), (53, 30),
              (50, 34), (47, 37), (36, 40), (23, 39), (18, 36),
              (16, 32), (18, 27)], INK)
        poly([(23, 23), (40, 22), (47, 24), (51, 27), (51, 30),
              (48, 32), (36, 35), (22, 35), (18, 33), (19, 28)], BUN)
        poly([(24, 24), (38, 23), (45, 24), (49, 26), (47, 28),
              (36, 27), (21, 28)], BUN_LIGHT)
        poly([(22, 32), (36, 34), (48, 31), (47, 35), (36, 38),
              (23, 37), (19, 34)], BUN_DARK)
        poly([(21, 27), (40, 26), (49, 28), (49, 31), (39, 35),
              (23, 34), (18, 32), (18, 29)], INK)
        poly([(21, 28), (40, 27), (48, 29), (47, 31), (38, 34),
              (23, 33), (19, 31)], SAUSAGE)
        poly([(22, 28), (39, 28), (46, 29), (43, 30), (22, 30)], SAUSAGE_LIGHT)
        poly([(21, 30), (25, 29), (29, 31), (34, 29), (38, 31),
              (43, 29), (47, 30)], MUSTARD)
    elif name == "chase-sushi-hat":
        # Salmon nigiri: an outlined rice mound, salmon with white fat
        # stripes, and a dark nori band. The lower edge sits on his ears.
        poly([(44, 7), (47, 5), (58, 5), (62, 7), (63, 11),
              (60, 14), (48, 14), (43, 11)], INK)
        poly([(45, 8), (49, 6), (58, 6), (61, 8), (61, 11),
              (58, 13), (48, 13), (45, 11)], RICE)
        box(47, 11, 59, 12, RICE_SHADE)
        poly([(46, 5), (48, 2), (54, 1), (60, 2), (62, 4),
              (61, 8), (57, 9), (49, 8), (45, 7)], INK)
        poly([(47, 5), (49, 3), (54, 2), (59, 3), (61, 4),
              (60, 7), (56, 8), (49, 7), (46, 6)], SALMON)
        poly([(49, 3), (54, 2), (59, 3), (60, 4), (53, 4)], SALMON_LIGHT)
        box(49, 5, 52, 5, SALMON_LIGHT)
        box(55, 6, 58, 6, SALMON_LIGHT)
        box(47, 7, 50, 7, SALMON_DARK)
        poly([(53, 3), (56, 3), (56, 12), (54, 13), (52, 12),
              (52, 5)], INK)
        box(53, 4, 55, 11, NORI)
        box(53, 5, 53, 8, NORI_LIGHT)
    else:
        raise ValueError(name)


def render(name: str) -> None:
    # The logical canvas is 224px tall, with two transparent pixels cropped
    # below Chase's 222px frame. No resize or drawing introduces soft alpha.
    canvas = Image.new("RGBA", (SIZE[0] // GRID, (SIZE[1] + GRID - 1) // GRID))
    paint(name, canvas)
    image = canvas.resize((canvas.width * GRID, canvas.height * GRID), Image.Resampling.NEAREST)
    image.crop((0, 0, *SIZE)).save(OUT / f"{name}.png", optimize=True)

    # Icons have a separate 12x12 composition, still on the same 4px grid.
    # A thumbnail of a full torso would lose the mustard and nori details.
    icon = Image.new("RGBA", (12, 12))
    pen = ImageDraw.Draw(icon)
    if name == "chase-black-sunglasses":
        pen.rectangle((0, 4, 11, 7), fill=INK)
        pen.rectangle((1, 5, 4, 7), fill=GLASS)
        pen.rectangle((7, 5, 10, 7), fill=GLASS)
        pen.point((1, 5), fill=GLINT)
        pen.point((7, 5), fill=GLINT)
        pen.rectangle((5, 4, 6, 4), fill=GLASS_LIGHT)
    elif name == "chase-hotdog":
        pen.polygon([(1, 2), (9, 2), (11, 4), (11, 8), (9, 10),
                     (2, 10), (0, 8), (0, 4)], fill=INK)
        pen.rectangle((1, 3, 10, 9), fill=BUN)
        pen.rectangle((2, 3, 9, 4), fill=BUN_LIGHT)
        pen.rectangle((1, 5, 10, 7), fill=SAUSAGE)
        pen.line([(2, 6), (4, 5), (6, 6), (8, 5), (9, 6)], fill=MUSTARD)
    else:
        pen.polygon([(1, 4), (3, 2), (9, 2), (11, 4), (11, 9),
                     (9, 10), (2, 10), (0, 8)], fill=INK)
        pen.rectangle((1, 5, 10, 8), fill=RICE)
        pen.rectangle((2, 3, 9, 5), fill=SALMON)
        pen.rectangle((3, 3, 5, 3), fill=SALMON_LIGHT)
        pen.rectangle((5, 3, 6, 9), fill=NORI)
    icon.resize((48, 48), Image.Resampling.NEAREST).save(
        OUT / "icons" / f"{name}.png", optimize=True
    )


def preview() -> None:
    sheet = Image.new("RGB", (720, 190), "#103124")
    pen = ImageDraw.Draw(sheet)
    sprite = ROOT / "public" / "sprites" / "shiba-run.png"
    with Image.open(sprite) as run:
        still = run.convert("RGBA").crop((0, 0, *SIZE))
    for index, name in enumerate(IDS):
        x, y = 22 + index * 238, 18
        frame = still.copy()
        with Image.open(OUT / f"{name}.png") as overlay:
            frame.alpha_composite(overlay.convert("RGBA"))
        stage = Image.new("RGBA", SIZE, "#1a3d2e")
        stage.alpha_composite(frame)
        half = stage.resize((SIZE[0] // 2, SIZE[1] // 2), Image.Resampling.NEAREST)
        sheet.paste(half.convert("RGB"), (x, y))
        with Image.open(OUT / "icons" / f"{name}.png") as icon:
            sheet.paste(icon, (x + 165, y + 34), icon)
        pen.text((x, y + 116), name, fill="#ffffff")
        pen.text((x, y + 134), "0.5x still    48px icon", fill="#b7d9bd")
    target = ROOT / "docs" / "art" / "cosmetics-preview.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(target, optimize=True)


def main() -> None:
    (OUT / "icons").mkdir(parents=True, exist_ok=True)
    for name in IDS:
        render(name)
    preview()


if __name__ == "__main__":
    main()
