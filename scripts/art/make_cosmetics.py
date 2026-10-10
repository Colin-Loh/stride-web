#!/usr/bin/env python3
"""Draw Chase and Shooshy's still-frame accessories and shop icons.

Run from any directory with Pillow installed. Shapes use a 4px grid and
nearest-neighbour sampling. PNGs have binary alpha and no metadata. The
review sheet composites each accessory over its run sheet's first frame at
the app's 0.5x still scale.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "cosmetics"
GRID = 4
SIZES = {"chase": (296, 222), "shooshy": (236, 196)}
IDS = ("chase-black-sunglasses", "chase-sushi-hat",
       "shooshy-black-sunglasses", "shooshy-sushi-hat")

# The outline is sampled from the opaque edge of public/sprites/shiba-run.png,
# frame zero, at (96, 84): RGB (34, 17, 5). Other colours belong to the items.
INK = "#221105"
# Shooshy's near-black edge is RGB (20, 20, 20) in the run sprite.
SHOOSHY_INK = "#141414"
GLASS = "#101821"
GLASS_LIGHT = "#34495a"
GLINT = "#a5d1d5"
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


def paint_shooshy(name: str, canvas: Image.Image) -> None:
    """Place Shooshy's accessories on the head of run frame zero."""
    pen = ImageDraw.Draw(canvas)
    ink = SHOOSHY_INK
    if name == "shooshy-black-sunglasses":
        # Two dark square lenses cover the two yellow eyes; the little arms
        # terminate on the dark cheek without obscuring the nose.
        pen.polygon([(40, 20), (43, 19), (46, 19), (47, 20),
                     (48, 19), (51, 19), (53, 20), (52, 25),
                     (49, 26), (47, 24), (45, 26), (42, 26),
                     (40, 24)], fill=ink)
        pen.rectangle((42, 20, 45, 24), fill=GLASS)
        pen.rectangle((48, 20, 51, 24), fill=GLASS)
        pen.rectangle((42, 21, 43, 21), fill=GLASS_LIGHT)
        pen.rectangle((48, 21, 49, 21), fill=GLASS_LIGHT)
        pen.point((42, 21), fill=GLINT)
        pen.point((48, 21), fill=GLINT)
    elif name == "shooshy-sushi-hat":
        # A salmon nigiri rests between Shooshy's two pointed ears.
        pen.polygon([(36, 12), (38, 9), (41, 8), (47, 8),
                     (50, 10), (51, 13), (49, 17), (38, 17),
                     (35, 14)], fill=ink)
        pen.polygon([(37, 12), (39, 10), (42, 9), (47, 9),
                     (49, 11), (49, 14), (47, 16), (38, 16)], fill=RICE)
        pen.rectangle((39, 14, 48, 15), fill=RICE_SHADE)
        pen.polygon([(36, 9), (39, 6), (43, 5), (48, 6),
                     (51, 8), (50, 12), (47, 13), (39, 12),
                     (35, 11)], fill=ink)
        pen.polygon([(37, 9), (40, 7), (43, 6), (48, 7),
                     (50, 8), (49, 11), (46, 12), (39, 11)], fill=SALMON)
        pen.polygon([(40, 7), (44, 6), (48, 7), (49, 8),
                     (44, 8)], fill=SALMON_LIGHT)
        pen.rectangle((38, 10, 41, 10), fill=SALMON_DARK)
        pen.rectangle((44, 9, 47, 9), fill=SALMON_LIGHT)
        pen.rectangle((43, 7, 45, 15), fill=ink)
        pen.rectangle((44, 8, 44, 14), fill=NORI)
        pen.point((44, 9), fill=NORI_LIGHT)
    else:
        raise ValueError(name)


def render(name: str) -> None:
    character = name.split("-", 1)[0]
    size = SIZES[character]
    # Chase's logical canvas is 224px tall; the last two pixels are cropped.
    canvas = Image.new("RGBA", (size[0] // GRID, (size[1] + GRID - 1) // GRID))
    if character == "shooshy":
        paint_shooshy(name, canvas)
    else:
        paint(name, canvas)
    image = canvas.resize((canvas.width * GRID, canvas.height * GRID), Image.Resampling.NEAREST)
    image.crop((0, 0, *size)).save(OUT / f"{name}.png", optimize=True)

    # Icons have a separate 12x12 composition, still on the same 4px grid.
    # A thumbnail of a full torso would lose the mustard and nori details.
    icon = Image.new("RGBA", (12, 12))
    pen = ImageDraw.Draw(icon)
    ink = SHOOSHY_INK if character == "shooshy" else INK
    if name.endswith("black-sunglasses"):
        pen.rectangle((0, 4, 11, 7), fill=ink)
        pen.rectangle((1, 5, 4, 7), fill=GLASS)
        pen.rectangle((7, 5, 10, 7), fill=GLASS)
        pen.point((1, 5), fill=GLINT)
        pen.point((7, 5), fill=GLINT)
        pen.rectangle((5, 4, 6, 4), fill=GLASS_LIGHT)
    else:
        pen.polygon([(1, 4), (3, 2), (9, 2), (11, 4), (11, 9),
                     (9, 10), (2, 10), (0, 8)], fill=ink)
        pen.rectangle((1, 5, 10, 8), fill=RICE)
        pen.rectangle((2, 3, 9, 5), fill=SALMON)
        pen.rectangle((3, 3, 5, 3), fill=SALMON_LIGHT)
        pen.rectangle((5, 3, 6, 9), fill=NORI)
    icon.resize((48, 48), Image.Resampling.NEAREST).save(
        OUT / "icons" / f"{name}.png", optimize=True
    )


def preview() -> None:
    sheet = Image.new("RGB", (720, 380), "#103124")
    pen = ImageDraw.Draw(sheet)
    for index, name in enumerate(IDS):
        character = name.split("-", 1)[0]
        size = SIZES[character]
        column = index if character == "chase" else index - 2
        x, y = 22 + column * 238, 18 + (190 if character == "shooshy" else 0)
        sprite = ROOT / "public" / "sprites" / ("shiba-run.png" if character == "chase" else "shooshy-run.png")
        with Image.open(sprite) as run:
            frame = run.convert("RGBA").crop((0, 0, *size))
        with Image.open(OUT / f"{name}.png") as overlay:
            frame.alpha_composite(overlay.convert("RGBA"))
        stage = Image.new("RGBA", size, "#1a3d2e")
        stage.alpha_composite(frame)
        half = stage.resize((size[0] // 2, size[1] // 2), Image.Resampling.NEAREST)
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
