// =====================================================================
// lecteur-xlsx.js — lit un fichier .xlsx sans bibliothèque extérieure.
// Un .xlsx est une archive zip de fichiers XML : on la décompresse avec
// l'outil intégré au navigateur (DecompressionStream), puis on lit les
// cellules et les fusions de chaque feuille.
// Renvoie [{ nom, grille: [[valeur…]…], fusions: [{ r0, c0, r1, c1 }] }]
// (lignes et colonnes numérotées à partir de 0, A1 = [0][0]).
// =====================================================================

const decodeur = new TextDecoder('utf-8');

// --- Archive zip -------------------------------------------------------------

function lireZip(octets) {
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  // fin du répertoire central (signature 0x06054b50), cherchée depuis la fin
  let fin = -1;
  for (let i = octets.length - 22; i >= Math.max(0, octets.length - 65558); i--) {
    if (vue.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error("Ce fichier n'est pas un .xlsx valide.");
  const nb = vue.getUint16(fin + 10, true);
  let p = vue.getUint32(fin + 16, true);
  const fichiers = new Map();
  for (let i = 0; i < nb; i++) {
    if (vue.getUint32(p, true) !== 0x02014b50) break;
    const methode = vue.getUint16(p + 10, true);
    const taille = vue.getUint32(p + 20, true);
    const lgNom = vue.getUint16(p + 28, true), lgExtra = vue.getUint16(p + 30, true), lgCom = vue.getUint16(p + 32, true);
    const local = vue.getUint32(p + 42, true);
    const nom = decodeur.decode(octets.subarray(p + 46, p + 46 + lgNom));
    fichiers.set(nom, { methode, taille, local });
    p += 46 + lgNom + lgExtra + lgCom;
  }
  return { vue, octets, fichiers };
}

async function extraire(zip, nom) {
  const f = zip.fichiers.get(nom);
  if (!f) return null;
  const debut = f.local + 30 + zip.vue.getUint16(f.local + 26, true) + zip.vue.getUint16(f.local + 28, true);
  const donnees = zip.octets.subarray(debut, debut + f.taille);
  if (f.methode === 0) return decodeur.decode(donnees);
  if (f.methode !== 8) throw new Error('Compression non prise en charge dans ce fichier.');
  const flux = new Blob([donnees]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return decodeur.decode(await new Response(flux).arrayBuffer());
}

// --- XML ---------------------------------------------------------------------

const entites = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decoder = (s) => s
  .replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => entites[e])
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d));
const attribut = (attrs, nom) => attrs.match(new RegExp(`(?:^|\\s)${nom}="([^"]*)"`))?.[1] ?? null;
// texte de toutes les balises <t> d'un fragment (texte enrichi compris)
const texteT = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decoder(m[1])).join('');

// 'B12' → { r: 11, c: 1 }
function position(ref) {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  let c = 0;
  for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
  return { r: +m[2] - 1, c: c - 1 };
}

// --- Lecture ---------------------------------------------------------------------

export async function lireXlsx(arrayBuffer) {
  const zip = lireZip(new Uint8Array(arrayBuffer));
  const classeur = await extraire(zip, 'xl/workbook.xml');
  if (!classeur) throw new Error("Ce fichier n'est pas un classeur Excel (.xlsx).");
  const liens = (await extraire(zip, 'xl/_rels/workbook.xml.rels')) || '';
  const cibles = new Map([...liens.matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => [attribut(m[1], 'Id'), attribut(m[1], 'Target')]));
  const partages = [...((await extraire(zip, 'xl/sharedStrings.xml')) || '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texteT(m[1]));

  const feuilles = [];
  for (const m of classeur.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const nom = decoder(attribut(m[1], 'name') || 'Feuille');
    let cible = cibles.get(attribut(m[1], 'r:id')) || '';
    cible = cible.startsWith('/') ? cible.slice(1) : `xl/${cible}`;
    const xml = await extraire(zip, cible);
    if (!xml) continue;
    const grille = [];
    for (const c of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attribut(c[1], 'r');
      if (!ref) continue;
      const type = attribut(c[1], 't');
      const contenu = c[2] || '';
      const v = contenu.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let valeur = null;
      if (type === 's') valeur = v !== undefined ? partages[+v] ?? null : null;
      else if (type === 'inlineStr') valeur = texteT(contenu);
      else if (type === 'str' || type === 'e') valeur = v !== undefined ? decoder(v) : null;
      else if (type === 'b') valeur = v === '1';
      else if (v !== undefined) valeur = Number(v);
      if (valeur === null || valeur === '') continue;
      const { r, c: col } = position(ref);
      (grille[r] ??= [])[col] = valeur;
    }
    const fusions = [...xml.matchAll(/<mergeCell\b[^>]*ref="([A-Z]+\d+):([A-Z]+\d+)"/g)].map((f) => {
      const a = position(f[1]), b = position(f[2]);
      return { r0: a.r, c0: a.c, r1: b.r, c1: b.c };
    });
    feuilles.push({ nom, grille, fusions });
  }
  return feuilles;
}
