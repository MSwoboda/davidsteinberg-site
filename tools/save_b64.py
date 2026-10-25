"""Decode a browser tool result file (JSON string of {id: base64}) into site/assets/photos/<id>.jpg"""
import json, base64, sys
f = sys.argv[1]
s = json.load(open(f))[0]['text']
end = s.rfind('"', 0, s.find('\n\n(captured')) if '(captured' in s else len(s) - 1
val = json.loads(s[:end + 1]); d = json.loads(val) if isinstance(val, str) else val
for k, v in d.items():
    if v.startswith('ERR'): print(k, v); continue
    open(f'site/assets/photos/{k}.jpg', 'wb').write(base64.b64decode(v)); print('saved', k, len(v) * 3 // 4)
