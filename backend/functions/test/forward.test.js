'use strict';
const test = require('node:test'); const assert = require('node:assert');
const { secureFormForwarder, handle } = require('../lib/handle');
const SCRIPT = 'function secureform_submit() { f.action = __sff + "/" + "1" + ":" + "7851-496-Bx0Y" + ":1793280922:" + "bb70249e25e1f1e1056d43a69d72f69c9916e96d700ecb646cc06901f07969a7" + ":" + t; return true; }';
test('SecureForm forwarder reads the token and posts the fields', async () => {
  const calls = [];
  const fetchFn = async (url, opts) => { calls.push({ url, opts }); if (url.includes('secureform.php')) return { ok: true, status: 200, text: async () => SCRIPT }; return { ok: true, status: 200, text: async () => 'https://davidsteinberg.com/thanks\n' }; };
  const fwd = secureFormForwarder('7851-496-Bx0Y', fetchFn);
  const out = await fwd({ name: 'Ada Lovelace', email: 'ada@example.com', phone: '215-555-0100', insurance: ['Aetna'], modality: ['Couples'], mode: ['Video'], message: 'Help us argue less.', page: 'https://davidsteinberg.com/#contact' });
  assert.equal(out, 'https://davidsteinberg.com/thanks');
  assert.match(calls[1].url, /^https:\/\/secureform\.luxsci\.com\/perl\/post\/7851-496-Bx0Y\/1:7851-496-Bx0Y:1793280922:bb70249e[0-9a-f]+:\d{10}$/);
  const body = calls[1].opts.body.toString();
  assert.match(body, /Fullname=Ada\+Lovelace/); assert.match(body, /insurance=Aetna/); assert.match(body, /Looking\+for%3A\+Couples/); assert.match(body, /__ajax__submit__=1/);
});
test('handle records forwarding and can skip the email', async () => {
  const store = {}; let n = 0;
  const db = { collection: () => ({ doc: () => ({ get: async () => ({ exists: false }), set: async () => {} }), add: async d => { const id = 'r' + (++n); store[id] = { ...d }; return { id, set: async (p) => Object.assign(store[id], p) }; } }) };
  const out = await handle({ method: 'POST', body: { name: 'Ada', email: 'ada@example.com', phone: '215-555-0100', mode: ['Video'] }, ip: '1.2.3.4' }, { db, detail: 'none', forward: async () => 'ok' });
  assert.equal(out.status, 200); const d = store.r1; assert.equal(d.forwarded, true); assert.equal(d.emailed, null);
});
