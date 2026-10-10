#!/usr/bin/env python3
"""Build public/sprites/shooshy-run-obese.png from the healthy Shooshy run sheet.

Rerun from the repo root (deterministic, no network, no paid services):
    python3 scripts/art/make_shooshy_obese_run.py

Input:  public/sprites/shooshy-run.png       (8 frames, 236 x 196 each, RGBA)
Output: public/sprites/shooshy-run-obese.png (1888 x 196, RGBA)

Method: each frame is painted over in place, the same way shooshy-obese.png
fattens the standing pose. The healthy pixels are never resampled, so the
head, eyes, ears, tail and leg tips keep their exact pixels and stride.

1. Measure the torso in the healthy frame: back line and belly line at the
   mid-torso column, rump at the mid-torso row, chest at the chest row.
2. Paint a pear-shaped belly over the torso: the top half follows the back
   line, the lower half sags below the healthy belly and the sides push out
   past the rump and chest. The shape is drawn on a 3 px grid so its edge
   steps match the chunky pixel look of the source.
3. Fill the belly with the body grey (deterministic dither over the body
   greys sampled from the source) and stamp the black outline, at the
   source outline weight, around it wherever the healthy frame is not
   already body. Healthy body pixels next to the belly stay as they are, so
   the old belly outline disappears into the bigger body and the legs join
   under the belly.
4. Check every frame keeps a clear margin to the cell edge, then write the
   strip with fixed PNG settings and no metadata, so output bytes are stable.
"""

import sys
from collections import Counter
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
SRC = REPO / "public" / "sprites" / "shooshy-run.png"
DST = REPO / "public" / "sprites" / "shooshy-run-obese.png"

CELL_W = 236
CELL_H = 196
FRAMES = 8
MARGIN = 4  # px kept clear of the cell edge on each side

GRID = 3  # belly edge step size in px
OUTLINE = 11  # outline weight in px, measured on the source back line
OUTLINE_RGBA = (19, 19, 19, 252)
FRINGE_RGBA = (19, 19, 19, 120)  # 1 px soft outer edge, like the source

# Torso probes (cell coordinates). The mid-torso column and rows sit between
# the hind and front legs in every healthy frame.
MID_X = 115
RUMP_Y = 118
CHEST_Y = 124

# Belly growth in px relative to the healthy torso.
RUMP_OUT = 12  # rump pushes back
CHEST_OUT = 2  # chest pushes forward (the head sits just in front)
CHEST_EYE_GAP = 6  # chest stays at least this far behind the back eye
SAG = 11  # belly hangs below the healthy belly line
CENTRE_DROP = 0.42  # widest row, as a fraction from back line to new belly line

Pixel = tuple[int, int, int, int]


def is_body(p: Pixel) -> bool:
    """Opaque, non-outline pixel (body grey or eye yellow)."""
    return p[3] > 128 and max(p[:3]) > 50


def is_eye(p: Pixel) -> bool:
    return p[3] > 200 and p[0] > 180 and p[1] > 140 and p[2] < 90


def measure(px) -> dict[str, int]:
    """Back line, belly line, rump and chest of a healthy frame."""
    col = [is_body(px[MID_X, y]) for y in range(CELL_H)]
    back = col.index(True)
    belly = back
    while belly + 1 < CELL_H and col[belly + 1]:
        belly += 1

    def run_at(y: int) -> tuple[int, int]:
        # The body run that contains MID_X on row y.
        x0 = x1 = MID_X
        while x0 - 1 >= 0 and is_body(px[x0 - 1, y]):
            x0 -= 1
        while x1 + 1 < CELL_W and is_body(px[x1 + 1, y]):
            x1 += 1
        return x0, x1

    rump, _ = run_at(RUMP_Y)
    _, chest = run_at(CHEST_Y)
    # On reaching strides the chest row runs on into the front leg. The chest
    # never sits further forward than just behind the eyes.
    eye_x = min(x for y in range(CELL_H) for x in range(CELL_W) if is_eye(px[x, y]))
    chest = min(chest, eye_x - CHEST_EYE_GAP)
    return {"back": back, "belly": belly, "rump": rump, "chest": chest}


def belly_mask(m: dict[str, int]) -> set[tuple[int, int]]:
    """Pear-shaped belly fill, drawn on a GRID px lattice."""
    left = m["rump"] - RUMP_OUT
    right = m["chest"] + CHEST_OUT
    top = m["back"]
    bottom = m["belly"] + SAG
    cx = (left + right) / 2.0
    rx = (right - left) / 2.0
    cy = top + (bottom - top) * CENTRE_DROP
    ry_top = cy - top
    ry_bot = bottom - cy
    cells: set[tuple[int, int]] = set()
    for gy in range(0, CELL_H, GRID):
        for gx in range(0, CELL_W, GRID):
            x = gx + GRID / 2.0
            y = gy + GRID / 2.0
            ry = ry_top if y < cy else ry_bot
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                for yy in range(gy, min(gy + GRID, CELL_H)):
                    for xx in range(gx, min(gx + GRID, CELL_W)):
                        cells.add((xx, yy))
    return cells


def disk(r: float) -> list[tuple[int, int]]:
    n = int(r) + 1
    return [(dx, dy) for dy in range(-n, n + 1) for dx in range(-n, n + 1) if dx * dx + dy * dy <= r * r]


RING = disk(OUTLINE)
RING_FRINGE = sorted(set(disk(OUTLINE + 1)) - set(RING))


def body_greys(src: Image.Image) -> list[Pixel]:
    """Most common body greys of the source, in a fixed order."""
    counts = Counter(
        p for p in src.get_flattened_data() if p[3] > 250 and 70 < p[0] < 110 and abs(p[0] - p[2]) < 6
    )
    return [c for c, _ in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:6]]


def grey_at(greys: list[Pixel], x: int, y: int) -> Pixel:
    """Deterministic dither over the body greys, in GRID px blocks."""
    h = ((x // GRID) * 0x9E3779B1 + (y // GRID) * 0x85EBCA77) & 0xFFFFFFFF
    h ^= h >> 15
    h = (h * 0x2C1B3C6D) & 0xFFFFFFFF
    h ^= h >> 12
    return greys[h % len(greys)]


def fatten(cell: Image.Image, greys: list[Pixel]) -> tuple[Image.Image, dict[str, int]]:
    src = cell.load()
    m = measure(src)
    fill = belly_mask(m)
    edge = [
        p for p in fill if any((p[0] + dx, p[1] + dy) not in fill for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    ]
    ring: set[tuple[int, int]] = set()
    fringe: set[tuple[int, int]] = set()
    for x, y in edge:
        for dx, dy in RING:
            ring.add((x + dx, y + dy))
        for dx, dy in RING_FRINGE:
            fringe.add((x + dx, y + dy))
    ring -= fill
    fringe -= fill | ring

    out = cell.copy()
    dst = out.load()
    for x, y in fill:
        dst[x, y] = grey_at(greys, x, y)
    for x, y in ring:
        if 0 <= x < CELL_W and 0 <= y < CELL_H and not is_body(src[x, y]):
            dst[x, y] = OUTLINE_RGBA
    for x, y in fringe:
        if 0 <= x < CELL_W and 0 <= y < CELL_H and src[x, y][3] < FRINGE_RGBA[3]:
            dst[x, y] = FRINGE_RGBA
    return out, m


def check_margin(fat: Image.Image, healthy: Image.Image, index: int) -> None:
    """Fail loudly if the painted belly pushes a frame into the cell edge margin.

    Some healthy frames already put a paw within MARGIN of the bottom edge, so
    the limit on each side is the margin or the healthy extent, whichever is
    further out.
    """
    box = fat.getchannel("A").getbbox()
    if box is None:
        sys.exit(f"frame {index} is empty")
    hx0, hy0, hx1, hy1 = healthy.getchannel("A").getbbox()
    x0, y0, x1, y1 = box
    if (
        x0 < min(MARGIN, hx0)
        or y0 < min(MARGIN, hy0)
        or x1 > max(CELL_W - MARGIN, hx1)
        or y1 > max(CELL_H - MARGIN, hy1)
    ):
        sys.exit(f"frame {index} breaks the {MARGIN}px margin: bbox {box}")


def build() -> Image.Image:
    src = Image.open(SRC).convert("RGBA")
    if src.size != (CELL_W * FRAMES, CELL_H):
        sys.exit(f"unexpected source size {src.size}")
    greys = body_greys(src)
    sheet = Image.new("RGBA", src.size, (0, 0, 0, 0))
    for i in range(FRAMES):
        cell = src.crop((i * CELL_W, 0, (i + 1) * CELL_W, CELL_H))
        fat, m = fatten(cell, greys)
        check_margin(fat, cell, i)
        print(f"frame {i}: torso {m}  bbox {fat.getchannel('A').getbbox()}")
        sheet.paste(fat, (i * CELL_W, 0))
    return sheet


def report(path: Path) -> None:
    im = Image.open(path)
    print(f"file:       {path.relative_to(REPO)}")
    print(f"size:       {im.width} x {im.height}")
    print(f"frames:     {im.width // CELL_W} ({CELL_W} x {CELL_H} each)")
    print(f"mode:       {im.mode}")
    print(f"alpha box:  {im.getchannel('A').getbbox()}")
    print(f"bytes:      {path.stat().st_size}")


def main() -> None:
    sheet = build()
    sheet.save(DST, format="PNG", optimize=True)
    report(DST)


if __name__ == "__main__":
    main()
