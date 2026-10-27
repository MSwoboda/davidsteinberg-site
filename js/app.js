/* Shared renderer + theme switcher. Content comes from js/content.js (built from content/content.json). */
(function () {
  let C = window.CONTENT;
  const live = x => Array.isArray(x) ? x.filter(i => i && i.status !== 'draft') : [];   // items the dashboard has not published yet stay out
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const artImg = (item, cls) => item.image ? `<img${cls ? ` class="${cls}"` : ''} class="photo" src="${esc(item.image)}" alt="${esc(item.image_alt || '')}" loading="lazy">` : `<img${cls ? ` class="${cls}"` : ''} src="assets/civic/${item.art || 'garden'}.svg" alt="" loading="lazy">`;
  const root = document.documentElement;

  /* ---------- light / dark mode (the Civic template is the live one; Nouveau and Sage live in archive/) ---------- */
  function applyImages() {
    const m = root.dataset.mode;
    $$('img[data-src-dark]').forEach(img => {
      img.dataset.srcDefault = img.dataset.srcDefault || img.getAttribute('src');
      const want = (m === 'dark' && img.dataset.srcDark) ? img.dataset.srcDark : img.dataset.srcDefault;
      if (img.getAttribute('src') !== want) img.src = want;
    });
  }
  function setMode(m) { root.dataset.mode = m; applyImages(); try { localStorage.setItem('ds-mode', m); } catch (e) {} }
  const params = new URLSearchParams(location.search);
  let mode = params.get('mode');
  try { mode = mode || localStorage.getItem('ds-mode'); } catch (e) {}
  if (!mode) mode = (root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)) ? 'dark' : 'light';
  setMode(mode);
  $$('[data-toggle-mode]').forEach(b => b.addEventListener('click', () => setMode(root.dataset.mode === 'dark' ? 'light' : 'dark')));

  /* ---------- link map: old URLs -> pages ---------- */
  const linkMap = {};
  const norm = u => u.replace(/^https?:\/\/davidsteinberg\.com/, '').replace(/\/$/, '') + '/';
  function buildLinkMap() {
    (C.services || []).forEach(s => { [s.original_url, ...(s.aliases || [])].filter(u => u && /^(https?:|\/)/.test(u)).forEach(u => linkMap[norm(u)] = { kind: 'service', id: s.id }); });
    (C.articles || []).forEach(a => { [a.original_url, ...(a.aliases || [])].filter(u => u && /^(https?:|\/)/.test(u)).forEach(u => linkMap[norm(u)] = { kind: 'article', id: a.id }); });
    linkMap['/psychotherapist-counseling-philadelphia/relationship-counseling/'] = { kind: 'service', id: 'relationship' };
    linkMap['/psychotherapist/relationship-counseling-philadelphia/'] = { kind: 'service', id: 'relationship' };
  }
  function rewriteLinks(rootEl) {
    $$('a[href]', rootEl).forEach(a => {
      const h = a.getAttribute('href');
      if (!h || h.startsWith('#') || h.startsWith('tel:') || h.startsWith('mailto:')) return;
      if (/request-a-consultation|schedule-an-appointment/.test(h)) { a.setAttribute('href', '#contact'); return; }
      if (/about-david-steinberg/.test(h)) { a.setAttribute('href', '#about'); return; }
      const t = linkMap[norm(h)];
      if (t) a.setAttribute('href', '#' + t.kind + '/' + t.id);
      else if (/davidsteinberg\.com|^\//.test(h)) a.replaceWith(...a.childNodes);
    });
  }

  /* ---------- counseling: grid (for the other concepts) + explorer ---------- */
  const shapes = ['circle', 'half', 'quarter', 'ring', 'square', 'triangle', 'pill', 'leaf', 'diamond'];
  function renderServices() {
    $('[data-render="services"]').innerHTML = live(C.services).map((s, i) => `
      <article class="card service${i < 3 ? ' featured' : ''}" data-shape="${shapes[i % shapes.length]}" data-id="${s.id}">
        <div class="card-deco" aria-hidden="true">${i < 3 ? artImg(s) : ''}</div>
        <h3 class="card-title">${esc(s.name)}</h3>
        <p class="card-text">${esc(s.summary.length > 180 ? s.summary.slice(0, 177).replace(/\s\S*$/, '') + '…' : s.summary)}</p>
        <a class="card-link" href="#service/${s.id}">Read more<span class="sr-only"> about ${esc(s.name)}</span></a>
      </article>`).join('');
  }
  function themesOf(html) {
    return [...html.matchAll(/<h2>(.*?)<\/h2>/gs)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(t => t.length > 12 && t.length < 110 && !/^I will teach/.test(t)).slice(0, 4);
  }
  function renderExplorer() {
    const tabs = $('.explorer .tabs'), wrap = $('.explorer .panel-wrap');
    tabs.innerHTML = live(C.services).map((s, i) => `<li role="presentation"><button class="tab" role="tab" type="button" id="tab-${s.id}" aria-controls="panel-${s.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"><span class="num">${pad(i + 1)}</span><span>${esc(s.menu || s.name)}</span></button></li>`).join('');
    wrap.innerHTML = live(C.services).map((s, i) => {
      const themes = themesOf(s.content_html);
      const group = ['couples', 'marriage', 'relationship'].includes(s.id) ? 'Couples and relationships' : s.id === 'supervision' ? 'For clinicians' : 'Individual work';
      return `<div class="cap-panel" role="tabpanel" id="panel-${s.id}" aria-labelledby="tab-${s.id}"${i ? ' hidden' : ''}>
        <figure class="art">${artImg(s)}</figure>
        <div class="cap-copy">
          <p class="kicker"><span class="n">${pad(i + 1)}</span>${group}</p>
          <h3>${esc(s.name)}</h3>
          <p>${esc(s.summary)}</p>
          ${themes.length ? `<div class="deliverable"><b>What we look at</b><ul class="checklist">${themes.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
          <a class="text-link" href="#service/${s.id}">Read the full page on ${esc(s.name.toLowerCase())}</a>
        </div>
      </div>`;
    }).join('');
    const sel = $('#service-select');
    sel.innerHTML = live(C.services).map((s, i) => `<option value="${i}">${pad(i + 1)}  ${esc(s.name)}</option>`).join('');
    sel.addEventListener('change', () => select(+sel.value));
    const btns = $$('.tab', tabs), panels = $$('.cap-panel', wrap);
    function select(i, scroll) {
      sel.value = i;
      btns.forEach((b, k) => { b.setAttribute('aria-selected', k === i); b.tabIndex = k === i ? 0 : -1; });
      panels.forEach((p, k) => { p.hidden = k !== i; if (k === i) { p.classList.remove('is-enter'); void p.offsetWidth; p.classList.add('is-enter'); } });
      if (scroll && matchMedia('(max-width: 980px)').matches) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    tabs.addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) select(btns.indexOf(b), true); });
    tabs.addEventListener('keydown', e => { const i = btns.findIndex(b => b === document.activeElement); if (i < 0) return; if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); const n = (i + 1) % btns.length; select(n); btns[n].focus(); } if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); const n = (i - 1 + btns.length) % btns.length; select(n); btns[n].focus(); } });
  }

  /* ---------- audience ---------- */
  function renderAudience() {
    const seg = $('.audience-switch .seg'), panels = $('.audience-switch .aud-panels');
    seg.innerHTML = C.audiences.map((a, i) => `<button type="button" role="tab" id="aud-tab-${a.id}" aria-controls="aud-${a.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"><span class="seg-l">${esc(a.label)}</span><span class="seg-s">${esc(a.short)}</span></button>`).join('');
    panels.innerHTML = C.audiences.map((a, i) => `<div class="aud-panel" role="tabpanel" id="aud-${a.id}" aria-labelledby="aud-tab-${a.id}"${i ? ' hidden' : ''}>
        <figure class="aud-art"><img src="${a.photo}" alt="" loading="lazy"></figure>
        <div>
          <p class="kicker">${esc(a.kicker)}</p>
          <h3>${esc(a.title)}</h3>
          <p>${esc(a.text)}</p>
          <p class="result">${esc(a.result)}</p>
          <ul class="bullets">${a.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>
          <div class="aud-actions"><a class="button primary" href="#contact">Request a consultation</a><a class="text-link" href="#service/${a.service}">More on this work</a></div>
        </div>
      </div>`).join('');
    const btns = $$('button', seg), ps = $$('.aud-panel', panels);
    seg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const i = btns.indexOf(b); btns.forEach((x, k) => { x.setAttribute('aria-selected', k === i); x.tabIndex = k === i ? 0 : -1; }); ps.forEach((p, k) => { p.hidden = k !== i; if (k === i) { p.classList.remove('is-enter'); void p.offsetWidth; p.classList.add('is-enter'); } }); });
  }

  /* ---------- steps timeline ---------- */
  function renderSteps() {
    const ol = $('[data-render="steps"]');
    ol.innerHTML = C.steps.map((st, i) => `<li class="step"><span class="num">${pad(i + 1)}</span><h3>${esc(st.title)}</h3><p>${esc(st.text)}</p></li>`).join('');
    const items = $$('.step', ol);
    function update() {
      const r = ol.getBoundingClientRect(); const mid = innerHeight * 0.55;
      const p = Math.min(1, Math.max(0, (mid - r.top) / r.height));
      ol.style.setProperty('--p', p.toFixed(3));
      items.forEach(li => { const b = li.getBoundingClientRect(); li.classList.toggle('is-done', b.bottom < mid); li.classList.toggle('is-active', b.top <= mid && b.bottom >= mid); });
    }
    addEventListener('scroll', update, { passive: true }); addEventListener('resize', update); update();
  }

  /* ---------- stories carousel ---------- */
  function renderStories() {
    const track = $('.carousel-track');
    track.innerHTML = C.stories.map((st, i) => `
      <article class="slide" data-i="${i}">
        <figure class="slide-media"><img src="${st.photo}" alt="${esc(st.alt)}" loading="lazy"></figure>
        <div class="slide-copy">
          <h3>${esc(st.title)}</h3>
          <p>${esc(st.text)}</p>
          <a class="text-link" href="#service/couples">From ${esc(st.source)}</a>
        </div>
      </article>`).join('');
    const dots = $('.carousel-dots');
    dots.innerHTML = C.stories.map((st, i) => `<button type="button" role="tab" aria-label="Slide ${i + 1}" data-i="${i}"${i === 0 ? ' aria-selected="true"' : ''}></button>`).join('');
    const slides = $$('.slide', track);
    const go = i => { i = (i + slides.length) % slides.length; track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft, behavior: 'smooth' }); };
    const current = () => Math.round(track.scrollLeft / (slides[0].offsetWidth + 1));
    $('.carousel-btn.prev').addEventListener('click', () => go(current() - 1));
    $('.carousel-btn.next').addEventListener('click', () => go(current() + 1));
    dots.addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(+b.dataset.i); });
    track.addEventListener('scroll', () => { const c = current(); $$('button', dots).forEach((b, i) => b.setAttribute('aria-selected', i === c)); }, { passive: true });
  }

  /* ---------- about ---------- */
  function renderHero() {
    const h = C.home || {}; const set = (sel, v, html) => { const el = $(sel); if (el && v) { if (html) el.innerHTML = v; else el.textContent = v; } };
    set('[data-render="hero-kicker"]', h.hero_kicker); set('[data-render="hero-title"]', h.hero_title && esc(h.hero_title).replace(/\n/g, '<br>'), true);
    set('[data-render="hero-lead"]', h.hero_lead); set('[data-render="hero-note"]', h.hero_note);
  }
  function renderAbout() {
    const el = $('[data-render="about"]');
    el.innerHTML = C.about.content_html.replace(/<h3>.*?<\/h3>/s, '').replace(/<h2>.*?<\/h2>/s, '');
    rewriteLinks(el);
    $('[data-render="about-line"]').textContent = C.about_line;
    $('[data-render="milestones"]').innerHTML = C.milestones.map(m => `<li><span class="year">${esc(m.year)}</span><p>${esc(m.text)}</p></li>`).join('');
  }
  function renderApproach() {
    const rows = $$('.ticker-row');
    const items = C.learn;
    const half = Math.ceil(items.length / 2);
    const mk = list => list.concat(list).map(t => `<span class="tick">${esc(t)}</span>`).join('');
    rows[0].innerHTML = mk(items.slice(0, half));
    rows[1].innerHTML = mk(items.slice(half));
  }

  /* ---------- practical ---------- */
  function renderWays() {
    $('[data-render="ways"]').innerHTML = C.ways.map(w => `<div class="way"><h3>${esc(w.title)}</h3><p class="way-lead">${esc(w.lead)}</p><p>${esc(w.text)}</p></div>`).join('');
    $('[data-render="insurance"]').innerHTML = C.practice.insurance.map(i => `<li>${esc(i)}</li>`).join('');
    $('[data-render="closing-title"]').textContent = C.closing.title;
    $('[data-render="closing-text"]').textContent = C.closing.text;
    const F = C.consultation_form, fld = n => F.fields.find(f => f.name === n);
    const legend = f => `${esc(f.label)}${f.hint ? ` <span class="hint">(${esc(f.hint)})</span>` : ''}`;
    const pills = (f, name) => f.options.map(o => `<label class="pill"><input type="checkbox" name="${name}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('');
    $('[data-render="insurance-pills"]').innerHTML = pills(fld('insurance'), 'insurance');
    $('[data-render="modality"]').innerHTML = pills(fld('modality'), 'modality');
    $('[data-render="mode"]').innerHTML = pills(fld('mode'), 'mode');
    ['modality', 'mode', 'insurance'].forEach(n => { $(`[data-legend="${n}"]`).innerHTML = legend(fld(n)); });
    $('[data-hint="message"]').textContent = fld('message').hint || '';
    $('#f-message').placeholder = fld('message').placeholder || '';
    $('[data-render="submit"]').textContent = F.submit;
    $('[data-render="consent"]').textContent = F.consent;
    $('[data-render="success-text"]').textContent = F.success.text;
    $('[data-render="again"]').textContent = F.success.again;
    Object.entries(F.errors).forEach(([k, v]) => { const el = $(`[data-error="${k}"]`); if (el) el.textContent = v; });
  }

  /* ---------- resources: home shows four, the resources page shows all ---------- */
  const QUIZ_CAT = 'Self-checks';
  const quizAsCard = q => ({ id: q.id, kind: 'quiz', title: q.title, category: QUIZ_CAT, excerpt: q.intro || '', content_html: '', art: q.art || 'compass', image: q.image, read_minutes: 0, meta: `${(q.items || []).length} questions`, status: q.status });
  const resourceList = () => live(C.articles).map(a => ({ ...a, kind: 'article' })).concat(live(C.quizzes).map(quizAsCard));
  function articleCard(a, i, featured) {
    const href = `#${a.kind === 'quiz' ? 'quiz' : 'article'}/${a.id}`;
    return `<article class="card article${featured ? ' is-featured' : ''}" data-id="${a.id}" data-cat="${esc(a.category)}">
        <div class="card-deco" aria-hidden="true"></div>
        <a class="cover" href="${href}" aria-hidden="true" tabindex="-1">${artImg(a)}<span class="cover-num">${pad(i + 1)}</span></a>
        <div class="card-body">
          <p class="card-kicker">${esc(a.category)} · ${a.meta || (a.read_minutes + ' min read')}</p>
          <h3 class="card-title"><a href="${href}">${esc(a.title)}</a></h3>
          <p class="card-text">${esc(featured ? a.excerpt : (a.excerpt.length > 150 ? a.excerpt.slice(0, 147).replace(/\s\S*$/, '') + '…' : a.excerpt))}</p>
          <a class="card-link" href="${href}">${a.kind === 'quiz' ? 'Take the self-check' : 'Read the essay'}</a>
        </div>
      </article>`;
  }
  function makeResources(cfg) {
    const state = { q: '', cat: 'All' };
    const items = resourceList();
    const cats = ['All', ...new Set(items.map(a => a.category))];
    const pills = $(cfg.pills), input = $(cfg.input), feat = $(cfg.featured), grid = $(cfg.grid), empty = $(cfg.empty), more = cfg.more ? $(cfg.more) : null;
    pills.innerHTML = cats.map(c => `<button type="button" class="res-pill" aria-pressed="${c === 'All'}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
    function draw() {
      const q = state.q;
      const hit = a => (state.cat === 'All' || a.category === state.cat) && (!q || (a.title + ' ' + a.excerpt + ' ' + a.content_html.replace(/<[^>]+>/g, ' ')).toLowerCase().includes(q));
      const list = items.map((a, i) => ({ a, i })).filter(x => hit(x.a));
      const filtering = q || state.cat !== 'All';
      const showFeatured = !filtering && list.length;
      const limit = cfg.limit || Infinity;
      feat.innerHTML = showFeatured ? articleCard(list[0].a, list[0].i, true) : '';
      const rest = showFeatured ? list.slice(1, limit) : list.slice(0, limit);
      grid.innerHTML = rest.map(x => articleCard(x.a, x.i, false)).join('');
      if (typeof applyImages === 'function') applyImages();
      empty.hidden = list.length > 0;
      if (more) {
        const link = $('a', more);
        link.textContent = filtering ? `See all ${list.length} result${list.length === 1 ? '' : 's'}` : `All ${items.length} resources`;
        link.setAttribute('href', '#resources' + (filtering ? '?' + new URLSearchParams({ q: state.q, cat: state.cat }) : ''));
        more.hidden = filtering && list.length <= limit;
      }
    }
    pills.addEventListener('click', e => { const b = e.target.closest('.res-pill'); if (!b) return; state.cat = b.dataset.cat; $$('.res-pill', pills).forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); });
    input.addEventListener('input', e => { state.q = e.target.value.trim().toLowerCase(); draw(); });
    draw();
    return { set(q, cat) { state.q = (q || '').toLowerCase(); input.value = q || ''; state.cat = cats.includes(cat) ? cat : 'All'; $$('.res-pill', pills).forEach(x => x.setAttribute('aria-pressed', x.dataset.cat === state.cat)); draw(); } };
  }
  let resHome, resAll;
  function renderResources() {
    resHome = makeResources({ pills: '[data-render="res-pills"]', input: '#res-search', featured: '[data-render="featured"]', grid: '[data-render="articles"]', empty: '#articles .res-empty', more: '#articles .res-more', limit: 5 });
    resAll = makeResources({ pills: '[data-render="res-pills-all"]', input: '#res-search-all', featured: '[data-render="featured-all"]', grid: '[data-render="articles-all"]', empty: '#resources .res-empty' });
  }

  /* ---------- faq: pills + one list ---------- */
  function renderFaq() {
    const groups = C.faq_groups || [...new Set(live(C.faq).map(f => f.group))];
    $('[data-render="faq-pills"]').innerHTML = ['All', ...groups].map(g => `<button type="button" class="res-pill" aria-pressed="${g === 'All'}" data-group="${esc(g)}">${esc(g)}</button>`).join('');
    $('[data-render="faq"]').innerHTML = live(C.faq).map((f, i) => `
      <details class="faq-item" data-group="${esc(f.group)}"${i === 0 ? ' open' : ''}>
        <summary>${esc(f.q)}</summary>
        <div class="faq-answer"><p>${esc(f.a)}</p></div>
      </details>`).join('');
    $('[data-render="faq-pills"]').addEventListener('click', e => { const b = e.target.closest('.res-pill'); if (!b) return; $$('[data-render="faq-pills"] .res-pill').forEach(x => x.setAttribute('aria-pressed', x === b)); const g = b.dataset.group; $$('.faq-item').forEach(d => { d.hidden = g !== 'All' && d.dataset.group !== g; }); });
  }

  /* ---------- page view (articles and services) ---------- */
  const page = $('#page'), resPage = $('#resources');
  const sections = () => $$('main > section:not(#page):not(#resources)');
  /* ---------- quizzes (self-checks built in the dashboard) ---------- */
  function quizHtml(q) {
    const sc = q.scale || { labels: ['Rarely', 'Sometimes', 'Often', 'Almost always'], values: [1, 2, 3, 4] };
    const items = (q.items || []).map((it, i) => `<fieldset data-max="${Math.max(...sc.values)}" data-min="${Math.min(...sc.values)}"><legend>${i + 1}. ${esc(it.text)}</legend><div class="scale">${sc.labels.map((l, k) => `<label><input type="radio" name="q${i}" value="${sc.values[k]}">${esc(l)}</label>`).join('')}</div></fieldset>`).join('');
    return `${q.intro ? `<p class="lead">${esc(q.intro)}</p>` : ''}${q.instructions ? `<p>${esc(q.instructions)}</p>` : ''}
      <form class="quiz" data-quiz="${esc(q.id)}" novalidate>${items}
        <div class="quiz-actions"><button class="button primary" type="submit">${esc(q.button || 'See my result')}</button><p class="quiz-result" hidden tabindex="-1" aria-live="polite"></p></div>
      </form>${q.outro ? `<p class="small">${esc(q.outro)}</p>` : ''}`;
  }
  function bindQuiz(form, q) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const groups = $$('fieldset', form); let total = 0, answered = 0, max = 0, min = 0;
      groups.forEach(g => { max += +g.dataset.max; min += +g.dataset.min; const c = $('input:checked', g); if (c) { total += +c.value; answered++; } });
      const out = $('.quiz-result', form);
      if (answered < groups.length) { out.innerHTML = esc(`Answer all ${groups.length} statements first.`); out.hidden = false; return; }
      const pct = max > min ? (total - min) / (max - min) * 100 : 0;
      const bands = (q.results || []).slice().sort((a, b) => (b.min_pct || 0) - (a.min_pct || 0));
      const band = bands.find(b => pct >= (b.min_pct || 0)) || bands[bands.length - 1];
      out.innerHTML = `<strong>Score ${total} of ${max}${band && band.title ? ' · ' + esc(band.title) : ''}.</strong> ${band ? esc(band.text || '') : ''}${band && band.cta_label ? ` <a class="text-link" href="${esc(band.cta_href || '#contact')}">${esc(band.cta_label)}</a>` : ''}`;
      out.hidden = false; out.focus();
      if (window.SITE_CONFIG && window.SITE_CONFIG.hitEndpoint && !window.LIVE_PREVIEW) { try { fetch(window.SITE_CONFIG.hitEndpoint, { method: 'POST', body: JSON.stringify({ path: location.pathname, route: '#quiz-done/' + q.id, concept: 'civic', referrer: '' }), keepalive: true, mode: 'cors' }).catch(() => {}); } catch (err) {} }
    });
  }

  function openPage(kind, id, fromHash) {
    const list = kind === 'service' ? live(C.services) : kind === 'page' ? live(C.pages) : kind === 'quiz' ? live(C.quizzes) : live(C.articles);
    let item = list.find(x => x.id === id);
    if (!item) return closePage();
    const isQuiz = kind === 'quiz';
    if (isQuiz) item = { ...quizAsCard(item), content_html: quizHtml(item), quiz: item };
    const isArticle = kind === 'article' || isQuiz, isPage = kind === 'page';
    $('.page-back', page).setAttribute('href', isArticle ? '#resources' : isPage ? '#home' : '#services');
    $('.page-back', page).textContent = isArticle ? '← All resources' : isPage ? '← Home' : '← All counseling';
    $('.page-kicker', page).textContent = isArticle ? item.category : isPage ? item.kicker : 'Counseling';
    $('.page-title', page).textContent = item.name || item.title;
    $('.page-meta', page).textContent = isQuiz ? `${item.meta} · about ${Math.max(2, Math.round(item.quiz.items.length / 2))} minutes · nothing is stored` : isArticle ? `${item.read_minutes} min read · David Steinberg, PhD, LCSW` : isPage ? item.meta : 'In person in Mt. Airy, Philadelphia, or by secure video';
    page.dataset.kind = kind;
    $('.page-art', page).innerHTML = artImg(item);
    const body = $('.page-body', page);
    body.innerHTML = item.content_html;
    $$('h1, h2', body).forEach(h => { const n = document.createElement('h3'); n.innerHTML = h.innerHTML; h.replaceWith(n); });
    rewriteLinks(body);
    const pool = resourceList();
    const rel = (isArticle ? pool.filter(a => a.id !== id && a.category === item.category).concat(pool.filter(a => a.id !== id && a.category !== item.category)) : isPage ? live(C.pages).filter(p => p.id !== id) : live(C.services).filter(s => s.id !== id)).slice(0, 3);
    $('.page-related-list', page).innerHTML = rel.map(r => `<a class="related" href="#${r.kind || kind}/${r.id}">${artImg(r)}<span><b>${esc(r.title || r.name)}</b><em>${esc(isArticle ? r.category : isPage ? r.kicker : 'Counseling')}</em></span></a>`).join('');
    $('.page-foot', page).hidden = isPage && id === 'privacy';
    $('.page-foot p', page).textContent = isQuiz ? 'Want to talk through your result?' : isPage ? (id === 'course' ? 'Not sure the course is the right fit?' : 'Questions about fees or your plan?') : 'Does this sound like your situation?';
    const qf = $('form[data-quiz]', body);
    if (qf) bindQuiz(qf, item.quiz);
    const quiz = $('#quiz-form', body);
    if (quiz && !quiz.dataset.quiz) quiz.addEventListener('submit', e => {
      e.preventDefault();
      const groups = $$('fieldset', quiz); let total = 0, answered = 0;
      groups.forEach(g => { const c = $('input:checked', g); if (c) { total += +c.value; answered++; } });
      const out = $('.quiz-result', quiz);
      if (answered < groups.length) { out.textContent = `Answer all ${groups.length} statements first.`; out.hidden = false; return; }
      const max = groups.length * 4, pct = total / max * 100;
      out.textContent = `Score ${total} of ${max}. ` + (pct >= 75 ? 'You are mostly moving toward your partner. The course can help you keep that direction under stress.' : pct >= 50 ? 'You move toward your partner at times and away at other times. This is the most common pattern, and the most workable one.' : 'Right now you are mostly moving away from your partner. That is information, not a verdict. A consultation is a good next step.');
      out.hidden = false; out.focus();
    });
    sections().forEach(s => s.hidden = true); resPage.hidden = true;
    page.hidden = false;
    applyImages();
    document.body.classList.add('page-open');
    window.scrollTo({ top: 0 });
  }
  function openResources(qs) {
    const p = new URLSearchParams(qs || '');
    resAll.set(p.get('q') || '', p.get('cat') || 'All');
    sections().forEach(s => s.hidden = true); page.hidden = true;
    resPage.hidden = false; document.body.classList.add('page-open');
    window.scrollTo({ top: 0 });
  }
  function closePage() {
    if (page.hidden && resPage.hidden) return;
    page.hidden = true; resPage.hidden = true; sections().forEach(s => s.hidden = false); document.body.classList.remove('page-open');
  }
  function route() {
    const m = location.hash.match(/^#(article|service|page|quiz)\/([\w-]+)/);
    if (m) { openPage(m[1], m[2], true); return; }
    const r = location.hash.match(/^#resources(\?.*)?$/);
    if (r) { openResources(r[1] ? r[1].slice(1) : ''); return; }
    const wasOpen = !page.hidden || !resPage.hidden;
    closePage();
    let target = null; try { target = location.hash && location.hash.length > 1 ? $(location.hash) : null; } catch (e) {}
    if (target && wasOpen) target.scrollIntoView({ block: 'start' });
    // old read/ links
    const old = location.hash.match(/^#read\/(service|article)\/([\w-]+)/); if (old) location.hash = '#' + old[1] + '/' + old[2];
  }
  addEventListener('hashchange', route);

  /* ---------- mobile nav ---------- */
  const toggle = $('.menu-toggle'), mnav = $('#mobile-nav');
  toggle.addEventListener('click', () => { const open = toggle.getAttribute('aria-expanded') !== 'true'; toggle.setAttribute('aria-expanded', open); document.body.classList.toggle('nav-open', open); });
  mnav.addEventListener('click', e => { if (e.target.tagName === 'A') { toggle.setAttribute('aria-expanded', 'false'); document.body.classList.remove('nav-open'); } });

  /* ---------- form: validates, then posts to SITE_CONFIG.formEndpoint via js/request.js ---------- */
  const form = $('.consult-form[data-render="form"]'), success = $('.form-success');
  const setInvalid = (el, bad) => { const wrap = el.closest('.field'); if (wrap) wrap.classList.toggle('invalid', bad); el.setAttribute('aria-invalid', bad ? 'true' : 'false'); };
  form.addEventListener('submit', e => {
    e.preventDefault();
    let ok = true, first = null;
    ['name', 'email', 'phone'].forEach(n => {
      const el = form.elements[n], v = el.value.trim();
      const bad = n === 'email' ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) : !v;
      setInvalid(el, bad); if (bad) { ok = false; first = first || el; }
    });
    $$('[data-required-group]', form).forEach(g => { const any = $('input:checked', g); g.classList.toggle('invalid', !any); if (!any) { ok = false; first = first || $('input', g); } });
    const status = $('.form-status', form);
    if (!ok) { status.textContent = 'Please complete the highlighted fields.'; first.focus(); return; }
    status.textContent = ''; status.classList.remove('is-error');
    const btn = $('[data-render="submit"]', form), label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sending…';
    window.sendConsultRequest(form).then(() => {
      $('[data-render="success-title"]', success).textContent = C.consultation_form.success.title.replace('{name}', form.elements.name.value.trim().split(/\s+/)[0]);
      form.hidden = true; success.hidden = false; success.focus();
    }).catch(err => {
      status.classList.add('is-error');
      status.textContent = (err && err.code === 'fields') ? 'Please check the highlighted fields.'
        : (err && err.code === 'rate') ? 'Too many requests from this connection. Please call 215-253-4473.'
        : 'Your request could not be sent. Please try again, or call 215-253-4473.';
    }).finally(() => { btn.disabled = false; btn.textContent = label; });
  });
  form.addEventListener('input', e => { const el = e.target; if (el.hasAttribute('required')) setInvalid(el, false); const g = el.closest('[data-required-group]'); if (g) g.classList.remove('invalid'); });
  $('[data-render="again"]', success).addEventListener('click', () => { form.reset(); success.hidden = true; form.hidden = false; form.elements.name.focus(); });

  const header = $('.site-header');
  const onScroll = () => header.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  $('[data-year]').textContent = new Date().getFullYear();

  /* menu and footer links to pages follow the page's status: a draft page has no link */
  function syncPageLinks() { $$('a[href^="#page/"]').forEach(a => { const id = a.getAttribute('href').slice(6).split(/[?/]/)[0]; const pg = (C.pages || []).find(x => x.id === id); a.hidden = !pg || pg.status === 'draft'; }); }
  function start() {
    buildLinkMap(); syncPageLinks(); renderHero(); renderServices(); renderExplorer(); renderAudience(); renderSteps(); renderStories(); renderAbout(); renderApproach(); renderWays(); renderResources(); renderFaq();
    applyImages();
    route();
    if (window.LIVE_PREVIEW) { const b = document.createElement('div'); b.className = 'preview-badge'; b.textContent = 'Preview of the unpublished draft'; document.body.appendChild(b); }
  }
  /* content published from the dashboard (js/live.js) takes over from the baked copy when it arrives */
  if (window.LIVE_CONTENT && typeof window.LIVE_CONTENT.then === 'function') window.LIVE_CONTENT.then(c => { if (c && typeof c === 'object' && c.articles) C = window.CONTENT = c; }).catch(() => {}).then(start);
  else start();
})();
