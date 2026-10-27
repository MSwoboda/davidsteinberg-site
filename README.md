# davidsteinberg.com — prototype site

Static front-end concepts (Civic, Nouveau, Sage) for the practice website. Plain static files — no build step, no server code.

- Site at the repo root: `index.html` + `css/`, `themes/civic.css`, `js/`, `assets/` — the Civic template is the live one. The Nouveau and Sage concepts are kept in `archive/` (see `archive/README.md`). Open `index.html` locally to preview; structure notes in `SITE.md`.
- `content/content.json` → `tools/build.py` → `js/content.js`. Edit the JSON, run the build, commit.
- `tools/` — build, screenshot and artwork scripts.

## Deploy
GitHub Pages, from `main` / root (repo Settings → Pages). Every push to `main` republishes within a minute or two.
