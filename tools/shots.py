"""Screenshot the prototype in each theme at desktop and phone widths.
usage: python3 tools/shots.py [theme ...] [--full] [--dark]"""
import asyncio, sys
from pathlib import Path
from playwright.async_api import async_playwright
root = Path(__file__).resolve().parent.parent
out = Path('/tmp/claude-0/-home-claude/b10c942d-d89b-54ee-92e9-0e81d1c41ce7/scratchpad/shots'); out.mkdir(parents=True, exist_ok=True)
args = [a for a in sys.argv[1:] if not a.startswith('--')]
themes = args or ['civic', 'nouveau', 'swiss']
full = '--full' in sys.argv
mode = 'dark' if '--dark' in sys.argv else 'light'

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for t in themes:
            for name, vp in [('desktop', (1360, 900)), ('phone', (390, 844))]:
                pg = await b.new_page(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=1)
                errors = []
                pg.on('pageerror', lambda e: errors.append(str(e)))
                pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
                await pg.goto(f'file://{root}/site/index.html?theme={t}&mode={mode}', wait_until='networkidle')
                await pg.wait_for_timeout(600)
                await pg.screenshot(path=str(out / f'{t}-{name}-{mode}.png'), full_page=full)
                if errors: print(t, name, 'ERRORS:', errors[:5])
                await pg.close()
        await b.close()
asyncio.run(main())
print('shots in', out)
