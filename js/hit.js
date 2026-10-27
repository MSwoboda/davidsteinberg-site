/* Page-view counter for the public site: one small POST per page view and per in-page route change, to the
   pageHit function. No cookies, no identifiers; the server keeps a daily hash for counting visitors and
   stores no address. Skipped on localhost, in the design artifact, and when the browser asks not to be tracked. */
(function () {
  'use strict';
  var cfg = window.SITE_CONFIG || {}, url = cfg.hitEndpoint;
  if (!url || /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || navigator.doNotTrack === '1' || /claude\.ai|claudeusercontent/.test(location.hostname) || /[?&]preview=1/.test(location.search)) return;
  var last = '';
  function send() {
    var concept = document.documentElement.getAttribute('data-concept') || (location.pathname.indexOf('/sage/') !== -1 ? 'sage' : '');
    var route = location.hash && location.hash.length > 1 ? location.hash : '';
    var key = location.pathname + route; if (key === last) return; last = key;
    var body = JSON.stringify({ path: location.pathname, route: route, concept: concept, referrer: document.referrer || '' });
    try { fetch(url, { method: 'POST', body: body, keepalive: true, mode: 'cors' }).catch(function () {}); } catch (e) {}
  }
  if (document.readyState === 'complete') send(); else window.addEventListener('load', send);
  window.addEventListener('hashchange', function () { setTimeout(send, 50); });
})();
