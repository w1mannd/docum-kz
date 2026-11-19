"""Вырезает телефон с картинки первого экрана: белый фон и тень на полу становятся прозрачными.
python hero_cut.py ВХОД.webp ВЫХОД.webp"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(np.float32)
L = a.mean(axis=2)
H, W = L.shape
# Экран телефона (найден при сборке картинки) — заливка фона внутрь не заходит.
quad = [(181, 77), (910, 138), (911, 1835), (181, 1861)]
m = Image.fromarray(np.where(L > 240, 255, 0).astype(np.uint8))
ImageDraw.Draw(m).polygon(quad, fill=0)
for seed in [(2, 2), (W - 3, 2), (2, H - 3), (W - 3, H - 3), (W // 2, H - 3), (2, H // 2), (W - 3, H // 2)]:
    if m.getpixel(seed) == 255:
        ImageDraw.floodfill(m, seed, 128)
bg = np.asarray(m) == 128
k = np.asarray(Image.fromarray((bg * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
# Под корпусом — тень и отражение: ниже нижней грани корпуса всё прозрачное.
cutv = np.full(W, 1840.0)
for x in range(W):
    col = L[1800:1970, x]
    d = np.where(col < 110)[0]
    if len(d):
        cutv[x] = 1800 + d.max() + 1
        continue
    d = np.where(col[:80] < 212)[0]
    if len(d):
        cutv[x] = 1800 + d.max() + 1
cutv = np.array([np.median(cutv[max(0, x - 1):x + 2]) for x in range(W)])
for x in range(0, 255):   # левый нижний угол корпуса — дуга радиусом 160 px
    cutv[x] = 1741.0 if x < 94 else 1741 + np.sqrt(max(0.0, 160 ** 2 - (x - 254) ** 2))
yy = np.arange(H)[:, None]
below = np.clip((yy - cutv[None, :]) / 2.0, 0, 1)
k = np.maximum(k, below)
alpha = np.clip((1 - k) * 255, 0, 255).astype(np.uint8)
rgba = np.dstack([a.astype(np.uint8), alpha])
Image.fromarray(rgba, 'RGBA').save(out, 'WEBP', quality=82, method=6)
print(out, 'прозрачно', round(float((alpha < 10).mean()), 3))
