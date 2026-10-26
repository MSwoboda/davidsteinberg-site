'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { handle } = require('../lib/handle');

/* A tiny in-memory stand-in for Firestore: collection(name).doc(id).get/set, collection(name).add */
function fakeDb() {
  const store = {};
  const col = name => ({
    doc: id => ({
      id,
      get: async () => ({ exists: !!store[`${name}/${id}`], data: () => store[`${name}/${id}`] }),
      set: async (v, opts) => { store[`${name}/${id}`] = opts && opts.merge ? { ...(store[`${name}/${id}`] || {}), ...v } : v; },
    }),
    add: async v => { const id = 'r' + Math.random().toString(36).slice(2, 8); store[`${name}/${id}`] = v; return col(name).doc(id); },
  });
  return { collection: col, store };
}

const good = { name: 'Ada Lovelace', email: 'ada@example.com', phone: '215-555-0100', modality: ['Couples'], mode: ['Video'], insurance: ['Aetna'], message: 'We keep having the same argument.', page: 'https://davidsteinberg.com/#contact' };
const deps = (db, mails, opts = {}) => ({ db, sendMail: async m => { if (opts.fail) throw new Error('smtp down'); mails.push(m); }, now: () => new Date('2026-10-26T15:00:00Z') });

test('a complete request is stored and emailed', async () => {
  const db = fakeDb(), mails = [];
  const out = await handle({ method: 'POST', body: good, ip: '1.2.3.4', userAgent: 'test' }, deps(db, mails));
  assert.equal(out.status, 200); assert.equal(out.body.ok, true);
  const saved = Object.entries(db.store).find(([k]) => k.startsWith('requests/'))[1];
  assert.equal(saved.name, 'Ada Lovelace'); assert.equal(saved.status, 'new'); assert.equal(saved.emailed, true);
  assert.equal(mails.length, 1);
  assert.match(mails[0].subject, /Ada Lovelace/); assert.match(mails[0].text, /215-555-0100/); assert.match(mails[0].html, /same argument/);
  assert.equal(mails[0].replyTo, 'Ada Lovelace <ada@example.com>');
});

test('missing or bad fields are refused with the field names', async () => {
  const db = fakeDb();
  const out = await handle({ method: 'POST', body: { ...good, email: 'nope', mode: [] }, ip: '1.2.3.4' }, deps(db, []));
  assert.equal(out.status, 400); assert.deepEqual(out.body.fields, ['email', 'mode']);
  assert.equal(Object.keys(db.store).length, 0);
});

test('unknown list values are dropped, strings are trimmed and capped', async () => {
  const db = fakeDb();
  await handle({ method: 'POST', body: { ...good, modality: ['Couples', 'Hacking'], name: '  Ada  ', message: 'x'.repeat(5000) }, ip: '1.2.3.4' }, deps(db, []));
  const saved = Object.values(db.store).find(v => v.status === 'new');
  assert.deepEqual(saved.modality, ['Couples']); assert.equal(saved.name, 'Ada'); assert.equal(saved.message.length, 2000);
});

test('the honeypot swallows bots quietly', async () => {
  const db = fakeDb(), mails = [];
  const out = await handle({ method: 'POST', body: { ...good, website: 'http://spam' }, ip: '9.9.9.9' }, deps(db, mails));
  assert.equal(out.status, 200); assert.equal(Object.keys(db.store).length, 0); assert.equal(mails.length, 0);
});

test('six requests in an hour from one address: the sixth is rate-limited', async () => {
  const db = fakeDb(), mails = [];
  for (let i = 0; i < 5; i++) assert.equal((await handle({ method: 'POST', body: good, ip: '5.5.5.5' }, deps(db, mails))).status, 200);
  const out = await handle({ method: 'POST', body: good, ip: '5.5.5.5' }, deps(db, mails));
  assert.equal(out.status, 429); assert.equal(mails.length, 5);
  assert.equal((await handle({ method: 'POST', body: good, ip: '6.6.6.6' }, deps(db, mails))).status, 200);
});

test('a mail failure still saves the request and answers ok, with the error on the document', async () => {
  const db = fakeDb();
  const out = await handle({ method: 'POST', body: good, ip: '1.2.3.4' }, deps(db, [], { fail: true }));
  assert.equal(out.status, 200);
  const saved = Object.values(db.store).find(v => v.status === 'new');
  assert.equal(saved.emailed, false); assert.match(saved.emailError, /smtp down/);
});

test('non-POST and non-JSON are refused', async () => {
  const db = fakeDb();
  assert.equal((await handle({ method: 'GET' }, deps(db, []))).status, 405);
  assert.equal((await handle({ method: 'OPTIONS' }, deps(db, []))).status, 204);
  assert.equal((await handle({ method: 'POST', body: 'text' }, deps(db, []))).status, 400);
});
