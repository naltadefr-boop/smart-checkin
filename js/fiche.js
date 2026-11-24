// Fiche de police : modèle commun, rendu A4 (aperçu, PNG, PDF), Word (.docx), impression et partage.
import { store, DEF_CFG } from './store.js';
import { dfr, money, up, roomOf, PIECES, TRANSPORTS, logoSrc, DEF_LOGO } from './common.js';

const FF = 'Figtree, Arial, sans-serif';

export function ficheModel(f) {
  return [
    { t: '1. IDENTITÉ DU CLIENT', rows: [
      [{ l: 'Nom', v: up(f.nom), w: 90 }, { l: 'Prénoms', v: f.prenoms, w: 92 }],
      [{ l: 'Sexe', opts: ['Masculin', 'Féminin'], sel: f.sexe === 'M' ? 'Masculin' : f.sexe === 'F' ? 'Féminin' : '', w: 44 }, { l: 'Date de naissance', v: dfr(f.dateNaiss), w: 40 }, { l: 'Lieu de naissance', v: f.lieuNaiss, w: 94 }],
      [{ l: 'Nationalité', v: f.nationalite, w: 58 }, { l: 'Profession', v: f.profession, w: 62 }, { l: 'Téléphone', v: f.tel, w: 58 }],
      [{ l: 'Pays de résidence', v: f.paysRes, w: 58 }, { l: 'Adresse / domicile habituel', v: f.adresse, w: 124 }]] },
    { t: "2. PIÈCE D'IDENTITÉ", rows: [
      [{ l: 'Nature de la pièce', opts: PIECES, sel: f.typePiece, w: 186 }],
      [{ l: 'Numéro de la pièce', v: f.numPiece, w: 56 }, { l: 'Délivrée le', v: dfr(f.dateDeliv), w: 34 }, { l: 'Lieu de délivrance', v: f.lieuDeliv, w: 54 }, { l: "Date d'expiration", v: dfr(f.dateExp), w: 30 }]] },
    { t: '3. SÉJOUR', rows: [
      [{ l: 'Venant de', v: f.venantDe, w: 91 }, { l: 'Se rend à', v: f.allantA, w: 91 }],
      [{ l: "Date d'arrivée", v: dfr(f.arrivee), w: 44 }, { l: 'Heure', v: f.heureArr, w: 24 }, { l: 'Date de départ', v: dfr(f.depart), w: 44 }, { l: 'Nuitées', v: String(f.nuits || ''), w: 24 }, { l: 'Nombre de personnes', v: String(f.nbPers || ''), w: 34 }],
      [{ l: 'Chambre n°', v: f.chambre, w: 40 }, { l: 'Catégorie', v: f.categorie || (roomOf(f.chambre) || {}).cat || '', w: 56 }, { l: 'Tarif / nuit', v: f.tarif ? money(f.tarif) : '', w: 40 }, { l: 'Montant du séjour', v: f.total ? money(f.total) : '', w: 38 }]] },
    { t: '4. MOYEN DE TRANSPORT', rows: [
      [{ l: 'Mode de transport', opts: TRANSPORTS, sel: f.transport, w: 130 }, { l: 'Numéro du véhicule', v: up(f.immat), w: 52 }]] },
  ];
}

let fontsP = null;
const fontsReady = () => (fontsP ||= Promise.all(['400 12px Figtree', '600 12px Figtree', '700 12px Figtree', '800 12px Figtree', 'italic 400 12px Figtree'].map(s => document.fonts ? document.fonts.load(s).catch(() => 0) : 0)));
export const loadImg = src => new Promise(r => { if (!src) return r(null); const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
async function logoImage() { return (await loadImg(logoSrc())) || loadImg(DEF_LOGO); }

export async function ficheCanvas(f, k) {
  await fontsReady();
  const c = document.createElement('canvas'); c.width = Math.round(210 * k); c.height = Math.round(297 * k);
  const x = c.getContext('2d'); x.scale(k, k); x.fillStyle = '#fff'; x.fillRect(0, 0, 210, 297);
  const BLUE = '#1b4f9c', TURQ = '#16a6a3', VIO = '#6a3d9a', INK = '#14213d', MUTE = '#5b6b85', LINE = '#9aa9bf';
  const T = (s, X, Y, o = {}) => {
    s = String(s ?? ''); const size = o.size || 3.6; let fs = size; const font = () => `${o.it ? 'italic ' : ''}${o.w || 400} ${fs}px ${FF}`; x.font = font();
    if (o.max) { while (x.measureText(s).width > o.max && fs > size * 0.66) { fs -= 0.08; x.font = font(); } if (x.measureText(s).width > o.max) { while (s.length > 1 && x.measureText(s + '…').width > o.max) s = s.slice(0, -1); s += '…'; } }
    x.fillStyle = o.c || INK; x.textAlign = o.a || 'left'; x.fillText(s, X, Y);
  };
  const L = 12, R = 198, cfg = store.cfg;
  const logo = await logoImage();
  if (logo) { const lw = logo.naturalWidth || 30, lh = logo.naturalHeight || 30, s = Math.min(30 / lw, 30 / lh); x.drawImage(logo, L + (30 - lw * s) / 2, 9 + (30 - lh * s) / 2, lw * s, lh * s); }
  T(cfg.nom || DEF_CFG.nom, 47, 18, { size: 6, w: 800, c: BLUE, max: 98 });
  const l2 = [cfg.adresse, cfg.bp ? 'BP ' + cfg.bp : '', cfg.ville].filter(Boolean).join(' · ');
  const l3 = [cfg.tel ? 'Tél. ' + cfg.tel : '', cfg.email].filter(Boolean).join(' · ');
  T(l2 || 'Hôtel · Bien-être · Restauration', 47, 24.5, { size: 3.2, c: MUTE, max: 98 }); if (l3) T(l3, 47, 29.5, { size: 3.2, c: MUTE, max: 98 });
  T('Réceptionniste : ' + (f.recep || ''), 47, 35, { size: 3, c: MUTE, max: 98 });
  x.strokeStyle = VIO; x.lineWidth = 0.5; x.strokeRect(150, 10, 48, 26); x.fillStyle = VIO; x.fillRect(150, 10, 48, 8.5);
  T('FICHE DE POLICE', 174, 15.8, { size: 3.9, w: 800, c: '#fff', a: 'center' });
  T('N° ' + (f.num || ''), 174, 25, { size: 4.2, w: 700, a: 'center' });
  T('Établie le ' + dfr((f.createdAt || '').slice(0, 10) || f.arrivee), 174, 31.5, { size: 3, c: MUTE, a: 'center' });
  const g = x.createLinearGradient(L, 0, R, 0); g.addColorStop(0, BLUE); g.addColorStop(0.55, TURQ); g.addColorStop(1, VIO); x.fillStyle = g; x.fillRect(L, 42, R - L, 1.3);
  T("BULLETIN INDIVIDUEL D'ENREGISTREMENT DU VOYAGEUR", 105, 51, { size: 4.5, w: 800, c: BLUE, a: 'center' });
  T('À remplir par tout client à son arrivée et à présenter aux services de police sur réquisition', 105, 56.3, { size: 2.9, it: 1, c: MUTE, a: 'center' });
  let y = 61;
  for (const sec of ficheModel(f)) {
    x.fillStyle = BLUE; x.fillRect(L, y, R - L, 6.6); T(sec.t, L + 3, y + 4.6, { size: 3.4, w: 700, c: '#fff' }); y += 8.2;
    for (const row of sec.rows) {
      let cx = L;
      for (const cell of row) {
        T(cell.l, cx, y + 3, { size: 2.6, w: 600, c: MUTE, max: cell.w });
        if (cell.opts) {
          let ox = cx;
          for (const o of cell.opts) {
            const on = cell.sel === o; x.strokeStyle = on ? BLUE : LINE; x.lineWidth = 0.35; x.strokeRect(ox, y + 5.1, 3.2, 3.2);
            if (on) { x.fillStyle = BLUE; x.fillRect(ox + 0.6, y + 5.7, 2, 2); }
            x.font = `${on ? 700 : 400} 3.3px ${FF}`; x.fillStyle = on ? INK : '#3d4a63'; x.textAlign = 'left'; x.fillText(o, ox + 4.4, y + 7.9); ox += 4.4 + x.measureText(o).width + 4.2;
          }
        } else {
          T(cell.v || '', cx + 0.5, y + 8.3, { size: 4, w: 700, max: cell.w - 1 });
          x.strokeStyle = LINE; x.lineWidth = 0.25; x.beginPath(); x.moveTo(cx, y + 10); x.lineTo(cx + cell.w, y + 10); x.stroke();
        }
        cx += cell.w + 4;
      }
      y += 12.2;
    }
    y += 2.4;
  }
  y += 1; T(`Fait à ${cfg.ville || '……………………'}, le ${dfr(f.arrivee)}`, L, y + 3, { size: 3.4, w: 600 }); y += 6;
  const bw = 89; x.strokeStyle = LINE; x.lineWidth = 0.35; x.strokeRect(L, y, bw, 33); x.strokeRect(R - bw, y, bw, 33);
  T('Signature du client', L + 3, y + 4.6, { size: 3, w: 700, c: BLUE }); T('Le réceptionniste — nom, visa et cachet', R - bw + 3, y + 4.6, { size: 3, w: 700, c: BLUE });
  const sig = await loadImg(f.signature);
  if (sig) { const s = Math.min((bw - 8) / sig.width, 24 / sig.height); x.drawImage(sig, L + 4, y + 7, sig.width * s, sig.height * s); }
  T(f.recep || '', R - bw + 3, y + 12, { size: 3.6, w: 700, max: bw - 6 });
  x.fillStyle = g; x.fillRect(L, 286, R - L, 0.6);
  T(`${cfg.nom || DEF_CFG.nom} — Fiche de police n° ${f.num || ''} — Document confidentiel réservé à l'hôtel et aux autorités compétentes`, 105, 290.5, { size: 2.5, c: MUTE, a: 'center', max: R - L });
  return c;
}

/* ---------- bibliothèques d'export (embarquées dans l'application) ---------- */
const libP = {};
function lib(name, src, get) {
  return (libP[name] ||= new Promise((res, rej) => { if (get()) return res(get()); const s = document.createElement('script'); s.src = src; s.onload = () => get() ? res(get()) : rej(new Error(name)); s.onerror = () => { libP[name] = null; rej(new Error(name)); }; document.head.appendChild(s); }));
}
const toBlob = (c, t, q) => new Promise(r => c.toBlob(r, t, q));
export const fname = (f, ext, suf = '') => `Fiche-police_${f.num}_${up(f.nom).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'client'}${suf}.${ext}`;

export async function makePdf(f) {
  const J = await lib('jspdf', 'vendor/jspdf.umd.min.js', () => window.jspdf);
  const c = await ficheCanvas(f, 10);
  const d = new J.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  d.setProperties({ title: 'Fiche de police ' + f.num, author: store.cfg.nom, creator: 'Wellness Smart Check-in' });
  d.addImage(c.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  return d.output('blob');
}
export async function makePng(f) { return toBlob(await ficheCanvas(f, 12), 'image/png'); }
async function pngBytes(src, maxW) {
  const i = await loadImg(src); if (!i) return null; const s = Math.min(1, maxW / i.width);
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(i.width * s)); c.height = Math.max(1, Math.round(i.height * s));
  c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); const b = await toBlob(c, 'image/png');
  return { data: new Uint8Array(await b.arrayBuffer()), w: c.width, h: c.height };
}
export async function makeDocx(f) {
  const D = await lib('docx', 'vendor/docx.umd.js', () => window.docx);
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun, AlignmentType, ShadingType, VerticalAlign, HeightRule } = D;
  const mm = v => Math.round(v * 56.7), cfg = store.cfg;
  const NB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, noB = { top: NB, bottom: NB, left: NB, right: NB };
  const tblB = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };
  const P = (t, o = {}) => new Paragraph({ alignment: o.al, spacing: { before: o.sb || 0, after: o.sa || 0 }, children: [new TextRun({ text: t ?? '', bold: o.b, italics: o.i, size: o.s || 20, color: o.c || '14213D', font: 'Calibri' })] });
  const logo = (await pngBytes(logoSrc(), 400)) || (await pngBytes(DEF_LOGO, 400));
  const lw = logo ? Math.round(95 * Math.min(1, logo.w / logo.h)) : 0, lh = logo ? Math.round(95 * Math.min(1, logo.h / logo.w)) : 0;
  const l2 = [cfg.adresse, cfg.bp ? 'BP ' + cfg.bp : '', cfg.ville].filter(Boolean).join(' · ') || 'Hôtel · Bien-être · Restauration';
  const l3 = [cfg.tel ? 'Tél. ' + cfg.tel : '', cfg.email].filter(Boolean).join(' · ');
  const boxB = { style: BorderStyle.SINGLE, size: 8, color: '6A3D9A' };
  const head = new Table({ width: { size: mm(186), type: WidthType.DXA }, columnWidths: [mm(34), mm(102), mm(50)], borders: tblB, rows: [new TableRow({ children: [
    new TableCell({ width: { size: mm(34), type: WidthType.DXA }, borders: noB, verticalAlign: VerticalAlign.CENTER, children: [logo ? new Paragraph({ children: [new ImageRun({ data: logo.data, transformation: { width: lw, height: lh } })] }) : P('')] }),
    new TableCell({ width: { size: mm(102), type: WidthType.DXA }, borders: noB, verticalAlign: VerticalAlign.CENTER, children: [P(cfg.nom || DEF_CFG.nom, { b: 1, s: 32, c: '1B4F9C' }), P(l2, { s: 17, c: '5B6B85', sb: 40 }), ...(l3 ? [P(l3, { s: 17, c: '5B6B85' })] : []), P('Réceptionniste : ' + (f.recep || ''), { s: 16, c: '5B6B85', sb: 40 })] }),
    new TableCell({ width: { size: mm(50), type: WidthType.DXA }, borders: { top: boxB, bottom: boxB, left: boxB, right: boxB }, verticalAlign: VerticalAlign.CENTER, margins: { top: 60, bottom: 60 }, children: [
      new Paragraph({ alignment: AlignmentType.CENTER, shading: { type: ShadingType.CLEAR, fill: '6A3D9A', color: 'auto' }, children: [new TextRun({ text: 'FICHE DE POLICE', bold: true, color: 'FFFFFF', size: 21, font: 'Calibri' })] }),
      P('N° ' + f.num, { b: 1, s: 24, al: AlignmentType.CENTER, sb: 80 }), P('Établie le ' + dfr((f.createdAt || '').slice(0, 10) || f.arrivee), { s: 16, c: '5B6B85', al: AlignmentType.CENTER })] })] })] });
  const kids = [head,
    new Paragraph({ spacing: { before: 120, after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '16A6A3', space: 1 } }, children: [] }),
    P("BULLETIN INDIVIDUEL D'ENREGISTREMENT DU VOYAGEUR", { b: 1, s: 24, c: '1B4F9C', al: AlignmentType.CENTER, sb: 160 }),
    P('À remplir par tout client à son arrivée et à présenter aux services de police sur réquisition', { i: 1, s: 15, c: '5B6B85', al: AlignmentType.CENTER, sa: 80 })];
  const lineB = { style: BorderStyle.SINGLE, size: 4, color: '9AA9BF' };
  for (const sec of ficheModel(f)) {
    kids.push(new Paragraph({ spacing: { before: 140, after: 60 }, shading: { type: ShadingType.CLEAR, fill: '1B4F9C', color: 'auto' }, children: [new TextRun({ text: ' ' + sec.t, bold: true, color: 'FFFFFF', size: 19, font: 'Calibri' })] }));
    for (const row of sec.rows) {
      const cells = [], cw = [];
      row.forEach((cell, i) => {
        if (i) { cells.push(new TableCell({ width: { size: mm(4), type: WidthType.DXA }, borders: noB, children: [P('')] })); cw.push(mm(4)); }
        const val = cell.opts ? cell.opts.map(o => (o === cell.sel ? '☒ ' : '☐ ') + o).join('   ') : (cell.v || ' ');
        cells.push(new TableCell({ width: { size: mm(cell.w), type: WidthType.DXA }, borders: cell.opts ? noB : { ...noB, bottom: lineB }, children: [P(cell.l, { s: 14, c: '5B6B85', b: 1 }), P(val, { b: !cell.opts, s: cell.opts ? 18 : 20, sb: 20, sa: 20 })] })); cw.push(mm(cell.w));
      });
      kids.push(new Table({ width: { size: mm(186), type: WidthType.DXA }, columnWidths: cw, borders: tblB, rows: [new TableRow({ children: cells })] }));
      kids.push(new Paragraph({ spacing: { before: 0, after: 40 }, children: [] }));
    }
  }
  kids.push(P(`Fait à ${cfg.ville || '……………………'}, le ${dfr(f.arrivee)}`, { b: 1, s: 19, sb: 160, sa: 80 }));
  const sig = f.signature ? await pngBytes(f.signature, 600) : null;
  const sB = { style: BorderStyle.SINGLE, size: 4, color: '9AA9BF' }, allB = { top: sB, bottom: sB, left: sB, right: sB };
  kids.push(new Table({ width: { size: mm(186), type: WidthType.DXA }, columnWidths: [mm(89), mm(8), mm(89)], borders: tblB, rows: [new TableRow({ height: { value: mm(33), rule: HeightRule.ATLEAST }, children: [
    new TableCell({ width: { size: mm(89), type: WidthType.DXA }, borders: allB, margins: { left: 100, top: 60 }, children: [P('Signature du client', { b: 1, s: 17, c: '1B4F9C' }), sig ? new Paragraph({ children: [new ImageRun({ data: sig.data, transformation: { width: Math.round(Math.min(300, sig.w * 85 / sig.h)), height: Math.round(Math.min(85, sig.h * 300 / sig.w)) } })] }) : P('')] }),
    new TableCell({ width: { size: mm(8), type: WidthType.DXA }, borders: noB, children: [P('')] }),
    new TableCell({ width: { size: mm(89), type: WidthType.DXA }, borders: allB, margins: { left: 100, top: 60 }, children: [P('Le réceptionniste — nom, visa et cachet', { b: 1, s: 17, c: '1B4F9C' }), P(f.recep || '', { b: 1, s: 21, sb: 160 })] })] })] }));
  kids.push(P(`${cfg.nom || DEF_CFG.nom} — Fiche de police n° ${f.num} — Document confidentiel réservé à l'hôtel et aux autorités compétentes`, { s: 14, c: '5B6B85', al: AlignmentType.CENTER, sb: 200 }));
  const doc = new Document({ creator: 'Wellness Smart Check-in', title: 'Fiche de police ' + f.num, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: mm(10), bottom: mm(10), left: mm(12), right: mm(12) } } }, children: kids }] });
  return Packer.toBlob(doc);
}

/* ---------- enregistrer / partager / imprimer ---------- */
export function download(name, blob) {
  const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 8000);
}
export function canShareFiles() { try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.png', { type: 'image/png' })] })); } catch (e) { return false; } }
export async function share(name, blob, type) {
  const file = new File([blob], name, { type });
  await navigator.share({ files: [file], title: name });
}
export async function printFiche(f) {
  const c = await ficheCanvas(f, 8); const url = c.toDataURL('image/png');
  const area = document.getElementById('printArea'); area.innerHTML = ''; const img = new Image();
  await new Promise(r => { img.onload = r; img.onerror = r; img.src = url; }); area.appendChild(img);
  await new Promise(r => setTimeout(r, 60)); window.print();
}
