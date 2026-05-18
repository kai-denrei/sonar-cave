#!/usr/bin/env python3
"""Generate Sonar Cave PWA icons. Solid black with a cyan radial 'ping' ring."""
from PIL import Image, ImageDraw
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

CYAN_BRIGHT = (90, 240, 255, 255)
CYAN_MID    = (63, 220, 239, 200)
CYAN_DIM    = (26, 138, 153, 120)
BLACK       = (0, 0, 0, 255)

def make(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new("RGBA", (size, size), BLACK)
    d = ImageDraw.Draw(img)
    cx, cy = size / 2, size / 2
    pad = size * 0.18 if maskable else size * 0.08
    # Three sonar rings, dim → bright
    rings = [
        (size * 0.46 - pad, 1, CYAN_DIM),
        (size * 0.32, 2, CYAN_MID),
        (size * 0.18, 2, CYAN_BRIGHT),
    ]
    for radius, width, color in rings:
        bbox = (cx - radius, cy - radius, cx + radius, cy + radius)
        # Approximate stroke width by drawing multiple ellipses
        w = max(1, int(size * 0.008 * width))
        for i in range(w):
            o = i - w // 2
            d.ellipse(
                (bbox[0] + o, bbox[1] + o, bbox[2] - o, bbox[3] - o),
                outline=color,
            )
    # Center dot (the sub)
    r = max(2, int(size * 0.03))
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=CYAN_BRIGHT)
    # Sweep wedge — a thin arc clockwise from 12
    d.pieslice(
        (cx - size * 0.46, cy - size * 0.46, cx + size * 0.46, cy + size * 0.46),
        start=-95, end=-75, fill=(90, 240, 255, 60),
    )
    return img

for name, size, mask in [
    ("icon-192.png", 192, False),
    ("icon-512.png", 512, False),
    ("maskable-512.png", 512, True),
]:
    img = make(size, mask)
    out_path = OUT / name
    img.save(out_path, "PNG", optimize=True)
    print(f"wrote {out_path} ({size}x{size})")
