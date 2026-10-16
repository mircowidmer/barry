"""Generates every app icon, splash and favicon from assets/brand/icon-1024.png (full-bleed, for
app icons) and assets/brand/icon-rounded.png (rounded corners, for the splash, logo and favicon).

Run with: python3 scripts/make-icons.py (needs Pillow)
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'assets/brand/icon-1024.png'
ROUNDED = ROOT / 'assets/brand/icon-rounded.png'
OUT = ROOT / 'assets/images'
BACKGROUND = (255, 255, 255, 255)
SF_PRO = '/System/Library/Fonts/SFNS.ttf'


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


def css_gradient(size: tuple[int, int], degrees: float, start, end) -> Image.Image:
    """Matches CSS linear-gradient(<degrees>deg, start, end): 0deg points up, angles turn clockwise."""
    w, h = size
    dx, dy = math.sin(math.radians(degrees)), -math.cos(math.radians(degrees))
    length = abs(w * dx) + abs(h * dy)
    rows = bytearray()
    for y in range(h):
        for x in range(w):
            t = min(1.0, max(0.0, ((x - w / 2) * dx + (y - h / 2) * dy) / length + 0.5))
            rows += bytes(round(a + (b - a) * t) for a, b in zip(start, end))
    return Image.frombytes('RGB', size, bytes(rows)).convert('RGBA')


def font(weight: bytes, size: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(SF_PRO, size)
    f.set_variation_by_name(weight)
    return f


# The iOS launch screen mirrors the header of barry.support (web/site.css), at 3x on a 430 pt wide phone.
# iOS scales it to fill the screen, so everything sits in the middle, away from edges that get cropped.
splash = css_gradient((1290, 2796), 160, (0x34, 0xC7, 0x59), (0x00, 0x88, 0xFF))
icon = scaled(360, ROUNDED)
margin = 120
shadow = Image.new('RGBA', (icon.width + 2 * margin, icon.height + 2 * margin), (0, 0, 0, 0))
shadow.paste((0, 0, 0, 51), (margin, margin), icon.getchannel('A'))
shadow = shadow.filter(ImageFilter.GaussianBlur(36))
title, slogan = font(b'Bold', 132), font(b'Semibold', 78)
draw = ImageDraw.Draw(splash)
block = icon.height + 60 + 132 + 30 + 78
top = (splash.height - block) // 2 - 120
splash.alpha_composite(shadow, ((splash.width - shadow.width) // 2, top + 24 - margin))
splash.alpha_composite(icon, ((splash.width - icon.width) // 2, top))
draw.text((splash.width / 2, top + icon.height + 60), 'Barry', font=title, fill='white', anchor='mt')
draw.text((splash.width / 2, top + icon.height + 60 + 132 + 30), 'Go alone, get home.', font=slogan, fill='white', anchor='mt')
splash.convert('RGB').save(OUT / 'splash.png')
print('icons written to', OUT)
