"""Dithered vector decorations for the Civic theme: halftone-shaded line drawings, navy on transparent.
Subjects from the practice: two chairs facing each other, a window with a plant, a watering can and sprouts,
a footbridge. Each SVG uses currentColor so the theme can recolor it (navy by day, cream by night)."""
from pathlib import Path
import math

OUT = Path(__file__).resolve().parent.parent / 'site' / 'assets' / 'civic'
OUT.mkdir(parents=True, exist_ok=True)

def defs():
    """Halftone patterns at five densities. Dot grids are rotated 45deg like a print screen."""
    d = ''
    for i, r in enumerate([0.55, 0.9, 1.25, 1.6, 2.0], start=1):
        d += (f'<pattern id="h{i}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
              f'<circle cx="2.5" cy="2.5" r="{r}" fill="currentColor"/></pattern>')
    return '<defs>' + d + '</defs>'

LINE = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"'
THIN = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"'
THICK = 'fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"'
THICK4 = 'fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"'

def svg(w, h, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" '
            f'color="#2d3a50">{defs()}{body}</svg>')

def chairs():
    """Two armchairs facing each other across a small round table with a cup."""
    def chair(x, flip):
        s = -1 if flip else 1
        g = f'<g transform="translate({x},0) scale({s},1)">'
        # seat + back as rounded shapes, shaded with halftone
        g += f'<path d="M0,150 L0,95 Q0,85 10,85 L70,85 Q80,85 80,95 L80,150 Z" fill="url(#h3)"/>'
        g += f'<path d="M0,150 L0,95 Q0,85 10,85 L70,85 Q80,85 80,95 L80,150 Z" {LINE}/>'
        g += f'<rect x="4" y="40" width="34" height="60" rx="8" fill="url(#h4)"/><rect x="4" y="40" width="34" height="60" rx="8" {LINE}/>'
        g += f'<path d="M38,110 L96,110 Q104,110 104,118 L104,150 L38,150 Z" fill="url(#h2)"/><path d="M38,110 L96,110 Q104,110 104,118 L104,150 L38,150 Z" {LINE}/>'
        g += f'<rect x="38" y="100" width="66" height="14" rx="6" fill="url(#h1)"/><rect x="38" y="100" width="66" height="14" rx="6" {LINE}/>'
        g += f'<line x1="8" y1="150" x2="8" y2="166" {LINE}/><line x1="98" y1="150" x2="98" y2="166" {LINE}/>'
        return g + '</g>'
    body = chair(20, False) + chair(400, True)
    # table + cup
    body += f'<ellipse cx="210" cy="118" rx="52" ry="12" fill="url(#h2)"/><ellipse cx="210" cy="118" rx="52" ry="12" {LINE}/>'
    body += f'<line x1="210" y1="130" x2="210" y2="166" {LINE}/><path d="M184,166 L236,166" {LINE}/>'
    body += f'<path d="M196,110 L200,96 L220,96 L224,110 Z" fill="url(#h3)"/><path d="M196,110 L200,96 L220,96 L224,110 Z" {LINE}/>'
    body += f'<path d="M224,99 Q236,101 226,108" {LINE}/>'
    # steam
    body += f'<path d="M206,90 q4,-6 0,-12 M214,90 q4,-6 0,-12" {THIN} opacity=".7"/>'
    # floor shadow
    body += f'<rect x="0" y="166" width="420" height="10" fill="url(#h1)"/>'
    return svg(420, 180, body)

def window_plant():
    body = f'<rect x="40" y="10" width="200" height="150" rx="4" fill="url(#h1)"/>'
    body += f'<rect x="40" y="10" width="200" height="150" rx="4" {LINE}/>'
    body += f'<line x1="140" y1="10" x2="140" y2="160" {LINE}/><line x1="40" y1="85" x2="240" y2="85" {LINE}/>'
    # light wedge through the window
    body += f'<path d="M40,160 L240,160 L300,230 L0,230 Z" fill="url(#h2)" opacity=".8"/>'
    # sill
    body += f'<rect x="28" y="160" width="224" height="10" rx="2" fill="url(#h4)"/><rect x="28" y="160" width="224" height="10" rx="2" {LINE}/>'
    # pot
    body += f'<path d="M98,160 L104,120 L148,120 L154,160 Z" fill="url(#h4)"/><path d="M98,160 L104,120 L148,120 L154,160 Z" {LINE}/>'
    body += f'<rect x="100" y="112" width="52" height="10" rx="3" fill="url(#h3)"/><rect x="100" y="112" width="52" height="10" rx="3" {LINE}/>'
    # leaves
    for (x, y, a, s) in [(126, 112, -80, 1), (126, 112, -120, .9), (126, 112, -40, .9), (126, 112, -150, .7), (126, 112, -10, .7)]:
        body += (f'<path transform="translate({x},{y}) rotate({a}) scale({s})" d="M0,0 C20,-6 40,-6 60,0 C40,10 20,10 0,0 Z" fill="url(#h3)"/>'
                 f'<path transform="translate({x},{y}) rotate({a}) scale({s})" d="M0,0 C20,-6 40,-6 60,0 C40,10 20,10 0,0 Z M0,0 L60,0" {LINE}/>')
    return svg(300, 236, body)

def garden():
    body = ''
    # soil
    body += f'<path d="M0,150 Q150,138 300,150 L300,170 L0,170 Z" fill="url(#h4)"/><path d="M0,150 Q150,138 300,150" {LINE}/>'
    # sprouts of increasing size
    for i, (x, h) in enumerate([(40, 30), (90, 50), (140, 70), (190, 95)]):
        body += f'<path d="M{x},150 Q{x+2},{150-h/2} {x},{150-h}" {LINE}/>'
        for k in range(1, 3 + i // 2):
            y = 150 - h * k / (3 + i // 2) + 6
            for sgn in (-1, 1):
                body += (f'<path d="M{x},{y:.0f} q{sgn*14},{-10} {sgn*26},{-4} q{-sgn*12},{10} {-sgn*26},{4} Z" fill="url(#h2)"/>'
                         f'<path d="M{x},{y:.0f} q{sgn*14},{-10} {sgn*26},{-4} q{-sgn*12},{10} {-sgn*26},{4} Z" {LINE}/>')
    # watering can
    body += f'<path d="M226,146 L222,96 L286,96 L282,146 Z" fill="url(#h3)"/><path d="M226,146 L222,96 L286,96 L282,146 Z" {LINE}/>'
    body += f'<path d="M232,96 Q254,70 276,96" {LINE}/>'
    body += f'<path d="M222,104 L190,80 L186,88 L220,112" fill="url(#h4)"/><path d="M222,104 L190,80 L186,88 L220,112" {LINE}/>'
    body += f'<ellipse cx="186" cy="84" rx="6" ry="8" transform="rotate(-30 186 84)" fill="url(#h5)"/><ellipse cx="186" cy="84" rx="6" ry="8" transform="rotate(-30 186 84)" {LINE}/>'
    for (x, y) in [(176, 92), (170, 100), (178, 104), (166, 110), (172, 116)]:
        body += f'<circle cx="{x}" cy="{y}" r="1.6" fill="currentColor"/>'
    return svg(300, 176, body)

def bridge():
    body = ''
    # water
    for y in (150, 160, 170):
        body += f'<path d="M0,{y} q20,-6 40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0" {THIN} opacity=".75"/>'
    body += f'<rect x="0" y="146" width="320" height="34" fill="url(#h1)"/>'
    # banks
    body += f'<path d="M0,120 Q50,110 80,138 L80,180 L0,180 Z" fill="url(#h3)"/><path d="M0,120 Q50,110 80,138" {LINE}/>'
    body += f'<path d="M320,120 Q270,110 240,138 L240,180 L320,180 Z" fill="url(#h3)"/><path d="M320,120 Q270,110 240,138" {LINE}/>'
    # arch
    body += f'<path d="M70,130 Q160,60 250,130 L250,140 Q160,74 70,140 Z" fill="url(#h4)"/><path d="M70,130 Q160,60 250,130 M70,140 Q160,74 250,140" {LINE}/>'
    # deck + rail
    body += f'<path d="M60,112 Q160,46 260,112" {LINE}/>'
    for t in [0.12, 0.3, 0.5, 0.7, 0.88]:
        x = 60 + 200 * t
        yd = (1 - t) ** 2 * 112 + 2 * (1 - t) * t * 46 + t ** 2 * 112          # deck rail curve
        xa = 70 + 180 * t
        ya = (1 - t) ** 2 * 130 + 2 * (1 - t) * t * 60 + t ** 2 * 130          # arch top curve
        body += f'<line x1="{x:.0f}" y1="{yd:.0f}" x2="{xa:.0f}" y2="{ya:.0f}" {LINE}/>'
    # a sun
    body += f'<circle cx="262" cy="40" r="18" fill="url(#h2)"/><circle cx="262" cy="40" r="18" {LINE}/>'
    return svg(320, 180, body)

def ornament():
    """Small divider: a row of dots that thins out, like the halftone ramp."""
    body = ''
    for i in range(26):
        r = 2.2 * (1 - abs(i - 12.5) / 13) + 0.4
        body += f'<circle cx="{8 + i * 9}" cy="6" r="{r:.2f}" fill="currentColor"/>'
    return svg(250, 12, body)

(OUT / 'chairs.svg').write_text(chairs())
(OUT / 'window-plant.svg').write_text(window_plant())
(OUT / 'garden.svg').write_text(garden())
(OUT / 'bridge.svg').write_text(bridge())
(OUT / 'ornament.svg').write_text(ornament())
print('written', sorted(p.name for p in OUT.iterdir()))


# ---------- more subjects, so each article and each service has its own drawing ----------
def H(d, fill='url(#h3)'):
    return f'<path d="{d}" fill="{fill}"/><path d="{d}" {LINE}/>'

def lamp_chair():
    b = H('M30,170 L30,110 Q30,100 40,100 L100,100 Q110,100 110,110 L110,170 Z', 'url(#h3)')
    b += H('M40,100 L40,56 Q40,48 48,48 L92,48 Q100,48 100,56 L100,100 Z', 'url(#h4)')
    b += H('M10,118 L30,118 L30,170 L10,170 Z', 'url(#h2)') + H('M110,118 L130,118 L130,170 L110,170 Z', 'url(#h2)')
    b += f'<line x1="18" y1="170" x2="18" y2="184" {LINE}/><line x1="122" y1="170" x2="122" y2="184" {LINE}/>'
    # floor lamp
    b += f'<line x1="200" y1="184" x2="200" y2="70" {LINE}/>' + H('M170,184 L230,184 L224,176 L176,176 Z', 'url(#h4)')
    b += H('M160,70 L240,70 L224,24 L176,24 Z', 'url(#h2)')
    b += f'<path d="M150,100 L130,150 M250,100 L270,150" {THIN} opacity=".6"/>'
    b += f'<rect x="0" y="184" width="280" height="8" fill="url(#h1)"/>'
    return svg(280, 196, b)

def two_cups():
    b = ''
    for x, h in [(40, 'url(#h3)'), (160, 'url(#h2)')]:
        b += H(f'M{x},60 L{x+8},130 Q{x+10},140 {x+20},140 L{x+70},140 Q{x+80},140 {x+82},130 L{x+90},60 Z', h)
        b += f'<ellipse cx="{x+45}" cy="60" rx="45" ry="9" fill="url(#h1)"/><ellipse cx="{x+45}" cy="60" rx="45" ry="9" {LINE}/>'
        b += f'<path d="M{x+90},72 Q{x+120},78 {x+100},112" {LINE} /><path d="M{x+86},80 Q{x+108},84 {x+94},108" {LINE}/>'
        b += f'<path d="M{x+30},44 q4,-8 0,-16 M{x+45},40 q4,-8 0,-16 M{x+60},44 q4,-8 0,-16" {THIN} opacity=".7"/>'
    b += f'<rect x="0" y="140" width="300" height="10" fill="url(#h1)"/>'
    return svg(300, 160, b)

def path_trees():
    b = H('M120,180 Q150,120 100,80 Q80,60 140,20 L170,20 Q110,60 130,80 Q180,120 160,180 Z', 'url(#h2)')
    for cx, s_ in [(50, 1.0), (240, .85)]:
        b += f'<line x1="{cx}" y1="180" x2="{cx}" y2="{180-70*s_:.0f}" {THICK}/>'
        for i, r in enumerate([34, 28, 22]):
            b += H(f'M{cx-r*s_:.0f},{180-70*s_-i*22*s_:.0f} Q{cx},{180-70*s_-i*22*s_-r*s_*1.3:.0f} {cx+r*s_:.0f},{180-70*s_-i*22*s_:.0f} Z', ['url(#h4)', 'url(#h3)', 'url(#h2)'][i])
    b += f'<rect x="0" y="180" width="300" height="10" fill="url(#h1)"/>'
    return svg(300, 196, b)

def mirror():
    b = H('M70,150 Q70,30 140,30 Q210,30 210,150 Z', 'url(#h1)')
    b += f'<path d="M80,140 Q80,42 140,42 Q200,42 200,140" {THIN} opacity=".6"/>'
    b += H('M100,110 Q100,60 140,60 Q180,60 180,110 Z', 'url(#h2)')
    b += f'<path d="M96,70 L124,42" {THIN}/><path d="M104,70 L132,42" {THIN}/>'
    b += H('M60,150 L220,150 L212,164 L68,164 Z', 'url(#h4)')
    b += f'<line x1="140" y1="164" x2="140" y2="190" {LINE}/>' + H('M100,190 L180,190 L172,198 L108,198 Z', 'url(#h3)')
    return svg(280, 206, b)

def door():
    b = H('M60,30 L60,190 L150,190 L150,30 Z', 'url(#h4)')
    b += H('M150,190 L150,30 L210,12 L210,172 Z', 'url(#h2)')
    b += f'<circle cx="196" cy="98" r="4" fill="currentColor"/>'
    b += H('M150,190 L240,220 L300,220 L210,172 Z', 'url(#h1)')
    b += f'<rect x="0" y="190" width="300" height="10" fill="url(#h1)"/>'
    return svg(300, 226, b)

def tree_roots():
    b = f'<path d="M140,190 L140,96" {THICK4}/>'
    b += H('M140,110 Q70,110 70,60 Q90,20 140,24 Q190,20 210,60 Q210,110 140,110 Z', 'url(#h3)')
    b += H('M100,80 Q120,40 140,50 Q170,40 180,80 Q160,96 140,92 Q120,96 100,80 Z', 'url(#h2)')
    b += f'<path d="M140,190 Q110,200 70,206 M140,190 Q150,210 190,214 M140,190 Q130,214 100,224 M140,190 Q170,200 210,196" {LINE}/>'
    b += f'<path d="M0,190 q20,-5 40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0" {THIN} opacity=".5"/>'
    return svg(280, 230, b)

def bird_branch():
    b = f'<path d="M0,150 Q80,120 160,140 Q220,150 300,120" {THICK}/>'
    for (x, y, a) in [(60, 136, -30), (110, 128, 20), (220, 140, -20), (260, 128, 30)]:
        b += leafish(x, y, a)
    b += H('M150,130 Q150,100 180,100 Q206,100 204,126 Q200,140 176,140 Q156,140 150,130 Z', 'url(#h3)')
    b += H('M176,104 Q172,86 190,86 Q206,86 202,104 Z', 'url(#h2)')
    b += f'<path d="M202,96 L214,100 L202,103 Z" fill="currentColor"/><circle cx="194" cy="94" r="1.8" fill="currentColor"/>'
    b += f'<path d="M156,128 Q140,120 150,110" {THIN}/>'
    return svg(300, 180, b)

def leafish(x, y, a):
    return (f'<path transform="translate({x},{y}) rotate({a})" d="M0,0 C14,-10 30,-10 44,0 C30,10 14,10 0,0 Z" fill="url(#h2)"/>'
            f'<path transform="translate({x},{y}) rotate({a})" d="M0,0 C14,-10 30,-10 44,0 C30,10 14,10 0,0 Z M0,0 L44,0" {LINE}/>')

def boat():
    b = ''
    for y in (150, 162, 174):
        b += f'<path d="M0,{y} q20,-6 40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0" {THIN} opacity=".7"/>'
    b += H('M60,120 L240,120 Q230,156 150,156 Q70,156 60,120 Z', 'url(#h4)')
    b += f'<line x1="78" y1="128" x2="222" y2="128" {THIN}/>'
    b += f'<line x1="150" y1="120" x2="150" y2="34" {LINE}/>' + H('M150,36 L150,110 L216,110 Z', 'url(#h2)')
    b += f'<rect x="0" y="146" width="320" height="34" fill="url(#h1)"/>'
    return svg(320, 180, b)

def letter():
    b = H('M40,60 L240,60 L240,170 L40,170 Z', 'url(#h1)')
    b += H('M40,60 L140,130 L240,60 Z', 'url(#h2)')
    b += f'<path d="M40,170 L120,116 M240,170 L160,116" {LINE}/>'
    b += f'<circle cx="140" cy="126" r="8" fill="url(#h5)"/><circle cx="140" cy="126" r="8" {LINE}/>'
    return svg(280, 200, b)

def clock():
    b = f'<circle cx="140" cy="110" r="80" fill="url(#h1)"/><circle cx="140" cy="110" r="80" {LINE}/>'
    b += f'<circle cx="140" cy="110" r="68" fill="none" stroke="currentColor" stroke-width=".8" opacity=".5"/>'
    for i in range(12):
        import math as _m
        a = i * _m.pi / 6; x1 = 140 + 60 * _m.cos(a); y1 = 110 + 60 * _m.sin(a); x2 = 140 + 68 * _m.cos(a); y2 = 110 + 68 * _m.sin(a)
        b += f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" {LINE}/>'
    b += f'<line x1="140" y1="110" x2="140" y2="66" {THICK}/><line x1="140" y1="110" x2="176" y2="124" {THICK}/>'
    b += f'<circle cx="140" cy="110" r="4" fill="currentColor"/>'
    b += H('M100,36 L120,20 L136,34 Z', 'url(#h3)') + H('M180,36 L160,20 L144,34 Z', 'url(#h3)')
    return svg(280, 200, b)

def umbrella():
    b = H('M30,110 Q140,0 250,110 Z', 'url(#h3)')
    b += f'<path d="M30,110 Q58,92 86,110 Q113,92 140,110 Q167,92 194,110 Q222,92 250,110" {LINE}/>'
    b += f'<line x1="140" y1="110" x2="140" y2="184" {THICK}/><path d="M140,184 Q140,200 124,200 Q112,200 112,190" {THICK}/>'
    b += f'<line x1="140" y1="110" x2="140" y2="40" {LINE}/>'
    for (x, y) in [(20, 30), (40, 70), (260, 40), (240, 80), (270, 130), (16, 140)]:
        b += f'<line x1="{x}" y1="{y}" x2="{x-4}" y2="{y+14}" {THIN} opacity=".7"/>'
    return svg(280, 210, b)

def kettle():
    b = H('M60,170 Q50,100 100,86 L200,86 Q250,100 240,170 Z', 'url(#h3)')
    b += H('M100,86 Q150,50 200,86 Z', 'url(#h2)')
    b += f'<path d="M240,110 Q290,110 270,150 Q262,160 250,156" {THICK}/>'
    b += f'<path d="M100,86 Q150,20 200,86" {THICK}/>'
    b += f'<rect x="138" y="56" width="24" height="10" rx="4" fill="url(#h4)"/><rect x="138" y="56" width="24" height="10" rx="4" {LINE}/>'
    b += f'<path d="M262,96 q6,-10 0,-20 M276,98 q6,-10 0,-20" {THIN} opacity=".7"/>'
    b += f'<rect x="40" y="170" width="240" height="8" fill="url(#h1)"/>'
    return svg(300, 186, b)

def keys():
    b = ''
    for (x, y, a, f) in [(70, 70, 25, 'url(#h3)'), (150, 100, -15, 'url(#h2)')]:
        b += (f'<g transform="translate({x},{y}) rotate({a})"><circle cx="0" cy="0" r="26" fill="{f}"/><circle cx="0" cy="0" r="26" {LINE}/><circle cx="0" cy="0" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>'
              f'<rect x="24" y="-6" width="90" height="12" rx="3" fill="url(#h4)"/><rect x="24" y="-6" width="90" height="12" rx="3" {LINE}/>'
              f'<path d="M96,6 L96,20 L106,20 L106,6 M84,6 L84,16 L90,16 L90,6" {LINE}/></g>')
    return svg(280, 200, b)

def book_open():
    b = H('M20,160 Q80,140 140,160 L140,40 Q80,20 20,40 Z', 'url(#h2)')
    b += H('M260,160 Q200,140 140,160 L140,40 Q200,20 260,40 Z', 'url(#h1)')
    for y in (64, 84, 104, 124):
        b += f'<path d="M36,{y} Q84,{y-14} 124,{y}" {THIN}/><path d="M156,{y} Q196,{y-14} 244,{y}" {THIN}/>'
    b += f'<line x1="140" y1="40" x2="140" y2="160" {LINE}/>'
    b += H('M20,160 L140,160 L260,160 L252,174 L28,174 Z', 'url(#h4)')
    return svg(280, 190, b)

def house():
    b = H('M50,100 L150,30 L250,100 Z', 'url(#h4)')
    b += H('M70,100 L230,100 L230,190 L70,190 Z', 'url(#h2)')
    b += H('M130,190 L130,136 Q130,128 138,128 L162,128 Q170,128 170,136 L170,190 Z', 'url(#h4)')
    b += H('M90,120 L120,120 L120,150 L90,150 Z', 'url(#h1)') + H('M180,120 L210,120 L210,150 L180,150 Z', 'url(#h1)')
    b += f'<path d="M105,120 L105,150 M90,135 L120,135 M195,120 L195,150 M180,135 L210,135" {THIN}/>'
    b += f'<rect x="196" y="48" width="18" height="34" fill="url(#h3)"/><rect x="196" y="48" width="18" height="34" {LINE}/>'
    b += f'<path d="M205,44 q6,-12 0,-22" {THIN} opacity=".7"/>'
    b += f'<rect x="30" y="190" width="240" height="8" fill="url(#h1)"/>'
    return svg(300, 206, b)

def moon_window():
    b = H('M40,20 L240,20 L240,170 L40,170 Z', 'url(#h4)')
    b += f'<line x1="140" y1="20" x2="140" y2="170" {LINE}/><line x1="40" y1="95" x2="240" y2="95" {LINE}/>'
    b += f'<circle cx="190" cy="62" r="22" fill="url(#h1)"/><circle cx="190" cy="62" r="22" {LINE}/><circle cx="200" cy="56" r="18" fill="url(#h4)" stroke="none"/>'
    for (x, y) in [(70, 40), (100, 70), (60, 80), (160, 120), (210, 140)]:
        b += f'<circle cx="{x}" cy="{y}" r="1.8" fill="currentColor" opacity=".8"/>'
    b += H('M28,170 L252,170 L252,180 L28,180 Z', 'url(#h3)')
    b += H('M100,170 L104,150 L124,150 L128,170 Z', 'url(#h2)') + leafish(114, 150, -70) + leafish(114, 150, -110)
    return svg(280, 190, b)

def sunrise():
    b = f'<circle cx="160" cy="118" r="44" fill="url(#h2)"/><circle cx="160" cy="118" r="44" {LINE}/>'
    for i in range(7):
        import math as _m
        a = _m.pi + i * _m.pi / 6
        x1 = 160 + 56 * _m.cos(a); y1 = 118 + 56 * _m.sin(a); x2 = 160 + 74 * _m.cos(a); y2 = 118 + 74 * _m.sin(a)
        b += f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" {LINE}/>'
    b += H('M0,160 Q80,100 160,140 Q240,180 320,120 L320,190 L0,190 Z', 'url(#h4)')
    b += H('M0,190 Q100,150 200,172 Q260,184 320,160 L320,200 L0,200 Z', 'url(#h3)')
    b += f'<path d="M30,130 q6,-4 12,0 M250,96 q6,-4 12,0 M60,80 q6,-4 12,0" {THIN} opacity=".7"/>'
    return svg(320, 206, b)

for name, fn in [('sunrise', sunrise), ('lamp-chair', lamp_chair), ('two-cups', two_cups), ('path-trees', path_trees), ('mirror', mirror), ('door', door),
                 ('tree-roots', tree_roots), ('bird-branch', bird_branch), ('boat', boat), ('letter', letter), ('clock', clock),
                 ('umbrella', umbrella), ('kettle', kettle), ('keys', keys), ('book-open', book_open), ('house', house), ('moon-window', moon_window)]:
    (OUT / f'{name}.svg').write_text(fn())
print('extra written')

def laptop():
    """Open laptop with a video call: two figures on screen."""
    b = H('M60,30 L240,30 L240,150 L60,150 Z', 'url(#h4)')
    b += H('M70,40 L230,40 L230,140 L70,140 Z', 'url(#h1)')
    b += f'<line x1="150" y1="40" x2="150" y2="140" {THIN}/>'
    for cx in (110, 190):
        b += f'<circle cx="{cx}" cy="78" r="14" fill="url(#h3)"/><circle cx="{cx}" cy="78" r="14" {LINE}/>'
        b += H(f'M{cx-26},140 Q{cx-26},100 {cx},100 Q{cx+26},100 {cx+26},140 Z', 'url(#h2)')
    b += H('M30,150 L270,150 L280,166 L20,166 Z', 'url(#h3)')
    b += f'<rect x="130" y="152" width="40" height="5" rx="2" fill="url(#h1)"/><rect x="130" y="152" width="40" height="5" rx="2" {LINE}/>'
    b += f'<rect x="10" y="166" width="280" height="8" fill="url(#h1)"/>'
    return svg(300, 182, b)

def compass():
    """A compass rose: course, direction."""
    b = f'<circle cx="150" cy="100" r="80" fill="url(#h1)"/><circle cx="150" cy="100" r="80" {LINE}/>'
    b += f'<circle cx="150" cy="100" r="64" {THIN}/>'
    for i in range(24):
        a = i * math.pi / 12
        r1 = 72 if i % 6 else 60
        x1 = 150 + r1 * math.cos(a); y1 = 100 + r1 * math.sin(a); x2 = 150 + 78 * math.cos(a); y2 = 100 + 78 * math.sin(a)
        b += f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" {THIN}/>'
    b += H('M150,40 L162,100 L150,160 L138,100 Z', 'url(#h4)')
    b += H('M90,100 L150,88 L210,100 L150,112 Z', 'url(#h2)')
    b += f'<path d="M150,40 L162,100 L150,160 L138,100 Z M90,100 L150,88 L210,100 L150,112 Z" {LINE}/>'
    b += f'<circle cx="150" cy="100" r="7" fill="currentColor"/>'
    b += f'<text x="150" y="30" text-anchor="middle" font-family="serif" font-size="16" fill="currentColor">N</text>'
    return svg(300, 200, b)

def ledger():
    """A ledger book with a pen and two coins: fees."""
    b = H('M40,40 L200,40 L200,180 L40,180 Z', 'url(#h2)')
    b += H('M40,40 L60,40 L60,180 L40,180 Z', 'url(#h4)')
    for y in (70, 92, 114, 136, 158):
        b += f'<line x1="76" y1="{y}" x2="150" y2="{y}" {THIN}/><line x1="166" y1="{y}" x2="184" y2="{y}" {LINE}/>'
    b += f'<g transform="translate(236,40) rotate(20)"><rect x="-6" y="0" width="12" height="110" rx="3" fill="url(#h3)"/><rect x="-6" y="0" width="12" height="110" rx="3" {LINE}/><path d="M-6,110 L0,128 L6,110 Z" fill="currentColor"/><rect x="-6" y="0" width="12" height="16" rx="3" fill="url(#h4)"/></g>'
    b += f'<circle cx="236" cy="162" r="18" fill="url(#h3)"/><circle cx="236" cy="162" r="18" {LINE}/><circle cx="236" cy="162" r="10" {THIN}/>'
    b += f'<circle cx="262" cy="172" r="14" fill="url(#h2)"/><circle cx="262" cy="172" r="14" {LINE}/><circle cx="262" cy="172" r="7" {THIN}/>'
    b += f'<rect x="20" y="180" width="270" height="8" fill="url(#h1)"/>'
    return svg(300, 196, b)

def lock():
    """A padlock on a soft cushion of dots: privacy."""
    b = f'<path d="M100,96 L100,66 Q100,26 150,26 Q200,26 200,66 L200,96" {THICK4}/>'
    b += f'<path d="M116,96 L116,68 Q116,42 150,42 Q184,42 184,68 L184,96" fill="url(#h1)" stroke="none"/>'
    b += H('M70,96 L230,96 Q240,96 240,106 L240,180 Q240,190 230,190 L70,190 Q60,190 60,180 L60,106 Q60,96 70,96 Z', 'url(#h3)')
    b += f'<circle cx="150" cy="134" r="14" fill="url(#h1)"/><circle cx="150" cy="134" r="14" {LINE}/>'
    b += f'<path d="M144,146 L156,146 L160,168 L140,168 Z" fill="currentColor"/>'
    b += f'<rect x="40" y="190" width="220" height="8" fill="url(#h1)"/>'
    return svg(300, 206, b)

for name, fn in [('laptop', laptop), ('compass', compass), ('ledger', ledger), ('lock', lock)]:
    (OUT / f'{name}.svg').write_text(fn())
print('ported drawings written')
