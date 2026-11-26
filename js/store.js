// Stockage des fiches : mode local (IndexedDB, un appareil) ou mode partagé (Firebase).
import { FIREBASE_CONFIG } from '../config.js';

export const DEF_CFG = { nom: 'WELLNESS HÔTEL BAGJEM',
  services: 'Hébergement, Restauration, Snack-Bar, Terrasse, Salon de coiffure, Bien-être (manucure, pédicure, hammam, hydrothérapie, kinésithérapie, massage, gommage), Salle de sport',
  adresse: 'à côté du Commissariat du 3ème, au Marché Tsinfem', ville: 'Dschang', bp: '', tel: '697 94 59 37 / 652 95 34 99 / 691 51 55 97 / 699 10 35 93 / 674 63 06 36', email: '',
  region: 'Ouest', departement: 'Menoua', arrondissement: 'Dschang', pin: '0000', tarifA: 12500, tarifAsans: 10000, tarifB: 17500, tarifBsans: 15000, tarifApp: 40000 };
const clone = o => JSON.parse(JSON.stringify(o || {}));
const withDef = c => { const r = { ...DEF_CFG }; for (const [k, v] of Object.entries(c || {})) if (v !== '' && v != null) r[k] = v; else if (!(k in DEF_CFG)) r[k] = v; return r; };

/* ---------- IndexedDB minimal ---------- */
let dbP = null;
function idb() {
  if (!dbP) dbP = new Promise((res, rej) => {
    const r = indexedDB.open('wellness-smart-checkin', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('fiches', { keyPath: 'id' }); d.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbP;
}
async function req(storeName, mode, fn) {
  const d = await idb();
  return new Promise((res, rej) => {
    const t = d.transaction(storeName, mode); const r = fn(t.objectStore(storeName));
    t.oncomplete = () => res(r ? r.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
}
const kvGet = k => req('kv', 'readonly', s => s.get(k));
const kvSet = (k, v) => req('kv', 'readwrite', s => s.put(v, k));

/* ---------- état partagé ---------- */
export const store = {
  mode: FIREBASE_CONFIG ? 'cloud' : 'local',
  fiches: [], cfg: { ...DEF_CFG }, logo: '', user: null, ready: false,
  sync: { ok: false, text: 'Démarrage…' },
};
const listeners = new Set();
export const onStore = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = what => { for (const fn of listeners) { try { fn(what); } catch (e) { console.error(e); } } };
const setSync = (ok, text) => { store.sync = { ok, text }; emit('sync'); };

let fb = null, auth = null, fs = null, unsubs = [];

export async function initStore() {
  // valeurs locales d'abord (affichage immédiat, même hors ligne)
  try {
    store.cfg = withDef((await kvGet('cfg')) || {});
    store.logo = (await kvGet('logo')) || '';
    if (store.mode === 'local') store.fiches = (await req('fiches', 'readonly', s => s.getAll())) || [];
  } catch (e) { console.warn('IndexedDB indisponible', e); }
  if (store.mode === 'local') { store.ready = true; setSync(true, 'Mode local : fiches enregistrées sur cet appareil'); emit('data'); return; }
  try {
    fb = await import('../vendor/firebase.js');
    const app = fb.initializeApp(FIREBASE_CONFIG);
    auth = fb.getAuth(app);
    fs = fb.initializeFirestore(app, { localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() }) });
    fb.onAuthStateChanged(auth, u => { store.user = u || null; if (u) subscribe(); else { unsub(); store.fiches = []; } store.ready = true; emit('auth'); });
  } catch (e) {
    console.error(e); store.mode = 'local'; store.ready = true;
    store.fiches = (await req('fiches', 'readonly', s => s.getAll()).catch(() => [])) || [];
    setSync(false, 'Base partagée inaccessible : mode local'); emit('auth'); emit('data');
  }
}

function unsub() { for (const u of unsubs) u(); unsubs = []; }
function subscribe() {
  unsub(); setSync(false, 'Connexion à la base…');
  let first = true;
  unsubs.push(fb.onSnapshot(fb.collection(fs, 'fiches'), { includeMetadataChanges: true }, s => {
    store.fiches = s.docs.map(d => d.data());
    if (s.metadata.fromCache) setSync(false, 'Hors ligne : les fiches seront envoyées au retour du réseau');
    else setSync(!s.metadata.hasPendingWrites, s.metadata.hasPendingWrites ? 'Envoi en cours…' : 'Synchronisé');
    if (first && !s.metadata.fromCache) { first = false; migrateLocal(); }
    emit('data');
  }, e => { console.error(e); setSync(false, "Accès refusé : ce compte n'est pas autorisé par l'administrateur"); }));
  unsubs.push(fb.onSnapshot(fb.doc(fs, 'config', 'hotel'), s => {
    if (s.exists()) { store.cfg = withDef(s.data()); kvSet('cfg', store.cfg).catch(() => {}); emit('cfg'); }
  }, () => {}));
  unsubs.push(fb.onSnapshot(fb.doc(fs, 'config', 'logo'), s => {
    const v = s.exists() ? String((s.data() || {}).data || '') : '';
    store.logo = /^data:image\//.test(v) ? v : ''; kvSet('logo', store.logo).catch(() => {}); emit('cfg');
  }, () => {}));
}
// fiches saisies en mode local avant la mise en place de la base partagée
async function migrateLocal() {
  try {
    const local = (await req('fiches', 'readonly', s => s.getAll())) || [];
    const miss = local.filter(f => !store.fiches.find(x => x.id === f.id));
    for (const f of local) if (!miss.includes(f)) await req('fiches', 'readwrite', s => s.delete(f.id));
    await Promise.all(miss.map(async f => { await fb.setDoc(fb.doc(fs, 'fiches', f.id), clone(f)); await req('fiches', 'readwrite', s => s.delete(f.id)); }));
    if (miss.length) emit({ toast: miss.length + ' fiche(s) de cet appareil envoyée(s) dans la base partagée.' });
  } catch (e) { console.warn('Envoi des fiches locales incomplet', e); emit({ error: e }); }
}

/* ---------- connexion (mode partagé) ---------- */
export async function login(email, pass) { await fb.signInWithEmailAndPassword(auth, email, pass); }
export async function logout() { if (auth) await fb.signOut(auth); }
export async function resetPassword(email) { await fb.sendPasswordResetEmail(auth, email); }

/* ---------- écritures ---------- */
// En mode partagé, Firestore applique l'écriture tout de suite sur l'appareil et l'envoie dès que
// le réseau est là : on n'attend donc pas le serveur (sinon l'appli bloquerait hors ligne).
export async function saveFiche(f) {
  f.updatedAt = new Date().toISOString();
  const i = store.fiches.findIndex(x => x.id === f.id);
  if (i >= 0) store.fiches[i] = f; else store.fiches.push(f);
  if (store.mode === 'cloud') fb.setDoc(fb.doc(fs, 'fiches', f.id), clone(f)).catch(e => emit({ error: e }));
  else await req('fiches', 'readwrite', s => s.put(clone(f)));
  emit('data');
}
export async function deleteFiche(id) {
  store.fiches = store.fiches.filter(f => f.id !== id);
  if (store.mode === 'cloud') fb.deleteDoc(fb.doc(fs, 'fiches', id)).catch(e => emit({ error: e }));
  else await req('fiches', 'readwrite', s => s.delete(id));
  emit('data');
}
export async function saveCfg(cfg) {
  store.cfg = { ...DEF_CFG, ...cfg }; await kvSet('cfg', store.cfg).catch(() => {});
  if (store.mode === 'cloud') fb.setDoc(fb.doc(fs, 'config', 'hotel'), clone(store.cfg)).catch(e => emit({ error: e }));
  emit('cfg');
}
export async function saveLogo(data) {
  store.logo = data || ''; await kvSet('logo', store.logo).catch(() => {});
  if (store.mode === 'cloud') fb.setDoc(fb.doc(fs, 'config', 'logo'), { data: store.logo }).catch(e => emit({ error: e }));
  emit('cfg');
}
// sauvegarde complète (fichier JSON) et restauration
export function backupJSON() { return JSON.stringify({ app: 'wellness-smart-checkin', date: new Date().toISOString(), cfg: { ...store.cfg, pin: undefined }, logo: store.logo, fiches: store.fiches }, null, 1); }
// reglages : remet aussi coordonnées, tarifs et logo (le code d'accès de l'appareil n'est jamais modifié)
export async function restoreJSON(txt, reglages = false) {
  const d = JSON.parse(txt); if (!d || !Array.isArray(d.fiches)) throw new Error('format');
  if (reglages) {
    if (d.cfg && typeof d.cfg === 'object') {
      const c = { ...store.cfg }; for (const k of Object.keys(DEF_CFG)) if (k !== 'pin' && d.cfg[k] !== undefined) c[k] = d.cfg[k];
      await saveCfg(c);
    }
    if (typeof d.logo === 'string' && (d.logo === '' || /^data:image\//.test(d.logo))) await saveLogo(d.logo);
  }
  let n = 0; for (const f of d.fiches) { if (f && typeof f.id === 'string' && !store.fiches.find(x => x.id === f.id)) { await saveFiche(f); n++; } }
  return n;
}
