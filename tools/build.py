"""Build step: content/content.json -> site/js/content.js"""
import json
from pathlib import Path
root = Path(__file__).resolve().parent.parent
c = json.load(open(root / 'content' / 'content.json'))
js = 'window.CONTENT = ' + json.dumps(c, ensure_ascii=False) + ';\n'
(root / 'site' / 'js' / 'content.js').write_text(js)
print('content.js', len(js), 'bytes')
