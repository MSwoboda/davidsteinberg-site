/* Live site content. The page ships with js/content.js baked in (window.CONTENT); this loads the version
   published from the practice dashboard (Firestore document site/published, public read-only, one small
   request, no SDK) and lets app.js render with it. Cached in localStorage so repeat visits render at once
   and refresh in the background. ?preview=1 renders the dashboard's unsaved draft instead (handed over through
   localStorage on the same origin by the dashboard's Preview button). */
(function () {
  'use strict';
  var cfg = window.SITE_CONFIG || {}, project = cfg.firebaseProject;
  var params = new URLSearchParams(location.search);
  var KEY = 'ds-live-content';
  function parse(doc) {
    try { var f = doc && doc.fields; if (!f || !f.json || !f.json.stringValue) return null; var c = JSON.parse(f.json.stringValue); c.__version = f.version && f.version.stringValue || ''; return c; } catch (e) { return null; }
  }
  function cached() { try { var raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function remember(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} }

  if (params.get('preview') === '1') {
    var draft = null; try { draft = JSON.parse(localStorage.getItem('ds-preview-content') || 'null'); } catch (e) {}
    if (draft) { window.LIVE_CONTENT = Promise.resolve(draft); window.LIVE_PREVIEW = true; return; }
  }
  if (!project) return;
  var url = 'https://firestore.googleapis.com/v1/projects/' + project + '/databases/(default)/documents/site/published';
  var fetchLive = function () {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, 2500);
    return fetch(url, { signal: ctl && ctl.signal, cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(parse).catch(function () { return null; }).then(function (c) { clearTimeout(t); if (c) remember(c); return c; });
  };
  var have = cached();
  if (have && have.__version) {
    // instant render from cache; refresh for next time
    window.LIVE_CONTENT = Promise.resolve(have);
    setTimeout(fetchLive, 1500);
  } else {
    window.LIVE_CONTENT = fetchLive();
  }
})();
