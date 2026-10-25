"""Align the Sage concept (site/sage) with Civic: photos in the slots, one CTA per page, Resources page
with search and subject pills, full article text from content.json, static map, 988 note, no portal links."""
import re, html, json, shutil
from pathlib import Path
root = Path(__file__).resolve().parent.parent
sage = root / 'site' / 'sage'
h = (sage / 'index.html').read_text()
C = json.load(open(root / 'content' / 'content.json'))

# ---------- A. photos into the slots (each photo once) ----------
photos = ['couch-couple', 'street-couple', 'reading-mug', 'stairs-couple', 'park-walk', 'forest-breath', 'couch-two-women', 'stretch-mat', 'couch-laptop', 'therapist-chairs', 'talk-at-table']
alts = ['A couple on a sofa, talking', 'A couple walking, hands held', 'A person reading by a window', 'A couple on a staircase, a little apart', 'A person walking alone under autumn trees', 'A person breathing calmly in a forest', 'Two women on a couch, talking', 'A person in a gentle stretch', 'A couple at a table with a laptop', 'A therapist and a client in conversation', 'Two people talking across a table']
slots = list(re.finditer(r'<div class="img-slot[^"]*"[^>]*>.*?</div>', h, re.S))
assert len(slots) == 11, len(slots)
for m, p, a in reversed(list(zip(slots, photos, alts))):
    h = h[:m.start()] + f'<img class="photo-slot" src="../assets/photos/{p}.jpg" alt="{a}" loading="lazy">' + h[m.end():]

# ---------- B. one CTA per inner page; home keeps hero + closing ----------
pages = list(re.finditer(r'<section class="page" id="([^"]+)"', h))
bounds = [(m.group(1), m.start()) for m in pages] + [('__footer', h.find('<footer'))]
def rebuild(fn):
    global h, bounds
    out = h[:bounds[0][1]]
    for (pid, s), (_, e) in zip(bounds, bounds[1:]):
        out += fn(pid, h[s:e])
    out += h[bounds[-1][1]:]
    h = out
    pages2 = list(re.finditer(r'<section class="page" id="([^"]+)"', h))
    bounds = [(m.group(1), m.start()) for m in pages2] + [('__footer', h.find('<footer'))]

CTA = re.compile(r'<(a|div) class="btn[^"]*"[^>]*href="#contact"[^>]*>[^<]*</a>|<div class="btn-row"[^>]*>\s*<a class="btn[^"]*" href="#contact">[^<]*</a>\s*</div>', re.S)
def trim_ctas(pid, body):
    if pid == 'home':
        hits = list(CTA.finditer(body))
        if len(hits) > 2:
            for m in reversed(hits[1:-1]): body = body[:m.start()] + body[m.end():]
        return body
    # drop the "Start with a free call" side card entirely
    body = re.sub(r'<div class="side-card soft">\s*<h3>Start with a free call</h3>.*?</div>\s*', '', body, flags=re.S)
    hits = list(CTA.finditer(body))
    if len(hits) > 1:
        for m in reversed(hits[:-1]): body = body[:m.start()] + body[m.end():]
    return body
rebuild(trim_ctas)

# ---------- C. articles -> resources; full text ----------
amap = {'art-emotional-clarity': 'the-benefits-of-emotional-clarity-in-your-relationship', 'art-three-mistakes': '3-deadly-relationship-killing-mistakes',
        'art-blindspots': 'relationship-blindspots-whats-your-relational-template', 'art-partner-power': 'your-partner-has-a-lot-of-power-over-your-capacity-to-evolve-as-a-person',
        'art-rage': 'rage-is-the-new-hurt', 'art-infidelity': 'infidelity-crisis-opportunity-growth-philadelphia-counseling', 'art-being-real': 'being-real-is-the-key-to-lasting-love',
        'art-thrive': 'what-really-makes-a-marriage-thrive', 'art-worse': 'will-marriage-counseling-make-your-marriage-worse', 'art-relationship-with-yourself': 'relationship-with-yourself', 'art-covid': 'covid-19-and-stress'}
arts = {a['id']: a for a in C['articles']}
smap = {'couples': 'couples-counseling', 'marriage': 'marriage-counseling', 'relationship': 'relationship-counseling', 'divorce': 'divorce-recovery', 'anxiety': 'anxiety-treatment', 'trauma': 'trauma-recovery', 'emotional-body': 'emotional-body-healing', 'supervision': 'supervision', 'individual': 'services'}
def fix_links(html):
    def rep(m):
        href = m.group(1)
        if 'request-a-consultation' in href or 'schedule-an-appointment' in href: return '<a href="#contact">'
        if 'about-david' in href: return '<a href="#about">'
        for s in C['services']:
            if any(href.rstrip('/') == u.rstrip('/') or href.rstrip('/') == u.replace('https://davidsteinberg.com', '').rstrip('/') for u in [s['original_url']] + s.get('aliases', []) if u):
                return f'<a href="#{smap.get(s["id"], "services")}">'
        for sid, cid in amap.items():
            a = arts[cid]
            if any(href.rstrip('/') == u.rstrip('/') or href.rstrip('/') == u.replace('https://davidsteinberg.com', '').rstrip('/') for u in [a['original_url']] + a.get('aliases', [])):
                return f'<a href="#{sid}">'
        return '<a>'
    html = re.sub(r'<a href="([^"]*)">', rep, html)
    html = re.sub(r'<a>(.*?)</a>', r'\1', html, flags=re.S)
    return html
def fill_article(pid, body):
    if pid not in amap: return body
    a = arts[amap[pid]]
    content = fix_links(a['content_html'])
    content = re.sub(r'<h1>.*?</h1>\s*', '', content, flags=re.S)
    body = re.sub(r'(<p class="muted">By David Steinberg, PhD, LCSW[^<]*</p>).*?(<div class="author-box">)', lambda m: m.group(1) + f'\n    <p class="muted small">{a["read_minutes"]} min read · {a["category"]}</p>\n' + content + '\n    ' + m.group(2), body, flags=re.S)
    return body
rebuild(fill_article)

# resources page
def resources(pid, body):
    if pid != 'articles': return body
    body = body.replace('data-title="Articles"', 'data-title="Resources"').replace('<div class="eyebrow">Articles</div>', '<div class="eyebrow">Resources</div>')
    body = body.replace('<h1>Articles on relationships and healing</h1>', '<h1>Resources</h1>')
    body = body.replace('Written by David Steinberg, PhD, LCSW. Each article answers one question a couple or an individual brings into the office.', 'Short essays on relationships, anxiety, and the work of staying close. Search, or pick a subject.')
    body = re.sub(r'<div class="note">Migration note:.*?</div>\s*', '', body, flags=re.S)
    cats = sorted(set(re.findall(r'<span class="tag">([^<]+)</span>', body)))
    toolbar = ('<div class="res-toolbar"><label class="res-search"><span class="sr-only">Search essays</span><input type="search" id="sage-res-search" placeholder="Search essays" autocomplete="off"></label>'
               '<div class="res-pills" role="group" aria-label="Subject"><button type="button" class="res-pill" aria-pressed="true" data-cat="All">All</button>'
               + ''.join(f'<button type="button" class="res-pill" aria-pressed="false" data-cat="{c}">{c}</button>' for c in cats) + '</div></div>\n    <p class="res-empty muted" hidden>No essays match. Try another word.</p>')
    body = body.replace('<div class="article-list" style="margin-top:1.5rem">', toolbar + '\n    <div class="article-list" style="margin-top:1.5rem">')
    # read time into meta, from content
    def meta(m):
        href = m.group(1); a = arts.get(amap.get(href))
        return m.group(0) if not a else m.group(0).replace('</div>', f' · {a["read_minutes"]} min read</div>', 1)
    body = re.sub(r'<div class="meta">[^\n]*?</div>\s*<h3><a href="#([\w-]+)">', lambda m: re.sub(r'</div>', f' · {arts[amap[m.group(1)]]["read_minutes"]} min read</div>', m.group(0), 1) if m.group(1) in amap else m.group(0), body)
    return body
rebuild(resources)
# home "Reading for couples" and everywhere: Articles -> Resources in labels
h = h.replace('<a href="#articles" data-nav>Articles</a>', '<a href="#articles" data-nav>Resources</a>').replace('<a href="#articles">Articles</a>', '<a href="#articles">Resources</a>')
h = h.replace('<div class="eyebrow"><a href="#articles">Articles</a>', '<div class="eyebrow"><a href="#articles">Resources</a>')
h = re.sub(r'<a class="btn btn-quiet[^"]*" href="#articles">All articles</a>', '<a class="btn btn-quiet" href="#articles">All resources</a>', h)

# ---------- D. map ----------
h = re.sub(r'<div class="map">.*?</div>\s*</div>', '<a class="map" href="https://www.google.com/maps/search/?api=1&query=617+West+Cliveden+Street+Philadelphia+PA+19119" target="_blank" rel="noopener" aria-label="Open the office location in Google Maps"><img src="map.jpg" alt="Street map around 617 West Cliveden Street" loading="lazy"><span class="map-pin" aria-hidden="true"></span></a>', h, count=1, flags=re.S)
shutil.copy(root / 'site' / 'assets' / 'civic' / 'map.jpg', sage / 'map.jpg')

# ---------- E. 988 note: in the form and in the footer ----------
crisis = '<p class="crisis"><strong>In crisis?</strong> This form is not monitored around the clock. Call or text 988 or go to the nearest emergency room.</p>'
def _crisis_in_form(m):
    f = m.group(0); return re.sub(r'(<button class="btn btn-primary[^"]*"[^>]*type="submit"[^>]*>[^<]*</button>)', r'\1\n          ' + crisis, f, count=1)
h = re.sub(r'<form class="form" id="consult-form".*?</form>', _crisis_in_form, h, count=1, flags=re.S)
h = h.replace('<div class="wrap legal">© 2026', '<div class="wrap legal"><p class="crisis">In crisis? This site is not monitored around the clock. Call or text 988 or go to the nearest emergency room.</p>© 2026', 1)

# ---------- F. no portal ----------
h = re.sub(r'\s*<a href="#portal" data-nav>[^<]*</a>', '', h)
h = re.sub(r'<section class="page" id="portal".*?</section>\s*', '', h, count=1, flags=re.S)
h = h.replace('<a href="#portal">client portal</a>', 'client portal')

# ---------- G. who I work with, on the services page ----------
aud = ''.join(f'<div class="card"><div class="post-kicker">{a["kicker"]}</div><h3>{a["title"]}</h3><p>{a["text"]}</p><p><strong>{a["result"]}</strong></p><a class="more" href="#{smap.get(a["service"], "services")}">More on this work →</a></div>' for a in C['audiences'])
who = f'''
  <div class="section soft"><div class="wrap">
    <div class="eyebrow">Who I work with</div>
    <h2>Couples, individuals, people in the middle of a divorce, and clinicians.</h2>
    <p class="lead">Each brings a different question. Each needs the same thing: a safe place to say what is true.</p>
    <div class="grid grid-2" style="margin-top:2rem">{aud}</div>
  </div></div>
'''
def add_who(pid, body):
    if pid != 'services': return body
    return body.replace('</section>', who + '</section>', 1) if body.rstrip().endswith('</section>') else body[:body.rfind('</section>')] + who + body[body.rfind('</section>'):]
rebuild(add_who)


# ---------- H. consultation form: same field set as Civic (content.json consultation_form) ----------
F = C['consultation_form']; fld = lambda n: next(f for f in F['fields'] if f['name'] == n)
def sage_pills(f, name):
    return ''.join(f'<label class="pill-opt"><input type="checkbox" name="{name}" value="{html.escape(o)}"><span>{html.escape(o)}</span></label>' for o in f['options'])
look = fld('modality'); mode = fld('mode'); ins = fld('insurance'); msg = fld('message')
looking = (f'<fieldset class="field pills" id="f-looking">\n            <legend>{html.escape(look["label"])} <span class="hint">({html.escape(look["hint"])})</span></legend>\n'
           f'            <div class="pill-row">{sage_pills(look, "modality")}</div>\n          </fieldset>\n          ')
h = h.replace('<fieldset class="field pills" id="f-mode" data-required-group>', looking + '<fieldset class="field pills" id="f-mode" data-required-group>', 1)
h = re.sub(r'<legend>Modality <span class="hint">\(choose one or more\)</span></legend>', f'<legend>{html.escape(mode["label"])} <span class="hint">({html.escape(mode["hint"])})</span></legend>', h)
h = re.sub(r'(<fieldset class="field pills" id="f-mode" data-required-group>.*?<div class="pill-row">).*?(</div>)', lambda m: m.group(1) + sage_pills(mode, 'mode') + m.group(2), h, count=1, flags=re.S)
h = re.sub(r'(<fieldset class="field pills" id="f-insurance">.*?<div class="pill-row">).*?(</div>)', lambda m: m.group(1) + sage_pills(ins, 'insurance') + m.group(2), h, count=1, flags=re.S)
h = re.sub(r'<legend>Insurance <span class="hint">\([^)]*\)</span></legend>', f'<legend>{html.escape(ins["label"])} <span class="hint">({html.escape(ins["hint"])})</span></legend>', h)
h = h.replace('placeholder="A sentence or two is enough."', f'placeholder="{html.escape(msg["placeholder"])}"')
h = re.sub(r'<span class="hint">Please do not include detailed clinical information here\. We will talk on the phone\.</span>', f'<span class="hint">{html.escape(msg["hint"])}</span>', h)
h = h.replace('>Send my request</button>', f'>{html.escape(F["submit"])}</button>')
h = re.sub(r'<p class="muted" style="font-size:0.85rem; margin:0">By sending this request you agree[^<]*</p>', f'<p class="muted" style="font-size:0.85rem; margin:0">{html.escape(F["consent"])}</p>', h)
h = re.sub(r'(<div class="form-success" id="form-success" hidden tabindex="-1">\s*<h2>Thank you, <span id="success-name">friend</span>\.</h2>)\s*<p>.*?</p>\s*<p>.*?</p>', lambda m: m.group(1) + f'\n          <p>{html.escape(F["success"]["text"])}</p>', h, count=1, flags=re.S)
h = h.replace('>Send another request</button>', f'>{html.escape(F["success"]["again"])}</button>')

h = h.replace('aria-label="Menu"><span></span><span></span></button>', 'aria-label="Menu"><span></span><span></span><span></span></button>')  # three-line hamburger
(sage / 'index.html').write_text(h)

# ---------- styles + script ----------
css = (sage / 'styles.css').read_text()
if '.photo-slot' not in css:
    css += '''
/* --- alignment with Civic (added 2026-10-23) --- */
.photo-slot { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: var(--r); box-shadow: var(--shadow); }
.page-hero-grid .photo-slot { max-width: 520px; justify-self: end; }
/* --- spacing pass --- */
.section { padding-block: clamp(3rem, 6vw, 5rem); }
.page-hero { padding-block: clamp(3rem, 6vw, 4.5rem) clamp(1.5rem, 3vw, 2.25rem); }
.page-hero + .section { padding-top: clamp(1rem, 2.5vw, 1.75rem); }
.page-hero + .section > .wrap > :first-child { margin-top: 0 !important; }
.page-hero + .section > .wrap.prose > :first-child { margin-top: 0; }

@media (max-width: 899px) { .page-hero-grid .photo-slot { justify-self: start; max-width: 100%; } }
.res-toolbar { display: flex; flex-wrap: wrap; gap: 0.7rem 1rem; align-items: center; margin-top: 1.5rem; }
.res-search { flex: 1 1 100%; }
.res-search input { width: 100%; font: inherit; padding: 0.8rem 1.1rem; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); color: var(--ink); }
.res-search input:focus { border-color: var(--accent); outline: none; box-shadow: 0 0 0 3px var(--accent-soft); }
.res-pills { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.res-pill { border: 1px solid var(--line); background: var(--surface); color: var(--ink-2); padding: 0.45rem 0.9rem; border-radius: 999px; cursor: pointer; font: inherit; font-weight: 700; font-size: 0.9rem; }
.res-pill[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.article-list { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
.article-item.is-featured { grid-column: 1 / -1; background: var(--accent-soft); border-color: transparent; padding: clamp(1.6rem, 4vw, 2.6rem); }
.article-item.is-featured h3 { font-size: clamp(1.5rem, 3vw, 2.2rem); }
.article-item.is-featured p { font-size: 1.05rem; max-width: 60ch; }
.article-item.is-featured .meta::before { content: "Featured · "; font-weight: 800; color: var(--accent); }
.crisis { background: var(--accent-soft); border-radius: var(--r-sm); padding: 0.8rem 1rem; font-size: 0.92rem; color: var(--ink); margin: 0 0 1rem; }
.legal .crisis { margin: 0 0 1rem; display: block; }
a.map { display: block; position: relative; aspect-ratio: 4 / 3; border-radius: var(--r-sm); overflow: hidden; border: 1px solid var(--line); margin: 0.4rem 0 0.8rem; }
a.map img { width: 100%; height: 100%; object-fit: cover; display: block; }
.map-pin { position: absolute; left: 50%; top: 52%; width: 14px; height: 14px; border-radius: 50%; background: var(--accent); border: 3px solid #fff; transform: translate(-50%, -50%); box-shadow: 0 0 0 6px rgba(47,110,102,.3); }
.prose img { border-radius: var(--r-sm); }
'''
    css = css.replace('place-items: center; gap: 5px; cursor: pointer; padding: 0; }', 'place-items: center; align-content: center; gap: 4px; cursor: pointer; padding: 0; }')
    (sage / 'styles.css').write_text(css)

js = (sage / 'script.js').read_text()
if 'sage-res-search' not in js:
    js = js.replace('})();', '''
  /* Resources: search + subject pills, first match featured */
  var resInput = document.getElementById("sage-res-search");
  if (resInput) {
    var list = document.querySelector("#articles .article-list");
    var items = Array.prototype.slice.call(list.querySelectorAll(".article-item"));
    var pills = Array.prototype.slice.call(document.querySelectorAll("#articles .res-pill"));
    var empty = document.querySelector("#articles .res-empty");
    var cat = "All";
    function draw() {
      var q = resInput.value.trim().toLowerCase(); var n = 0; var first = true;
      items.forEach(function (it) {
        var tag = (it.querySelector(".tag") || {}).textContent || "";
        var ok = (cat === "All" || tag === cat) && (!q || it.textContent.toLowerCase().indexOf(q) !== -1);
        it.hidden = !ok;
        it.classList.toggle("is-featured", ok && first && !q && cat === "All");
        if (ok) { n += 1; first = false; }
      });
      if (empty) empty.hidden = n > 0;
    }
    resInput.addEventListener("input", draw);
    pills.forEach(function (b) { b.addEventListener("click", function () { cat = b.getAttribute("data-cat"); pills.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); draw(); }); });
    draw();
  }
})();''')
    (sage / 'script.js').write_text(js)

# ---------- report ----------
pages2 = list(re.finditer(r'<section class="page" id="([^"]+)"', h))
b2 = [(m.group(1), m.start()) for m in pages2] + [('__footer', h.find('<footer'))]
for (pid, s), (_, e) in zip(b2, b2[1:]):
    n = len(CTA.findall(h[s:e]))
    if n > 1 and pid != 'home' or n > 2: print('CTA', pid, n)
print('slots left', h.count('img-slot'), '| 988:', h.count('988'), '| portal links:', h.count('#portal'), '| notes:', h.count('Migration note'), h.count('migrates from'))

