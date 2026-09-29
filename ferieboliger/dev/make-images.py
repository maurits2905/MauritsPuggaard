"""Builds the web images in assets/img/ from the photos in assets/photos/.

Usage:  pip install pillow && python3 dev/make-images.py

Replace assets/photos/<id>-original.* with a new photo and adjust the crop
boxes below (left, top, right, bottom in pixels of the original).
"""
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
PHOTOS = ROOT / "assets" / "photos"
OUT = ROOT / "assets" / "img"

PROPERTIES = {
    "mallorca": {
        "src": "mallorca-original.webp",
        "wide": (240, 0, 1275, 548),      # house, mountains, no parked cars
        "portrait": (330, 0, 1010, 548),
        "grade": {"color": 1.06, "contrast": 1.04, "brightness": 1.01, "warm": 1.02},
    },
    "odde": {
        "src": "odde-original.webp",
        "wide": (400, 40, 1421, 600),     # both cabins, no bin or street-view marks
        "portrait": (400, 40, 1080, 600),
        "grade": {"color": 1.08, "contrast": 1.02, "brightness": 1.04, "warm": 1.03},
    },
}


def grade(im, g):
    im = ImageEnhance.Color(im).enhance(g["color"])
    im = ImageEnhance.Contrast(im).enhance(g["contrast"])
    im = ImageEnhance.Brightness(im).enhance(g["brightness"])
    r, gr, b = im.split()
    r = r.point(lambda v: min(255, int(v * g["warm"])))
    b = b.point(lambda v: int(v / g["warm"]))
    im = Image.merge("RGB", (r, gr, b))
    return im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=55, threshold=2))


def save(im, name, width=None, quality=84):
    if width and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    path = OUT / name
    im.save(path, "WEBP", quality=quality, method=6)
    print(f"{path.relative_to(ROOT)}  {im.width}x{im.height}  {path.stat().st_size // 1024} KB")
    return im


def cover(im, size):
    """Crop-to-fill like CSS object-fit: cover (centered)."""
    tw, th = size
    scale = max(tw / im.width, th / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    left = (im.width - tw) // 2
    top = (im.height - th) // 2
    return im.crop((left, top, left + tw, top + th))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    portraits = {}
    for pid, cfg in PROPERTIES.items():
        src = grade(Image.open(PHOTOS / cfg["src"]).convert("RGB"), cfg["grade"])
        wide = src.crop(cfg["wide"])
        portrait = src.crop(cfg["portrait"])
        save(wide, f"{pid}.webp")
        save(wide, f"{pid}-sm.webp", width=640, quality=80)
        save(portrait, f"{pid}-portrait.webp")
        portraits[pid] = portrait

    # Link preview (Open Graph) for SMS/WhatsApp/Messenger: the two houses side by side.
    og = Image.new("RGB", (1200, 630), (247, 243, 236))
    og.paste(cover(portraits["mallorca"], (597, 630)), (0, 0))
    og.paste(cover(portraits["odde"], (597, 630)), (603, 0))
    og.save(OUT / "og.jpg", "JPEG", quality=82, optimize=True, progressive=True)
    print("assets/img/og.jpg  1200x630")


if __name__ == "__main__":
    main()
