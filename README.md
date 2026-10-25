# davidsteinberg.com — prototype site

Static front-end concepts (Civic, Nouveau, Sage) for the practice website. Plain static files — no build step, no server code.

- `public/` — the site (`index.html` + `css/`, `themes/`, `js/`, `assets/`; `sage/` is the third concept). Open `public/index.html` locally to preview.
- `content/content.json` → `tools/build.py` → `public/js/content.js`. Edit the JSON, run the build, commit.
- `tools/` — build, screenshot and artwork scripts (see `public/README.md`).

## Deploy
Cloudflare → Workers & Pages → Create → Import a repository → this repo. Build command: *(none)*, deploy command: `npx wrangler deploy`. Every push to `main` redeploys. The site is then at `https://davidsteinberg.<account>.workers.dev` until a custom domain is attached.
