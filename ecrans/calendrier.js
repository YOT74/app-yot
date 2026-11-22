// =====================================================================
// ecrans/calendrier.js — calendrier (filtres, tri) et formulaire de course.
// =====================================================================
import { DISCIPLINES, FORMATS_SUGGERES, SEUIL_DOUBLON } from '../config.js';
import { etat, estBureau, course, monStatut, nbStatut, nbEngages, aVenir, alerteCloture, suivieParLeClub } from '../etat.js';
import { esc, icone, aujourdhui, ajouterJours, enDate, proximite, dateLongue, normalise } from '../outils.js';
import { entete, parMois, ligneCourse, retour } from './communs.js';

const PERIODES = { '3mois': '3 prochains mois', saison: '12 prochains mois', tout: 'Tout' };
const TRIS = { date: 'Par date', inscrits: "Plus d'inscrits", interesses: "Plus d'intéressés", engages: "Plus d'engagés" };

// Portée : « Suivies par le club » (au moins un membre engagé, par défaut) ou « Toute la base ».
// La recherche porte sur la portée choisie ; un lien propose d'élargir à toute la base.
function coursesFiltrees(base = etat.filtres.base) {
  const f = etat.filtres;
  const mots = normalise(f.recherche).split(/\s+/).filter(Boolean);
  const texte = (c) => normalise(`${c.nom} ${c.lieu ?? ''} ${c.departement ?? ''} ${c.format ?? ''}`);
  const auj = aujourdhui();
  const limite = f.periode === '3mois' ? ajouterJours(auj, 91) : f.periode === 'saison' ? ajouterJours(auj, 365) : null;
  const compte = (c) => (f.tri === 'inscrits' ? nbStatut(c, 'inscrit') : f.tri === 'interesses' ? nbStatut(c, 'interesse') : nbEngages(c));
  return etat.courses
    .filter((c) => base || suivieParLeClub(c))
    .filter((c) => !mots.length || mots.every((m) => texte(c).includes(m)))
    .filter((c) => f.passees || c.date_course >= auj)
    .filter((c) => !limite || c.date_course < auj || c.date_course <= limite)
    .filter((c) => !f.disciplines.length || f.disciplines.includes(c.discipline))
    .filter((c) => !f.club || c.course_club)
    .filter((c) => !f.miennes || !!monStatut(c))
    .sort((a, b) => (f.tri !== 'date' && compte(b) - compte(a)) || a.date_course.localeCompare(b.date_course));
}

// En recherche sur les courses suivies : proposer d'élargir à toute la base.
function elargir() {
  const f = etat.filtres;
  if (f.base || !f.recherche.trim()) return '';
  const autres = coursesFiltrees(true).length - coursesFiltrees(false).length;
  return autres > 0 ? `<button type="button" class="lien-discret elargir" data-action="filtre-portee" data-valeur="base">+ ${autres} course${autres > 1 ? 's' : ''} dans toute la base</button>` : '';
}

// La liste seule : réaffichée à chaque lettre tapée dans la recherche (garde le focus du champ).
export function listeCalendrier() {
  const f = etat.filtres;
  const liste = coursesFiltrees();
  const compteur = { inscrits: 'inscrits', interesses: 'interesses' }[f.tri] ?? 'engages';
  const proposer = `<p class="aide">Course introuvable ? <a href="#/proposer">Propose-la au bureau</a>.</p>`;
  if (!liste.length) {
    if (f.recherche.trim()) return `<p class="vide">Aucune course ${f.base ? '' : 'suivie par le club '}trouvée pour « ${esc(f.recherche.trim())} ».</p>${elargir()}${proposer}`;
    return `<p class="vide">${f.base ? 'Aucune course pour ces filtres.' : 'Aucune course pour ces filtres.'}</p>`;
  }
  return elargir() + (f.tri === 'date' ? parMois(liste, { compteur }) : `<div class="liste">${liste.map((c) => ligneCourse(c, { compteur })).join('')}</div>`)
    + `<p class="aide propose-bas">Une course est absente ? <a href="#/proposer">Propose-la au bureau</a>.</p>`;
}

export function ecranCalendrier() {
  const f = etat.filtres;
  const nbAlertes = etat.courses.filter((c) => alerteCloture(c) !== null).length;
  // filtres rangés dans « Plus de filtres » (les bascules principales restent visibles)
  const actifs = f.disciplines.length + (f.periode !== 'tout') + f.passees + (f.tri !== 'date');
  const puce = (action, valeur, libelle, actif) =>
    `<button type="button" data-action="${action}" data-valeur="${esc(valeur)}" aria-pressed="${actif}">${esc(libelle)}</button>`;
  const suivies = etat.courses.filter((c) => c.validee && aVenir(c) && suivieParLeClub(c)).length;
  const toutRetirer = actifs || f.miennes || f.club || f.base;

  return `
    ${entete('Calendrier', `<span class="etiquette">${suivies} suivie${suivies > 1 ? 's' : ''} par le club</span>`)}
    <p class="sous-titre">${nbAlertes ? `${nbAlertes} clôture${nbAlertes > 1 ? 's' : ''} d'inscription proche${nbAlertes > 1 ? 's' : ''}` : "Aucune clôture d'inscription imminente"}</p>

    <div class="champ recherche-course">
      <input type="search" data-action="recherche-course" value="${esc(f.recherche)}" placeholder="Chercher une course, un lieu, un département…" aria-label="Chercher une course" autocomplete="off">
    </div>

    <div class="puces puces-defilantes" role="group" aria-label="Afficher">
      ${puce('filtre-portee', 'suivies', 'Suivies par le club', !f.base)}
      ${puce('filtre-portee', 'base', 'Toute la base', f.base)}
      ${puce('filtre-bascule', 'miennes', 'Où je vais', f.miennes)}
      ${puce('filtre-bascule', 'club', 'Courses club', f.club)}
    </div>

    <details class="filtres" ${actifs ? 'open' : ''}>
      <summary>Plus de filtres${actifs ? ` <span class="compteur">${actifs}</span>` : ''}</summary>
      <div class="puces" role="group" aria-label="Disciplines">
        ${Object.entries(DISCIPLINES).map(([cle, nom]) => puce('filtre-discipline', cle, nom, f.disciplines.includes(cle))).join('')}
      </div>
      <div class="puces" role="group" aria-label="Période">
        ${Object.entries(PERIODES).map(([cle, nom]) => puce('filtre-periode', cle, nom, f.periode === cle)).join('')}
        ${puce('filtre-bascule', 'passees', 'Afficher les passées', f.passees)}
      </div>
      <div class="puces" role="group" aria-label="Trier">
        ${Object.entries(TRIS).map(([cle, nom]) => puce('tri', cle, nom, f.tri === cle)).join('')}
      </div>
    </details>
    ${toutRetirer ? '<button class="bouton discret" type="button" data-action="vider-filtres">Retirer les filtres</button>' : ''}

    <section aria-label="Courses" id="liste-courses">${listeCalendrier()}</section>`;
}

// Courses qui ressemblent à celle qu'on saisit (même nom à peu près, dates proches).
export function doublonsPossibles(nom, date, idIgnore) {
  if (!nom || !date) return [];
  return etat.courses.filter((c) => c.id !== idIgnore
    && Math.abs((enDate(c.date_course) - enDate(date)) / 86400000) < SEUIL_DOUBLON
    && proximite(c.nom, nom) >= 0.55);
}

export function avertissementDoublons(nom, date, idIgnore) {
  const suspects = doublonsPossibles(nom, date, idIgnore);
  if (!suspects.length) return '';
  return `<div class="avertissement"><strong>Cette course existe peut-être déjà :</strong><br>
    ${suspects.map((s) => `<a href="#/course/${esc(s.id)}">${esc(s.nom)} · ${esc(dateLongue(s.date_course))}</a>`).join('<br>')}
    <br>Tu peux quand même la proposer.</div>`;
}

export function ecranFormulaireCourse(id) {
  const c = id ? course(id) : null;
  if (id && !c) return `${retour('#/calendrier', 'Calendrier')}<p class="vide">Cette course n'existe plus.</p>`;
  const v = (champ) => esc(c?.[champ] ?? '');
  return `
    ${retour(c ? `#/course/${esc(c.id)}` : '#/calendrier', c ? 'Retour' : 'Calendrier')}
    <h1 class="fiche-titre">${c ? 'Modifier la course' : 'Proposer une course'}</h1>
    ${c && c.source && c.source !== 'membre' ? '<p class="aide" style="margin:0">Course importée : tes corrections seront conservées lors des prochaines mises à jour.</p>' : ''}
    ${!c && !estBureau() ? '<p class="aide" style="margin:0">Vérifie au préalable dans la recherche du calendrier que la course n’y figure pas déjà.</p>' : ''}
    <form data-form="course" data-id="${esc(c?.id ?? '')}" data-brouillon="course-${esc(c?.id ?? 'nouvelle')}">
      <div class="champ"><label for="nom">Nom de la course</label><input id="nom" name="nom" required maxlength="120" value="${v('nom')}" placeholder="ex. Triathlon de Doussard"></div>
      <div id="zone-doublon">${c ? '' : ''}</div>
      <div class="deux">
        <div class="champ"><label for="date_course">Date</label><input id="date_course" name="date_course" type="date" required value="${v('date_course')}"></div>
        <div class="champ"><label for="date_limite_inscription">Clôture des inscriptions</label><input id="date_limite_inscription" name="date_limite_inscription" type="date" value="${v('date_limite_inscription')}"></div>
      </div>
      <div class="deux">
        <div class="champ"><label for="lieu">Lieu</label><input id="lieu" name="lieu" maxlength="80" value="${v('lieu')}" placeholder="commune"></div>
        <div class="champ"><label for="departement">Département</label><input id="departement" name="departement" maxlength="3" value="${v('departement')}" placeholder="74"></div>
      </div>
      <div class="deux">
        <div class="champ"><label for="discipline">Discipline</label><select id="discipline" name="discipline">
          ${Object.entries(DISCIPLINES).map(([cle, nom]) => `<option value="${cle}" ${(c?.discipline ?? 'triathlon') === cle ? 'selected' : ''}>${esc(nom)}</option>`).join('')}
        </select></div>
        <div class="champ"><label for="format">Format</label><input id="format" name="format" list="formats" maxlength="40" value="${v('format')}" placeholder="S, M, 10 km…">
          <datalist id="formats">${FORMATS_SUGGERES.map((x) => `<option value="${esc(x)}"></option>`).join('')}</datalist></div>
      </div>
      <div class="champ"><label for="url_inscription">Lien d'inscription</label><input id="url_inscription" name="url_inscription" type="url" placeholder="https://…" value="${v('url_inscription')}"></div>
      <label class="champ champ-case"><input type="checkbox" name="course_club" ${c?.course_club ? 'checked' : ''}> Course club</label>
      <div class="champ"><label for="infos">Infos utiles</label><textarea id="infos" name="infos" maxlength="1000" placeholder="Parking, retrait des dossards…">${v('infos')}</textarea></div>
      <p class="erreur" data-erreur hidden></p>
      ${c && !c.validee && estBureau() ? `
        <button class="bouton large" type="submit" name="valider" value="1">Enregistrer et valider</button>
        <button class="bouton contour large" type="submit">Enregistrer sans valider</button>`
        : `<button class="bouton large" type="submit">${c ? 'Enregistrer' : estBureau() ? 'Ajouter au calendrier' : 'Envoyer au bureau'}</button>`}
    </form>`;
}
