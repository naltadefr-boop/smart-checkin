// Fiche d’hébergement : même ordre que le carnet papier de l’hôtel. Rendu A4 (aperçu, PNG, PDF), Word (.docx), impression et partage.
import { store, DEF_CFG } from './store.js';
import { dfr, money, up, TRANSPORTS, logoSrc, DEF_LOGO } from './common.js';

const FF = 'Figtree, Arial, sans-serif';

export function ficheModel(f) {
  const nh = f.nbHommes ?? '', nf = f.nbFemmes ?? '', tot = f.nbPers || ((+nh || 0) + (+nf || 0)) || '';
  const piece = f.numPiece ? ((f.typePiece || 'CNI') + ' ' + f.numPiece) : '';
  return {
    haut: [
      [{ l: 'Noms et prénoms', en: 'Name and surnames', v: [up(f.nom), f.prenoms].filter(Boolean).join(' '), w: 186 }],
      [{ l: 'Date de naissance', en: 'Date of birth', v: dfr(f.dateNaiss), w: 56 }, { l: 'Lieu de naissance', en: 'Place of birth', v: f.lieuNaiss, w: 126 }],
      [{ l: 'Nationalité', en: 'Nationality', v: f.nationalite, w: 91 }, { l: 'Pays de résidence', en: 'Country of residence', v: f.paysRes, w: 91 }],
      [{ l: 'Adresse', en: 'Address', v: f.adresse, w: 116 }, { l: 'Profession', en: 'Occupation', v: f.profession, w: 66 }],
      [{ l: 'Venant de', en: 'Coming from', v: f.venantDe, w: 91 }, { l: 'Se rend à', en: 'Travelling to', v: f.allantA, w: 91 }],
      [{ l: 'Nombre de personnes : M', en: 'Male', v: String(nh), w: 60 }, { l: 'F', en: 'Female', v: String(nf), w: 60 }, { l: 'Total', v: String(tot), w: 58 }],
      [{ l: 'Passeport ou carte nationale d’identité N°', en: 'ID number', v: piece, w: 82 }, { l: 'à', en: 'at', v: f.lieuDeliv, w: 54 }, { l: 'le', en: 'on', v: dfr(f.dateDeliv), w: 42 }],
      [{ l: 'Mode de transport', en: 'Means of transport', opts: TRANSPORTS, sel: f.transport, w: 130 }, { l: 'Véhicule N°', en: 'Car number', v: up(f.immat), w: 52 }],
    ],
    bas: [
      [{ l: 'N° chambre', en: 'Room', v: f.chambre, w: 34 }, { l: 'Date d’arrivée', en: 'Arrival', v: dfr(f.arrivee) + (f.heureArr ? ' à ' + f.heureArr : ''), w: 56 }, { l: 'Date de départ', en: 'Departure', v: dfr(f.depart), w: 44 }, { l: 'Nombre de nuitées', en: 'Nights', v: String(f.nuits || ''), w: 40 }],
      [{ l: 'Tarif', en: 'Rate per night', v: f.tarif ? money(f.tarif) + (f.tarifMode === 'sans' ? ' · sans petit-déj.' : f.tarifMode === 'libre' ? ' · prix spécial' : '') : '', w: 60 }, { l: 'Montant du séjour', en: 'Total', v: f.total ? money(f.total) : '', w: 60 }, { l: 'Réceptionniste', en: 'Receptionist', v: f.recep, w: 58 }],
    ],
  };
}
function lines(f) {
  const cfg = store.cfg;
  return {
    nom: cfg.nom || DEF_CFG.nom, services: cfg.services || '',
    l2: cfg.ville ? `Situé à ${cfg.ville}${cfg.adresse ? ', ' + cfg.adresse : ''}` : (cfg.adresse || ''),
    l3: [cfg.tel ? 'Tél. ' + cfg.tel : '', cfg.email].filter(Boolean).join(' · '),
    adm: [`BP : ${cfg.bp || '……………'}`, cfg.region && 'Région : ' + cfg.region, cfg.departement && 'Département : ' + cfg.departement, cfg.arrondissement && 'Arrondissement : ' + cfg.arrondissement].filter(Boolean).join('   ·   '),
    date: dfr((f.createdAt || '').slice(0, 10) || f.arrivee), ville: cfg.ville || '……………………',
    slogan: `${(cfg.nom || DEF_CFG.nom).replace(/\s+BAGJEM$/i, '')} : « votre bien-être, notre satisfaction »`,
  };
}

let fontsP = null;
const fontsReady = () => (fontsP ||= Promise.all(['400 12px Figtree', '600 12px Figtree', '700 12px Figtree', '800 12px Figtree', 'italic 400 12px Figtree'].map(s => document.fonts ? document.fonts.load(s).catch(() => 0) : 0)));
export const loadImg = src => new Promise(r => { if (!src) return r(null); const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
async function logoImage() { return (await loadImg(logoSrc())) || loadImg(DEF_LOGO); }

export async function ficheCanvas(f, k) {
  await fontsReady();
  const c = document.createElement('canvas'); c.width = Math.round(210 * k); c.height = Math.round(297 * k);
  const x = c.getContext('2d'); x.scale(k, k); x.fillStyle = '#fff'; x.fillRect(0, 0, 210, 297);
  const BLUE = '#1b4f9c', TURQ = '#16a6a3', VIO = '#6a3d9a', INK = '#14213d', MUTE = '#5b6b85', SOFT = '#8a97ab', LINE = '#9aa9bf';
  const font = (size, w = 400, it) => `${it ? 'italic ' : ''}${w} ${size}px ${FF}`;
  const T = (s, X, Y, o = {}) => {
    s = String(s ?? ''); const size = o.size || 3.6; let fs = size; x.font = font(fs, o.w, o.it);
    if (o.max) { while (x.measureText(s).width > o.max && fs > size * 0.66) { fs -= 0.08; x.font = font(fs, o.w, o.it); } if (x.measureText(s).width > o.max) { while (s.length > 1 && x.measureText(s + '…').width > o.max) s = s.slice(0, -1); s += '…'; } }
    x.fillStyle = o.c || INK; x.textAlign = o.a || 'left'; x.fillText(s, X, Y); return x.measureText(s).width;
  };
  const wrap = (s, max, size) => { x.font = font(size); const out = []; let cur = ''; for (const wd of String(s || '').split(/\s+/).filter(Boolean)) { const t = cur ? cur + ' ' + wd : wd; if (x.measureText(t).width > max && cur) { out.push(cur); cur = wd; } else cur = t; } if (cur) out.push(cur); return out; };
  const L = 12, R = 198, t = lines(f), RH = 14;
  // en-tête
  const logo = await logoImage();
  if (logo) { const lw = logo.naturalWidth || 30, lh = logo.naturalHeight || 30, s = Math.min(30 / lw, 30 / lh); x.drawImage(logo, L + (30 - lw * s) / 2, 8 + (30 - lh * s) / 2, lw * s, lh * s); }
  T(t.nom, 46, 14.5, { size: 5.6, w: 800, c: BLUE, max: 102 });
  let hy = 19.2;
  for (const l of wrap(t.services, 102, 2.6).slice(0, 3)) { T(l, 46, hy, { size: 2.6, c: MUTE, max: 102 }); hy += 3.2; }
  if (t.l2) { T(t.l2, 46, hy + 0.6, { size: 2.8, it: 1, max: 102 }); hy += 3.7; }
  if (t.l3) { T(t.l3, 46, hy + 0.6, { size: 2.8, max: 102 }); hy += 3.7; }
  x.strokeStyle = VIO; x.lineWidth = 0.5; x.strokeRect(152, 8, 46, 27); x.fillStyle = VIO; x.fillRect(152, 8, 46, 8.5);
  T('FICHE D’HÉBERGEMENT', 175, 13.7, { size: 3.4, w: 800, c: '#fff', a: 'center', max: 43 });
  T('N° ' + (f.num || ''), 175, 23, { size: 4, w: 700, a: 'center', max: 43 });
  T('Date : ' + t.date, 175, 30, { size: 3, c: MUTE, a: 'center' });
  let y = Math.max(hy, 38) + 2.5;
  T(t.adm, 105, y, { size: 3, w: 600, a: 'center', max: R - L }); y += 2.5;
  const g = x.createLinearGradient(L, 0, R, 0); g.addColorStop(0, BLUE); g.addColorStop(0.55, TURQ); g.addColorStop(1, VIO); x.fillStyle = g; x.fillRect(L, y, R - L, 1.2); y += 1.2;
  T('CADRE IDÉAL POUR VOS SÉJOURS', 105, y + 6.5, { size: 4.2, w: 800, c: BLUE, a: 'center' }); y += 10;
  const rows = list => {
    for (const row of list) {
      let cx = L;
      for (const cell of row) {
        const lw = T(cell.l, cx, y + 3, { size: 2.8, w: 700, c: MUTE, max: cell.w });
        if (cell.en && cell.w - lw > 10) T(cell.en, cx + lw + 1.5, y + 3, { size: 2.4, it: 1, c: SOFT, max: cell.w - lw - 1.5 });
        if (cell.opts) {
          let ox = cx;
          for (const o of cell.opts) {
            const on = cell.sel === o; x.strokeStyle = on ? BLUE : LINE; x.lineWidth = 0.35; x.strokeRect(ox, y + 5.6, 3.2, 3.2);
            if (on) { x.fillStyle = BLUE; x.fillRect(ox + 0.6, y + 6.2, 2, 2); }
            x.font = font(3.2, on ? 700 : 400); x.fillStyle = on ? INK : '#3d4a63'; x.textAlign = 'left'; x.fillText(o, ox + 4.3, y + 8.4); ox += 4.3 + x.measureText(o).width + 3.6;
          }
        } else {
          T(cell.v || '', cx + 0.5, y + 9, { size: 4, w: 700, max: cell.w - 1 });
          x.strokeStyle = LINE; x.lineWidth = 0.25; x.setLineDash([0.6, 0.6]); x.beginPath(); x.moveTo(cx, y + 10.8); x.lineTo(cx + cell.w, y + 10.8); x.stroke(); x.setLineDash([]);
        }
        cx += cell.w + 4;
      }
      y += RH;
    }
  };
  const m = ficheModel(f);
  rows(m.haut);
  y += 1; T(`Fait à ${t.ville}, le ${dfr(f.arrivee)}`, L, y + 3, { size: 3.4, w: 600 }); y += 6;
  const bw = 89; x.strokeStyle = LINE; x.lineWidth = 0.35; x.strokeRect(L, y, bw, 28); x.strokeRect(R - bw, y, bw, 28);
  const lw1 = T('Signature du client', L + 3, y + 4.6, { size: 3, w: 700, c: BLUE }); T('Signature of customer', L + 4.5 + lw1, y + 4.6, { size: 2.5, it: 1, c: SOFT });
  const lw2 = T('Cachet de l’hôtel', R - bw + 3, y + 4.6, { size: 3, w: 700, c: BLUE }); T('Hotel stamp', R - bw + 4.5 + lw2, y + 4.6, { size: 2.5, it: 1, c: SOFT });
  const sig = await loadImg(f.signature);
  if (sig) { const s = Math.min((bw - 8) / sig.width, 19 / sig.height); x.drawImage(sig, L + 4, y + 7, sig.width * s, sig.height * s); }
  y += 33;
  x.fillStyle = BLUE; x.fillRect(L, y, R - L, 6.4); T('RÉSERVÉ À L’HÔTEL', L + 3, y + 4.5, { size: 3.3, w: 700, c: '#fff' }); y += 8.6;
  rows(m.bas);
  T(t.slogan, 105, 281, { size: 3.8, w: 700, it: 1, c: VIO, a: 'center', max: R - L });
  x.fillStyle = g; x.fillRect(L, 285, R - L, 0.6);
  T(`${t.nom} — Fiche d’hébergement n° ${f.num || ''} — Document confidentiel réservé à l’hôtel et aux autorités compétentes`, 105, 290.5, { size: 2.5, c: MUTE, a: 'center', max: R - L });
  return c;
}

/* ---------- bibliothèques d'export (embarquées dans l'application) ---------- */
const libP = {};
function lib(name, src, get) {
  return (libP[name] ||= new Promise((res, rej) => { if (get()) return res(get()); const s = document.createElement('script'); s.src = src; s.onload = () => get() ? res(get()) : rej(new Error(name)); s.onerror = () => { libP[name] = null; rej(new Error(name)); }; document.head.appendChild(s); }));
}
const toBlob = (c, t, q) => new Promise(r => c.toBlob(r, t, q));
export const fname = (f, ext, suf = '') => `Fiche-hebergement_${f.num}_${up(f.nom).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'client'}${suf}.${ext}`;

export async function makePdf(f) {
  const J = await lib('jspdf', 'vendor/jspdf.umd.min.js', () => window.jspdf);
  const c = await ficheCanvas(f, 10);
  const d = new J.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  d.setProperties({ title: 'Fiche d’hébergement ' + f.num, author: store.cfg.nom, creator: 'Wellness Smart Check-in' });
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
  const mm = v => Math.round(v * 56.7), t = lines(f);
  const NB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, noB = { top: NB, bottom: NB, left: NB, right: NB };
  const tblB = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };
  const R = (s, o = {}) => new TextRun({ text: s ?? '', bold: o.b, italics: o.i, size: o.s || 20, color: o.c || '14213D', font: 'Calibri' });
  const P = (s, o = {}) => new Paragraph({ alignment: o.al, spacing: { before: o.sb || 0, after: o.sa || 0 }, children: [R(s, o)] });
  const logo = (await pngBytes(logoSrc(), 400)) || (await pngBytes(DEF_LOGO, 400));
  const lw = logo ? Math.round(95 * Math.min(1, logo.w / logo.h)) : 0, lh = logo ? Math.round(95 * Math.min(1, logo.h / logo.w)) : 0;
  const boxB = { style: BorderStyle.SINGLE, size: 8, color: '6A3D9A' };
  const head = new Table({ width: { size: mm(186), type: WidthType.DXA }, columnWidths: [mm(34), mm(104), mm(48)], borders: tblB, rows: [new TableRow({ children: [
    new TableCell({ width: { size: mm(34), type: WidthType.DXA }, borders: noB, verticalAlign: VerticalAlign.CENTER, children: [logo ? new Paragraph({ children: [new ImageRun({ data: logo.data, transformation: { width: lw, height: lh } })] }) : P('')] }),
    new TableCell({ width: { size: mm(104), type: WidthType.DXA }, borders: noB, verticalAlign: VerticalAlign.CENTER, children: [P(t.nom, { b: 1, s: 30, c: '1B4F9C' }), ...(t.services ? [P(t.services, { s: 14, c: '5B6B85', sb: 30 })] : []), ...(t.l2 ? [P(t.l2, { s: 16, i: 1, sb: 30 })] : []), ...(t.l3 ? [P(t.l3, { s: 16 })] : [])] }),
    new TableCell({ width: { size: mm(48), type: WidthType.DXA }, borders: { top: boxB, bottom: boxB, left: boxB, right: boxB }, verticalAlign: VerticalAlign.CENTER, margins: { top: 60, bottom: 60 }, children: [
      new Paragraph({ alignment: AlignmentType.CENTER, shading: { type: ShadingType.CLEAR, fill: '6A3D9A', color: 'auto' }, children: [R('FICHE D’HÉBERGEMENT', { b: 1, c: 'FFFFFF', s: 19 })] }),
      P('N° ' + f.num, { b: 1, s: 23, al: AlignmentType.CENTER, sb: 80 }), P('Date : ' + t.date, { s: 16, c: '5B6B85', al: AlignmentType.CENTER })] })] })] });
  const kids = [head,
    P(t.adm, { b: 1, s: 16, al: AlignmentType.CENTER, sb: 100 }),
    new Paragraph({ spacing: { before: 40, after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '16A6A3', space: 1 } }, children: [] }),
    P('CADRE IDÉAL POUR VOS SÉJOURS', { b: 1, s: 24, c: '1B4F9C', al: AlignmentType.CENTER, sb: 140, sa: 100 })];
  const lineB = { style: BorderStyle.DOTTED, size: 4, color: '9AA9BF' };
  const rows = list => {
    for (const row of list) {
      const cells = [], cw = [];
      row.forEach((cell, i) => {
        if (i) { cells.push(new TableCell({ width: { size: mm(4), type: WidthType.DXA }, borders: noB, children: [P('')] })); cw.push(mm(4)); }
        const val = cell.opts ? cell.opts.map(o => (o === cell.sel ? '☒ ' : '☐ ') + o).join('   ') : (cell.v || ' ');
        const lab = new Paragraph({ children: [R(cell.l, { b: 1, s: 15, c: '5B6B85' }), ...(cell.en ? [R('  ' + cell.en, { i: 1, s: 13, c: '8A97AB' })] : [])] });
        cells.push(new TableCell({ width: { size: mm(cell.w), type: WidthType.DXA }, borders: cell.opts ? noB : { ...noB, bottom: lineB }, children: [lab, P(val, { b: !cell.opts, s: cell.opts ? 18 : 21, sb: 20, sa: 20 })] })); cw.push(mm(cell.w));
      });
      kids.push(new Table({ width: { size: mm(186), type: WidthType.DXA }, columnWidths: cw, borders: tblB, rows: [new TableRow({ children: cells })] }));
      kids.push(new Paragraph({ spacing: { before: 0, after: 60 }, children: [] }));
    }
  };
  const m = ficheModel(f);
  rows(m.haut);
  kids.push(P(`Fait à ${t.ville}, le ${dfr(f.arrivee)}`, { b: 1, s: 19, sb: 100, sa: 80 }));
  const sig = f.signature ? await pngBytes(f.signature, 600) : null;
  const sB = { style: BorderStyle.SINGLE, size: 4, color: '9AA9BF' }, allB = { top: sB, bottom: sB, left: sB, right: sB };
  const boxTitle = (a, b) => new Paragraph({ children: [R(a, { b: 1, s: 17, c: '1B4F9C' }), R('  ' + b, { i: 1, s: 14, c: '8A97AB' })] });
  kids.push(new Table({ width: { size: mm(186), type: WidthType.DXA }, columnWidths: [mm(89), mm(8), mm(89)], borders: tblB, rows: [new TableRow({ height: { value: mm(28), rule: HeightRule.ATLEAST }, children: [
    new TableCell({ width: { size: mm(89), type: WidthType.DXA }, borders: allB, margins: { left: 100, top: 60 }, children: [boxTitle('Signature du client', 'Signature of customer'), sig ? new Paragraph({ children: [new ImageRun({ data: sig.data, transformation: { width: Math.round(Math.min(300, sig.w * 70 / sig.h)), height: Math.round(Math.min(70, sig.h * 300 / sig.w)) } })] }) : P('')] }),
    new TableCell({ width: { size: mm(8), type: WidthType.DXA }, borders: noB, children: [P('')] }),
    new TableCell({ width: { size: mm(89), type: WidthType.DXA }, borders: allB, margins: { left: 100, top: 60 }, children: [boxTitle('Cachet de l’hôtel', 'Hotel stamp')] })] })] }));
  kids.push(new Paragraph({ spacing: { before: 200, after: 80 }, shading: { type: ShadingType.CLEAR, fill: '1B4F9C', color: 'auto' }, children: [R(' RÉSERVÉ À L’HÔTEL', { b: 1, c: 'FFFFFF', s: 19 })] }));
  rows(m.bas);
  kids.push(P(t.slogan, { b: 1, i: 1, s: 20, c: '6A3D9A', al: AlignmentType.CENTER, sb: 160 }));
  kids.push(P(`${t.nom} — Fiche d’hébergement n° ${f.num} — Document confidentiel réservé à l’hôtel et aux autorités compétentes`, { s: 14, c: '5B6B85', al: AlignmentType.CENTER, sb: 80 }));
  const doc = new Document({ creator: 'Wellness Smart Check-in', title: 'Fiche d’hébergement ' + f.num, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: mm(10), bottom: mm(10), left: mm(12), right: mm(12) } } }, children: kids }] });
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
