"""Clean ivy pieces from Verneuil's 'Lierre' plate (raw/lierre.png) for the border strips.
The big sterile-branch leaf runs off the plate on the left, so it is rebuilt by mirroring its complete right half."""
import sys
sys.path.insert(0, '/home/claude/site-rebuild/tools/nouveau')
from cutout import cutout, OUT
from PIL import Image, ImageDraw
from cutout import RAW

# cover the plate's panel rules and captions with a patch of clean paper (same grain, no hard edge)
import numpy as np
im = Image.open(RAW + 'lierre.png').convert('RGB'); d = ImageDraw.Draw(im)
patch = im.crop((1040, 780, 1100, 840))
def paper(r):
    x0, y0, x1, y1 = r
    for y in range(y0, y1, 60):
        for x in range(x0, x1, 60):
            im.paste(patch.crop((0, 0, min(60, x1 - x), min(60, y1 - y))), (x, y))
for r in [(855, 100, 884, 670), (855, 100, 1010, 180), (1340, 100, 1592, 180), (1560, 100, 1592, 1300), (855, 644, 1592, 670), (855, 490, 975, 630), (1352, 378, 1560, 440), (1358, 440, 1560, 470), (1428, 474, 1560, 510)]: paper(r)
# the panel rules cross the top leaf of the sprig: inside the leaf's span, inpaint those rows with its flat tint
a = np.asarray(im.convert('L'))
# the rules stop at the leaf's edge (the leaf is drawn over them): per column, replace the rule rows with paper only
# where the pixels just above and below the rule are paper too
px = im.load(); pp = patch.load()
def papery(c): return (c[0] + c[1] + c[2]) / 3 > 205
for y0, y1 in ((139, 146), (168, 177)):
    for x in range(1010, 1340):
        if papery(px[x, y0 - 2]) and papery(px[x, y1 + 2]):
            for y in range(y0, y1 + 1): px[x, y] = pp[x % 60, y % 60]
paper((1412, 477, 1431, 503))   # the 'r' of the caption, right of the stem
im.save(RAW + 'lierre-clean.png')
BG = [(216, 214, 200), (248, 248, 240)]  # panel paper, page margin

cutout('lierre-clean', (330, 690, 665, 1270), bg=BG, lo=14, hi=42, strip_rules=False, out='ivy-leaf-pointed')
cutout('lierre-clean', (488, 0, 884, 800), bg=BG, lo=14, hi=42, strip_rules=False, out='_bighalf')
cutout('lierre-clean', (890, 100, 1584, 660), bg=BG, lo=14, hi=42, strip_rules=False, out='ivy-sprig', fill=True, min_frac=0.3)
cutout('lierre-clean', (770, 820, 1090, 1050), bg=BG, lo=14, hi=42, strip_rules=False, out='ivy-berries', min_frac=0.2)
cutout('lierre-clean', (1130, 840, 1330, 1020), bg=BG, lo=14, hi=42, strip_rules=False, out='ivy-star', fill=True, min_frac=0.2)
cutout('lierre-clean', (1120, 985, 1584, 1290), bg=BG, lo=14, hi=42, strip_rules=False, out='ivy-umbels', fill=True, min_frac=0.3)

