"""Cache-busting: put ?v=YYYYMMDDHHMM on every local script/stylesheet link in the site's HTML pages."""
import re, datetime, pathlib
root = pathlib.Path(__file__).resolve().parent.parent / 'site'
stamp = datetime.datetime.now(datetime.UTC).strftime('%Y%m%d%H%M')
for rel in ['index.html', 'admin/index.html', 'portal/index.html']:
    p = root / rel; s = p.read_text()
    def fix(m):
        attr, url = m.group(1), m.group(2)
        if url.startswith(('http:', 'https:', '//')): return m.group(0)
        return f'{attr}="{url.split("?")[0]}?v={stamp}"'
    s2 = re.sub(r'\b(src|href)="([^"]+\.(?:js|css)(?:\?v=\d+)?)"', fix, s)
    p.write_text(s2); print(rel, 'stamped', stamp)
