"""stitch.py name WxH x,y,path [x,y,path ...] -> tools/nouveau/raw/name.png"""
import sys
from PIL import Image
name = sys.argv[1]; w, h = map(int, sys.argv[2].split('x'))
out = Image.new('RGB', (w, h), (0, 0, 0))
TR = '/root/.claude/projects/-home-claude/b10c942d-d89b-54ee-92e9-0e81d1c41ce7/tool-results/mcp-remote-devices-blob-'
for spec in sys.argv[3:]:
    x, y, p = spec.split(',')
    im = Image.open(TR + p + '.jpg')
    out.paste(im, (int(x), int(y)))
out.save(f'/home/claude/site-rebuild/tools/nouveau/raw/{name}.png')
print(name, out.size)
