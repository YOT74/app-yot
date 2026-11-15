// =====================================================================
// robot/planning.mjs — recopie le planning du coach (Google Sheets) dans l'app.
//
// Lancé par GitHub Actions (.github/workflows/planning.yml), deux fois par jour.
// Lecture seule : le fichier est téléchargé au format Excel grâce à son lien de
// partage (« Toute personne disposant du lien : lecteur »), puis lu exactement
// comme l'import Excel de l'app (import-excel.js).
//
// Seules les séances à partir d'aujourd'hui sont mises à jour : le passé n'est jamais
// touché. Une séance inchangée est gardée telle quelle (avec ses « je viens ») ;
// une séance modifiée ou retirée du fichier est remplacée ou supprimée.
// Attention : pour les jours à venir, le fichier du coach fait foi. Une séance ajoutée
// à la main dans l'app sur ces jours-là sera retirée au passage suivant.
//
// Utilisation :
//   node robot/planning.mjs                       → met à jour Supabase
//   node robot/planning.mjs --essai               → affiche les changements sans rien écrire
//   node robot/planning.mjs --fichier planning.xlsx --essai   → lit un fichier local
// Variables d'environnement (secrets GitHub) : PLANNING_URL, SUPABASE_URL, SUPABASE_CLE_SERVICE.
// =====================================================================
import { readFile } from 'node:fs/promises';
import { lireXlsx } from '../lecteur-xlsx.js';
import { analyserFeuille, trierFeuilles, seancesAImporter } from '../import-excel.js';
import { aujourdhui } from '../outils.js';

const args = process.argv.slice(2);
const essai = args.includes('--essai');
const fichier = args.includes('--fichier') ? args[args.indexOf('--fichier') + 1] : null;

// Lien de partage (…/spreadsheets/d/<identifiant>/edit…) → lien de téléchargement Excel.
function lienExport(lien) {
  const id = String(lien ?? '').match(/\/d\/([\w-]{20,})/)?.[1] ?? (/^[\w-]{20,}$/.test(lien ?? '') ? lien : null);
  if (!id) throw new Error('PLANNING_URL doit être le lien de partage du Google Sheets.');
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
}

async function telecharger() {
  if (fichier) return readFile(fichier);
  const rep = await fetch(lienExport(process.env.PLANNING_URL), { redirect: 'follow' });
  if (!rep.ok) throw new Error(`Téléchargement du planning impossible (HTTP ${rep.status}). Le lien est-il bien partagé en lecture ?`);
  if (!/spreadsheetml/.test(rep.headers.get('content-type') ?? '')) throw new Error("Le lien ne renvoie pas un tableur : vérifie qu'il est partagé à « Toute personne disposant du lien ».");
  return Buffer.from(await rep.arrayBuffer());
}

// --- Supabase (clé service : contourne les règles d'accès, reste dans les secrets) ---
const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
const cle = process.env.SUPABASE_CLE_SERVICE;
async function api(chemin, options = {}) {
  if (!base || !cle) throw new Error('SUPABASE_URL et SUPABASE_CLE_SERVICE doivent être définis (secrets du dépôt).');
  const rep = await fetch(`${base}/rest/v1/${chemin}`, {
    ...options,
    headers: { apikey: cle, Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json', Prefer: 'return=minimal', ...options.headers },
  });
  if (!rep.ok) throw new Error(`Supabase ${rep.status} : ${await rep.text()}`);
  return rep.status === 204 || options.method ? null : rep.json();
}

// Ce qui définit une séance : si tout est identique, on la garde.
const CHAMPS = ['date', 'heure', 'discipline', 'titre', 'contenu', 'lieu', 'groupe', 'duree', 'intensite'];
const empreinte = (s) => JSON.stringify(CHAMPS.map((c) => s[c] ?? null));

// --- Lecture du planning ---------------------------------------------------------
const tampon = await telecharger();
const feuilles = (await lireXlsx(tampon.buffer.slice(tampon.byteOffset, tampon.byteOffset + tampon.byteLength)))
  .map((f) => ({ nom: f.nom, analyse: analyserFeuille(f.grille, f.fusions) }));
const { retenues, doublons } = trierFeuilles(feuilles);
for (const d of doublons) console.log(`Onglet « ${d.nom} » ignoré : mêmes dates que « ${d.avec} ».`);

const debut = aujourdhui();
const voulues = retenues
  .filter((f) => f.analyse.fin >= debut)
  .flatMap((f) => seancesAImporter(f.analyse))
  .filter((s) => s.date >= debut);
if (!voulues.length) { console.log(`Aucune séance à partir du ${debut} dans le fichier : rien à faire.`); process.exit(0); }
const fin = voulues.reduce((m, s) => (s.date > m ? s.date : m), debut);
console.log(`Fichier : ${voulues.length} séances du ${debut} au ${fin}.`);

// --- Comparaison avec l'app --------------------------------------------------------
const existantes = fichier && essai && !base ? [] : await api(`seances?select=id,${CHAMPS.join(',')}&date=gte.${debut}&date=lte.${fin}`);
const restantes = new Map();   // empreinte → séances existantes identiques encore disponibles
for (const s of existantes) { const e = empreinte(s); restantes.set(e, [...(restantes.get(e) ?? []), s]); }
const aCreer = [];
for (const s of voulues) {
  const memes = restantes.get(empreinte(s));
  if (memes?.length) memes.shift();   // déjà dans l'app : on la garde
  else aCreer.push(s);
}
const aSupprimer = [...restantes.values()].flat();

console.log(`${existantes.length - aSupprimer.length} inchangées, ${aCreer.length} à ajouter, ${aSupprimer.length} à retirer.`);
for (const s of aSupprimer) console.log(`  - ${s.date} ${s.discipline} · ${s.titre}`);
for (const s of aCreer) console.log(`  + ${s.date} ${s.discipline} · ${s.titre}${s.groupe ? ` (${s.groupe})` : ''}`);
if (essai || (!aCreer.length && !aSupprimer.length)) process.exit(0);

// --- Écriture -------------------------------------------------------------------------
for (let i = 0; i < aSupprimer.length; i += 100) {
  const ids = aSupprimer.slice(i, i + 100).map((s) => s.id).join(',');
  await api(`seances?id=in.(${ids})`, { method: 'DELETE' });
}
if (aCreer.length) await api('seances', { method: 'POST', body: JSON.stringify(aCreer.map((s) => ({ ...s, cree_par: null }))) });
console.log('Planning à jour.');
