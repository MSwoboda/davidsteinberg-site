/* Site content: edit what the public site shows, preview the draft on the real site, publish. Works on the
   whole content object (the same shape as content/content.json): the draft lives in Firestore site/draft, the
   live copy in site/published, every publish is kept under site/versions. The site's baked-in content.js is the
   seed when nothing has been published yet. */
(function () {
  'use strict';
  const A = window.ADMIN; const { $, $$, esc, fmtDate, chip, drawer, closeDrawer } = A;
  const ART = ['garden', 'compass', 'bridge', 'book-open', 'two-cups', 'door', 'house', 'keys', 'kettle', 'lamp-chair', 'laptop', 'ledger', 'letter', 'lock', 'mirror', 'moon-window', 'path-trees', 'sunrise', 'tree-roots', 'umbrella', 'window-plant', 'chairs', 'clock', 'boat', 'bird-branch', 'ornament'];
  const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  const words = html => String(html || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  let C = null, dirty = false, pubMeta = null, draftMeta = null, tab = 'articles';

  /* ---------- schemas: what each content type looks like in the editor ----------
     field types: text, textarea, html, art, bool, number, select, list (of strings), photo */
  const CATS = () => [...new Set(((C && C.articles) || []).map(a => a.category))];
  const TYPES = {
    articles: { label: 'Articles', key: 'articles', title: a => a.title, sub: a => `${a.category} · ${a.read_minutes || words(a.content_html) / 200 | 0} min · ${words(a.content_html)} words`, status: true, newItem: () => ({ id: '', title: '', category: 'Couples counseling', excerpt: '', content_html: '<p></p>', art: 'garden', read_minutes: 4, status: 'draft' }),
      fields: [['title', 'Title', 'text'], ['id', 'Id (in the link: #article/…)', 'slug'], ['category', 'Category', 'combo', CATS], ['excerpt', 'Summary (cards and search)', 'textarea'], ['art', 'Illustration', 'art'], ['image', 'Photo instead (URL, optional)', 'text'], ['read_minutes', 'Reading time (minutes)', 'number'], ['meta_description', 'Search-engine description', 'textarea'], ['content_html', 'Body', 'html']] },
    quizzes: { label: 'Quizzes', key: 'quizzes', title: q => q.title, sub: q => `${(q.items || []).length} questions · ${(q.results || []).length} result bands`, status: true, newItem: () => ({ id: '', title: '', status: 'draft', art: 'compass', intro: '', instructions: 'Answer for the last two weeks. There are no right answers.', scale: { labels: ['Rarely', 'Sometimes', 'Often', 'Almost always'], values: [1, 2, 3, 4] }, items: [{ text: '' }], button: 'See my result', results: [{ min_pct: 67, title: '', text: '', cta_label: 'Request a consultation', cta_href: '#contact' }, { min_pct: 34, title: '', text: '', cta_label: 'Request a consultation', cta_href: '#contact' }, { min_pct: 0, title: '', text: '', cta_label: 'Request a consultation', cta_href: '#contact' }], outro: 'This self-check is for reflection, not diagnosis.' }),
      fields: [['title', 'Title', 'text'], ['id', 'Id (in the link: #quiz/…)', 'slug'], ['art', 'Illustration', 'art'], ['intro', 'Introduction (also the card summary)', 'textarea'], ['instructions', 'Instructions', 'textarea'], ['scale', 'Answer scale', 'scale'], ['items', 'Questions', 'items'], ['button', 'Button label', 'text'], ['results', 'Result bands (highest first; "from %" is the share of the maximum score)', 'results'], ['outro', 'Closing note', 'textarea']] },
    pages: { label: 'Pages', key: 'pages', title: p => p.title, sub: p => `#page/${p.id} · ${words(p.content_html)} words`, status: true, newItem: () => ({ id: '', title: '', kicker: '', meta: '', art: 'letter', content_html: '<p></p>', status: 'draft' }),
      fields: [['title', 'Title', 'text'], ['id', 'Id (in the link: #page/…)', 'slug'], ['kicker', 'Kicker (small line above the title)', 'text'], ['meta', 'Line under the title', 'text'], ['art', 'Illustration', 'art'], ['content_html', 'Body', 'html']] },
    services: { label: 'Counseling', key: 'services', title: s => s.name, sub: s => `#service/${s.id} · menu: ${s.menu || s.name}`, status: true, newItem: () => ({ id: '', name: '', menu: '', summary: '', content_html: '<p></p>', art: 'garden', status: 'draft' }),
      fields: [['name', 'Name', 'text'], ['id', 'Id (in the link: #service/…)', 'slug'], ['menu', 'Short name in the menu', 'text'], ['summary', 'Summary (cards and explorer)', 'textarea'], ['art', 'Illustration', 'art'], ['meta_description', 'Search-engine description', 'textarea'], ['content_html', 'Full page', 'html']] },
    faq: { label: 'Questions', key: 'faq', title: f => f.q, sub: f => f.group, status: true, newItem: () => ({ q: '', a: '', group: (C.faq_groups || [])[0] || 'Getting started', status: 'draft' }),
      fields: [['q', 'Question', 'text'], ['group', 'Topic', 'combo', () => C.faq_groups || []], ['a', 'Answer', 'textarea']] },
  };
  const SINGLES = {
    home: { label: 'Home page', fields: [['home.hero_kicker', 'Hero kicker', 'text'], ['home.hero_title', 'Headline (one line per row)', 'textarea'], ['home.hero_lead', 'Hero paragraph', 'textarea'], ['home.hero_note', 'Hero note', 'text'], ['learn', 'What you will learn (ticker, one per line)', 'lines'], ['closing.title', 'Closing title', 'text'], ['closing.text', 'Closing text', 'textarea']] },
    about: { label: 'About', fields: [['about_line', 'One-line intro', 'textarea'], ['about.content_html', 'Biography', 'html'], ['milestones', 'Milestones', 'rows', ['year', 'text']], ['steps', 'What to expect (steps)', 'rows', ['title', 'text']], ['ways', 'Three ways to work together', 'rows', ['title', 'lead', 'text']], ['stories', 'Stories carousel', 'rows', ['title', 'text', 'photo', 'alt']], ['audiences', 'Who I work with', 'rows', ['label', 'short', 'kicker', 'title', 'text', 'result', 'photo', 'service']]] },
    practice: { label: 'Practice details', fields: [['practice.name', 'Name', 'text'], ['practice.credentials', 'Credentials', 'text'], ['practice.phone', 'Phone', 'text'], ['practice.address.street', 'Street', 'text'], ['practice.address.city', 'City', 'text'], ['practice.address.state', 'State', 'text'], ['practice.address.zip', 'ZIP', 'text'], ['practice.insurance', 'Insurance plans accepted (one per line)', 'lines'], ['consultation_form.caution', 'Form caution line', 'textarea'], ['consultation_form.consent', 'Consent line under the form', 'textarea'], ['consultation_form.success.title', 'Thank-you title ({name} = first name)', 'text'], ['consultation_form.success.text', 'Thank-you text', 'textarea']] },
  };
  const get = (o, path) => path.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
  const set = (o, path, v) => { const ks = path.split('.'); let x = o; ks.slice(0, -1).forEach(k => { if (x[k] == null || typeof x[k] !== 'object') x[k] = {}; x = x[k]; }); x[ks[ks.length - 1]] = v; };

  /* ---------- load / save ---------- */
  async function load() {
    const [draft, pub] = await Promise.all([API.getSite('draft'), API.getSite('published')]);
    draftMeta = draft; pubMeta = pub;
    const src = draft || pub; C = src ? JSON.parse(src.json) : JSON.parse(JSON.stringify(window.CONTENT || {}));
    if (!C.quizzes) C.quizzes = []; if (!C.pages) C.pages = []; dirty = false;
  }
  async function saveDraft(msgEl) {
    if (msgEl) msgEl.textContent = 'Saving…';
    draftMeta = await API.saveSiteDraft(JSON.stringify(C)); dirty = false;
    if (msgEl) msgEl.textContent = 'Draft saved ' + fmtDate(draftMeta.updatedAt) + '.';
    header();
  }
  function previewDraft() {
    try { localStorage.setItem('ds-preview-content', JSON.stringify(C)); } catch (e) { alert('Could not hand the draft to the site (browser storage is blocked).'); return; }
    window.open('../?preview=1', 'ds-preview');
  }
  async function publish() {
    const note = prompt('Publish this version of the site? Add a short note for the history (optional):', ''); if (note === null) return;
    const v = await API.publishSite(JSON.stringify(C), note.trim()); draftMeta = null; pubMeta = { version: v, updatedAt: v, updatedBy: (API.currentUser() || {}).email, note }; dirty = false;
    try { localStorage.removeItem('ds-live-content'); } catch (e) {} A.drop('published');
    header(); alert('Published. The site shows the new content within a minute; visitors who already have the page open see it on their next visit.');
  }

  /* ---------- section ---------- */
  async function content() {
    if (!C) await load();
    A.main.innerHTML = `<div id="c-head"></div>
      <div class="pill-tabs" style="margin:14px 0">${[...Object.entries(TYPES).map(([k, t]) => [k, t.label]), ...Object.entries(SINGLES).map(([k, t]) => [k, t.label]), ['versions', 'History']].map(([k, l]) => `<button type="button" data-tab="${k}" aria-selected="${k === tab}">${esc(l)}</button>`).join('')}</div>
      <div id="c-body"></div>`;
    header(); body();
    $$('[data-tab]', A.main).forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; $$('[data-tab]', A.main).forEach(x => x.setAttribute('aria-selected', x === b)); body(); }));
  }
  function header() {
    const h = $('#c-head'); if (!h) return;
    h.innerHTML = `<div class="row between"><div><h1 style="margin:0">Site content</h1><p class="muted small" style="margin:4px 0 0">${pubMeta ? `Live: published ${fmtDate(pubMeta.updatedAt)}${pubMeta.note ? ' · ' + esc(pubMeta.note) : ''}` : 'Live: the built-in content (nothing published from here yet)'}${draftMeta ? ` · <strong>Unpublished draft</strong> saved ${fmtDate(draftMeta.updatedAt)}` : ''}${dirty ? ' · <span class="chip warn">unsaved changes</span>' : ''}</p></div>
      <div class="row"><button class="btn" data-export type="button">Export JSON</button><button class="btn" data-preview type="button">Preview</button><button class="btn" data-save type="button">Save draft</button><button class="btn primary" data-publish type="button">Publish</button></div></div><p class="small muted" data-msg style="margin:6px 0 0"></p>`;
    $('[data-save]', h).addEventListener('click', () => saveDraft($('[data-msg]', h)));
    $('[data-preview]', h).addEventListener('click', previewDraft);
    $('[data-publish]', h).addEventListener('click', publish);
    $('[data-export]', h).addEventListener('click', () => { const txt = JSON.stringify(C, null, 2); drawer(`<p class="kicker">Export</p><h2>content.json</h2><p class="muted small">Paste into <code>content/content.json</code> in the repo and run <code>tools/build.py</code> to bake it in as the fallback.</p><div class="field"><textarea class="mono" rows="24" readonly data-txt>${esc(txt)}</textarea></div><div class="row"><button class="btn" data-copy type="button">Copy</button><span class="small muted" data-m></span></div>`); $('#drawer [data-copy]').addEventListener('click', async () => { try { await navigator.clipboard.writeText(txt); $('#drawer [data-m]').textContent = 'Copied.'; } catch (e) { $('#drawer [data-txt]').select(); } }); });
  }
  const touch = () => { dirty = true; header(); };

  function body() {
    const b = $('#c-body'); if (!b) return;
    if (TYPES[tab]) return listView(b, TYPES[tab]);
    if (SINGLES[tab]) return singleView(b, SINGLES[tab]);
    if (tab === 'versions') return versionsView(b);
  }

  /* ---------- lists (articles, quizzes, pages, services, faq) ---------- */
  function listView(b, T) {
    const items = C[T.key] || (C[T.key] = []);
    b.innerHTML = `<div class="row between" style="margin-bottom:10px"><p class="muted small" style="margin:0">${items.length} ${T.label.toLowerCase()} · drafts are hidden on the site until published with status "Live".</p><button class="btn primary sm" data-new type="button">New</button></div>
      <section class="card"><div class="table-wrap"><table class="table"><tbody>${items.map((it, i) => `<tr class="clickable" data-i="${i}"><td><strong>${esc(T.title(it) || '(untitled)')}</strong><br><span class="muted small">${esc(T.sub(it))}</span></td><td>${it.status === 'draft' ? '<span class="chip warn">Draft</span>' : '<span class="chip ok">Live</span>'}</td><td class="actions"><button class="btn sm quiet" data-up type="button" title="Move up">↑</button><button class="btn sm quiet" data-down type="button" title="Move down">↓</button> <button class="btn sm" type="button">Edit</button></td></tr>`).join('') || `<tr><td><div class="empty">Nothing yet.</div></td></tr>`}</tbody></table></div></section>`;
    $('[data-new]', b).addEventListener('click', () => editItem(T, T.newItem(), -1));
    $$('tr[data-i]', b).forEach(tr => tr.addEventListener('click', e => { const i = +tr.dataset.i; if (e.target.closest('[data-up]')) { if (i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; touch(); listView(b, T); } return; } if (e.target.closest('[data-down]')) { if (i < items.length - 1) { [items[i + 1], items[i]] = [items[i], items[i + 1]]; touch(); listView(b, T); } return; } editItem(T, JSON.parse(JSON.stringify(items[i])), i); }));
  }
  function editItem(T, it, index) {
    const isNew = index < 0;
    drawer(`<p class="kicker">${esc(T.label)}</p><h2 data-h>${esc(T.title(it) || 'New')}</h2>
      ${T.status ? `<div class="field"><label>Status</label><select data-status><option value="draft" ${it.status === 'draft' ? 'selected' : ''}>Draft — hidden on the site</option><option value="live" ${it.status !== 'draft' ? 'selected' : ''}>Live — shown once published</option></select></div>` : ''}
      ${T.fields.map(f => fieldHtml(f, get(it, f[0]), it)).join('')}
      <div class="row" style="margin-top:12px"><button class="btn primary" data-ok type="button">${isNew ? 'Add' : 'Apply'}</button>${!isNew ? '<button class="btn danger" data-rm type="button">Remove</button>' : ''}<span class="small muted">Then “Save draft” or “Publish” at the top.</span></div>`);
    const d = $('#drawer');
    bindFields(d, T.fields, it);
    const tInput = $(`[data-f="${T.fields[0][0]}"]`, d); if (tInput) tInput.addEventListener('input', () => { $('[data-h]', d).textContent = tInput.value || 'New'; if (isNew) { const idEl = $('[data-f="id"]', d); if (idEl) idEl.value = slug(tInput.value); } });
    $('[data-ok]', d).addEventListener('click', () => {
      readFields(d, T.fields, it);
      if (T.status) it.status = $('[data-status]', d).value === 'draft' ? 'draft' : 'live';
      if ('id' in it) { it.id = slug(it.id || T.title(it)); if (!it.id) { alert('An id is needed.'); return; } if ((C[T.key] || []).some((x, i) => x.id === it.id && i !== index)) { alert('Another entry already uses the id "' + it.id + '".'); return; } }
      if (T.key === 'articles' && !it.read_minutes) it.read_minutes = Math.max(1, Math.round(words(it.content_html) / 200));
      if (isNew) C[T.key].push(it); else C[T.key][index] = it;
      touch(); closeDrawer(); body();
    });
    const rm = $('[data-rm]', d); if (rm) rm.addEventListener('click', () => { if (!confirm('Remove "' + (T.title(it) || 'this') + '" from the draft?')) return; C[T.key].splice(index, 1); touch(); closeDrawer(); body(); });
  }

  /* ---------- single documents (home, about, practice) ---------- */
  function singleView(b, S) {
    b.innerHTML = `<section class="card">${S.fields.map(f => fieldHtml(f, get(C, f[0]), C)).join('')}<div class="row"><button class="btn primary" data-apply type="button">Apply</button><span class="small muted">Then “Save draft” or “Publish” at the top.</span></div></section>`;
    bindFields(b, S.fields, C);
    $('[data-apply]', b).addEventListener('click', () => { readFields(b, S.fields, C); touch(); singleView(b, S); });
  }

  /* ---------- field renderers ---------- */
  function fieldHtml([key, label, type, extra], val, obj) {
    const id = 'f-' + key.replace(/\./g, '-');
    const wrap = inner => `<div class="field" data-field="${esc(key)}"><label for="${id}">${esc(label)}</label>${inner}</div>`;
    switch (type) {
      case 'text': case 'slug': return wrap(`<input id="${id}" data-f="${esc(key)}" value="${esc(val == null ? '' : val)}"${type === 'slug' ? ' class="mono"' : ''}>`);
      case 'number': return wrap(`<input id="${id}" type="number" data-f="${esc(key)}" value="${esc(val == null ? '' : val)}" style="max-width:140px">`);
      case 'textarea': return wrap(`<textarea id="${id}" data-f="${esc(key)}" rows="3">${esc(val == null ? '' : val)}</textarea>`);
      case 'lines': return wrap(`<textarea id="${id}" data-f="${esc(key)}" rows="5">${esc((val || []).join('\n'))}</textarea>`);
      case 'combo': { const opts = (typeof extra === 'function' ? extra() : extra) || []; return wrap(`<input id="${id}" data-f="${esc(key)}" value="${esc(val || '')}" list="${id}-l"><datalist id="${id}-l">${opts.map(o => `<option value="${esc(o)}">`).join('')}</datalist>`); }
      case 'art': return wrap(`<div class="art-pick" data-f="${esc(key)}">${ART.map(a => `<button type="button" data-art="${a}" aria-pressed="${val === a}" title="${a}"><img src="../assets/civic/${a}.svg" alt=""></button>`).join('')}</div>`);
      case 'html': return wrap(`<div class="rte" data-f="${esc(key)}"><div class="rte-bar"><button type="button" data-cmd="formatBlock" data-arg="h3">Heading</button><button type="button" data-cmd="formatBlock" data-arg="p">Paragraph</button><button type="button" data-cmd="bold"><b>B</b></button><button type="button" data-cmd="italic"><i>I</i></button><button type="button" data-cmd="insertUnorderedList">• List</button><button type="button" data-cmd="insertOrderedList">1. List</button><button type="button" data-cmd="formatBlock" data-arg="blockquote">Quote</button><button type="button" data-cmd="link">Link</button><button type="button" data-cmd="removeFormat">Clear</button><span class="spacer"></span><button type="button" data-html-toggle>HTML</button></div><div class="rte-edit" contenteditable="true">${val || '<p></p>'}</div><textarea class="rte-src mono" rows="14" hidden>${esc(val || '')}</textarea><p class="hint">Paste from a document keeps only text and simple formatting.</p></div>`);
      case 'scale': return wrap(`<div class="grid two"><input data-f="${esc(key)}.labels" placeholder="Labels, comma-separated" value="${esc(((val || {}).labels || []).join(', '))}"><input data-f="${esc(key)}.values" class="mono" placeholder="Values" value="${esc(((val || {}).values || []).join(', '))}"></div>`);
      case 'items': case 'results': case 'rows': return wrap(`<div class="rows" data-f="${esc(key)}" data-type="${type}" data-cols="${esc((extra || []).join(','))}">${(val || []).map((r, i) => rowHtml(type, extra, r, i)).join('')}<button class="btn sm" data-addr type="button" style="margin-top:6px">${type === 'items' ? 'Add question' : type === 'results' ? 'Add band' : 'Add'}</button></div>`);
      case 'bool': return wrap(`<label class="row" style="gap:8px"><input id="${id}" type="checkbox" data-f="${esc(key)}" ${val ? 'checked' : ''}> yes</label>`);
    }
    return '';
  }
  function rowHtml(type, cols, r, i) {
    r = r || {};
    if (type === 'items') return `<div class="row" data-r="${i}" style="gap:6px;margin-bottom:6px"><span class="muted small mono" style="width:24px">${i + 1}.</span><input data-k="text" value="${esc(r.text || '')}" placeholder="Statement" style="flex:1;min-width:200px"><button class="btn sm quiet danger" data-rmr type="button">✕</button></div>`;
    if (type === 'results') return `<div class="card soft" data-r="${i}" style="padding:12px 14px;margin-bottom:8px"><div class="row" style="gap:8px"><input data-k="min_pct" type="number" min="0" max="100" value="${esc(r.min_pct == null ? '' : r.min_pct)}" placeholder="from %" style="width:90px"><input data-k="title" value="${esc(r.title || '')}" placeholder="Short title" style="flex:1;min-width:140px"><button class="btn sm quiet danger" data-rmr type="button">✕</button></div><textarea data-k="text" rows="2" placeholder="What this result means" style="width:100%;margin-top:6px">${esc(r.text || '')}</textarea><div class="row" style="gap:8px;margin-top:6px"><input data-k="cta_label" value="${esc(r.cta_label || '')}" placeholder="Button label (optional)" style="flex:1"><input data-k="cta_href" value="${esc(r.cta_href || '')}" placeholder="#contact" class="mono" style="flex:1"></div></div>`;
    return `<div class="card soft" data-r="${i}" style="padding:10px 12px;margin-bottom:8px"><div class="row" style="gap:6px;align-items:flex-start"><div style="flex:1;display:grid;gap:6px">${(cols || []).map(c => c === 'text' || c === 'lead' ? `<textarea data-k="${c}" rows="2" placeholder="${c}">${esc(r[c] || '')}</textarea>` : `<input data-k="${c}" value="${esc(r[c] || '')}" placeholder="${c}">`).join('')}</div><button class="btn sm quiet danger" data-rmr type="button">✕</button></div></div>`;
  }
  function bindFields(root, fields, obj) {
    $$('.art-pick', root).forEach(p => p.addEventListener('click', e => { const b = e.target.closest('[data-art]'); if (!b) return; $$('[data-art]', p).forEach(x => x.setAttribute('aria-pressed', x === b)); }));
    $$('.rte', root).forEach(r => {
      const ed = $('.rte-edit', r), src = $('.rte-src', r);
      $('.rte-bar', r).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; e.preventDefault();
        if (b.dataset.htmlToggle != null) { const toSrc = src.hidden; if (toSrc) { src.value = clean(ed.innerHTML); } else { ed.innerHTML = src.value; } src.hidden = !toSrc; ed.hidden = toSrc; b.setAttribute('aria-pressed', toSrc); return; }
        ed.focus(); const cmd = b.dataset.cmd; if (cmd === 'link') { const u = prompt('Link address (https://… or #article/…):'); if (u) document.execCommand('createLink', false, u); return; } document.execCommand(cmd, false, b.dataset.arg || null); });
      ed.addEventListener('paste', e => { e.preventDefault(); const html = e.clipboardData.getData('text/html'); const txt = e.clipboardData.getData('text/plain'); document.execCommand('insertHTML', false, html ? clean(html) : esc(txt).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')); });
    });
    $$('.rows', root).forEach(rows => {
      rows.addEventListener('click', e => {
        if (e.target.closest('[data-rmr]')) { e.target.closest('[data-r]').remove(); return; }
        const add = e.target.closest('[data-addr]'); if (add) { const n = $$('[data-r]', rows).length; add.insertAdjacentHTML('beforebegin', rowHtml(rows.dataset.type, rows.dataset.cols ? rows.dataset.cols.split(',').filter(Boolean) : [], null, n)); const first = $$('[data-r]', rows).pop().querySelector('input, textarea'); if (first) first.focus(); }
      });
    });
  }
  function readRows(rows, field) {
    return $$('[data-r]', rows).map(el => { const o = {}; $$('[data-k]', el).forEach(i => { const v = i.value.trim(); o[i.dataset.k] = i.type === 'number' ? (v === '' ? null : Number(v)) : v; }); return o; }).filter(o => Object.values(o).some(v => v !== '' && v != null));
  }
  function readFields(root, fields, obj) {
    fields.forEach(f => {
      const [key, , type] = f; const el = $(`[data-f="${key}"]`, root);
      switch (type) {
        case 'text': case 'slug': case 'combo': case 'textarea': set(obj, key, el.value.trim()); break;
        case 'number': set(obj, key, el.value === '' ? null : Number(el.value)); break;
        case 'lines': set(obj, key, el.value.split('\n').map(s => s.trim()).filter(Boolean)); break;
        case 'bool': set(obj, key, el.checked); break;
        case 'art': { const b = $('[data-art][aria-pressed="true"]', el); set(obj, key, b ? b.dataset.art : 'garden'); break; }
        case 'html': { const src = $('.rte-src', el); set(obj, key, clean(src.hidden ? $('.rte-edit', el).innerHTML : src.value)); break; }
        case 'scale': set(obj, key, { labels: $(`[data-f="${key}.labels"]`, root).value.split(',').map(s => s.trim()).filter(Boolean), values: $(`[data-f="${key}.values"]`, root).value.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n)) }); break;
        case 'items': set(obj, key, readRows(el, f).filter(r => r.text)); break;
        case 'results': set(obj, key, readRows(el, f).map(r => ({ ...r, min_pct: r.min_pct == null ? 0 : r.min_pct })).sort((a, b) => b.min_pct - a.min_pct)); break;
        case 'rows': set(obj, key, readRows(el, f)); break;
      }
    });
    if (fields.some(f => f[0] === 'id') && !obj.id && obj.title) obj.id = slug(obj.title);
    if ('q' in obj && 'a' in obj && obj.group && C.faq_groups && !C.faq_groups.includes(obj.group)) C.faq_groups.push(obj.group);
  }
  /* keep only simple semantic HTML from the editor or a paste */
  function clean(html) {
    const t = document.createElement('div'); t.innerHTML = html;
    const ALLOW = { P: 1, H3: 1, H2: 1, UL: 1, OL: 1, LI: 1, STRONG: 1, B: 1, EM: 1, I: 1, A: 1, BR: 1, BLOCKQUOTE: 1, TABLE: 1, THEAD: 1, TBODY: 1, TR: 1, TH: 1, TD: 1, HR: 1 };
    const walk = node => { [...node.childNodes].forEach(n => { if (n.nodeType !== 1) return; if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE') { n.remove(); return; } walk(n); if (!ALLOW[n.tagName]) { if (n.tagName === 'DIV' || n.tagName === 'SPAN' || n.tagName === 'FONT' || n.tagName === 'SECTION') { n.replaceWith(...n.childNodes); } else if (n.tagName === 'H1' || n.tagName === 'H4') { const h = document.createElement('h3'); h.innerHTML = n.innerHTML; n.replaceWith(h); } else { n.replaceWith(...n.childNodes); } return; } [...n.attributes].forEach(a => { if (!(n.tagName === 'A' && a.name === 'href') && !(a.name === 'class' && /fee-table|draft/.test(a.value))) n.removeAttribute(a.name); }); }); };
    walk(t); return t.innerHTML.replace(/<p>(\s|&nbsp;|<br>)*<\/p>/g, '').trim() || '<p></p>';
  }

  /* ---------- versions ---------- */
  async function versionsView(b) {
    b.innerHTML = '<p class="muted">Loading…</p>';
    const vs = await API.listSiteVersions();
    b.innerHTML = `<section class="card"><p class="muted small">Every publish is kept. Restoring loads that version into the draft; publish to make it live.</p><div class="table-wrap"><table class="table"><thead><tr><th>Published</th><th>By</th><th>Note</th><th>Size</th><th></th></tr></thead><tbody>${vs.map(v => `<tr><td class="small">${fmtDate(v.updatedAt || v.version)}${pubMeta && pubMeta.version === (v.version || v.id) ? ' <span class="chip ok">live</span>' : ''}</td><td class="small">${esc(v.updatedBy || '')}</td><td class="small">${esc(v.note || '')}</td><td class="small muted">${Math.round((v.size || 0) / 1024)} KB</td><td class="actions"><button class="btn sm" data-restore="${esc(v.id)}" type="button">Restore to draft</button></td></tr>`).join('') || '<tr><td colspan="5"><div class="empty">Nothing published from here yet.</div></td></tr>'}</tbody></table></div></section>`;
    $$('[data-restore]', b).forEach(btn => btn.addEventListener('click', async () => { const v = await API.getSiteVersion(btn.dataset.restore); if (!v || !v.json) return; if (!confirm('Replace the current draft with the version from ' + fmtDate(v.updatedAt || v.version) + '?')) return; C = JSON.parse(v.json); touch(); tab = 'articles'; content(); }));
  }

  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  A.sections.content = content;
})();
