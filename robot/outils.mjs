// =====================================================================
// robot/outils.mjs — petites fonctions communes aux sources.
// =====================================================================

// Pause entre deux pages : on reste poli avec les sites interrogés.
export const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const AGENT = `RobotCalendrierClub/1.0 (calendrier interne d'un club de triathlon${process.env.CONTACT ? `; ${process.env.CONTACT}` : ''})`;

// Télécharge une page HTML (3 essais). En mode hors ligne (--fichier source=chemin),
// lit la page enregistrée à la place : sert à tester sans toucher au site.
export async function page(url, { fichier } = {}) {
  if (fichier) {
    const { readFile } = await import('node:fs/promises');
    return readFile(fichier, 'utf8');
  }
  for (let essai = 1; ; essai++) {
    let attente = 3000 * essai;
    try {
      const rep = await fetch(url, { headers: { 'User-Agent': AGENT, 'Accept-Language': 'fr,en;q=0.8' } });
      if (rep.status === 429) {   // « trop de requêtes » : le site demande de ralentir
        attente = (Number(rep.headers.get('retry-after')) || 30 * essai) * 1000;
        throw new Error('HTTP 429 (trop de requêtes)');
      }
      if (!rep.ok) throw new Error(`HTTP ${rep.status}`);
      return await rep.text();
    } catch (e) {
      if (essai >= 4) throw new Error(`${url} : ${e.message}`);
      process.stdout.write(`\n  ${e.message}, nouvel essai dans ${Math.round(attente / 1000)} s…`);
      await pause(attente);
    }
  }
}

// « &amp; », « &#039; »… → caractères.
export function texte(html) {
  return String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ').trim();
}

export const iso = (a, m, j) => `${a}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}`;

const MOIS_FR = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };
const MOIS_EN = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const sansAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Mois en toutes lettres ou abrégé (« nov. », « févr. », « juil. ») → numéro.
function moisFr(mot) {
  if (MOIS_FR[mot]) return MOIS_FR[mot];
  if (mot.startsWith('juil')) return 7;
  if (mot.startsWith('juin')) return 6;
  return Object.entries(MOIS_FR).find(([nom]) => mot.length >= 3 && nom.startsWith(mot.slice(0, 3)))?.[1] ?? null;
}

// « 22 NOVEMBRE 2026 », « 22 NOV. 2026 », « DU 20 AU 22 MARS 2027 » → premier jour en AAAA-MM-JJ.
export function dateFr(s) {
  const m = sansAccents(String(s)).match(/(\d{1,2})(?:er)?\s+(?:au\s+\d{1,2}(?:er)?\s+)?([a-z]+)\.?\s+(\d{4})/);
  const mois = m && moisFr(m[2]);
  return mois ? iso(m[3], mois, m[1]) : null;
}

// « November 15, 2026 », « November 14-15, 2026 » → AAAA-MM-JJ.
export function dateEn(s) {
  const m = sansAccents(String(s)).match(/([a-z]+)\s+(\d{1,2})(?:\s*-\s*\d{1,2})?,?\s+(\d{4})/);
  const mois = m && MOIS_EN[m[1]];
  return mois ? iso(m[3], mois, m[2]) : null;
}

// « SAINT-NABORD » → « Saint-Nabord », « MANNEVILLE-ÈS-PLAINS » → « Manneville-ès-Plains ».
const PETITS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'en', 'sur', 'sous', 'lès', 'les', 'ès', 'et', 'aux', 'au']);
export function casse(s) {
  return String(s ?? '').toLowerCase()
    .replace(/[\p{L}']+/gu, (mot, i) => (i > 0 && PETITS.has(mot) ? mot : mot.charAt(0).toUpperCase() + mot.slice(1)));
}

// Code postal → département (« 03100 » → « 03 », « 97441 » → « 974 », Corse → 2A / 2B).
export function departement(cp) {
  const c = String(cp ?? '').trim();
  if (!/^\d{5}$/.test(c)) return null;
  if (c.startsWith('97') || c.startsWith('98')) return c.slice(0, 3);
  if (c.startsWith('20')) return Number(c) < 20200 ? '2A' : '2B';
  return c.slice(0, 2);
}

export const slug = (s) => sansAccents(String(s)).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
