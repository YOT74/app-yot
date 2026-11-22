// =====================================================================
// robot/sauvegarde.mjs — exporte toutes les tables de l'app dans un dossier de fichiers JSON.
// Lancé chaque semaine par GitHub Actions (.github/workflows/sauvegarde.yml), qui chiffre
// ensuite le dossier avec SAUVEGARDE_MOT_DE_PASSE avant de le garder 90 jours.
// Le dépôt étant public, rien n'est jamais conservé en clair.
//
// Utilisation : node robot/sauvegarde.mjs dossier-de-sortie
// Variables d'environnement : SUPABASE_URL, SUPABASE_CLE_SERVICE.
// =====================================================================
import { mkdir, writeFile } from 'node:fs/promises';

const TABLES = ['membres', 'courses', 'participations', 'messages', 'albums', 'seances', 'presences',
  'partenaires', 'actualites', 'votes_sondage', 'notifications'];

const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
const cle = process.env.SUPABASE_CLE_SERVICE;
const sortie = process.argv[2] || 'sauvegarde';
if (!base || !cle) { console.error('SUPABASE_URL et SUPABASE_CLE_SERVICE doivent être définis.'); process.exit(1); }

await mkdir(sortie, { recursive: true });
let total = 0;
for (const table of TABLES) {
  const lignes = [];
  for (let debut = 0; ; debut += 1000) {   // par paquets de 1000 lignes
    const rep = await fetch(`${base}/rest/v1/${table}?select=*`, {
      headers: { apikey: cle, Authorization: `Bearer ${cle}`, Range: `${debut}-${debut + 999}`, 'Range-Unit': 'items' },
    });
    if (!rep.ok && rep.status !== 416) throw new Error(`${table} : Supabase ${rep.status} ${await rep.text()}`);
    const paquet = rep.status === 416 ? [] : await rep.json();
    lignes.push(...paquet);
    if (paquet.length < 1000) break;
  }
  await writeFile(`${sortie}/${table}.json`, JSON.stringify(lignes, null, 1));
  console.log(`${table} : ${lignes.length} lignes`);
  total += lignes.length;
}
await writeFile(`${sortie}/LISEZMOI.txt`, `Sauvegarde de l'app du club, ${new Date().toISOString()}\n${total} lignes au total, une table par fichier JSON.\n`);
console.log(`Sauvegarde terminée : ${total} lignes.`);
