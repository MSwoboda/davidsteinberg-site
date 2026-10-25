"""Compose tileable 'overgrown ivy' strips from the Verneuil cutouts (flat litho style stems drawn to match)."""
import math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

CUT = '/home/claude/site-rebuild/tools/nouveau/cut/'
OUT = '/home/claude/site-rebuild/site/assets/nouveau/'
STEM = (142, 146, 100); EDGE = (48, 52, 28); STEM_LIGHT = (176, 180, 136)

def load(n): return Image.open(CUT + n + '.png').convert('RGBA')
PIECES = {k: load(k) for k in ['ivy-leaf-big', 'ivy-leaf-pointed', 'ivy-sprig', 'ivy-umbels', 'ivy-berries', 'ivy-umbel-single']}

def bezier(p0, p1, p2, p3, n=200):
    return [((1-t)**3*p0[0] + 3*(1-t)**2*t*p1[0] + 3*(1-t)*t**2*p2[0] + t**3*p3[0],
             (1-t)**3*p0[1] + 3*(1-t)**2*t*p1[1] + 3*(1-t)*t**2*p2[1] + t**3*p3[1]) for t in np.linspace(0, 1, n)]

def draw_stem(draw, pts, w0, w1, wrap_h=None):
    """Flat olive stem with dark outline, tapering from w0 to w1 along pts."""
    n = len(pts)
    for pass_ in ('edge', 'fill', 'light'):
        for i in range(n - 1):
            t = i / (n - 1); w = w0 + (w1 - w0) * t
            if pass_ == 'edge': ww, col = w + 4, EDGE
            elif pass_ == 'fill': ww, col = w, STEM
            else: ww, col = max(1, w * 0.3), STEM_LIGHT
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            if pass_ == 'light':
                # highlight offset to the left
                x0 -= w * 0.25; x1 -= w * 0.25
            for dy in ([0] if wrap_h is None else [0, wrap_h, -wrap_h]):
                draw.line([(x0, y0 + dy), (x1, y1 + dy)], fill=col, width=int(round(ww)))
                draw.ellipse([x1 - ww/2, y1 + dy - ww/2, x1 + ww/2, y1 + dy + ww/2], fill=col)

def place(canvas, piece, cx, cy, size, angle, flip=False, wrap_h=None, wrap_w=None):
    im = PIECES[piece]
    s = size / max(im.size); im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    im = im.rotate(angle, expand=True, resample=Image.BICUBIC)
    x = int(cx - im.width / 2); y = int(cy - im.height / 2)
    offs = [(0, 0)]
    if wrap_h: offs += [(0, wrap_h), (0, -wrap_h)]
    if wrap_w: offs += [(wrap_w, 0), (-wrap_w, 0)]
    for dx, dy in offs: canvas.alpha_composite(im, (x + dx, y + dy))

def vertical_strip(seed, W=370, H=2600, out='ivy-left.png', flip_all=False):
    rnd = random.Random(seed)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    # main stem: a wandering path from bottom to top, closing on itself for tiling
    xs = [W * 0.42 + rnd.uniform(-50, 50) for _ in range(9)]; xs[-1] = xs[0]
    ys = np.linspace(H, 0, len(xs))
    pts = []
    for i in range(len(xs) - 1):
        p0 = (xs[i], ys[i]); p3 = (xs[i+1], ys[i+1]); cp = (ys[i] - ys[i+1]) * 0.45
        p1 = (xs[i] + rnd.uniform(-70, 70), ys[i] - cp); p2 = (xs[i+1] + rnd.uniform(-70, 70), ys[i+1] + cp)
        pts += bezier(p0, p1, p2, p3, 80)
    # side tendrils + leaves placed along the stem (drawn stems first, leaves after)
    leaves = []
    k = 0; i = 30
    while i < len(pts) - 30:
        x, y = pts[i]
        side = 1 if (k % 2 == 0) else -1
        if flip_all: side = -side
        kind = rnd.choice(['big', 'big', 'big', 'pointed', 'pointed', 'berries', 'big', 'umbels', 'sprig', 'big', 'pointed'])
        reach = rnd.uniform(40, 105)
        ang = rnd.uniform(-40, 40)
        tip = (x + side * reach, y - rnd.uniform(20, 90))
        ctrl = (x + side * reach * 0.6, y + 10)
        tend = bezier((x, y), ctrl, (tip[0] - side * 25, tip[1] + 25), tip, 30)
        draw_stem(draw, tend, 10, 5, wrap_h=H)
        leaves.append((kind, tip, side, ang))
        i += rnd.randint(24, 42); k += 1
    draw_stem(draw, pts, 24, 13, wrap_h=H)
    for kind, (tx, ty), side, ang in leaves:
        if kind == 'big':
            place(canvas, 'ivy-leaf-big', tx + side * 30, ty - 45, rnd.uniform(160, 260), ang, flip=side < 0, wrap_h=H)
        elif kind == 'pointed':
            place(canvas, 'ivy-leaf-pointed', tx + side * 18, ty - 50, rnd.uniform(115, 180), ang + side * 20, flip=side < 0, wrap_h=H)
        elif kind == 'sprig':
            place(canvas, 'ivy-sprig', tx + side * 55, ty - 70, rnd.uniform(210, 290), ang + side * 15, flip=side > 0, wrap_h=H)
        elif kind == 'berries':
            place(canvas, 'ivy-berries', tx + side * 30, ty - 30, rnd.uniform(105, 135), ang, flip=side < 0, wrap_h=H)
        elif kind == 'umbels':
            place(canvas, 'ivy-umbel-single', tx + side * 25, ty - 30, rnd.uniform(85, 115), ang, flip=side < 0, wrap_h=H)
    canvas.save(OUT + out)
    return canvas.size

def horizontal_strip(seed, W=2600, H=370, out='ivy-top.png'):
    v = vertical_strip(seed, W=H, H=W, out='_tmp.png')
    im = Image.open(OUT + '_tmp.png').rotate(-90, expand=True)
    im.save(OUT + out); import os; os.remove(OUT + '_tmp.png')
    return im.size

if __name__ == '__main__':
    print(vertical_strip(7, out='ivy-left.png'))
    print(vertical_strip(23, out='ivy-right.png', flip_all=True))
    print(horizontal_strip(41, out='ivy-top.png'))
    v = vertical_strip(57, W=370, H=2600, out='_tmp.png', flip_all=True)
    im = Image.open(OUT + '_tmp.png').rotate(90, expand=True); im.save(OUT + 'ivy-bottom.png'); import os; os.remove(OUT + '_tmp.png'); print(im.size)
