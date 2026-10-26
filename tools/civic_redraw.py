"""Redrawn Civic illustrations (same halftone-line idiom as make_civic_svg.py) for the subjects whose first
versions leaned on overlapping blocks: the clock, the path through trees, the door, the armchair and lamp,
the two chairs, the mirror, the tree with roots, the boat. Curves and single silhouettes, no stacked rectangles."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_civic_svg import svg, H, LINE, THIN, THICK, THICK4, OUT

def armchair(x, y, flip=False, scale=1.0):
    """One wing-back armchair as a single silhouette (back, arm, seat), seen from the side-front."""
    s = -1 if flip else 1
    g = f'<g transform="translate({x},{y}) scale({s * scale},{scale})">'
    body = ('M0,120 L0,24 Q0,8 16,8 L50,8 Q64,8 64,22 L64,58 L100,58 Q112,58 112,70 L112,120 Z')
    g += H(body, 'url(#h3)')
    # seat line and the arm's rolled edge, drawn as lines only
    g += f'<path d="M64,58 L64,96 Q64,100 70,100 L112,100" {LINE}/>'
    g += f'<path d="M12,100 L64,100" {THIN} opacity=".6"/>'
    g += f'<line x1="10" y1="120" x2="10" y2="134" {THICK}/><line x1="102" y1="120" x2="102" y2="134" {THICK}/>'
    return g + '</g>'

def clock():
    """A plain wall clock: bezel ring, sixty ticks, tapered hands. Time pressing on, quietly."""
    cx, cy = 150, 104
    b = f'<circle cx="{cx}" cy="{cy}" r="88" fill="url(#h2)"/><circle cx="{cx}" cy="{cy}" r="88" {LINE}/>'
    b += f'<circle cx="{cx}" cy="{cy}" r="78" fill="url(#h1)"/><circle cx="{cx}" cy="{cy}" r="78" {LINE}/>'
    for i in range(60):
        a = i * math.pi / 30; long = i % 5 == 0
        r1 = 64 if long else 70
        x1 = cx + r1 * math.cos(a); y1 = cy + r1 * math.sin(a); x2 = cx + 73 * math.cos(a); y2 = cy + 73 * math.sin(a)
        b += f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" {LINE if long else THIN}/>'
    # hour hand to ten, minute hand to two: tapered lozenges
    def hand(angle, length, width):
        a = math.radians(angle - 90); ux, uy = math.cos(a), math.sin(a); nx, ny = -uy, ux
        tip = (cx + ux * length, cy + uy * length); tail = (cx - ux * 14, cy - uy * 14)
        l = (cx + nx * width, cy + ny * width); r = (cx - nx * width, cy - ny * width)
        return f'<path d="M{tail[0]:.1f},{tail[1]:.1f} L{l[0]:.1f},{l[1]:.1f} L{tip[0]:.1f},{tip[1]:.1f} L{r[0]:.1f},{r[1]:.1f} Z" fill="currentColor"/>'
    b += hand(300, 44, 4.5) + hand(60, 62, 3.2)
    b += f'<circle cx="{cx}" cy="{cy}" r="5" fill="currentColor"/><circle cx="{cx}" cy="{cy}" r="2" fill="#fff" opacity=".6"/>'
    # hanging loop and a faint wall shadow
    b += f'<path d="M{cx-8},16 Q{cx},4 {cx+8},16" {LINE}/>'
    b += f'<ellipse cx="{cx+6}" cy="{cy+92}" rx="70" ry="5" fill="url(#h1)"/>'
    return svg(300, 206, b)

def path_trees():
    """A footpath curving away between rounded trees: the patterns we walk without seeing."""
    def tree(x, y, s):
        g = f'<g transform="translate({x},{y}) scale({s})">'
        g += f'<line x1="0" y1="0" x2="0" y2="40" {THICK}/>'
        canopy = 'M0,-64 Q22,-66 28,-46 Q50,-44 44,-20 Q52,-2 30,2 Q22,10 0,6 Q-22,10 -30,2 Q-52,-2 -44,-20 Q-50,-44 -28,-46 Q-22,-66 0,-64 Z'
        g += H(canopy, 'url(#h3)')
        g += f'<path d="M0,-20 L0,4 M-16,-30 L0,-14 M14,-38 L0,-22" {THIN} opacity=".7"/>'
        return g + '</g>'
    b = ''
    # far trees first, then the path, then the near trees, so nothing overlaps the wrong way
    b += tree(118, 92, 0.5) + tree(196, 88, 0.55)
    b += H('M66,188 C120,160 150,130 146,74 L158,74 C166,130 190,160 230,188 Z', 'url(#h2)')
    b += f'<path d="M118,156 Q146,150 174,156 M134,124 Q152,120 170,124" {THIN} opacity=".5"/>'
    b += tree(36, 128, 1.0) + tree(256, 124, 1.1)
    b += f'<rect x="0" y="186" width="300" height="8" fill="url(#h1)"/>'
    return svg(300, 200, b)

def door():
    """A door standing open onto light: the divorce page. Frame, the door swung toward us, light on the floor."""
    # the light spilling through, drawn first so the door sits on it
    b = f'<path d="M126,176 L150,60 L214,60 L254,176 Z" fill="url(#h1)"/>'
    # frame
    b += H('M96,176 L96,36 Q96,24 108,24 L204,24 Q216,24 216,36 L216,176 L206,176 L206,36 L106,36 L106,176 Z', 'url(#h4)')
    # the door, swung open toward the viewer (a trapezoid in perspective) with two recessed panels
    b += H('M106,36 L160,52 L160,196 L106,176 Z', 'url(#h3)')
    b += f'<path d="M116,54 L150,64 L150,104 L116,98 Z M116,112 L150,122 L150,176 L116,164 Z" {THIN}/>'
    b += f'<circle cx="150" cy="128" r="3.5" fill="currentColor"/>'
    # threshold shadow
    b += f'<rect x="80" y="176" width="190" height="8" fill="url(#h1)"/>'
    return svg(300, 204, b)

def lamp_chair():
    """A single armchair under a floor lamp: individual work."""
    # a soft pool of light under the shade, then the chair, then the lamp
    b = f'<ellipse cx="236" cy="120" rx="56" ry="60" fill="url(#h1)"/>'
    b += armchair(40, 40)
    b += f'<path d="M232,176 Q232,120 236,70" {THICK}/><path d="M200,176 L264,176" {THICK}/>'
    b += H('M212,70 L260,70 L272,40 L200,40 Z', 'url(#h3)')
    b += f'<rect x="20" y="174" width="270" height="8" fill="url(#h1)"/>'
    return svg(300, 190, b)

def chairs():
    """Two armchairs facing each other across a small table: couples work."""
    b = armchair(24, 30) + armchair(396, 30, flip=True)
    b += f'<ellipse cx="210" cy="120" rx="46" ry="11" fill="url(#h2)"/><ellipse cx="210" cy="120" rx="46" ry="11" {LINE}/>'
    b += f'<line x1="210" y1="131" x2="210" y2="160" {THICK}/><path d="M188,160 L232,160" {THICK}/>'
    b += H('M198,112 L201,98 L219,98 L222,112 Z', 'url(#h3)') + f'<path d="M222,101 Q232,103 224,110" {LINE}/>'
    b += f'<path d="M206,92 q4,-6 0,-12 M214,92 q4,-6 0,-12" {THIN} opacity=".7"/>'
    b += f'<rect x="0" y="160" width="420" height="10" fill="url(#h1)"/>'
    return svg(420, 176, b)

def mirror():
    """A standing oval mirror: looking at one's own part."""
    b = f'<ellipse cx="150" cy="92" rx="62" ry="80" fill="url(#h3)"/><ellipse cx="150" cy="92" rx="62" ry="80" {LINE}/>'
    b += f'<ellipse cx="150" cy="92" rx="50" ry="68" fill="url(#h1)"/><ellipse cx="150" cy="92" rx="50" ry="68" {LINE}/>'
    b += f'<path d="M122,58 Q134,36 160,32" {THIN} opacity=".7"/>'
    # pivot and stand
    b += f'<circle cx="88" cy="92" r="4" fill="currentColor"/><circle cx="212" cy="92" r="4" fill="currentColor"/>'
    b += f'<path d="M88,92 Q76,140 96,186 M212,92 Q224,140 204,186" {THICK}/>'
    b += f'<path d="M80,186 L112,186 M188,186 L220,186" {THICK}/>'
    b += f'<rect x="60" y="188" width="180" height="8" fill="url(#h1)"/>'
    return svg(300, 200, b)

def tree_roots():
    """A tree with its roots shown below the ground line: what lies under the surface."""
    canopy = 'M150,16 Q186,14 196,46 Q230,48 222,82 Q236,112 200,116 Q184,132 150,124 Q116,132 100,116 Q64,112 78,82 Q70,48 104,46 Q114,14 150,16 Z'
    b = H(canopy, 'url(#h3)')
    b += f'<path d="M150,124 L150,176" {THICK4}/>'
    b += f'<path d="M150,140 Q136,124 118,116 M150,150 Q164,126 184,122" {THIN} opacity=".7"/>'
    b += f'<path d="M20,176 L280,176" {LINE}/>'
    b += f'<path d="M146,176 Q120,186 84,190 Q70,192 60,200 M154,176 Q180,186 216,190 Q232,192 244,200 M150,176 Q150,190 136,200 M150,178 Q156,190 170,196" {LINE}/>'
    b += f'<path d="M110,188 Q100,186 96,180 M196,188 Q206,186 210,180" {THIN}/>'
    return svg(300, 206, b)

def boat():
    """A small sailboat on the water: will counseling rock the boat?"""
    b = H('M74,138 L226,138 Q214,166 180,168 L112,168 Q88,164 74,138 Z', 'url(#h3)')
    b += f'<line x1="148" y1="138" x2="148" y2="28" {THICK}/>'
    b += H('M152,34 Q210,70 206,132 L152,132 Z', 'url(#h2)')
    b += H('M144,52 Q104,84 110,132 L144,132 Z', 'url(#h1)')
    b += f'<path d="M20,160 q14,-10 28,0 t28,0 t28,0 t28,0 t28,0 t28,0 t28,0 t28,0 t28,0" {LINE}/>'
    b += f'<path d="M34,178 q14,-10 28,0 t28,0 t28,0 t28,0 t28,0 t28,0 t28,0 t28,0" {THIN} opacity=".6"/>'
    return svg(300, 196, b)

if __name__ == '__main__':
    for name, fn in [('clock', clock), ('path-trees', path_trees), ('door', door), ('lamp-chair', lamp_chair), ('chairs', chairs), ('mirror', mirror), ('tree-roots', tree_roots), ('boat', boat)]:
        (OUT / f'{name}.svg').write_text(fn())
    print('redrawn')
