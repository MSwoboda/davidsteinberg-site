#!/usr/bin/env python3
"""Draws the information-flow schematic for the site/portal/dashboard as one HTML page (inline SVG)."""
import html, pathlib

OUT = pathlib.Path('/home/claude/site-rebuild/site/docs/information-flows.html')

def esc(s): return html.escape(s, quote=True)

def box(x, y, w, h, title, sub=None, cls='node', mono=False):
    out = [f'<rect class="{cls}" x="{x}" y="{y}" width="{w}" height="{h}" rx="6"/>']
    cx = x + w / 2
    if sub:
        out.append(f'<text class="t" x="{cx}" y="{y + 22}" text-anchor="middle">{esc(title)}</text>')
        for i, line in enumerate(sub if isinstance(sub, list) else [sub]):
            out.append(f'<text class="s{" mono" if mono else ""}" x="{cx}" y="{y + 38 + i * 13}" text-anchor="middle">{esc(line)}</text>')
    else:
        out.append(f'<text class="t" x="{cx}" y="{y + h / 2 + 4}" text-anchor="middle">{esc(title)}</text>')
    return '\n'.join(out)

def edge(pts, label=None, lx=None, ly=None, cls='e', anchor='middle'):
    d = ' '.join(f'{x},{y}' for x, y in pts)
    out = [f'<polyline class="{cls}" points="{d}" marker-end="url(#ah)"/>']
    if label:
        out.append(f'<text class="l" x="{lx}" y="{ly}" text-anchor="{anchor}">{esc(label)}</text>')
    return '\n'.join(out)

def group(x, y, w, h, label):
    return (f'<rect class="g" x="{x}" y="{y}" width="{w}" height="{h}" rx="10"/>'
            f'<text class="gl" x="{x + 12}" y="{y + 18}">{esc(label)}</text>')

# ---------------------------------------------------------------- main figure
# columns: people 24-144 · page 210-410 · functions 470-670 · Firestore 730-950 · auth 990-1140 · outside 1170-1316
P = []
P.append(group(198, 36, 224, 668, 'HOSTING — static files only'))
P.append(group(458, 36, 700, 668, 'GOOGLE CLOUD PROJECT davidsteinberg-site — functions us-east4 · Firestore nam5'))
P.append(group(1170, 36, 150, 268, 'OUTSIDE GOOGLE CLOUD'))

for y, name in [(50, '1  Page views'), (150, '2  Consultation form'), (330, '3  Client portal'), (530, '4  Practice dashboard')]:
    P.append(f'<text class="lane" x="24" y="{y}">{esc(name)}</text>')

# people
P.append(box(24, 60, 120, 64, 'Visitor', ['anyone on the', 'public site'], cls='who'))
P.append(box(24, 160, 120, 64, 'Prospective client', ['fills in the form'], cls='who'))
P.append(box(24, 340, 120, 144, 'Client', ['signed in with', 'a Google account'], cls='who'))
P.append(box(24, 540, 120, 144, 'Staff', ['michswo@gmail.com', '(STAFF_EMAILS)'], cls='who'))

# lane 1 — page views
P.append(box(210, 60, 200, 64, 'Public site', ['index.html · js/hit.js', 'path, referrer, template'], mono=True))
P.append(box(470, 60, 200, 64, 'pageHit', ['HTTPS function', 'hashes address + browser + day']))
P.append(box(730, 60, 220, 64, 'traffic/{day}', ['views, pages, referrers, devices', 'visitor hash only, no address'], mono=True))
P.append(edge([(144, 92), (210, 92)], 'opens', 177, 86, cls='e dim'))
P.append(edge([(410, 92), (470, 92)], 'POST', 440, 86, cls='e dim'))
P.append(edge([(670, 92), (730, 92)], 'counts', 700, 86, cls='e dim'))

# lane 2 — consultation form
P.append(box(210, 160, 200, 76, 'Contact form', ['js/request.js', 'name, email, phone, needs,', 'insurance, message'], mono=True))
P.append(box(470, 160, 200, 64, 'consultationRequest', ['HTTPS function', 'validates, rate-limits, honeypot']))
P.append(box(730, 160, 220, 64, 'requests/{id}', ['full submission + status, notes', 'ratelimits/: counters only'], mono=True))
P.append(box(730, 240, 220, 44, 'Secret Manager', 'GMAIL_APP_PASSWORD', mono=True))
P.append(box(1182, 160, 126, 64, 'Gmail (consumer)', ['michswo@gmail.com', 'sends and receives']))
P.append(edge([(144, 192), (210, 192)], 'submits', 177, 186, cls='e pii'))
P.append(edge([(410, 192), (470, 192)], 'POST', 440, 186, cls='e pii'))
P.append(edge([(670, 192), (730, 192)], 'stores', 700, 186, cls='e pii'))
P.append(edge([(730, 262), (570, 262), (570, 224)], 'app password', 650, 276, cls='e dim'))
P.append(edge([(570, 160), (570, 142), (1245, 142), (1245, 160)], 'SMTP — the email carries the same fields', 900, 136, cls='e pii'))

# lane 3 — client portal
P.append(box(210, 340, 200, 64, 'Client portal', ['portal/portal.js', 'pseudonym, questionnaires'], mono=True))
P.append(box(470, 340, 200, 64, 'bootstrap', ['callable function', 'draws pseudonym · sets staff claim']))
P.append(box(730, 340, 220, 64, 'clients/{uid} · aliases/', ['pseudonym, status, couple, assigned', 'no name, no email'], mono=True))
P.append(box(730, 420, 220, 64, 'questionnaires/ · responses/', ['definitions (read) · answers (write)', 'responses carry uid + pseudonym'], mono=True))
P.append(box(990, 340, 150, 64, 'Firebase Auth', ['Google identity:', 'uid, email, name'], cls='node warn'))
P.append(edge([(144, 372), (210, 372)], 'signs in', 177, 366, cls='e pii'))
P.append(edge([(310, 340), (310, 318), (1065, 318), (1065, 340)], 'Google sign-in popup → ID token back to the page', 690, 312, cls='e pii'))
P.append(edge([(410, 372), (470, 372)], 'ID token', 440, 366, cls='e pii'))
P.append(edge([(670, 372), (730, 372)], 'creates', 700, 366, cls='e'))
P.append(edge([(570, 404), (570, 416), (1065, 416), (1065, 404)], 'staff claim for STAFF_EMAILS', 1140, 432, cls='e dim', anchor='end'))
P.append(edge([(310, 404), (310, 452), (730, 452)], 'Firestore SDK · rules: own documents only', 520, 446, cls='e pii'))

# lane 4 — dashboard
P.append(box(210, 540, 200, 64, 'Practice dashboard', ['admin/admin.js', 'requests, clients, traffic, audit'], mono=True))
P.append(box(470, 540, 200, 64, 'Identity look-up', ['listClientAccounts · clientIdentity', 'staff only · every call writes audit/']))
P.append(box(730, 540, 220, 64, 'requests · clients · traffic', ['questionnaires · audit', 'rules: staff claim required'], mono=True))
P.append(edge([(144, 572), (210, 572)], 'signs in', 177, 566, cls='e pii'))
P.append(edge([(310, 540), (310, 494), (1045, 494), (1045, 404)], 'Google sign-in · token carries the staff claim', 680, 488, cls='e pii'))
P.append(edge([(570, 540), (570, 508), (1085, 508), (1085, 404)], 'getUser(uid) → sign-in email shown beside the pseudonym', 830, 522, cls='e pii'))
P.append(edge([(410, 572), (470, 572)], 'callable', 440, 566, cls='e pii'))
P.append(edge([(670, 572), (730, 572)], 'audit/', 700, 566, cls='e'))
P.append(edge([(310, 604), (310, 628), (840, 628), (840, 604)], 'Firestore SDK with staff token: reads all, updates status, notes, couples, assignments', 575, 644, cls='e pii'))

MAIN = '\n'.join(P)

# ---------------------------------------------------------------- deployment figure
D = []
D.append(box(20, 40, 180, 64, 'Your Mac', ['~/Documents/davidsteinberg-site', 'backend/functions/.env (not in git)'], cls='who', mono=True))
D.append(box(300, 40, 170, 64, 'GitHub', ['MSwoboda/davidsteinberg-site', 'public repo'], mono=True))
D.append(box(570, 20, 190, 48, 'GitHub Pages', 'mswoboda.github.io/davidsteinberg-site', mono=True))
D.append(box(570, 90, 190, 48, 'Firebase Hosting', 'davidsteinberg-site.web.app', mono=True))
D.append(box(570, 160, 190, 48, 'Cloud Run functions', '5 functions · .env baked in at deploy', mono=True))
D.append(box(570, 230, 190, 48, 'Firestore rules + indexes', 'backend/firestore.rules', mono=True))
D.append(box(850, 90, 170, 48, 'Design artifact', 'claude.ai — all three concepts', cls='node dim'))
D.append(edge([(200, 72), (300, 72)], 'git push', 250, 66, cls='e'))
D.append(edge([(470, 60), (520, 60), (520, 44), (570, 44)], 'Pages build', 520, 36, cls='e dim'))
D.append(edge([(200, 86), (260, 86), (260, 114), (570, 114)], 'firebase deploy --only hosting', 415, 108, cls='e'))
D.append(edge([(260, 114), (260, 184), (570, 184)], '--only functions', 415, 178, cls='e'))
D.append(edge([(260, 184), (260, 254), (570, 254)], '--only firestore', 415, 248, cls='e'))
D.append(edge([(760, 114), (850, 114)], 'same files', 805, 108, cls='e dim'))
DEPLOY = '\n'.join(D)

STORES = [
    ('requests/{id}', 'Name, email, phone, what they are looking for, insurance, message, page, time; status and notes added by staff', 'Firestore · staff only', 'Yes — personal, and health-adjacent'),
    ('ratelimits/{ip·hour}', 'Counters per address and hour, and per day; expire naturally', 'Firestore · functions only', 'Address only, short-lived'),
    ('traffic/{day} + visitors/', 'Views, pages, referrers, template, device class; a salted hash per visitor per day', 'Firestore · staff read', 'No — nothing identifies a person'),
    ('Firebase Authentication', 'Google uid, email, display name, last sign-in — for clients and staff', 'Auth · functions and the signed-in user', 'Yes — identity'),
    ('clients/{uid} · aliases/', 'Pseudonym, status, couple, assigned questionnaires, next appointment, focus, private note', 'Firestore · own + staff', 'Clinical, keyed by uid, no name'),
    ('questionnaires/{id}', 'Instrument definitions (items, scale, scoring)', 'Firestore · any signed-in user', 'No'),
    ('responses/{uid}_{qid}', 'Answers, score, pseudonym, timestamps', 'Firestore · own + staff', 'Clinical, keyed by uid'),
    ('audit/{id}', 'Who looked up which pseudonym, when', 'Firestore · staff read', 'Staff email + client uid'),
    ('Gmail inbox (michswo@gmail.com)', 'One email per consultation request with the full submission', 'Google consumer Gmail — no BAA', 'Yes — same as requests/'),
    ('Secret Manager', 'GMAIL_APP_PASSWORD', 'Google Cloud · functions only', 'Credential'),
    ('functions/.env (your Mac)', 'GMAIL_USER, NOTIFY_TO, STAFF_EMAILS, TRAFFIC_SALT — baked into the functions at deploy', 'Local file, not in git', 'Config'),
]
rows = '\n'.join(f'<tr><td><code>{esc(a)}</code></td><td>{esc(b)}</td><td>{esc(c)}</td><td>{esc(d)}</td></tr>' for a, b, c, d in STORES)

PAGE = f'''<title>Practice Site Data Flows</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: one wide schematic, then a stores table and a short gaps list; engineering-drawing tone, navy accent matching the Civic site. */
:root {{
  --bg: #f7f5f0; --fg: #1d2330; --muted: #5d6675; --line: #c9c4b8; --panel: #ffffff;
  --accent: #2c4a7a; --warn: #a8641e; --dimline: #8b8f96;
  --display: "Source Serif 4", Georgia, serif; --body: "IBM Plex Sans", system-ui, sans-serif; --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ --bg: #15181e; --fg: #e8e6e0; --muted: #a3a8b3; --line: #3a3f49; --panel: #1d2128; --accent: #8fb1e6; --warn: #e0a35a; --dimline: #7a7f88; color-scheme: dark }} }}
:root[data-theme="dark"] {{ --bg: #15181e; --fg: #e8e6e0; --muted: #a3a8b3; --line: #3a3f49; --panel: #1d2128; --accent: #8fb1e6; --warn: #e0a35a; --dimline: #7a7f88; color-scheme: dark }}
body {{ background: var(--bg); color: var(--fg); font-family: var(--body); line-height: 1.5; padding-block: 28px 56px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }}
main {{ max-width: 1240px; margin: 0 auto; display: grid; gap: 28px; }}
h1 {{ font-family: var(--display); font-weight: 600; font-size: 1.9rem; margin: 0; text-wrap: balance; }}
h2 {{ font-family: var(--display); font-weight: 600; font-size: 1.3rem; margin: 0 0 8px; }}
p {{ max-width: 68ch; margin: 0; }}
.meta {{ color: var(--muted); font-size: .9rem; }}
header {{ display: grid; gap: 8px; }}
figure {{ margin: 0; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 14px; }}
.scroll {{ overflow-x: auto; }}
svg {{ display: block; max-width: 100%; height: auto; min-width: 760px; color: var(--fg); }}
figcaption {{ color: var(--muted); font-size: .9rem; margin-top: 10px; max-width: 80ch; }}
.node {{ fill: var(--panel); stroke: currentColor; stroke-width: 1.2; }}
.who {{ fill: var(--bg); stroke: currentColor; stroke-width: 1.2; }}
.node.warn {{ stroke: var(--warn); stroke-width: 1.6; }}
.node.dim {{ stroke: var(--dimline); stroke-dasharray: 4 3; }}
.g {{ fill: none; stroke: var(--dimline); stroke-dasharray: 5 4; stroke-width: 1; }}
.gl {{ font: 500 10.5px var(--mono); fill: var(--muted); letter-spacing: .04em; }}
.lane {{ font: 600 11px var(--body); fill: var(--muted); letter-spacing: .06em; text-transform: uppercase; }}
.t {{ font: 600 12.5px var(--body); fill: currentColor; }}
.s {{ font: 400 10.5px var(--body); fill: var(--muted); }}
.s.mono {{ font-family: var(--mono); font-size: 10px; }}
.l {{ font: 400 10.5px var(--body); fill: var(--muted); }}
.e {{ fill: none; stroke: currentColor; stroke-width: 1.3; }}
.e.pii {{ stroke: var(--accent); stroke-width: 1.8; }}
.e.dim {{ stroke: var(--dimline); stroke-dasharray: 4 3; }}
.legend {{ display: flex; flex-wrap: wrap; gap: 18px; font-size: .85rem; color: var(--muted); margin-top: 12px; }}
.legend span {{ display: inline-flex; align-items: center; gap: 8px; }}
.sw {{ width: 34px; height: 0; border-top: 2px solid currentColor; }}
.sw.pii {{ border-color: var(--accent); border-top-width: 3px; }}
.sw.dim {{ border-top: 2px dashed var(--dimline); }}
.sw.warn {{ width: 18px; height: 12px; border: 2px solid var(--warn); border-radius: 3px; }}
table {{ border-collapse: collapse; width: 100%; font-size: .9rem; }}
th, td {{ text-align: left; vertical-align: top; padding: 9px 10px; border-bottom: 1px solid var(--line); }}
th {{ font-size: .75rem; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); font-weight: 600; }}
td code {{ font-family: var(--mono); font-size: .82rem; white-space: nowrap; }}
.cols {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }}
.card {{ border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; background: var(--panel); min-width: 0; }}
.card ul {{ margin: 8px 0 0; padding-left: 18px; }}
.card li {{ margin: 6px 0; }}
.card li strong {{ font-weight: 600; }}
.tag {{ display: inline-block; font: 500 .72rem var(--mono); letter-spacing: .04em; padding: 2px 7px; border-radius: 4px; border: 1px solid var(--warn); color: var(--warn); margin-left: 6px; vertical-align: middle; }}
@media (max-width: 600px) {{ th:nth-child(3), td:nth-child(3) {{ display: none; }} }}
</style>
<main>
<header>
  <h1>Practice Site Data Flows</h1>
  <p class="meta">davidsteinberg.com rebuild · as deployed on 27 October 2026 · Civic template on Firebase Hosting and GitHub Pages, backend on Firebase project <code>davidsteinberg-site</code></p>
  <p>Four flows share one Google Cloud project. The public site sends nothing but anonymous counts; the consultation form is the first place personal information enters, and it goes two ways at once (Firestore and Gmail). The portal and dashboard sign in through Google and talk to Firestore directly under security rules, with four small functions for the steps that need server trust.</p>
</header>

<figure>
  <div class="scroll">
  <svg viewBox="0 0 1340 720" role="img" aria-label="Schematic of the four information flows: page views to traffic counters; the consultation form to Firestore and to Gmail; the client portal through Google sign-in and bootstrap to client, questionnaire and response documents; the practice dashboard through Google sign-in to staff-only reads and the identity look-up functions." xmlns="http://www.w3.org/2000/svg">
    <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>
    {MAIN}
  </svg>
  </div>
  <div class="legend">
    <span><i class="sw pii"></i>carries personal or clinical information</span>
    <span><i class="sw"></i>carries data, nothing identifying</span>
    <span><i class="sw dim"></i>control or anonymous counts</span>
    <span><i class="sw warn"></i>not on the Google Cloud BAA list today</span>
  </div>
  <figcaption>Where information moves today. Left to right: the person, the page they use (served as static files), the function or SDK call, and the store. Blue arrows are the only paths that carry a name, contact detail, identity or answer. Functions run in us-east4; Firestore is multi-region nam5.</figcaption>
</figure>

<section>
  <h2>What is stored where</h2>
  <div class="scroll">
  <table>
    <thead><tr><th>Store</th><th>Contents</th><th>Where · who can read</th><th>Personal?</th></tr></thead>
    <tbody>{rows}</tbody>
  </table>
  </div>
</section>

<section class="cols">
  <div class="card">
    <h2>What never leaves the browser or is never kept</h2>
    <ul>
      <li>The visitor's address: <code>pageHit</code> hashes it with the browser string, the day and a server-side salt, keeps the hash for that day's unique count, and discards the address. The rate limiter keeps a per-address counter for an hour.</li>
      <li>Cookies: none on the public site, the portal or the dashboard. Firebase Auth keeps its session in the browser's own storage.</li>
      <li>Client names in clinical data: <code>clients/</code> and <code>responses/</code> hold the pseudonym and the uid; the name and email exist only in Firebase Authentication and appear in the dashboard through an audited function call.</li>
      <li>Nothing goes to a third-party analytics or email-marketing service.</li>
    </ul>
  </div>
  <div class="card">
    <h2>Outside the BAA today <span class="tag">to close</span></h2>
    <ul>
      <li><strong>Firebase Authentication</strong> holds client identities but is not on Google's covered-products list; <strong>Identity Platform</strong> is. One-click upgrade in the Firebase console, no code change.</li>
      <li><strong>Gmail (consumer)</strong> receives the full consultation request. Either reduce the email to a bare "new request from [name]" ping, or send through an account with a BAA (Google Workspace) or a transactional service on the practice domain.</li>
      <li><strong>The BAA itself</strong> is not yet accepted on project <code>davidsteinberg-site</code>. Firestore, Cloud Run functions, Secret Manager, Cloud Logging and Build are covered once it is.</li>
      <li><strong>Hosting</strong> (Firebase Hosting, GitHub Pages) is not covered and does not need to be: it serves the pages; no personal data passes through it.</li>
    </ul>
  </div>
</section>

<figure>
  <div class="scroll">
  <svg viewBox="0 0 1040 300" role="img" aria-label="Deployment paths: the Mac pushes to GitHub, which builds GitHub Pages; firebase deploy from the Mac publishes Hosting, the functions and the Firestore rules; the design artifact shows the same files." xmlns="http://www.w3.org/2000/svg">
    <defs><marker id="ah2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>
    {DEPLOY.replace('url(#ah)', 'url(#ah2)')}
  </svg>
  </div>
  <figcaption>How code and configuration get out. Nothing here carries client data; <code>.env</code> (addresses, staff list, traffic salt) lives only on the Mac and is baked into the functions at deploy time, and the Gmail app password lives only in Secret Manager.</figcaption>
</figure>
</main>
'''
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(PAGE)
print(OUT, len(PAGE))
