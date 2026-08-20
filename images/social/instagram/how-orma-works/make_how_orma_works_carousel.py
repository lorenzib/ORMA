from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
SOCIAL_ROOT = ROOT.parent / "welcome-to-orma"
REPO_ROOT = ROOT.parents[3]
OUTPUT = ROOT / "export"
BACKGROUND = SOCIAL_ROOT / "orma-bg.png"
BRICOLAGE = SOCIAL_ROOT / "fonts" / "BricolageGrotesque.ttf"
INTER = SOCIAL_ROOT / "fonts" / "Inter.ttf"

CREAM = "#F4EFE4"
INK = "#20372C"
SAGE = "#B9CABC"
NUMBER = "#C4CEC7"
PAPER = "#E9E5D9"
PAPER_LINE = "#C9D1C4"
SOFT_INK = "#52665B"
ACCENT = "#79A984"
AMBER = "#D7A759"


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
            if current:
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
    spacing: int = 6,
    fill: str = SAGE,
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


def rounded_panel(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    radius: int = 24,
    fill: str = PAPER,
    outline: str = SAGE,
    width: int = 4,
) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def pill(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    label: str,
    fill: str,
    text_fill: str,
    selected_font: ImageFont.FreeTypeFont,
    pad_x: int = 18,
    pad_y: int = 9,
) -> tuple[int, int, int, int]:
    x, y = xy
    bbox = draw.textbbox((0, 0), label, font=selected_font)
    w = bbox[2] - bbox[0] + pad_x * 2
    h = bbox[3] - bbox[1] + pad_y * 2
    box = (x, y, x + w, y + h)
    draw.rounded_rectangle(box, radius=h // 2, fill=fill)
    draw.text((x + pad_x, y + pad_y - 2), label, font=selected_font, fill=text_fill)
    return box


def fit_crop(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    image = source.convert("RGB")
    scale = max(target_w / image.width, target_h / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def card_one(background: Image.Image) -> Image.Image:
    image = background.copy()
    draw = ImageDraw.Draw(image)
    draw_number(draw, 1)
    draw_spaced(draw, "HOW ORMA WORKS", (105, 332), font(INTER, 29, "Bold"))
    y = draw_wrapped(
        draw,
        "A trail match built around your dog",
        (105, 420),
        font(BRICOLAGE, 78, "SemiBold"),
        850,
        82,
    )
    y += 44
    draw_wrapped(
        draw,
        "A clearer way to understand the mountain before you set out.",
        (105, y),
        font(INTER, 43, "Regular"),
        790,
        56,
    )
    return image


def draw_profile_panel(image: Image.Image) -> None:
    draw = ImageDraw.Draw(image)
    rounded_panel(draw, (105, 175, 975, 670))
    draw_spaced(draw, "DOG PROFILE", (148, 214), font(INTER, 22, "Bold"), spacing=4, fill=SOFT_INK)

    draw.ellipse((148, 282, 300, 434), fill=INK)
    paw_font = font(INTER, 64, "Regular")
    paw = "●"
    draw.text((194, 312), paw, font=paw_font, fill=SAGE)
    for dx, dy in ((-18, -24), (8, -33), (33, -16)):
        draw.ellipse((220 + dx, 338 + dy, 246 + dx, 364 + dy), fill=SAGE)

    draw.text((338, 286), "YOUR DOG", font=font(INTER, 22, "Bold"), fill=SOFT_INK)
    draw.text((338, 326), "One profile, used across ORMA", font=font(BRICOLAGE, 38, "SemiBold"), fill=INK)

    chip_font = font(INTER, 23, "Bold")
    chip_specs = [
        (148, 500, "FITNESS"),
        (338, 500, "AGE"),
        (476, 500, "HEALTH"),
        (661, 500, "BUILD"),
    ]
    for x, y, label in chip_specs:
        pill(draw, (x, y), label, "#D1DBCF", INK, chip_font, pad_x=17, pad_y=10)
    draw.text((148, 596), "Saved once. Reflected in every match.", font=font(INTER, 28, "Regular"), fill=SOFT_INK)


def card_two(background: Image.Image) -> Image.Image:
    image = background.copy()
    draw = ImageDraw.Draw(image)
    draw_number(draw, 2)
    draw_spaced(draw, "STEP ONE · YOUR DOG", (105, 104), font(INTER, 29, "Bold"))
    draw_profile_panel(image)
    y = draw_wrapped(draw, "Tell us who is walking", (105, 735), font(BRICOLAGE, 73, "SemiBold"), 850, 77)
    y += 28
    y = draw_wrapped(
        draw,
        "Create a profile once with your dog's fitness, age, health and build.",
        (105, y),
        font(INTER, 39, "Regular"),
        850,
        51,
    )
    y += 28
    draw_wrapped(
        draw,
        "Those details shape every match score across ORMA.",
        (105, y),
        font(BRICOLAGE, 48, "SemiBold"),
        840,
        54,
    )
    return image


def card_three(background: Image.Image) -> Image.Image:
    image = background.copy()
    draw = ImageDraw.Draw(image)
    draw_number(draw, 3)
    draw_spaced(draw, "STEP TWO · THE MOUNTAIN", (105, 104), font(INTER, 29, "Bold"))

    frame = (105, 177, 975, 620)
    draw.rounded_rectangle(frame, radius=8, fill=SAGE)
    photo_box = (113, 185, 967, 612)
    source = Image.open(REPO_ROOT / "images" / "boucle-du-lac-vert.webp")
    image.paste(fit_crop(source, (photo_box[2] - photo_box[0], photo_box[3] - photo_box[1])), photo_box[:2])

    pill(draw, (148, 522), "TRAIL RATING · MODERATE", "#F2E5C9", "#7B5519", font(INTER, 21, "Bold"), 18, 9)
    y = draw_wrapped(draw, "We score the trail itself", (105, 684), font(BRICOLAGE, 72, "SemiBold"), 850, 76)
    y += 25
    y = draw_wrapped(
        draw,
        "Terrain, exposure and hazards form the trail rating. Distance, climb, descents, heat, shade and water add the detail.",
        (105, y),
        font(INTER, 37, "Regular"),
        850,
        48,
    )
    y += 28
    draw_wrapped(
        draw,
        "The trail rating stays the same for every dog.",
        (105, y),
        font(BRICOLAGE, 48, "SemiBold"),
        850,
        54,
    )
    return image


def card_four(background: Image.Image) -> Image.Image:
    image = background.copy()
    draw = ImageDraw.Draw(image)
    draw_number(draw, 4)
    draw_spaced(draw, "STEP THREE · THE MATCH", (105, 302), font(INTER, 29, "Bold"))
    y = draw_wrapped(
        draw,
        "One rating for the mountain. One match for your dog.",
        (105, 392),
        font(BRICOLAGE, 74, "SemiBold"),
        850,
        78,
    )
    y += 40
    y = draw_wrapped(
        draw,
        "We compare each route with your dog's fitness, age, health and build to show a personalised match percentage and the cautions behind it.",
        (105, y),
        font(INTER, 40, "Regular"),
        850,
        53,
    )
    y += 48
    draw.text((105, y), "Nothing hidden.", font=font(BRICOLAGE, 58, "SemiBold"), fill=CREAM)
    return image


def card_five(background: Image.Image) -> Image.Image:
    image = background.copy()
    draw = ImageDraw.Draw(image)
    draw_number(draw, 5)
    draw_spaced(draw, "WHAT THE SCORE MEANS", (105, 286), font(INTER, 29, "Bold"))
    y = draw_wrapped(draw, "Clarity, not certainty", (105, 376), font(BRICOLAGE, 76, "SemiBold"), 850, 80)
    y += 42
    y = draw_wrapped(
        draw,
        "Verified trails can earn the strongest match. Imported or incomplete routes are capped until we know more.",
        (105, y),
        font(INTER, 39, "Regular"),
        850,
        51,
    )
    y += 28
    y = draw_wrapped(
        draw,
        "A missing fact is treated neutrally, never guessed.",
        (105, y),
        font(INTER, 39, "Regular"),
        850,
        51,
    )
    y += 52
    draw_wrapped(
        draw,
        "The score surfaces risks early. The decision is always yours.",
        (105, y),
        font(BRICOLAGE, 54, "SemiBold"),
        850,
        60,
    )
    return image


def draw_trail_card(image: Image.Image) -> None:
    draw = ImageDraw.Draw(image)
    box = (638, 182, 975, 658)
    rounded_panel(draw, box, radius=22, fill=PAPER, outline=SAGE, width=5)

    photo_box = (653, 197, 960, 392)
    source = Image.open(REPO_ROOT / "images" / "lago-di-carezza.webp")
    image.paste(fit_crop(source, (photo_box[2] - photo_box[0], photo_box[3] - photo_box[1])), photo_box[:2])
    pill(draw, (674, 364), "MATCH FOR YOUR DOG", ACCENT, "#FFFFFF", font(INTER, 18, "Bold"), 14, 7)
    draw.text((674, 426), "Lago di Carezza Loop", font=font(BRICOLAGE, 26, "SemiBold"), fill=INK)
    draw.text((674, 473), "1.3 km  ·  20 m climb", font=font(INTER, 19, "Bold"), fill=SOFT_INK)
    draw.line((674, 516, 938, 516), fill=PAPER_LINE, width=2)
    draw.text((674, 542), "Shade", font=font(INTER, 18, "Regular"), fill=SOFT_INK)
    draw.text((900, 542), "70%", font=font(INTER, 18, "Bold"), fill=INK)
    draw.text((674, 579), "Water", font=font(INTER, 18, "Regular"), fill=SOFT_INK)
    draw.text((870, 579), "Mapped", font=font(INTER, 18, "Bold"), fill=INK)


def card_six(background: Image.Image) -> Image.Image:
    image = background.copy()
    draw = ImageDraw.Draw(image)
    draw_number(draw, 6)
    draw_spaced(draw, "FROM PROFILE TO TRAIL", (105, 108), font(INTER, 29, "Bold"))
    draw_trail_card(image)
    draw_wrapped(
        draw,
        "Search a valley or browse our collections. Compare distance, terrain, shade, water and the match for your dog.",
        (105, 248),
        font(INTER, 35, "Regular"),
        465,
        48,
    )
    y = draw_wrapped(
        draw,
        "Know the trail. Understand the match. Choose the walk that feels right for both of you.",
        (105, 738),
        font(BRICOLAGE, 65, "SemiBold"),
        860,
        70,
    )
    cta = "Start at app-orma.com  →"
    selected_font = font(INTER, 31, "Bold")
    width = draw.textbbox((0, 0), cta, font=selected_font)[2]
    draw.text((975 - width, min(y + 66, 1210)), cta, font=selected_font, fill=SAGE)
    return image


def build_preview(paths: list[Path]) -> None:
    thumb_size = (324, 405)
    gap = 18
    margin = 24
    preview = Image.new(
        "RGB",
        (margin * 2 + thumb_size[0] * 3 + gap * 2, margin * 2 + thumb_size[1] * 2 + gap),
        "#F3F1EC",
    )
    for index, path in enumerate(paths):
        card = Image.open(path).convert("RGB")
        card.thumbnail(thumb_size, Image.Resampling.LANCZOS)
        x = margin + (index % 3) * (thumb_size[0] + gap)
        y = margin + (index // 3) * (thumb_size[1] + gap)
        preview.paste(card, (x, y))
    preview.save(OUTPUT / "orma-how-it-works-sequence.png", quality=95)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    background = Image.open(BACKGROUND).convert("RGB")
    builders = [card_one, card_two, card_three, card_four, card_five, card_six]
    paths: list[Path] = []

    for number, builder in enumerate(builders, start=1):
        output_path = OUTPUT / f"orma-how-it-works-{number:02d}.png"
        builder(background).save(output_path, quality=95)
        paths.append(output_path)

    build_preview(paths)


if __name__ == "__main__":
    main()
