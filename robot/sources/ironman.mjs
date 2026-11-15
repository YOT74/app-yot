// =====================================================================
// robot/sources/ironman.mjs — courses IRONMAN (www.ironman.com/races).
//
// La page affiche les courses par paquets (?page=0, 1, 2…, lien « Load More »
// tant qu'il en reste). Chaque course est une carte avec :
//   data-race-id="97931"                     → identifiant
//   <span class="… date">November 15, 2026</span>
//   <h2 …> IRONMAN 70.3 Phu Quoc </h2>
//   <span class="label">Phu Quoc, Vietnam</span>
//   un lien https://www.ironman.com/races/im703-phu-quoc
// Si IRONMAN change sa page, c'est ici qu'il faut adapter.
// =====================================================================
import { page, pause, texte, dateEn } from '../outils.mjs';

const BASE = 'https://www.ironman.com/races';
const PAGES_MAX = 60;   // garde-fou

function formatDe(nom) {
  if (/70\.3/.test(nom)) return '70.3';
  if (/5150/.test(nom)) return '5150';
  if (/^IRONMAN\b/i.test(nom)) return 'Full';
  return null;
}

// Cartes d'une page → lignes de la table courses.
export function lirePage(html) {
  const morceaux = html.split('races-search-view__cards-row').slice(1);
  const courses = [];
  for (const m of morceaux) {
    const id = m.match(/data-race-id="(\d+)"/)?.[1];
    const date = dateEn(m.match(/class="[^"]*\bdate\b[^"]*">([^<]+)</)?.[1]);
    const nom = texte(m.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1]);
    const lieu = texte(m.match(/<span class="label">([^<]+)</)?.[1]) || null;
    const lien = m.match(/href="(https:\/\/www\.ironman\.com\/races\/[^"?#]+)"/)?.[1] ?? null;
    if (!id || !date || !nom) continue;
    courses.push({
      nom,
      date_course: date,
      lieu,
      departement: null,
      discipline: 'triathlon',
      format: formatDe(nom),
      source: 'ironman',
      source_ref: id,
      url_source: lien,
    });
  }
  return { courses, suite: /rel="next"/.test(html) };
}

const PAUSE = 5000;     // IRONMAN bloque (erreur 429) si on enchaîne les pages trop vite

export async function lire({ fichier } = {}) {
  const vues = new Map();
  for (let n = 0; n < PAGES_MAX; n++) {
    let html;
    try {
      html = await page(n ? `${BASE}?page=${n}` : BASE, { fichier });
    } catch (e) {
      if (!vues.size) throw e;
      // bloqué en cours de route : on garde les courses déjà lues (le reste au prochain passage)
      console.log(`\n  IRONMAN interrompu page ${n + 1} (${e.message}) : ${vues.size} courses gardées`);
      break;
    }
    const { courses, suite } = lirePage(html);
    if (n === 0 && !courses.length) throw new Error('IRONMAN : aucune carte de course trouvée, la page a changé.');
    let nouveaux = 0;
    for (const c of courses) if (!vues.has(c.source_ref)) { vues.set(c.source_ref, c); nouveaux++; }
    process.stdout.write(`\r  ${vues.size} courses lues (page ${n + 1})   `);
    if (fichier || !suite || !nouveaux) break;
    await pause(PAUSE);
  }
  return [...vues.values()];
}
