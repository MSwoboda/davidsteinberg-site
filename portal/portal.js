/* Client portal. Routes: #/ (home), #q/<id> (questionnaire), #done/<id>. Everything goes through window.API. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const view = $('#view');
  const tpl = id => document.getElementById(id).content.cloneNode(true);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let me = null, profile = null, questionnaires = null;

  /* theme */
  const root = document.documentElement;
  try { const t = localStorage.getItem('ds-mode'); if (t === 'dark' || t === 'light') root.dataset.theme = t; } catch (e) {}
  $('#theme').addEventListener('click', () => { const dark = root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches); root.dataset.theme = dark ? 'light' : 'dark'; try { localStorage.setItem('ds-mode', root.dataset.theme); } catch (e) {} });

  if (API.isDemo) { const b = document.createElement('div'); b.className = 'demo-badge'; b.textContent = 'Demo data · nothing is saved'; document.body.appendChild(b); }

  function render(node) { view.innerHTML = ''; view.appendChild(node); window.scrollTo(0, 0); }
  function statusChip(s) { return { new: ['Awaiting confirmation', 'warn'], active: ['Active', 'ok'], inactive: ['Inactive', ''], staff: ['Staff', 'ok'] }[s] || [s, '']; }

  /* ---- sign-in ---- */
  function showSignIn() {
    $('#who').hidden = true;
    const n = tpl('t-signin'); render(n);
    $('#signin').addEventListener('click', async e => { e.target.disabled = true; try { await API.signIn(); } catch (err) { e.target.disabled = false; alert('Sign-in did not complete. ' + (err && err.message || '')); } });
  }

  /* ---- home ---- */
  async function showHome() {
    profile = await API.getProfile();
    if (!profile) return showSignIn();
    if (profile.status === 'staff') { view.innerHTML = '<section class="card"><h1>This account is staff.</h1><p>Open the <a href="../admin/">admin dashboard</a> instead.</p></section>'; return; }
    questionnaires = questionnaires || await API.listQuestionnaires();
    const mine = await API.listMyResponses();
    const n = tpl('t-home');
    n.querySelector('[data-pseudonym]').textContent = profile.pseudonym;
    const [label, cls] = statusChip(profile.status); const chip = n.querySelector('[data-status]'); chip.textContent = label; chip.className = 'chip ' + cls;
    n.querySelector('[data-next]').textContent = profile.nextAppointment || 'Not scheduled yet';
    n.querySelector('[data-focus]').textContent = profile.focus || '—';
    const assigned = (profile.assigned || []).map(id => questionnaires.find(q => q.id === id)).filter(Boolean);
    const list = n.querySelector('[data-qlist]');
    n.querySelector('[data-qcount]').textContent = assigned.length ? `${mine.filter(r => r.status === 'submitted').length} of ${assigned.length} done` : '';
    n.querySelector('[data-qempty]').hidden = assigned.length > 0;
    list.innerHTML = assigned.map(q => {
      const r = mine.find(x => x.qid === q.id); const st = r ? r.status : 'not-started';
      const chip = st === 'submitted' ? '<span class="chip ok">Done</span>' : st === 'in-progress' ? '<span class="chip warn">In progress</span>' : '<span class="chip new">Start</span>';
      return `<a class="q-row" href="#q/${esc(q.id)}"><div><div class="title">${esc(q.title)}</div><div class="meta">${q.items.length} items · ${esc(q.kind === 'couples' ? 'answer separately from your partner' : 'about you')}</div></div><div class="right">${chip}</div></a>`;
    }).join('');
    render(n);
  }

  /* ---- questionnaire ---- */
  async function showQuestionnaire(id) {
    const q = (questionnaires && questionnaires.find(x => x.id === id)) || await API.getQuestionnaire(id);
    if (!q) { location.hash = ''; return; }
    const existing = await API.getResponse(id);
    if (existing && existing.status === 'submitted') return showDone(q, existing);
    const answers = (existing && existing.answers) || {};
    const n = tpl('t-questionnaire');
    n.querySelector('[data-kind]').textContent = q.kind === 'couples' ? 'Couples questionnaire · answer for yourself' : 'Questionnaire';
    n.querySelector('[data-title]').textContent = q.title;
    n.querySelector('[data-instructions]').textContent = q.instructions || '';
    const form = n.querySelector('[data-form]');
    const scale = q.scale || { type: 'likert', labels: ['Rarely', 'Sometimes', 'Often', 'Almost always'], values: [1, 2, 3, 4] };
    form.innerHTML = q.items.map((it, i) => {
      const type = it.type || scale.type || 'likert'; const name = 'i_' + it.id; const cur = answers[it.id];
      let input = '';
      if (type === 'likert') input = `<div class="choices">${scale.labels.map((l, k) => `<label><input type="radio" name="${name}" value="${scale.values[k]}" ${String(cur) === String(scale.values[k]) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
      else if (type === 'yesno') input = `<div class="choices">${['yes', 'no'].map(v => `<label><input type="radio" name="${name}" value="${v}" ${cur === v ? 'checked' : ''}><span>${v === 'yes' ? 'Yes' : 'No'}</span></label>`).join('')}</div>`;
      else input = `<div class="field"><textarea name="${name}" rows="3" placeholder="Your answer">${esc(cur || '')}</textarea></div>`;
      return `<div class="q-item"><div class="q-text">${i + 1}. ${esc(it.text)}</div>${input}</div>`;
    }).join('');
    const collect = () => { const out = {}; q.items.forEach(it => { const type = it.type || scale.type || 'likert'; const el = form.elements['i_' + it.id]; if (!el) return; if (type === 'text') { if (el.value.trim()) out[it.id] = el.value.trim(); } else { const v = el.value; if (v) out[it.id] = type === 'likert' ? Number(v) : v; } }); return out; };
    const progress = n.querySelector('[data-progress]');
    const upd = () => { const a = collect(); progress.style.width = Math.round(100 * Object.keys(a).length / q.items.length) + '%'; };
    form.addEventListener('input', upd); form.addEventListener('change', upd);
    const saved = n.querySelector('[data-saved]');
    n.querySelector('[data-save]').addEventListener('click', async e => { e.target.disabled = true; await API.saveResponse(id, collect(), 'in-progress'); saved.textContent = 'Saved.'; e.target.disabled = false; setTimeout(() => location.hash = '', 500); });
    n.querySelector('[data-submit]').addEventListener('click', async e => {
      const a = collect(); const missing = q.items.filter(it => (it.type || scale.type) !== 'text' && a[it.id] == null);
      if (missing.length) { saved.textContent = `${missing.length} item${missing.length > 1 ? 's' : ''} left to answer.`; const el = form.elements['i_' + missing[0].id]; (el[0] || el).focus(); (el[0] || el).closest('.q-item').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      e.target.disabled = true; const r = await API.saveResponse(id, a, 'submitted'); showDone(q, r);
    });
    n.querySelector('[data-back]').addEventListener('click', ev => { ev.preventDefault(); location.hash = ''; });
    render(n); upd();
  }

  function score(q, answers) {
    const sc = q.scoring || {}; if (!sc.method || sc.method === 'none') return null;
    const scale = q.scale || {}; const vals = scale.values || [1, 2, 3, 4]; const max = Math.max(...vals), min = Math.min(...vals);
    const nums = q.items.filter(it => (it.type || scale.type || 'likert') === 'likert').map(it => { let v = Number(answers[it.id]); if (isNaN(v)) return null; if ((sc.reverse || []).includes(it.id)) v = max + min - v; return v; }).filter(v => v != null);
    if (!nums.length) return null;
    const total = sc.method === 'mean' ? nums.reduce((a, b) => a + b, 0) / nums.length : nums.reduce((a, b) => a + b, 0);
    const band = (sc.bands || []).find(b => total <= b.max);
    return { total: Math.round(total * 10) / 10, label: band ? band.label : '' };
  }
  function showDone(q, r) {
    const n = tpl('t-done'); const s = score(q, r.answers || {});
    n.querySelector('[data-score]').textContent = s && q.kind === 'self' ? `Your result: ${s.total}${s.label ? ' — ' + s.label : ''}.` : '';
    render(n);
  }

  /* ---- routing + auth ---- */
  function route() {
    if (!me) return showSignIn();
    const h = location.hash.replace(/^#\/?/, '');
    if (h.startsWith('q/')) return showQuestionnaire(decodeURIComponent(h.slice(2)));
    return showHome();
  }
  window.addEventListener('hashchange', route);
  $('#signout').addEventListener('click', () => API.signOut());
  API.onAuth(async u => {
    me = u;
    if (!u) { profile = null; return showSignIn(); }
    $('#who').hidden = false; $('#who-avatar').textContent = (u.displayName || u.email || '?').trim()[0].toUpperCase(); $('#who-name').textContent = '';
    try {
      const b = await API.bootstrap();
      $('#who-name').textContent = b.pseudonym || '';
      if (b.role === 'staff') { view.innerHTML = '<section class="card"><h1>This account is staff.</h1><p>Open the <a href="../admin/">admin dashboard</a> instead.</p></section>'; return; }
      if (b.isNew) {
        const n = tpl('t-welcome'); n.querySelector('[data-pseudonym]').textContent = b.pseudonym; n.querySelector('[data-continue]').addEventListener('click', () => { location.hash = ''; route(); }); render(n); return;
      }
      route();
    } catch (e) { view.innerHTML = `<section class="card"><h1>Something went wrong.</h1><p class="muted">${esc(e.message || e)}</p><p><button class="btn" onclick="location.reload()">Try again</button></p></section>`; }
  });
})();
