// =====================================================================
// robot/importer.mjs — met à jour la base de courses depuis les sources.
//
// Lancé chaque semaine par GitHub Actions (.github/workflows/courses.yml).
// Pour chaque source : lit les courses à venir, puis les envoie à Supabase.
// Une course déjà connue (même source + même identifiant) est mise à jour,
// jamais dupliquée ; une course qui disparaît de la source n'est pas supprimée
// (des membres ont peut-être déjà un statut dessus).
// Champs mis à jour : nom, date, lieu, département, discipline, format, lien de la
// source. Les champs gérés dans l'app (lien d'inscription, infos, course club…)
// ne sont jamais touchés.
//
// Utilisation :
//   node robot/importer.mjs                    → importe tout dans Supabase
//   node robot/importer.mjs --essai            → affiche sans rien écrire
//   node robot/importer.mjs --essai fftri      → une seule source
//   node robot/importer.mjs --essai --fichier fftri=page.html   → page enregistrée (test hors ligne)
//   node robot/importer.mjs --sortie courses.json  → écrit les courses dans un fichier au lieu de Supabase
// Variables d'environnement (secrets GitHub) : SUPABASE_URL, SUPABASE_CLE_SERVICE.
// =====================================================================
import * as fftri from './sources/fftri.mjs';
import * as ironman from './sources/ironman.mjs';
import * as liste from './sources/liste.mjs';

const SOURCES = { fftri, ironman, liste };

const args = process.argv.slice(2);
const essai = args.includes('--essai');
const fichiers = Object.fromEntries(args.flatMap((a, i) => (args[i - 1] === '--fichier' ? [a.split('=')] : [])));
const choisies = args.filter((a, i) => SOURCES[a] && args[i - 1] !== '--fichier');
const sortie = args[args.indexOf('--sortie') + 1] && args.includes('--sortie') ? args[args.indexOf('--sortie') + 1] : null;
const toutes = [];
const aLire = choisies.length ? choisies : Object.keys(SOURCES);

const aujourdhui = new Date().toISOString().slice(0, 10);

async function envoyer(lignes) {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const cle = process.env.SUPABASE_CLE_SERVICE;
  if (!url || !cle) throw new Error('SUPABASE_URL et SUPABASE_CLE_SERVICE doivent être définis (secrets du dépôt).');
  for (let i = 0; i < lignes.length; i += 200) {
    const paquet = lignes.slice(i, i + 200);
    const rep = await fetch(`${url}/rest/v1/courses?on_conflict=source,source_ref`, {
      method: 'POST',
      headers: {
        apikey: cle,
        Authorization: `Bearer ${cle}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(paquet),
    });
    if (!rep.ok) throw new Error(`Supabase ${rep.status} : ${await rep.text()}`);
  }
}

// Courses de la liste déjà publiées par FFTri ou IRONMAN (même année, nom reconnu par sa « cle ») :
// on ne les envoie plus, et la version estimée est retirée si aucun membre n'y a de statut.
async function dejaAilleurs(lignes) {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const cle = process.env.SUPABASE_CLE_SERVICE;
  if (!url || !cle) return lignes.map(({ cle: _, ...c }) => c);
  const h = { apikey: cle, Authorization: `Bearer ${cle}` };
  const gardees = [];
  for (const { cle: motif, ...c } of lignes) {
    if (motif) {
      // même nom (mot entier, expression régulière) et date à 30 jours près de l'estimation
      const an = c.date_course.slice(0, 4);
      const jour = (n) => new Date(Date.parse(c.date_course) + n * 864e5).toISOString().slice(0, 10);
      const rep = await fetch(`${url}/rest/v1/courses?select=id,nom&source=in.(fftri,ironman)&nom=imatch.${encodeURIComponent(`\\m${motif}\\M`)}&date_course=gte.${jour(-30)}&date_course=lte.${jour(30)}&limit=1`, { headers: h });
      const trouvee = rep.ok ? (await rep.json())[0] : null;
      if (trouvee) {
        console.log(`  ${c.nom} ${an} : publiée par la source officielle (« ${trouvee.nom} »)`);
        const ma = await (await fetch(`${url}/rest/v1/courses?select=id,participations(id)&source=eq.liste&source_ref=eq.${encodeURIComponent(c.source_ref)}`, { headers: h })).json();
        if (ma[0] && !ma[0].participations?.length) {
          await fetch(`${url}/rest/v1/courses?id=eq.${ma[0].id}`, { method: 'DELETE', headers: h });
          console.log('    version estimée retirée');
        } else if (ma[0]) console.log('    version estimée gardée : des membres y ont un statut (à fusionner dans l’espace bureau)');
        continue;
      }
    }
    gardees.push(c);
  }
  return gardees;
}

let erreurs = 0;
for (const nom of aLire) {
  try {
    console.log(`${nom} : lecture…`);
    const lues = await SOURCES[nom].lire({ fichier: fichiers[nom] });
    process.stdout.write('\n');
    let lignes = lues
      .filter((c) => c.date_course >= aujourdhui)
      .map((c) => ({ ...c, validee: true }));   // les courses importées n'ont pas à être validées
    if (nom === 'liste') lignes = await dejaAilleurs(lignes);
    console.log(`${nom} : ${lues.length} lues, ${lignes.length} à venir`);
    if (essai) {
      for (const c of lignes.slice(0, 15)) console.log(`  ${c.date_course}${c.date_a_confirmer ? '?' : ' '} ${c.nom}  · ${c.discipline} ${c.format ?? ''} · ${c.lieu ?? ''}${c.departement ? ` (${c.departement})` : ''}`);
      if (lignes.length > 15) console.log(`  … et ${lignes.length - 15} autres`);
    } else if (sortie) {
      toutes.push(...lignes);
    } else if (lignes.length) {
      await envoyer(lignes);
      console.log(`${nom} : envoyées à Supabase`);
    }
  } catch (e) {
    erreurs++;
    console.error(`${nom} : ÉCHEC — ${e.message}`);
  }
}
if (sortie) {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(sortie, JSON.stringify(toutes, null, 1));
  console.log(`${toutes.length} courses écrites dans ${sortie}`);
}
// Une source en échec fait échouer le workflow : GitHub prévient par email.
process.exit(erreurs ? 1 : 0);
