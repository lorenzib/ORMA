#!/usr/bin/env python3
"""Draw the iPhone and Android app icons and launch screens from the ORMA
logo (images/brand/orma-icon-2048.png). Replaces Capacitor's stock logo.

Run from the repository root after changing the logo:
    python3 scripts/build-app-icons.py
Needs Pillow (pip install pillow). The outputs are committed, so the app
builds never run this.
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(ROOT, 'images/brand/orma-icon-2048.png')
GREEN = (56, 66, 57)          # the logo tile's own background
IOS = os.path.join(ROOT, 'ios/App/App/Assets.xcassets')
RES = os.path.join(ROOT, 'android/app/src/main/res')

# Android densities: launcher icon 48dp, adaptive foreground 108dp.
DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

# The paw fills 75% of the logo. Android shows only the middle 66 of an
# adaptive icon's 108dp, so the logo sits at 68% of the layer to keep the
# whole paw inside every launcher's mask.
ADAPTIVE_SCALE = 0.68


def full_bleed():
    """The logo as a square with no rounded corners or transparency: the
    phone rounds the corners itself, and iOS refuses an icon with alpha."""
    logo = Image.open(LOGO).convert('RGBA')
    square = Image.new('RGBA', logo.size, GREEN + (255,))
    square.alpha_composite(logo)
    return square.convert('RGB')


def on_green(icon, size, scale):
    canvas = Image.new('RGB', (size, size), GREEN)
    inner = round(size * scale)
    canvas.paste(icon.resize((inner, inner), Image.LANCZOS), ((size - inner) // 2,) * 2)
    return canvas


def masked(img, radius_ratio):
    """img with rounded corners (0.5 = a circle) and a transparent outside."""
    size = img.size[0]
    mask = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size * 4 - 1, size * 4 - 1), radius=round(size * 4 * radius_ratio), fill=255)
    out = img.convert('RGBA')
    out.putalpha(mask.resize((size, size), Image.LANCZOS))
    return out


def splash(icon, width, height, share):
    """A green screen with the logo in the middle, `share` of the short side."""
    canvas = Image.new('RGB', (width, height), GREEN)
    side = round(min(width, height) * share)
    canvas.paste(icon.resize((side, side), Image.LANCZOS), ((width - side) // 2, (height - side) // 2))
    return canvas


def main():
    icon = full_bleed()

    # iPhone: one 1024 icon; the launch screen is a 2732 square drawn
    # aspect-fill, so a phone shows about its middle third across.
    icon.resize((1024, 1024), Image.LANCZOS).save(
        os.path.join(IOS, 'AppIcon.appiconset/AppIcon-512@2x.png'), optimize=True)
    ios_splash = splash(icon, 2732, 2732, 0.17)
    for name in ('splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'):
        ios_splash.save(os.path.join(IOS, 'Splash.imageset', name), optimize=True)

    # Android launcher icons.
    for density, k in DENSITIES.items():
        folder = os.path.join(RES, 'mipmap-' + density)
        legacy = icon.resize((round(48 * k),) * 2, Image.LANCZOS)
        masked(legacy, 0.18).save(os.path.join(folder, 'ic_launcher.png'), optimize=True)
        masked(legacy, 0.5).save(os.path.join(folder, 'ic_launcher_round.png'), optimize=True)
        on_green(icon, round(108 * k), ADAPTIVE_SCALE).save(
            os.path.join(folder, 'ic_launcher_foreground.png'), optimize=True)

    # Android launch screens (before Android 12, which draws the app icon).
    for folder in os.listdir(RES):
        path = os.path.join(RES, folder, 'splash.png')
        if folder.startswith('drawable') and os.path.isfile(path):
            with Image.open(path) as old:
                width, height = old.size
            splash(icon, width, height, 0.3).save(path, optimize=True)


if __name__ == '__main__':
    main()
