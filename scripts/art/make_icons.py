"""Builds the Chase app icons from frame 6 (full-stride gallop) of public/sprites/shiba-run.png.

Run from the repo root: python3 scripts/art/make_icons.py
Nearest-neighbour resampling keeps pixel edges crisp.
"""
from PIL import Image

FRAME_W, FRAME, BG = 296, 6, (11, 31, 24, 255)  # BG matches the theme colour #0b1f18
src = Image.open('public/sprites/shiba-run.png').convert('RGBA')
dog = src.crop((FRAME * FRAME_W, 0, (FRAME + 1) * FRAME_W, src.height))
dog = dog.crop(dog.getchannel('A').getbbox())


def place(size, fill, bg):
    canvas = Image.new('RGBA', (size, size), bg)
    scale = size * fill / dog.width
    w, h = round(dog.width * scale), round(dog.height * scale)
    img = dog.resize((w, h), Image.NEAREST)
    canvas.alpha_composite(img, ((size - w) // 2, (size - h) // 2))
    return canvas


def save(img, path, flatten):
    if flatten:
        img = img.convert('RGB')
    img.save(path, optimize=True)


save(place(512, 0.78, BG), 'public/icon-512.png', True)
save(place(192, 0.78, BG), 'public/icon-192.png', True)
save(place(180, 0.78, BG), 'public/apple-touch-icon.png', True)
# Maskable: content stays inside the central 80% safe zone, background fills to the edge.
save(place(512, 0.6, BG), 'public/icon-maskable-512.png', True)
# Favicon: transparent background so it sits on any tab colour.
save(place(64, 0.95, (0, 0, 0, 0)), 'public/favicon.png', False)
