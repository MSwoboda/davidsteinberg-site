'use strict';
/* HTTPS endpoint: POST /consultationRequest with the form as JSON.
   Stores the request in Firestore (collection "requests") and emails the practice through Gmail.
   Secrets (set once with `firebase functions:secrets:set NAME`):
     GMAIL_USER          the Gmail / Workspace address that sends (needs 2-step verification on)
     GMAIL_APP_PASSWORD  an app password for that account (Google Account → Security → App passwords)
     NOTIFY_TO           where requests go; comma-separated for several; defaults to GMAIL_USER */
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const { handle } = require('./lib/handle');

setGlobalOptions({ region: 'us-east4', maxInstances: 3, memory: '256MiB', timeoutSeconds: 30 });
admin.initializeApp();

const GMAIL_USER = defineSecret('GMAIL_USER');
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');
const NOTIFY_TO = defineSecret('NOTIFY_TO');

exports.consultationRequest = onRequest({ cors: true, secrets: [GMAIL_USER, GMAIL_APP_PASSWORD, NOTIFY_TO] }, async (req, res) => {
  const user = GMAIL_USER.value();
  const transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass: GMAIL_APP_PASSWORD.value() } });
  const to = (NOTIFY_TO.value() || user).split(',').map(s => s.trim()).filter(Boolean);
  const sendMail = msg => transport.sendMail({ from: `"davidsteinberg.com" <${user}>`, to, ...msg });

  const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
  const out = await handle(
    { method: req.method, body: req.body, ip, userAgent: req.headers['user-agent'], origin: req.headers.origin },
    { db: admin.firestore(), sendMail },
  );
  res.status(out.status);
  if (out.body === '') res.end(); else res.json(out.body);
});
