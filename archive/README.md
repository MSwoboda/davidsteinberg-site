# Archived concepts

The live site uses the **Civic** template (`/index.html`, `themes/civic.css`). The two other concepts from the
design round are kept here, untouched, in case the practice wants to switch:

- `sage/` — the Sage concept: a self-contained page (`sage/index.html`, `styles.css`, `script.js`). It is
  regenerated from the originals by `tools/sage_align.py`; its `../js/...` script paths assume it sits one level
  below the site root, so move it back to `/sage/` to run it.
- `themes/nouveau.css` + `assets/nouveau/` + `assets/park-walk.jpg` — the Art Nouveau concept, a theme layered on
  the same `index.html`. To bring it back: restore the stylesheet link `<link rel="stylesheet"
  href="themes/nouveau.css" data-concept-css="nouveau" disabled>`, the `.frame` div, the `data-src-nouveau`
  hero image, and the concept-switching code that git history holds in `js/app.js` (commit before
  "Civic only").

Nothing in this folder is served by Firebase Hosting (`firebase.json` ignores `archive/**`).
