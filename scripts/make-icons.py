"""Generates every app icon, splash and favicon from assets/brand/icon-1024.png (full-bleed, for
app icons) and assets/brand/icon-rounded.png (rounded corners, for the splash, logo and favicon).

Run with: python3 scripts/make-icons.py (needs Pillow)
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'assets/brand/icon-1024.png'
ROUNDED = ROOT / 'assets/brand/icon-rounded.png'
OUT = ROOT / 'assets/images'
BACKGROUND = (255, 255, 255, 255)


def scaled(size: int, source: Path = SOURCE) -> Image.Image:
    return Image.open(source).convert('RGBA').resize((size, size), Image.LANCZOS)


def on_canvas(art: Image.Image, canvas: int, fill=(0, 0, 0, 0)) -> Image.Image:
    out = Image.new('RGBA', (canvas, canvas), fill)
    offset = (canvas - art.width) // 2
    out.alpha_composite(art, (offset, offset))
    return out


# iOS rejects icons with transparency, so the app icon is flattened onto white.
on_canvas(scaled(1024), 1024, BACKGROUND).convert('RGB').save(OUT / 'icon.png')

# The source is full-bleed, so Android gets it as the background layer under an empty foreground.
Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)).save(OUT / 'android-icon-foreground.png')
scaled(1024).save(OUT / 'android-icon-background.png')
art = scaled(660)
dark = Image.eval(art.convert('L'), lambda v: 255 if v < 90 else 0)
mono = Image.new('RGBA', art.size, (255, 255, 255, 0))
mono.putalpha(Image.composite(dark, Image.new('L', art.size, 0), art.getchannel('A')))
on_canvas(mono, 1024).save(OUT / 'android-icon-monochrome.png')

scaled(512, ROUNDED).save(OUT / 'logo.png')
scaled(400, ROUNDED).save(OUT / 'splash-icon.png')
scaled(48, ROUNDED).save(OUT / 'favicon.png')
print('icons written to', OUT)
