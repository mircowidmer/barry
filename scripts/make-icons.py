"""Generates every app icon, splash and favicon from assets/brand/icon-512.png.

Run with: python3 scripts/make-icons.py (needs Pillow)
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'assets/brand/icon-512.png'
OUT = ROOT / 'assets/images'
BACKGROUND = (255, 255, 255, 255)


def scaled(size: int) -> Image.Image:
    return Image.open(SOURCE).convert('RGBA').resize((size, size), Image.LANCZOS)


def on_canvas(art: Image.Image, canvas: int, fill=(0, 0, 0, 0)) -> Image.Image:
    out = Image.new('RGBA', (canvas, canvas), fill)
    offset = (canvas - art.width) // 2
    out.alpha_composite(art, (offset, offset))
    return out


# iOS rejects icons with transparency, so the app icon is flattened onto white.
on_canvas(scaled(1024), 1024, BACKGROUND).convert('RGB').save(OUT / 'icon.png')

# Android crops adaptive icons to the inner 66 %, so the dog sits inside that safe zone.
on_canvas(scaled(660), 1024).save(OUT / 'android-icon-foreground.png')
Image.new('RGBA', (1024, 1024), BACKGROUND).save(OUT / 'android-icon-background.png')
art = scaled(660)
dark = Image.eval(art.convert('L'), lambda v: 255 if v < 90 else 0)
mono = Image.new('RGBA', art.size, (255, 255, 255, 0))
mono.putalpha(Image.composite(dark, Image.new('L', art.size, 0), art.getchannel('A')))
on_canvas(mono, 1024).save(OUT / 'android-icon-monochrome.png')

scaled(512).save(OUT / 'logo.png')
scaled(400).save(OUT / 'splash-icon.png')
scaled(48).save(OUT / 'favicon.png')
print('icons written to', OUT)
