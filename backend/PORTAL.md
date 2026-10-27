# Client portal and practice dashboard

Two small web apps in the site repo, on the same Firebase project as the contact form:

- `portal/` — for clients. Google sign-in, a pseudonym instead of a name, questionnaires, next appointment, "working on".
- `admin/` — for staff. Consultation requests, client accounts, couples, questionnaires, site traffic, audit log.

Both run against Firebase when `app/firebase-config.js` is filled in, and in **demo mode** (`?demo=1`, sample data,
nothing saved) otherwise — that is what the design artifact shows.

## How identity works

1. A client signs in with Google. Firebase Auth holds the Google identity (email, name). Nothing else does.
2. The `bootstrap` function runs on every sign-in. The first time, it draws a pseudonym — a mild adjective and an
   animal, "Quiet Heron" — reserves it in `aliases/`, and creates `clients/{uid}` with the pseudonym, status `new`,
   no couple, no questionnaires. The client sees the pseudonym on a welcome screen and at the top of every page.
3. Staff are the addresses in `STAFF_EMAILS` (functions/.env). `bootstrap` sets the `staff` custom claim on their
   token; the Firestore rules key off that claim.
4. In the dashboard, clients are listed by pseudonym. The sign-in email appears beside it for staff only, through
   the `listClientAccounts` / `clientIdentity` functions, and every such look-up writes a row in `audit/`.
5. Couples: staff pair two accounts (`couples/{id}`, `clients.coupleId`). Each partner answers questionnaires
   separately; the dashboard shows both answer sets side by side.

Answers (`responses/{uid}_{qid}`) carry the uid and the pseudonym's profile, never the name. Deleting a client's
Auth account leaves the clinical data unlinked from any identity.

## Assessments (dashboard → Assessments)

Build instruments in the dashboard (title, kind, scale, items with reverse-scoring and subscales, result bands
with clinician guidance) or import JSON (`backend/questionnaires/`). Assign from a client's page. Results show the
score, band, subscale bars, item-by-item answers, partners side by side with large disagreements flagged, earlier
attempts as a trend line, a clinician note and a "reviewed" mark. The client portal lets a client answer an
instrument again; the previous attempt is kept in `responses/{uid}_{qid}.history`.

## Site content (dashboard → Site content)

Articles, quizzes, pages, counseling services, questions, home/about copy and practice details are edited in the
dashboard. The whole content object (same shape as `content/content.json`) is saved as a draft (`site/draft`),
previewed on the real site (`/?preview=1`, handed over through browser storage on the same origin) and published
to `site/published`; every publish is kept under `site/versions/list/`. The public site ships with the baked-in
`js/content.js` as the fallback and loads `site/published` with one small public read (`js/live.js`), cached in
the browser. Items with status "Draft" stay off the site. "Export JSON" gives the content back for the repo
(`content/content.json` → `tools/build.py`).

Quizzes are a content type of their own: questions, a scale, result bands with text and a call to action; the
site renders them at `#quiz/<id>` and lists them under Resources as "Self-checks". Nothing a visitor answers is
stored; a completed quiz counts once in the traffic page as the route `#quiz-done/<id>`.

## Data model (Firestore)

| collection | written by | read by |
|---|---|---|
| `requests/{id}` — consultation form | function | staff (status, notes editable) |
| `clients/{uid}` — pseudonym, status, coupleId, assigned[], nextAppointment, focus, note | function creates; staff edit | the client (own), staff |
| `aliases/{slug}` — pseudonym reservations | function | nobody |
| `couples/{id}` — members[] | staff | members, staff |
| `questionnaires/{id}` — definition (see `questionnaires/README.md`) | staff | signed-in |
| `responses/{uid}_{qid}` — answers, status, attempt, history[], staffNote, reviewedAt | the client (own); staff: note + reviewed | the client (own), staff |
| `site/published` — the live site content (one JSON string) | staff | public |
| `site/draft`, `site/versions/list/{v}` — draft and publish history | staff | staff |
| `threads/{uid}/messages/*` — messaging, phase 2 (rules in place) | client / staff | client, staff |
| `traffic/{day}` — page-view counters; `visitors/` sub-collection holds daily hashes | `pageHit` function | staff |
| `audit/{id}` — identity look-ups | functions | staff |

## Traffic counting

`js/hit.js` on the public pages posts one small request per page view and per in-page route change to `pageHit`.
The function increments counters on `traffic/{day}`: views, visitors, pages, routes (which article or service),
concept (Civic / Nouveau / Sage), device class, referrer host (Google, Bing, ChatGPT, Psychology Today …). The
visitor is a salted SHA-256 of address + browser + day; the address itself is never stored. No cookies, no
third-party script, nothing to disclose beyond "the site counts its visits". Browsers sending Do-Not-Track are
skipped.

## Setting it up (after the contact form is already deployed)

1. **Google sign-in**: Firebase console → Authentication → Sign-in method → Google → Enable (support email:
   michswo@gmail.com for now). Then Authentication → Settings → Authorized domains → add
   `mswoboda.github.io` (and later `davidsteinberg.com`).
2. **Web app config**: Project settings → Your apps → Add app → Web (name "site"). Copy `apiKey` and `appId` into
   `app/firebase-config.js`. (These are public identifiers; the rules do the protecting.)
3. **Staff list and salt**: in `backend/functions/.env` set `STAFF_EMAILS=michswo@gmail.com` (add David's later)
   and `TRAFFIC_SALT=` any long random string.
4. **Deploy**: `cd backend && npx firebase-tools deploy --only functions,firestore` — deploys the four functions,
   the rules, and the indexes.
5. **Questionnaires**: open `/admin/`, Questionnaires → Import JSON → `backend/questionnaires/self-check.json`,
   then the fourteen instruments.
6. Try it: open `/portal/` in a private window with a second Google account, sign in, note the pseudonym; in the
   dashboard the account appears under Clients as "Awaiting confirmation" — set it Active, assign a questionnaire,
   and it shows up in the portal.

## Two-factor sign-in

Google accounts bring their own 2-Step Verification, and that is what protects a client's portal sign-in today.
To *require* a second factor inside the portal regardless of the Google account's settings, upgrade the project's
Authentication to **Identity Platform** (one click in the console, free tier covers this practice) and enable
TOTP multi-factor; the portal then gets an enrolment screen. Planned for the phase after questionnaires and
messaging; nothing in the data model changes.

## Before any clinical data goes in

Accept the Google Cloud BAA for the project (Cloud console → IAM & Admin → Settings → "Review and accept" the HIPAA
Business Associate Amendment). Firestore, Cloud Functions, Cloud Run, Secret Manager and Firebase Authentication /
Identity Platform are covered services. The Gmail notification for consultation requests carries contact details
only, not clinical content; the portal never emails answers.

## US-only access (planned)

Agreed trade-off: everything outside the United States is blocked — including a client travelling abroad and
non-US search crawlers. Done at the edge, not in code:

1. Add `davidsteinberg.com` to a free Cloudflare account and point the domain's nameservers at Cloudflare (today
   they are `ns1/ns2.rhostbh.com`, the old WordPress host). This is done at the registrar — a user step.
2. DNS on Cloudflare: `A` records for GitHub Pages (185.199.108–111.153) and `CNAME www → mswoboda.github.io`,
   proxied (orange cloud). In the GitHub repo, Settings → Pages → custom domain `davidsteinberg.com`, enforce HTTPS.
3. Security → WAF → custom rule "US only": expression `ip.geoip.country ne "US"` → Block. Applies to the site,
   the portal and the dashboard, since they are all under the domain.
4. The functions stay on `cloudfunctions.net`, which the WAF does not cover. Two options: route them through a
   Cloudflare Worker on `api.davidsteinberg.com` (the same rule then applies), or add a country check inside the
   functions from Cloudflare's `CF-IPCountry` header once calls go through the Worker. Until then the functions
   are reachable worldwide but do nothing without a signed-in account (portal) or a valid form (contact).

## What is next

- Messaging between client and practice (`threads/`), with an email ping that carries no content.
- Exercises/homework between sessions, assigned like questionnaires.
- Appointments as data rather than a text line, with reminders.
- Payments (Stripe, which signs a BAA, or private pay invoices).
- Identity Platform + TOTP for enforced two-factor sign-in.
