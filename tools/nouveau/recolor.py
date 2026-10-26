"""Tone Thomé's bright chromolithograph greens down to the olive of Verneuil's plates so both sources read as one border."""
import sys, numpy as np
from PIL import Image
from cutout import OUT
def recolor(name, out=None, hue=-0.045, sat=0.48, val=0.93, gamma=1.08):
    im = Image.open(OUT + name + '.png').convert('RGBA'); a = im.split()[3]
    hsv = np.asarray(im.convert('RGB').convert('HSV')).astype(np.float32)
    green = hsv[..., 0] > 0.17 * 255          # shift only the greens; yellows (anthers, fruit) keep their hue
    hsv[..., 0] = np.where(green, (hsv[..., 0] + hue * 255) % 255, hsv[..., 0])
    hsv[..., 1] *= sat
    v = hsv[..., 2] / 255; v = (v ** gamma) * val; hsv[..., 2] = np.clip(v * 255, 0, 255)
    rgb = Image.fromarray(hsv.clip(0, 255).astype(np.uint8), 'HSV').convert('RGB')
    rgb.putalpha(a); rgb.save(OUT + (out or name) + '.png'); return rgb
if __name__ == '__main__':
    names = {'th-lobed': 'ivy-lobed', 'th-leaf-a': 'ivy-leaf-a', 'th-leaf-b': 'ivy-leaf-b', 'th-umbel': 'ivy-umbel-th',
             'th-berries': 'ivy-berries-th', 'th-flower': 'ivy-flower', 'th-fruit4': 'ivy-fruit4', 'th-fruit5': 'ivy-fruit5'}
    for n, o in names.items(): recolor(n, o)
