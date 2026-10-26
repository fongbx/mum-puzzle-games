"""Draw the home-screen icons. Run: python3 scripts/make-icons.py"""

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "icons"
PINK = (255, 213, 226, 255)
CREAM = (255, 247, 244, 255)
BLUSH = (245, 168, 186, 255)
INK = (60, 42, 52, 255)
PETAL = (247, 183, 200, 255)
GOLD = (246, 217, 138, 255)
SHADOW = (243, 201, 212, 255)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(4))


def background(draw, size, rounded):
    top = (255, 214, 226, 255)
    bottom = (255, 232, 214, 255)
    for y in range(size):
        draw.line([(0, y), (size, y)], fill=lerp(top, bottom, y / max(1, size - 1)))
    if rounded:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.22), fill=255)
        return mask
    return None


def face(draw, size, scale):
    cx = cy = size / 2
    r = size * scale
    draw.ellipse((cx - r * 0.72, cy + r * 0.92, cx + r * 0.72, cy + r * 1.12), fill=SHADOW)
    draw.ellipse((cx - r, cy - r * 0.92, cx + r, cy + r * 1.05), fill=PINK)
    draw.ellipse((cx - r * 0.78, cy - r * 0.62, cx + r * 0.78, cy + r * 0.9), fill=CREAM)
    draw.ellipse((cx - r * 0.55, cy + r * 0.18, cx - r * 0.28, cy + r * 0.38), fill=BLUSH)
    draw.ellipse((cx + r * 0.28, cy + r * 0.18, cx + r * 0.55, cy + r * 0.38), fill=BLUSH)
    eye_w = max(2, r * 0.1)
    eye_h = max(2, r * 0.13)
    for dx in (-0.28, 0.28):
        draw.ellipse((cx + r * dx - eye_w, cy - r * 0.08 - eye_h, cx + r * dx + eye_w, cy - r * 0.08 + eye_h), fill=INK)
        dot = max(1, r * 0.035)
        draw.ellipse((cx + r * dx - r * 0.02, cy - r * 0.14, cx + r * dx - r * 0.02 + dot, cy - r * 0.14 + dot), fill=(255, 255, 255, 255))
    smile = max(2, int(size * 0.02))
    pts = []
    for i in range(16):
        t = (i / 15) * math.pi
        x = cx - math.cos(t) * r * 0.36
        y = cy + r * 0.22 + math.sin(t) * r * 0.2
        pts.append((x, y))
    draw.line(pts, fill=INK, width=smile, joint="curve")
    flower = r * 0.16
    fy = cy - r * 1.18
    draw.ellipse((cx - flower, fy - flower, cx + flower, fy + flower), fill=GOLD)
    for dx, dy in ((-0.22, -0.02), (0.22, -0.02), (0, -0.24)):
        draw.ellipse((cx + r * dx - flower * 0.8, fy + r * dy - flower * 0.8, cx + r * dx + flower * 0.8, fy + r * dy + flower * 0.8), fill=PETAL)


def render(size, rounded, scale):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    plate = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(plate)
    mask = background(draw, size, rounded)
    face(draw, size, scale)
    if mask is not None:
        img.paste(plate, (0, 0), mask)
        return img
    return plate


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    render(512, True, 0.30).save(OUT / "icon-512.png")
    render(192, True, 0.30).save(OUT / "icon-192.png")
    render(512, False, 0.24).save(OUT / "icon-maskable-512.png")
    render(192, False, 0.24).save(OUT / "icon-maskable-192.png")
    render(180, True, 0.30).save(OUT / "apple-touch-icon.png")
    render(32, True, 0.32).save(OUT / "favicon-32.png")
    print("wrote icons to", OUT)


if __name__ == "__main__":
    main()
