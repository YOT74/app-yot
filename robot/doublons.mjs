// =====================================================================
// robot/doublons.mjs — repère les courses en double entre les sources (FFTri, IRONMAN, liste,
// propositions des membres) et masque celle en trop, si personne n'y a de statut.
//
// Deux courses sont des doublons si :
//   • elles ont lieu à un jour près ;
//   • leurs noms se ressemblent : score ≥ 0,6 sur les mots significatifs (sans « triathlon »,
//     « ironman », « de », « la »…, sans accents ni ponctuation) ;
//   • elles ont au moins une distance en commun (70.3 = L, Full = XXL, Semi = 21 km…),
//     ou l'une des deux n'en indique pas.
// On garde celle où des membres sont engagés ; si les deux en ont, on ne touche à rien
// (le bureau fusionne depuis son espace). Sinon, priorité : FFTri (un seul événement avec
// toutes ses distances), puis IRONMAN, puis la liste du club, puis les propositions.
// La course en trop est masquée, pas supprimée : le robot la réimporterait sinon.
// Une course réaffichée par le bureau (pas_doublon) n'est plus jamais masquée.
//
// Utilisation : appelé par importer.mjs après l'import ; seul : node robot/doublons.mjs [--essai]
// =====================================================================

const MOTS_VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'en', 'et', 'a', 'au', 'aux', 'sur', 'the',
  'triathlon', 'tri', 'ironman', 'im', '70', '3', '703', 'full', 'course', 'courses', 'trail', 'semi', 'marathon',
  'international', 'internationale', 'edition', 'eme', 'e', 'by', 'race', 'run', 'running']);

export const motsDe = (nom) => new Set(String(nom ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
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
const distanceCommune = (a, b) => {
  const A = distancesDe(a); const B = distancesDe(b);
  return !A.size || !B.size || [...A].some((d) => B.has(d));
};

const PRIORITE = { fftri: 0, ironman: 1, liste: 2, membre: 3 };
const ecartJours = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;

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
      if (score < 0.6 || !distanceCommune(a.format, b.format)) continue;
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

export async function traiterDoublons({ essai = false } = {}) {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const cle = process.env.SUPABASE_CLE_SERVICE;
  if (!url || !cle) throw new Error('SUPABASE_URL et SUPABASE_CLE_SERVICE doivent être définis.');
  const h = { apikey: cle, Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' };
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const rep = await fetch(`${url}/rest/v1/courses?select=id,nom,date_course,format,source,pas_doublon,jour_inconnu,participations(statut)&validee=eq.true&masquee=eq.false&date_course=gte.${aujourdhui}&limit=5000`, { headers: h });
  if (!rep.ok) throw new Error(`Supabase ${rep.status} : ${await rep.text()}`);
  const courses = (await rep.json()).map((c) => ({ ...c, engages: (c.participations ?? []).length }));
  const actions = trouverDoublons(courses);
  console.log(`doublons : ${actions.length} course(s) en double à masquer`);
  for (const { garder, masquer, score } of actions) {
    console.log(`  ${masquer.date_course} « ${masquer.nom} » (${masquer.source}) → doublon de « ${garder.nom} » (${garder.source}) · ressemblance ${score}`);
    if (essai) continue;
    const r = await fetch(`${url}/rest/v1/courses?id=eq.${masquer.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ masquee: true, doublon_de: garder.id }) });
    if (!r.ok) console.log(`    échec : ${r.status} ${await r.text()}`);
  }
  return actions.length;
}

// lancé seul
if (import.meta.url === `file://${process.argv[1]}`) {
  await traiterDoublons({ essai: process.argv.includes('--essai') });
}
