from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
PREVIOUS = ROOT / "revised-six-card" / "export"
OUTPUT = ROOT / "final-six-card" / "export"
BACKGROUND = ROOT / "orma-bg.png"

BRICOLAGE = ROOT / "fonts" / "BricolageGrotesque.ttf"
INTER = ROOT / "fonts" / "Inter.ttf"

CREAM = "#F4EFE4"
SAGE = "#B9CABC"
NUMBER = "#C4CEC7"


def font(path: Path, size: int, variation: str = "Regular") -> ImageFont.FreeTypeFont:
    loaded = ImageFont.truetype(str(path), size=size)
    loaded.set_variation_by_name(variation.encode())
    return loaded


def wrap_lines(draw: ImageDraw.ImageDraw, text: str, selected_font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if draw.textbbox((0, 0), candidate, font=selected_font)[2] <= width:
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
    selected_font: ImageFont.FreeTypeFont,
    width: int,
    line_height: int,
    fill: str = CREAM,
) -> int:
    x, y = xy
    for line in wrap_lines(draw, text, selected_font, width):
        draw.text((x, y), line, font=selected_font, fill=fill)
        y += line_height
    return y


def draw_spaced(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    selected_font: ImageFont.FreeTypeFont,
    spacing: int,
    fill: str,
) -> None:
    x, y = xy
    for character in text:
        draw.text((x, y), character, font=selected_font, fill=fill)
        x += draw.textlength(character, font=selected_font) + spacing


def draw_number(draw: ImageDraw.ImageDraw, current: int) -> None:
    selected_font = font(INTER, 38, "Bold")
    label = f"{current} / 6"
    width = draw.textbbox((0, 0), label, font=selected_font)[2]
    draw.text((1010 - width, 58), label, font=selected_font, fill=NUMBER)


def draw_initialism_line(draw: ImageDraw.ImageDraw, xy: tuple[int, int]) -> None:
    regular = font(INTER, 38, "Regular")
    bold = font(INTER, 38, "Bold")
    segments = [
        ("O", bold), ("ptimised ", regular),
        ("R", bold), ("oute ", regular),
        ("M", bold), ("apping for ", regular),
        ("A", bold), ("ll dogs", regular),
    ]
    x, y = xy
    for text, selected_font in segments:
        draw.text((x, y), text, font=selected_font, fill=CREAM)
        x += draw.textlength(text, font=selected_font)


def card_two(background: Image.Image) -> Image.Image:
    previous = Image.open(PREVIOUS / "orma-welcome-02.png").convert("RGB")
    image = background.copy()
    draw = ImageDraw.Draw(image)

    framed_photo = (133, 177, 947, 791)
    image.paste(previous.crop(framed_photo), framed_photo[:2])

    draw_number(draw, 2)
    draw_spaced(draw, "WHERE IT BEGAN", (105, 124), font(INTER, 29, "Bold"), 6, SAGE)
    y = draw_wrapped(draw, "Born in the Italian Dolomites", (105, 825), font(BRICOLAGE, 76, "SemiBold"), 850, 79)
    y += 35
    draw_wrapped(
        draw,
        "The Dolomites and the Tre Cime ridge represent the mountains that shaped my life and inspired our mission.",
        (105, y),
        font(INTER, 40, "Regular"),
        850,
        52,
    )
    return image


def card_three(background: Image.Image) -> Image.Image:
    previous = Image.open(PREVIOUS / "orma-welcome-03.png").convert("RGB")
    image = background.copy()
    draw = ImageDraw.Draw(image)

    framed_photo = (95, 177, 985, 666)
    image.paste(previous.crop(framed_photo), framed_photo[:2])

    draw_number(draw, 3)
    draw_spaced(draw, "THE DOG BEHIND ORMA", (105, 124), font(INTER, 29, "Bold"), 6, SAGE)

    y = draw_wrapped(
        draw,
        "I grew up hiking these trails with my best friend, Freddy, a terrier cross who went from a whirlwind of puppy energy to an old dog choosing every step with quiet care.",
        (105, 726),
        font(INTER, 40, "Regular"),
        860,
        49,
    )
    y += 35
    draw_wrapped(
        draw,
        "Walking beside him through every stage of his life shaped everything ORMA is today.",
        (105, y),
        font(BRICOLAGE, 52, "SemiBold"),
        860,
        57,
    )
    return image


def card_five(background: Image.Image) -> Image.Image:
    image = background.copy()
    draw = ImageDraw.Draw(image)

    draw_number(draw, 5)
    draw_spaced(draw, "THE MEANING OF ORMA", (105, 320), font(INTER, 29, "Bold"), 6, SAGE)

    y = draw_wrapped(draw, "A footprint and a promise", (105, 398), font(BRICOLAGE, 74, "SemiBold"), 850, 78)
    y += 42
    y = draw_wrapped(
        draw,
        "In Italian, orma means a footprint or trace left behind.",
        (105, y),
        font(INTER, 38, "Regular"),
        850,
        49,
    )
    y += 25
    y = draw_wrapped(
        draw,
        "For us, it is the mark a dog leaves on a trail, and the one they leave on your life.",
        (105, y),
        font(INTER, 38, "Regular"),
        850,
        49,
    )
    y += 28
    draw.text((105, y), "It is also our promise:", font=font(INTER, 38, "Regular"), fill=CREAM)
    y += 49
    draw_initialism_line(draw, (105, y))
    y += 49
    draw.text((105, y), "(and their humans),", font=font(INTER, 38, "Regular"), fill=CREAM)
    y += 70
    draw_wrapped(
        draw,
        "so every adventure can begin with confidence.",
        (105, y),
        font(INTER, 38, "Regular"),
        850,
        49,
    )
    return image


def card_six(background: Image.Image) -> Image.Image:
    image = Image.open(PREVIOUS / "orma-welcome-06.png").convert("RGB")
    draw = ImageDraw.Draw(image)

    # Remove the old left-aligned credit without disturbing the background art.
    fill = image.getpixel((90, 1055))
    draw.rectangle((82, 1028, 600, 1105), fill=fill)

    selected_font = font(INTER, 34, "Bold")
    credit = "Benedetta, Founder of ORMA"
    width = draw.textbbox((0, 0), credit, font=selected_font)[2]
    draw.text((975 - width, 1042), credit, font=selected_font, fill=CREAM)
    return image


def build_preview(paths: list[Path]) -> None:
    thumb_size = (324, 405)
    gap = 18
    margin = 24
    preview = Image.new("RGB", (margin * 2 + thumb_size[0] * 3 + gap * 2, margin * 2 + thumb_size[1] * 2 + gap), "#F3F1EC")
    for index, path in enumerate(paths):
        card = Image.open(path).convert("RGB")
        card.thumbnail(thumb_size, Image.Resampling.LANCZOS)
        x = margin + (index % 3) * (thumb_size[0] + gap)
        y = margin + (index // 3) * (thumb_size[1] + gap)
        preview.paste(card, (x, y))
    preview.save(OUTPUT / "orma-welcome-final-sequence.png", quality=95)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    background = Image.open(BACKGROUND).convert("RGB")
    output_paths: list[Path] = []

    builders = {
        2: lambda: card_two(background),
        3: lambda: card_three(background),
        5: lambda: card_five(background),
        6: lambda: card_six(background),
    }

    for number in range(1, 7):
        output_path = OUTPUT / f"orma-welcome-{number:02d}.png"
        if number in builders:
            image = builders[number]()
        else:
            image = Image.open(PREVIOUS / f"orma-welcome-{number:02d}.png").convert("RGB")
        image.save(output_path, quality=95)
        output_paths.append(output_path)

    build_preview(output_paths)


if __name__ == "__main__":
    main()
