'use strict';
/* The consultation-request handler, free of any Google SDK so it can be tested with plain objects.
   handle(input, deps) -> { status, body }
   input: { method, body, ip, userAgent, origin }
   deps:  { db, sendMail, now } — db is a Firestore-like object (collection().doc().get/set/add), sendMail(msg) -> Promise */

const FIELDS = {
  name: 120, email: 200, phone: 40, message: 2000, page: 300,
};
const LISTS = {
  modality: ['Couples', 'Marriage', 'Individual', 'Divorce recovery', 'Anxiety', 'Trauma', 'Supervision'],
  mode: ['In person · Mt. Airy', 'Video', 'Phone'],
  insurance: ['Independence Blue Cross (IBX)', 'Aetna', 'United Behavioral Health', 'Medicare', 'Highmark', 'Blue Cross Blue Shield', 'Private pay', 'Other / not sure'],
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_DIGITS = 7;
const RATE = { perIpPerHour: 5, perDay: 200 };

const json = (status, body) => ({ status, body });
const str = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const list = (v, allowed) => {
  const arr = Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]);
  return arr.map(x => String(x).trim()).filter(x => allowed.includes(x));
};

function clean(body) {
  const r = {};
  for (const [k, max] of Object.entries(FIELDS)) r[k] = str(body[k], max);
  for (const [k, allowed] of Object.entries(LISTS)) r[k] = list(body[k], allowed);
  return r;
}

function validate(r) {
  const errors = [];
  if (!r.name) errors.push('name');
  if (!EMAIL.test(r.email)) errors.push('email');
  if (r.phone.replace(/\D/g, '').length < PHONE_DIGITS) errors.push('phone');
  if (!r.mode.length) errors.push('mode');
  return errors;
}

function hourKey(d) { return d.toISOString().slice(0, 13); }      // 2026-10-26T15
function dayKey(d) { return d.toISOString().slice(0, 10); }       // 2026-10-26

/* Rate limits live in Firestore too, so the function stays stateless: one doc per (ip, hour) and one per day. */
async function overLimit(db, ip, now) {
  const ipRef = db.collection('ratelimits').doc(`ip_${ip.replace(/[^0-9a-zA-Z]/g, '_')}_${hourKey(now)}`);
  const dayRef = db.collection('ratelimits').doc(`day_${dayKey(now)}`);
  const [ipDoc, dayDoc] = await Promise.all([ipRef.get(), dayRef.get()]);
  const ipCount = (ipDoc.exists && ipDoc.data().count) || 0;
  const dayCount = (dayDoc.exists && dayDoc.data().count) || 0;
  if (ipCount >= RATE.perIpPerHour || dayCount >= RATE.perDay) return true;
  await Promise.all([
    ipRef.set({ count: ipCount + 1, updated: now.toISOString() }),
    dayRef.set({ count: dayCount + 1, updated: now.toISOString() }),
  ]);
  return false;
}

function emailText(r, meta) {
  const line = (k, v) => `${k}: ${v || '—'}`;
  return [
    'New consultation request from the website.', '',
    line('Name', r.name), line('Email', r.email), line('Phone', r.phone), '',
    line('Looking for', r.modality.join(', ')), line('How to meet', r.mode.join(', ')), line('Insurance', r.insurance.join(', ')), '',
    'Message:', r.message || '—', '',
    `Received ${meta.received} · from ${r.page || 'the site'}`,
    `Request id ${meta.id}`,
  ].join('\n');
}

function emailHtml(r, meta) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const row = (k, v) => `<tr><td style="padding:6px 12px 6px 0;color:#667;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 0">${v ? esc(v) : '—'}</td></tr>`;
  return `<div style="font:15px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1d2330;max-width:560px">
  <p style="margin:0 0 12px;font-size:17px"><strong>New consultation request</strong></p>
  <table style="border-collapse:collapse">
    ${row('Name', r.name)}${row('Email', `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>`)}${row('Phone', `<a href="tel:${esc(r.phone.replace(/[^\d+]/g, ''))}">${esc(r.phone)}</a>`)}
    ${row('Looking for', r.modality.join(', '))}${row('How to meet', r.mode.join(', '))}${row('Insurance', r.insurance.join(', '))}
  </table>
  <p style="margin:14px 0 4px;color:#667">Message</p>
  <p style="margin:0;white-space:pre-wrap">${r.message ? esc(r.message) : '—'}</p>
  <p style="margin:18px 0 0;font-size:12px;color:#889">Received ${esc(meta.received)} · ${esc(r.page || 'the site')} · id ${esc(meta.id)}</p>
</div>`;
}

async function handle(input, deps) {
  const now = deps.now ? deps.now() : new Date();
  if (input.method === 'OPTIONS') return json(204, '');
  if (input.method !== 'POST') return json(405, { error: 'method' });
  const body = input.body && typeof input.body === 'object' ? input.body : null;
  if (!body) return json(400, { error: 'json' });
  // honeypot: real forms leave "website" empty; bots fill it. Answer ok so they go away.
  if (str(body.website, 10)) return json(200, { ok: true });

  const r = clean(body);
  const errors = validate(r);
  if (errors.length) return json(400, { error: 'fields', fields: errors });

  const ip = str(input.ip, 60) || 'unknown';
  if (await overLimit(deps.db, ip, now)) return json(429, { error: 'rate' });

  const received = now.toISOString();
  const doc = {
    ...r, received, status: 'new',
    ip, userAgent: str(input.userAgent, 200), origin: str(input.origin, 120),
    emailed: false,
  };
  const ref = await deps.db.collection('requests').add(doc);
  const meta = { id: ref.id, received };

  let emailed = false, emailError = '';
  try {
    await deps.sendMail({
      subject: `Consultation request — ${r.name}`,
      replyTo: `${r.name} <${r.email}>`,
      text: emailText(r, meta),
      html: emailHtml(r, meta),
    });
    emailed = true;
  } catch (e) {
    emailError = String(e && e.message || e).slice(0, 300);
  }
  await ref.set({ emailed, emailError }, { merge: true });
  // The request is saved either way; a mail failure is logged on the document, never shown as a failure to the visitor.
  return json(200, { ok: true, id: ref.id });
}

module.exports = { handle, clean, validate, FIELDS, LISTS, RATE };
