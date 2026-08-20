from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
SOURCE_EXPORT = ROOT / "export"
OUTPUT = ROOT / "revised-six-card" / "export"
BACKGROUND = ROOT / "orma-bg.png"

FONT_REGULAR = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
FONT_BOLD = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")

TEXT = "#F4EFE4"
NUMBER = "#C4CEC7"
EYEBROW = "#B9CABC"


def fitted_font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size=size)


def wrap_lines(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if draw.textbbox((0, 0), candidate, font=font)[2] <= width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    font: ImageFont.FreeTypeFont,
    width: int,
    line_height: int,
    fill: str = TEXT,
) -> int:
    x, y = xy
    for line in wrap_lines(draw, text, font, width):
        draw.text((x, y), line, font=font, fill=fill)
        y += line_height
    return y


def draw_spaced(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    font: ImageFont.FreeTypeFont,
    spacing: int,
    fill: str,
) -> None:
    x, y = xy
    for character in text:
        draw.text((x, y), character, font=font, fill=fill)
        x += draw.textlength(character, font=font) + spacing


def renumber(image: Image.Image, current: int, total: int = 6) -> None:
    draw = ImageDraw.Draw(image)
    sample = image.getpixel((760, 74))
    draw.rectangle((850, 35, 1040, 125), fill=sample)
    font = fitted_font(FONT_BOLD, 38)
    label = f"{current} / {total}"
    box = draw.textbbox((0, 0), label, font=font)
    draw.text((1010 - (box[2] - box[0]), 58), label, font=font, fill=NUMBER)


def merged_card_three() -> Image.Image:
    old_card = Image.open(SOURCE_EXPORT / "orma-welcome-03.png").convert("RGB")
    background = Image.open(BACKGROUND).convert("RGB")
    image = background.copy()

    # Retain the exact approved, unfiltered photograph and sage frame from the
    # published card while rebuilding the copy on a seamless ORMA background.
    framed_photo = (95, 177, 985, 666)
    image.paste(old_card.crop(framed_photo), framed_photo[:2])
    renumber(image, 3)

    draw = ImageDraw.Draw(image)
    eyebrow = fitted_font(FONT_BOLD, 29)
    regular = fitted_font(FONT_REGULAR, 40)
    lesson = fitted_font(FONT_BOLD, 43)

    draw_spaced(draw, "THE DOG BEHIND ORMA", (105, 124), eyebrow, 6, EYEBROW)

    y = 726
    y = draw_wrapped(
        draw,
        "I grew up hiking these trails with my best friend, Freddy, a terrier cross who grew from a whirlwind of puppy energy into an old dog choosing every step with quiet care.",
        (105, y),
        regular,
        860,
        49,
    )
    y += 22
    y = draw_wrapped(
        draw,
        "Through every stage of his life, he taught me to match my stride to his.",
        (105, y),
        regular,
        860,
        49,
    )
    y += 23
    draw_wrapped(
        draw,
        "Not every path is kind to a dog, and not every dog is made for every trail.",
        (105, y),
        lesson,
        860,
        49,
    )
    return image


def build_preview(cards: list[Path]) -> None:
    thumb_size = (324, 405)
    gap = 18
    margin = 24
    preview = Image.new("RGB", (margin * 2 + thumb_size[0] * 3 + gap * 2, margin * 2 + thumb_size[1] * 2 + gap), "#F3F1EC")
    for index, card_path in enumerate(cards):
        card = Image.open(card_path).convert("RGB")
        card.thumbnail(thumb_size, Image.Resampling.LANCZOS)
        x = margin + (index % 3) * (thumb_size[0] + gap)
        y = margin + (index // 3) * (thumb_size[1] + gap)
        preview.paste(card, (x, y))
    preview.save(OUTPUT / "orma-welcome-six-card-sequence.png", quality=95)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source_order = [1, 2, None, 5, 6, 7]
    output_paths: list[Path] = []

    for new_number, old_number in enumerate(source_order, start=1):
        output_path = OUTPUT / f"orma-welcome-{new_number:02d}.png"
        if old_number is None:
            image = merged_card_three()
        else:
            image = Image.open(SOURCE_EXPORT / f"orma-welcome-{old_number:02d}.png").convert("RGB")
            renumber(image, new_number)
        image.save(output_path, quality=95)
        output_paths.append(output_path)

    build_preview(output_paths)


if __name__ == "__main__":
    main()
