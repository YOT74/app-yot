// =====================================================================
// robot/doublons.mjs — repère les courses en double entre les sources (FFTri, IRONMAN, liste,
// propositions des membres) et masque celle en trop, si personne n'y a de statut.
//
// Deux courses sont des doublons si :
//   • elles ont lieu à un jour près ;
//   • le lieu concorde (sinon noms quasi identiques exigés) ;
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
// Règle de ressemblance : ../doublons.js (partagée avec l'app).
// Utilisation : appelé par importer.mjs après l'import ; seul : node robot/doublons.mjs [--essai]
// =====================================================================

import { trouverDoublons } from '../doublons.js';
export { trouverDoublons };

export async function traiterDoublons({ essai = false } = {}) {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const cle = process.env.SUPABASE_CLE_SERVICE;
  if (!url || !cle) throw new Error('SUPABASE_URL et SUPABASE_CLE_SERVICE doivent être définis.');
  const h = { apikey: cle, Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' };
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const rep = await fetch(`${url}/rest/v1/courses?select=id,nom,lieu,departement,date_course,format,source,pas_doublon,jour_inconnu,participations(statut)&validee=eq.true&masquee=eq.false&date_course=gte.${aujourdhui}&limit=5000`, { headers: h });
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
