import asyncio, sys
from playwright.async_api import async_playwright
out='/tmp/claude-0/-home-claude/b10c942d-d89b-54ee-92e9-0e81d1c41ce7/scratchpad/shots'
mode=sys.argv[1] if len(sys.argv)>1 else 'light'; width=int(sys.argv[2]) if len(sys.argv)>2 else 1440
secs=sys.argv[3].split(',') if len(sys.argv)>3 else ['home','services','audience','stories','approach','about','practical','articles','faq','contact','closing']
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':width,'height':900}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(f'file://./index.html?theme=nouveau&mode={mode}', wait_until='load'); await pg.wait_for_timeout(600)
        h=await pg.evaluate('document.body.scrollHeight')
        for y in range(0,h,700): await pg.evaluate(f'window.scrollTo(0,{y})'); await pg.wait_for_timeout(120)
        await pg.evaluate('window.scrollTo(0,0)'); await pg.wait_for_timeout(600)
        for s in secs:
            el=await pg.query_selector('#'+s)
            if el: await el.scroll_into_view_if_needed(); await pg.wait_for_timeout(300); await el.screenshot(path=f'{out}/nv-{mode}-{width}-{s}.png')
        await pg.evaluate('window.scrollTo(0,0)'); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{out}/nv-{mode}-{width}-viewport.png')
        print('errors', errs); await b.close()
asyncio.run(main())
