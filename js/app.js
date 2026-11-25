import { store, onStore, initStore, login, logout, resetPassword, saveFiche, deleteFiche, saveCfg, saveLogo, backupJSON, restoreJSON, DEF_CFG } from './store.js';
import { esc, today, nowHM, addDays, isD, dfr, money, nights, up, clone, PIECES, TRANSPORTS, rooms, roomOf, logoSrc, DEF_LOGO } from './common.js';
import { ficheCanvas, makePdf, makePng, makeDocx, download, share, canShareFiles, printFiche, fname, loadImg } from './fiche.js';
import { readIdCard, warmUp } from './ocr.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const LS = { get(k, d) { try { const v = localStorage.getItem('whsc_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('whsc_' + k, JSON.stringify(v)); } catch (e) {} } };
const SS = { get(k) { try { return sessionStorage.getItem('whsc_' + k); } catch (e) { return null; } }, set(k, v) { try { v == null ? sessionStorage.removeItem('whsc_' + k) : sessionStorage.setItem('whsc_' + k, v); } catch (e) {} } };

const ui = { recep: '', open: false, view: 'dash', draft: null, auto: {}, doubt: {}, step: 1, shots: { r: null, v: null }, cur: null, q: '', qd: '', sig: { dirty: false, data: '' }, installEvt: null };
const occupied = () => { const m = {}; for (const f of store.fiches) if (f.statut === 'en_sejour' && f.chambre) m[f.chambre] = f; return m; };
// Numéro : année-compteur-code de l'appareil. Le code évite les doublons entre appareils hors ligne ;
// le compteur mémorisé évite de réattribuer le numéro d'une fiche supprimée.
let devCode = '';
function deviceCode() {
  if (!devCode) devCode = LS.get('device', '');
  if (!devCode) { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; devCode = [...crypto.getRandomValues(new Uint8Array(3))].map(b => A[b % 32]).join(''); LS.set('device', devCode); }
  return devCode;
}
function nextNum() { const y = new Date().getFullYear(); const last = LS.get('lastNum', {}); let m = last.y === y ? +last.n || 0 : 0; for (const f of store.fiches) { const p = String(f.num || '').split('-'); if (p[0] == String(y)) m = Math.max(m, +p[1] || 0); } LS.set('lastNum', { y, n: m + 1 }); return y + '-' + String(m + 1).padStart(4, '0') + '-' + deviceCode(); }

/* ---------- messages ---------- */
let tt;
function toast(m, ms = 4000) { const t = $('#toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(tt); tt = setTimeout(() => t.classList.add('hidden'), ms); }
function ask(title, body, okTxt = 'Confirmer', cancel = true) {
  return new Promise(res => {
    $('#mt').textContent = title; $('#mb').textContent = body; $('#mok').textContent = okTxt; $('#mno').classList.toggle('hidden', !cancel);
    const m = $('#modal'); m.classList.remove('hidden');
    const done = v => { m.classList.add('hidden'); $('#mok').onclick = $('#mno').onclick = null; res(v); };
    $('#mok').onclick = () => done(true); $('#mno').onclick = () => done(false); $('#mok').focus();
  });
}
function renderBrand() { for (const i of $$('img.logo')) i.src = logoSrc(); for (const h of $$('.hname')) h.textContent = store.cfg.nom || DEF_CFG.nom; }
function renderSync() { const s = $('#sync'); s.classList.toggle('ok', store.sync.ok); s.title = store.sync.text; $('#syncTxt').textContent = store.sync.text; }

/* ---------- navigation ---------- */
const VIEWS = ['dash', 'nouveau', 'historique', 'chambres', 'parametres', 'fiche'];
function go(v, opt = {}) {
  ui.view = v; if (v === 'nouveau' && !opt.keep) startDraft(opt.room);
  try { history.replaceState(null, '', '#' + (v === 'dash' ? 'accueil' : v === 'fiche' ? 'historique' : v)); } catch (e) {}
  render(); window.scrollTo(0, 0);
}
$('#nav').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (b) go(b.dataset.v); });
function render() {
  if (!ui.open) return;
  for (const b of $$('#nav button')) b.classList.toggle('on', b.dataset.v === ui.view || (ui.view === 'fiche' && b.dataset.v === 'historique'));
  $('#whoName').textContent = ui.recep;
  ({ dash: vDash, nouveau: vNew, historique: vHist, chambres: vRooms, parametres: vSet, fiche: vFiche }[ui.view] || vDash)($('#main'));
}
const busyEditing = () => !!$('#ff') || (ui.view === 'nouveau' && ui.step === 1) || ui.view === 'parametres';

/* ---------- tableau de bord ---------- */
function itemHTML(f) {
  const t = today(), late = f.statut === 'en_sejour' && f.depart && f.depart < t;
  const ch = f.statut === 'en_sejour' ? (f.depart === t ? '<span class="chip v">Départ aujourd\'hui</span>' : late ? '<span class="chip v">Départ dépassé</span>' : '<span class="chip in">En séjour</span>') : '<span class="chip out">Parti</span>';
  return `<button class="it" data-id="${esc(f.id)}"><span class="rm">${esc(f.chambre || '—')}</span><span class="tx"><b>${esc(up(f.nom))} ${esc(f.prenoms)}</b><small>${esc(dfr(f.arrivee))} → ${esc(dfr(f.depart))} · Fiche n° ${esc(f.num)}</small></span>${ch}</button>`;
}
function bindItems(m) { for (const b of m.querySelectorAll('.it[data-id]')) b.onclick = () => { ui.cur = b.dataset.id; go('fiche'); }; }
function vDash(m) {
  const t = today(), occ = occupied(), R = rooms();
  const todayN = store.fiches.filter(f => (f.createdAt || '').slice(0, 10) === t).length;
  const arr = store.fiches.filter(f => f.arrivee === t);
  const dep = store.fiches.filter(f => f.statut === 'en_sejour' && f.depart && f.depart <= t);
  const stay = store.fiches.filter(f => f.statut === 'en_sejour').sort((a, b) => (a.depart || '').localeCompare(b.depart || ''));
  const d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  m.innerHTML = `
  ${ui.installEvt ? '<div class="note t row" style="justify-content:space-between;margin-bottom:16px"><span>Installez l\'application sur cet appareil pour l\'ouvrir comme une application, même sans Internet.</span><button class="btn b2" id="inst" style="min-height:42px">Installer</button></div>' : ''}
  <div class="hero">
    <div class="go">
      <div><p style="font-weight:600;opacity:.85;margin:0 0 6px">${esc(d)}</p><h2>Un client arrive à la réception ?</h2><p style="margin-top:8px">Photographiez le recto et le verso de sa pièce d'identité : la fiche de police se remplit toute seule.</p></div>
      <button class="btn" id="goNew"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>NOUVEL ENREGISTREMENT CLIENT</button>
      <svg class="deco" viewBox="0 0 100 100" aria-hidden="true"><rect x="8" y="22" width="84" height="56" rx="8" fill="none" stroke="#fff" stroke-width="5"/><circle cx="32" cy="48" r="10" fill="none" stroke="#fff" stroke-width="5"/><path d="M52 42h28M52 54h20" stroke="#fff" stroke-width="5"/></svg>
    </div>
    <div class="kpis">
      <div class="kpi"><b>${todayN}</b><span>Clients enregistrés aujourd'hui</span></div>
      <div class="kpi v"><b>${Object.keys(occ).length}</b><span>Chambres occupées</span></div>
      <div class="kpi t"><b>${R.length - Object.keys(occ).length}</b><span>Chambres disponibles sur ${R.length}</span></div>
      <div class="kpi"><b>${arr.length}</b><span>Arrivées du jour</span></div>
      <div class="kpi wide"><div><b>${dep.length}</b><span>Départs prévus aujourd'hui (ou en retard)</span></div><button class="btn bo" id="goRooms" style="min-height:42px">Voir les chambres</button></div>
    </div>
  </div>
  <div class="sec"><h3>Clients en séjour</h3><div class="list">${stay.length ? stay.map(itemHTML).join('') : '<div class="empty">Aucun client en séjour pour le moment.</div>'}</div></div>`;
  $('#goNew').onclick = () => go('nouveau'); $('#goRooms').onclick = () => go('chambres');
  if ($('#inst')) $('#inst').onclick = doInstall;
  bindItems(m);
}

/* ---------- nouvel enregistrement ---------- */
function startDraft(room) {
  const t = today();
  ui.draft = { id: '', num: '', nom: '', prenoms: '', sexe: '', dateNaiss: '', lieuNaiss: '', nationalite: '', profession: '', tel: '', paysRes: '', adresse: '',
    typePiece: 'CNI', numPiece: '', dateDeliv: '', lieuDeliv: '', dateExp: '', venantDe: '', allantA: '', arrivee: t, heureArr: nowHM(), depart: addDays(t, 1), nbPers: '1', chambre: room || '', transport: '', immat: '' };
  ui.auto = {}; ui.doubt = {}; ui.step = 1; ui.sig = { dirty: false, data: '' };
  for (const k of ['r', 'v']) if (ui.shots[k]) { URL.revokeObjectURL(ui.shots[k].url); ui.shots[k] = null; }
}
const FORM = [
  ['Identité du client', [['nom', 'Nom', 'text'], ['prenoms', 'Prénoms', 'text'], ['sexe', 'Sexe', 'sel', [['', '—'], ['M', 'Masculin'], ['F', 'Féminin']]], ['dateNaiss', 'Date de naissance', 'date'], ['lieuNaiss', 'Lieu de naissance', 'text'], ['nationalite', 'Nationalité', 'text'], ['profession', 'Profession', 'text'], ['tel', 'Téléphone', 'tel'], ['paysRes', 'Pays de résidence', 'text'], ['adresse', 'Adresse / domicile habituel', 'text']]],
  ["Pièce d'identité", [['typePiece', 'Nature de la pièce', 'sel', PIECES.map(p => [p, p])], ['numPiece', 'Numéro de la pièce', 'text'], ['dateDeliv', 'Délivrée le', 'date'], ['lieuDeliv', 'Lieu de délivrance', 'text'], ['dateExp', "Date d'expiration", 'date']]],
  ['Séjour', [['venantDe', 'Venant de', 'text'], ['allantA', 'Se rend à', 'text'], ['arrivee', "Date d'arrivée", 'date'], ['heureArr', "Heure d'arrivée", 'time'], ['depart', 'Date de départ', 'date'], ['nbPers', 'Nombre de personnes', 'number'], ['chambre', 'Chambre', 'room']]],
  ['Transport', [['transport', 'Mode de transport', 'sel', [['', '—'], ...TRANSPORTS.map(p => [p, p])]], ['immat', 'Numéro du véhicule', 'text']]],
];
function fieldHTML([k, l, type, opts]) {
  const d = ui.draft, v = d[k] ?? '', cls = 'i' + (ui.doubt[k] ? ' doubt' : ui.auto[k] ? ' auto' : '');
  const tag = ui.doubt[k] ? '<em class="tag w">à vérifier</em>' : ui.auto[k] ? '<em class="tag">lu sur la carte</em>' : '';
  let inp;
  if (type === 'sel') inp = `<select class="${cls}" data-k="${k}">${opts.map(([a, b]) => `<option value="${esc(a)}"${a === v ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
  else if (type === 'room') {
    const occ = occupied(); let g = ''; inp = `<select class="${cls}" data-k="chambre"><option value="">Choisir une chambre</option>`;
    for (const r of rooms()) {
      if (r.bloc !== g) { if (g) inp += '</optgroup>'; g = r.bloc; inp += `<optgroup label="${esc(g)}">`; }
      const o = occ[r.n] && occ[r.n].id !== d.id; inp += `<option value="${esc(r.n)}"${r.n === v ? ' selected' : ''}${o ? ' disabled' : ''}>${esc(r.n)} — ${esc(money(r.t))}${o ? ' (occupée)' : ''}</option>`;
    }
    inp += '</optgroup></select>';
  } else inp = `<input class="${cls}" data-k="${k}" type="${type}" value="${esc(v)}"${type === 'number' ? ' min="1" inputmode="numeric"' : ''}${k === 'nom' ? ' autocapitalize="characters"' : ''}>`;
  return `<label class="f"><span>${esc(l)} ${tag}</span>${inp}</label>`;
}
function vNew(m) {
  if (!ui.draft) startDraft();
  const d = ui.draft, edit = !!d.id, s = ui.step || 1;
  const steps = `<div class="steps"><span class="${s === 1 ? 'on' : ''}">1 · Scanner la pièce</span><span class="${s === 2 ? 'on' : ''}">2 · Compléter la fiche</span><span>3 · Imprimer / exporter</span></div>`;
  if (s === 1 && !edit) {
    m.innerHTML = `<h1 class="h">Nouvel enregistrement client</h1><p class="sub">Photographiez la pièce bien à plat, sans reflet, cadrée au plus près, avec les quatre coins visibles.</p>${steps}
    <div class="shots">${['r', 'v'].map(k => { const sh = ui.shots[k]; return `<label class="shot">${sh ? `<img src="${sh.url}" alt=""><span class="chip in ok">${k === 'r' ? 'Recto' : 'Verso'} pris</span>` : `<span class="ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Scanner le ${k === 'r' ? 'recto' : 'verso'}<small>Toucher pour ouvrir l'appareil photo</small></span>`}<input type="file" accept="image/*" capture="environment" data-shot="${k}"></label>`; }).join('')}</div>
    <div class="note t" style="margin-top:14px" id="ocrNote">La lecture se fait sur cet appareil, même sans Internet. Les photos ne sont pas conservées : seules les informations validées sont enregistrées.</div>
    <div class="prog hidden" id="prog"><i></i></div>
    <div class="bar"><button class="btn bo" id="manual">Saisir sans scanner</button><button class="btn b1" id="read"${ui.shots.r || ui.shots.v ? '' : ' disabled'}>Lire la carte automatiquement</button></div>`;
    for (const i of m.querySelectorAll('input[data-shot]')) i.onchange = e => { const f = e.target.files[0]; if (!f) return; const k = e.target.dataset.shot; if (ui.shots[k]) URL.revokeObjectURL(ui.shots[k].url); ui.shots[k] = { file: f, url: URL.createObjectURL(f) }; vNew(m); };
    $('#manual').onclick = () => { ui.step = 2; vNew(m); };
    $('#read').onclick = readCard;
    warmUp();
    return;
  }
  const nAuto = Object.keys(ui.auto).length, nDoubt = Object.keys(ui.doubt).length;
  m.innerHTML = `<h1 class="h">${edit ? 'Modifier la fiche n° ' + esc(d.num) : 'Compléter la fiche de police'}</h1>${steps}
  ${nAuto ? `<div class="note t">${nAuto} information(s) lue(s) sur la carte (en turquoise).${nDoubt ? ` ${nDoubt} sont à vérifier attentivement (en orange).` : ''} Corrigez si besoin avant de valider.</div>` : ''}
  <form id="ff" autocomplete="off">${FORM.map(([t, fs], i) => `<div class="sec"><h3><i>${i + 1}</i>${esc(t)}</h3><div class="grid">${fs.map(fieldHTML).join('')}</div>${t === 'Séjour' ? '<div class="sum" id="sum"></div>' : ''}</div>`).join('')}
  <div class="sec"><h3><i>5</i>Signature du client</h3><div class="pad" id="pad"><canvas></canvas><em>Le client signe ici avec le doigt</em></div>
  <div class="row" style="margin-top:8px"><button type="button" class="btn bo" id="clr" style="min-height:40px">Effacer la signature</button></div></div>
  <div class="bar">${edit ? '' : '<button type="button" class="btn bo" id="back">Retour au scan</button>'}<button type="submit" class="btn b1" id="save">${edit ? 'Enregistrer les modifications' : 'Valider et générer la fiche'}</button></div></form>`;
  const ff = m.querySelector('#ff');
  ff.addEventListener('input', e => {
    const k = e.target.dataset.k; if (!k) return; ui.draft[k] = e.target.value;
    if (ui.doubt[k]) { delete ui.doubt[k]; e.target.classList.remove('doubt'); }
    if (k === 'arrivee' && ui.draft.depart < ui.draft.arrivee) { ui.draft.depart = addDays(ui.draft.arrivee, 1); const x = m.querySelector('[data-k=depart]'); if (x) x.value = ui.draft.depart; }
    sumUpdate();
  });
  ff.addEventListener('change', e => { const k = e.target.dataset.k; if (k) ui.draft[k] = e.target.value; sumUpdate(); });
  ff.onsubmit = e => { e.preventDefault(); submitFiche(); };
  if ($('#back')) $('#back').onclick = () => { ui.step = 1; vNew(m); };
  setupPad(); sumUpdate();
}
function sumUpdate() {
  const s = $('#sum'); if (!s) return; const d = ui.draft, r = roomOf(d.chambre), n = nights(d.arrivee, d.depart);
  s.innerHTML = `<div><small>Nuitées</small><b>${n}</b></div><div><small>Tarif / nuit</small><b>${r ? esc(money(r.t)) : '—'}</b></div><div><small>Montant du séjour</small><b>${r ? esc(money(r.t * n)) : '—'}</b></div>`;
}
function setupPad() {
  const box = $('#pad'), c = box.querySelector('canvas'), em = box.querySelector('em');
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const r = box.getBoundingClientRect(); c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
  const x = c.getContext('2d'); x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = 2.6 * dpr; x.strokeStyle = '#14213d';
  if (ui.sig.data) loadImg(ui.sig.data).then(i => { if (!i) return; const s = Math.min(c.width / i.width, c.height / i.height); x.drawImage(i, 0, 0, i.width * s, i.height * s); em.style.display = 'none'; });
  let drawing = false, last = null;
  const pt = e => { const b = c.getBoundingClientRect(); return [(e.clientX - b.left) * dpr, (e.clientY - b.top) * dpr]; };
  c.onpointerdown = e => { drawing = true; last = pt(e); c.setPointerCapture(e.pointerId); em.style.display = 'none'; x.beginPath(); x.arc(last[0], last[1], 1.2 * dpr, 0, 7); x.fillStyle = '#14213d'; x.fill(); };
  c.onpointermove = e => { if (!drawing) return; const p = pt(e); x.beginPath(); x.moveTo(last[0], last[1]); x.lineTo(p[0], p[1]); x.stroke(); last = p; ui.sig.dirty = true; };
  c.onpointerup = c.onpointercancel = () => { if (drawing && ui.sig.dirty) ui.sig.data = c.toDataURL('image/png'); drawing = false; };
  $('#clr').onclick = () => { x.clearRect(0, 0, c.width, c.height); ui.sig = { dirty: true, data: '' }; em.style.display = ''; };
}
async function readCard() {
  const b = $('#read'), note = $('#ocrNote'), prog = $('#prog'), bar = prog.querySelector('i');
  b.disabled = true; $('#manual').disabled = true; b.innerHTML = '<i class="spin"></i>Lecture en cours…'; prog.classList.remove('hidden');
  try {
    const r = await readIdCard([ui.shots.r && ui.shots.r.file, ui.shots.v && ui.shots.v.file], (txt, p) => { note.textContent = txt; bar.style.width = Math.round(p * 100) + '%'; });
    for (const [k, v] of Object.entries(r.data)) ui.draft[k] = v;
    ui.auto = r.auto; ui.doubt = r.doubt;
    const n = Object.keys(r.auto).length;
    toast(n ? `${n} informations lues sur la carte${r.mrzFound ? '' : ' (lignes <<< non trouvées : photographiez de plus près, sans ombre, ou complétez les champs)'}.` : 'Rien de lisible : reprenez une photo plus nette, bien éclairée, ou saisissez la fiche.', 6000);
    ui.step = 2; render();
  } catch (e) {
    console.error(e); note.className = 'note w';
    note.textContent = "La lecture a échoué sur cet appareil. Reprenez la photo ou saisissez la fiche manuellement.";
    b.disabled = false; $('#manual').disabled = false; b.textContent = 'Lire la carte automatiquement'; prog.classList.add('hidden');
  }
}
async function submitFiche() {
  const d = ui.draft, miss = [];
  if (!d.nom.trim()) miss.push('nom'); if (!d.prenoms.trim()) miss.push('prénoms'); if (!d.numPiece.trim()) miss.push('numéro de pièce'); if (!d.chambre) miss.push('chambre');
  if (!isD(d.arrivee) || !isD(d.depart)) miss.push('dates de séjour');
  if (miss.length) { toast('À compléter : ' + miss.join(', ') + '.'); return; }
  if (d.depart < d.arrivee) { toast("La date de départ est avant la date d'arrivée."); return; }
  const occ = occupied()[d.chambre]; if (occ && occ.id !== d.id) { toast('La chambre ' + d.chambre + ' est déjà occupée.'); return; }
  const r = roomOf(d.chambre), n = nights(d.arrivee, d.depart), prev = d.id ? store.fiches.find(f => f.id === d.id) : null;
  const f = { ...clone(prev), ...clone(d), nom: up(d.nom.trim()), prenoms: d.prenoms.trim(), nuits: n, tarif: r ? r.t : 0, total: r ? r.t * n : 0, categorie: r ? r.cat : '',
    signature: ui.sig.dirty ? ui.sig.data : (prev ? prev.signature || '' : ui.sig.data), auto: Object.keys(ui.auto) };
  if (!f.id) { f.id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); f.num = nextNum(); f.createdAt = new Date().toISOString(); f.recep = ui.recep; f.statut = 'en_sejour'; }
  $('#save').disabled = true;
  try { await saveFiche(f); ui.cur = f.id; ui.draft = null; ui.step = 1; toast(prev ? 'Fiche modifiée.' : 'Fiche n° ' + f.num + ' enregistrée.'); go('fiche'); }
  catch (e) { $('#save').disabled = false; toast("L'enregistrement a échoué sur cet appareil (mémoire pleine ?)."); }
}

/* ---------- fiche ---------- */
const ICON = {
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M12 11v7M9 15l3 3 3-3"/></svg>',
  docx: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 12l1.5 6 1.5-4 1.5 4 1.5-6"/></svg>',
  png: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
};
let previewToken = 0;
function vFiche(m) {
  const f = store.fiches.find(x => x.id === ui.cur);
  if (!f) { m.innerHTML = '<div class="empty">Fiche introuvable.</div>'; return; }
  m.innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:16px"><div><h1 class="h">Fiche n° ${esc(f.num)}</h1><p class="sub">${esc(up(f.nom))} ${esc(f.prenoms)} · chambre ${esc(f.chambre)} · ${esc(dfr(f.arrivee))} → ${esc(dfr(f.depart))}</p></div>${f.statut === 'en_sejour' ? '<span class="chip in">En séjour</span>' : '<span class="chip out">Parti le ' + esc(dfr(f.departEffectif)) + '</span>'}</div>
  <div class="fv"><div class="paper"><img id="prev" alt="Aperçu de la fiche de police"></div>
  <div class="exp card"><b style="font-size:17px">Exporter et imprimer</b>
    <button class="btn b1" data-x="pdf">${ICON.pdf}TÉLÉCHARGER PDF</button>
    <button class="btn b2" data-x="docx">${ICON.docx}TÉLÉCHARGER WORD</button>
    <button class="btn b3" data-x="png">${ICON.png}TÉLÉCHARGER PNG</button>
    <button class="btn bo" data-x="print">${ICON.print}IMPRIMER</button>
    ${canShareFiles() ? `<button class="btn bo" data-x="share">${ICON.share}PARTAGER (WhatsApp…)</button>` : ''}
    <hr style="border:0;border-top:1px solid var(--line);width:100%;margin:4px 0">
    <button class="btn bo" id="edit">Modifier la fiche</button>
    ${f.statut === 'en_sejour' ? '<button class="btn bo" id="out">Enregistrer le départ</button>' : ''}
    <button class="btn b1" id="again">Nouvel enregistrement</button>
    <button class="btn bd" id="del">Supprimer la fiche</button>
  </div></div>`;
  const tok = ++previewToken;
  ficheCanvas(f, 4).then(c => { const i = $('#prev'); if (i && tok === previewToken) i.src = c.toDataURL('image/png'); });
  for (const b of m.querySelectorAll('[data-x]')) b.onclick = () => doExport(f, b.dataset.x, b);
  $('#edit').onclick = () => { ui.draft = clone(f); ui.auto = {}; ui.doubt = {}; ui.sig = { dirty: false, data: f.signature || '' }; ui.step = 2; go('nouveau', { keep: true }); };
  $('#again').onclick = () => go('nouveau');
  if ($('#out')) $('#out').onclick = async () => {
    if (!await ask('Départ du client', `Enregistrer le départ de ${up(f.nom)} ${f.prenoms} et libérer la chambre ${f.chambre} ?`, 'Enregistrer le départ')) return;
    await saveFiche({ ...clone(f), statut: 'parti', departEffectif: today() }); toast('Départ enregistré, chambre ' + f.chambre + ' libérée.'); render();
  };
  $('#del').onclick = async () => {
    if (!await ask('Supprimer cette fiche ?', `La fiche n° ${f.num} de ${up(f.nom)} sera supprimée définitivement. Exportez-la avant si besoin.`, 'Supprimer')) return;
    await deleteFiche(f.id); toast('Fiche supprimée.'); go('historique');
  };
}
async function doExport(f, kind, btn) {
  const lbl = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="spin dark"></i>Préparation…';
  try {
    if (kind === 'print') { await printFiche(f); }
    else if (kind === 'share') { const b = await makePng(f); await share(fname(f, 'png'), b, 'image/png'); }
    else {
      const b = kind === 'pdf' ? await makePdf(f) : kind === 'png' ? await makePng(f) : await makeDocx(f);
      download(fname(f, kind), b);
      toast(kind === 'png' ? 'Image PNG enregistrée dans Téléchargements.' : kind === 'docx' ? 'Fiche Word enregistrée (modifiable dans Word).' : 'PDF enregistré dans Téléchargements.');
    }
  } catch (e) { if (!(e && e.name === 'AbortError')) { console.error(e); toast("L'opération a échoué. Réessayez."); } }
  finally { btn.disabled = false; btn.innerHTML = lbl; }
}

/* ---------- historique ---------- */
function vHist(m) {
  m.innerHTML = `<h1 class="h">Historique des clients</h1><p class="sub">Recherche par nom, téléphone, numéro de pièce, numéro de fiche ou date de séjour.</p>
  <div class="search"><input class="i" id="q" placeholder="Nom, téléphone, n° de pièce, n° de fiche…" value="${esc(ui.q)}"><input class="i" id="qd" type="date" value="${esc(ui.qd)}" title="Client présent à cette date"></div>
  <div class="list" id="hl"></div>`;
  const draw = () => {
    const q = ui.q.trim().toLowerCase(), qd = ui.qd;
    const r = store.fiches.filter(f => (!q || [f.nom, f.prenoms, f.tel, f.numPiece, f.num, f.chambre].some(v => String(v || '').toLowerCase().includes(q))) && (!qd || (f.arrivee <= qd && (f.departEffectif || f.depart) >= qd)))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    $('#hl').innerHTML = r.length ? r.slice(0, 300).map(itemHTML).join('') : `<div class="empty">${store.fiches.length ? 'Aucune fiche ne correspond.' : 'Aucune fiche enregistrée pour le moment.'}</div>`; bindItems($('#hl'));
  };
  $('#q').oninput = e => { ui.q = e.target.value; draw(); }; $('#qd').onchange = e => { ui.qd = e.target.value; draw(); }; draw();
}

/* ---------- chambres ---------- */
function vRooms(m) {
  const occ = occupied(), R = rooms(), blocs = [...new Set(R.map(r => r.bloc))];
  m.innerHTML = `<h1 class="h">Chambres</h1><div class="legend"><span><span class="chip in">Libre</span> toucher pour enregistrer un client</span><span><span class="chip v">Occupée</span> toucher pour ouvrir la fiche</span></div>
  ${blocs.map(b => `<div class="sec"><h3>${esc(b)}</h3><div class="rooms">${R.filter(r => r.bloc === b).map(r => { const f = occ[r.n];
    return `<button class="room${f ? ' occ' : ''}" data-r="${esc(r.n)}"><b>${esc(r.n)}</b><small>${esc(money(r.t))}</small><span class="st">${f ? esc(up(f.nom)) + '<br>départ ' + esc(dfr(f.depart).slice(0, 5)) : '<span style="color:var(--turq)">Libre</span>'}</span></button>`; }).join('')}</div></div>`).join('')}`;
  for (const b of m.querySelectorAll('.room')) b.onclick = () => { const f = occ[b.dataset.r]; if (f) { ui.cur = f.id; go('fiche'); } else go('nouveau', { room: b.dataset.r }); };
}

/* ---------- paramètres ---------- */
function vSet(m) {
  const c = store.cfg, cloud = store.mode === 'cloud';
  const F = (k, l, t = 'text') => `<label class="f"><span>${esc(l)}</span><input class="i" data-c="${k}" type="${t}" value="${esc(c[k])}"${t === 'number' ? ' inputmode="numeric" min="0"' : ''}></label>`;
  m.innerHTML = `<h1 class="h">Paramètres</h1>
  <div class="sec"><h3>Logo officiel</h3><div class="card logoset"><img class="logo" alt="Logo actuel"><div style="flex:1"><p style="margin:0 0 10px">Le logo apparaît sur l'écran de connexion, l'en-tête, le tableau de bord, chaque fiche de police et tous les exports.${cloud ? ' Il est partagé avec tous les appareils.' : ''}</p>
    <div class="row"><label class="btn b1" style="position:relative">Importer le logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" id="logoIn" style="position:absolute;inset:0;opacity:0;cursor:pointer"></label>${store.logo ? '<button class="btn bo" id="logoDel">Revenir au logo provisoire</button>' : ''}</div>
    <small style="color:var(--mute);display:block;margin-top:8px">Conseil : un PNG à fond transparent, au moins 400 px de large.</small></div></div></div>
  <div class="sec"><h3>Coordonnées imprimées sur la fiche</h3><div class="grid">${F('nom', "Nom de l'hôtel")}${F('adresse', 'Adresse / quartier')}${F('bp', 'Boîte postale')}${F('ville', 'Ville')}${F('tel', 'Téléphone')}${F('email', 'E-mail')}</div></div>
  <div class="sec"><h3>Tarifs par nuit (FCFA)</h3><div class="grid">${F('tarifA', 'Bloc A · petit-déjeuner inclus', 'number')}${F('tarifB', 'Bloc B · petit-déjeuner inclus', 'number')}${F('tarifApp', 'Appartement · petit-déj. non inclus', 'number')}</div></div>
  ${cloud ? '' : `<div class="sec"><h3>Code d'accès de cet appareil</h3><div class="grid">${F('pin', "Code d'ouverture de session")}</div></div>`}
  <div class="bar" style="border:0;padding:0;justify-content:flex-start"><button class="btn b1" id="cfgSave">Enregistrer les paramètres</button></div>
  <div class="sec"><h3>Rapports et sauvegarde</h3><div class="card"><div class="grid"><label class="f"><span>Du</span><input class="i" type="date" id="e1" value="${esc(addDays(today(), -30))}"></label><label class="f"><span>Au</span><input class="i" type="date" id="e2" value="${esc(today())}"></label></div>
    <div class="row" style="margin-top:12px"><button class="btn b2" id="csv">Exporter les fiches (Excel / CSV)</button><button class="btn bo" id="bak">Sauvegarde complète</button><label class="btn bo" style="position:relative">Restaurer une sauvegarde<input type="file" accept=".json,application/json" id="rest" style="position:absolute;inset:0;opacity:0;cursor:pointer"></label></div>
    <p class="sub" style="font-size:14px">Le fichier CSV s'ouvre dans Excel : une ligne par client, toutes les rubriques. La sauvegarde complète permet de tout récupérer sur un autre appareil.</p></div></div>
  <div class="sec"><h3>Fonctionnement</h3><div class="note" id="mode"></div>${ui.installEvt ? '<button class="btn b2" id="inst2" style="margin-top:12px">Installer l\'application sur cet appareil</button>' : ''}</div>`;
  renderBrand();
  $('#mode').textContent = cloud
    ? `Mode partagé : les fiches sont enregistrées dans la base de données de l'hôtel et visibles sur tous les appareils connectés (téléphones de la réception, ordinateur du directeur). Sans Internet, l'application continue de fonctionner et envoie les fiches au retour du réseau. Connecté en tant que ${store.user ? store.user.email : '—'}.`
    : "Mode local : les fiches sont enregistrées uniquement sur cet appareil. Pour partager les fiches entre les téléphones et l'ordinateur du directeur, activez la base de données partagée (voir le guide d'installation, étape 2).";
  if ($('#inst2')) $('#inst2').onclick = doInstall;
  $('#cfgSave').onclick = async e => {
    const n = { ...store.cfg }; for (const i of m.querySelectorAll('[data-c]')) { const k = i.dataset.c; n[k] = i.type === 'number' ? Math.max(0, +i.value || 0) : i.value.trim(); }
    if (!n.pin) n.pin = '0000'; await saveCfg(n); renderBrand(); toast('Paramètres enregistrés.');
  };
  $('#logoIn').onchange = async e => {
    const f = e.target.files[0]; if (!f) return; const u = URL.createObjectURL(f); const i = await loadImg(u); URL.revokeObjectURL(u);
    if (!i) { toast("Ce fichier n'est pas une image lisible."); return; }
    let w = Math.min(520, i.naturalWidth || 520), data = '';
    for (let t = 0; t < 4; t++) { const s = w / (i.naturalWidth || w); const cv = document.createElement('canvas'); cv.width = Math.round(w); cv.height = Math.round((i.naturalHeight || w) * s); cv.getContext('2d').drawImage(i, 0, 0, cv.width, cv.height); data = cv.toDataURL('image/png'); if (data.length < 400000) break; w *= 0.75; }
    await saveLogo(data); renderBrand(); toast("Logo mis à jour sur toute l'application."); vSet(m);
  };
  if ($('#logoDel')) $('#logoDel').onclick = async () => { await saveLogo(''); renderBrand(); vSet(m); };
  $('#csv').onclick = () => {
    const a = $('#e1').value, b = $('#e2').value; const r = store.fiches.filter(f => (!a || f.arrivee >= a) && (!b || f.arrivee <= b)).sort((x, y) => (x.num || '').localeCompare(y.num || ''));
    if (!r.length) { toast('Aucune fiche sur cette période.'); return; }
    const cols = [['num', 'N° fiche'], ['nom', 'Nom'], ['prenoms', 'Prénoms'], ['sexe', 'Sexe'], ['dateNaiss', 'Date de naissance'], ['lieuNaiss', 'Lieu de naissance'], ['nationalite', 'Nationalité'], ['profession', 'Profession'], ['tel', 'Téléphone'], ['paysRes', 'Pays de résidence'], ['adresse', 'Adresse'], ['typePiece', 'Nature pièce'], ['numPiece', 'N° pièce'], ['dateDeliv', 'Délivrée le'], ['lieuDeliv', 'Lieu délivrance'], ['dateExp', 'Expiration'], ['venantDe', 'Venant de'], ['allantA', 'Se rend à'], ['arrivee', 'Arrivée'], ['heureArr', 'Heure'], ['depart', 'Départ prévu'], ['departEffectif', 'Départ effectif'], ['nuits', 'Nuitées'], ['nbPers', 'Personnes'], ['chambre', 'Chambre'], ['tarif', 'Tarif/nuit'], ['total', 'Montant'], ['transport', 'Transport'], ['immat', 'Véhicule'], ['recep', 'Réceptionniste'], ['statut', 'Statut']];
    const q = v => { v = String(v ?? ''); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const dates = ['dateNaiss', 'dateDeliv', 'dateExp', 'arrivee', 'depart', 'departEffectif'];
    const csv = '﻿' + [cols.map(c => c[1]).join(';'), ...r.map(f => cols.map(([k]) => q(dates.includes(k) ? dfr(f[k]) : f[k])).join(';'))].join('\r\n');
    download(`Rapport-reception_${a || 'debut'}_${b || 'fin'}.csv`, new Blob([csv], { type: 'text/csv' })); toast(r.length + ' fiches exportées.');
  };
  $('#bak').onclick = () => { download(`Sauvegarde-smart-checkin_${today()}.json`, new Blob([backupJSON()], { type: 'application/json' })); toast('Sauvegarde enregistrée dans Téléchargements.'); };
  $('#rest').onchange = async e => { const f = e.target.files[0]; if (!f) return; const txt = await f.text(); e.target.value = '';
    try {
      const d = JSON.parse(txt); if (!d || !Array.isArray(d.fiches)) throw new Error('format');
      const reg = await ask('Restaurer aussi les réglages ?', 'Les coordonnées, les tarifs et le logo actuels seront remplacés par ceux de la sauvegarde. Avec « Annuler », seules les fiches manquantes sont restaurées.', 'Remplacer les réglages');
      const n = await restoreJSON(txt, reg); renderBrand(); if (ui.view === 'parametres') vSet(m); toast(n + ' fiche(s) restaurée(s)' + (reg ? ', réglages remis en place.' : '.'));
    } catch (x) { toast("Ce fichier n'est pas une sauvegarde valide."); } };
}

/* ---------- installation (PWA) ---------- */
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); ui.installEvt = e; if (ui.view === 'dash' || ui.view === 'parametres') render(); });
window.addEventListener('appinstalled', () => { ui.installEvt = null; toast('Application installée.'); render(); });
async function doInstall() { const e = ui.installEvt; if (!e) return; e.prompt(); try { await e.userChoice; } catch (x) {} ui.installEvt = null; render(); }

/* ---------- connexion ---------- */
function showLogin() {
  ui.open = false; $('#app').classList.add('hidden'); $('#login').classList.remove('hidden');
  const cloud = store.mode === 'cloud';
  $('#lmail').closest('label').classList.toggle('hidden', !cloud); $('#lpass').closest('label').classList.toggle('hidden', !cloud);
  $('#lpin').closest('label').classList.toggle('hidden', cloud); $('#lforgot').classList.toggle('hidden', !cloud);
  $('#lhint').textContent = cloud ? 'Compte fourni par l\'administrateur de l\'application.' : 'Mode local · code par défaut : 0000 (à changer dans Paramètres).';
  $('#lmail').required = $('#lpass').required = cloud; $('#lpin').required = !cloud;
  $('#lname').value = LS.get('lastRecep', ''); $('#lmail').value = LS.get('lastMail', '');
}
function openApp() {
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); ui.open = true;
  $('#lock').textContent = store.mode === 'cloud' ? 'Se déconnecter' : 'Verrouiller';
  const h = (location.hash || '').slice(1); go(h === 'accueil' || !VIEWS.includes(h) || h === 'fiche' ? 'dash' : h);
}
$('#lform').onsubmit = async e => {
  e.preventDefault(); const n = $('#lname').value.trim(), btn = $('#lgo'); $('#lerr').textContent = '';
  if (store.mode === 'cloud') {
    btn.disabled = true;
    try { LS.set('lastMail', $('#lmail').value.trim()); ui.recep = n; LS.set('lastRecep', n); await login($('#lmail').value.trim(), $('#lpass').value); $('#lpass').value = ''; }
    catch (x) { const c = x && x.code || ''; $('#lerr').textContent = /network/.test(c) ? 'Pas de connexion Internet : la première connexion demande Internet.' : /too-many/.test(c) ? 'Trop d\'essais : patientez quelques minutes.' : 'E-mail ou mot de passe incorrect.'; }
    btn.disabled = false; return;
  }
  if ($('#lpin').value.trim() !== String(store.cfg.pin || '0000')) { $('#lerr').textContent = 'Code incorrect.'; return; }
  ui.recep = n; SS.set('recep', n); LS.set('lastRecep', n); $('#lpin').value = ''; openApp();
};
$('#lforgot').onclick = async () => {
  const m = $('#lmail').value.trim(); if (!m) { $('#lerr').textContent = 'Saisissez d\'abord votre e-mail.'; return; }
  try { await resetPassword(m); $('#lerr').textContent = ''; toast('Un e-mail de réinitialisation a été envoyé à ' + m + '.'); } catch (x) { $('#lerr').textContent = "Impossible d'envoyer l'e-mail (adresse inconnue ou pas d'Internet)."; }
};
$('#lock').onclick = async () => { ui.recep = ''; SS.set('recep', null); if (store.mode === 'cloud') await logout(); showLogin(); };

/* ---------- démarrage ---------- */
onStore(what => {
  if (what && what.toast) { toast(what.toast); return; }
  if (what && what.error) { toast(/permission/.test(what.error.code || '') ? "Accès refusé par la base : votre compte n'est pas autorisé." : "Une fiche n'a pas pu être envoyée à la base : elle sera réessayée."); return; }
  if (what === 'sync') { renderSync(); return; }
  if (what === 'auth') {
    if (store.mode === 'cloud') { if (store.user) { ui.recep = ui.recep || LS.get('lastRecep', '') || (store.user.email || '').split('@')[0]; if (!ui.open) openApp(); } else showLogin(); }
    return;
  }
  if (what === 'cfg') renderBrand();
  if (ui.open && !busyEditing()) render();
});
window.addEventListener('hashchange', () => { const h = location.hash.slice(1), v = h === 'accueil' ? 'dash' : h; if (ui.open && VIEWS.includes(v) && v !== ui.view && v !== 'fiche') go(v); });
renderBrand(); renderSync(); showLogin();
initStore().then(() => {
  renderBrand();
  if (store.mode === 'local') { const r = SS.get('recep'); if (r) { ui.recep = r; openApp(); } else showLogin(); }
});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => { const w = reg.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Nouvelle version installée : elle sera active à la prochaine ouverture.', 6000); }); });
  }).catch(() => {});
}
