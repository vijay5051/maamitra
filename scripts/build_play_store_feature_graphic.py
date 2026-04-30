"""
Build the Google Play Store feature graphic for MaaMitra.

Spec: 1024x500 PNG. Uses the real MaaMitra logo, brand-purple gradient,
headline + chips on the left, tilted phone preview on the right.

To avoid jaggies (esp. on the rotated phone and the rounded chips), the
whole composition is rendered at 2x and downscaled with LANCZOS at save.

Output: app screenshots/play_store/feature_graphic.png
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "app screenshots"
LOGO_PATH = ROOT / "assets" / "play-store" / "icon-512-clean-white.png"
OUT_PATH = SRC_DIR / "play_store" / "feature_graphic.png"
OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

# Final spec.
FINAL_W, FINAL_H = 1024, 500
# Supersample factor — render at SS×, downscale at the end.
SS = 2
W, H = FINAL_W * SS, FINAL_H * SS

PRIMARY      = (124, 58, 237)    # #7C3AED
PRIMARY_DEEP = (76, 29, 149)     # #4C1D95
PRIMARY_LITE = (196, 181, 253)   # #C4B5FD — readable on deep purple
WHITE        = (255, 255, 255)

STATUS_BAR_PX = 130
SAFARI_BAR_PX = 320

FONT_BOLD = "/System/Library/Fonts/Supplemental/Trebuchet MS Bold.ttf"
FONT_REG  = "/System/Library/Fonts/Supplemental/Trebuchet MS.ttf"


# -----------------------------------------------------------------------------
# Background
# -----------------------------------------------------------------------------
def diagonal_gradient(w: int, h: int,
                      a=PRIMARY_DEEP, b=PRIMARY) -> Image.Image:
    """Smooth diagonal two-stop gradient."""
    bg = Image.new("RGB", (w, h), a)
    px = bg.load()
    max_d = w + h
    for y in range(h):
        for x in range(w):
            t = (x + y) / max_d
            px[x, y] = (
                int(a[0] + (b[0] - a[0]) * t),
                int(a[1] + (b[1] - a[1]) * t),
                int(a[2] + (b[2] - a[2]) * t),
            )
    return bg


def add_blobs(canvas: Image.Image) -> None:
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    d.ellipse((-150 * SS, -200 * SS, 350 * SS, 300 * SS),
              fill=(255, 255, 255, 30))
    d.ellipse((W - 250 * SS, H - 220 * SS, W + 100 * SS, H + 80 * SS),
              fill=(255, 255, 255, 22))
    d.ellipse((W // 2 - 80 * SS, -120 * SS, W // 2 + 220 * SS, 160 * SS),
              fill=(*PRIMARY_LITE, 38))
    overlay = overlay.filter(ImageFilter.GaussianBlur(50 * SS))
    canvas.alpha_composite(overlay)


# -----------------------------------------------------------------------------
# Image helpers
# -----------------------------------------------------------------------------
def round_corners(img: Image.Image, radius: int) -> Image.Image:
    img = img.convert("RGBA")
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, img.size[0], img.size[1]), radius=radius, fill=255
    )
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def drop_shadow(img: Image.Image, offset=(0, 14), blur=28,
                shadow_color=(0, 0, 0, 170)) -> Image.Image:
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
        radius=40, fill=shadow_color,
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(img, (pad, pad))
    return canvas


def crop_phone(src_path: Path) -> Image.Image:
    im = Image.open(src_path).convert("RGB")
    w, h = im.size
    return im.crop((0, STATUS_BAR_PX, w, h - SAFARI_BAR_PX))


def load_logo_tile(target_size: int) -> Image.Image:
    """Load the real MaaMitra logo and present it inside a rounded white tile
    (Android app-icon style). The source PNG has an opaque white background
    that we don't want to strip (it would also erase white silhouettes inside
    the heart), so we just frame it cleanly instead."""
    tile = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    radius = int(target_size * 0.22)

    # White rounded base with a hairline border for crispness on purple bg.
    base = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    ImageDraw.Draw(base).rounded_rectangle(
        (0, 0, target_size, target_size),
        radius=radius, fill=(255, 255, 255, 255),
    )

    # Mask the logo to the rounded shape, then paste on top.
    if LOGO_PATH.exists():
        logo = Image.open(LOGO_PATH).convert("RGB").resize(
            (target_size, target_size), Image.LANCZOS,
        ).convert("RGBA")
        mask = Image.new("L", (target_size, target_size), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            (0, 0, target_size, target_size), radius=radius, fill=255,
        )
        base.paste(logo, (0, 0), mask)

    tile.alpha_composite(base)
    return tile


# -----------------------------------------------------------------------------
# Compose
# -----------------------------------------------------------------------------
def main() -> None:
    canvas = diagonal_gradient(W, H).convert("RGBA")
    add_blobs(canvas)
    draw = ImageDraw.Draw(canvas)

    # Type sizes (scaled by SS for supersampling).
    f_brand = ImageFont.truetype(FONT_BOLD, 36 * SS)
    f_head  = ImageFont.truetype(FONT_BOLD, 64 * SS)
    f_sub   = ImageFont.truetype(FONT_REG,  26 * SS)
    f_chip  = ImageFont.truetype(FONT_BOLD, 20 * SS)

    pad_x = 56 * SS

    # ---- Brand row: real logo + wordmark ----
    logo_size = 76 * SS
    logo = load_logo_tile(logo_size)
    canvas.alpha_composite(logo, (pad_x - 8 * SS, 50 * SS))
    draw.text((pad_x + logo_size, 76 * SS), "MaaMitra",
              font=f_brand, fill=WHITE)

    # ---- Headline ----
    head_y = 170 * SS
    draw.text((pad_x, head_y), "Motherhood,",
              font=f_head, fill=WHITE)
    draw.text((pad_x, head_y + 75 * SS), "made simpler.",
              font=f_head, fill=PRIMARY_LITE)

    # ---- Subhead ----
    sub = "Vaccines, milestones & a friend who answers."
    draw.text((pad_x, head_y + 165 * SS), sub,
              font=f_sub, fill=(255, 255, 255, 235))

    # ---- Chips ----
    chips = ["AI Assistant", "10+ Languages", "IAP-aligned"]
    cx = pad_x
    cy = head_y + 220 * SS
    for label in chips:
        tw = draw.textlength(label, font=f_chip)
        chip_w = int(tw + 28 * SS)
        chip_h = 38 * SS
        draw.rounded_rectangle(
            (cx, cy, cx + chip_w, cy + chip_h),
            radius=19 * SS, fill=(255, 255, 255, 240),
        )
        draw.text((cx + 14 * SS, cy + 7 * SS), label,
                  font=f_chip, fill=PRIMARY_DEEP)
        cx += chip_w + 12 * SS

    # ---- Phone preview (right, tilted) ----
    src = SRC_DIR / "IMG_2703.PNG"
    if src.exists():
        shot = crop_phone(src)
        target_w = 280 * SS
        ratio = target_w / shot.size[0]
        target_h = int(shot.size[1] * ratio)
        shot = shot.resize((target_w, target_h), Image.LANCZOS)
        shot = round_corners(shot, radius=32 * SS)

        # Subtle white bezel.
        bezel = Image.new("RGBA", shot.size, (0, 0, 0, 0))
        ImageDraw.Draw(bezel).rounded_rectangle(
            (0, 0, shot.size[0] - 1, shot.size[1] - 1),
            radius=32 * SS, outline=(255, 255, 255, 170), width=3 * SS,
        )
        shot.alpha_composite(bezel)

        framed = drop_shadow(shot, offset=(0, 18 * SS), blur=30 * SS)
        framed = framed.rotate(-8, resample=Image.BICUBIC, expand=True)

        # Anchor on right side; allow it to slip slightly off-canvas.
        rx = W - framed.size[0] + 80 * SS
        ry = (H - framed.size[1]) // 2 + 10 * SS
        canvas.alpha_composite(framed, (rx, ry))

    # ---- Downsample to spec ----
    final = canvas.convert("RGB").resize(
        (FINAL_W, FINAL_H), Image.LANCZOS
    )
    final.save(OUT_PATH, "PNG", optimize=True)
    print(f"wrote {OUT_PATH.relative_to(ROOT)} ({FINAL_W}x{FINAL_H}, "
          f"rendered at {W}x{H} then downsampled)")


if __name__ == "__main__":
    main()
