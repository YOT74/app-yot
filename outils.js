// =====================================================================
// outils.js — petites fonctions utilisées partout (texte, dates, icônes).
// =====================================================================

// Échappe le HTML : à utiliser pour TOUT texte venant de la base.
export function esc(texte) {
  return String(texte ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Un lien n'est affiché que s'il commence par http(s) (pas de javascript:…).
export const lienSur = (url) => (/^https?:\/\//i.test(url || '') ? url : null);

export const majuscule = (t) => String(t ?? '').charAt(0).toUpperCase() + String(t ?? '').slice(1);

// '' ou espaces → null (pour enregistrer « vide » proprement en base).
export function vide(valeur) {
  const v = typeof valeur === 'string' ? valeur.trim() : valeur;
  return v === '' || v === undefined ? null : v;
}

// Minuscules, sans accents ni ponctuation : pour comparer des noms.
export function normalise(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

// Ressemblance entre deux textes, de 0 à 1 (sert à détecter les doublons de courses).
export function proximite(a, b) {
  const x = normalise(a), y = normalise(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const paires = (s) => { const r = []; for (let i = 0; i < s.length - 1; i++) r.push(s.slice(i, i + 2)); return r; };
  const A = paires(x), B = paires(y);
  if (!A.length || !B.length) return 0;
  const reste = [...B];
  let communs = 0;
  for (const g of A) { const i = reste.indexOf(g); if (i > -1) { communs++; reste.splice(i, 1); } }
  return (2 * communs) / (A.length + B.length);
}

// --- Dates (format 'AAAA-MM-JJ', toujours en heure locale) ----------------------

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const enDate = (date) => { const [a, m, j] = date.slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
export const aujourdhui = () => iso(new Date());
export const ajouterJours = (date, n) => { const d = enDate(date); d.setDate(d.getDate() + n); return iso(d); };
export const lundiDe = (date) => { const d = enDate(date); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
export const joursAvant = (date) => Math.round((enDate(date) - enDate(aujourdhui())) / 86400000);
export const estPassee = (date) => date < aujourdhui();

const fmt = (options) => new Intl.DateTimeFormat('fr-FR', options);
const fLong = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fCourt = fmt({ weekday: 'short', day: 'numeric', month: 'long' });
const fJourMois = fmt({ day: 'numeric', month: 'long' });
const fJourMoisCourt = fmt({ day: 'numeric', month: 'short' });
const fMois = fmt({ month: 'long', year: 'numeric' });
const fJourSemaine = fmt({ weekday: 'long' });
export const dateLongue = (d) => fLong.format(enDate(d));
export const dateCourte = (d) => fCourt.format(enDate(d));
export const jourMois = (d) => fJourMois.format(enDate(d));
export const jourMoisCourt = (d) => fJourMoisCourt.format(enDate(d));
export const moisAnnee = (d) => fMois.format(enDate(d));
export const jourSemaine = (d) => fJourSemaine.format(enDate(d));

// « il y a 3 h », « hier », « 12 nov. »
export function ilYa(instant) {
  const s = (Date.now() - Date.parse(instant)) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 172800) return 'hier';
  return jourMoisCourt(instant.slice(0, 10));
}

// Date et heure d'un message : « aujourd'hui à 21:46 », « hier à 8:05 », « 12 nov. à 18:30 ».
export function horodatage(instant) {
  if (!instant) return '';
  const d = new Date(instant);
  if (Number.isNaN(d.getTime())) return '';
  const heure = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const jour = iso(d);
  if (jour === aujourdhui()) return `aujourd'hui à ${heure}`;
  if (jour === ajouterJours(aujourdhui(), -1)) return `hier à ${heure}`;
  const annee = jour.slice(0, 4) !== aujourdhui().slice(0, 4) ? ` ${jour.slice(0, 4)}` : '';
  return `${jourMoisCourt(jour)}${annee} à ${heure}`;
}

// --- Temps de course ------------------------------------------------------------

// Saisie d'un temps → 'HH:MM:SS' ; null si vide, false si invalide.
//   '2:31:05' → 02:31:05   '2h31' → 02:31:00   '37:50' → 00:37:50 (min:s)
export function normaliserTemps(saisie) {
  let s = (saisie || '').trim().toLowerCase();
  if (!s) return null;
  const avecH = s.includes('h');
  s = s.replace('h', ':').replace(/['"]/g, ':');
  const parties = s.split(':').map((x) => x.trim()).filter(Boolean);
  if (parties.length < 2 || parties.length > 3 || parties.some((x) => !/^\d+$/.test(x))) return false;
  if (parties.length === 2) { if (avecH) parties.push('0'); else parties.unshift('0'); }
  const [h, m, sec] = parties.map(Number);
  if (m > 59 || sec > 59) return false;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}
export const afficherTemps = (t) => (t ? String(t).replace(/^00:/, '').replace(/^0(\d)/, '$1') : '');

// --- Icônes au trait (décoratives) ------------------------------------------------

const svg = (corps, taille = 22) =>
  `<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corps}</svg>`;
export const icone = {
  accueil: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  calendrier: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  entrainement: svg('<path d="M4 18l4-6 4 3 4-7 4 4"/><path d="M4 21h16"/>'),
  dossard: svg('<rect x="5" y="4" width="14" height="16" rx="1"/><circle cx="8" cy="7" r="0.8"/><circle cx="16" cy="7" r="0.8"/><path d="M9 13h6"/>'),
  plus: svg('<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'),
  ajouter: svg('<path d="M12 5v14M5 12h14"/>', 26),
  retour: svg('<path d="M15 5l-7 7 7 7"/>', 20),
  soleil: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  lune: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  cloche: svg('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  suivant: svg('<path d="M9 5l7 7-7 7"/>', 18),
  copier: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>', 18),
  lien: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', 16),
};

// --- Agenda (.ics) ----------------------------------------------------------------
// Fichier calendrier standard (Google Agenda, iPhone, Outlook) : un événement
// « journée entière » par course.
export function fichierAgenda(courses, nomClub) {
  const echapper = (t) => String(t ?? '').replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => `\\${m}`).replace(/\r?\n/g, '\\n');
  const jour = (iso) => iso.replace(/-/g, '');
  const lendemain = (iso) => jour(ajouterJours(iso, 1));
  const tampon = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const evenements = courses.map((c) => [
    'BEGIN:VEVENT',
    `UID:${c.id}@club`,
    `DTSTAMP:${tampon}`,
    `DTSTART;VALUE=DATE:${jour(c.date_course)}`,
    `DTEND;VALUE=DATE:${lendemain(c.date_course)}`,
    `SUMMARY:${echapper(c.nom)}`,
    c.lieu ? `LOCATION:${echapper(c.lieu)}` : null,
    `DESCRIPTION:${echapper([c.format, c.url_inscription || c.url_source].filter(Boolean).join(' · '))}`,
    'END:VEVENT',
  ].filter(Boolean).join('\r\n'));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${echapper(nomClub)}//Calendrier//FR`, 'CALSCALE:GREGORIAN', ...evenements, 'END:VCALENDAR'].join('\r\n');
}

