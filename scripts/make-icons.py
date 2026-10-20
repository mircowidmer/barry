"""Generates every app icon, splash and favicon from the Icon Composer source assets/brand/icon.icon.

Icon Composer's ictool renders the icon with its glass, so a colour change belongs in icon.json and
reaches every image on the next run. The launch screens take their colours from src/constants/theme.ts.

Run with: python3 scripts/make-icons.py (needs Pillow and Xcode 26 on macOS)
"""
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ICON = ROOT / 'assets/brand/icon.icon'
THEME = ROOT / 'src/constants/theme.ts'
OUT = ROOT / 'assets/images'
ICTOOL = '/Applications/Xcode.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool'
SF_PRO = '/System/Library/Fonts/SFNS.ttf'
# The render has the rounded corners of the iOS mask; cutting this margin leaves only the tile.
TILE_MARGIN = 88
# Android launchers show only the middle 72 of the icon's 108 dp, so the dog shrinks into the 66 dp safe zone.
ANDROID_DOG_SCALE = 0.72
BLACK, WHITE = 'extended-srgb:0.00000,0.00000,0.00000,1.00000', 'extended-srgb:1.00000,1.00000,1.00000,1.00000'


def render(layer: bool = True, fill: str = "") -> Image.Image:
    """The 1024 px icon as Icon Composer draws it, optionally without the dog or on a solid fill."""
    with tempfile.TemporaryDirectory() as tmp:
        icon = Path(tmp) / 'icon.icon'
        shutil.copytree(ICON, icon)
        spec = json.loads((icon / 'icon.json').read_text())
        for group in spec['groups']:
            group['hidden'] = not layer
        if fill:
            for specialization in spec['fill-specializations']:
                specialization['value'] = {'solid': fill}
        (icon / 'icon.json').write_text(json.dumps(spec))
        out = Path(tmp) / 'out.png'
        subprocess.run([ICTOOL, str(icon), '--export-preview', 'iOS', 'Light', '1024', '1024', '1', str(out)], check=True, capture_output=True)
        return Image.open(out).convert('RGBA')


def full_bleed(rounded: Image.Image) -> Image.Image:
    m = TILE_MARGIN
    return rounded.crop((m, m, 1024 - m, 1024 - m)).resize((1024, 1024), Image.LANCZOS)


def dog_layer() -> Image.Image:
    """The dog with its glass and shadow on transparency, from renders over black and over white."""
    black = np.asarray(full_bleed(render(fill=BLACK)).convert('RGB'), dtype=float)
    white = np.asarray(full_bleed(render(fill=WHITE)).convert('RGB'), dtype=float)
    alpha = np.clip(1 - (white - black).mean(axis=2) / 255, 0, 1)
    rgb = np.clip(black / np.maximum(alpha, 1e-3)[..., None], 0, 255)
    return Image.fromarray(np.dstack([rgb, alpha * 255]).round().astype(np.uint8))


def on_canvas(art: Image.Image, canvas: int, fill=(0, 0, 0, 0)) -> Image.Image:
    out = Image.new('RGBA', (canvas, canvas), fill)
    offset = (canvas - art.width) // 2
    out.alpha_composite(art, (offset, offset))
    return out


def theme() -> dict[str, dict[str, str]]:
    source = THEME.read_text()
    return {
        scheme: dict(re.findall(r"(\w+): '(#[0-9A-Fa-f]{6})'", block))
        for scheme, block in re.findall(r'(light|dark): \{(.*?)\}', source, re.S)
    }


def font(weight: bytes, size: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(SF_PRO, size)
    f.set_variation_by_name(weight)
    return f


rounded = render()
art = full_bleed(rounded)

# iOS rejects icons with transparency; the full-bleed tile has none.
art.convert('RGB').save(OUT / 'icon.png')

# Android masks and moves its layers, so the dog sits on the foreground over the bare gradient.
dog = dog_layer()
size = round(1024 * ANDROID_DOG_SCALE)
on_canvas(dog.resize((size, size), Image.LANCZOS), 1024).save(OUT / 'android-icon-foreground.png')
full_bleed(render(layer=False)).save(OUT / 'android-icon-background.png')
# The themed icon is the dog's dark fur, framed like the foreground.
fur = dog.convert('L').point(lambda v: 255 if v < 90 else 0)
solid = dog.getchannel('A').point(lambda v: 255 if v > 128 else 0)
mono = Image.new('RGBA', (1024, 1024), (255, 255, 255, 0))
mono.putalpha(Image.composite(fur, Image.new('L', fur.size, 0), solid))
on_canvas(mono.resize((size, size), Image.LANCZOS), 1024).save(OUT / 'android-icon-monochrome.png')

rounded.resize((512, 512), Image.LANCZOS).save(OUT / 'logo.png')
rounded.resize((400, 400), Image.LANCZOS).save(OUT / 'splash-icon.png')
rounded.resize((48, 48), Image.LANCZOS).save(OUT / 'favicon.png')

# The iOS launch screens, at 3x on a 430 pt wide phone, on the app's background in each appearance.
# iOS scales them to fill the screen, so everything sits in the middle, away from edges that get cropped.
icon = rounded.resize((360, 360), Image.LANCZOS)
margin = 120
shadow = Image.new('RGBA', (icon.width + 2 * margin, icon.height + 2 * margin), (0, 0, 0, 0))
shadow.paste((0, 0, 0, 51), (margin, margin), icon.getchannel('A'))
shadow = shadow.filter(ImageFilter.GaussianBlur(36))
title, slogan = font(b'Bold', 132), font(b'Semibold', 78)
for name, colors in (('splash.png', theme()['light']), ('splash-dark.png', theme()['dark'])):
    splash = Image.new('RGBA', (1290, 2796), colors['background'])
    draw = ImageDraw.Draw(splash)
    block = icon.height + 60 + 132 + 30 + 78
    top = (splash.height - block) // 2 - 120
    splash.alpha_composite(shadow, ((splash.width - shadow.width) // 2, top + 24 - margin))
    splash.alpha_composite(icon, ((splash.width - icon.width) // 2, top))
    draw.text((splash.width / 2, top + icon.height + 60), 'Barry', font=title, fill=colors['text'], anchor='mt')
    draw.text((splash.width / 2, top + icon.height + 60 + 132 + 30), 'Go alone, get home.', font=slogan, fill=colors['accent'], anchor='mt')
    splash.convert('RGB').save(OUT / name)
print('icons written to', OUT)
