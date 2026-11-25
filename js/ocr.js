// Lecture des pièces d'identité directement sur l'appareil (sans Internet, sans service extérieur).
// 1) la zone lisible par machine (MRZ, lignes avec des <<<) : nom, prénoms, sexe, dates, numéro, nationalité,
//    vérifiés par les chiffres de contrôle ; 2) le texte imprimé : lieu de naissance, profession, délivrance, adresse.

const abs = p => new URL(p, document.baseURI).href;
let workerP = null, progressCb = null;

function loadScript(src) {
  return new Promise((res, rej) => { if (window.Tesseract) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('script')); document.head.appendChild(s); });
}
async function getWorker() {
  if (!workerP) workerP = (async () => {
    await loadScript(abs('vendor/tesseract/tesseract.min.js'));
    return window.Tesseract.createWorker(['fra', 'eng'], 1, {
      workerPath: abs('vendor/tesseract/worker.min.js'), corePath: abs('vendor/tesseract/core'), langPath: abs('vendor/tesseract/lang'),
      logger: m => { if (progressCb && m && typeof m.progress === 'number') progressCb(m.status, m.progress); },
    });
  })().catch(e => { workerP = null; throw e; });
  return workerP;
}
export function warmUp() { getWorker().catch(() => {}); }

/* ---------- images ---------- */
function loadImage(file) {
  return new Promise((res, rej) => { const u = URL.createObjectURL(file); const i = new Image(); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => { URL.revokeObjectURL(u); rej(new Error('image')); }; i.src = u; });
}
// redimensionne, passe en niveaux de gris et étire le contraste
function prep(img, maxSide, crop, binarize) {
  const sx = crop ? crop.x * img.width : 0, sy = crop ? crop.y * img.height : 0;
  const sw = crop ? crop.w * img.width : img.width, sh = crop ? crop.h * img.height : img.height;
  const s = Math.min(1.6, maxSide / Math.max(sw, sh));
  const c = document.createElement('canvas'); c.width = Math.round(sw * s); c.height = Math.round(sh * s);
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data, hist = new Array(256).fill(0);
  for (let i = 0; i < p.length; i += 4) { const g = (p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114) | 0; p[i] = g; hist[g]++; }
  const n = p.length / 4; let lo = 0, hi = 255, acc = 0;
  for (; lo < 255; lo++) { acc += hist[lo]; if (acc > n * 0.02) break; } acc = 0;
  for (; hi > 0; hi--) { acc += hist[hi]; if (acc > n * 0.02) break; }
  let thr = 128;
  if (binarize) { // seuil d'Otsu
    let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sB = 0, wB = 0, best = 0;
    for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = n - wB; if (!wF) break; sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; thr = t; } }
  }
  const k = 255 / Math.max(1, hi - lo);
  for (let i = 0; i < p.length; i += 4) { let g = p[i]; if (binarize) g = g > thr ? 255 : 0; else g = Math.max(0, Math.min(255, (g - lo) * k)); p[i] = p[i + 1] = p[i + 2] = g; }
  x.putImageData(d, 0, 0); return c;
}

/* ---------- MRZ ---------- */
const VAL = ch => ch === '<' ? 0 : /\d/.test(ch) ? +ch : ch.charCodeAt(0) - 55;
const check = s => { let t = 0; const w = [7, 3, 1]; for (let i = 0; i < s.length; i++) t += VAL(s[i]) * w[i % 3]; return t % 10; };
const toNum = s => s.replace(/[OQD]/g, '0').replace(/[IL]/g, '1').replace(/Z/g, '2').replace(/S/g, '5').replace(/B/g, '8').replace(/G/g, '6').replace(/T/g, '7');
const toAlpha = s => s.replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S').replace(/8/g, 'B').replace(/2/g, 'Z').replace(/6/g, 'G');
const ok = (field, digit) => /\d/.test(digit) && check(field) === +digit;
// numéro de document : essaie de corriger un caractère ambigu pour que le chiffre de contrôle soit juste
function fixDocNum(num, digit) {
  if (ok(num, digit)) return { v: num, sure: true };
  const alt = { O: '0', '0': 'O', I: '1', '1': 'I', S: '5', '5': 'S', B: '8', '8': 'B', Z: '2', '2': 'Z', G: '6', '6': 'G', D: '0', Q: '0' };
  for (let i = 0; i < num.length; i++) { const a = alt[num[i]]; if (!a) continue; const t = num.slice(0, i) + a + num.slice(i + 1); if (ok(t, digit)) return { v: t, sure: true }; }
  return { v: num, sure: false };
}
function mrzDate(s, kind) {
  s = toNum(s); if (!/^\d{6}$/.test(s)) return '';
  const yy = +s.slice(0, 2), mm = s.slice(2, 4), dd = s.slice(4, 6); if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return '';
  const cy = new Date().getFullYear() % 100;
  const y = kind === 'birth' ? (yy > cy ? 1900 + yy : 2000 + yy) : 2000 + yy;
  return `${y}-${mm}-${dd}`;
}
function names(s) {
  s = toAlpha(s).replace(/[^A-Z<]/g, '');
  const [sur, giv = ''] = s.split('<<');
  const clean = t => t.split('<').filter(Boolean).join(' ').trim();
  return { nom: clean(sur), prenoms: clean(giv).toLowerCase().replace(/(^|[\s-])\S/g, m => m.toUpperCase()) };
}
function cleanLine(l) { return l.toUpperCase().replace(/[«‹(\[{]/g, '<').replace(/\s+/g, '').replace(/[^A-Z0-9<]/g, ''); }
export function parseMRZ(text) {
  const lines = text.split(/\n/).map(cleanLine).filter(l => l.length >= 26 && (l.match(/</g) || []).length >= 2);
  const fit = (l, n) => (l + '<'.repeat(n)).slice(0, n);
  const out = { _checks: 0, _ok: 0 };
  const chk = (f, d) => { out._checks++; const r = ok(f, d); if (r) out._ok++; return r; };
  // passeport (TD3 : 2 lignes de 44)
  for (let i = 0; i + 1 < lines.length; i++) {
    if (lines[i].length >= 40 && lines[i + 1].length >= 40 && /^P/.test(lines[i])) {
      const a = fit(lines[i], 44), b = fit(lines[i + 1], 44);
      const dn = fixDocNum(b.slice(0, 9), b[9]); out._checks++; if (dn.sure) out._ok++;
      Object.assign(out, names(a.slice(5)), { type: 'Passeport', numPiece: dn.v.replace(/</g, ''), numSure: dn.sure, nat: toAlpha(b.slice(10, 13)).replace(/</g, ''),
        dateNaiss: mrzDate(b.slice(13, 19), 'birth'), naissSure: chk(toNum(b.slice(13, 19)), b[19]), sexe: /F/.test(b[20]) ? 'F' : /M/.test(b[20]) ? 'M' : '',
        dateExp: mrzDate(b.slice(21, 27)), expSure: chk(toNum(b.slice(21, 27)), b[27]), etat: toAlpha(a.slice(2, 5)).replace(/</g, '') });
      return out;
    }
  }
  // carte d'identité (TD1 : 3 lignes de 30) ou TD2 (2 lignes de 36)
  for (let i = 0; i + 1 < lines.length; i++) {
    const a = lines[i], b = lines[i + 1], c = lines[i + 2] || '';
    const isTD1 = a.length <= 34 && b.length <= 34 && /\d{6}/.test(toNum(b.slice(0, 7))) && c.includes('<<');
    const isTD2 = !isTD1 && a.length >= 33 && b.length >= 33 && a.includes('<<');
    if (isTD1) {
      const A = fit(a, 30), B = fit(b, 30), C = fit(c, 30);
      let num = A.slice(5, 14), dig = A[14];
      if (dig === '<') { const m = A.slice(15).match(/^([A-Z0-9]*?)(\d)</); if (m) { num = A.slice(5, 14) + m[1]; dig = m[2]; } }
      const dn = fixDocNum(num, dig); out._checks++; if (dn.sure) out._ok++;
      const code = A.slice(0, 2).replace(/</g, '');
      Object.assign(out, names(C), { type: /^P/.test(code) ? 'Passeport' : /^(I|A|C)/.test(code) ? 'CNI' : 'Autre', numPiece: dn.v.replace(/</g, ''), numSure: dn.sure,
        dateNaiss: mrzDate(B.slice(0, 6), 'birth'), naissSure: chk(toNum(B.slice(0, 6)), B[6]), sexe: /F/.test(B[7]) ? 'F' : /M/.test(B[7]) ? 'M' : '',
        dateExp: mrzDate(B.slice(8, 14)), expSure: chk(toNum(B.slice(8, 14)), B[14]), nat: toAlpha(B.slice(15, 18)).replace(/</g, ''), etat: toAlpha(A.slice(2, 5)).replace(/</g, '') });
      return out;
    }
    if (isTD2) {
      const A = fit(a, 36), B = fit(b, 36); const dn = fixDocNum(B.slice(0, 9), B[9]); out._checks++; if (dn.sure) out._ok++;
      Object.assign(out, names(A.slice(5)), { type: /^P/.test(A) ? 'Passeport' : 'CNI', numPiece: dn.v.replace(/</g, ''), numSure: dn.sure, nat: toAlpha(B.slice(10, 13)).replace(/</g, ''),
        dateNaiss: mrzDate(B.slice(13, 19), 'birth'), naissSure: chk(toNum(B.slice(13, 19)), B[19]), sexe: /F/.test(B[20]) ? 'F' : /M/.test(B[20]) ? 'M' : '',
        dateExp: mrzDate(B.slice(21, 27)), expSure: chk(toNum(B.slice(21, 27)), B[27]), etat: toAlpha(A.slice(2, 5)).replace(/</g, '') });
      return out;
    }
  }
  return null;
}

/* ---------- texte imprimé (zone visuelle) ---------- */
const NAT = { CMR: ['Camerounaise', 'Cameroun'], FRA: ['Française', 'France'], NGA: ['Nigériane', 'Nigeria'], TCD: ['Tchadienne', 'Tchad'], CAF: ['Centrafricaine', 'Centrafrique'], GAB: ['Gabonaise', 'Gabon'],
  COG: ['Congolaise', 'Congo'], COD: ['Congolaise (RDC)', 'RD Congo'], GNQ: ['Équatoguinéenne', 'Guinée équatoriale'], BFA: ['Burkinabè', 'Burkina Faso'], CIV: ['Ivoirienne', "Côte d'Ivoire"], SEN: ['Sénégalaise', 'Sénégal'],
  MLI: ['Malienne', 'Mali'], BEN: ['Béninoise', 'Bénin'], TGO: ['Togolaise', 'Togo'], NER: ['Nigérienne', 'Niger'], GHA: ['Ghanéenne', 'Ghana'], GIN: ['Guinéenne', 'Guinée'], RWA: ['Rwandaise', 'Rwanda'],
  MAR: ['Marocaine', 'Maroc'], DZA: ['Algérienne', 'Algérie'], TUN: ['Tunisienne', 'Tunisie'], LBN: ['Libanaise', 'Liban'], CHN: ['Chinoise', 'Chine'], USA: ['Américaine', 'États-Unis'], CAN: ['Canadienne', 'Canada'],
  GBR: ['Britannique', 'Royaume-Uni'], DEU: ['Allemande', 'Allemagne'], D: ['Allemande', 'Allemagne'], BEL: ['Belge', 'Belgique'], CHE: ['Suisse', 'Suisse'], ITA: ['Italienne', 'Italie'], ESP: ['Espagnole', 'Espagne'], NLD: ['Néerlandaise', 'Pays-Bas'] };
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const LABELS = {
  prenoms: /PRENOMS?|GIVEN ?NAMES?/,
  nom: /\bNOM\b|SURNAME/,
  dateNaiss: /DATE DE NAISSANCE|DATE OF BIRTH|NE\(?E?\)? LE/,
  lieuNaiss: /LIEU DE NAISSANCE|PLACE OF BIRTH/,
  profession: /PROFESSION|OCCUPATION/,
  dateDeliv: /DATE DE DELIVRANCE|DATE OF ISSUE|DELIVREE? LE|ISSUED ON/,
  dateExp: /DATE D.EXPIRATION|DATE OF EXPIRY|EXPIRY DATE|VALABLE JUSQU|EXPIRE LE/,
  lieuDeliv: /LIEU DE DELIVRANCE|PLACE OF ISSUE|POSTE D.IDENTIFICATION|IDENTIFICATION POST/,
  adresse: /ADRESSE|ADDRESS|DOMICILE/,
  sexe: /\bSEXE\b|\bSEX\b/,
};
const ANY_LABEL = new RegExp(Object.values(LABELS).map(r => r.source).join('|') + '|PERE|MERE|FATHER|MOTHER|TAILLE|HEIGHT|SIGNATURE|AUTORITE|AUTHORITY|REPUBLIQUE|REPUBLIC|CARTE NATIONALE|NATIONAL IDENTITY');
function dateIn(s) {
  const m = norm(s).match(/(\d{1,2})\s*[./\-\s]\s*(\d{1,2})\s*[./\-\s]\s*((?:19|20)\d{2})/); if (!m) return '';
  const d = +m[1], mo = +m[2]; if (d < 1 || d > 31 || mo < 1 || mo > 12) return '';
  return `${m[3]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function parseVIZ(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);
  const N = lines.map(norm), out = {};
  const after = (i, re) => {
    const raw = lines[i], n = N[i]; let cut = 0, m; const g = new RegExp(re.source, 'g');
    while ((m = g.exec(n))) cut = m.index + m[0].length;
    let v = raw.slice(cut).replace(/^[\s:;/|.\-_]+/, '').replace(/[|]/g, '').trim();
    v = v.replace(new RegExp('^(' + ANY_LABEL.source + ')[\\s:/]*', 'i'), '').trim();
    if (v.length >= 2 && !ANY_LABEL.test(norm(v))) return v;
    for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) { if (!ANY_LABEL.test(N[j]) || /\d{1,2}[./]\d{1,2}[./]\d{4}/.test(N[j])) return lines[j].replace(/^[\s:;/|.\-]+/, '').trim(); }
    return '';
  };
  for (const [k, re] of Object.entries(LABELS)) {
    for (let i = 0; i < N.length; i++) {
      if (!re.test(N[i])) continue;
      if (k === 'nom' && LABELS.prenoms.test(N[i]) && !/\bNOM\b.*\bPRENOM/.test(N[i])) continue;
      if (k === 'lieuNaiss' && LABELS.dateNaiss.test(N[i]) && !/LIEU/.test(N[i])) continue;
      const v = after(i, re); if (!v) continue;
      if (k.startsWith('date')) { const d = dateIn(v) || dateIn(lines[i]); if (d) { out[k] = d; break; } continue; }
      if (k === 'sexe') { const s = norm(v); out.sexe = /^F|FEMININ|FEMALE/.test(s) ? 'F' : /^M|MASCULIN|MALE/.test(s) ? 'M' : ''; if (out.sexe) break; continue; }
      out[k] = v.replace(/[^\p{L}\p{N}\s'.,\-/]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 80); if (out[k]) break;
    }
  }
  if (out.nom) out.nom = norm(out.nom).replace(/[^A-Z\s'-]/g, '').trim();
  // numéro de carte sans MRZ : suite de 9 chiffres ou plus
  const num = text.replace(/\s/g, '').match(/\d{9,17}/); if (num) out.numPiece = num[0];
  const nt = norm(text);
  out.type = /PASSEPORT|PASSPORT/.test(nt) ? 'Passeport' : /PERMIS DE CONDUIRE|DRIVING/.test(nt) ? 'Permis de conduire' : /CARTE DE SEJOUR|RESIDENCE PERMIT/.test(nt) ? 'Carte de séjour' : /IDENTITE|IDENTITY/.test(nt) ? 'CNI' : '';
  if (/CAMEROUN|CAMEROON/.test(nt)) out.cmr = true;
  return out;
}

/* ---------- lecture complète ---------- */
// files : [recto, verso] (File ou null). onProgress(texte, 0..1)
export async function readIdCard(files, onProgress = () => {}) {
  const imgs = []; for (const f of files) if (f) imgs.push(await loadImage(f));
  if (!imgs.length) throw new Error('aucune image');
  const steps = imgs.length * 2; let step = 0;
  progressCb = (status, p) => onProgress(status === 'recognizing text' ? 'Lecture de la carte…' : 'Préparation du moteur de lecture…', Math.min(1, (step + (status === 'recognizing text' ? p : 0)) / steps));
  onProgress('Préparation du moteur de lecture…', 0);
  const w = await getWorker();
  let viz = '', mrz = null;
  for (const img of imgs) {
    await w.setParameters({ tessedit_char_whitelist: '', tessedit_pageseg_mode: '3', preserve_interword_spaces: '1' });
    const r = await w.recognize(prep(img, 2000, null, false)); viz += '\n' + r.data.text; step++;
    if (!mrz) {
      await w.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<', tessedit_pageseg_mode: '6' });
      for (const crop of [{ x: 0, y: 0.55, w: 1, h: 0.45 }, { x: 0, y: 0.3, w: 1, h: 0.7 }]) {
        const t = (await w.recognize(prep(img, 2200, crop, true))).data.text; mrz = parseMRZ(t); if (mrz) break;
      }
    }
    step++;
  }
  progressCb = null;
  await w.setParameters({ tessedit_char_whitelist: '' });
  onProgress('Analyse des informations…', 1);
  return merge(mrz, parseVIZ(viz));
}

// fusion : la MRZ (vérifiée) prime ; le texte imprimé complète et reste « à vérifier »
function merge(m, v) {
  const data = {}, auto = {}, doubt = {};
  const put = (k, val, sure) => { if (!val) return; data[k] = val; auto[k] = 1; if (!sure) doubt[k] = 1; };
  if (m) {
    const strong = m._checks > 0 && m._ok >= Math.ceil(m._checks / 2);
    // Les chiffres de contrôle ne couvrent ni le nom, ni les prénoms, ni le sexe, ni la nationalité :
    // ces champs ne sont sûrs que si le texte imprimé donne la même lecture.
    const same = (a, b) => !!a && !!b && norm(a).replace(/[^A-Z]/g, '') === norm(b).replace(/[^A-Z]/g, '');
    put('nom', m.nom, strong && same(m.nom, v.nom)); put('prenoms', m.prenoms, strong && same(m.prenoms, v.prenoms)); put('sexe', m.sexe, strong && m.sexe === v.sexe);
    put('dateNaiss', m.dateNaiss, m.naissSure); put('dateExp', m.dateExp, m.expSure);
    put('numPiece', m.numPiece, m.numSure); put('typePiece', m.type, strong);
    const n = NAT[m.nat]; if (n) { put('nationalite', n[0], false); put('paysRes', n[1], false); }
  }
  // la MRZ perd les traits d'union et les accents : on garde l'écriture imprimée si c'est le même prénom
  const key = s => norm(s || '').replace(/[^A-Z]/g, '');
  if (data.prenoms && v.prenoms && key(v.prenoms) === key(data.prenoms)) data.prenoms = v.prenoms.toLowerCase().replace(/(^|[\s-])\S/g, x => x.toUpperCase());
  if (data.nom && v.nom && key(v.nom) === key(data.nom)) data.nom = v.nom;
  for (const k of ['nom', 'prenoms', 'sexe', 'dateNaiss', 'dateExp', 'numPiece']) if (!data[k] && v[k]) put(k, k === 'prenoms' ? v[k].toLowerCase().replace(/(^|[\s-])\S/g, x => x.toUpperCase()) : v[k], false);
  for (const k of ['lieuNaiss', 'profession', 'dateDeliv', 'lieuDeliv', 'adresse']) if (v[k]) put(k, v[k], false);
  if (!data.typePiece && v.type) put('typePiece', v.type, false);
  if (!data.nationalite && v.cmr) { put('nationalite', 'Camerounaise', false); put('paysRes', 'Cameroun', false); }
  return { data, auto, doubt, mrzFound: !!m };
}
