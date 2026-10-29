/* Sends a consultation request to the backend. Shared by the Civic/Nouveau page and by Sage.
   sendConsultRequest(form) -> Promise<{ok:true}> ; rejects with an Error whose .code is
   'fields' | 'rate' | 'network' | 'server'. With no endpoint configured it resolves at once (prototype mode). */
(function () {
  'use strict';
  function collect(form) {
    var fd = new FormData(form), out = {};
    ['name', 'email', 'phone', 'message', 'website'].forEach(function (k) { out[k] = (fd.get(k) || '').toString(); });
    ['modality', 'mode', 'insurance'].forEach(function (k) { out[k] = fd.getAll(k).map(String); });
    out.page = location.href.split('#')[0] + (location.hash || '');
    return out;
  }
  function fail(code, message) { var e = new Error(message || code); e.code = code; return e; }

  /* ---- LuxSci SecureForm: the HIPAA form database the practice already uses ----
     SecureForm accepts a plain form POST to a URL that carries a short-lived token; its script hands the token to
     the page (document.secureform must exist with the form id at the end of its action). The post has to come from
     the visitor's own browser, so it happens here, not in the backend; the backend is then told how it went. */
  var sfScript = null, sfLoadedAt = 0, MIN_AGE = 10000;   // SecureForm rejects a post made within a few seconds of issuing the token (bot check)
  function loadSecureForm(id) {
    if (sfScript) return sfScript;
    sfScript = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = 'https://secureform.luxsci.com/intranet/php/secureform.php?v=1&c=' + encodeURIComponent(id) + '&f=secureform'; s.onload = function () { sfLoadedAt = Date.now(); res(); }; s.onerror = function () { sfScript = null; rej(new Error('SecureForm script failed to load')); }; document.head.appendChild(s); });
    return sfScript;
  }
  function sendToSecureForm(id, p) {
    return loadSecureForm(id).then(function () {
      var wait = MIN_AGE - (Date.now() - sfLoadedAt);
      return wait > 0 ? new Promise(function (res) { setTimeout(res, wait); }) : null;
    }).then(function () {
      var f = document.secureform || document.createElement('form'); f.name = 'secureform'; f.method = 'post'; f.style.display = 'none';
      f.innerHTML = ''; f.action = 'https://secureform.luxsci.com/perl/post/' + id;
      var add = function (n, v) { var i = document.createElement('input'); i.name = n; i.value = v; f.appendChild(i); };
      var extras = [p.modality.length ? 'Looking for: ' + p.modality.join(', ') : '', p.mode.length ? 'How to meet: ' + p.mode.join(', ') : ''].filter(Boolean).join('\n');
      add('Fullname', p.name); add('email', p.email); add('phone', p.phone); add('insurance', p.insurance.join(', '));
      add('question', [p.message, extras, 'Sent from ' + p.page].filter(Boolean).join('\n\n'));
      if (!f.parentNode) document.body.appendChild(f);
      if (typeof window.secureform_submit !== 'function' || !window.secureform_submit()) throw new Error('SecureForm token not available');
      var body = new URLSearchParams(new FormData(f)); body.append('__ajax__submit__', '1');
      var url = f.action; f.action = 'https://secureform.luxsci.com/perl/post/' + id; f.innerHTML = '';
      return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body }).then(function (r) { if (!r.ok) throw new Error('SecureForm ' + r.status); return true; });
    });
  }
  /* fetch the token early, so it is old enough by the time a visitor has filled in the form */
  if (window.SITE_CONFIG && window.SITE_CONFIG.secureFormId) {
    var warm = function () { loadSecureForm(window.SITE_CONFIG.secureFormId).catch(function () {}); };
    if (document.readyState === 'complete') setTimeout(warm, 1500); else window.addEventListener('load', function () { setTimeout(warm, 1500); });
  }

  window.sendConsultRequest = function (form) {
    var cfg = window.SITE_CONFIG || {}, url = cfg.formEndpoint;
    var payload = collect(form);
    if (!url) { console.warn('SITE_CONFIG.formEndpoint is empty: request not sent (prototype mode).'); return Promise.resolve({ ok: true, prototype: true }); }
    var honeypot = !!payload.website;
    var lux = (cfg.secureFormId && !honeypot && payload.name && payload.email)
      ? sendToSecureForm(cfg.secureFormId, payload).then(function () { return { ok: true, error: '' }; }, function (e) { return { ok: false, error: String(e && e.message || e).slice(0, 200) }; })
      : Promise.resolve(null);
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, 15000);
    return lux.then(function (luxResult) { if (luxResult) payload.luxsci = luxResult; return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctrl && ctrl.signal }); })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          if (r.ok && body.ok) return body;
          if (r.status === 400) throw fail('fields', 'Some fields need attention.');
          if (r.status === 429) throw fail('rate', 'Too many requests from this connection. Please call instead.');
          throw fail('server', 'The request could not be sent.');
        });
      })
      .catch(function (e) { if (e && e.code) throw e; throw fail('network', 'The request could not be sent.'); })
      .finally(function () { if (timer) clearTimeout(timer); });
  };
})();
