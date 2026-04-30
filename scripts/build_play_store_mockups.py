"""
Build Google Play Store screenshot mockups for MaaMitra.

Output: 1080x1920 PNGs in `app screenshots/play_store/`.

For each source iPhone screenshot we:
  1. Crop the iOS status bar (top) and the Safari/web-preview bar (bottom)
  2. Round the corners and drop-shadow it onto a branded gradient
  3. Add a bold tagline + supporting subtitle at the top
"""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "app screenshots"
OUT_DIR = SRC_DIR / "play_store"
OUT_DIR.mkdir(exist_ok=True)

# Final canvas (Play Store recommends 1080x1920 for phone screenshots).
W, H = 1080, 1920

# Brand palette (sourced from constants/Colors.ts).
PRIMARY = (124, 58, 237)        # #7C3AED
PRIMARY_DEEP = (76, 29, 149)    # #4C1D95
PRIMARY_SOFT = (245, 240, 255)  # #F5F0FF
INK = (24, 18, 43)              # near-black with a purple tint
WHITE = (255, 255, 255)

# Source screenshots are 1170x2532 (iPhone 13/14/15 Pro). The iOS status bar
# and the web-preview chrome at the bottom both need to go.
STATUS_BAR_PX = 130   # top — clock + signal + battery row
SAFARI_BAR_PX = 320   # bottom — back btn + URL bar + ••• menu

FONT_BOLD = "/System/Library/Fonts/Supplemental/Trebuchet MS Bold.ttf"
FONT_REG  = "/System/Library/Fonts/Supplemental/Trebuchet MS.ttf"


# -----------------------------------------------------------------------------
# Canvas helpers
# -----------------------------------------------------------------------------
def gradient_bg(width: int, height: int) -> Image.Image:
    """Vertical purple gradient — deep at the top, primary at the bottom."""
    bg = Image.new("RGB", (width, height), PRIMARY)
    top = PRIMARY_DEEP
    bot = PRIMARY
    for y in range(height):
        t = y / (height - 1)
        r = int(top[0] + (bot[0] - top[0]) * t)
        g = int(top[1] + (bot[1] - top[1]) * t)
        b = int(top[2] + (bot[2] - top[2]) * t)
        ImageDraw.Draw(bg).line([(0, y), (width, y)], fill=(r, g, b))
    return bg


def add_decorative_blobs(canvas: Image.Image) -> None:
    """Subtle soft circles for visual depth — drawn in-place."""
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    d.ellipse((-200, -200, 500, 500), fill=(255, 255, 255, 28))
    d.ellipse((W - 350, H - 600, W + 200, H - 100), fill=(255, 255, 255, 22))
    overlay = overlay.filter(ImageFilter.GaussianBlur(80))
    canvas.alpha_composite(overlay)


def round_corners(img: Image.Image, radius: int) -> Image.Image:
    """Return img with rounded corners (RGBA)."""
    img = img.convert("RGBA")
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, img.size[0], img.size[1]), radius=radius, fill=255
    )
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def drop_shadow(img: Image.Image, offset=(0, 30), blur=40,
                shadow_color=(0, 0, 0, 140)) -> Image.Image:
    """Return a new image (img + soft shadow) wider/taller to fit the blur."""
    pad = blur * 2
    canvas = Image.new(
        "RGBA",
        (img.size[0] + pad * 2, img.size[1] + pad * 2),
        (0, 0, 0, 0),
    )
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (pad + offset[0], pad + offset[1],
         pad + img.size[0] + offset[0], pad + img.size[1] + offset[1]),
        radius=60,
        fill=shadow_color,
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(img, (pad, pad))
    return canvas


# -----------------------------------------------------------------------------
# Text wrapping
# -----------------------------------------------------------------------------
def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont,
              max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    cur = ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=font) <= max_width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def draw_centered_text(draw: ImageDraw.ImageDraw, text: str,
                       font: ImageFont.ImageFont, y: int,
                       max_width: int, fill=WHITE, line_gap: int = 12) -> int:
    """Draw text centered at canvas width W. Returns the new y (below text)."""
    lines = wrap_text(draw, text, font, max_width)
    for line in lines:
        w = draw.textlength(line, font=font)
        draw.text(((W - w) / 2, y), line, font=font, fill=fill)
        ascent, descent = font.getmetrics()
        y += ascent + descent + line_gap
    return y


# -----------------------------------------------------------------------------
# Per-screenshot composition
# -----------------------------------------------------------------------------
def crop_phone(src_path: Path) -> Image.Image:
    """Strip iOS status bar + Safari preview chrome."""
    im = Image.open(src_path).convert("RGB")
    w, h = im.size
    return im.crop((0, STATUS_BAR_PX, w, h - SAFARI_BAR_PX))


def compose(src: Path, headline: str, subhead: str, out_name: str) -> None:
    canvas = gradient_bg(W, H).convert("RGBA")
    add_decorative_blobs(canvas)

    draw = ImageDraw.Draw(canvas)

    # --- copy block (top) ---
    f_head = ImageFont.truetype(FONT_BOLD, 78)
    f_sub  = ImageFont.truetype(FONT_REG,  38)

    y = 90
    y = draw_centered_text(draw, headline, f_head, y, max_width=W - 120,
                           fill=WHITE, line_gap=4)
    y += 20
    y = draw_centered_text(draw, subhead, f_sub, y, max_width=W - 180,
                           fill=(255, 255, 255, 220), line_gap=2)

    # --- phone screenshot (bottom) ---
    shot = crop_phone(src)
    target_w = 760
    ratio = target_w / shot.size[0]
    target_h = int(shot.size[1] * ratio)
    shot = shot.resize((target_w, target_h), Image.LANCZOS)
    shot = round_corners(shot, radius=60)

    # Hairline stroke for phone bezel feel.
    bezel = Image.new("RGBA", shot.size, (0, 0, 0, 0))
    ImageDraw.Draw(bezel).rounded_rectangle(
        (0, 0, shot.size[0] - 1, shot.size[1] - 1),
        radius=60, outline=(255, 255, 255, 150), width=4,
    )
    shot.alpha_composite(bezel)

    shot_with_shadow = drop_shadow(shot, offset=(0, 24), blur=50,
                                   shadow_color=(0, 0, 0, 170))

    # Anchor the phone roughly to the bottom of the canvas. Allow it to
    # overflow off the bottom edge if the cropped screenshot is tall.
    px = (W - shot_with_shadow.size[0]) // 2
    py = H - shot_with_shadow.size[1] + 80
    if py < y + 40:
        py = y + 40
    canvas.alpha_composite(shot_with_shadow, (px, py))

    out_path = OUT_DIR / out_name
    canvas.convert("RGB").save(out_path, "PNG", optimize=True)
    print(f"  wrote {out_path.relative_to(ROOT)}")


# -----------------------------------------------------------------------------
# Entrypoint
# -----------------------------------------------------------------------------
SCREENS = [
    # (source filename, headline, subheadline, output filename)
    ("IMG_2703.PNG",
     "Your daily co-pilot for motherhood",
     "Vaccines, milestones, mood, feeding — all in one calm dashboard.",
     "01_home.png"),
    ("IMG_2711.PNG",
     "Ask MaaMitra anything, anytime",
     "Trusted answers tailored to your baby's age — in seconds, not searches.",
     "02_ask.png"),
    ("IMG_2704.PNG",
     "Track every part of baby's health",
     "Vaccines, growth, teeth, foods and routine — gently organised for you.",
     "03_health.png"),
    ("IMG_2707.PNG",
     "Never miss a vaccine again",
     "Built on the IAP 2024 immunisation schedule — with smart reminders.",
     "04_vaccines.png"),
    ("IMG_2714.PNG",
     "Celebrate every little milestone",
     "From first laugh to first steps — track each child's journey separately.",
     "05_milestones.png"),
    ("IMG_2705.PNG",
     "A community that truly gets it",
     "Connect with mothers across India — ask, share, and grow together.",
     "06_community.png"),
    ("IMG_2706.PNG",
     "Care for yourself, mama",
     "Yoga, breathwork and postpartum recovery — because you matter too.",
     "07_wellness.png"),
    ("IMG_2713.PNG",
     "Speaks your language",
     "Hindi, English & 10+ Indian languages — type or talk, your way.",
     "08_languages.png"),
    # NOTE: keep wording as "10+ Indian languages" everywhere — standard.
]


def main() -> None:
    print(f"Generating {len(SCREENS)} Play Store mockups → {OUT_DIR}")
    for src, head, sub, out in SCREENS:
        src_path = SRC_DIR / src
        if not src_path.exists():
            print(f"  SKIP missing {src}")
            continue
        compose(src_path, head, sub, out)
    print("Done.")


if __name__ == "__main__":
    main()
