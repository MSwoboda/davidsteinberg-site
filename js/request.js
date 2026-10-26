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
  window.sendConsultRequest = function (form) {
    var cfg = window.SITE_CONFIG || {}, url = cfg.formEndpoint;
    var payload = collect(form);
    if (!url) { console.warn('SITE_CONFIG.formEndpoint is empty: request not sent (prototype mode).'); return Promise.resolve({ ok: true, prototype: true }); }
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, 15000);
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctrl && ctrl.signal })
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
