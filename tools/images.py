"""Сборка изображений для site/assets из исходников в _src/ (папка не публикуется).

Запуск из корня проекта:  python tools/images.py
Исходники: фотографии Unsplash (см. ASSETS.md) и оригинальный логотип 1147 в brand/.
Скрипт нужен только при замене фото; сайт работает без него.
"""
from __future__ import annotations

import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "_src"
OUT = ROOT / "site" / "assets" / "img"
BRAND_OUT = ROOT / "site" / "assets" / "brand"
OUT.mkdir(parents=True, exist_ok=True)
BRAND_OUT.mkdir(parents=True, exist_ok=True)

# Unsplash (бесплатная лицензия Unsplash). id -> URL оригинала, см. ASSETS.md
SOURCES = {
    "u18": "https://unsplash.com/photos/sports-car-washing-in-garage-pRppMPh4Zho",
    "u1": "https://unsplash.com/photos/parked-black-car-HNCSCpWrVJA",
    "u4": "https://unsplash.com/photos/black-car-covered-in-soap-suds-during-wash-bCQSrcYghJI",
    "u12": "https://unsplash.com/photos/a-man-waxing-a-car-in-a-garage-CsZjHjFN3N8",
    "u8": "https://unsplash.com/photos/detailer-cleaning-the-dashboard-of-a-classic-car-5SmPnmCjwcU",
    "u14": "https://unsplash.com/photos/gray-microfiber-cloth-on-a-black-car-hood-Df9XCGX9Y2U",
    "u27": "https://unsplash.com/photos/a-man-working-on-a-tire-in-a-garage-9uHal2Dd9aE",
    "u21": "https://unsplash.com/photos/a-close-up-of-a-car-tire-on-a-wet-surface-m5g2IFRouCs",
    "u37": "https://unsplash.com/photos/red-sports-car-tmAynVA_ihE",
    "u39": "https://unsplash.com/photos/a-close-up-of-a-cars-headlight-in-the-dark-oqw8zg1wC78",
    "u6": "https://unsplash.com/photos/black-and-gray-car-interior-U4IaoKF5aj4",
    "u24": "https://unsplash.com/photos/the-interior-of-a-modern-car-with-leather-seats-jBL6jiMgwlM",
    "u50": "https://unsplash.com/photos/close-up-of-a-shiny-blue-car-body-with-reflections-6_Rv_qzog90",
    "u52": "https://unsplash.com/photos/close-up-of-a-classic-cars-shiny-black-fender-8ZW-P92HnnE",
    "u49": "https://unsplash.com/photos/close-up-of-a-shiny-brown-car-hood-lFDWY0SbTSA",
}


def load(name: str) -> Image.Image:
    return Image.open(SRC / f"{name}.jpg").convert("RGB")


def crop_aspect(img: Image.Image, aspect: float, cx: float = 0.5, cy: float = 0.5, scale: float = 1.0) -> Image.Image:
    """Наибольший кадр с нужным соотношением сторон, центрированный в (cx, cy)."""
    w, h = img.size
    if w / h > aspect:
        ch = h * scale
        cw = ch * aspect
    else:
        cw = w * scale
        ch = cw / aspect
    x0 = min(max(cx * w - cw / 2, 0), w - cw)
    y0 = min(max(cy * h - ch / 2, 0), h - ch)
    return img.crop((round(x0), round(y0), round(x0 + cw), round(y0 + ch)))


def save_variants(img: Image.Image, stem: str, widths: list[int], quality: int = 72, jpg_width: int | None = None) -> None:
    for w in widths:
        h = round(img.height * w / img.width)
        im = img.resize((w, h), Image.LANCZOS)
        im.save(OUT / f"{stem}-{w}.webp", "WEBP", quality=quality, method=6)
    if jpg_width:
        h = round(img.height * jpg_width / img.width)
        img.resize((jpg_width, h), Image.LANCZOS).save(OUT / f"{stem}-{jpg_width}.jpg", "JPEG", quality=76, optimize=True, progressive=True)


def retouch_glove(img: Image.Image) -> Image.Image:
    """Убирает надпись производителя перчаток на фото шиномонтажа (u27)."""
    img = img.copy()
    box = (1415, 790, 1585, 860)  # область надписи
    patch = img.crop((1290, 880, 1290 + (box[2] - box[0]), 880 + (box[3] - box[1])))
    mask = Image.new("L", patch.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((6, 6, patch.width - 6, patch.height - 6), radius=14, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(5))
    img.paste(patch, box[:2], mask)
    return img


def make_before(after: Image.Image, seed: int = 1147) -> Image.Image:
    """Иллюстрация «до»: матовость, голограммы и паутинка вокруг бликов, следы воды.

    Строится из того же кадра, поэтому ракурс и детали совпадают. На сайте пара подписана как иллюстрация.
    """
    rnd = random.Random(seed)
    w, h = after.size
    a = np.asarray(after).astype(np.float32)

    # Маска окрашенной поверхности (капот), пол справа не трогаем
    k = w / 700.0
    poly = [(0, 0), (330, 0), (470, 58), (548, 116), (566, 156), (548, 232), (470, 330), (402, 467), (0, 467)]
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).polygon([(x * k, y * k) for x, y in poly], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(4 * k))
    m = np.asarray(mask).astype(np.float32)[..., None] / 255.0

    # 1. Мутный лак: смягчённые отражения, приподнятый чёрный, меньше насыщенности
    soft = np.asarray(after.filter(ImageFilter.GaussianBlur(2.2 * k))).astype(np.float32)
    b = a * 0.35 + soft * 0.65
    lum = b.mean(axis=2, keepdims=True)
    b = lum + (b - lum) * 0.68
    b = b * 0.84 + 22.0

    # 2. Карта освещённости: царапины видны рядом с бликами
    lum_img = Image.fromarray(np.clip(a.mean(axis=2), 0, 255).astype(np.uint8))
    light = np.asarray(lum_img.filter(ImageFilter.GaussianBlur(40 * k))).astype(np.float32) / 255.0
    light = np.clip(light * 1.6 + 0.10, 0, 1)

    scratches = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(scratches)
    # центры «паутинки» — яркие блики на капоте (в координатах превью 700 px)
    centers = [(175, 425), (437, 200), (60, 230), (120, 205)]
    for cx, cy in centers:
        cx, cy = cx * k, cy * k
        for _ in range(900):
            r = rnd.uniform(6, 420) * k
            start = rnd.uniform(0, 360)
            span = rnd.uniform(8, 70)
            alpha = int(255 * min(1.0, 0.55 * math.exp(-r / (230 * k)) + rnd.uniform(0.04, 0.16)))
            d.arc((cx - r, cy - r, cx + r, cy + r), start, start + span, fill=alpha, width=1)
    # хаотичные дуги по всей поверхности
    for _ in range(1400):
        cx, cy = rnd.uniform(-200, 900) * k, rnd.uniform(-200, 700) * k
        r = rnd.uniform(40, 520) * k
        start = rnd.uniform(0, 360)
        span = rnd.uniform(3, 18)
        d.arc((cx - r, cy - r, cx + r, cy + r), start, start + span, fill=rnd.randint(40, 110), width=1)
    sc = np.asarray(scratches.filter(ImageFilter.GaussianBlur(0.6))).astype(np.float32)[..., None] / 255.0
    b = b + sc * light[..., None] * 150.0

    # 3. Следы высохших капель
    spots = Image.new("L", (w, h), 0)
    ds = ImageDraw.Draw(spots)
    for _ in range(170):
        x, y = rnd.uniform(0, 560) * k, rnd.uniform(0, 467) * k
        r = rnd.uniform(3, 11) * k
        ds.ellipse((x - r, y - r * rnd.uniform(0.7, 1.0), x + r, y + r), outline=rnd.randint(50, 90), width=max(1, int(k)))
        ds.ellipse((x - r * 0.7, y - r * 0.6, x + r * 0.7, y + r * 0.6), fill=rnd.randint(12, 26))
    sp = np.asarray(spots.filter(ImageFilter.GaussianBlur(1.0 * k))).astype(np.float32)[..., None] / 255.0
    b = b + sp * (60.0 + light[..., None] * 90.0)

    out = a * (1 - m) + b * m
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def build_photos() -> None:
    # Первый экран: ПК — широкий кадр, автомобиль справа; телефон — плотнее, точка внимания выше
    u18 = load("u18")
    desk = crop_aspect(u18, 1.15, cx=0.53, cy=0.55, scale=0.94)  # слева уходит в затемнение (CSS-маска)
    save_variants(desk, "hero-desktop", [1080, 1600], quality=64, jpg_width=1080)
    mob = crop_aspect(u18, 1.25, cx=0.585, cy=0.53, scale=0.82)  # без ведра на заднем плане
    save_variants(mob, "hero-mobile", [480, 800, 1080], quality=64, jpg_width=800)

    # Карточки услуг 4:3
    cards = {
        "card-wash": (load("u4"), 0.5, 0.52, 1.0),
        "card-complex": (load("u21"), 0.5, 0.60, 1.0),
        "card-polish": (load("u12"), 0.5, 0.42, 1.0),
        "card-protect": (load("u14"), 0.45, 0.5, 1.0),
        "card-interior": (load("u8"), 0.66, 0.5, 1.0),
        "card-tires": (retouch_glove(load("u27")), 0.58, 0.5, 1.0),
    }
    for stem, (img, cx, cy, sc) in cards.items():
        save_variants(crop_aspect(img, 4 / 3, cx, cy, sc), stem, [480, 800], quality=70)

    # Широкая полоса «Комплекс 1147»
    u1 = load("u1")
    save_variants(crop_aspect(u1, 2.0, 0.5, 0.655), "band-complex", [1280, 1920], quality=68)
    save_variants(crop_aspect(u1, 0.9, 0.5, 0.6, 1.0), "band-complex-m", [600, 900], quality=66)

    # Галерея: превью 4:3 и крупный вариант в исходной пропорции
    gallery = {"gal-optics": ("u37", 0.45, 0.45), "gal-optics-night": ("u39", 0.5, 0.30), "gal-interior": ("u6", 0.5, 0.55),
               "gal-leather": ("u24", 0.5, 0.5), "gal-paint": ("u50", 0.5, 0.45), "gal-fender": ("u52", 0.5, 0.5)}
    for stem, (src, cx, cy) in gallery.items():
        img = load(src)
        save_variants(crop_aspect(img, 4 / 3, cx, cy), stem, [480, 800], quality=70)
        big = img.copy()
        big.thumbnail((1600, 1600), Image.LANCZOS)
        big.save(OUT / f"{stem}-full.webp", "WEBP", quality=74, method=6)

    # Иллюстративная пара «до/после» (один кадр)
    after = crop_aspect(load("u49"), 3 / 2)
    before = make_before(after)
    save_variants(after, "ba-after", [800, 1400], quality=74)
    save_variants(before, "ba-before", [800, 1400], quality=74)


def build_brand() -> None:
    logo = Image.open(ROOT / "brand" / "logo-1147-original.png").convert("RGBA")
    logo = logo.crop(logo.getbbox())  # исходные пропорции, без полей
    side = max(logo.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(logo, ((side - logo.width) // 2, (side - logo.height) // 2), logo)
    for s in (96, 192, 384):
        im = sq.resize((s, s), Image.LANCZOS)
        im.save(BRAND_OUT / f"logo-1147-{s}.webp", "WEBP", quality=90, method=6)
    sq.resize((192, 192), Image.LANCZOS).save(BRAND_OUT / "logo-1147-192.png", optimize=True)
    # иконки: логотип на почти чёрном фоне
    for s, name in ((32, "favicon-32.png"), (180, "apple-touch-icon.png"), (512, "icon-512.png")):
        bg = Image.new("RGBA", (s, s), (10, 10, 10, 255))
        pad = round(s * 0.06)
        lg = sq.resize((s - 2 * pad, s - 2 * pad), Image.LANCZOS)
        bg.paste(lg, (pad, pad), lg)
        bg.convert("RGB").save(ROOT / "site" / name, optimize=True)
    # картинка для превью ссылки
    hero = Image.open(OUT / "hero-desktop-1080.jpg").convert("RGB")
    og = crop_aspect(hero, 1200 / 630, 0.6, 0.5).resize((1200, 630), Image.LANCZOS)
    shade = Image.linear_gradient("L").rotate(90).resize((1200, 630))
    og = Image.composite(og, Image.new("RGB", og.size, (10, 10, 10)), shade.point(lambda v: min(255, int(v * 1.4))))
    lg = sq.resize((260, 260), Image.LANCZOS)
    og.paste(lg, (70, 185), lg)
    og.save(OUT / "og-1147.jpg", "JPEG", quality=80, optimize=True)


if __name__ == "__main__":
    build_photos()
    build_brand()
    total = sum(p.stat().st_size for p in OUT.glob("*"))
    print(f"OK: {len(list(OUT.glob('*')))} файлов, {total / 1024:.0f} КБ в site/assets/img")
