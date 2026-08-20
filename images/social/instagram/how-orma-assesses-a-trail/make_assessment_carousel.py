from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "export"
CAPTURES = ROOT / "ui-captures"
WELCOME = ROOT.parent / "welcome-to-orma"
BACKGROUND = WELCOME / "orma-bg.png"
BRICOLAGE = WELCOME / "fonts" / "BricolageGrotesque.ttf"
INTER = WELCOME / "fonts" / "Inter.ttf"

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


def paste_ui_crop(
    canvas: Image.Image,
    source: Image.Image,
    crop: tuple[int, int, int, int],
    destination: tuple[int, int, int, int],
    frame_width: int = 7,
) -> None:
    cropped = source.crop(crop).convert("RGB")
    x1, y1, x2, y2 = destination
    inner_w = x2 - x1 - frame_width * 2
    inner_h = y2 - y1 - frame_width * 2
    source_ratio = cropped.width / cropped.height
    target_ratio = inner_w / inner_h
    if source_ratio > target_ratio:
        resized_h = inner_h
        resized_w = round(resized_h * source_ratio)
        resized = cropped.resize((resized_w, resized_h), Image.Resampling.LANCZOS)
        left = (resized_w - inner_w) // 2
        fitted = resized.crop((left, 0, left + inner_w, inner_h))
    else:
        resized_w = inner_w
        resized_h = round(resized_w / source_ratio)
        resized = cropped.resize((resized_w, resized_h), Image.Resampling.LANCZOS)
        top = (resized_h - inner_h) // 2
        fitted = resized.crop((0, top, inner_w, top + inner_h))

    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle(destination, radius=10, fill=SAGE)
    canvas.paste(fitted, (x1 + frame_width, y1 + frame_width))


def card_one(background: Image.Image) -> Image.Image:
    image = background.copy()
    draw = ImageDraw.Draw(image)
    draw_number(draw, 1)
    draw_spaced(draw, "HOW ORMA ASSESSES A TRAIL", (105, 322), font(INTER, 27, "Bold"), spacing=5)
    y = draw_wrapped(
        draw,
        "Before a trail earns an ORMA score",
        (105, 410),
        font(BRICOLAGE, 78, "SemiBold"),
        850,
        82,
    )
    y += 44
    draw_wrapped(
        draw,
        "We look beyond distance and difficulty to understand what the route asks of a dog.",
        (105, y),
        font(INTER, 42, "Regular"),
        820,
        55,
    )
    return image


def card_two(background: Image.Image, trail_capture: Image.Image) -> Image.Image:
    image = background.copy()
    draw = ImageDraw.Draw(image)
    draw_number(draw, 2)
    draw_spaced(draw, "STEP ONE · THE MOUNTAIN", (105, 104), font(INTER, 28, "Bold"))
    paste_ui_crop(image, trail_capture, (0, 135, 810, 387), (105, 174, 975, 444))

    y = draw_wrapped(draw, "We assess the trail itself", (105, 500), font(BRICOLAGE, 70, "SemiBold"), 850, 74)
    y += 26
    y = draw_wrapped(
        draw,
        "Distance, ascent, terrain, exposure and recorded hazards establish the route's physical demands.",
        (105, y),
        font(INTER, 38, "Regular"),
        850,
        50,
    )
    y += 32
    draw_wrapped(
        draw,
        "Shade, water, heat risk and dog-access rules add the detail standard maps miss.",
        (105, y),
        font(BRICOLAGE, 48, "SemiBold"),
        850,
        55,
    )
    return image


def card_three(background: Image.Image, scoring_capture: Image.Image) -> Image.Image:
    image = background.copy()
    draw = ImageDraw.Draw(image)
    draw_number(draw, 3)
    draw_spaced(draw, "TWO SCORES, NEVER MIXED", (105, 104), font(INTER, 28, "Bold"))
    paste_ui_crop(image, scoring_capture, (284, 400, 996, 675), (105, 174, 975, 520))

    y = draw_wrapped(draw, "One rating for the mountain", (105, 585), font(BRICOLAGE, 68, "SemiBold"), 850, 72)
    y += 24
    y = draw_wrapped(
        draw,
        "Every trail is classified as Low-risk, Moderate or Caution. That judgement describes the route and stays the same for every dog.",
        (105, y),
        font(INTER, 37, "Regular"),
        850,
        49,
    )
    y += 30
    draw.text((105, y), "The personalised match comes next.", font=font(BRICOLAGE, 47, "SemiBold"), fill=CREAM)
    return image


def card_four(background: Image.Image, trail_capture: Image.Image) -> Image.Image:
    image = background.copy()
    draw = ImageDraw.Draw(image)
    draw_number(draw, 4)
    draw_spaced(draw, "STEP TWO · THE MATCH", (105, 104), font(INTER, 28, "Bold"))
    paste_ui_crop(image, trail_capture, (25, 409, 1256, 880), (105, 174, 975, 527))

    y = draw_wrapped(draw, "Then we ask who is walking", (105, 590), font(BRICOLAGE, 67, "SemiBold"), 850, 71)
    y += 25
    y = draw_wrapped(
        draw,
        "We compare the route with a dog's fitness, age, health and build.",
        (105, y),
        font(INTER, 39, "Regular"),
        850,
        51,
    )
    y += 30
    draw_wrapped(
        draw,
        "ORMA shows why it may fit, the cautions behind the score, and what still needs checking.",
        (105, y),
        font(BRICOLAGE, 47, "SemiBold"),
        850,
        54,
    )
    return image


def card_five(background: Image.Image, scoring_capture: Image.Image) -> Image.Image:
    image = background.copy()
    draw = ImageDraw.Draw(image)
    draw_number(draw, 5)
    draw_spaced(draw, "STEP THREE · OUR CONFIDENCE", (105, 104), font(INTER, 27, "Bold"), spacing=5)
    paste_ui_crop(image, scoring_capture, (284, 1245, 996, 1545), (105, 174, 975, 538))

    y = draw_wrapped(
        draw,
        "A score is only as good as its evidence",
        (105, 604),
        font(BRICOLAGE, 66, "SemiBold"),
        850,
        70,
    )
    y += 25
    y = draw_wrapped(
        draw,
        "Until a trail is verified, its match is capped at about 80%, no matter how perfect it looks.",
        (105, y),
        font(INTER, 38, "Regular"),
        850,
        50,
    )
    y += 32
    draw_wrapped(
        draw,
        "The missing points are our homework, not your dog's.",
        (105, y),
        font(BRICOLAGE, 48, "SemiBold"),
        850,
        55,
    )
    return image


def card_six(background: Image.Image, scoring_capture: Image.Image) -> Image.Image:
    image = background.copy()
    draw = ImageDraw.Draw(image)
    draw_number(draw, 6)
    draw_spaced(draw, "WHAT WE KNOW, WE LABEL", (105, 104), font(INTER, 28, "Bold"))
    paste_ui_crop(image, scoring_capture, (284, 1825, 996, 2188), (105, 174, 975, 566))

    y = draw_wrapped(
        draw,
        "Verified trails are walked, measured and reviewed by ORMA, with a dog. Imported routes remain clearly labelled until we have verified them.",
        (105, 625),
        font(INTER, 37, "Regular"),
        850,
        49,
    )
    y += 44
    y = draw_wrapped(
        draw,
        "The score surfaces risks early. The decision is always yours.",
        (105, y),
        font(BRICOLAGE, 56, "SemiBold"),
        850,
        62,
    )
    cta = "Read the methodology at app-orma.com  →"
    cta_font = font(INTER, 28, "Bold")
    width = draw.textbbox((0, 0), cta, font=cta_font)[2]
    draw.text((975 - width, min(y + 50, 1225)), cta, font=cta_font, fill=SAGE)
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
    preview.save(OUTPUT / "orma-assessment-sequence.png", quality=95)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    background = Image.open(BACKGROUND).convert("RGB")
    trail_capture = Image.open(CAPTURES / "trail-detail-full.png").convert("RGB")
    scoring_capture = Image.open(CAPTURES / "scoring-page-full.png").convert("RGB")
    builders = [
        lambda: card_one(background),
        lambda: card_two(background, trail_capture),
        lambda: card_three(background, scoring_capture),
        lambda: card_four(background, trail_capture),
        lambda: card_five(background, scoring_capture),
        lambda: card_six(background, scoring_capture),
    ]
    paths: list[Path] = []
    for number, builder in enumerate(builders, start=1):
        output_path = OUTPUT / f"orma-assessment-{number:02d}.png"
        builder().save(output_path, quality=95)
        paths.append(output_path)
    build_preview(paths)


if __name__ == "__main__":
    main()
