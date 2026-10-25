/* Preview gate for the davidsteinberg.com prototype.
   Every request must carry a signed cookie; otherwise a password screen is served. Fonts and the login page's own
   stylesheet pass through so the screen can be styled. POST /__login sets the cookie, GET /__logout clears it. */

const COOKIE = 'ds_preview';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const OPEN = [/^\/assets\/fonts\//, /^\/css\/fonts\.css$/, /^\/favicon\.ico$/];

async function token(env) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SESSION_SECRET || 'dev'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('ok:' + (env.SITE_PASSWORD || '')));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function cookieValue(request) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  return m ? m[1] : '';
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function safeNext(v) { return v && v.startsWith('/') && !v.startsWith('//') ? v : '/'; }

function loginPage(next, error) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Preview · David Steinberg, PhD, LCSW</title><meta name="robots" content="noindex">
<link rel="stylesheet" href="/css/fonts.css">
<style>
  :root { color-scheme: light dark; --bg: #f9f6f0; --card: #ffffff; --ink: #212c33; --ink-2: #3a3b45; --muted: #6b6f72; --line: #dcd7cc; --accent: #2d3a50; --accent-ink: #f9f7f1; --err: #a3372b; }
  @media (prefers-color-scheme: dark) { :root { --bg: #15191f; --card: #1d2229; --ink: #f1ece1; --ink-2: #c9c3b7; --muted: #8d8a82; --line: #30373f; --accent: #e9dfc8; --accent-ink: #15191f; --err: #e08a7c; } }
  * { box-sizing: border-box; } html, body { height: 100%; }
  body { margin: 0; display: grid; place-items: center; padding: 24px; background: var(--bg); color: var(--ink); font: 17px/1.55 "Geist", system-ui, sans-serif; }
  .card { width: min(100%, 420px); background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 36px 32px 32px; }
  .mark { width: 38px; height: 38px; border-radius: 10px; background: var(--accent); color: var(--accent-ink); display: grid; place-items: center; font-family: "Newsreader", Georgia, serif; font-size: 17px; margin-bottom: 20px; }
  h1 { font-family: "Newsreader", Georgia, serif; font-weight: 400; font-size: 2rem; line-height: 1.05; letter-spacing: -0.02em; margin: 0 0 8px; }
  p { margin: 0 0 22px; color: var(--ink-2); font-size: .98rem; }
  label { display: block; font-size: .85rem; font-weight: 500; margin-bottom: 6px; color: var(--ink-2); }
  input { width: 100%; font: inherit; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--bg); color: var(--ink); }
  input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  button { margin-top: 16px; width: 100%; font: inherit; font-weight: 600; font-size: .95rem; padding: 13px 20px; border: 0; border-radius: 999px; background: var(--accent); color: var(--accent-ink); cursor: pointer; }
  .error { color: var(--err); font-size: .9rem; margin: 10px 0 0; }
  .note { margin: 22px 0 0; font-size: .82rem; color: var(--muted); }
</style></head><body>
<form class="card" method="post" action="/__login">
  <div class="mark" aria-hidden="true">DS</div>
  <h1>Site preview</h1>
  <p>This is an unpublished draft of the David Steinberg, PhD, LCSW website. Enter the preview password to continue.</p>
  <input type="hidden" name="next" value="${esc(next)}">
  <label for="pw">Password</label>
  <input id="pw" name="password" type="password" autocomplete="current-password" autofocus required>
  ${error ? '<p class="error">That password is not right. Try again.</p>' : ''}
  <button type="submit">Open the preview</button>
  <p class="note">Nothing on this site is monitored. In crisis? Call or text 988.</p>
</form></body></html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const expected = await token(env);

    if (path === '/__logout') {
      return new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
    }
    if (path === '/__login' && request.method === 'POST') {
      const form = await request.formData();
      const next = safeNext(form.get('next'));
      if (safeEqual(String(form.get('password') || ''), String(env.SITE_PASSWORD || ''))) {
        return new Response(null, { status: 303, headers: { Location: next, 'Set-Cookie': `${COOKIE}=${expected}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax` } });
      }
      return new Response(loginPage(next, true), { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    if (OPEN.some(re => re.test(path))) return env.ASSETS.fetch(request);
    if (safeEqual(cookieValue(request), expected)) {
      const res = await env.ASSETS.fetch(request);
      const h = new Headers(res.headers); h.set('X-Robots-Tag', 'noindex, nofollow');
      return new Response(res.body, { status: res.status, headers: h });
    }
    const accept = request.headers.get('Accept') || '';
    if (request.method === 'GET' && accept.includes('text/html')) {
      return new Response(loginPage(path + url.search, false), { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    return new Response('Unauthorized', { status: 401 });
  }
};
