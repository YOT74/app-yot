// =====================================================================
// ecrans/entrainement.js — planning de la semaine, séance, import Excel.
// =====================================================================
import { DISCIPLINES_SEANCE, INTENSITES, SANS_PRESENCE, NIVEAUX } from '../config.js';
import { etat, estCoach, membre, nomMembre, groupeActif, sansGroupe } from '../etat.js';
import { menuAdmin } from './communs.js';
import { esc, icone, aujourdhui, ajouterJours, lundiDe, jourSemaine, jourMois, jourMoisCourt, dateLongue } from '../outils.js';
import { entete, retour } from './communs.js';
import { ORDRE_DISCIPLINES } from '../import-excel.js';

// groupes de niveau connus : « 3-6, 7-10 » compte pour deux groupes ; « Tous niveaux » n'en est pas un
const groupesDe = (s) => (sansGroupe(s.groupe) ? [] : s.groupe.split(',').map((g) => g.trim()).filter((g) => g && !sansGroupe(g)));
export const groupesConnus = () =>
  [...new Set(etat.seances.flatMap(groupesDe))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));

// « Mes séances » : celles de mon groupe d'heures (3-6, 7-10, 11-15) et celles de mon niveau
// en course à pied ou en vélo (1, 2, 3, attribué par le coach). Une séance sans groupe est pour tous.
// Si le coach ne m'a pas encore donné de niveau, les séances par niveau de cette discipline restent affichées.
const monNiveau = (s) => (s.discipline === 'course_a_pied' ? etat.moi.niveau_cap : s.discipline === 'velo' ? etat.moi.niveau_velo : null);
const filtreActif = () => etat.groupe !== 'tous' && !!(etat.moi.groupe || etat.moi.niveau_cap || etat.moi.niveau_velo);
// toujours = true : on filtre sur mes groupes même si « Toutes les séances » est choisi (accueil)
export const seanceDuGroupe = (s, toujours = false) => {
  const gs = groupesDe(s);
  const actif = toujours ? !!(etat.moi.groupe || etat.moi.niveau_cap || etat.moi.niveau_velo) : filtreActif();
  if (!actif || !gs.length) return true;
  if (gs.includes(etat.moi.groupe) || (monNiveau(s) && gs.includes(monNiveau(s)))) return true;
  return !monNiveau(s) && gs.every((g) => NIVEAUX.includes(g));
};

// « 7-10 » → « Groupe 7-10 h », un nom (« Loisir ») reste tel quel
export const libelleGroupe = (g) => (/^\d+-\d+$/.test(g) ? `Groupe ${g} h` : /^\d+$/.test(g) ? `Niveau ${g}` : g);
const libelleGroupes = (txt) => (sansGroupe(txt) ? 'Tous niveaux' : txt.split(',').map((g) => libelleGroupe(g.trim())).join(', '));

// Couleur de chaque discipline dans la vue graphique.
const COULEUR_DISCIPLINE = { natation: 'var(--d-natation)', velo: 'var(--d-velo)', course_a_pied: 'var(--d-cap)', renfo: 'var(--d-renfo)', repos: 'var(--d-repos)' };
const INITIALE = { natation: 'N', velo: 'V', course_a_pied: 'C', renfo: 'R', repos: '·' };

// « 1h15 », « 50m », « 45 min », « 1h » → minutes (null si illisible)
export function minutes(duree) {
  const t = String(duree ?? '').toLowerCase().replace(/\s/g, '');
  const m = t.match(/^(?:(\d+)h)?(\d+)?(?:m|min)?$/);
  if (!t || !m || (!m[1] && !m[2])) return null;
  return (Number(m[1] ?? 0) * 60) + Number(m[2] ?? 0);
}
const enHeures = (min) => (min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min} min`);

export function pastilleIntensite(cle) {
  if (!cle) return '';
  const i = INTENSITES[cle];
  return `<span class="intensite" style="--couleur:${i?.couleur ?? '#888'}">${esc(i?.libelle ?? cle)}</span>`;
}

// « Je viens » / « Je ne viens pas » : qui sera là, qui a prévenu de son absence.
function blocPresence(s) {
  const reponses = s.presences ?? [];
  const ma = reponses.find((x) => x.membre_id === etat.moi.id);
  const nom = (id) => (id === etat.moi.id ? 'toi' : membre(id)?.prenom ?? '?');
  const oui = reponses.filter((x) => x.vient !== false).map((x) => nom(x.membre_id));
  const non = reponses.filter((x) => x.vient === false).map((x) => nom(x.membre_id));
  const passee = s.date < aujourdhui();
  const lignes = [];
  if (oui.length) lignes.push(`${oui.length} ${passee ? (oui.length > 1 ? 'étaient là' : 'était là') : (oui.length > 1 ? 'viennent' : 'vient')} : ${oui.join(', ')}`);
  if (non.length) lignes.push(`${non.length} ${passee ? 'absent' + (non.length > 1 ? 's' : '') : (non.length > 1 ? 'ne viennent pas' : 'ne vient pas')} : ${non.join(', ')}`);
  const bouton = (vient, libelle, classe) => `<button type="button" data-action="presence" data-id="${esc(s.id)}" data-valeur="${vient}" aria-pressed="${ma?.vient === vient}" class="${classe}">${libelle}</button>`;
  return `<div class="presence">
    ${passee ? '' : `<div class="choix-presence" role="group" aria-label="Ma présence">${bouton(true, 'Je viens', 'oui')}${bouton(false, 'Je ne viens pas', 'non')}</div>`}
    ${lignes.map((l) => `<span class="aide">${esc(l)}</span>`).join('')}
  </div>`;
}

function carteSeance(s) {
  if (s.discipline === 'repos') return `<article class="seance repos"><h3>${esc(s.titre)}</h3></article>`;
  return `
    <article class="seance">
      <div class="seance-haut">
        <span class="etiquette">${esc(s.heure ?? '')}${s.heure ? ' · ' : ''}${esc(DISCIPLINES_SEANCE[s.discipline] ?? s.discipline)}</span>
        ${pastilleIntensite(s.intensite)}
        ${s.duree ? `<span class="duree">${esc(s.duree)}</span>` : ''}
      </div>
      <h3>${esc(s.titre)}</h3>
      ${s.groupe ? `<p class="aide" style="margin:0">${esc(libelleGroupes(s.groupe))}</p>` : ''}
      ${s.contenu && s.contenu !== s.titre ? `<p class="texte-libre seance-contenu">${esc(s.contenu)}</p>` : ''}
      ${s.lieu ? `<p class="aide" style="margin:0">${esc(s.lieu)}</p>` : ''}
      ${SANS_PRESENCE.includes(s.discipline) ? '' : blocPresence(s)}
      <div class="outils-seance">
        ${estCoach() ? menuAdmin([[`#/seance/${esc(s.id)}`, 'Modifier'], ['supprimer-seance', 'Supprimer', s.id]]) : ''}
      </div>
    </article>`;
}

// Vue graphique : la semaine en 7 colonnes, un bloc coloré par séance (touche = détail).
function vueGraphique(jours) {
  const duJour = (j) => etat.seances.filter((s) => s.date === j && seanceDuGroupe(s) && s.discipline !== 'repos')
    .sort((a, b) => (a.heure || '').localeCompare(b.heure || ''));
  const total = {};
  for (const j of jours) for (const s of duJour(j)) { const m = minutes(s.duree); if (m) total[s.discipline] = (total[s.discipline] ?? 0) + m; }
  const volume = Object.entries(total);
  return `
    ${volume.length ? `<div class="volume-semaine">${volume.map(([d, m]) => `<span style="--c:${COULEUR_DISCIPLINE[d] ?? 'var(--doux)'}"><i></i>${esc(DISCIPLINES_SEANCE[d] ?? d)} ${enHeures(m)}</span>`).join('')}
      <strong>Total ${enHeures(volume.reduce((n, [, m]) => n + m, 0))}</strong></div>` : ''}
    <div class="grille-semaine">
      ${jours.map((j) => {
        const liste = duJour(j);
        const repos = etat.seances.some((s) => s.date === j && s.discipline === 'repos' && seanceDuGroupe(s));
        return `<div class="col-jour${j === aujourdhui() ? ' aujourdhui' : ''}">
          <div class="col-tete"><span>${esc(jourSemaine(j).slice(0, 3))}</span><strong>${esc(j.slice(8, 10))}</strong></div>
          ${liste.map((s) => {
            const ma = SANS_PRESENCE.includes(s.discipline) ? null : (s.presences ?? []).find((x) => x.membre_id === etat.moi.id);
            return `<button type="button" class="bloc-seance" data-action="voir-seance" data-id="${esc(s.id)}" style="--c:${COULEUR_DISCIPLINE[s.discipline] ?? 'var(--doux)'}">
              <span class="bloc-haut"><b>${INITIALE[s.discipline] ?? '•'}</b>${s.intensite ? `<i class="pt" style="--i:${INTENSITES[s.intensite]?.couleur ?? '#888'}"></i>` : ''}${ma ? `<em>${ma.vient === false ? '✗' : '✓'}</em>` : ''}</span>
              ${s.heure ? `<span class="bloc-heure">${esc(s.heure)}</span>` : ''}
              <span class="bloc-titre">${esc(s.titre)}</span>
              ${s.duree ? `<span class="bloc-duree">${esc(s.duree)}</span>` : ''}
            </button>`;
          }).join('') || `<span class="col-vide">${repos ? 'Récup' : '—'}</span>`}
        </div>`;
      }).join('')}
    </div>
    <p class="aide">✓ présent · ✗ absent</p>`;
}

// Détail d'une séance (vue graphique) dans la feuille du bas.
export function detailSeance(id) {
  const s = etat.seances.find((x) => x.id === id);
  return s ? `<div class="feuille-corps"><span class="etiquette">${esc(dateLongue(s.date))}</span>${carteSeance(s)}
    <button class="bouton contour" type="button" data-action="fermer-feuille">Fermer</button></div>` : '';
}

export function ecranEntrainement() {
  const debut = etat.semaine || lundiDe(aujourdhui());
  const fin = ajouterJours(debut, 6);
  const jours = Array.from({ length: 7 }, (_, i) => ajouterJours(debut, i));
  const monGroupe = etat.moi.groupe;
  const graphique = etat.vuePlanning === 'graphique';
  const coach = etat.membres.find((m) => m.role === 'coach' && m.actif);
  const nb = etat.seances.filter((s) => s.date >= debut && s.date <= fin && s.discipline !== 'repos' && seanceDuGroupe(s)).length;

  return `
    ${entete('Entraînement', `<span class="etiquette">${nb} séance${nb > 1 ? 's' : ''}</span>`)}
    ${coach ? `<p class="sous-titre">Planning de ${esc(coach.prenom)} ${esc(coach.nom)}</p>` : ''}
    <div class="barre-semaine" role="group" aria-label="Semaine">
      <button class="bouton-icone" type="button" data-action="semaine" data-valeur="${ajouterJours(debut, -7)}" aria-label="Semaine précédente">${icone.precedent}</button>
      <div class="barre-semaine-titre">
        <strong>${esc(jourMois(debut))} – ${esc(jourMois(fin))}</strong>
        ${debut === lundiDe(aujourdhui()) ? '<span>Cette semaine</span>'
          : `<button type="button" class="lien-discret" data-action="semaine" data-valeur="${lundiDe(aujourdhui())}">Revenir à cette semaine</button>`}
      </div>
      <button class="bouton-icone" type="button" data-action="semaine" data-valeur="${ajouterJours(debut, 7)}" aria-label="Semaine suivante">${icone.suivant}</button>
    </div>
    <div class="outils-planning">
      ${monGroupe || etat.moi.niveau_cap || etat.moi.niveau_velo ? `<div class="segments compact" role="group" aria-label="Séances affichées">
        <button type="button" data-action="filtre-groupe" data-valeur="" aria-pressed="${etat.groupe !== 'tous'}">Mes séances</button>
        <button type="button" data-action="filtre-groupe" data-valeur="tous" aria-pressed="${etat.groupe === 'tous'}">Toutes</button>
      </div>` : '<span></span>'}
      <div class="segments compact icones" role="group" aria-label="Affichage">
        <button type="button" data-action="vue-planning" data-valeur="texte" aria-pressed="${!graphique}" aria-label="Vue liste" title="Liste">${icone.liste}</button>
        <button type="button" data-action="vue-planning" data-valeur="graphique" aria-pressed="${graphique}" aria-label="Vue semaine" title="Semaine">${icone.grille}</button>
      </div>
    </div>
    ${!monGroupe ? '<p class="aide" style="margin:0">Renseigne ton volume d’entraînement hebdomadaire dans <a href="#/compte">Mon compte</a> pour afficher ton groupe.</p>' : ''}
    ${estCoach() ? `<div class="rangee">
      <a class="bouton petit discret" href="#/seance/nouvelle/${debut}">${icone.ajouter} Séance</a>
      <a class="bouton petit discret" href="#/import-planning">Importer un fichier Excel</a></div>` : ''}
    ${graphique ? vueGraphique(jours) : `<div class="semaine">
      ${jours.map((j) => {
        const duJour = etat.seances.filter((s) => s.date === j && seanceDuGroupe(s)).sort((a, b) => (a.heure || '').localeCompare(b.heure || ''));
        return `
          <section class="jour${j === aujourdhui() ? ' aujourdhui' : ''}">
            <div class="jour-entete">
              <span class="jour-nom">${esc(jourSemaine(j))}</span>
              <span class="etiquette">${esc(jourMoisCourt(j))}</span>
              ${estCoach() ? `<a class="lien-mini" href="#/seance/nouvelle/${j}">+ Séance</a>` : ''}
            </div>
            ${duJour.length ? duJour.map(carteSeance).join('') : '<p class="jour-vide">Repos</p>'}
          </section>`;
      }).join('')}
    </div>`}
`;
}

export function ecranFormulaireSeance(id, dateProposee) {
  const s = id ? etat.seances.find((x) => x.id === id) : null;
  if (id && !s) return `${retour('#/entrainement', 'Entraînement')}<p class="vide">Cette séance n'existe plus.</p>`;
  const v = (k) => esc(s?.[k] ?? '');
  return `
    ${retour('#/entrainement', 'Entraînement')}
    <h1 class="fiche-titre">${s ? 'Modifier la séance' : 'Nouvelle séance'}</h1>
    <form data-form="seance" data-id="${esc(s?.id ?? '')}">
      <div class="deux">
        <div class="champ"><label for="date">Date</label><input id="date" name="date" type="date" required value="${esc(s?.date ?? dateProposee ?? aujourdhui())}"></div>
        <div class="champ"><label for="heure">Heure</label><input id="heure" name="heure" type="time" value="${v('heure')}"></div>
      </div>
      <div class="deux">
        <div class="champ"><label for="discipline">Discipline</label><select id="discipline" name="discipline">
          ${Object.entries(DISCIPLINES_SEANCE).map(([k, n]) => `<option value="${k}" ${(s?.discipline ?? 'course_a_pied') === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
        <div class="champ"><label for="groupe">Groupe de niveau</label><input id="groupe" name="groupe" list="groupes" value="${v('groupe')}" placeholder="vide = tous">
          <datalist id="groupes">${groupesConnus().map((g) => `<option value="${esc(g)}"></option>`).join('')}</datalist></div>
      </div>
      <div class="deux">
        <div class="champ"><label for="duree">Durée</label><input id="duree" name="duree" value="${v('duree')}" placeholder="1h00, 50m…"></div>
        <div class="champ"><label for="intensite">Intensité</label><select id="intensite" name="intensite"><option value="">—</option>
          ${Object.entries(INTENSITES).map(([k, i]) => `<option value="${k}" ${s?.intensite === k ? 'selected' : ''}>${esc(i.libelle)}</option>`).join('')}</select></div>
      </div>
      <div class="champ"><label for="titre">Titre</label><input id="titre" name="titre" required maxlength="80" value="${v('titre')}" placeholder="ex. Fractionné 500 m"></div>
      <div class="champ"><label for="contenu">Contenu</label><textarea id="contenu" name="contenu" rows="6" placeholder="Échauffement, corps de séance, retour au calme…">${v('contenu')}</textarea></div>
      <div class="champ"><label for="lieu">Lieu</label><input id="lieu" name="lieu" maxlength="80" value="${v('lieu')}"></div>
      <button class="bouton large" type="submit">${s ? 'Enregistrer' : 'Ajouter la séance'}</button>
    </form>`;
}

// --- Import du fichier Excel du coach -------------------------------------------
export function ecranImport() {
  const imp = etat.importExcel;
  const intro = `
    ${retour('#/entrainement', 'Entraînement')}
    <h1 class="fiche-titre">Importer le planning</h1>
    <p class="aide" style="margin:0">Fichier .xlsx comportant un onglet par semaine. Les séances importées remplacent celles déjà saisies sur la même période.</p>
    <div class="champ"><label for="fichier-planning">Fichier</label><input id="fichier-planning" type="file" accept=".xlsx" data-action="choisir-fichier"></div>`;
  if (!imp) return intro;
  if (imp.chargement) return `${intro}<p class="chargement">Lecture du fichier…</p>`;
  if (imp.erreur) return `${intro}<p class="erreur">${esc(imp.erreur)}</p>`;

  const { retenues, ignorees, doublons } = imp.tri;
  if (!retenues.length) {
    const raisons = imp.feuilles.filter((f) => !f.analyse.ok).map((f) => `<li>${esc(f.nom)} : ${esc(f.analyse.erreur)}</li>`).join('');
    return `${intro}<p class="erreur">Aucun onglet au format planning dans ce fichier.</p>${raisons ? `<ul class="aide">${raisons}</ul>` : ''}`;
  }
  const choisies = retenues.filter((f) => imp.cochees.includes(f.nom));
  const nb = (a) => a.seances.filter((s) => s.bloc !== -1).length;
  const total = choisies.reduce((n, f) => n + nb(f.analyse), 0);
  const existantes = etat.seances.filter((s) => choisies.some((f) => s.date >= f.analyse.debut && s.date <= f.analyse.fin)).length;

  const apercu = (a) => {
    const parJour = new Map();
    a.seances.forEach((s) => { if (!parJour.has(s.date)) parJour.set(s.date, []); parJour.get(s.date).push(s); });
    return [...parJour.entries()].map(([date, liste]) => `
      <div class="apercu-jour">
        <strong>${esc(dateLongue(date))}</strong>
        ${liste.map((s) => `<div class="apercu-seance">
          ${s.bloc === -1 ? `<em>${esc(s.titre)}</em>` : `<span class="etiquette">${esc(DISCIPLINES_SEANCE[ORDRE_DISCIPLINES[s.bloc]] ?? '')}</span> ${pastilleIntensite(s.intensite)} ${s.duree ? `<span class="duree">${esc(s.duree)}</span>` : ''}
          <br><strong>${esc(s.titre)}</strong>${s.groupe ? ` · ${esc(libelleGroupes(s.groupe))}` : ''}`}
        </div>`).join('')}
      </div>`).join('');
  };

  return `${intro}
    <section class="bloc">
      <h2>Semaines trouvées · ${retenues.length}</h2>
      ${retenues.map((f) => `
        <div class="semaine-import">
          <label class="champ-case"><input type="checkbox" data-action="cocher-feuille" data-valeur="${esc(f.nom)}" ${imp.cochees.includes(f.nom) ? 'checked' : ''}>
            <span><strong>${esc(f.nom)}</strong> · du ${esc(jourMois(f.analyse.debut))} au ${esc(jourMois(f.analyse.fin))} · ${nb(f.analyse)} séance${nb(f.analyse) > 1 ? 's' : ''}</span></label>
          ${f.analyse.alertes.map((x) => `<p class="erreur">${esc(x)}</p>`).join('')}
          <details><summary>Voir le détail</summary>${apercu(f.analyse)}</details>
        </div>`).join('')}
      ${ignorees.length ? `<p class="aide" style="margin:0">Onglets ignorés : ${ignorees.map(esc).join(', ')}.</p>` : ''}
      ${doublons.map((d) => `<p class="avertissement">« ${esc(d.nom)} » couvre les mêmes dates que « ${esc(d.avec)} » : ignoré.</p>`).join('')}
    </section>
    ${existantes ? `<p class="avertissement">${existantes} séance${existantes > 1 ? 's' : ''} déjà saisie${existantes > 1 ? 's' : ''} sur ces semaines ser${existantes > 1 ? 'ont' : 'a'} remplacée${existantes > 1 ? 's' : ''}.</p>` : ''}
    <button class="bouton large" type="button" data-action="importer-planning" ${choisies.length ? '' : 'disabled'}>Importer ${total} séance${total > 1 ? 's' : ''} (${choisies.length} semaine${choisies.length > 1 ? 's' : ''})</button>`;
}

export { nomMembre, membre };
