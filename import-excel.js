// =====================================================================
// import-excel.js — transforme le planning Excel du coach en séances.
//
// Format attendu (celui du tableur du club) :
//   - une ligne d'en-têtes contenant DUREE, GROUPE, INTENSITE, SEANCE ;
//   - un bloc de ces colonnes par discipline (course à pied, vélo, natation…),
//     côte à côte ; la colonne « Schéma de la séance » est ignorée ;
//   - à gauche, le jour et la date (« Lundi », « 26-oct. ») ;
//   - plusieurs lignes par jour, une par groupe de niveau ; les cellules
//     fusionnées (durée, intensité, séance communes à plusieurs groupes) sont gérées ;
//   - une ligne fusionnée sur toute la largeur (« RÉCUPÉRATION COMPLÈTE… »)
//     devient une séance de récupération pour le jour ;
//   - un onglet par semaine ; l'onglet « Notice » et les autres onglets
//     d'explications (autre format) sont ignorés.
// Le fichier n'est envoyé nulle part : tout se passe dans le navigateur.
// Depuis Google Sheets : Fichier → Télécharger → Microsoft Excel (.xlsx).
// =====================================================================
import { normalise } from './outils.js';
import { lireXlsx } from './lecteur-xlsx.js';

// Discipline de chaque bloc de colonnes, de gauche à droite (ordre fixe du fichier du coach).
export const ORDRE_DISCIPLINES = ['course_a_pied', 'velo', 'natation'];
const MOIS = { jan: 1, fev: 2, mar: 3, avr: 4, mai: 5, juin: 6, juil: 7, aou: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

// Lit le fichier choisi → [{ nom, analyse }] (une entrée par feuille du classeur).
export async function lireFichier(fichier) {
  if (!/\.xlsx$/i.test(fichier.name)) throw new Error('Choisis un fichier .xlsx (depuis Google Sheets : Fichier → Télécharger → Microsoft Excel).');
  const feuilles = await lireXlsx(await fichier.arrayBuffer());
  return feuilles.map((f) => ({ nom: f.nom, analyse: analyserFeuille(f.grille, f.fusions) }));
}

const texte = (v) => (v === null || v === undefined ? '' : String(v).replace(/\r/g, '').trim());
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Une cellule de date → 'AAAA-MM-JJ' ou null. Excel range les dates en nombre de jours depuis le 30/12/1899.
function lireDate(v) {
  if (typeof v === 'number') {
    if (v < 30000 || v > 80000) return null;
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10);
  }
  const s = normalise(v);
  let m = s.match(/^(?:[a-z]+ )?(\d{1,2}) (\d{1,2})(?: (\d{2,4}))?$/);           // 26/10, 26-10-2026
  if (m) return dateSansAnnee(+m[1], +m[2], m[3]);
  m = s.match(/^(?:[a-z]+ )?(\d{1,2}) ([a-z]+)(?: (\d{2,4}))?$/);                 // 26-oct., lundi 26 octobre
  if (m) {
    const cle = Object.keys(MOIS).find((k) => m[2].startsWith(k));
    if (cle) return dateSansAnnee(+m[1], MOIS[cle], m[3]);
  }
  return null;
}

// Sans année : celle qui place la date le plus près d'aujourd'hui.
function dateSansAnnee(jour, mois, annee) {
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31) return null;
  if (annee) return iso(new Date(annee.length === 2 ? 2000 + +annee : +annee, mois - 1, jour));
  const auj = new Date();
  const candidates = [-1, 0, 1].map((k) => new Date(auj.getFullYear() + k, mois - 1, jour));
  candidates.sort((a, b) => Math.abs(a - auj) - Math.abs(b - auj));
  return iso(candidates[0]);
}

// Durée : texte (« 1h00 », « 50m ») ou heure Excel (fraction de jour) → texte lisible ; « NA » → vide.
function lireDuree(v) {
  if (typeof v === 'number' && v > 0 && v < 1) {
    const min = Math.round(v * 1440);
    return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
  }
  const s = texte(v);
  return /^n\/?a$/i.test(s) ? '' : s;
}

function lireIntensite(v) {
  const s = normalise(v);
  return ['vert', 'jaune', 'orange', 'rouge'].find((k) => s.startsWith(k)) ?? (s || null);
}

// grille : [[valeur…]…] ; fusions : [{ r0, c0, r1, c1 }]
export function analyserFeuille(grilleBrute, fusions = []) {
  const lignes = grilleBrute.length;
  let colonnes = 0;
  for (let r = 0; r < lignes; r++) colonnes = Math.max(colonnes, grilleBrute[r]?.length ?? 0);
  if (!lignes || !colonnes) return { ok: false, erreur: 'Feuille vide.' };

  // 1. Grille complète, cellules fusionnées recopiées dans toute leur zone.
  const grille = Array.from({ length: lignes }, (_, r) => Array.from({ length: colonnes }, (_, c) => grilleBrute[r]?.[c] ?? null));
  const largeur = Array.from({ length: lignes }, () => new Array(colonnes).fill(1));
  for (const f of fusions) {
    const v = grille[f.r0]?.[f.c0] ?? null;
    for (let r = f.r0; r <= f.r1 && r < lignes; r++) {
      for (let c = f.c0; c <= f.c1 && c < colonnes; c++) { grille[r][c] = v; largeur[r][c] = f.c1 - f.c0 + 1; }
    }
  }

  // 2. Ligne d'en-têtes et blocs de colonnes (un bloc = une discipline).
  const entete = grille.findIndex((l) => { const n = l.map(normalise); return n.includes('seance') && (n.includes('duree') || n.includes('groupe')); });
  if (entete < 0) return { ok: false, erreur: "Ligne d'en-têtes introuvable (DUREE, GROUPE, INTENSITE, SEANCE)." };
  const noms = grille[entete].map(normalise);
  const debuts = noms.map((n, c) => (n === 'duree' ? c : -1)).filter((c) => c >= 0);
  if (!debuts.length) return { ok: false, erreur: 'Colonne DUREE introuvable.' };
  const blocs = debuts.map((debut, i) => {
    const fin = (debuts[i + 1] ?? colonnes) - 1;
    const col = (nom) => { for (let c = debut; c <= fin; c++) if (noms[c] === nom) return c; return -1; };
    let libelle = '';   // texte éventuel au-dessus des en-têtes (souvent une icône, donc vide)
    for (let r = entete - 1; r >= 0 && !libelle; r--) for (let c = debut; c <= fin && !libelle; c++) libelle = texte(grille[r][c]);
    return { debut, fin, libelle, duree: col('duree'), groupe: col('groupe'), intensite: col('intensite'), seance: col('seance') };
  }).filter((b) => b.seance >= 0);
  if (!blocs.length) return { ok: false, erreur: 'Colonne SEANCE introuvable.' };

  // 3. Colonne des dates : celle, à gauche des blocs, qui contient le plus de dates.
  let colDate = -1, meilleur = 0;
  for (let c = 0; c < blocs[0].debut; c++) {
    let n = 0;
    for (let r = entete + 1; r < lignes; r++) if (lireDate(grille[r][c])) n++;
    if (n > meilleur) { meilleur = n; colDate = c; }
  }
  if (colDate < 0) return { ok: false, erreur: 'Colonne des dates introuvable (ex. « 26-oct. »).' };

  // 4. Lignes regroupées par jour.
  const jours = new Map();
  for (let r = entete + 1; r < lignes; r++) {
    const date = lireDate(grille[r][colDate]);
    if (!date) continue;
    if (!jours.has(date)) jours.set(date, []);
    jours.get(date).push(r);
  }
  if (!jours.size) return { ok: false, erreur: 'Aucune ligne de jour avec une date reconnue.' };

  // 5. Séances de chaque jour, bloc par bloc.
  const seances = [];
  for (const [date, rangs] of jours) {
    const b0 = blocs[0];
    const large = rangs.find((r) => largeur[r][b0.seance] > b0.fin - b0.debut + 1 && texte(grille[r][b0.seance]));
    if (large !== undefined) {   // une ligne fusionnée sur plusieurs disciplines : récupération
      const t = texte(grille[large][b0.seance]);
      seances.push({ date, bloc: -1, titre: t.split('\n')[0].slice(0, 80), contenu: null, groupe: null, duree: null, intensite: null });
      continue;
    }
    // Une cellule fusionnée sur toute la largeur d'un bloc (« RÉCUPÉRATION COMPLÈTE… ») est une
    // note du jour, pas une séance par groupe. Si tous les blocs portent la même note : un seul repos.
    const noteDuBloc = (b) => {
      const r = rangs.find((x) => texte(grille[x][b.seance]) && largeur[x][b.seance] >= b.seance - b.debut + 1);
      return r === undefined ? null : texte(grille[r][b.seance]);
    };
    const notes = blocs.map(noteDuBloc);
    if (notes[0] && notes.every((n) => n === notes[0])) {
      seances.push({ date, bloc: -1, titre: notes[0].split('\n')[0].slice(0, 80), contenu: null, groupe: null, duree: null, intensite: null });
      continue;
    }
    blocs.forEach((b, iBloc) => {
      const paquets = [];   // mêmes durée / intensité / contenu → une séance pour plusieurs groupes
      for (const r of rangs) {
        const contenu = texte(grille[r][b.seance]);
        if (!contenu) continue;
        if (notes[iBloc] === contenu) {   // note sur tout le bloc : ni groupe, ni durée, ni intensité
          if (!paquets.some((x) => x.contenu === contenu)) paquets.push({ duree: '', intensite: null, contenu, groupes: [] });
          continue;
        }
        const l = {
          duree: b.duree >= 0 ? lireDuree(grille[r][b.duree]) : '',
          groupe: b.groupe >= 0 && !/^tous/i.test(texte(grille[r][b.groupe])) ? texte(grille[r][b.groupe]) : '',   // « Tous niveaux » = pas de groupe
          intensite: b.intensite >= 0 ? lireIntensite(grille[r][b.intensite]) : null,
          contenu,
        };
        const p = paquets.find((x) => x.duree === l.duree && x.intensite === l.intensite && x.contenu === l.contenu);
        if (p) { if (l.groupe && !p.groupes.includes(l.groupe)) p.groupes.push(l.groupe); }
        else paquets.push({ ...l, groupes: l.groupe ? [l.groupe] : [] });
      }
      for (const p of paquets) {
        const titre = p.contenu.split('\n').map((x) => x.trim()).find(Boolean) || 'Séance';
        seances.push({
          date, bloc: iBloc,
          titre: titre.slice(0, 80),
          contenu: p.contenu,
          groupe: p.groupes.length ? p.groupes.join(', ') : null,
          duree: p.duree || null,
          intensite: p.intensite,
        });
      }
    });
  }

  const dates = [...jours.keys()].sort();
  const alertes = seances.length ? [] : ['Aucune séance trouvée : vérifie que la colonne SEANCE est remplie.'];
  return { ok: true, blocs, seances, debut: dates[0], fin: dates.at(-1), nbJours: dates.length, alertes };
}

// Feuilles à importer : celles au format planning, sans chevauchement de dates
// (une feuille dont la période recoupe une précédente, ex. une copie, est écartée).
// → { retenues: [{ nom, analyse }], ignorees: [noms], doublons: [{ nom, avec }] }
export function trierFeuilles(feuilles) {
  const retenues = [], ignorees = [], doublons = [];
  for (const f of feuilles) {
    if (/^notice$/i.test(f.nom.trim())) { ignorees.push(f.nom); continue; }   // l'onglet d'explications du coach, toujours écarté
    if (!f.analyse.ok || !f.analyse.seances.length) { ignorees.push(f.nom); continue; }
    const a = f.analyse;
    const recoupe = retenues.find((x) => a.debut <= x.analyse.fin && x.analyse.debut <= a.fin);
    if (recoupe) doublons.push({ nom: f.nom, avec: recoupe.nom });
    else retenues.push(f);
  }
  retenues.sort((x, y) => x.analyse.debut.localeCompare(y.analyse.debut));
  return { retenues, ignorees, doublons };
}

// Séances prêtes à enregistrer (bloc 1 = course à pied, 2 = vélo, 3 = natation).
export function seancesAImporter(analyse) {
  return analyse.seances.map(({ bloc, ...s }) => ({
    ...s,
    discipline: bloc === -1 ? 'repos' : ORDRE_DISCIPLINES[bloc] ?? 'course_a_pied',
    heure: null,
    lieu: null,
  }));
}
