# Проверка разметки: рисует рамки зон из data/<page>.json поверх скриншота.
# python3 -I tools/boxes.py data/edit.json out.png [view-id]
import sys, json
from PIL import Image, ImageDraw
data = json.load(open(sys.argv[1]))
view = sys.argv[3] if len(sys.argv) > 3 else data['views'][0]['id']
v = next(x for x in data['views'] if x['id'] == view)
im = Image.open(v['image']).convert('RGB')
im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
d = ImageDraw.Draw(im)
for a in data['areas']:
    if a.get('view', data['views'][0]['id']) != view: continue
    x, y, w, h = [c * 2 for c in a['box']]
    col = (255, 140, 40) if a.get('kind') != 'panel' else (80, 200, 255)
    d.rectangle([x, y, x + w, y + h], outline=col, width=2)
    d.text((x + 3, y + 2), a['id'], fill=(255, 255, 0))
im.save(sys.argv[2])
