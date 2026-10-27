/* Hash routing, menu, form, quiz, copy buttons. No libraries. */
(function () {
  "use strict";

  var pages = Array.prototype.slice.call(document.querySelectorAll(".page"));
  var pageIds = pages.map(function (p) { return p.id; });
  var mobileNav = document.getElementById("mobile-nav");
  var menuBtn = document.getElementById("menu-btn");
  var toast = document.getElementById("toast");
  var baseTitle = "David Steinberg, PhD, LCSW";

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast.t);
    showToast.t = setTimeout(function () { toast.classList.remove("show"); }, 2200);
  }

  var inPageAnchors = ["how"];
  function currentToken() {
    var h = (location.hash || "").replace(/^#/, "");
    if (inPageAnchors.indexOf(h) !== -1) return "home";
    if (!h || pageIds.indexOf(h) === -1) return "home";
    return h;
  }

  function route() {
    var id = currentToken();
    pages.forEach(function (p) {
      var on = p.id === id;
      p.classList.toggle("active", on);
      p.hidden = !on;
    });
    // nav state
    var links = document.querySelectorAll("[data-nav]");
    Array.prototype.forEach.call(links, function (a) {
      var target = a.getAttribute("href").replace(/^#/, "");
      var page = document.getElementById(id);
      var parent = page ? page.getAttribute("data-parent") : null;
      if (target === id || (parent && target === parent)) {
        a.setAttribute("aria-current", "page");
      } else {
        a.removeAttribute("aria-current");
      }
    });
    var page = document.getElementById(id);
    var t = page ? page.getAttribute("data-title") : "";
    document.title = t ? t + " | " + baseTitle : baseTitle;
    if (mobileNav) mobileNav.hidden = true;
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
    document.body.classList.toggle("on-home", id === "home");
    var raw = (location.hash || "").replace(/^#/, "");
    var anchor = inPageAnchors.indexOf(raw) !== -1 ? document.getElementById(raw) : null;
    if (anchor) {
      var top = anchor.getBoundingClientRect().top + window.pageYOffset - 70;
      window.scrollTo(0, top);
    } else {
      window.scrollTo(0, 0);
    }
    try { localStorage.setItem("ds-last-page", id); } catch (e) { /* ignore */ }
  }

  window.addEventListener("hashchange", route);
  route();

  if (menuBtn && mobileNav) {
    menuBtn.addEventListener("click", function () {
      var open = mobileNav.hidden;
      mobileNav.hidden = !open;
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* Light / dark toggle */
  var themeBtn = document.getElementById("theme-btn");
  var root = document.documentElement;
  function currentTheme() {
    var t = root.getAttribute("data-theme");
    if (t === "dark" || t === "light") return t;
    return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }
  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    try { localStorage.setItem("ds-mode", t); } catch (e) { /* ignore */ }
  }
  try {
    var saved = localStorage.getItem("ds-mode");
    if (saved === "dark" || saved === "light") root.setAttribute("data-theme", saved);
  } catch (e) { /* ignore */ }
  [themeBtn, document.getElementById("theme-btn-m")].forEach(function (btn) {
    if (!btn) return;
    btn.addEventListener("click", function () {
      applyTheme(currentTheme() === "dark" ? "light" : "dark");
    });
  });

  /* Copy buttons */
  Array.prototype.forEach.call(document.querySelectorAll("[data-copy]"), function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy");
      function fallback() {
        var span = document.getElementById(btn.getAttribute("data-copy-target"));
        if (span) {
          var r = document.createRange();
          r.selectNodeContents(span);
          var s = window.getSelection();
          s.removeAllRanges();
          s.addRange(r);
        }
        showToast("Select the text and copy it.");
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          showToast("Copied " + text);
        }, fallback);
      } else {
        fallback();
      }
    });
  });

  /* Consultation form */
  var form = document.getElementById("consult-form");
  if (form) {
    var success = document.getElementById("form-success");
    function setInvalid(field, bad) {
      var wrap = field.closest(".field");
      if (wrap) wrap.classList.toggle("invalid", bad);
      field.setAttribute("aria-invalid", bad ? "true" : "false");
    }
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var ok = true;
      var required = form.querySelectorAll("[required]");
      var first = null;
      Array.prototype.forEach.call(required, function (f) {
        var bad;
        if (f.type === "checkbox") bad = !f.checked;
        else if (f.type === "email") bad = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value.trim());
        else bad = f.value.trim() === "";
        setInvalid(f, bad);
        if (bad) { ok = false; if (!first) first = f; }
      });
      var groups = form.querySelectorAll("[data-required-group]");
      Array.prototype.forEach.call(groups, function (g) {
        var any = g.querySelector("input:checked");
        g.classList.toggle("invalid", !any);
        if (!any) { ok = false; if (!first) first = g.querySelector("input"); }
      });
      if (!ok) {
        if (first) first.focus();
        showToast("Please complete the highlighted fields.");
        return;
      }
      var name = form.querySelector("#f-name").value.trim();
      var btn = form.querySelector('button[type="submit"]'); var label = btn.textContent;
      btn.disabled = true; btn.textContent = "Sending…";
      window.sendConsultRequest(form).then(function () {
        form.hidden = true;
        if (success) {
          var who = document.getElementById("success-name");
          if (who) who.textContent = name;
          success.hidden = false;
          success.focus();
        }
        window.scrollTo(0, 0);
      }).catch(function (err) {
        showToast(err && err.code === "rate" ? "Too many requests from this connection. Please call 215-253-4473." : "Your request could not be sent. Please try again, or call 215-253-4473.");
      }).finally(function () { btn.disabled = false; btn.textContent = label; });
    });
    form.addEventListener("input", function (ev) {
      var f = ev.target;
      if (f && f.hasAttribute("required")) setInvalid(f, false);
      var g = f && f.closest("[data-required-group]");
      if (g) g.classList.remove("invalid");
    });
    var again = document.getElementById("form-again");
    if (again) {
      again.addEventListener("click", function () {
        form.reset();
        form.hidden = false;
        if (success) success.hidden = true;
      });
    }
  }

  /* Relationship check-in quiz */
  var quiz = document.getElementById("quiz-form");
  if (quiz) {
    var result = document.getElementById("quiz-result");
    quiz.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var groups = quiz.querySelectorAll("fieldset");
      var total = 0, answered = 0;
      Array.prototype.forEach.call(groups, function (g) {
        var checked = g.querySelector("input:checked");
        if (checked) { total += parseInt(checked.value, 10); answered += 1; }
      });
      if (answered < groups.length) {
        showToast("Answer all " + groups.length + " statements first.");
        return;
      }
      var max = groups.length * 4;
      var pct = Math.round((total / max) * 100);
      var text;
      if (pct >= 75) {
        text = "Score " + total + " of " + max + ". You are mostly moving toward your partner. The course can help you keep that direction under stress.";
      } else if (pct >= 50) {
        text = "Score " + total + " of " + max + ". You move toward your partner at times and away at other times. This is the most common pattern, and the most workable one.";
      } else {
        text = "Score " + total + " of " + max + ". Right now you are mostly moving away from your partner. That is information, not a verdict. A consultation is a good next step.";
      }
      result.textContent = text;
      result.hidden = false;
      result.focus();
    });
  }

  /* Prototype toolbar: light/dark + minimize */
  var devbar = document.querySelector(".dev-toolbar");
  if (devbar) {
    var setDevbar = function (open) { devbar.classList.toggle("collapsed", !open); try { localStorage.setItem("ds-devbar", open ? "open" : "min"); } catch (e) { /* ignore */ } };
    try { setDevbar(localStorage.getItem("ds-devbar") === "open"); } catch (e) { setDevbar(false); }
    devbar.querySelector("[data-dev-min]").addEventListener("click", function () { setDevbar(false); });
    devbar.querySelector("[data-dev-open]").addEventListener("click", function () { setDevbar(true); });
    devbar.querySelector("[data-toggle-mode]").addEventListener("click", function () { applyTheme(currentTheme() === "dark" ? "light" : "dark"); });
  }

  /* Resources: search + subject pills, first match featured */
  var resInput = document.getElementById("sage-res-search");
  if (resInput) {
    var list = document.querySelector("#articles .article-list");
    var items = Array.prototype.slice.call(list.querySelectorAll(".article-item"));
    var pills = Array.prototype.slice.call(document.querySelectorAll("#articles .res-pill"));
    var empty = document.querySelector("#articles .res-empty");
    var cat = "All";
    function draw() {
      var q = resInput.value.trim().toLowerCase(); var n = 0; var first = true;
      items.forEach(function (it) {
        var tag = (it.querySelector(".tag") || {}).textContent || "";
        var ok = (cat === "All" || tag === cat) && (!q || it.textContent.toLowerCase().indexOf(q) !== -1);
        it.hidden = !ok;
        it.classList.toggle("is-featured", ok && first && !q && cat === "All");
        if (ok) { n += 1; first = false; }
      });
      if (empty) empty.hidden = n > 0;
    }
    resInput.addEventListener("input", draw);
    pills.forEach(function (b) { b.addEventListener("click", function () { cat = b.getAttribute("data-cat"); pills.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); draw(); }); });
    draw();
  }
})();
