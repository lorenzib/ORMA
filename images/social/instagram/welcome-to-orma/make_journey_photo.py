from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source" / "IMG_7747.jpg"
CROP_OUT = ROOT / "assets" / "orma-journey-ahead.jpg"
CARD = ROOT / "export" / "orma-welcome-07.png"


def brand_filter(image: Image.Image) -> Image.Image:
    image = ImageEnhance.Color(image).enhance(0.88)
    image = ImageEnhance.Contrast(image).enhance(0.96)
    image = ImageEnhance.Brightness(image).enhance(1.015)
    grey = ImageOps.grayscale(image)
    sepia = Image.merge(
        "RGB",
        (
            grey.point(lambda value: min(255, int(value * 1.07))),
            grey.point(lambda value: min(255, int(value * 0.98))),
            grey.point(lambda value: min(255, int(value * 0.84))),
        ),
    )
    return Image.blend(image, sepia, 0.035)


source = Image.open(SOURCE).convert("RGB")

# The existing card has a 956 × 281 px photo window. This crop keeps
# Benedetta, Freddy, and the Dolomite ridge together without modifying them.
width, height = 956, 281
crop_height = round(source.width / (width / height))
top = 1100
crop = source.crop((0, top, source.width, top + crop_height))
crop = crop.resize((width, height), Image.Resampling.LANCZOS)
crop = brand_filter(crop)

CROP_OUT.parent.mkdir(parents=True, exist_ok=True)
crop.save(CROP_OUT, quality=95, optimize=True)

# Replace only the photograph inside the retained border and layout.
card = Image.open(CARD).convert("RGB")
card.paste(crop, (62, 162))
card.save(CARD, optimize=True)
