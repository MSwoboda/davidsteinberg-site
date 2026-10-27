'use strict';
/* HTTPS endpoint: POST /consultationRequest with the form as JSON.
   Stores the request in Firestore (collection "requests") and emails the practice through Gmail.
   Configuration:
     functions/.env      GMAIL_USER (the Gmail / Workspace address that sends; 2-step verification on)
                         NOTIFY_TO  (where requests go; comma-separated for several; defaults to GMAIL_USER)
     secret              GMAIL_APP_PASSWORD — an app password for GMAIL_USER (Google Account → Security → App passwords),
                         stored in Secret Manager: `firebase functions:secrets:set GMAIL_APP_PASSWORD` or the Cloud Console */
const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { handle } = require('./lib/handle');
const portal = require('./lib/portal');

setGlobalOptions({ region: 'us-east4', maxInstances: 3, memory: '256MiB', timeoutSeconds: 30 });
admin.initializeApp();

const GMAIL_USER = defineString('GMAIL_USER');
const NOTIFY_TO = defineString('NOTIFY_TO', { default: '' });
const STAFF_EMAILS = defineString('STAFF_EMAILS', { default: '' });        // who may open the admin dashboard
const NOTIFY_DETAIL = defineString('NOTIFY_DETAIL', { default: 'full' });  // 'full' = whole request in the email; 'ping' = name + dashboard link only
const TRAFFIC_SALT = defineString('TRAFFIC_SALT', { default: 'change-me' }); // salts the daily visitor hash
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');

exports.consultationRequest = onRequest({ cors: true, secrets: [GMAIL_APP_PASSWORD] }, async (req, res) => {
  const user = GMAIL_USER.value();
  const transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass: GMAIL_APP_PASSWORD.value() } });
  const to = (NOTIFY_TO.value() || user).split(',').map(s => s.trim()).filter(Boolean);
  const sendMail = msg => transport.sendMail({ from: `"davidsteinberg.com" <${user}>`, to, ...msg });

  const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
  const out = await handle(
    { method: req.method, body: req.body, ip, userAgent: req.headers['user-agent'], origin: req.headers.origin },
    { db: admin.firestore(), sendMail, detail: NOTIFY_DETAIL.value() === 'ping' ? 'ping' : 'full' },
  );
  res.status(out.status);
  if (out.body === '') res.end(); else res.json(out.body);
});

/* ---------- portal: sign-in bootstrap ----------
   Called by the portal and the dashboard right after Google sign-in. Creates clients/{uid} with a pseudonym on
   first sign-in, refreshes lastSeen after, and sets the `staff` custom claim for addresses in STAFF_EMAILS so the
   Firestore rules can tell staff from clients. Returns { role, pseudonym, status, coupleId, assigned, isNew }. */
exports.bootstrap = onCall({ cors: true }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const user = { uid: req.auth.uid, email: req.auth.token.email || '' };
  const out = await portal.bootstrap(user, { db: admin.firestore(), staffEmails: STAFF_EMAILS.value() });
  const wantStaff = out.role === 'staff';
  if (!!req.auth.token.staff !== wantStaff) {
    await admin.auth().setCustomUserClaims(req.auth.uid, { staff: wantStaff });
    out.claimsChanged = true;       // the client refreshes its ID token
  }
  return out;
});

/* ---------- dashboard: who is this pseudonym? (staff only, audited) ---------- */
exports.clientIdentity = onCall({ cors: true }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  try {
    return await portal.clientIdentity({ uid: req.auth.uid, email: req.auth.token.email || '' }, req.data && req.data.uid, {
      db: admin.firestore(), staffEmails: STAFF_EMAILS.value(), getUser: uid => admin.auth().getUser(uid),
    });
  } catch (e) { throw new HttpsError(e.code || 'internal', e.message); }
});

/* ---------- dashboard: list client accounts with their sign-in email (staff only, audited once per listing) ---------- */
exports.listClientAccounts = onCall({ cors: true }, async (req) => {
  if (!req.auth || !portal.isStaff(req.auth.token.email, STAFF_EMAILS.value())) throw new HttpsError('permission-denied', 'Staff only.');
  const db = admin.firestore();
  const snap = await db.collection('clients').get();
  const uids = snap.docs.map(d => d.id);
  const users = uids.length ? (await admin.auth().getUsers(uids.map(uid => ({ uid })))).users : [];
  const byUid = Object.fromEntries(users.map(u => [u.uid, u]));
  await db.collection('audit').add({ at: new Date().toISOString(), by: req.auth.token.email, action: 'list-identities', count: uids.length });
  return snap.docs.map(d => { const u = byUid[d.id] || {}; return { uid: d.id, ...d.data(), email: u.email || '', displayName: u.displayName || '', lastSignIn: (u.metadata && u.metadata.lastSignInTime) || '' }; });
});

/* country / region of an address, from ipapi.co (free tier, no key; called about once per visitor thanks to the cache) */
async function geoLookup(ip) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
  try {
    const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { signal: ctl.signal, headers: { 'User-Agent': 'davidsteinberg.com traffic counter' } });
    if (!r.ok) return null; const j = await r.json(); if (j.error) return null;
    return { country: j.country_code || '', region: j.region || '', city: j.city || '' };
  } catch (e) { return null; } finally { clearTimeout(t); }
}

/* ---------- public site: page-view counter (no cookies, no stored address) ---------- */
exports.pageHit = onRequest({ cors: true }, async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  if (!b || typeof b !== 'object') b = {};
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
  const salt = TRAFFIC_SALT.value();
  try {
    await portal.recordHit({ path: b.path, route: b.route, prev: b.prev, sid: b.sid, concept: b.concept, referrer: b.referrer, ip, userAgent: req.headers['user-agent'] }, {
      db: admin.firestore(), increment: n => admin.firestore.FieldValue.increment(n),
      hash: s => crypto.createHash('sha256').update(salt + '|' + s).digest('hex').slice(0, 32),
      geo: geoLookup,
    });
  } catch (e) { console.error('pageHit', e); }
  res.status(204).end();
});
