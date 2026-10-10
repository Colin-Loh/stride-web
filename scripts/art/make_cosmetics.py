#!/usr/bin/env python3
"""Render the six still-frame pixel accessories and their shop icons.

Run from the repository root: python3 scripts/art/make_cosmetics.py
Requires Pillow. All shapes use one four-pixel grid, opaque palette colours,
and nearest-neighbour resizing. Output is deterministic PNG with no metadata.
Also renders docs/art/cosmetics-preview.png at the app's 0.5 still scale.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "cosmetics"
GRID = 4
INK = "#221710"
CAT_INK = "#171717"
RED = "#d63d49"
RED_DARK = "#922a35"
RED_LIGHT = "#f27370"
GOLD = "#e9ac31"
GOLD_LIGHT = "#ffe382"
GOLD_DARK = "#9e641d"
TEAL = "#49c1b7"
TEAL_DARK = "#237c82"
TEAL_LIGHT = "#91e5cb"
BLUE = "#3273cc"
BLUE_LIGHT = "#78b8f8"
PINK = "#ed76af"
PINK_LIGHT = "#ffb1d2"
PINK_DARK = "#a84479"
LENS = "#243f57"
LENS_LIGHT = "#91d4e9"


def render(name: str, size: tuple[int, int]) -> None:
    # Chase's frame is 222px high: render 224px and crop two empty bottom pixels.
    canvas = Image.new("RGBA", (size[0] // GRID, (size[1] + 3) // GRID))
    draw = ImageDraw.Draw(canvas)

    def poly(points: list[tuple[int, int]], fill: str) -> None:
        draw.polygon(points, fill=fill)

    def box(x0: int, y0: int, x1: int, y1: int, fill: str) -> None:
        draw.rectangle((x0, y0, x1, y1), fill=fill)

    if name == "chase-bandana":
        # Fold at the front of the neck, two hanging triangular tails.
        poly([(44, 23), (48, 22), (51, 24), (53, 28), (50, 30), (46, 29)], INK)
        poly([(45, 24), (48, 23), (51, 25), (52, 27), (50, 29), (47, 28)], RED)
        box(46, 24, 49, 24, RED_LIGHT)
        poly([(49, 29), (52, 28), (55, 33), (52, 32), (51, 35), (49, 35), (49, 32), (47, 33), (46, 31)], INK)
        poly([(49, 30), (51, 29), (53, 32), (51, 32), (51, 34), (50, 34), (50, 31), (48, 32), (47, 31)], RED_DARK)
        box(49, 29, 50, 30, RED_LIGHT)
    elif name == "chase-sunglasses":
        # A bridge and two squared, slightly tilted aviator lenses across both eyes.
        poly([(52, 16), (56, 16), (57, 17), (59, 16), (63, 16), (64, 18), (62, 22), (59, 23), (57, 20), (55, 23), (53, 22), (51, 18)], INK)
        poly([(53, 17), (56, 17), (57, 19), (56, 21), (54, 21), (52, 18)], GOLD)
        poly([(59, 17), (62, 17), (63, 18), (61, 21), (59, 21), (58, 19)], GOLD)
        poly([(53, 18), (55, 18), (56, 19), (55, 20), (54, 20)], LENS)
        poly([(59, 18), (61, 18), (61, 20), (59, 20)], LENS)
        box(53, 18, 54, 18, LENS_LIGHT)
        box(59, 18, 60, 18, LENS_LIGHT)
        box(57, 18, 58, 18, GOLD_LIGHT)
    elif name == "chase-medal":
        # Wide neck ribbon with a distinct circular gold medallion.
        poly([(49, 22), (52, 22), (53, 26), (56, 28), (55, 31), (52, 30), (49, 27), (48, 25)], INK)
        poly([(49, 23), (51, 23), (52, 27), (54, 29), (53, 30), (50, 27)], BLUE)
        poly([(52, 23), (53, 25), (55, 28), (54, 29), (52, 27)], RED)
        box(50, 23, 50, 25, BLUE_LIGHT)
        poly([(52, 29), (54, 27), (57, 28), (59, 31), (58, 34), (56, 36), (53, 35), (51, 33)], INK)
        poly([(53, 29), (55, 28), (57, 29), (58, 31), (57, 34), (55, 35), (53, 34), (52, 32)], GOLD)
        box(54, 29, 55, 29, GOLD_LIGHT)
        poly([(55, 30), (56, 32), (57, 32), (56, 33), (56, 34), (55, 33), (54, 34), (54, 32)], GOLD_LIGHT)
        box(52, 31, 52, 32, GOLD_DARK)
    elif name == "shooshy-ribbon":
        # Symmetric bow between the ears, with a visible central knot.
        poly([(40, 12), (44, 14), (45, 13), (48, 12), (49, 13), (49, 17), (46, 17), (44, 16), (41, 17), (40, 16)], CAT_INK)
        poly([(41, 13), (44, 15), (41, 16)], PINK)
        poly([(48, 13), (46, 15), (48, 16)], PINK)
        box(41, 13, 42, 13, PINK_LIGHT)
        box(47, 13, 48, 13, PINK_LIGHT)
        box(44, 14, 46, 16, PINK_DARK)
        box(45, 14, 45, 15, PINK_LIGHT)
    elif name == "shooshy-scarf":
        # Collar wraps behind the chin; the dangling end has a squared fringe.
        poly([(34, 22), (43, 20), (44, 23), (42, 26), (39, 26), (40, 32), (38, 34), (36, 32), (35, 26)], CAT_INK)
        poly([(35, 23), (42, 21), (43, 23), (41, 25), (36, 25)], TEAL)
        poly([(37, 25), (40, 25), (39, 31), (38, 33), (36, 31)], TEAL_DARK)
        box(36, 23, 40, 23, TEAL_LIGHT)
        box(37, 27, 37, 29, TEAL)
        box(39, 30, 39, 31, TEAL_LIGHT)
    elif name == "shooshy-headband":
        # Thick contrasting sports band over the eyes, from ear to ear.
        poly([(36, 17), (50, 17), (52, 18), (52, 20), (37, 20), (36, 19)], CAT_INK)
        box(37, 18, 50, 18, BLUE_LIGHT)
        box(38, 19, 51, 19, BLUE)
        box(37, 18, 38, 18, GOLD_LIGHT)
    else:
        raise ValueError(name)

    art = canvas.resize((canvas.width * GRID, canvas.height * GRID), Image.Resampling.NEAREST)
    art = art.crop((0, 0, *size))
    art.save(OUT / f"{name}.png", optimize=True)

    bounds = canvas.getbbox()
    assert bounds is not None
    item = canvas.crop(bounds)
    # The shop icon shares the same four-pixel grid and keeps a clear margin.
    item.thumbnail((10, 10), Image.Resampling.NEAREST)
    icon = Image.new("RGBA", (12, 12))
    icon.alpha_composite(item, ((12 - item.width) // 2, (12 - item.height) // 2))
    icon.resize((48, 48), Image.Resampling.NEAREST).save(
        OUT / "icons" / f"{name}.png", optimize=True
    )


def preview() -> None:
    """A review sheet showing all items on frame zero at real app scale."""
    from PIL import ImageDraw

    sheet = Image.new("RGB", (720, 520), "#103124")
    pen = ImageDraw.Draw(sheet)
    ids = (
        "chase-bandana", "chase-sunglasses", "chase-medal",
        "shooshy-ribbon", "shooshy-scarf", "shooshy-headband",
    )
    for index, name in enumerate(ids):
        x, y = 22 + (index % 3) * 238, 22 + (index // 3) * 240
        is_chase = index < 3
        width, height = (296, 222) if is_chase else (236, 196)
        sprite = ROOT / "public" / "sprites" / (
            "shiba-run.png" if is_chase else "shooshy-run.png"
        )
        frame = Image.open(sprite).convert("RGBA").crop((0, 0, width, height))
        frame.alpha_composite(Image.open(OUT / f"{name}.png").convert("RGBA"))
        stage = Image.new("RGBA", (width, height), "#1a3d2e")
        stage.alpha_composite(frame)
        still = stage.resize((width // 2, height // 2), Image.Resampling.NEAREST)
        sheet.paste(still.convert("RGB"), (x, y))
        icon = Image.open(OUT / "icons" / f"{name}.png").convert("RGBA")
        sheet.paste(icon, (x + 165, y + 34), icon)
        pen.text((x, y + 125), name, fill="#ffffff")
        pen.text((x, y + 143), "0.5x still    48px icon", fill="#b7d9bd")
    target = ROOT / "docs" / "art" / "cosmetics-preview.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(target, optimize=True)


def main() -> None:
    (OUT / "icons").mkdir(parents=True, exist_ok=True)
    for name in ("chase-bandana", "chase-sunglasses", "chase-medal"):
        render(name, (296, 222))
    for name in ("shooshy-ribbon", "shooshy-scarf", "shooshy-headband"):
        render(name, (236, 196))
    preview()


if __name__ == "__main__":
    main()
