# davidsteinberg.com — prototype with three front-end concepts

Open `index.html` in a browser. The toolbar at the bottom right switches between the three concepts
and between light and dark mode. Since 2026-10-27 the Civic template is the only live one; `index.html?mode=dark` previews dark mode. The Nouveau and Sage concepts are archived in `archive/` and can be restored (see `archive/README.md`).

## Files

| File | What it is |
|---|---|
| `index.html` | One page, one DOM for all three concepts. Each section has an id: `#home #services #audience #stories #approach #about #practical #articles #faq #contact #closing #portal`. |
| `css/base.css` | Structure shared by all concepts: grid, header, cards, form, dialog. Themes only change looks. |
| `css/fonts.css` + `assets/fonts/` | Self-hosted fonts (no Google request at load time). |
| `themes/civic.css` + `assets/civic/` + `assets/photos/` | Concept 1: modeled on trumpaccounts.gov. Instrument Serif + Geist, cream/tan bands, pill buttons, halftone line drawings (made by `tools/make_civic_svg.py`), stock photos in the carousel (see `assets/photos/CREDITS.md`). |
| `archive/themes/nouveau.css` + `archive/assets/nouveau/` (archived) | Concept 2: painted vine frame, stained glass arches, dithered portrait. Cormorant Garamond + Alegreya. |
| `js/content.js` | All text, built from `../content/content.json` by `tools/build.py`. Do not edit by hand. |
| `js/app.js` | Renders services, articles, FAQ, form options from the content; theme switcher; reader dialog; mobile nav. |

## Working on one section

Every section is one `<section id="...">` in `index.html`. Each theme file is organized in the same order
(header, buttons, hero, cards, approach, about, practical, faq, contact, portal, footer, reader),
so to change the hero in the Nouveau concept, edit the `hero` block in `themes/nouveau.css` only.

Rules that keep the three concepts in sync:
- Content changes go in `content/content.json`, then run `python3 tools/build.py`.
- Structure changes (a new section, a new field) go in `index.html` and `css/base.css`.
- Looks go in the theme file. Each theme rule is prefixed with `[data-theme="name"]`, so themes cannot leak into each other.

## Not done yet
- The consultation form has no backend. It needs a small function (Cloud Run or Cloudflare Worker) that emails David.
- The client portal link is a placeholder. The portal is a separate app (see the architecture notes).
- The course section does not exist yet; David has not written it.
- Text marked `draft` in `content.json` is new and needs David's approval (hero line, FAQ answers).

## Fourth option: Sage
`archive/sage/` (archived) is a separate one-page site (hash-routed, Manrope, sage accent) supplied on 2026-10-23. It has its own `styles.css` and `script.js`
and does not use `content.json`. The toolbar on either side links across. Its map is a Google Maps iframe, which the artifact viewer blocks;
it works when the folder is opened from disk or hosted.
