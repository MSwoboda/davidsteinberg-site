"""Generate the Art Nouveau graphics for the Nouveau theme: vine strips, corner flourish,
stained glass arch, rosette divider. Pure geometry, no stock art."""
import math, random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'site' / 'assets' / 'nouveau'
OUT.mkdir(parents=True, exist_ok=True)

INK = '#3b4634'      # outline
STEM = '#6c7a5c'
LEAF_A = '#8e9c7f'
LEAF_B = '#6f7f63'
LEAF_C = '#a9b59b'
BERRY = '#b89a6a'
GLASS = {'sage': '#9fae92', 'moss': '#6d7d60', 'blue': '#93a9b6', 'rose': '#c7a69c', 'cream': '#ece5d1', 'brass': '#b8a06f'}
LEAD = '#4a4f41'


def leaf(cx, cy, angle, size, fill):
    """Ivy-like three-lobed leaf drawn with cubic curves, rotated by angle (deg)."""
    s = size
    d = (f"M0,0 C{-0.55*s},{-0.25*s} {-0.9*s},{-0.7*s} {-0.45*s},{-0.95*s} "
         f"C{-0.25*s},{-1.08*s} {-0.1*s},{-0.9*s} 0,{-1.15*s} "
         f"C{0.1*s},{-0.9*s} {0.25*s},{-1.08*s} {0.45*s},{-0.95*s} "
         f"C{0.9*s},{-0.7*s} {0.55*s},{-0.25*s} 0,0 Z")
    vein = f"M0,0 L0,{-0.95*s} M0,{-0.45*s} L{-0.4*s},{-0.75*s} M0,{-0.45*s} L{0.4*s},{-0.75*s}"
    return (f'<g transform="translate({cx:.1f},{cy:.1f}) rotate({angle:.1f})">'
            f'<path d="{d}" fill="{fill}" stroke="{INK}" stroke-width="1.1" stroke-linejoin="round"/>'
            f'<path d="{vein}" fill="none" stroke="{INK}" stroke-width="0.7" opacity="0.7"/></g>')


def tendril(cx, cy, angle, r):
    pts = []
    for i in range(0, 60):
        t = i / 59
        a = t * 2.6 * math.pi
        rad = r * (1 - t * 0.85)
        pts.append((rad * math.cos(a), rad * math.sin(a)))
    d = 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in pts)
    return f'<path transform="translate({cx:.1f},{cy:.1f}) rotate({angle})" d="{d}" fill="none" stroke="{STEM}" stroke-width="1.3" stroke-linecap="round"/>'


def berries(cx, cy):
    out = ''
    for dx, dy in [(0, 0), (6, 3), (-5, 5), (2, 8)]:
        out += f'<circle cx="{cx+dx:.1f}" cy="{cy+dy:.1f}" r="3.2" fill="{BERRY}" stroke="{INK}" stroke-width="0.9"/>'
    return out


def vine_strip(width=120, height=1200, seed=7, mirror=False):
    rnd = random.Random(seed)
    x0 = width * 0.42
    # stem: sinuous path from top to bottom, same x and tangent at both ends so it tiles vertically
    n = 6
    ys = [height * i / n for i in range(n + 1)]
    xs = [x0] + [x0 + rnd.choice([-1, 1]) * rnd.uniform(width * 0.14, width * 0.26) for _ in range(n - 1)] + [x0]
    d = f'M{xs[0]:.1f},{ys[0]:.1f}'
    for i in range(n):
        y1, y2 = ys[i], ys[i + 1]
        c = (y2 - y1) * 0.5
        d += f' C{xs[i]:.1f},{y1 + c:.1f} {xs[i+1]:.1f},{y2 - c:.1f} {xs[i+1]:.1f},{y2:.1f}'
    parts = [f'<path d="{d}" fill="none" stroke="{STEM}" stroke-width="3.2" stroke-linecap="round"/>',
             f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="0.8" opacity="0.5"/>']
    # sample points along the stem for leaves
    def point(t):
        seg = min(int(t * n), n - 1)
        u = t * n - seg
        y1, y2 = ys[seg], ys[seg + 1]
        c = (y2 - y1) * 0.5
        p0, p1, p2, p3 = (xs[seg], y1), (xs[seg], y1 + c), (xs[seg + 1], y2 - c), (xs[seg + 1], y2)
        x = (1-u)**3*p0[0] + 3*(1-u)**2*u*p1[0] + 3*(1-u)*u**2*p2[0] + u**3*p3[0]
        y = (1-u)**3*p0[1] + 3*(1-u)**2*u*p1[1] + 3*(1-u)*u**2*p2[1] + u**3*p3[1]
        dx = 3*(1-u)**2*(p1[0]-p0[0]) + 6*(1-u)*u*(p2[0]-p1[0]) + 3*u**2*(p3[0]-p2[0])
        dy = 3*(1-u)**2*(p1[1]-p0[1]) + 6*(1-u)*u*(p2[1]-p1[1]) + 3*u**2*(p3[1]-p2[1])
        return x, y, math.degrees(math.atan2(dy, dx))
    k = 0
    t = 0.02
    while t < 0.985:
        x, y, ang = point(t)
        side = 1 if k % 2 == 0 else -1
        size = rnd.uniform(22, 36)
        fill = [LEAF_A, LEAF_B, LEAF_C][k % 3]
        normal = ang + side * 90
        # side branch every third leaf: a short curved stem with two small leaves
        if k % 3 == 1:
            bx, by = x + 26 * math.cos(math.radians(normal)), y + 26 * math.sin(math.radians(normal)) + 10
            parts.append(f'<path d="M{x:.1f},{y:.1f} Q{(x+bx)/2:.1f},{(y+by)/2 - 12:.1f} {bx:.1f},{by:.1f}" fill="none" stroke="{STEM}" stroke-width="2"/>')
            parts.append(leaf(bx, by, normal + 90 + rnd.uniform(-20, 20), size * 0.7, LEAF_C if fill != LEAF_C else LEAF_A))
            mx, my = (x + bx) / 2, (y + by) / 2 - 6
            parts.append(leaf(mx, my, normal + 90 - side * 50, size * 0.55, LEAF_B))
        # main leaf: petiole then leaf, tip pointing outward
        lx, ly = x + side * 9 * math.cos(math.radians(ang + 90)), y + side * 9 * math.sin(math.radians(ang + 90))
        parts.append(f'<path d="M{x:.1f},{y:.1f} Q{(x+lx)/2 + side*3:.1f},{(y+ly)/2 - 4:.1f} {lx:.1f},{ly:.1f}" fill="none" stroke="{STEM}" stroke-width="1.8"/>')
        parts.append(leaf(lx, ly, normal + 90 + rnd.uniform(-30, 30), size, fill))
        if k % 5 == 2:
            parts.append(tendril(x - side * 8, y + 16, rnd.uniform(0, 360), 11))
        if k % 7 == 4:
            parts.append(berries(x + side * 16, y + 8))
        k += 1
        t += rnd.uniform(0.034, 0.05)
    g = ''.join(parts)
    if mirror:
        g = f'<g transform="translate({width},0) scale(-1,1)">{g}</g>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
            f'{g}</svg>')


def corner(size=220):
    """Whiplash flourish for a corner: two curling stems with leaves."""
    s = size
    d1 = f"M{0.1*s},{s} C{0.1*s},{0.55*s} {0.2*s},{0.2*s} {0.6*s},{0.12*s} C{0.8*s},{0.08*s} {0.95*s},{0.12*s} {s},{0.1*s}"
    d2 = f"M{0.12*s},{0.95*s} C{0.3*s},{0.6*s} {0.25*s},{0.35*s} {0.45*s},{0.3*s} C{0.6*s},{0.26*s} {0.62*s},{0.42*s} {0.5*s},{0.44*s}"
    parts = [f'<path d="{d1}" fill="none" stroke="{STEM}" stroke-width="3.4" stroke-linecap="round"/>',
             f'<path d="{d1}" fill="none" stroke="{INK}" stroke-width="0.8" opacity="0.5"/>',
             f'<path d="{d2}" fill="none" stroke="{STEM}" stroke-width="2.2" stroke-linecap="round"/>']
    parts.append(leaf(0.6*s, 0.12*s, 150, 24, LEAF_A))
    parts.append(leaf(0.82*s, 0.1*s, 20, 20, LEAF_B))
    parts.append(leaf(0.1*s, 0.62*s, -70, 22, LEAF_C))
    parts.append(leaf(0.14*s, 0.36*s, -100, 19, LEAF_A))
    parts.append(leaf(0.35*s, 0.22*s, 200, 17, LEAF_B))
    parts.append(tendril(0.5*s, 0.44*s, 0, 10))
    parts.append(berries(0.3*s, 0.16*s))
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{s}" height="{s}" viewBox="0 0 {s} {s}">{"".join(parts)}</svg>'


def glass_arch(w=360, h=220):
    """Stained glass arch: pointed arch window with lead came and glass panes."""
    cx = w / 2
    parts = []
    # outer arch path
    arch = f"M8,{h} L8,{h*0.55} C8,{h*0.2} {cx*0.5},6 {cx},6 C{cx*1.5},6 {w-8},{h*0.2} {w-8},{h*0.55} L{w-8},{h} Z"
    parts.append(f'<defs><clipPath id="arch"><path d="{arch}"/></clipPath>'
                 f'<linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>')
    parts.append(f'<g clip-path="url(#arch)">')
    # panes: radial fan at the top + vertical panels below
    cols = ['sage', 'blue', 'cream', 'rose', 'moss', 'cream', 'blue', 'sage']
    # bottom panels
    n = 6
    pw = (w - 16) / n
    for i in range(n):
        x = 8 + i * pw
        c = GLASS[cols[i % len(cols)]]
        parts.append(f'<rect x="{x:.1f}" y="{h*0.55:.1f}" width="{pw:.1f}" height="{h*0.45:.1f}" fill="{c}"/>')
        parts.append(f'<rect x="{x:.1f}" y="{h*0.55:.1f}" width="{pw:.1f}" height="{h*0.2:.1f}" fill="url(#sh)"/>')
    # fan panes
    m = 7
    for i in range(m):
        a0 = math.pi + i * math.pi / m
        a1 = a0 + math.pi / m
        r = w * 0.52
        x0, y0 = cx + r * math.cos(a0), h * 0.55 + r * math.sin(a0)
        x1, y1 = cx + r * math.cos(a1), h * 0.55 + r * math.sin(a1)
        c = GLASS[['moss', 'cream', 'blue', 'sage', 'rose', 'cream', 'sage'][i]]
        parts.append(f'<path d="M{cx},{h*0.55} L{x0:.1f},{y0:.1f} A{r},{r} 0 0 1 {x1:.1f},{y1:.1f} Z" fill="{c}"/>')
    # rosette center
    for i in range(8):
        a = i * math.pi / 4
        parts.append(f'<ellipse cx="{cx + 22*math.cos(a):.1f}" cy="{h*0.55 - 2 + 22*math.sin(a):.1f}" rx="10" ry="6" transform="rotate({math.degrees(a):.0f} {cx + 22*math.cos(a):.1f} {h*0.55 - 2 + 22*math.sin(a):.1f})" fill="{GLASS["rose"] if i%2 else GLASS["cream"]}" stroke="{LEAD}" stroke-width="1.6"/>')
    parts.append(f'<circle cx="{cx}" cy="{h*0.55-2}" r="9" fill="{GLASS["brass"]}" stroke="{LEAD}" stroke-width="1.6"/>')
    parts.append('</g>')
    # lead lines
    parts.append(f'<g clip-path="url(#arch)" fill="none" stroke="{LEAD}" stroke-width="2.4" stroke-linejoin="round">')
    parts.append(f'<path d="{arch}"/>')
    parts.append(f'<line x1="8" y1="{h*0.55}" x2="{w-8}" y2="{h*0.55}"/>')
    for i in range(1, n):
        x = 8 + i * pw
        parts.append(f'<line x1="{x:.1f}" y1="{h*0.55}" x2="{x:.1f}" y2="{h}"/>')
    for i in range(1, m):
        a = math.pi + i * math.pi / m
        parts.append(f'<line x1="{cx}" y1="{h*0.55}" x2="{cx + w*0.6*math.cos(a):.1f}" y2="{h*0.55 + w*0.6*math.sin(a):.1f}"/>')
    parts.append('</g>')
    parts.append(f'<path d="{arch}" fill="none" stroke="{LEAD}" stroke-width="4"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{"".join(parts)}</svg>'


def rosette(size=120):
    c = size / 2
    parts = [f'<circle cx="{c}" cy="{c}" r="{c-3}" fill="{GLASS["cream"]}" stroke="{LEAD}" stroke-width="2.2"/>']
    for i in range(12):
        a = i * math.pi / 6
        col = [GLASS['sage'], GLASS['blue'], GLASS['rose']][i % 3]
        x1, y1 = c + (c - 3) * math.cos(a), c + (c - 3) * math.sin(a)
        a2 = a + math.pi / 6
        x2, y2 = c + (c - 3) * math.cos(a2), c + (c - 3) * math.sin(a2)
        parts.append(f'<path d="M{c},{c} L{x1:.1f},{y1:.1f} A{c-3},{c-3} 0 0 1 {x2:.1f},{y2:.1f} Z" fill="{col}" stroke="{LEAD}" stroke-width="1.6"/>')
    parts.append(f'<circle cx="{c}" cy="{c}" r="{c*0.42}" fill="{GLASS["cream"]}" stroke="{LEAD}" stroke-width="2"/>')
    for i in range(6):
        a = i * math.pi / 3
        parts.append(f'<ellipse cx="{c + c*0.24*math.cos(a):.1f}" cy="{c + c*0.24*math.sin(a):.1f}" rx="{c*0.17:.1f}" ry="{c*0.1:.1f}" transform="rotate({math.degrees(a):.0f} {c + c*0.24*math.cos(a):.1f} {c + c*0.24*math.sin(a):.1f})" fill="{GLASS["moss"]}" stroke="{LEAD}" stroke-width="1.4"/>')
    parts.append(f'<circle cx="{c}" cy="{c}" r="{c*0.08}" fill="{GLASS["brass"]}" stroke="{LEAD}" stroke-width="1.4"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">{"".join(parts)}</svg>'


def rule(w=300):
    """Horizontal divider: thin double rule with a central bud."""
    parts = [f'<line x1="0" y1="10" x2="{w*0.44}" y2="10" stroke="{STEM}" stroke-width="1.4"/>',
             f'<line x1="{w*0.56}" y1="10" x2="{w}" y2="10" stroke="{STEM}" stroke-width="1.4"/>',
             f'<line x1="{w*0.1}" y1="14" x2="{w*0.42}" y2="14" stroke="{STEM}" stroke-width="0.7"/>',
             f'<line x1="{w*0.58}" y1="14" x2="{w*0.9}" y2="14" stroke="{STEM}" stroke-width="0.7"/>',
             leaf(w*0.47, 16, -70, 12, LEAF_A), leaf(w*0.53, 16, 70, 12, LEAF_B),
             f'<circle cx="{w*0.5}" cy="10" r="3.5" fill="{BERRY}" stroke="{INK}" stroke-width="0.9"/>']
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="24" viewBox="0 0 {w} 24">{"".join(parts)}</svg>'


(OUT / 'vine-left.svg').write_text(vine_strip())
(OUT / 'vine-right.svg').write_text(vine_strip(mirror=True, seed=11))
(OUT / 'corner.svg').write_text(corner())
(OUT / 'glass-arch.svg').write_text(glass_arch())
(OUT / 'rosette.svg').write_text(rosette())
(OUT / 'rule.svg').write_text(rule())
print('written', sorted(p.name for p in OUT.iterdir()))
