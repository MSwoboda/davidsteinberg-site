'use strict';
/* The consultation-request handler, free of any Google SDK so it can be tested with plain objects.
   handle(input, deps) -> { status, body }
   input: { method, body, ip, userAgent, origin }
   deps:  { db, sendMail, now, detail } — db is a Firestore-like object (collection().doc().get/set/add), sendMail(msg) -> Promise,
          detail 'full' | 'ping' picks the email body (NOTIFY_DETAIL) */

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

/* ---------- the notification email ----------
   detail = 'full' (default): the whole submission, styled like the site.
   detail = 'ping': name and a dashboard link only — for when the inbox is outside the BAA. */
const DASHBOARD = 'https://davidsteinberg-site.web.app/admin/#requests';
function when(iso) {
  try {
    return new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET';
  } catch (e) { return iso; }
}
function emailText(r, meta, detail = 'full') {
  if (detail === 'ping') return [`New consultation request from ${r.name}.`, '', `Open it in the dashboard: ${DASHBOARD}`, '', `Received ${when(meta.received)} · id ${meta.id}`].join('\n');
  const line = (k, v) => `${k}: ${v || '—'}`;
  return [
    `New consultation request from ${r.name}`, '',
    line('Email', r.email), line('Phone', r.phone), '',
    line('Looking for', r.modality.join(', ')), line('How to meet', r.mode.join(', ')), line('Insurance', r.insurance.join(', ')), '',
    'Message:', r.message || '—', '',
    `Received ${when(meta.received)} · from ${r.page || 'the site'} · id ${meta.id}`,
    `Dashboard: ${DASHBOARD}`,
  ].join('\n');
}
function emailHtml(r, meta, detail = 'full') {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const F = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  const navy = '#1f2f4d', ink = '#1d2330', muted = '#6b7280', line = '#e4e0d6', paper = '#f7f5f0', cream = '#fbfaf7';
  const pill = v => `<span style="display:inline-block;${F};font-size:13px;color:${navy};background:#eaeef5;border:1px solid #d5dce9;border-radius:999px;padding:3px 10px;margin:0 6px 6px 0">${esc(v)}</span>`;
  const pills = arr => arr.length ? arr.map(pill).join('') : `<span style="color:${muted}">—</span>`;
  const row = (k, vHtml) => `<tr><td style="${F};font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${muted};padding:10px 16px 10px 0;white-space:nowrap;vertical-align:top;width:110px">${k}</td><td style="${F};font-size:15px;color:${ink};padding:8px 0;vertical-align:top">${vHtml}</td></tr>`;
  const sep = `<tr><td colspan="2" style="border-top:1px solid ${line};padding:0;height:1px;line-height:1px;font-size:1px">&nbsp;</td></tr>`;
  const btn = (href, label, primary) => `<a href="${esc(href)}" style="display:inline-block;${F};font-size:14px;font-weight:600;text-decoration:none;border-radius:999px;padding:10px 18px;margin:0 8px 8px 0;${primary ? `background:${navy};color:#ffffff` : `color:${navy};border:1px solid ${navy}`}">${label}</a>`;
  const tel = r.phone.replace(/[^\d+]/g, '');
  const header = `
    <tr><td style="background:${navy};padding:18px 28px">
      <table role="presentation" cellspacing="0" cellpadding="0"><tr>
        <td style="width:34px;height:34px;background:#ffffff;border-radius:7px;text-align:center;${F};font-family:Georgia,'Times New Roman',serif;font-size:15px;color:${navy};font-weight:600">DS</td>
        <td style="padding-left:12px;${F};font-size:15px;color:#ffffff"><span style="font-family:Georgia,'Times New Roman',serif;font-size:17px">David Steinberg</span><span style="color:#b9c4d8">, PhD, LCSW</span><br><span style="font-size:12px;color:#b9c4d8;letter-spacing:.04em">davidsteinberg.com · consultation request</span></td>
      </tr></table>
    </td></tr>`;
  const footer = `
    <tr><td style="padding:14px 28px 22px;${F};font-size:12px;color:${muted};line-height:1.6">
      Received ${esc(when(meta.received))}${r.page ? ` · from ${esc(r.page)}` : ''} · request <span style="font-family:Menlo,Consolas,monospace">${esc(meta.id)}</span><br>
      Sent by the website's contact form. Replying to this email replies to ${esc(r.name)}.
    </td></tr>`;
  const body = detail === 'ping'
    ? `<tr><td style="padding:26px 28px 8px">
        <p style="margin:0 0 6px;${F};font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:${muted}">New consultation request</p>
        <p style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.2;color:${ink}">${esc(r.name)}</p>
        <p style="margin:0 0 20px;${F};font-size:15px;color:${ink}">The details are in the dashboard.</p>
        ${btn(DASHBOARD, 'Open in dashboard', true)}
      </td></tr>`
    : `<tr><td style="padding:26px 28px 8px">
        <p style="margin:0 0 6px;${F};font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:${muted}">New consultation request</p>
        <p style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.2;color:${ink}">${esc(r.name)}</p>
        ${btn(`mailto:${r.email}`, 'Reply by email', true)}${tel ? btn(`tel:${tel}`, `Call ${esc(r.phone)}`, false) : ''}${btn(DASHBOARD, 'Open in dashboard', false)}
      </td></tr>
      <tr><td style="padding:10px 28px 6px">
        <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse">
          ${row('Email', `<a href="mailto:${esc(r.email)}" style="color:${navy}">${esc(r.email)}</a>`)}
          ${row('Phone', tel ? `<a href="tel:${esc(tel)}" style="color:${navy}">${esc(r.phone)}</a>` : '—')}
          ${sep}
          ${row('Looking for', pills(r.modality))}
          ${row('How to meet', pills(r.mode))}
          ${row('Insurance', pills(r.insurance))}
        </table>
      </td></tr>
      <tr><td style="padding:8px 28px 10px">
        <p style="margin:0 0 8px;${F};font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${muted}">Message</p>
        <div style="${F};font-size:15px;line-height:1.55;color:${ink};background:${cream};border-left:3px solid ${navy};border-radius:0 8px 8px 0;padding:14px 16px;white-space:pre-wrap">${r.message ? esc(r.message) : '<span style="color:' + muted + '">No message.</span>'}</div>
      </td></tr>`;
  return `<!doctype html><html><body style="margin:0;padding:0;background:${paper}">
  <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;background:${paper}"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${line};border-radius:12px;overflow:hidden">
      ${header}${body}${footer}
    </table>
  </td></tr></table>
</body></html>`;
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

  const outcome = {};
  /* hand the submission to an outside system (LuxSci SecureForm) when one is configured */
  if (deps.forward) {
    try { await deps.forward(r, meta); outcome.forwarded = true; outcome.forwardError = ''; }
    catch (e) { outcome.forwarded = false; outcome.forwardError = String(e && e.message || e).slice(0, 300); }
  }
  /* the notification email, unless turned off (detail 'none') */
  if (deps.detail !== 'none' && deps.sendMail) {
    try {
      await deps.sendMail({
        subject: deps.detail === 'ping' ? 'New consultation request' : `Consultation request — ${r.name}`,
        replyTo: `${r.name} <${r.email}>`,
        text: emailText(r, meta, deps.detail),
        html: emailHtml(r, meta, deps.detail),
      });
      outcome.emailed = true; outcome.emailError = '';
    } catch (e) { outcome.emailed = false; outcome.emailError = String(e && e.message || e).slice(0, 300); }
  } else { outcome.emailed = null; }
  await ref.set(outcome, { merge: true });
  // The request is saved either way; a mail or forwarding failure is logged on the document, never shown as a failure to the visitor.
  return json(200, { ok: true, id: ref.id });
}

/* ---------- LuxSci SecureForm forwarder ----------
   SecureForm takes an ordinary form POST, but to a URL that carries a signed token its script hands out per page
   load. So: fetch that script, read the token out of it, POST the fields the LuxSci form defines. Fields not in the
   LuxSci form (what they are looking for, how they want to meet) are folded into the question text.
   Returns the thank-you URL SecureForm answers with. */
function secureFormForwarder(formId, fetchFn = fetch) {
  const base = 'https://secureform.luxsci.com';
  return async function forward(r) {
    const js = await (await fetchFn(`${base}/intranet/php/secureform.php?v=1&c=${formId}&f=secureform`, { headers: { 'User-Agent': 'davidsteinberg.com form relay' } })).text();
    const m = js.match(new RegExp(`"(\\d+)"\\s*\\+\\s*":"\\s*\\+\\s*"${formId.replace(/[-]/g, '\\-')}"\\s*\\+\\s*":(\\d+):"\\s*\\+\\s*"([0-9a-f]{64})"`));
    if (!m) throw new Error('SecureForm token not found');
    const token = `${m[1]}:${formId}:${m[2]}:${m[3]}:${Math.floor(Date.now() / 1000)}`;
    const extras = [r.modality.length ? `Looking for: ${r.modality.join(', ')}` : '', r.mode.length ? `How to meet: ${r.mode.join(', ')}` : ''].filter(Boolean).join('\n');
    const body = new URLSearchParams({
      Fullname: r.name, email: r.email, phone: r.phone, insurance: r.insurance.join(', '),
      question: [r.message, extras, `Sent from ${r.page || 'davidsteinberg.com'}`].filter(Boolean).join('\n\n'),
      __ajax__submit__: '1',
    });
    const res = await fetchFn(`${base}/perl/post/${formId}/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'davidsteinberg.com form relay', Origin: 'https://davidsteinberg.com', Referer: 'https://davidsteinberg.com/' }, body });
    const text = await res.text();
    if (!res.ok) throw new Error(`SecureForm ${res.status}: ${text.slice(0, 120)}`);
    return text.trim();
  };
}

module.exports = { handle, clean, validate, emailHtml, emailText, secureFormForwarder, FIELDS, LISTS, RATE };
