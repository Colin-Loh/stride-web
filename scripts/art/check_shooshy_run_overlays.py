#!/usr/bin/env python3
"""Verify Shooshy run overlays against their matching alpha>127 frames."""
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "cosmetics" / "run"
W, H, FRAMES, GRID = 236, 196, 8, 4
ITEMS = ("shooshy-black-sunglasses", "shooshy-sushi-hat")


def verify() -> None:
    for health in ("healthy", "obese"):
        filename = "shooshy-run.png" if health == "healthy" else "shooshy-run-obese.png"
        with Image.open(ROOT / "public" / "sprites" / filename) as source:
            body = source.convert("RGBA")
        assert body.size == (FRAMES * W, H), (filename, body.size)
        for item in ITEMS:
            name = f"{item}-{health}.png"
            with Image.open(OUT / name) as source:
                overlay = source.convert("RGBA")
            assert overlay.size == body.size, (name, overlay.size)
            colours = {pixel for pixel in overlay.get_flattened_data() if pixel[3]}
            assert len(colours) <= 16, (name, len(colours))
            assert set(overlay.getchannel("A").get_flattened_data()) <= {0, 255}, name
            assert all(pixel[:3] == (0, 0, 0) for pixel in overlay.get_flattened_data() if not pixel[3]), name
            for frame in range(FRAMES):
                crop = (frame * W, 0, (frame + 1) * W, H)
                item_frame = overlay.crop(crop)
                body_frame = body.crop(crop)
                mask = body_frame.getchannel("A").point(lambda alpha: 255 if alpha > 127 else 0)
                allowed = mask.filter(ImageFilter.MaxFilter(9))
                pixels = item_frame.getchannel("A")
                opaque = sum(1 for value in pixels.get_flattened_data() if value)
                outside = sum(1 for y in range(H) for x in range(W)
                              if pixels.getpixel((x, y)) and not allowed.getpixel((x, y)))
                assert opaque > 0 and outside == 0, (name, frame, opaque, outside)
                for y in range(0, H, GRID):
                    for x in range(0, W, GRID):
                        tile = pixels.crop((x, y, x + GRID, y + GRID))
                        assert len(set(tile.get_flattened_data())) == 1, (name, frame, x, y)
                print(f"{name} frame={frame} opaque={opaque} outside_4px={outside} colours={len(colours)} PASS")


if __name__ == "__main__":
    verify()
