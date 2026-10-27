/* Practice dashboard. Sections: overview, requests, clients, assessments (assess.js), site content (content.js), traffic, audit.
   All data via window.API. Shared helpers live on window.ADMIN for the other files. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const app = $('#app');
  const tpl = id => document.getElementById(id).content.cloneNode(true);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtDate = s => s ? new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
  const fmtDay = s => s ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
  const ago = s => { if (!s) return '—'; const d = (Date.now() - new Date(s)) / 864e5; return d < 1 ? 'today' : d < 2 ? 'yesterday' : Math.round(d) + ' days ago'; };
  const STATUS = { new: ['New', 'new'], called: ['Called', 'warn'], scheduled: ['Scheduled', 'ok'], closed: ['Closed', ''] };
  const CSTATUS = { new: ['Awaiting confirmation', 'warn'], active: ['Active', 'ok'], inactive: ['Inactive', ''], staff: ['Staff', 'ok'] };
  const chip = (map, s) => { const [l, c] = map[s] || [s, '']; return `<span class="chip ${c}">${esc(l)}</span>`; };
  let me = null, main = null, cache = {};
  const A = window.ADMIN = { $, $$, esc, fmtDate, fmtDay, ago, chip, cache, sections: {}, get main() { return main; } };

  const root = document.documentElement;
  try { const t = localStorage.getItem('ds-mode'); if (t === 'dark' || t === 'light') root.dataset.theme = t; } catch (e) {}
  $('#theme').addEventListener('click', () => { const dark = root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches); root.dataset.theme = dark ? 'light' : 'dark'; try { localStorage.setItem('ds-mode', root.dataset.theme); } catch (e) {} });
  if (API.isDemo) { const b = document.createElement('div'); b.className = 'demo-badge'; b.textContent = 'Demo data · nothing is saved'; document.body.appendChild(b); }

  function showSignIn() { $('#who').hidden = true; app.innerHTML = ''; app.appendChild(tpl('t-signin')); $('#signin').addEventListener('click', async e => { e.target.disabled = true; try { await API.signIn(); } catch (err) { e.target.disabled = false; alert('Sign-in did not complete. ' + (err && err.message || '')); } }); }
  function drawer(html) { $('#drawer-body').innerHTML = html; $('#drawer').classList.add('open'); $('#drawer .panel').scrollTop = 0; }
  function closeDrawer() { $('#drawer').classList.remove('open'); }
  A.drawer = drawer; A.closeDrawer = closeDrawer;

  /* ---------- overview ---------- */
  async function overview() {
    const [reqs, clients, traffic, resps, qs, published] = await Promise.all([API.listRequests(), API.listClients(), API.listTraffic(), API.listAllResponses(), API.listQuestionnaires(), API.getSite('published').catch(() => null)]);
    Object.assign(cache, { reqs, clients, traffic, resps, qs });
    const twoDays = Date.now() - 2 * 864e5;
    const attention = [
      ...reqs.filter(r => r.emailed === false).map(r => ({ kind: 'danger', text: `Notification email failed for <strong>${esc(r.name)}</strong> — the request is saved, open it to follow up.`, href: '#requests', req: r.id })),
      ...reqs.filter(r => r.status === 'new' && new Date(r.received) < twoDays).map(r => ({ kind: 'warn', text: `<strong>${esc(r.name)}</strong> asked for a consultation ${ago(r.received)} and has not been contacted.`, req: r.id })),
      ...resps.filter(r => r.status === 'submitted' && !r.reviewedAt).map(r => { const c = clients.find(x => x.uid === r.uid), q = qs.find(x => x.id === r.qid); return { kind: 'new', text: `<strong>${esc(c ? c.pseudonym : r.uid)}</strong> submitted <em>${esc(q ? q.title : r.qid)}</em> ${ago(r.submittedAt)} — not reviewed yet.`, client: r.uid }; }),
      ...clients.filter(c => c.status === 'new').map(c => ({ kind: 'warn', text: `<strong>${esc(c.pseudonym)}</strong> created a portal account ${ago(c.createdAt)} and is awaiting confirmation.`, client: c.uid })),
    ];
    const last7 = traffic.slice().sort((a, b) => b.day.localeCompare(a.day)).slice(0, 7);
    const views7 = last7.reduce((a, d) => a + (d.views || 0), 0), uni7 = last7.reduce((a, d) => a + (d.uniques || 0), 0);
    const newReqs = reqs.filter(r => r.status === 'new');
    main.innerHTML = `
      <h1>Overview</h1>
      <div class="grid stats" style="margin-bottom:18px">
        <div class="card stat"><div class="n">${newReqs.length}</div><div class="l">new requests</div></div>
        <div class="card stat"><div class="n">${clients.filter(c => c.status === 'active').length}</div><div class="l">active clients</div></div>
        <div class="card stat"><div class="n">${clients.filter(c => c.status === 'new').length}</div><div class="l">awaiting confirmation</div></div>
        <div class="card stat"><div class="n">${views7}</div><div class="l">page views · 7 days</div></div>
        <div class="card stat"><div class="n">${uni7}</div><div class="l">visitors · 7 days</div></div>
      </div>
      ${attention.length ? `<section class="card" style="margin-bottom:16px"><h2>Needs attention <span class="chip warn">${attention.length}</span></h2><ul class="attention">${attention.slice(0, 10).map(a => `<li class="${a.kind}"${a.req ? ` data-req="${esc(a.req)}"` : a.client ? ` data-client="${esc(a.client)}"` : ''}><span>${a.text}</span></li>`).join('')}</ul>${attention.length > 10 ? `<p class="muted small">and ${attention.length - 10} more</p>` : ''}</section>` : '<section class="card" style="margin-bottom:16px"><p class="muted" style="margin:0">Nothing needs attention right now.</p></section>'}
      <div class="grid two">
        <section class="card"><div class="row between"><h2 style="margin:0">Latest requests</h2><a class="btn quiet sm" href="#requests">All</a></div>
          <div class="table-wrap"><table class="table"><tbody>${reqs.slice(0, 5).map(r => `<tr class="clickable" data-req="${esc(r.id)}"><td><strong>${esc(r.name)}</strong><br><span class="muted small">${esc((r.modality || []).join(', ') || '—')} · ${esc((r.mode || []).join(', '))}</span></td><td class="small muted">${fmtDate(r.received)}</td><td>${chip(STATUS, r.status)}</td></tr>`).join('') || '<tr><td class="muted">No requests yet.</td></tr>'}</tbody></table></div></section>
        <section class="card"><div class="row between"><h2 style="margin:0">Recently active clients</h2><a class="btn quiet sm" href="#clients">All</a></div>
          <div class="table-wrap"><table class="table"><tbody>${clients.filter(c => c.status !== 'staff').sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || '')).slice(0, 5).map(c => `<tr class="clickable" data-client="${esc(c.uid)}"><td><strong>${esc(c.pseudonym)}</strong><br><span class="muted small">${(c.assigned || []).length} assigned · seen ${ago(c.lastSeen)}</span></td><td>${chip(CSTATUS, c.status)}</td></tr>`).join('') || '<tr><td class="muted">No clients yet.</td></tr>'}</tbody></table></div></section>
      </div>
      <section class="card" style="margin-top:16px"><div class="row between"><h2 style="margin:0">Traffic · last 30 days</h2><a class="btn quiet sm" href="#traffic">Details</a></div>${chart(traffic)}</section>
      <p class="muted small" style="margin-top:14px">Site content: ${published ? `published ${fmtDate(published.updatedAt)} by ${esc(published.updatedBy || '')}` : 'the site is showing the built-in content; nothing published from here yet'} · <a href="#content">edit</a></p>`;
    $$('[data-req]', main).forEach(tr => tr.addEventListener('click', () => openRequest(tr.dataset.req)));
    $$('[data-client]', main).forEach(tr => tr.addEventListener('click', () => openClient(tr.dataset.client)));
  }

  /* ---------- requests ---------- */
  let reqFilter = 'open';
  async function requests() {
    const reqs = cache.reqs = await API.listRequests();
    const show = reqs.filter(r => reqFilter === 'all' ? true : reqFilter === 'open' ? r.status !== 'closed' : r.status === reqFilter);
    main.innerHTML = `<div class="row between" style="margin-bottom:14px"><h1 style="margin:0">Consultation requests</h1><div class="pill-tabs">${['open', 'new', 'called', 'scheduled', 'closed', 'all'].map(f => `<button type="button" data-f="${f}" aria-selected="${f === reqFilter}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}</div></div>
      <section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Received</th><th>Name</th><th>Looking for</th><th>Meet</th><th>Insurance</th><th>Status</th><th></th></tr></thead><tbody>
      ${show.map(r => `<tr class="clickable" data-req="${esc(r.id)}"><td class="small">${fmtDate(r.received)}</td><td><strong>${esc(r.name)}</strong><br><span class="muted small">${esc(r.email)} · ${esc(r.phone)}</span></td><td class="small">${esc((r.modality || []).join(', ') || '—')}</td><td class="small">${esc((r.mode || []).join(', '))}</td><td class="small">${esc((r.insurance || []).join(', ') || '—')}</td><td>${chip(STATUS, r.status)}${r.emailed === false ? ' <span class="chip danger" title="' + esc(r.emailError || '') + '">email failed</span>' : ''}</td><td class="actions"><button class="btn sm" type="button">Open</button></td></tr>`).join('') || `<tr><td colspan="7"><div class="empty">Nothing here.</div></td></tr>`}
      </tbody></table></div></section>`;
    $$('[data-f]', main).forEach(b => b.addEventListener('click', () => { reqFilter = b.dataset.f; requests(); }));
    $$('[data-req]', main).forEach(tr => tr.addEventListener('click', () => openRequest(tr.dataset.req)));
  }
  function openRequest(id) {
    const r = (cache.reqs || []).find(x => x.id === id); if (!r) return;
    drawer(`<p class="kicker">Request · ${fmtDate(r.received)}</p><h2>${esc(r.name)}</h2>
      <p><a href="mailto:${esc(r.email)}">${esc(r.email)}</a> · <a href="tel:${esc(r.phone)}">${esc(r.phone)}</a></p>
      <div class="grid two" style="margin:12px 0">
        <div><p class="kicker">Looking for</p><p>${esc((r.modality || []).join(', ') || '—')}</p></div>
        <div><p class="kicker">How to meet</p><p>${esc((r.mode || []).join(', ') || '—')}</p></div>
        <div><p class="kicker">Insurance</p><p>${esc((r.insurance || []).join(', ') || '—')}</p></div>
        <div><p class="kicker">From</p><p class="small muted">${esc((r.page || '').replace(/^https?:\/\//, ''))}</p></div>
      </div>
      <p class="kicker">Message</p><p style="white-space:pre-wrap">${esc(r.message || '—')}</p>
      ${r.emailed === false ? `<p class="notice warn">The notification email failed (${esc(r.emailError || 'unknown error')}). The request itself is saved.</p>` : ''}
      <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
      <div class="field"><label>Status</label><select data-status>${Object.keys(STATUS).map(s => `<option value="${s}" ${s === r.status ? 'selected' : ''}>${STATUS[s][0]}</option>`).join('')}</select></div>
      <div class="field"><label>Notes</label><textarea data-notes placeholder="Called, left message, scheduled for…">${esc(r.notes || '')}</textarea></div>
      <div class="row"><button class="btn primary" data-save type="button">Save</button><span class="muted small" data-msg>${r.updatedAt ? 'Last updated ' + fmtDate(r.updatedAt) + (r.updatedBy ? ' by ' + esc(r.updatedBy) : '') : ''}</span></div>`);
    $('#drawer [data-save]').addEventListener('click', async e => { e.target.disabled = true; const patch = { status: $('#drawer [data-status]').value, notes: $('#drawer [data-notes]').value.trim() }; await API.updateRequest(id, patch); Object.assign(r, patch); $('#drawer [data-msg]').textContent = 'Saved.'; e.target.disabled = false; route(); });
  }

  /* ---------- clients ---------- */
  async function clients() {
    const [cl, couples, qs] = await Promise.all([API.listClients(), API.listCouples(), API.listQuestionnaires()]);
    cache.clients = cl; cache.couples = couples; cache.qs = qs;
    const people = cl.filter(c => c.status !== 'staff').sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || ''));
    const coupleLabel = c => { const k = couples.find(x => x.id === c.coupleId); if (!k) return '—'; const other = k.members.find(m => m !== c.uid); const o = cl.find(x => x.uid === other); return 'with ' + esc(o ? o.pseudonym : '?'); };
    main.innerHTML = `<div class="row between" style="margin-bottom:14px"><h1 style="margin:0">Clients</h1><button class="btn" data-pair type="button">Pair a couple</button></div>
      <p class="muted small">Clients are listed by pseudonym. The sign-in email is shown here for staff only; every look-up is written to the audit log.</p>
      <section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Pseudonym</th><th>Account</th><th>Status</th><th>Couple</th><th>Questionnaires</th><th>Last seen</th><th></th></tr></thead><tbody>
      ${people.map(c => `<tr class="clickable" data-client="${esc(c.uid)}"><td><strong>${esc(c.pseudonym)}</strong></td><td class="small">${esc(c.displayName || '')}<br><span class="muted">${esc(c.email || '')}</span></td><td>${chip(CSTATUS, c.status)}</td><td class="small">${coupleLabel(c)}</td><td class="small">${(c.assigned || []).length}</td><td class="small muted">${ago(c.lastSeen)}</td><td class="actions"><button class="btn sm" type="button">Open</button></td></tr>`).join('') || `<tr><td colspan="7"><div class="empty">No client accounts yet. Clients appear here after their first sign-in to the portal.</div></td></tr>`}
      </tbody></table></div></section>`;
    $$('[data-client]', main).forEach(tr => tr.addEventListener('click', () => openClient(tr.dataset.client)));
    $('[data-pair]', main).addEventListener('click', pairCouple);
  }
  async function openClient(uid) {
    if (!cache.clients) { cache.clients = await API.listClients(); } if (!cache.qs) cache.qs = await API.listQuestionnaires(); if (!cache.couples) cache.couples = await API.listCouples();
    const c = cache.clients.find(x => x.uid === uid); if (!c) return;
    const resp = await API.listResponsesFor(uid);
    const couple = cache.couples.find(k => k.id === c.coupleId); const partner = couple && cache.clients.find(x => x.uid === couple.members.find(m => m !== uid));
    const partnerResp = partner ? await API.listResponsesFor(partner.uid) : [];
    const qrows = cache.qs.map(q => { const on = (c.assigned || []).includes(q.id); const r = resp.find(x => x.qid === q.id); const pr = partnerResp.find(x => x.qid === q.id);
      return `<tr><td><label class="row" style="gap:8px"><input type="checkbox" data-assign="${esc(q.id)}" ${on ? 'checked' : ''}> ${esc(q.title)}</label></td><td class="small">${r ? `<a href="#" data-view="${esc(q.id)}">${r.status === 'submitted' ? 'Submitted ' + fmtDay(r.submittedAt) : 'In progress'}</a>` : '<span class="muted">—</span>'}</td><td class="small">${partner ? (pr ? `<a href="#" data-view="${esc(q.id)}">${pr.status === 'submitted' ? 'Submitted ' + fmtDay(pr.submittedAt) : 'In progress'}</a>` : '<span class="muted">—</span>') : ''}</td></tr>`; }).join('');
    drawer(`<p class="kicker">Client</p><h2>${esc(c.pseudonym)}</h2>
      <div class="row" style="margin-bottom:12px">${chip(CSTATUS, c.status)}<span class="muted small">joined ${fmtDay(c.createdAt)} · seen ${ago(c.lastSeen)}</span></div>
      <div class="card soft" style="padding:14px 16px;margin-bottom:14px"><p class="kicker">Identity (staff only)</p><div data-identity>${c.email ? `<strong>${esc(c.displayName || '')}</strong> · ${esc(c.email)}` : `<button class="btn sm" data-reveal type="button">Show who this is</button> <span class="muted small">Writes an entry to the audit log.</span>`}</div></div>
      <div class="grid two">
        <div class="field"><label>Status</label><select data-cstatus>${['new', 'active', 'inactive'].map(s => `<option value="${s}" ${s === c.status ? 'selected' : ''}>${CSTATUS[s][0]}</option>`).join('')}</select></div>
        <div class="field"><label>Couple</label><div style="padding:10px 0">${partner ? `with <strong>${esc(partner.pseudonym)}</strong>` : '<span class="muted">Not paired</span>'}</div></div>
      </div>
      <div class="field"><label>Next appointment (shown to the client)</label><input data-next value="${esc(c.nextAppointment || '')}" placeholder="Thu, Nov 5 · 6:00 PM · Video"></div>
      <div class="field"><label>Working on (shown to the client)</label><input data-focus value="${esc(c.focus || '')}" placeholder="Listening without defending"></div>
      <div class="field"><label>Private note (staff only)</label><textarea data-note>${esc(c.note || '')}</textarea></div>
      <p class="kicker">Diagnostic snapshot</p>
      ${A.assess ? A.assess.snapshot(c, resp, cache.qs) : ''}
      <p class="kicker" style="margin-top:14px">Assessments</p>
      <div class="table-wrap"><table class="table"><thead><tr><th>Assigned</th><th>${esc(c.pseudonym)}</th><th>${partner ? esc(partner.pseudonym) : ''}</th></tr></thead><tbody>${qrows || '<tr><td class="muted" colspan="3">No assessments yet — create one under Assessments.</td></tr>'}</tbody></table></div>
      <div class="row" style="margin-top:16px"><button class="btn primary" data-save type="button">Save</button><span class="muted small" data-msg></span></div>`);
    const d = $('#drawer');
    const rev = $('[data-reveal]', d); if (rev) rev.addEventListener('click', async () => { rev.disabled = true; const i = await API.clientIdentity(uid); $('[data-identity]', d).innerHTML = `<strong>${esc(i.displayName || '')}</strong> · ${esc(i.email)}`; Object.assign(c, i); });
    $$('[data-view], [data-res]', d).forEach(a => a.addEventListener('click', e => { e.preventDefault(); A.assess.results(c, a.dataset.view || a.dataset.res); }));
    $('[data-save]', d).addEventListener('click', async e => { e.target.disabled = true; const patch = { status: $('[data-cstatus]', d).value, nextAppointment: $('[data-next]', d).value.trim(), focus: $('[data-focus]', d).value.trim(), note: $('[data-note]', d).value.trim(), assigned: $$('[data-assign]', d).filter(x => x.checked).map(x => x.dataset.assign) }; await API.updateClient(uid, patch); Object.assign(c, patch); $('[data-msg]', d).textContent = 'Saved.'; e.target.disabled = false; if (location.hash === '#clients') clients(); });
  }
  function pairCouple() {
    const free = cache.clients.filter(c => c.status !== 'staff' && !c.coupleId);
    drawer(`<p class="kicker">Couples</p><h2>Pair two clients</h2><p class="muted small">Each partner keeps their own pseudonym and answers separately; the dashboard shows both side by side.</p>
      <div class="field"><label>First partner</label><select data-a>${free.map(c => `<option value="${esc(c.uid)}">${esc(c.pseudonym)}${c.email ? ' · ' + esc(c.email) : ''}</option>`).join('')}</select></div>
      <div class="field"><label>Second partner</label><select data-b>${free.map(c => `<option value="${esc(c.uid)}">${esc(c.pseudonym)}${c.email ? ' · ' + esc(c.email) : ''}</option>`).join('')}</select></div>
      <div class="row"><button class="btn primary" data-go type="button" ${free.length < 2 ? 'disabled' : ''}>Pair</button><span class="muted small" data-msg>${free.length < 2 ? 'Two unpaired clients are needed.' : ''}</span></div>`);
    $('#drawer [data-go]').addEventListener('click', async e => { const a = $('#drawer [data-a]').value, b = $('#drawer [data-b]').value; if (a === b) { $('#drawer [data-msg]').textContent = 'Pick two different clients.'; return; } e.target.disabled = true; await API.createCouple([a, b]); closeDrawer(); clients(); });
  }

  /* ---------- traffic ---------- */
  function chart(traffic) {
    const days = traffic.slice().sort((a, b) => a.day.localeCompare(b.day)).slice(-30);
    if (!days.length) return '<div class="empty">No traffic recorded yet.</div>';
    const W = 720, H = 180, pad = 28, bw = (W - pad * 2) / days.length; const max = Math.max(1, ...days.map(d => d.views || 0));
    const bars = days.map((d, i) => { const h = (d.views || 0) / max * (H - 40), hu = (d.uniques || 0) / max * (H - 40); const x = pad + i * bw + 2; return `<rect class="bar" x="${x.toFixed(1)}" y="${(H - 24 - h).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${h.toFixed(1)}" rx="2"><title>${d.day}: ${d.views || 0} views, ${d.uniques || 0} visitors</title></rect><rect class="bar uni" x="${x.toFixed(1)}" y="${(H - 24 - hu).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${hu.toFixed(1)}" rx="2"/>`; }).join('');
    const labels = days.map((d, i) => i % 5 === 0 || i === days.length - 1 ? `<text x="${(pad + i * bw + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${fmtDay(d.day)}</text>` : '').join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily page views"><line class="axis" x1="${pad}" x2="${W - pad}" y1="${H - 24}" y2="${H - 24}"/><text x="${pad}" y="12">${max} views/day peak · dark = views, light = visitors</text>${bars}${labels}</svg>`;
  }
  const sumMap = (days, k) => { const m = {}; days.forEach(d => Object.entries(d[k] || {}).forEach(([key, n]) => { m[key] = (m[key] || 0) + n; })); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const barList = (rows, pretty = s => s) => { const top = rows.slice(0, 8); const max = Math.max(1, ...top.map(r => r[1])); return top.length ? `<div class="bars">${top.map(([k, n]) => `<div class="b"><div><div class="lbl"><span>${esc(pretty(k))}</span></div><i style="width:${Math.round(100 * n / max)}%"></i></div><span class="n">${n}</span></div>`).join('')}</div>` : '<p class="muted small">Nothing yet.</p>'; };
  const prettyPath = s => s.replace(/_/g, '/').replace(/\/+/g, '/').replace(/^\/davidsteinberg-site/, '') || '/';
  async function traffic() {
    const t = cache.traffic = await API.listTraffic(); const days = t.slice().sort((a, b) => a.day.localeCompare(b.day));
    const last = n => days.slice(-n); const sum = (arr, k) => arr.reduce((a, d) => a + (d[k] || 0), 0);
    main.innerHTML = `<h1>Traffic</h1><p class="muted small">Counted by the site itself: page views and daily visitors, no cookies, no stored addresses. Search engines and AI assistants show up under referrers.</p>
      <div class="grid stats" style="margin-bottom:16px">
        <div class="card stat"><div class="n">${sum(last(1), 'views')}</div><div class="l">views today</div></div>
        <div class="card stat"><div class="n">${sum(last(7), 'views')}</div><div class="l">views · 7 days</div></div>
        <div class="card stat"><div class="n">${sum(last(7), 'uniques')}</div><div class="l">visitors · 7 days</div></div>
        <div class="card stat"><div class="n">${sum(last(30), 'views')}</div><div class="l">views · 30 days</div></div>
        <div class="card stat"><div class="n">${sum(last(30), 'uniques')}</div><div class="l">visitors · 30 days</div></div>
      </div>
      <section class="card" style="margin-bottom:16px"><h2>Daily · last 30 days</h2>${chart(days)}</section>
      <div class="grid two">
        <section class="card"><h2>Pages · 30 days</h2>${barList(sumMap(last(30), 'routes').concat(sumMap(last(30), 'paths')).sort((a, b) => b[1] - a[1]), prettyPath)}</section>
        <section class="card"><h2>Referrers · 30 days</h2>${barList(sumMap(last(30), 'referrers'), s => s.replace(/_/g, '.'))}</section>
        <section class="card"><h2>Concept · 30 days</h2>${barList(sumMap(last(30), 'concepts'))}</section>
        <section class="card"><h2>Devices · 30 days</h2>${barList(sumMap(last(30), 'devices'))}</section>
      </div>`;
  }

  /* ---------- audit ---------- */
  async function audit() {
    const rows = await API.listAudit();
    main.innerHTML = `<h1>Audit log</h1><p class="muted small">Every time staff looked up who a pseudonym belongs to.</p><section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th></tr></thead><tbody>${rows.map(r => `<tr><td class="small">${fmtDate(r.at)}</td><td class="small">${esc(r.by)}</td><td class="small">${esc(r.action)}</td><td class="small mono">${esc(r.target || (r.count != null ? r.count + ' accounts' : ''))}</td></tr>`).join('') || '<tr><td colspan="4"><div class="empty">Nothing yet.</div></td></tr>'}</tbody></table></div></section>`;
  }

  /* ---------- routing + auth ---------- */
  A.openClient = openClient;
  Object.assign(A.sections, { overview, requests, clients, traffic, audit });
  async function route() {
    if (!me || !main) return;
    const h = (location.hash || '#overview').slice(1).split('/')[0]; const fn = A.sections[h] || overview;
    $$('[data-nav]').forEach(a => a.setAttribute('aria-current', a.dataset.nav === (A.sections[h] ? h : 'overview') ? 'page' : 'false'));
    main.innerHTML = '<p class="muted">Loading…</p>';
    try { await fn(); } catch (e) { main.innerHTML = `<div class="notice warn">Could not load: ${esc(e.message || e)}</div>`; }
    const badge = $('[data-count-new]'); if (badge && cache.reqs) { const n = cache.reqs.filter(r => r.status === 'new').length; badge.textContent = n; badge.hidden = !n; }
  }
  window.addEventListener('hashchange', route);
  $('#signout').addEventListener('click', () => API.signOut());
  API.onAuth(async u => {
    me = u; if (!u) { main = null; return showSignIn(); }
    $('#who').hidden = false; $('#who-avatar').textContent = (u.displayName || u.email || '?').trim()[0].toUpperCase(); $('#who-name').textContent = u.email || '';
    try {
      const b = await API.bootstrap();
      if (b.role !== 'staff') { app.innerHTML = `<section class="wrap narrow"><div class="card"><h1>Staff only</h1><p>${esc(u.email)} is not on the staff list. Clients use the <a href="../portal/">client portal</a>.</p><p><button class="btn" id="so2">Sign out</button></p></div></section>`; $('#so2').addEventListener('click', () => API.signOut()); return; }
      app.innerHTML = ''; app.appendChild(tpl('t-shell')); main = $('#main');
      $$('[data-close]').forEach(el => el.addEventListener('click', closeDrawer));
      if (!cache.reqs) { API.listRequests().then(r => { cache.reqs = r; const badge = $('[data-count-new]'); const n = r.filter(x => x.status === 'new').length; badge.textContent = n; badge.hidden = !n; }); }
      route();
    } catch (e) { app.innerHTML = `<section class="wrap narrow"><div class="card"><h1>Something went wrong.</h1><p class="muted">${esc(e.message || e)}</p></div></section>`; }
  });
})();
