'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeAlias, ADJECTIVES, ANIMALS } = require('../lib/alias');
const { bootstrap, clientIdentity, recordHit, classifyDevice } = require('../lib/portal');

/* In-memory Firestore stand-in with transactions and FieldValue.increment-style updates. Like the real
   set(..., {merge:true}), nested objects deep-merge and a dotted key is a literal field name. */
function fakeDb() {
  const store = {};
  const merge = (into, v) => {
    for (const [k, val] of Object.entries(v)) {
      if (val && val.__inc != null) into[k] = (into[k] || 0) + val.__inc;
      else if (val && typeof val === 'object' && !Array.isArray(val)) { into[k] = into[k] && typeof into[k] === 'object' ? into[k] : {}; merge(into[k], val); }
      else into[k] = val;
    }
    return into;
  };
  const setDoc = (path, v, opts) => {
    if (!(opts && opts.merge)) { store[path] = JSON.parse(JSON.stringify(v)); return; }
    store[path] = merge(store[path] || {}, v);
  };
  const doc = (path) => ({
    id: path.split('/').pop(), path,
    get: async () => ({ exists: !!store[path], data: () => store[path] }),
    set: async (v, o) => setDoc(path, v, o),
    collection: name => col(path + '/' + name),
  });
  const col = (path) => ({
    doc: id => doc(path + '/' + id),
    add: async v => { const id = 'a' + Object.keys(store).length; setDoc(path + '/' + id, v); return doc(path + '/' + id); },
  });
  return {
    store, collection: col,
    runTransaction: async fn => fn({ get: async r => r.get(), set: (r, v, o) => setDoc(r.path, v, o) }),
  };
}
const increment = n => ({ __inc: n });
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test('pseudonyms are an adjective and an animal from the mild lists', () => {
  for (let i = 0; i < 200; i++) {
    const [a, b] = makeAlias().split(' ');
    assert.ok(ADJECTIVES.includes(a)); assert.ok(ANIMALS.includes(b));
  }
});

test('first sign-in creates a client profile with a unique pseudonym; second sign-in keeps it', async () => {
  const db = fakeDb();
  const deps = { db, staffEmails: 'michswo@gmail.com', now: () => new Date('2026-10-26T20:00:00Z'), rnd: seq(0, 0, 0, 0, 0.5, 0.5) };
  const first = await bootstrap({ uid: 'u1', email: 'a@example.com' }, deps);
  assert.equal(first.role, 'client'); assert.equal(first.isNew, true); assert.equal(first.pseudonym, 'Amber Albatross');
  const again = await bootstrap({ uid: 'u1', email: 'a@example.com' }, deps);
  assert.equal(again.isNew, false); assert.equal(again.pseudonym, 'Amber Albatross');
  // a second client who draws the same words gets a different alias
  const other = await bootstrap({ uid: 'u2', email: 'b@example.com' }, { ...deps, rnd: seq(0, 0, 0.5, 0.5) });
  assert.equal(other.pseudonym, 'North Manatee');
  assert.equal(db.store['clients/u1'].status, 'new'); assert.equal(db.store['aliases/amber-albatross'].uid, 'u1');
});

test('staff emails get the staff role and never a client status', async () => {
  const db = fakeDb();
  const r = await bootstrap({ uid: 's1', email: 'MichSwo@gmail.com' }, { db, staffEmails: 'michswo@gmail.com, david@example.com' });
  assert.equal(r.role, 'staff'); assert.equal(db.store['clients/s1'].status, 'staff');
});

test('identity lookup is staff-only and leaves an audit entry', async () => {
  const db = fakeDb();
  const deps = { db, staffEmails: 'michswo@gmail.com', getUser: async uid => ({ email: uid + '@example.com', displayName: 'Ada' }), now: () => new Date('2026-10-26T20:00:00Z') };
  await assert.rejects(clientIdentity({ uid: 'x', email: 'x@example.com' }, 'u1', deps), /permission-denied/);
  const r = await clientIdentity({ uid: 's', email: 'michswo@gmail.com' }, 'u1', deps);
  assert.equal(r.email, 'u1@example.com');
  const audit = Object.entries(db.store).find(([k]) => k.startsWith('audit/'))[1];
  assert.equal(audit.by, 'michswo@gmail.com'); assert.equal(audit.target, 'u1');
});

test('page hits aggregate per day without storing the address', async () => {
  const db = fakeDb();
  let geoCalls = 0;
  const deps = { db, increment, hash: s => 'h' + s.length + s.replace(/[^a-z0-9]/gi, '').slice(0, 6), now: () => new Date('2026-10-26T20:00:00Z'), geo: async ip => { geoCalls++; return ip === '1.2.3.4' ? { country: 'US', region: 'Pennsylvania', city: 'Philadelphia' } : null; } };
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
  await recordHit({ path: '/davidsteinberg-site/', route: '#article/rage-is-the-new-hurt', prev: '#services', sid: 'abc123', concept: 'civic', referrer: 'https://www.google.com/', ip: '1.2.3.4', userAgent: ua }, deps);
  await recordHit({ path: '/davidsteinberg-site/', route: '', concept: 'civic', referrer: '', ip: '1.2.3.4', userAgent: ua }, deps);
  await recordHit({ path: '/davidsteinberg-site/sage/', concept: 'sage', referrer: 'https://mswoboda.github.io/x', ip: '5.6.7.8', userAgent: 'Mozilla/5.0 (Macintosh)' }, deps);
  const d = db.store['traffic/2026-10-26'];
  assert.equal(d.views, 3); assert.equal(d.uniques, 2);
  assert.equal(d.paths['_davidsteinberg-site_'], 2); assert.equal(d.concepts.civic, 2); assert.equal(d.concepts.sage, 1);
  assert.equal(d.devices.phone, 2); assert.equal(d.devices.desktop, 1);
  assert.equal(d.referrers['google_com'], 1); assert.equal(Object.keys(d.referrers).length, 1, 'own-site referrers are not counted');
  assert.equal(d.routes['_article_rage-is-the-new-hurt'], 1);
  assert.equal(d.countries.US, 2); assert.equal(d.countries.ZZ, 1); assert.equal(d.regions['US-Pennsylvania'], 2);
  assert.equal(d.flows['_services>_article_rage-is-the-new-hurt'], 1);
  assert.equal(geoCalls, 2, 'one geo look-up per address, cached after');
  const hits = Object.entries(db.store).filter(([k]) => k.startsWith('hits/')).map(([, v]) => v);
  assert.equal(hits.length, 3); assert.equal(hits[0].ipMask, '1.2.x.x'); assert.equal(hits[0].city, 'Philadelphia'); assert.equal(hits[0].first, true); assert.equal(hits[1].first, false);
  assert.ok(!JSON.stringify(d).includes('1.2.3.4')); assert.ok(!JSON.stringify(hits).includes('1.2.3.4'));
});

test('device classes', () => {
  assert.equal(classifyDevice('Mozilla/5.0 (iPad; CPU OS 17)'), 'tablet');
  assert.equal(classifyDevice('Mozilla/5.0 (Linux; Android 14) Mobile'), 'phone');
  assert.equal(classifyDevice('Mozilla/5.0 (Windows NT 10.0)'), 'desktop');
});
