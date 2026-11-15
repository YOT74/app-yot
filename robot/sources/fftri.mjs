// =====================================================================
// robot/sources/fftri.mjs — calendrier FFTri (fftri.t2area.com/calendrier.html).
//
// La page liste 10 épreuves à la fois (?limitstart=0, 10, 20…), une carte
// <article class="compact-event-card"> par épreuve : date (« 22 NOV. 2026 »),
// nom (<h3>), lieu (« VILLE · CODE POSTAL »), statut (« J-7 », « Annulée »),
// formats (« TRI - M », « B&R - J-1-EQ »…) et lien vers la page de l'épreuve.
// Le nombre total d'épreuves est dans `var totalItems = N`.
// (Le tableau `mapEvents` de la carte ne sert qu'en secours : il oublie les
// épreuves sans coordonnées GPS.)
// Si la FFTri change sa page, c'est ici qu'il faut adapter.
// =====================================================================
import { page, pause, texte, dateFr, casse, departement } from '../outils.mjs';

const BASE = 'https://fftri.t2area.com/calendrier.html';
const PAR_PAGE = 10;
const PAGES_MAX = 120;   // garde-fou

// Préfixe du format FFTri → discipline de l'app (config.js → DISCIPLINES).
// Le premier motif qui correspond l'emporte ; à compléter si un nouveau code apparaît.
const DISCIPLINES = [
  [/^B&R|BIKE/, 'bike_and_run'],
  [/AQUA/, 'aquathlon'],
  [/SWIM ?RUN|^S&R|^SR\b|^SWR/, 'swimrun'],
  [/DUA/, 'duathlon'],
  [/RAID/, null],          // raids : pas une discipline de l'app → épreuve ignorée
  [/TRI/, 'triathlon'],
];
// Si le code n'est pas reconnu : d'après le nom de l'épreuve.
// (ordre important : « Bike and Run du Triathlon Club X » est un bike and run)
const PAR_NOM = [
  [/bike\s*(and|&|et)\s*run/i, 'bike_and_run'],
  [/aquathlon/i, 'aquathlon'],
  [/swim\s*run/i, 'swimrun'],
  [/duathlon/i, 'duathlon'],
  [/\braid\b/i, null],
  [/triathlon/i, 'triathlon'],
];

function discipline(formats, nom) {
  // 1. le nom de l'épreuve, quand il dit la discipline (« Aquathlon Indoor Vittel »)
  const parNom = PAR_NOM.find(([re]) => re.test(nom));
  if (parNom) return parNom[1];
  // 2. sinon, la discipline la plus fréquente parmi les codes de format
  const comptes = new Map();
  for (const f of formats) {
    const prefixe = f.split(' - ')[0].trim().toUpperCase();
    const trouve = DISCIPLINES.find(([re]) => re.test(prefixe));
    if (trouve) comptes.set(trouve[1], (comptes.get(trouve[1]) ?? 0) + 1);
  }
  const meilleure = [...comptes.entries()].sort((a, b) => b[1] - a[1])[0];
  return meilleure ? meilleure[0] : 'triathlon';
}

// « TRI - M », « B&R - XS-OP-EQ », « B&R - S-J-EQ » → distances adultes : « M », « XS »…
// (OP = open, EQ = équipe, J = jeunes ; les épreuves jeunes sont écartées s'il y a des adultes).
function format(formats) {
  const codes = formats.map((f) => f.split(' - ').slice(1).join(' - ').trim().toUpperCase()).filter(Boolean);
  const jeunes = (c) => /(^|-)J(-|\d|$)|JEUNE/.test(c);
  const retenus = codes.some((c) => !jeunes(c)) ? codes.filter((c) => !jeunes(c)) : codes;
  return [...new Set(retenus.map((c) => c.split('-')[0]))].join(', ').slice(0, 40) || null;
}

// Cartes d'épreuves d'une page → [{ name, date, location, status, formats, url }].
export function lireCartes(html) {
  return html.split('<article class="compact-event-card"').slice(1).map((c) => ({
    name: texte(c.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1]),
    date: texte(c.match(/compact-event-card__date">([^<]+)</)?.[1]),
    location: texte(c.match(/compact-event-card__location">([^<]+)</)?.[1]),
    status: texte(c.match(/compact-event-card__status[^"]*">([^<]*)</)?.[1]),
    formats: [...c.matchAll(/class="format-badge">([^<]+)</g)].map((m) => texte(m[1])),
    url: c.match(/href="(https:\/\/fftri\.t2area\.com\/calendrier\/[^"]+)"/)?.[1] ?? null,
  })).filter((e) => e.name && e.url);
}

function lireMapEvents(html) {
  const m = html.match(/var\s+mapEvents\s*=\s*(\[[\s\S]*?\]);\s*\n/);
  return m ? JSON.parse(m[1]) : [];
}

// Une épreuve FFTri → une ligne de la table courses.
export function versCourse(e) {
  const date = dateFr(e.date);
  if (!date || !e.url) return null;
  if (/annul/i.test(e.status ?? '')) return null;   // épreuve annulée : on ne l'importe pas
  const [ville, cp] = String(e.location ?? '').split('·').map((x) => x.trim());
  const formats = Array.isArray(e.formats) ? e.formats : [];
  const disc = discipline(formats, e.name);
  if (!disc) return null;   // discipline absente de l'app (raid…) : épreuve ignorée
  return {
    nom: String(e.name).replace(/\s*\((\d{2,3}|2A|2B)\)\s*$/i, '').trim(),   // « … (74) » : le département est déjà dans sa colonne
    date_course: date,
    lieu: ville ? casse(ville) : null,
    departement: departement(cp),
    discipline: disc,
    format: format(formats),
    source: 'fftri',
    source_ref: e.url.replace(/^.*\/calendrier\//, '').replace(/\.html$/, ''),
    url_source: e.url,
  };
}

export async function lire({ fichier } = {}) {
  const vues = new Map();
  let total = Infinity;
  for (let n = 0, debut = 0; debut < total && n < PAGES_MAX; n++, debut += PAR_PAGE) {
    const html = await page(debut ? `${BASE}?limitstart=${debut}` : BASE, { fichier });
    const t = html.match(/var\s+totalItems\s*=\s*(\d+)/);
    if (t) total = Number(t[1]);
    let evenements = lireCartes(html);
    if (!evenements.length) evenements = lireMapEvents(html);
    if (!evenements.length && !n) throw new Error('FFTri : aucune épreuve trouvée sur la page, elle a changé.');
    let nouveaux = 0;
    for (const e of evenements) if (e.url && !vues.has(e.url)) { vues.set(e.url, e); nouveaux++; }
    process.stdout.write(`\r  ${vues.size} épreuves lues${Number.isFinite(total) ? ` sur ${total}` : ''}   `);
    if (fichier || (!nouveaux && !Number.isFinite(total))) break;   // fichier enregistré = une seule page
    await pause(1500);
  }
  const toutes = [...vues.values()];
  const courses = toutes.map(versCourse).filter(Boolean);
  const annulees = toutes.filter((e) => /annul/i.test(e.status ?? ''));
  const sansDate = toutes.filter((e) => !dateFr(e.date));
  const raids = toutes.length - courses.length - annulees.length - sansDate.length;
  // (le site liste une épreuve par jour de course : une épreuve sur deux jours compte deux fois dans le total annoncé)
  console.log(`\n  ${toutes.length} épreuves différentes sur la FFTri ; écartées : ${annulees.length} annulées, ${raids} raids, ${sansDate.length} sans date lisible`);
  for (const e of sansDate.slice(0, 5)) console.log(`    date illisible : « ${e.date} » — ${e.name}`);
  return courses;
}
