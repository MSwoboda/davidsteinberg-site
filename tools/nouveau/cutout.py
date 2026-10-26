"""Key the cream paper out of a chromolithograph crop and keep the main plant.
usage: cutout.py name [x0 y0 x1 y1] [--keep N] [--lo 14 --hi 46]
"""
import sys, json
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

RAW = '/home/claude/site-rebuild/tools/nouveau/raw/'
OUT = '/home/claude/site-rebuild/tools/nouveau/cut/'

def cutout(name, box=None, keep=1, lo=16, hi=48, min_frac=0.015, out=None, bg=None, fill=False, hole_d=15, strip_rules=True):
    im = Image.open(RAW + name + '.png').convert('RGB')
    if box: im = im.crop(box)
    a = np.asarray(im).astype(np.float32)
    # paper colour: median of the brightest 30% of pixels (robust to plant)
    flat = a.reshape(-1, 3); lum = flat.mean(1)
    if bg is None:
        bright = flat[lum > np.percentile(lum, 70)]
        bg = np.median(bright, 0)
    bgs = np.asarray(bg, dtype=np.float32).reshape(-1, 3)
    d = np.min(np.stack([np.sqrt(((a - b) ** 2).sum(2)) for b in bgs]), 0)
    bg = bgs[0]
    alpha = np.clip((d - lo) / (hi - lo), 0, 1)
    # erase long thin straight rules (the plate frame) first
    dark0 = alpha > 0.5
    thin0 = dark0 & ~ndi.binary_opening(dark0, structure=np.ones((5, 5)))
    rules = ndi.binary_opening(thin0, structure=np.ones((1, 70))) | ndi.binary_opening(thin0, structure=np.ones((70, 1)))
    rules = ndi.binary_dilation(rules, iterations=3) if strip_rules else np.zeros_like(dark0)
    alpha[rules] = 0; a[rules] = bg
    if fill:
        # outlined lithograph: fill closed outlines so pale interiors stay opaque
        outline = (a.mean(2) < 110)
        raw = np.pad(outline | (alpha > 0.6), 12)
        base = ndi.binary_closing(raw, iterations=2)[12:-12, 12:-12]
        filled = ndi.binary_fill_holes(np.pad(base, 12))[12:-12, 12:-12]
        holes = filled & ~base
        hl, hn = ndi.label(holes)
        if hn:
            means = ndi.mean(d, hl, range(1, hn + 1)); areas = ndi.sum(holes, hl, range(1, hn + 1))
            for i, (m, ar) in enumerate(zip(means, areas)):
                if m < hole_d and ar > 400: filled[hl == i + 1] = False
        alpha = np.maximum(alpha, filled.astype(np.float32))
    # erase long thin straight rules (the plate frame) before labelling
    dark = alpha > 0.5
    thick = ndi.binary_opening(dark, structure=np.ones((5, 5)))
    thin = dark & ~thick
    hl = ndi.binary_opening(thin, structure=np.ones((1, 70)))
    vl = ndi.binary_opening(thin, structure=np.ones((70, 1)))
    lines = ndi.binary_dilation(hl | vl, iterations=3) if strip_rules else np.zeros_like(dark)
    alpha[lines] = 0
    # drop faint paper grain
    mask = alpha > 0.5
    # remove thin straight frame lines: long components with tiny fill
    lab, n = ndi.label(mask)
    if n:
        sizes = ndi.sum(mask, lab, range(1, n + 1))
        objs = ndi.find_objects(lab)
        order = np.argsort(-sizes)
        biggest = sizes[order[0]]
        keepmask = np.zeros_like(mask)
        kept = 0
        for idx in order:
            sl = objs[idx]; h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
            fill = sizes[idx] / max(1, h * w)
            linelike = (max(h, w) > 0.5 * max(mask.shape)) and fill < 0.06
            if linelike: continue
            if sizes[idx] < min_frac * biggest and kept >= 1: continue
            keepmask |= (lab == idx + 1)
            kept += 1
            if kept >= keep: break
        # grow a little so soft edges survive
        keepmask = ndi.binary_dilation(keepmask, iterations=3)
        alpha = alpha * keepmask
    # soften the alpha edge slightly
    al = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    # un-premultiply the paper tint out of semi-transparent edge pixels
    rgb = a.copy()
    A = np.asarray(al).astype(np.float32) / 255
    A3 = A[..., None]
    rgb = np.where(A3 > 0.02, np.clip((a - bg * (1 - A3)) / np.maximum(A3, 0.02), 0, 255), a)
    res = Image.fromarray(np.dstack([rgb.astype(np.uint8), np.asarray(al)]), 'RGBA')
    bbox = al.getbbox()
    if bbox: res = res.crop(bbox)
    res.save(OUT + (out or name) + '.png')
    return res.size

if __name__ == '__main__':
    args = sys.argv[1:]; name = args[0]; box = None; kw = {}
    rest = args[1:]
    if len(rest) >= 4 and all(r.lstrip('-').isdigit() for r in rest[:4]):
        box = tuple(int(x) for x in rest[:4]); rest = rest[4:]
    while rest:
        k = rest.pop(0).lstrip('-'); v = rest.pop(0); kw[k] = float(v) if '.' in v else int(v)
    print(name, cutout(name, box, **kw))
