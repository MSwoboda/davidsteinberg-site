'use strict';
/* Portal logic without the Firebase SDK, so it can be tested with plain objects.
   - bootstrap:       first sign-in creates clients/{uid} with a pseudonym; staff get their role from STAFF_EMAILS
   - clientIdentity:  staff asks who a pseudonym is (email + display name from Auth), every lookup is written to audit/
   - recordHit:       the public site's page-view counter (no raw IP, no cookies) */
const { reserveAlias } = require('./alias');

const staffList = env => String(env || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
const isStaff = (email, env) => !!email && staffList(env).includes(String(email).toLowerCase());

/* deps: { db, now, staffEmails, rnd } ; user: { uid, email } (from the verified token) */
async function bootstrap(user, deps) {
  if (!user || !user.uid) throw Object.assign(new Error('unauthenticated'), { code: 'unauthenticated' });
  const now = (deps.now ? deps.now() : new Date()).toISOString();
  const staff = isStaff(user.email, deps.staffEmails);
  const ref = deps.db.collection('clients').doc(user.uid);
  const snap = await ref.get();
  let profile;
  if (snap.exists) {
    profile = snap.data();
    await ref.set({ lastSeen: now }, { merge: true });
  } else {
    const pseudonym = await reserveAlias(deps.db, user.uid, deps.rnd);
    profile = { pseudonym, status: staff ? 'staff' : 'new', coupleId: null, assigned: [], createdAt: now, lastSeen: now };
    await ref.set(profile);
  }
  return { role: staff ? 'staff' : 'client', pseudonym: profile.pseudonym, status: profile.status, coupleId: profile.coupleId || null, assigned: profile.assigned || [], isNew: !snap.exists };
}

/* deps: { db, now, staffEmails, getUser(uid) -> { email, displayName, phoneNumber } } ; caller: { uid, email } */
async function clientIdentity(caller, targetUid, deps) {
  if (!caller || !isStaff(caller.email, deps.staffEmails)) throw Object.assign(new Error('permission-denied'), { code: 'permission-denied' });
  if (!targetUid || typeof targetUid !== 'string') throw Object.assign(new Error('invalid-argument'), { code: 'invalid-argument' });
  const u = await deps.getUser(targetUid);
  const now = (deps.now ? deps.now() : new Date()).toISOString();
  await deps.db.collection('audit').add({ at: now, by: caller.email, action: 'identity', target: targetUid });
  return { email: u.email || '', displayName: u.displayName || '', phoneNumber: u.phoneNumber || '' };
}

/* Traffic: one document per day, counters only. The visitor key is a salted hash of ip + user agent + day,
   so uniques can be counted without keeping the address. */
const key = s => String(s || '').replace(/[.~*/\[\]#$]/g, '_').slice(0, 120) || '_';
function classifyDevice(ua) {
  ua = String(ua || '');
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'phone';
  return 'desktop';
}
/* Where is this address from? deps.geo(ip) -> { country, region, city } or null (ipapi.co; the result is cached
   30 days under a salted hash of the address, so the look-up runs about once per visitor, not per view). */
async function locate(ip, deps) {
  if (!deps.geo || !ip || /^(10\.|192\.168\.|127\.|::1|fc|fd)/.test(ip)) return null;
  const id = deps.hash('geo|' + ip);
  const ref = deps.db.collection('geo').doc(id);
  try {
    const snap = await ref.get();
    if (snap.exists) { const d = snap.data(); if (Date.now() - new Date(d.at).getTime() < 30 * 864e5) return d; }
    const g = await deps.geo(ip);
    if (g) await ref.set({ country: g.country || '', region: g.region || '', city: g.city || '', at: new Date().toISOString() });
    return g;
  } catch (e) { return null; }
}
async function recordHit(hit, deps) {
  const now = deps.now ? deps.now() : new Date();
  const day = now.toISOString().slice(0, 10);
  const path = key((hit.path || '/').split('?')[0]).slice(0, 80);
  const route = hit.route ? key(hit.route).slice(0, 80) : '';
  const prev = hit.prev ? key(hit.prev).slice(0, 80) : '';
  const concept = ['civic', 'nouveau', 'sage'].includes(hit.concept) ? hit.concept : 'other';
  let ref = '';
  try { ref = hit.referrer ? new URL(hit.referrer).hostname.replace(/^www\./, '') : ''; } catch (e) { ref = ''; }
  if (ref && /(^|\.)(mswoboda\.github\.io|davidsteinberg\.com|davidsteinberg-site\.web\.app|davidsteinberg-site\.firebaseapp\.com|localhost)$/.test(ref)) ref = '';
  const device = classifyDevice(hit.userAgent);
  const visitor = deps.hash(`${hit.ip}|${hit.userAgent}|${day}`);
  const sid = /^[a-z0-9]{4,24}$/i.test(hit.sid || '') ? hit.sid : visitor.slice(0, 12);
  const geo = await locate(hit.ip, deps);
  const country = geo && geo.country ? String(geo.country).slice(0, 2).toUpperCase() : 'ZZ';
  const region = geo && geo.region ? `${country}-${key(geo.region).slice(0, 40)}` : '';
  const dayRef = deps.db.collection('traffic').doc(day);
  const visRef = dayRef.collection('visitors').doc(visitor);
  const inc = deps.increment; let first = false;
  await deps.db.runTransaction(async tx => {
    const v = await tx.get(visRef);
    first = !v.exists;
    /* nested maps, not dotted keys: set(..., {merge:true}) treats "paths.x" as a literal field name */
    const upd = { day, views: inc(1), paths: { [path]: inc(1) }, concepts: { [concept]: inc(1) }, devices: { [device]: inc(1) }, countries: { [country]: inc(1) } };
    if (route) upd.routes = { [route]: inc(1) };
    if (ref) upd.referrers = { [key(ref)]: inc(1) };
    if (region) upd.regions = { [region]: inc(1) };
    const here = route || '_'; if (prev && prev !== here) upd.flows = { [`${prev}>${here}`]: inc(1) };
    if (first) { upd.uniques = inc(1); tx.set(visRef, { at: now.toISOString() }); }
    tx.set(dayRef, upd, { merge: true });
  });
  /* recent-visits log for the dashboard: one row per view, no address (the masked prefix only), pruned by the dashboard query */
  await deps.db.collection('hits').add({ at: now.toISOString(), day, visitor: visitor.slice(0, 10), sid, path: hit.path ? String(hit.path).slice(0, 120) : '/', route: hit.route ? String(hit.route).slice(0, 120) : '', prev: hit.prev ? String(hit.prev).slice(0, 120) : '', ref, device, country, region: geo && geo.region ? String(geo.region).slice(0, 40) : '', city: geo && geo.city ? String(geo.city).slice(0, 40) : '', ipMask: maskIp(hit.ip), first });
  return { ok: true };
}
/* 203.0.113.42 -> 203.0.x.x ; 2001:db8:abcd:: -> 2001:db8:x */
function maskIp(ip) { ip = String(ip || ''); if (ip.includes(':')) return ip.split(':').slice(0, 2).join(':') + ':x'; const p = ip.split('.'); return p.length === 4 ? `${p[0]}.${p[1]}.x.x` : ''; }

module.exports = { bootstrap, clientIdentity, recordHit, locate, maskIp, isStaff, staffList, classifyDevice };
