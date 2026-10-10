#!/usr/bin/env python3
"""Build public/sprites/shiba-run-obese.png from the healthy Chase run sheet.

Rerun from the repo root (deterministic, no network, no paid services):
    python3 scripts/art/make_obese_run.py

Input:  public/sprites/shiba-run.png       (7 frames, 296 x 222 each, RGBA)
Output: public/sprites/shiba-run-obese.png (2072 x 222, RGBA, palette-reduced)

Method: each healthy frame keeps its cell position. The torso band is widened
horizontally about the body centre, with a soft fade at the band edges so the
head and leg joints do not warp. The stretch is capped so no pixel leaves the
cell's safe margin. The result is quantised to a small palette with alpha,
which keeps the file under the 300 KB cap. Nearest-neighbour sampling keeps
pixel edges crisp. Output bytes are fixed (no timestamps in PNG metadata).
"""

import sys
from pathlib import Path

from PIL import Image

CELL_W = 296
CELL_H = 222
FRAMES = 7
MARGIN = 3  # px kept clear of the cell edge on each side
FRAME_SCALE = 0.92  # healthy frames are shrunk first so the wider torso fits the cell

SRC = Path("public/sprites/shiba-run.png")
DST = Path("public/sprites/shiba-run-obese.png")

PALETTE_COLORS = 64

# Torso widening, as fractions of the sprite's alpha height.
TORSO_TOP = 0.30
TORSO_BOTTOM = 0.74
TORSO_STRETCH = 1.14
FADE = 0.08


def stretch_weight(t: float) -> float:
    """Blend factor 0..1 for the torso stretch at normalised row position t."""
    if t <= TORSO_TOP - FADE or t >= TORSO_BOTTOM + FADE:
        return 0.0
    if TORSO_TOP <= t <= TORSO_BOTTOM:
        return 1.0
    if t < TORSO_TOP:
        return (t - (TORSO_TOP - FADE)) / FADE
    return ((TORSO_BOTTOM + FADE) - t) / FADE


def shrink_to_fit_scale(cell: Image.Image) -> Image.Image:
    """Scale the frame down by FRAME_SCALE, keeping its feet line and centre column."""
    box = cell.getchannel("A").getbbox()
    if box is None:
        return cell
    sprite = cell.crop(box)
    w = max(1, round(sprite.width * FRAME_SCALE))
    h = max(1, round(sprite.height * FRAME_SCALE))
    small = sprite.resize((w, h), Image.Resampling.NEAREST)
    out = Image.new("RGBA", cell.size, (0, 0, 0, 0))
    cx_old = (box[0] + box[2]) / 2.0
    left = round(cx_old - w / 2.0)
    top = box[3] - h  # feet stay on the original ground line
    out.paste(small, (left, top), small)
    return out


def max_stretch(cell: Image.Image) -> float:
    """Largest torso stretch that keeps the widest row inside the safe margin."""
    x0, _, x1, _ = cell.getchannel("A").getbbox()
    cx = (x0 + x1 - 1) / 2.0
    half = max(cx - x0, (x1 - 1) - cx)
    room = min(cx - MARGIN, (CELL_W - 1 - MARGIN) - cx)
    return max(1.0, room / half)


def widen_torso(cell: Image.Image) -> Image.Image:
    """Stretch torso rows horizontally about the sprite's centre column."""
    box = cell.getchannel("A").getbbox()
    if box is None:
        return cell
    x0, y0, x1, y1 = box
    cx = (x0 + x1 - 1) / 2.0
    h = y1 - y0
    stretch = min(TORSO_STRETCH, max_stretch(cell))
    src = cell.load()
    out = Image.new("RGBA", cell.size, (0, 0, 0, 0))
    dst = out.load()
    for y in range(CELL_H):
        if y0 <= y < y1:
            t = (y - y0) / h
            s = 1.0 + (stretch - 1.0) * stretch_weight(t)
            for x in range(CELL_W):
                sx = int(round(cx + (x - cx) / s))
                if 0 <= sx < CELL_W:
                    dst[x, y] = src[sx, y]
        else:
            for x in range(CELL_W):
                dst[x, y] = src[x, y]
    return out


def check_margin(cell: Image.Image, index: int) -> None:
    """Fail loudly if a frame reaches the cell edge margin."""
    box = cell.getchannel("A").getbbox()
    if box is None:
        sys.exit(f"frame {index} is empty")
    x0, _, x1, _ = box
    if x0 < MARGIN or x1 > CELL_W - MARGIN:
        sys.exit(f"frame {index} breaks the {MARGIN}px margin: bbox {box}")


def build() -> Image.Image:
    src = Image.open(SRC).convert("RGBA")
    if src.size != (CELL_W * FRAMES, CELL_H):
        sys.exit(f"unexpected source size {src.size}")
    sheet = Image.new("RGBA", src.size, (0, 0, 0, 0))
    for i in range(FRAMES):
        cell = src.crop((i * CELL_W, 0, (i + 1) * CELL_W, CELL_H))
        cell = shrink_to_fit_scale(cell)
        cell = widen_torso(cell)
        check_margin(cell, i)
        sheet.paste(cell, (i * CELL_W, 0))
    # Palette reduction with alpha. Fixed method and colour count, so output is stable.
    return sheet.quantize(colors=PALETTE_COLORS, method=Image.Quantize.FASTOCTREE).convert("RGBA")


def report(path: Path) -> None:
    im = Image.open(path)
    print(f"file:       {path}")
    print(f"size:       {im.width} x {im.height}")
    print(f"frames:     {im.width // CELL_W}")
    print(f"mode:       {im.mode}")
    print(f"alpha box:  {im.getchannel('A').getbbox()}")
    print(f"bytes:      {path.stat().st_size}")


def main() -> None:
    sheet = build()
    DST.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(DST, format="PNG", optimize=True)
    report(DST)


if __name__ == "__main__":
    main()
