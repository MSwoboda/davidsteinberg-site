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
async function recordHit(hit, deps) {
  const now = deps.now ? deps.now() : new Date();
  const day = now.toISOString().slice(0, 10);
  const path = key((hit.path || '/').split('?')[0]).slice(0, 80);
  const route = key(hit.route || '').slice(0, 80);
  const concept = ['civic', 'nouveau', 'sage'].includes(hit.concept) ? hit.concept : 'other';
  let ref = '';
  try { ref = hit.referrer ? new URL(hit.referrer).hostname.replace(/^www\./, '') : ''; } catch (e) { ref = ''; }
  if (ref && /(^|\.)(mswoboda\.github\.io|davidsteinberg\.com|localhost)$/.test(ref)) ref = '';
  const device = classifyDevice(hit.userAgent);
  const visitor = deps.hash(`${hit.ip}|${hit.userAgent}|${day}`);
  const dayRef = deps.db.collection('traffic').doc(day);
  const visRef = dayRef.collection('visitors').doc(visitor);
  const inc = deps.increment;
  await deps.db.runTransaction(async tx => {
    const v = await tx.get(visRef);
    const first = !v.exists;
    const upd = { day, views: inc(1), [`paths.${path}`]: inc(1), [`concepts.${concept}`]: inc(1), [`devices.${device}`]: inc(1) };
    if (route) upd[`routes.${route}`] = inc(1);
    if (ref) upd[`referrers.${key(ref)}`] = inc(1);
    if (first) { upd.uniques = inc(1); tx.set(visRef, { at: now.toISOString() }); }
    tx.set(dayRef, upd, { merge: true });
  });
  return { ok: true };
}

module.exports = { bootstrap, clientIdentity, recordHit, isStaff, staffList, classifyDevice };
