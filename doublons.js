// =====================================================================
// doublons.js — règle commune pour repérer deux fiches de la même course
// (utilisée par l'app, espace bureau et formulaire, et par le robot robot/doublons.mjs).
//   • dates à un jour près (jamais pour une course dont seul le mois est connu) ;
//   • noms qui se ressemblent : score ≥ 0,6 sur les mots significatifs (sans « triathlon », « trail »,
//     « marathon », « de », « la »…) : « Trail des Grottes » et « Trail des Chamois » ne se ressemblent pas ;
//   • au moins une distance en commun (70.3 = L, Full = XXL, Semi = 21 km…), ou l'une n'en indique pas ;
//   • le lieu : même ville (écritures tolérées : « Aix-en-Provence » = « Aix en Provence »,
//     « Chamonix-Mont-Blanc » = « Chamonix », « St » = « Saint »…) ou même département → règle normale ;
//     villes différentes → il faut des noms quasi identiques (≥ 0,9 : une commune voisine
//     annoncée par une autre source) ; ville inconnue d'un côté → règle normale.
// =====================================================================

const MOTS_VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'en', 'et', 'a', 'au', 'aux', 'sur', 'the',
  'triathlon', 'tri', 'ironman', 'im', '70', '3', '703', 'full', 'course', 'courses', 'trail', 'semi', 'marathon',
  'international', 'internationale', 'edition', 'eme', 'e', 'by', 'race', 'run', 'running']);

export const motsDe = (nom) => new Set(String(nom ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/70\.3/g, ' ').replace(/[^a-z0-9]+/g, ' ').split(' ').filter((m) => m && !MOTS_VIDES.has(m)));

// ressemblance des noms : mots communs / mots du nom le plus court (0 à 1)
export function ressemblance(a, b) {
  const A = motsDe(a); const B = motsDe(b);
  if (!A.size || !B.size) return 0;
  const communs = [...A].filter((m) => B.has(m)).length;
  return communs / Math.min(A.size, B.size) * (communs / Math.max(A.size, B.size)) ** 0.25;
}

const CANON = { '70.3': 'L', half: 'L', l: 'L', full: 'XXL', '140.6': 'XXL', xxl: 'XXL', semi: '21', marathon: '42' };
export const distancesDe = (format) => new Set(String(format ?? '').split(/\s*,\s*/).filter(Boolean).map((d) => {
  const brut = d.trim().toLowerCase();
  if (CANON[brut]) return CANON[brut];
  const km = brut.match(/^(\d+(?:[.,]\d+)?)\s*km$/);
  return km ? String(Math.round(parseFloat(km[1].replace(',', '.')))) : brut.toUpperCase();
}));
export const distanceCommune = (a, b) => {
  const A = distancesDe(a); const B = distancesDe(b);
  return !A.size || !B.size || [...A].some((d) => B.has(d));
};

export const SEUIL_NOM = 0.6;
export const SEUIL_NOM_AUTRE_VILLE = 0.9;

const VIDES_LIEU = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'en', 'sur', 'sous', 'lez', 'les', 'et', 'aux', 'au', 'cedex', 'france']);
const ABREGES = { st: 'saint', ste: 'sainte', mt: 'mont' };
export const motsLieu = (lieu) => String(lieu ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean)
  .map((m) => ABREGES[m] ?? m).filter((m) => !VIDES_LIEU.has(m) && !/^\d+$/.test(m));

// true : même endroit · false : endroits différents · null : on ne sait pas
export function memeLieu(a, b) {
  const A = motsLieu(a.lieu); const B = motsLieu(b.lieu);
  if (!A.length || !B.length) return null;
  if (A.join(' ') === B.join(' ')) return true;
  // l'un des noms contient l'autre (Chamonix / Chamonix-Mont-Blanc, Tours / Tours Métropole,
  // St-Gervais / Saint-Gervais-les-Bains) ; mais Aix-en-Provence ≠ Aix-les-Bains
  const COURANTS = new Set(['saint', 'sainte', 'mont', 'lac', 'bains', 'ville', 'val', 'bourg', 'port', 'grand', 'petit', 'haut', 'bas', 'vieux', 'neuf']);
  const [court, long] = A.length <= B.length ? [A, B] : [B, A];
  if (court.every((m) => long.includes(m)) && court.some((m) => !COURANTS.has(m))) return true;
  if (a.departement && b.departement) return a.departement === b.departement ? true : false;
  return false;
}
const seuilNom = (a, b) => (memeLieu(a, b) === false ? SEUIL_NOM_AUTRE_VILLE : SEUIL_NOM);
export const PRIORITE = { fftri: 0, ironman: 1, liste: 2, membre: 3 };
export const ecartJours = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;

// courses : [{ id, nom, date_course, format, source, engages, pas_doublon, jour_inconnu }]
// → [{ garder, masquer, score }]
export function trouverDoublons(courses) {
  const actions = [];
  const masquees = new Set();
  const triees = [...courses].filter((c) => !c.jour_inconnu).sort((a, b) => a.date_course.localeCompare(b.date_course));
  for (let i = 0; i < triees.length; i++) {
    for (let j = i + 1; j < triees.length && ecartJours(triees[i].date_course, triees[j].date_course) <= 1; j++) {
      const a = triees[i]; const b = triees[j];
      if (masquees.has(a.id) || masquees.has(b.id)) continue;
      if (a.source === b.source && a.source !== 'membre') continue;   // une source ne se double pas elle-même
      const score = ressemblance(a.nom, b.nom);
      if (score < seuilNom(a, b) || !distanceCommune(a.format, b.format)) continue;
      if (a.engages && b.engages) continue;                            // au bureau de fusionner
      let [garder, masquer] = a.engages ? [a, b] : b.engages ? [b, a]
        : (PRIORITE[a.source] ?? 9) <= (PRIORITE[b.source] ?? 9) ? [a, b] : [b, a];
      // une course réaffichée par le bureau n'est jamais masquée : c'est l'autre qui part (si personne n'y est)
      if (masquer.pas_doublon) { if (garder.pas_doublon) continue; [garder, masquer] = [masquer, garder]; }
      if (masquer.engages) continue;
      masquees.add(masquer.id);
      actions.push({ garder, masquer, score: Math.round(score * 100) / 100 });
    }
  }
  return actions;
}


// même course ? (sans regarder les engagés ni la source)
export const memeCourse = (a, b) => !a.jour_inconnu && !b.jour_inconnu
  && ecartJours(a.date_course, b.date_course) <= 1
  && ressemblance(a.nom, b.nom) >= seuilNom(a, b) && distanceCommune(a.format, b.format);
