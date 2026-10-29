# Consultation-request backend (Firebase)

One HTTPS Cloud Function plus Firestore. The site's two consultation forms (Civic/Nouveau in `index.html`, Sage in `sage/`) POST JSON to the function; it checks the fields, drops bots, saves the request in Firestore (`requests` collection), and emails the practice through Gmail. Cost at this volume: $0 (Cloud Functions, Cloud Run, and Firestore free tiers).

```
form (browser) ──POST JSON──▶ consultationRequest (Cloud Function, us-east4)
                                   ├─ honeypot + field checks + rate limit (5/hour per IP, 200/day)
                                   ├─ Firestore: requests/{id}  (kept even if the email fails)
                                   └─ Gmail (Nodemailer, app password) ──▶ NOTIFY_TO inbox
```

## One-time setup (about 20 minutes)

1. **Google Cloud project.** In the [Firebase console](https://console.firebase.google.com) add a project (name it e.g. `davidsteinberg-site`). Upgrade it to the **Blaze** plan (pay as you go — a card is required, the bill stays at $0 at this traffic). Enable **Firestore** (production mode, region `us-east4` or `nam5`).
2. **Gmail app password** for the sending account (for now `michswo@gmail.com`): Google Account → Security → 2-Step Verification must be on → App passwords → create one named "davidsteinberg.com form". Copy the 16-character password.
3. **Tools, once:** `npm install -g firebase-tools`, then `firebase login`.
4. In this folder:
   ```sh
   cd backend
   # point at your project id (replace the id if you named it differently)
   sed -i '' 's/davidsteinberg-site/YOUR_PROJECT_ID/' .firebaserc     # macOS sed; on Linux drop the ''
   cd functions && npm install && npm test && cd ..
   # functions/.env holds GMAIL_USER and NOTIFY_TO (plain text, not secret) — edit if the addresses change
   firebase functions:secrets:set GMAIL_APP_PASSWORD   # the 16-character app password (or create the secret in the Cloud Console → Secret Manager)
   firebase deploy --only functions,firestore
   ```
   The deploy prints the function URL: `https://us-east4-YOUR_PROJECT_ID.cloudfunctions.net/consultationRequest`.
5. **Tell the site.** Put that URL in `js/config.js` (`formEndpoint`), commit, push. Both forms use it. While it is empty the forms run in prototype mode: they show the thank-you panel and send nothing.
6. **Test** by sending a request from the live site. The email arrives from "davidsteinberg.com <michswo@gmail.com>" with Reply-To set to the visitor, and the request appears in the Firebase console under Firestore → `requests`.

## Sending through LuxSci (or any SMTP provider) instead of Gmail

LuxSci is HIPAA mail with a BAA, so the notification can go from a LuxSci mailbox to a LuxSci mailbox and Gmail is out of the
path. In `functions/.env` set `SMTP_HOST` (LuxSci's outgoing server for the account), `SMTP_PORT` (465 for SSL, 587 for
STARTTLS), `SMTP_USER` (the full mailbox address that sends) and `NOTIFY_TO` (where it goes, usually the same mailbox);
put the mailbox password in Secret Manager as `SMTP_PASSWORD`; then `firebase deploy --only functions`. When `SMTP_HOST` is
empty the function falls back to Gmail (`GMAIL_USER` + `GMAIL_APP_PASSWORD`).

To change only the recipient: edit `NOTIFY_TO` and redeploy the functions.

## What the function does with a submission

- `website` (hidden honeypot field) filled → answers `{ok:true}` and discards it.
- Required: `name`, valid `email`, `phone` with at least seven digits, at least one `mode`. Otherwise `400 {error:"fields", fields:[…]}` and the site highlights the fields.
- List fields (`modality`, `mode`, `insurance`) keep only the values the form offers; strings are trimmed and capped (message 2000 characters).
- Rate limit: 5 per hour per IP address, 200 per day in total → `429`, the site asks the visitor to call.
- Saves the document, then emails. A mail failure is recorded on the document (`emailed:false`, `emailError`) and the visitor still gets the thank-you; nothing is lost.

## Files

- `functions/lib/handle.js` — the logic, no Google SDK, unit-tested (`npm test`, seven tests).
- `functions/index.js` — the HTTPS wrapper: secrets, Firestore, Nodemailer.
- `firestore.rules` — no client access at all; only the function (Admin SDK) reads or writes. The staff dashboard, when it comes, gets its own rule.
- Site side: `js/config.js` (endpoint), `js/request.js` (shared `sendConsultRequest(form)`), the submit handlers in `js/app.js` and `sage/script.js` (via `tools/sage_align.py`).

## Local run (optional)

`cd backend && firebase emulators:start --only functions,firestore` with a `functions/.secret.local` file holding `GMAIL_APP_PASSWORD`, then set `formEndpoint` to `http://127.0.0.1:5001/YOUR_PROJECT_ID/us-east4/consultationRequest`.

## Next step: the staff view and the client portal

The same project carries the portal: Firebase Auth (Google sign-in for David), a `/staff` page listing `requests` with "called / scheduled / closed", then client accounts, appointments, questionnaires, and messages. Before any client-facing clinical data goes in, accept the Google Cloud BAA in the console (IAM & Admin → Settings → "Review and accept" the HIPAA BAA) and keep client data in the covered services (Firestore, Cloud Functions, Cloud Storage, Auth).
