/* Assessments: builder, results, scoring, history, clinician notes. Registers itself on window.ADMIN
   (set up by admin.js) and adds the "assessments" section. */
(function () {
  'use strict';
  const A = window.ADMIN; const { $, $$, esc, fmtDate, fmtDay, chip, drawer, closeDrawer, cache } = A;

  const KINDS = { self: 'Self-report', couples: 'Couples · each partner answers', intake: 'Intake · before the first session', screening: 'Screening' };
  const PRESETS = {
    freq4: { name: 'Rarely → Almost always (1–4)', labels: ['Rarely', 'Sometimes', 'Often', 'Almost always'], values: [1, 2, 3, 4] },
    agree5: { name: 'Strongly disagree → Strongly agree (1–5)', labels: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'], values: [1, 2, 3, 4, 5] },
    freq5: { name: 'Never → Always (0–4)', labels: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'], values: [0, 1, 2, 3, 4] },
    days4: { name: 'Not at all → Nearly every day (0–3)', labels: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'], values: [0, 1, 2, 3] },
    true3: { name: 'False / Somewhat true / True (0–2)', labels: ['False', 'Somewhat true', 'True'], values: [0, 1, 2] },
    custom: { name: 'Custom…', labels: [], values: [] },
  };
  const ITEM_TYPES = { '': 'Scale (default)', likert: 'Scale', yesno: 'Yes / No', choice: 'Multiple choice', text: 'Free text' };
  const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

  /* ---------- scoring ---------- */
  function itemType(q, it) { return it.type || (q.scale && q.scale.type) || 'likert'; }
  function itemRange(q, it) {
    const t = itemType(q, it);
    if (t === 'likert') { const v = (q.scale && q.scale.values) || [1, 2, 3, 4]; return [Math.min(...v), Math.max(...v)]; }
    if (t === 'yesno') return [0, 1];
    if (t === 'choice') { const v = (it.options || []).map(o => Number(o.value)).filter(n => !isNaN(n)); return v.length ? [Math.min(...v), Math.max(...v)] : [0, 0]; }
    return null;
  }
  function itemValue(q, it, raw) {
    if (raw == null || raw === '') return null;
    const t = itemType(q, it);
    let v = null;
    if (t === 'likert' || t === 'choice') v = Number(raw);
    else if (t === 'yesno') v = raw === 'yes' ? 1 : raw === 'no' ? 0 : null;
    if (v == null || isNaN(v)) return null;
    const rev = it.reverse || ((q.scoring && q.scoring.reverse) || []).includes(it.id);
    if (rev) { const [lo, hi] = itemRange(q, it); v = hi + lo - v; }
    return v;
  }
  function answerLabel(q, it, raw) {
    if (raw == null || raw === '') return '—';
    const t = itemType(q, it);
    if (t === 'likert') { const sc = q.scale || {}; const i = (sc.values || []).indexOf(Number(raw)); return i >= 0 && sc.labels ? sc.labels[i] : String(raw); }
    if (t === 'yesno') return raw === 'yes' ? 'Yes' : 'No';
    if (t === 'choice') { const o = (it.options || []).find(x => String(x.value) === String(raw)); return o ? o.label : String(raw); }
    return String(raw);
  }
  /* -> null when the instrument is not scored, else { total, max, min, mean, pct, band, subscales, answered, n } */
  function score(q, answers) {
    const sc = q.scoring || {}; const method = sc.method || 'sum'; if (method === 'none') return null;
    answers = answers || {};
    const items = (q.items || []).filter(it => itemRange(q, it));
    if (!items.length) return null;
    let total = 0, max = 0, min = 0, answered = 0; const subs = {};
    items.forEach(it => {
      const [lo, hi] = itemRange(q, it); const v = itemValue(q, it, answers[it.id]);
      max += hi; min += lo;
      const s = it.subscale ? (subs[it.subscale] = subs[it.subscale] || { name: it.subscale, total: 0, max: 0, min: 0, n: 0, answered: 0 }) : null;
      if (s) { s.max += hi; s.min += lo; s.n++; }
      if (v != null) { total += v; answered++; if (s) { s.total += v; s.answered++; } }
    });
    const shown = method === 'mean' ? (answered ? total / answered : 0) : total;
    const bands = (sc.bands || []).slice().sort((a, b) => a.max - b.max);
    const band = bands.find(b => shown <= b.max) || null;
    const bandIndex = band ? bands.indexOf(band) : -1;
    return { total: Math.round(shown * 10) / 10, raw: total, max, min, pct: max > min ? Math.round((total - min) / (max - min) * 100) : 0, mean: answered ? Math.round(total / answered * 100) / 100 : 0, band, bandIndex, bands, label: band ? band.label : '', answered, n: items.length, method,
      subscales: Object.values(subs).map(s => ({ ...s, pct: s.max > s.min ? Math.round((s.total - s.min) / (s.max - s.min) * 100) : 0 })) };
  }
  const fmtScore = s => s ? `${s.total}${s.method === 'mean' ? '' : ' / ' + s.max}` : '—';
  /* severity colour for a band: the lowest band is the concerning one for "toward" scales, the highest for symptom scales (scoring.higher_is_worse) */
  const bandTone = (q, s) => { if (!s || !s.band) return ''; const worse = q.scoring && q.scoring.higher_is_worse; const i = s.bandIndex, n = s.bands.length; const worst = worse ? i === n - 1 : i === 0; const best = worse ? i === 0 : i === n - 1; return worst ? 'warn' : best ? 'ok' : ''; };

  /* ---------- section: list + stats ---------- */
  async function assessments() {
    const [qs, resps, clients] = await Promise.all([A.L.qs(), A.L.resps(), A.L.clients()]);
    cache.qs = qs; cache.resps = resps; cache.clients = clients;
    const byQ = id => resps.filter(r => r.qid === id);
    const assignedCount = id => clients.filter(c => (c.assigned || []).includes(id)).length;
    const pending = resps.filter(r => r.status === 'submitted' && !r.reviewedAt).sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
    const pseud = uid => { const c = clients.find(x => x.uid === uid); return c ? c.pseudonym : uid; };
    A.main.innerHTML = `<div class="row between" style="margin-bottom:14px"><h1 style="margin:0">Assessments</h1><div class="row"><button class="btn" data-template type="button">Template for an LLM</button><button class="btn" data-import type="button">Import JSON</button><button class="btn primary" data-new type="button">New assessment</button></div></div>
      <p class="muted small">Questionnaires, screening tools and intake forms clients complete in the portal. Assign them from a client's page; results come back here and on the client's page.</p>
      ${pending.length ? `<section class="card" style="margin-bottom:16px"><h2>To review <span class="chip warn">${pending.length}</span></h2><div class="table-wrap"><table class="table"><tbody>${pending.slice(0, 8).map(r => { const q = qs.find(x => x.id === r.qid); const s = q ? score(q, r.answers) : null; return `<tr class="clickable" data-open="${esc(r.id)}"><td><strong>${esc(pseud(r.uid))}</strong><br><span class="muted small">${esc(q ? q.title : r.qid)}${r.attempt > 1 ? ' · attempt ' + r.attempt : ''}</span></td><td>${s ? `<strong>${fmtScore(s)}</strong> ${s.label ? chip({ x: [s.label, bandTone(q, s)] }, 'x') : ''}` : ''}</td><td class="small muted">${fmtDate(r.submittedAt)}</td><td class="actions"><button class="btn sm" type="button">Open</button></td></tr>`; }).join('')}</tbody></table></div></section>` : ''}
      <section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Instrument</th><th>Kind</th><th>Items</th><th>Assigned</th><th>Submitted</th><th>Average</th><th>Last</th><th></th></tr></thead><tbody>
      ${qs.map(q => { const rs = byQ(q.id).filter(r => r.status === 'submitted'); const scores = rs.map(r => score(q, r.answers)).filter(Boolean); const avg = scores.length ? Math.round(scores.reduce((a, s) => a + s.total, 0) / scores.length * 10) / 10 : null; const last = rs.map(r => r.submittedAt).sort().pop();
        return `<tr><td><strong>${esc(q.title)}</strong><br><span class="muted small mono">${esc(q.id)}</span></td><td class="small">${esc((KINDS[q.kind] || q.kind || '').split(' ·')[0])}</td><td class="small">${(q.items || []).length}</td><td class="small">${assignedCount(q.id)}</td><td class="small">${rs.length}</td><td class="small">${avg != null ? avg + (scores[0].method === 'mean' ? '' : ' / ' + scores[0].max) : '—'}</td><td class="small muted">${last ? fmtDay(last) : '—'}</td><td class="actions"><button class="btn sm" data-edit="${esc(q.id)}" type="button">Edit</button> <button class="btn sm" data-prev="${esc(q.id)}" type="button">Preview</button> <button class="btn sm" data-export="${esc(q.id)}" type="button">JSON</button> <button class="btn sm danger" data-del="${esc(q.id)}" type="button">Remove</button></td></tr>`; }).join('') || `<tr><td colspan="8"><div class="empty">No assessments yet. Create one or import a JSON file.</div></td></tr>`}
      </tbody></table></div></section>`;
    $('[data-new]', A.main).addEventListener('click', () => builder(null));
    $('[data-import]', A.main).addEventListener('click', importJson);
    $('[data-template]', A.main).addEventListener('click', template);
    $$('[data-edit]', A.main).forEach(b => b.addEventListener('click', () => builder(qs.find(x => x.id === b.dataset.edit))));
    $$('[data-prev]', A.main).forEach(b => b.addEventListener('click', () => preview(qs.find(x => x.id === b.dataset.prev))));
    $$('[data-export]', A.main).forEach(b => b.addEventListener('click', () => exportJson(qs.find(x => x.id === b.dataset.export))));
    $$('[data-del]', A.main).forEach(b => b.addEventListener('click', async () => { if (!confirm('Remove "' + b.dataset.del + '" from the portal? Answers already given are kept.')) return; await API.deleteQuestionnaire(b.dataset.del); A.drop('questionnaires'); assessments(); }));
    $$('[data-open]', A.main).forEach(tr => tr.addEventListener('click', () => { const r = resps.find(x => x.id === tr.dataset.open); const c = clients.find(x => x.uid === r.uid); if (c) results(c, r.qid); }));
  }

  function importJson() {
    drawer(`<p class="kicker">Import</p><h2>Assessment JSON</h2><p class="muted small">One instrument per file — see <code>backend/questionnaires/TEMPLATE.json</code>. An existing id is replaced; answers already given are kept.</p><div class="field"><label>Choose a file</label><input type="file" accept="application/json,.json" data-file></div><div class="field"><label>or paste JSON</label><textarea data-json rows="14" class="mono" placeholder='{ "id": "...", "title": "...", "items": [ ... ] }'></textarea></div><div class="row"><button class="btn primary" data-go type="button">Import</button><span class="small" data-msg></span></div>`);
    const d = $('#drawer'); $('[data-file]', d).addEventListener('change', e => { const f = e.target.files[0]; if (f) f.text().then(t => { $('[data-json]', d).value = t; }); });
    $('[data-go]', d).addEventListener('click', async e => { const msg = $('[data-msg]', d); try { const doc = JSON.parse($('[data-json]', d).value); const err = validate(doc); if (err) { msg.textContent = err; return; } e.target.disabled = true; await API.upsertQuestionnaire(normalize(doc)); A.drop('questionnaires'); closeDrawer(); assessments(); } catch (err) { msg.textContent = 'Not valid JSON: ' + err.message; } });
  }
  const TEMPLATE = {
    id: 'short-id-with-dashes', title: 'Title the client sees', kind: 'self | couples | intake | screening',
    instructions: 'One or two sentences shown above the items.',
    scale: { type: 'likert', labels: ['Rarely', 'Sometimes', 'Often', 'Almost always'], values: [1, 2, 3, 4] },
    items: [
      { id: 'q1', text: 'A statement the client rates on the scale.' },
      { id: 'q2', text: 'A reverse-scored statement.', reverse: true, subscale: 'Repair' },
      { id: 'q3', text: 'A yes/no item.', type: 'yesno' },
      { id: 'q4', text: 'A multiple-choice item.', type: 'choice', options: [{ label: 'Never', value: 0 }, { label: 'Once', value: 1 }, { label: 'Weekly', value: 2 }] },
      { id: 'q5', text: 'A free-text item (not scored).', type: 'text' },
    ],
    scoring: { method: 'sum | mean | none', higher_is_worse: false, bands: [{ max: 8, label: 'Label the client sees for the lowest band', guidance: 'Note for the clinician' }, { max: 16, label: 'Middle band' }, { max: 24, label: 'Highest band' }] },
    notes: 'Staff-only notes: source, cut-offs, how to read it.',
  };
  function template() {
    const json = JSON.stringify(TEMPLATE, null, 2);
    const prompt = `Convert the questionnaire below into JSON with exactly this shape. Rules: "id" is lowercase letters, digits and dashes; every item has a unique "id" and a "text"; items without a "type" use the shared scale; use "type": "yesno" for yes/no items, "choice" with "options" (label + numeric value) for multiple choice, "text" for free answers; set "reverse": true on reverse-scored items; put the subscale name in "subscale" when the instrument has subscales; "scoring.bands" lists the cut-offs with "max" = the highest total in that band, lowest band first; set "higher_is_worse": true for symptom scales. Return only the JSON.

SHAPE:
${json}

QUESTIONNAIRE:
(paste the instrument here)`;
    drawer(`<p class="kicker">Template</p><h2>Build one with an LLM</h2><p class="muted small">Copy the prompt, paste the instrument's text under it in ChatGPT, Claude or Gemini, then paste the JSON it returns into <strong>Import JSON</strong>. Or build by hand with <strong>New assessment</strong>.</p>
      <div class="field"><label>Prompt (shape included)</label><textarea class="mono" rows="18" readonly data-prompt>${esc(prompt)}</textarea></div>
      <div class="row"><button class="btn primary" data-copy-prompt type="button">Copy prompt</button><button class="btn" data-copy-json type="button">Copy shape only</button><span class="small muted" data-msg></span></div>
      <p class="kicker" style="margin-top:18px">Field reference</p>
      <table class="table small"><tbody>
        <tr><td class="mono">kind</td><td>self (one person) · couples (each partner answers separately, shown side by side) · intake · screening</td></tr>
        <tr><td class="mono">scale</td><td>labels and numeric values, same length; items without a type use it</td></tr>
        <tr><td class="mono">items[].type</td><td>yesno · choice (with options) · text; leave out for the scale</td></tr>
        <tr><td class="mono">reverse</td><td>true flips the item's value (max + min − value)</td></tr>
        <tr><td class="mono">subscale</td><td>groups items; results show a bar per subscale</td></tr>
        <tr><td class="mono">scoring</td><td>method sum / mean / none; bands with max, label (client sees), guidance (you see); higher_is_worse for symptom scales</td></tr>
      </tbody></table>`);
    const d = $('#drawer'); const copy = async (txt, label) => { try { await navigator.clipboard.writeText(txt); $('[data-msg]', d).textContent = label + ' copied.'; } catch (e) { $('[data-prompt]', d).select(); $('[data-msg]', d).textContent = 'Select and copy the text.'; } };
    $('[data-copy-prompt]', d).addEventListener('click', () => copy(prompt, 'Prompt')); $('[data-copy-json]', d).addEventListener('click', () => copy(json, 'Shape'));
  }
  function exportJson(q) {
    const txt = JSON.stringify(q, null, 2);
    drawer(`<p class="kicker">Export</p><h2>${esc(q.title)}</h2><p class="muted small">Copy this into <code>backend/questionnaires/${esc(q.id)}.json</code> to keep it in the repo.</p><div class="field"><textarea class="mono" rows="22" readonly data-txt>${esc(txt)}</textarea></div><div class="row"><button class="btn" data-copy type="button">Copy</button><span class="small muted" data-msg></span></div>`);
    $('#drawer [data-copy]').addEventListener('click', async () => { try { await navigator.clipboard.writeText(txt); $('#drawer [data-msg]').textContent = 'Copied.'; } catch (e) { $('#drawer [data-txt]').select(); } });
  }
  function preview(q) {
    drawer(`<p class="kicker">${esc(KINDS[q.kind] || q.kind || '')}</p><h2>${esc(q.title)}</h2><p class="muted">${esc(q.instructions || '')}</p>
      ${(q.items || []).map((it, i) => { const t = itemType(q, it); const opts = t === 'likert' ? ((q.scale && q.scale.labels) || []) : t === 'yesno' ? ['Yes', 'No'] : t === 'choice' ? (it.options || []).map(o => o.label) : []; return `<div class="q-item"><div class="q-text">${i + 1}. ${esc(it.text)}${it.subscale ? ` <span class="chip" style="margin-left:6px">${esc(it.subscale)}</span>` : ''}${it.reverse ? ' <span class="chip">reverse</span>' : ''}</div>${opts.length ? `<div class="choices">${opts.map(o => `<label><input type="radio" disabled><span>${esc(o)}</span></label>`).join('')}</div>` : '<div class="field"><textarea rows="2" disabled placeholder="Free text"></textarea></div>'}</div>`; }).join('')}
      <p class="small muted" style="margin-top:14px">Scoring: ${esc((q.scoring && q.scoring.method) || 'sum')}${(q.scoring && q.scoring.bands || []).length ? ' · bands: ' + esc(q.scoring.bands.map(b => `≤${b.max} ${b.label}`).join(', ')) : ''}</p>`);
  }

  /* ---------- builder ---------- */
  function normalize(q) {
    const out = { ...q }; out.items = (q.items || []).map((it, i) => ({ ...it, id: String(it.id || 'q' + (i + 1)) }));
    if (!out.scale) out.scale = { type: 'likert', ...PRESETS.freq4 }; delete out.scale.name;
    if (!out.scoring) out.scoring = { method: 'sum', bands: [] };
    return out;
  }
  function validate(d) {
    if (!d || typeof d !== 'object') return 'Not an object.';
    if (!/^[a-z0-9-]{2,40}$/.test(d.id || '')) return 'id must be 2–40 lowercase letters, digits or dashes.';
    if (!d.title) return 'A title is required.';
    if (!Array.isArray(d.items) || !d.items.length) return 'Add at least one item.';
    const bad = d.items.find(it => !it.text); if (bad) return 'Every item needs a text.';
    const ids = d.items.map((it, i) => String(it.id || 'q' + (i + 1))); if (new Set(ids).size !== ids.length) return 'Item ids must be unique.';
    if (d.scale && d.scale.type === 'likert' && d.scale.labels && d.scale.values && d.scale.labels.length !== d.scale.values.length) return 'The scale needs as many values as labels.';
    return '';
  }
  function builder(q) {
    const isNew = !q; q = normalize(q ? JSON.parse(JSON.stringify(q)) : { id: '', title: '', kind: 'self', instructions: '', items: [{ id: 'q1', text: '' }], scale: { type: 'likert', ...PRESETS.freq4 }, scoring: { method: 'sum', bands: [] }, notes: '' });
    const presetOf = sc => Object.keys(PRESETS).find(k => k !== 'custom' && JSON.stringify(PRESETS[k].labels) === JSON.stringify(sc.labels) && JSON.stringify(PRESETS[k].values) === JSON.stringify(sc.values)) || 'custom';
    drawer(`<p class="kicker">${isNew ? 'New assessment' : 'Edit assessment'}</p><h2 data-h>${esc(q.title || 'Untitled')}</h2>
      <div class="grid two">
        <div class="field"><label>Title</label><input data-f="title" value="${esc(q.title)}" placeholder="Toward or away?"></div>
        <div class="field"><label>Id <span class="muted small">(in links and files; fixed once saved)</span></label><input data-f="id" class="mono" value="${esc(q.id)}" ${isNew ? '' : 'readonly'} placeholder="toward-or-away"></div>
      </div>
      <div class="grid two">
        <div class="field"><label>Kind</label><select data-f="kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${q.kind === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
        <div class="field"><label>Scoring</label><select data-f="method">${[['sum', 'Sum of items'], ['mean', 'Mean of items'], ['none', 'Not scored']].map(([k, v]) => `<option value="${k}" ${(q.scoring.method || 'sum') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Instructions (shown to the client)</label><textarea data-f="instructions" rows="2">${esc(q.instructions || '')}</textarea></div>
      <p class="kicker" style="margin-top:8px">Answer scale</p>
      <div class="field"><select data-preset>${Object.entries(PRESETS).map(([k, v]) => `<option value="${k}" ${presetOf(q.scale) === k ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></div>
      <div class="grid two"><div class="field"><label>Labels <span class="muted small">(comma-separated)</span></label><input data-f="labels" value="${esc((q.scale.labels || []).join(', '))}"></div><div class="field"><label>Values</label><input data-f="values" class="mono" value="${esc((q.scale.values || []).join(', '))}"></div></div>
      <div class="field"><label class="row" style="gap:8px"><input type="checkbox" data-f="higher_is_worse" ${q.scoring.higher_is_worse ? 'checked' : ''}> Higher scores mean more difficulty (symptom scale)</label></div>
      <p class="kicker" style="margin-top:8px">Items <span class="muted small" style="text-transform:none;letter-spacing:0">· drag order with the arrows · a subscale name groups items in the results</span></p>
      <div data-items></div>
      <div class="row" style="margin:8px 0 6px"><button class="btn sm" data-add type="button">Add item</button><button class="btn sm" data-paste type="button">Paste a list</button></div>
      <div class="field" data-pastebox hidden><textarea data-pastetxt rows="5" placeholder="One item per line — numbering is removed"></textarea><div class="row"><button class="btn sm primary" data-pastego type="button">Add these items</button></div></div>
      <p class="kicker">Result bands <span class="muted small" style="text-transform:none;letter-spacing:0">· "up to" is the highest score in the band; guidance is for you, not the client</span></p>
      <div data-bands></div>
      <div class="row" style="margin:8px 0 16px"><button class="btn sm" data-addband type="button">Add band</button></div>
      <div class="field"><label>Clinician notes (staff only: source, cut-offs, how to read it)</label><textarea data-f="notes" rows="3">${esc(q.notes || '')}</textarea></div>
      <div class="row" style="margin-top:12px"><button class="btn primary" data-save type="button">${isNew ? 'Create' : 'Save'}</button><span class="small" data-msg></span></div>`);
    const d = $('#drawer');
    const itemsEl = $('[data-items]', d), bandsEl = $('[data-bands]', d);
    const drawItems = () => {
      itemsEl.innerHTML = q.items.map((it, i) => `<div class="b-item" data-i="${i}">
          <div class="row" style="gap:6px;align-items:flex-start"><span class="muted small mono" style="width:26px;padding-top:10px">${i + 1}.</span><div style="flex:1;min-width:0"><input data-it="text" value="${esc(it.text)}" placeholder="Statement the client responds to" style="width:100%">
          <div class="row small" style="gap:8px;margin-top:6px"><select data-it="type">${Object.entries(ITEM_TYPES).map(([k, v]) => `<option value="${k}" ${(it.type || '') === k ? 'selected' : ''}>${v}</option>`).join('')}</select><input data-it="subscale" value="${esc(it.subscale || '')}" placeholder="Subscale" style="width:130px"><label class="row" style="gap:5px"><input type="checkbox" data-it="reverse" ${it.reverse ? 'checked' : ''}> reverse</label>${it.type === 'choice' ? `<input data-it="options" value="${esc((it.options || []).map(o => `${o.label}=${o.value}`).join('; '))}" placeholder="Label=value; Label=value" style="flex:1;min-width:160px">` : ''}</div></div>
          <div class="row" style="gap:2px;flex-wrap:nowrap"><button class="btn sm quiet" data-up title="Move up" type="button">↑</button><button class="btn sm quiet" data-down title="Move down" type="button">↓</button><button class="btn sm quiet danger" data-rm title="Remove" type="button">✕</button></div></div></div>`).join('');
    };
    const drawBands = () => {
      bandsEl.innerHTML = q.scoring.bands.map((b, i) => `<div class="row" data-b="${i}" style="gap:8px;margin-bottom:6px;align-items:flex-start"><input data-bf="max" type="number" step="0.5" value="${esc(b.max)}" placeholder="up to" style="width:84px"><input data-bf="label" value="${esc(b.label || '')}" placeholder="Label the client sees" style="flex:1;min-width:140px"><input data-bf="guidance" value="${esc(b.guidance || '')}" placeholder="Guidance for you" style="flex:2;min-width:160px"><button class="btn sm quiet danger" data-rmb type="button">✕</button></div>`).join('') || '<p class="muted small">No bands: the result is shown as a number only.</p>';
    };
    const readItems = () => { $$('.b-item', itemsEl).forEach((el, i) => { const it = q.items[i]; it.text = $('[data-it="text"]', el).value.trim(); const t = $('[data-it="type"]', el).value; if (t) it.type = t; else delete it.type; const sub = $('[data-it="subscale"]', el).value.trim(); if (sub) it.subscale = sub; else delete it.subscale; it.reverse = $('[data-it="reverse"]', el).checked; if (!it.reverse) delete it.reverse; const o = $('[data-it="options"]', el); if (o) it.options = o.value.split(';').map(s => s.trim()).filter(Boolean).map(s => { const [l, v] = s.split('='); return { label: (l || '').trim(), value: isNaN(Number(v)) ? (v || '').trim() : Number(v) }; }); else delete it.options; }); };
    const readBands = () => { q.scoring.bands = $$('[data-b]', bandsEl).map(el => ({ max: Number($('[data-bf="max"]', el).value), label: $('[data-bf="label"]', el).value.trim(), guidance: $('[data-bf="guidance"]', el).value.trim() })).filter(b => !isNaN(b.max)); };
    drawItems(); drawBands();
    itemsEl.addEventListener('click', e => { const el = e.target.closest('.b-item'); if (!el) return; const i = +el.dataset.i; readItems(); if (e.target.closest('[data-up]') && i > 0) { [q.items[i - 1], q.items[i]] = [q.items[i], q.items[i - 1]]; drawItems(); } else if (e.target.closest('[data-down]') && i < q.items.length - 1) { [q.items[i + 1], q.items[i]] = [q.items[i], q.items[i + 1]]; drawItems(); } else if (e.target.closest('[data-rm]')) { q.items.splice(i, 1); drawItems(); } });
    itemsEl.addEventListener('change', e => { if (e.target.matches('[data-it="type"]')) { readItems(); drawItems(); } });
    bandsEl.addEventListener('click', e => { const el = e.target.closest('[data-b]'); if (el && e.target.closest('[data-rmb]')) { readBands(); q.scoring.bands.splice(+el.dataset.b, 1); drawBands(); } });
    $('[data-add]', d).addEventListener('click', () => { readItems(); q.items.push({ id: nextId(q), text: '' }); drawItems(); $$('[data-it="text"]', itemsEl).pop().focus(); });
    $('[data-addband]', d).addEventListener('click', () => { readBands(); q.scoring.bands.push({ max: '', label: '', guidance: '' }); drawBands(); });
    $('[data-paste]', d).addEventListener('click', () => { const box = $('[data-pastebox]', d); box.hidden = !box.hidden; if (!box.hidden) $('[data-pastetxt]', d).focus(); });
    $('[data-pastego]', d).addEventListener('click', () => { const t = $('[data-pastetxt]', d).value; if (!t.trim()) return; readItems(); q.items = q.items.filter(it => it.text); t.split('\n').map(s => s.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean).forEach(text => q.items.push({ id: nextId(q), text })); if (!q.items.length) q.items.push({ id: 'q1', text: '' }); $('[data-pastetxt]', d).value = ''; $('[data-pastebox]', d).hidden = true; drawItems(); });
    $('[data-preset]', d).addEventListener('change', e => { const p = PRESETS[e.target.value]; if (p && p.labels.length) { $('[data-f="labels"]', d).value = p.labels.join(', '); $('[data-f="values"]', d).value = p.values.join(', '); } });
    $('[data-f="title"]', d).addEventListener('input', e => { $('[data-h]', d).textContent = e.target.value || 'Untitled'; if (isNew) $('[data-f="id"]', d).value = slug(e.target.value); });
    $('[data-save]', d).addEventListener('click', async e => {
      readItems(); readBands(); const f = k => $(`[data-f="${k}"]`, d);
      q.title = f('title').value.trim(); q.id = isNew ? slug(f('id').value) : q.id; q.kind = f('kind').value; q.instructions = f('instructions').value.trim(); q.notes = f('notes').value.trim();
      q.scale = { type: 'likert', labels: f('labels').value.split(',').map(s => s.trim()).filter(Boolean), values: f('values').value.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n)) };
      q.scoring = { method: f('method').value, bands: q.scoring.bands, higher_is_worse: f('higher_is_worse').checked };
      q.items = q.items.filter(it => it.text);
      const err = validate(q); if (err) { $('[data-msg]', d).textContent = err; return; }
      e.target.disabled = true; try { await API.upsertQuestionnaire(q); A.drop('questionnaires'); closeDrawer(); assessments(); } catch (err) { $('[data-msg]', d).textContent = 'Could not save: ' + (err.message || err); e.target.disabled = false; }
    });
  }
  const nextId = q => { let n = q.items.length + 1; while (q.items.some(it => it.id === 'q' + n)) n++; return 'q' + n; };

  /* ---------- results for one client + instrument (couples side by side) ---------- */
  async function results(c, qid) {
    if (!cache.qs) cache.qs = await A.L.qs();
    if (!cache.couples) cache.couples = await A.L.couples();
    if (!cache.clients) cache.clients = await A.L.clients();
    const q = cache.qs.find(x => x.id === qid); if (!q) return;
    const couple = cache.couples.find(k => k.id === c.coupleId); const partner = couple && (cache.clients || []).find(x => x.uid === couple.members.find(m => m !== c.uid));
    const [mine, theirs] = await Promise.all([API.listResponsesFor(c.uid), partner ? API.listResponsesFor(partner.uid) : Promise.resolve([])]);
    const r = mine.find(x => x.qid === qid), pr = theirs.find(x => x.qid === qid);
    const s = r ? score(q, r.answers) : null, ps = pr ? score(q, pr.answers) : null;
    const attempts = r ? [...(r.history || []).map(h => ({ ...h })), { answers: r.answers, submittedAt: r.submittedAt, attempt: r.attempt || 1, current: true, status: r.status }] : [];
    const trend = attempts.map(a => ({ at: a.submittedAt, s: score(q, a.answers), attempt: a.attempt, status: a.status }));
    const card = (who, sc, resp) => `<div class="card soft" style="padding:12px 14px"><p class="kicker">${esc(who)}</p><div style="font-size:1.5rem;font-weight:650;letter-spacing:-.02em">${fmtScore(sc)}</div>${sc && sc.band ? `<div>${chip({ x: [sc.band.label, bandTone(q, sc)] }, 'x')}</div>` : ''}<div class="muted small" style="margin-top:4px">${resp ? (resp.status === 'submitted' ? 'submitted ' + fmtDate(resp.submittedAt) : 'in progress') + (resp.attempt > 1 ? ' · attempt ' + resp.attempt : '') : 'not started'}</div></div>`;
    const subs = s && s.subscales.length ? `<p class="kicker" style="margin-top:14px">Subscales</p><div class="bars">${s.subscales.map(sub => { const p2 = ps && ps.subscales.find(x => x.name === sub.name); return `<div class="b"><div><div class="lbl"><span>${esc(sub.name)}</span><span class="muted">${sub.total} / ${sub.max}${p2 ? ' · ' + esc(partner.pseudonym) + ' ' + p2.total : ''}</span></div><i style="width:${sub.pct}%"></i></div><span class="n">${sub.pct}%</span></div>`; }).join('')}</div>` : '';
    const rows = (q.items || []).map((it, i) => { const a = r && r.answers[it.id], b = pr && pr.answers[it.id]; const va = itemValue(q, it, a), vb = itemValue(q, it, b); const rng = itemRange(q, it); const tone = v => { if (v == null || !rng) return ''; const [lo, hi] = rng; if (hi === lo) return ''; const p = (v - lo) / (hi - lo); const worse = q.scoring && q.scoring.higher_is_worse; return (worse ? p >= 0.67 : p <= 0.33) ? 'warn' : (worse ? p <= 0.33 : p >= 0.67) ? 'ok' : ''; }; const diff = partner && va != null && vb != null ? Math.abs(va - vb) : 0; const big = rng && diff >= Math.max(1, (rng[1] - rng[0]) / 2);
      return `<tr${big ? ' style="background:color-mix(in srgb, var(--warn) 10%, transparent)"' : ''}><td class="small">${i + 1}. ${esc(it.text)}${it.subscale ? ` <span class="muted">· ${esc(it.subscale)}</span>` : ''}</td><td class="small"><span class="chip ${tone(va)}">${esc(answerLabel(q, it, a))}</span></td>${partner ? `<td class="small"><span class="chip ${tone(vb)}">${esc(answerLabel(q, it, b))}</span></td><td class="small muted nowrap">${big ? '<strong>Δ ' + diff + '</strong>' : diff ? 'Δ ' + diff : ''}</td>` : ''}</tr>`; }).join('');
    drawer(`<p class="kicker">Results · ${esc(KINDS[q.kind] || q.kind || '')}</p><h2>${esc(q.title)}</h2>
      <div class="grid two" style="margin-bottom:12px">${card(c.pseudonym, s, r)}${partner ? card(partner.pseudonym, ps, pr) : ''}</div>
      ${s && s.band && s.band.guidance ? `<div class="notice">${esc(s.band.guidance)}</div>` : ''}
      ${trend.length > 1 ? `<p class="kicker" style="margin-top:14px">Over time</p>${sparkline(trend)}` : ''}
      ${subs}
      <p class="kicker" style="margin-top:14px">Items${partner ? ' <span class="muted small" style="text-transform:none;letter-spacing:0">· highlighted rows: partners differ by half the scale or more</span>' : ''}</p>
      <div class="table-wrap"><table class="table"><thead><tr><th>Item</th><th>${esc(c.pseudonym)}</th>${partner ? `<th>${esc(partner.pseudonym)}</th><th></th>` : ''}</tr></thead><tbody>${rows}</tbody></table></div>
      ${r ? `<div class="field" style="margin-top:16px"><label>Clinician note (staff only)</label><textarea data-note rows="3" placeholder="What this suggests, what to bring to the next session…">${esc(r.staffNote || '')}</textarea></div>
      <div class="row"><button class="btn primary" data-savenote type="button">Save note</button>${r.status === 'submitted' ? `<button class="btn" data-reviewed type="button">${r.reviewedAt ? 'Reviewed ' + fmtDay(r.reviewedAt) + ' · mark again' : 'Mark as reviewed'}</button>` : ''}<span class="small muted" data-msg></span></div>` : ''}
      ${q.notes ? `<p class="kicker" style="margin-top:18px">About this instrument</p><p class="small muted" style="white-space:pre-wrap">${esc(q.notes)}</p>` : ''}
      <p style="margin-top:14px"><button class="btn sm" type="button" data-backc>← Back to ${esc(c.pseudonym)}</button></p>`);
    const d = $('#drawer');
    $('[data-backc]', d).addEventListener('click', () => A.openClient(c.uid));
    if (r) {
      const me = API.currentUser();
      $('[data-savenote]', d).addEventListener('click', async e => { e.target.disabled = true; const patch = { staffNote: $('[data-note]', d).value.trim() }; await API.updateResponse(r.id || `${c.uid}_${qid}`, patch); Object.assign(r, patch); $('[data-msg]', d).textContent = 'Saved.'; e.target.disabled = false; });
      const rv = $('[data-reviewed]', d); if (rv) rv.addEventListener('click', async () => { rv.disabled = true; const patch = { reviewedAt: new Date().toISOString(), reviewedBy: me ? me.email : '' }; await API.updateResponse(r.id || `${c.uid}_${qid}`, patch); Object.assign(r, patch); A.drop('resps'); rv.textContent = 'Reviewed ' + fmtDay(patch.reviewedAt); if (cache.resps) { const x = cache.resps.find(y => y.id === (r.id || `${c.uid}_${qid}`)); if (x) Object.assign(x, patch); } });
    }
  }
  function sparkline(trend) {
    const pts = trend.filter(t => t.s); if (pts.length < 2) return '';
    const W = 480, H = 90, pad = 24; const max = Math.max(...pts.map(t => t.s.max || t.s.total)), min = Math.min(0, ...pts.map(t => t.s.min || 0));
    const x = i => pad + i * (W - pad * 2) / (pts.length - 1), y = v => H - 18 - (v - min) / (max - min || 1) * (H - 34);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Score over attempts"><polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${pts.map((t, i) => `${x(i).toFixed(1)},${y(t.s.total).toFixed(1)}`).join(' ')}"/>${pts.map((t, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(t.s.total).toFixed(1)}" r="4" fill="var(--accent)"><title>${t.s.total} · ${t.at ? fmtDay(t.at) : 'attempt ' + t.attempt}</title></circle><text x="${x(i).toFixed(1)}" y="${H - 4}" text-anchor="middle">${t.at ? fmtDay(t.at) : 'attempt ' + t.attempt}</text><text x="${x(i).toFixed(1)}" y="${(y(t.s.total) - 8).toFixed(1)}" text-anchor="middle">${t.s.total}</text>`).join('')}</svg>`;
  }

  /* ---------- snapshot block for the client drawer ---------- */
  function snapshot(c, resp, qs) {
    const assigned = (c.assigned || []).map(id => qs.find(q => q.id === id)).filter(Boolean);
    if (!assigned.length) return '<p class="muted small">Nothing assigned yet — tick the instruments below.</p>';
    return `<div class="snap">${assigned.map(q => { const r = resp.find(x => x.qid === q.id); const s = r && r.status === 'submitted' ? score(q, r.answers) : null;
      return `<a href="#" class="snap-row" data-res="${esc(q.id)}"><span class="t">${esc(q.title)}</span><span class="v">${r ? (r.status === 'submitted' ? `<strong>${fmtScore(s)}</strong>` : '<span class="muted">in progress</span>') : '<span class="muted">not started</span>'}</span><span class="c">${s && s.band ? chip({ x: [s.band.label, bandTone(q, s)] }, 'x') : ''}${r && r.status === 'submitted' && !r.reviewedAt ? '<span class="chip new">to review</span>' : ''}</span></a>`; }).join('')}</div>`;
  }

  A.assess = { score, results, snapshot, KINDS, validate, normalize };
  A.sections.assessments = assessments;
})();
