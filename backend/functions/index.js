'use strict';
/* HTTPS endpoint: POST /consultationRequest with the form as JSON.
   Stores the request in Firestore (collection "requests") and emails the practice through Gmail.
   Configuration:
     functions/.env      GMAIL_USER (the Gmail / Workspace address that sends; 2-step verification on)
                         NOTIFY_TO  (where requests go; comma-separated for several; defaults to GMAIL_USER)
     secret              GMAIL_APP_PASSWORD — an app password for GMAIL_USER (Google Account → Security → App passwords),
                         stored in Secret Manager: `firebase functions:secrets:set GMAIL_APP_PASSWORD` or the Cloud Console */
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const { handle } = require('./lib/handle');

setGlobalOptions({ region: 'us-east4', maxInstances: 3, memory: '256MiB', timeoutSeconds: 30 });
admin.initializeApp();

const GMAIL_USER = defineString('GMAIL_USER');
const NOTIFY_TO = defineString('NOTIFY_TO', { default: '' });
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');

exports.consultationRequest = onRequest({ cors: true, secrets: [GMAIL_APP_PASSWORD] }, async (req, res) => {
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
