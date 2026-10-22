# Увеличенный фрагмент скриншота с сеткой координат — чтобы точно снимать рамки элементов.
# python3 -I tools/grid.py img/edit.webp X0 Y0 X1 Y1 out.png [масштаб=3]
import sys
from PIL import Image, ImageDraw
src, x0, y0, x1, y1, out = sys.argv[1], *map(int, sys.argv[2:6]), sys.argv[6]
k = int(sys.argv[7]) if len(sys.argv) > 7 else 3
im = Image.open(src).convert('RGB').crop((x0, y0, x1, y1)).resize(((x1 - x0) * k, (y1 - y0) * k), Image.NEAREST)
d = ImageDraw.Draw(im)
for x in range((x0 // 10 + 1) * 10, x1, 10):
    big = x % 50 == 0
    d.line([((x - x0) * k, 0), ((x - x0) * k, im.height)], fill=(255, 60, 60) if big else (90, 90, 0), width=1)
    if big: d.text(((x - x0) * k + 2, 2), str(x), fill=(255, 255, 0))
for y in range((y0 // 10 + 1) * 10, y1, 10):
    big = y % 50 == 0
    d.line([(0, (y - y0) * k), (im.width, (y - y0) * k)], fill=(255, 60, 60) if big else (90, 90, 0), width=1)
    if big: d.text((2, (y - y0) * k + 2), str(y), fill=(0, 255, 255))
im.save(out)
