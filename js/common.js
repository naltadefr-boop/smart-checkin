import { store } from './store.js';

export const APP_VERSION = 'v5';
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = n => String(n).padStart(2, '0');
export const ymd = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
export const today = () => ymd(new Date());
export const nowHM = () => { const d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
export const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
export const isD = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
export const dfr = s => isD(s) ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : (s || '');
export const money = n => (Number(n) || 0).toLocaleString('fr-FR').replace(/\s/g, ' ') + ' FCFA';
export const nights = (a, b) => isD(a) && isD(b) ? Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 864e5)) : 0;
export const up = s => String(s || '').toUpperCase();
export const clone = o => JSON.parse(JSON.stringify(o || {}));

export const PIECES = ['CNI', 'Passeport', 'Permis de conduire', 'Carte de séjour', 'Autre'];
export const TRANSPORTS = ['Véhicule personnel', 'Taxi', 'Bus / car', 'Moto', 'Avion', 'Autre'];

export function rooms() {
  const c = store.cfg, r = [];
  for (const e of [1, 2]) for (let i = 1; i <= 8; i++) r.push({ n: `A${e}0${i}`, bloc: 'Bloc A', cat: 'Bloc A · petit-déj. inclus', t: +c.tarifA || 0, ts: +c.tarifAsans || 0 });
  r.push({ n: 'B001', bloc: 'Bloc B', cat: 'Bloc B · PMR, petit-déj. inclus', t: +c.tarifB || 0, ts: +c.tarifBsans || 0 });
  for (let i = 1; i <= 7; i++) r.push({ n: 'B10' + i, bloc: 'Bloc B', cat: 'Bloc B · petit-déj. inclus', t: +c.tarifB || 0, ts: +c.tarifBsans || 0 });
  for (let i = 1; i <= 6; i++) r.push({ n: 'B20' + i, bloc: 'Bloc B', cat: 'Bloc B · petit-déj. inclus', t: +c.tarifB || 0, ts: +c.tarifBsans || 0 });
  r.push({ n: 'APPART', bloc: 'Appartement', cat: 'Appartement · petit-déj. non inclus', t: +c.tarifApp || 0, ts: 0 });
  return r;
}
export const roomOf = n => rooms().find(r => r.n === n);

export const DEF_LOGO = 'icons/logo-provisoire.svg';
export const logoSrc = () => store.logo || DEF_LOGO;
