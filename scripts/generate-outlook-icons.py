#!/usr/bin/env python3
"""Generate the Outlook for Linux icon set.

The mark is a plain envelope, drawn here rather than shipped as a binary so it
stays reviewable and easy to restyle. It is deliberately generic: Microsoft's
Outlook logo is a trademark and is not reproduced. Swap OUTLOOK_BLUE or the
geometry below and re-run to restyle:

    python3 scripts/generate-outlook-icons.py

Writes app/assets/icons/ (app + tray icons) and build/icons/ (packaging).
"""
import os
from PIL import Image, ImageDraw

SS = 8  # supersample factor; downscaled with LANCZOS for clean edges
OUTLOOK_BLUE = (15, 108, 189, 255)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def envelope_mask(size, inset):
    """Alpha mask of a filled envelope: body rectangle with a V cut for the flap."""
    s = size * SS
    m = Image.new("L", (s, s), 0)
    d = ImageDraw.Draw(m)

    pad = s * inset
    w = s - 2 * pad
    # 3:2 body, vertically centred
    bh = w * 0.68
    x0, y0 = pad, (s - bh) / 2
    x1, y1 = s - pad, y0 + bh

    radius = max(1, int(w * 0.06))
    d.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=255)

    # The flap: a V cut out of the top face, thick enough to survive a 16px
    # downscale. Drawn as two erased strokes meeting at the centre.
    stroke = max(1, int(w * 0.075))
    apex = (s / 2, y0 + bh * 0.52)
    d.line([(x0 + stroke * 0.5, y0 + stroke * 0.5), apex], fill=0, width=stroke)
    d.line([apex, (x1 - stroke * 0.5, y0 + stroke * 0.5)], fill=0, width=stroke)

    return m.resize((size, size), Image.LANCZOS)


def app_icon(size):
    """Colour icon: white envelope on a rounded blue square."""
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=OUTLOOK_BLUE)
    img = img.resize((size, size), Image.LANCZOS)

    glyph = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    glyph.putalpha(envelope_mask(size, inset=0.22))
    img.alpha_composite(glyph)
    return img


def mono_icon(size, rgb):
    """Tray icon: solid single-colour envelope, transparent background."""
    img = Image.new("RGBA", (size, size), rgb + (255,))
    img.putalpha(envelope_mask(size, inset=0.10))
    return img


def main():
    assets = os.path.join(ROOT, "app", "assets", "icons")
    build = os.path.join(ROOT, "build", "icons")
    os.makedirs(assets, exist_ok=True)
    os.makedirs(build, exist_ok=True)

    written = []
    for size in (16, 96, 256):
        p = os.path.join(assets, f"icon-{size}x{size}.png")
        app_icon(size).save(p)
        written.append(p)

    for size in (16, 96):
        for name, rgb in (("dark", (0, 0, 0)), ("light", (255, 255, 255))):
            p = os.path.join(assets, f"icon-monochrome-{name}-{size}x{size}.png")
            mono_icon(size, rgb).save(p)
            written.append(p)

    for size in (16, 24, 32, 48, 64, 96, 128, 256, 512, 1024):
        p = os.path.join(build, f"{size}x{size}.png")
        app_icon(size).save(p)
        written.append(p)

    print(f"wrote {len(written)} icons")


if __name__ == "__main__":
    main()
