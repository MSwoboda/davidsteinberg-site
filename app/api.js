/* Data layer shared by the portal and the dashboard. Two implementations behind one interface:
   - firebase: Auth (Google), Firestore, callable functions — the real thing
   - demo:     in-memory sample data, used with ?demo=1 and inside the design artifact, no network at all
   Every method returns a Promise. */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const DEMO = params.get('demo') === '1' || !(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey);
  const today = () => new Date().toISOString().slice(0, 10);
  const iso = d => new Date(d).toISOString();
  const daysAgo = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d; };

  /* ------------------------------------------------------------------ demo */
  function demoApi() {
    const Q = {
      'self-check': { id: 'self-check', title: 'Toward or away? A six-item self-check', kind: 'self', instructions: 'Answer for the last two weeks. There are no right answers; this is a snapshot for you and David to look at together.', scale: { type: 'likert', labels: ['Rarely', 'Sometimes', 'Often', 'Almost always'], values: [1, 2, 3, 4] }, items: [{ id: 'q1', text: 'When my partner is upset, I move closer rather than pull back.' }, { id: 'q2', text: 'I can say what I want without turning it into a criticism.' }, { id: 'q3', text: "I can hear my partner's hurt without defending myself." }, { id: 'q4', text: 'After a fight, one of us reaches out to repair within a day.' }, { id: 'q5', text: 'I tell my partner something I appreciate about them.' }, { id: 'q6', text: 'I feel like myself when I am with my partner.' }], scoring: { method: 'sum', bands: [{ max: 11, label: 'Mostly moving away right now' }, { max: 17, label: 'Mixed' }, { max: 24, label: 'Mostly moving toward each other' }] } },
      'love-maps': { id: 'love-maps', title: 'Love Maps', kind: 'couples', instructions: 'Sample items for the demo. The real instrument is imported from its JSON file.', scale: { type: 'yesno' }, items: [{ id: '1', text: 'I can name my partner’s closest friends. (sample item)', type: 'yesno' }, { id: '2', text: 'I know what stresses my partner is currently facing. (sample item)', type: 'yesno' }, { id: '3', text: 'I know my partner’s life dreams. (sample item)', type: 'yesno' }], scoring: { method: 'sum' } },
      'fondness-admiration': { id: 'fondness-admiration', title: 'Fondness and Admiration', kind: 'couples', instructions: 'Sample items for the demo.', scale: { type: 'yesno' }, items: [{ id: '1', text: 'I can easily list three things I admire about my partner. (sample item)', type: 'yesno' }, { id: '2', text: 'My partner really respects me. (sample item)', type: 'yesno' }], scoring: { method: 'sum' } },
    };
    const clients = [
      { uid: 'u-quiet-heron', pseudonym: 'Quiet Heron', status: 'active', coupleId: 'c1', assigned: ['self-check', 'love-maps', 'fondness-admiration'], createdAt: iso(daysAgo(40)), lastSeen: iso(daysAgo(1)), email: 'alex.r@example.com', displayName: 'Alex R.', nextAppointment: 'Thu, Nov 5 · 6:00 PM · Video', focus: 'Listening without defending', lastSignIn: iso(daysAgo(1)) },
      { uid: 'u-amber-finch', pseudonym: 'Amber Finch', status: 'active', coupleId: 'c1', assigned: ['self-check', 'love-maps', 'fondness-admiration'], createdAt: iso(daysAgo(40)), lastSeen: iso(daysAgo(2)), email: 'jordan.r@example.com', displayName: 'Jordan R.', nextAppointment: 'Thu, Nov 5 · 6:00 PM · Video', focus: 'Saying what you need early', lastSignIn: iso(daysAgo(2)) },
      { uid: 'u-cedar-otter', pseudonym: 'Cedar Otter', status: 'active', coupleId: null, assigned: ['self-check'], createdAt: iso(daysAgo(12)), lastSeen: iso(daysAgo(4)), email: 'sam.k@example.com', displayName: 'Sam K.', nextAppointment: 'Tue, Nov 3 · 11:00 AM · In person', focus: '', lastSignIn: iso(daysAgo(4)) },
      { uid: 'u-misty-plover', pseudonym: 'Misty Plover', status: 'new', coupleId: null, assigned: [], createdAt: iso(daysAgo(1)), lastSeen: iso(daysAgo(0)), email: 'taylor.m@example.com', displayName: 'Taylor M.', lastSignIn: iso(daysAgo(0)) },
      { uid: 'u-willow-crane', pseudonym: 'Willow Crane', status: 'inactive', coupleId: null, assigned: ['self-check'], createdAt: iso(daysAgo(200)), lastSeen: iso(daysAgo(90)), email: 'chris.d@example.com', displayName: 'Chris D.', lastSignIn: iso(daysAgo(90)) },
    ];
    const couples = [{ id: 'c1', members: ['u-quiet-heron', 'u-amber-finch'], label: 'Quiet Heron & Amber Finch', createdAt: iso(daysAgo(40)) }];
    const responses = {
      'u-quiet-heron_self-check': { uid: 'u-quiet-heron', qid: 'self-check', answers: { q1: 3, q2: 2, q3: 2, q4: 4, q5: 3, q6: 3 }, status: 'submitted', startedAt: iso(daysAgo(9)), submittedAt: iso(daysAgo(9)) },
      'u-amber-finch_self-check': { uid: 'u-amber-finch', qid: 'self-check', answers: { q1: 2, q2: 3, q3: 3, q4: 4, q5: 2, q6: 4 }, status: 'submitted', startedAt: iso(daysAgo(8)), submittedAt: iso(daysAgo(8)) },
      'u-quiet-heron_love-maps': { uid: 'u-quiet-heron', qid: 'love-maps', answers: { 1: 'yes', 2: 'yes' }, status: 'in-progress', startedAt: iso(daysAgo(2)) },
      'u-cedar-otter_self-check': { uid: 'u-cedar-otter', qid: 'self-check', answers: { q1: 1, q2: 2, q3: 1, q4: 2, q5: 2, q6: 2 }, status: 'submitted', startedAt: iso(daysAgo(5)), submittedAt: iso(daysAgo(5)) },
    };
    const requests = [
      { id: 'r1', name: 'Morgan Lee', email: 'morgan@example.com', phone: '215-555-0142', modality: ['Couples'], mode: ['Video'], insurance: ['Aetna'], message: 'We keep having the same argument about money and I would like help breaking the cycle.', received: iso(daysAgo(0)), status: 'new', page: 'https://davidsteinberg.com/#contact', emailed: true },
      { id: 'r2', name: 'Priya Natarajan', email: 'priya@example.com', phone: '267-555-0188', modality: ['Individual', 'Anxiety'], mode: ['In person · Mt. Airy'], insurance: ['Independence Blue Cross (IBX)'], message: 'Anxiety that has gotten worse since a job change.', received: iso(daysAgo(1)), status: 'called', notes: 'Left voicemail 10/25. Try again Monday.', page: 'https://davidsteinberg.com/#contact', emailed: true },
      { id: 'r3', name: 'Dan and Ellie Park', email: 'dpark@example.com', phone: '215-555-0107', modality: ['Marriage'], mode: ['Video', 'Phone'], insurance: ['Private pay'], message: '', received: iso(daysAgo(3)), status: 'scheduled', notes: 'First session Tue Nov 3, 7 PM.', page: 'https://davidsteinberg.com/sage/#contact', emailed: true },
      { id: 'r4', name: 'Rob Castillo', email: 'rob@example.com', phone: '610-555-0199', modality: ['Supervision'], mode: ['Video'], insurance: [], message: 'LCSW supervision hours, flexible schedule.', received: iso(daysAgo(6)), status: 'closed', notes: 'Referred to group supervision list.', page: 'https://davidsteinberg.com/#contact', emailed: false, emailError: 'Invalid login' },
    ];
    const traffic = [];
    for (let i = 29; i >= 0; i--) {
      const d = daysAgo(i); const day = d.toISOString().slice(0, 10); const wk = d.getUTCDay();
      const base = (wk === 0 || wk === 6) ? 18 : 34; const views = Math.round(base + 14 * Math.sin(i / 3) + (i % 7) * 2);
      traffic.push({ day, views, uniques: Math.round(views * 0.62), paths: { '_davidsteinberg-site_': Math.round(views * 0.7), '_davidsteinberg-site_sage_': Math.round(views * 0.3) }, routes: { '_article_rage-is-the-new-hurt': Math.round(views * 0.12), '_service_couples': Math.round(views * 0.1), '_page_fees': Math.round(views * 0.08), '_article_3-deadly-relationship-killing-mistakes': Math.round(views * 0.06) }, concepts: { civic: Math.round(views * 0.5), nouveau: Math.round(views * 0.2), sage: Math.round(views * 0.3) }, devices: { phone: Math.round(views * 0.58), desktop: Math.round(views * 0.36), tablet: Math.round(views * 0.06) }, referrers: { google_com: Math.round(views * 0.4), 'psychologytoday_com': Math.round(views * 0.08), 'chatgpt_com': Math.round(views * 0.05), 'bing_com': Math.round(views * 0.03) } });
    }
    const audit = [{ at: iso(daysAgo(1)), by: 'michswo@gmail.com', action: 'identity', target: 'u-quiet-heron' }, { at: iso(daysAgo(3)), by: 'michswo@gmail.com', action: 'list-identities', count: 5 }];
    responses['u-quiet-heron_self-check'].attempt = 2; responses['u-quiet-heron_self-check'].history = [{ answers: { q1: 2, q2: 1, q3: 2, q4: 3, q5: 2, q6: 2 }, submittedAt: iso(daysAgo(40)), attempt: 1 }];
    responses['u-cedar-otter_self-check'].staffNote = 'Discussed in session 10/22; low on repair (q4). Revisit in four weeks.'; responses['u-cedar-otter_self-check'].reviewedAt = iso(daysAgo(4)); responses['u-cedar-otter_self-check'].reviewedBy = 'michswo@gmail.com';
    /* site content: the dashboard edits a draft and publishes; the demo seeds both from the baked content.js */
    const baked = () => JSON.stringify(window.CONTENT || {});
    const site = { published: { json: baked(), version: '2026-10-26T12:00:00.000Z', updatedAt: iso(daysAgo(1)), updatedBy: 'michswo@gmail.com' }, draft: null, versions: [{ id: '2026-10-26T12:00:00.000Z', updatedAt: iso(daysAgo(1)), updatedBy: 'michswo@gmail.com', note: 'First publish from the dashboard', size: baked().length }] };
    let user = null; const listeners = [];
    const role = params.get('role') === 'client' ? 'client' : (location.pathname.includes('/portal') ? 'client' : 'staff');
    const demoUser = role === 'staff' ? { uid: 'staff-1', email: 'michswo@gmail.com', displayName: 'MS' } : { uid: 'u-quiet-heron', email: 'alex.r@example.com', displayName: 'Alex R.' };
    const emit = () => listeners.forEach(f => f(user));
    const clone = x => JSON.parse(JSON.stringify(x));
    return {
      mode: 'demo',
      onAuth(cb) { listeners.push(cb); setTimeout(() => cb(user), 0); },
      async signIn() { user = demoUser; emit(); },
      async signOut() { user = null; emit(); },
      currentUser() { return user; },
      async bootstrap() { const me = clients.find(c => c.uid === user.uid); return role === 'staff' ? { role: 'staff', pseudonym: 'Staff', status: 'staff', assigned: [], isNew: false } : { role: 'client', pseudonym: me.pseudonym, status: me.status, coupleId: me.coupleId, assigned: me.assigned, isNew: params.get('new') === '1' }; },
      async getProfile() { return clone(clients.find(c => c.uid === user.uid)); },
      async listQuestionnaires() { return Object.values(clone(Q)); },
      async getQuestionnaire(id) { return clone(Q[id]) || null; },
      async getResponse(qid) { return clone(responses[user.uid + '_' + qid] || null); },
      async saveResponse(qid, answers, status, retake) { const k = user.uid + '_' + qid; let cur = responses[k] || { uid: user.uid, qid, startedAt: iso(new Date()), attempt: 1 }; if (retake && cur.status === 'submitted') cur = { ...cur, history: [...(cur.history || []), { answers: cur.answers, submittedAt: cur.submittedAt, attempt: cur.attempt || 1 }], attempt: (cur.attempt || 1) + 1, startedAt: iso(new Date()), submittedAt: null }; responses[k] = { ...cur, answers, status, ...(status === 'submitted' ? { submittedAt: iso(new Date()) } : {}) }; return clone(responses[k]); },
      async listMyResponses() { return Object.values(responses).filter(r => r.uid === user.uid).map(clone); },
      async listRequests() { return clone(requests).sort((a, b) => b.received.localeCompare(a.received)); },
      async updateRequest(id, patch) { const r = requests.find(x => x.id === id); Object.assign(r, patch, { updatedAt: iso(new Date()) }); return clone(r); },
      async listClients() { return clone(clients); },
      async updateClient(uid, patch) { const c = clients.find(x => x.uid === uid); Object.assign(c, patch); return clone(c); },
      async clientIdentity(uid) { const c = clients.find(x => x.uid === uid); audit.unshift({ at: iso(new Date()), by: user.email, action: 'identity', target: uid }); return { email: c.email, displayName: c.displayName }; },
      async listCouples() { return clone(couples); },
      async createCouple(uids) { const id = 'c' + (couples.length + 1); const label = uids.map(u => clients.find(c => c.uid === u).pseudonym).join(' & '); couples.push({ id, members: uids, label, createdAt: iso(new Date()) }); uids.forEach(u => { clients.find(c => c.uid === u).coupleId = id; }); return id; },
      async listResponsesFor(uid) { return Object.values(responses).filter(r => r.uid === uid).map(clone); },
      async listTraffic() { return clone(traffic); },
      async upsertQuestionnaire(doc) { Q[doc.id] = clone(doc); return doc.id; },
      async deleteQuestionnaire(id) { delete Q[id]; },
      async listAudit() { return clone(audit); },
      async listAllResponses() { return Object.entries(responses).map(([id, r]) => ({ id, ...clone(r) })); },
      async updateResponse(id, patch) { Object.assign(responses[id], patch); return clone(responses[id]); },
      async getSite(which) { return site[which] ? clone(site[which]) : null; },
      async saveSiteDraft(json) { site.draft = { json, updatedAt: iso(new Date()), updatedBy: user.email }; return site.draft; },
      async publishSite(json, note) { const version = iso(new Date()); site.published = { json, version, updatedAt: version, updatedBy: user.email, note: note || '' }; site.versions.unshift({ id: version, updatedAt: version, updatedBy: user.email, note: note || '', size: json.length, json }); site.draft = null; return version; },
      async listSiteVersions() { return site.versions.map(({ json, ...v }) => v); },
      async getSiteVersion(id) { const v = site.versions.find(x => x.id === id); return v ? { json: v.json || site.published.json, ...v } : null; },
    };
  }

  /* -------------------------------------------------------------- firebase */
  function firebaseApi() {
    const V = '10.14.1';
    const cdn = m => `https://www.gstatic.com/firebasejs/${V}/${m}`;
    let fb = null; const ready = (async () => {
      const [app, auth, fs, fn] = await Promise.all([import(cdn('firebase-app.js')), import(cdn('firebase-auth.js')), import(cdn('firebase-firestore.js')), import(cdn('firebase-functions.js'))]);
      const a = app.initializeApp(window.FIREBASE_CONFIG);
      fb = { auth: auth.getAuth(a), db: fs.getFirestore(a), fns: fn.getFunctions(a, window.FUNCTIONS_REGION || 'us-east4'), A: auth, F: fs, fn };
      return fb;
    })();
    const call = async (name, data) => { const { fn, fns } = await ready; return (await fn.httpsCallable(fns, name)(data || {})).data; };
    const col = async name => { const { F, db } = await ready; return F.collection(db, name); };
    const docRef = async (c, id) => { const { F, db } = await ready; return F.doc(db, c, id); };
    const all = async (q) => { const { F } = await ready; const s = await F.getDocs(q); return s.docs.map(d => ({ id: d.id, ...d.data() })); };
    const uid = () => fb && fb.auth.currentUser && fb.auth.currentUser.uid;
    return {
      mode: 'firebase',
      onAuth(cb) { ready.then(({ A, auth }) => A.onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, email: u.email, displayName: u.displayName, photoURL: u.photoURL } : null))); },
      async signIn() { const { A, auth } = await ready; const p = new A.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); await A.signInWithPopup(auth, p); },
      async signOut() { const { A, auth } = await ready; await A.signOut(auth); },
      currentUser() { const u = fb && fb.auth.currentUser; return u ? { uid: u.uid, email: u.email, displayName: u.displayName } : null; },
      async bootstrap() { const out = await call('bootstrap'); if (out.claimsChanged) { const { auth } = await ready; await auth.currentUser.getIdToken(true); } return out; },
      async getProfile() { const { F } = await ready; const s = await F.getDoc(await docRef('clients', uid())); return s.exists() ? { uid: s.id, ...s.data() } : null; },
      async listQuestionnaires() { return all(await col('questionnaires')); },
      async getQuestionnaire(id) { const { F } = await ready; const s = await F.getDoc(await docRef('questionnaires', id)); return s.exists() ? { id: s.id, ...s.data() } : null; },
      async getResponse(qid) { const { F } = await ready; const s = await F.getDoc(await docRef('responses', uid() + '_' + qid)); return s.exists() ? s.data() : null; },
      async saveResponse(qid, answers, status, retake) {
        const { F } = await ready; const ref = await docRef('responses', uid() + '_' + qid); const snap = await F.getDoc(ref); const now = new Date().toISOString();
        let cur = snap.exists() ? snap.data() : { uid: uid(), qid, startedAt: now, attempt: 1, history: [] };
        if (retake && cur.status === 'submitted') cur = { ...cur, history: [...(cur.history || []), { answers: cur.answers, submittedAt: cur.submittedAt || null, attempt: cur.attempt || 1 }], attempt: (cur.attempt || 1) + 1, startedAt: now, submittedAt: null };
        const { staffNote, reviewedAt, reviewedBy, ...own } = cur;   // staff fields are never written by the client
        const data = { ...own, uid: uid(), qid, answers, status, attempt: own.attempt || 1, history: own.history || [], startedAt: own.startedAt || now, updatedAt: now, ...(status === 'submitted' ? { submittedAt: now } : {}) };
        await F.setDoc(ref, data, { merge: true }); return data;
      },
      async listMyResponses() { const { F } = await ready; return all(F.query(await col('responses'), F.where('uid', '==', uid()))); },
      async listRequests() { const { F } = await ready; return all(F.query(await col('requests'), F.orderBy('received', 'desc'), F.limit(500))); },
      async updateRequest(id, patch) { const { F } = await ready; await F.updateDoc(await docRef('requests', id), { ...patch, updatedAt: new Date().toISOString(), updatedBy: fb.auth.currentUser.email }); },
      async listClients() { return call('listClientAccounts'); },
      async updateClient(cid, patch) { const { F } = await ready; await F.updateDoc(await docRef('clients', cid), { ...patch, updatedAt: new Date().toISOString() }); },
      async clientIdentity(cid) { return call('clientIdentity', { uid: cid }); },
      async listCouples() { return all(await col('couples')); },
      async createCouple(uids) { const { F } = await ready; const label = uids.join(' & '); const ref = await F.addDoc(await col('couples'), { members: uids, label, createdAt: new Date().toISOString() }); for (const u of uids) await F.updateDoc(await docRef('clients', u), { coupleId: ref.id }); return ref.id; },
      async listResponsesFor(cid) { const { F } = await ready; return all(F.query(await col('responses'), F.where('uid', '==', cid))); },
      async listTraffic() { const { F } = await ready; return all(F.query(await col('traffic'), F.orderBy('day', 'desc'), F.limit(90))); },
      async upsertQuestionnaire(doc) { const { F } = await ready; await F.setDoc(await docRef('questionnaires', doc.id), doc); return doc.id; },
      async deleteQuestionnaire(id) { const { F } = await ready; await F.deleteDoc(await docRef('questionnaires', id)); },
      async listAudit() { const { F } = await ready; return all(F.query(await col('audit'), F.orderBy('at', 'desc'), F.limit(200))); },
      async listAllResponses() { return all(await col('responses')); },
      async updateResponse(id, patch) { const { F } = await ready; await F.updateDoc(await docRef('responses', id), patch); },
      async getSite(which) { const { F } = await ready; const s = await F.getDoc(await docRef('site', which)); return s.exists() ? s.data() : null; },
      async saveSiteDraft(json) { const { F } = await ready; const d = { json, updatedAt: new Date().toISOString(), updatedBy: fb.auth.currentUser.email }; await F.setDoc(await docRef('site', 'draft'), d); return d; },
      async publishSite(json, note) { const { F, db } = await ready; const version = new Date().toISOString(); const by = fb.auth.currentUser.email; const pub = { json, version, updatedAt: version, updatedBy: by, note: note || '' };
        await F.setDoc(await docRef('site', 'published'), pub); await F.setDoc(F.doc(db, 'site', 'versions', 'list', version), { ...pub, id: version, size: json.length }); await F.deleteDoc(await docRef('site', 'draft')); return version; },
      async listSiteVersions() { const { F, db } = await ready; const s = await F.getDocs(F.query(F.collection(db, 'site', 'versions', 'list'), F.orderBy('version', 'desc'), F.limit(30))); return s.docs.map(d => { const { json, ...v } = d.data(); return { id: d.id, ...v }; }); },
      async getSiteVersion(id) { const { F, db } = await ready; const s = await F.getDoc(F.doc(db, 'site', 'versions', 'list', id)); return s.exists() ? { id: s.id, ...s.data() } : null; },
    };
  }

  window.API = DEMO ? demoApi() : firebaseApi();
  window.API.isDemo = DEMO;
})();
