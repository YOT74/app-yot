// =====================================================================
// rendu.js — choisit l'écran selon l'adresse (#/…), dessine la barre du bas,
// charge les données.
// =====================================================================
import { STATUTS } from './config.js';
import { etat, estBureau, course, monStatut, statutPossible, nbNonLues, enAttente, appliquerDonnees } from './etat.js';
import { donnees } from './donnees.js';
import { esc, icone, dateCourte } from './outils.js';
import { noterInstallation } from './installation.js';
import { ecranDonneesPerso } from './ecrans/donnees.js';
import { restaurerBrouillons } from './brouillons.js';
import { ecranConnexion, ecranInscription, ecranAttente, tuto } from './ecrans/connexion.js';
import { ecranAccueil, ecranFormulaireActu } from './ecrans/accueil.js';
import { ecranCalendrier, ecranFormulaireCourse } from './ecrans/calendrier.js';
import { ecranCourse } from './ecrans/course.js';
import { ecranEntrainement, ecranFormulaireSeance, ecranImport } from './ecrans/entrainement.js';
import { ecranMesCourses } from './ecrans/mes-courses.js';
import {
  ecranPlus, ecranMembres, ecranMembre, ecranPartenaires, ecranFormulairePartenaire,
  ecranNotifications, ecranReglages, ecranCompte, ecranBureau,
} from './ecrans/plus.js';

export const ecran = document.getElementById('app');
const nav = document.getElementById('nav');
export const feuille = document.getElementById('feuille');
const bandeau = document.getElementById('bandeau');

export function message(texte) {
  // message bref, en bas de l'écran, qui laisse passer les touchers (ne bloque pas la flèche retour)
  bandeau.innerHTML = `<span>${esc(texte)}</span>`;
  bandeau.classList.add('info');
  bandeau.hidden = false;
  clearTimeout(message.minuteur);
  message.minuteur = setTimeout(() => { bandeau.hidden = true; bandeau.classList.remove('info'); }, 2500);
}

// Écran à afficher pour l'adresse courante → [html, onglet actif]
function choisirEcran() {
  const [, r = '', a, b] = location.hash.split('/');
  switch (r) {
    case '': return [ecranAccueil(), 'accueil'];
    case 'notifications': return [ecranNotifications(), 'accueil'];
    case 'actualite': return [estBureau() ? ecranFormulaireActu(a === 'nouvelle' ? null : a) : ecranAccueil(), 'accueil'];
    case 'calendrier': return [ecranCalendrier(), 'calendrier'];
    case 'course': return [ecranCourse(a), 'calendrier'];
    case 'proposer': return [ecranFormulaireCourse(null), 'calendrier'];
    case 'modifier': return [ecranFormulaireCourse(a), 'calendrier'];
    case 'entrainement': return [ecranEntrainement(), 'entrainement'];
    case 'seance': return [ecranFormulaireSeance(a === 'nouvelle' ? null : a, a === 'nouvelle' ? b : null), 'entrainement'];
    case 'import-planning': return [ecranImport(), 'entrainement'];
    case 'mes-courses': return [ecranMesCourses(), 'mes-courses'];
    case 'plus': return [ecranPlus(), 'plus'];
    case 'membres': return [ecranMembres(), 'plus'];
    case 'membre': return [ecranMembre(a), 'plus'];
    case 'partenaires': return [ecranPartenaires(), 'plus'];
    case 'partenaire': return [estBureau() ? ecranFormulairePartenaire(a === 'nouveau' ? null : a) : ecranPartenaires(), 'plus'];
    case 'reglages': return [ecranReglages(), 'plus'];
    case 'compte': return [ecranCompte(), 'plus'];
    case 'donnees': return [ecranDonneesPerso(), 'plus'];
    case 'bureau': return [estBureau() ? ecranBureau() : ecranPlus(), 'plus'];
    default: return [ecranAccueil(), 'accueil'];
  }
}

function barreNav(actif) {
  const nNotifs = nbNonLues();
  const nBureau = estBureau() ? enAttente().length + etat.demandes.length : 0;
  const lien = (cle, href, nom, ic, compte = 0) =>
    `<a href="${href}" ${actif === cle ? 'aria-current="page"' : ''}>${ic}${nom}${compte ? `<span class="compteur" aria-label="${compte} nouveau${compte > 1 ? 'x' : ''}">${compte > 9 ? '9+' : compte}</span>` : ''}</a>`;
  nav.innerHTML =
    // sur l'accueil, la cloche affiche déjà le nombre : pas de second badge
    lien('accueil', '#/', 'Accueil', icone.accueil, actif === 'accueil' ? 0 : nNotifs) +
    lien('calendrier', '#/calendrier', 'Calendrier', icone.calendrier) +
    lien('entrainement', '#/entrainement', 'Planning', icone.entrainement) +
    lien('mes-courses', '#/mes-courses', 'Mes courses', icone.dossard) +
    lien('plus', '#/plus', 'Plus', icone.plus, nBureau);
  nav.hidden = false;
}

// Écran de chargement : des blocs gris à la place du contenu, le temps que les données arrivent.
const squelette = () => `<div class="squelette" aria-busy="true" aria-label="Chargement">
  <span class="sq sq-titre"></span><span class="sq sq-ligne court"></span>
  <span class="sq sq-carte"></span><span class="sq sq-ligne"></span><span class="sq sq-ligne"></span><span class="sq sq-carte petite"></span></div>`;

export function afficher() {
  // page « Données personnelles » : lisible avant même de se connecter
  if (location.hash.startsWith('#/donnees') && !etat.moi) { nav.hidden = true; ecran.innerHTML = ecranDonneesPerso(); return; }
  if (!etat.email) { nav.hidden = true; ecran.innerHTML = ecranConnexion(); return; }
  if (etat.aInscrire) { nav.hidden = true; ecran.innerHTML = ecranInscription(); return; }
  if (!etat.moi) { ecran.innerHTML = squelette(); return; }
  if (etat.moi.en_attente) { nav.hidden = true; ecran.innerHTML = ecranAttente(); return; }
  let [html, onglet] = choisirEcran();
  if (etat.horsLigne) html = `<p class="avertissement">Hors ligne : affichage des dernières données reçues, modifications impossibles.</p>${html}`;
  if (etat.tuto !== null && etat.tuto !== undefined) html += tuto(etat.tuto);
  ecran.innerHTML = html;
  barreNav(onglet);
  restaurerBrouillons();
}

// Ouvrir les notifications = les avoir vues : plus de badge, mais celles qui
// étaient nouvelles restent surlignées pendant cette visite.
export function voirNotifications() {
  const nouvelles = etat.notifications.filter((n) => !n.lue);
  etat.notifsNouvelles = nouvelles.map((n) => n.id);
  if (!nouvelles.length) return;
  nouvelles.forEach((n) => { n.lue = true; });
  donnees.marquerLues(null).catch(() => {});
}

// --- Chargement des données --------------------------------------------------------
const CLE_CACHE = 'cache-donnees-v2';

export async function charger() {
  try {
    const d = await donnees.chargerTout(etat.email);
    if (!d.moi) { Object.assign(etat, { moi: null, aInscrire: true }); afficher(); return; }
    dernierChargement = Date.now();
    appliquerDonnees(d, { horsLigne: false, aInscrire: false });
    try { localStorage.setItem(CLE_CACHE, JSON.stringify(d)); } catch { /* stockage plein ou bloqué */ }
    await chargerNotifications(false);
    noterInstallation((champs) => donnees.modifierMaFiche(champs));   // app ouverte depuis son icône ?
  } catch (e) {
    let cache = null;
    try { cache = JSON.parse(localStorage.getItem(CLE_CACHE)); } catch { /* rien en cache */ }
    if (!navigator.onLine && cache?.moi) {
      appliquerDonnees(cache, { horsLigne: true });
    } else {
      Object.assign(etat, { moi: null, email: null, connexion: { etape: 'email', email: '', erreur: e.message, envoi: false } });
    }
  }
  afficher();
}

// Au retour sur l'app (onglet ou téléphone rouvert), on recharge les données en silence :
// planning mis à jour, nouvelles courses, messages… sans rien demander à l'utilisateur.
// Pas pendant une saisie (formulaire ou feuille ouverte), pour ne rien effacer.
let dernierChargement = Date.now();
export async function rafraichir(force = false) {
  if (!etat.moi || etat.horsLigne || (!force && Date.now() - dernierChargement < 120000)) return;
  const saisie = document.activeElement?.matches?.('input, textarea, select') || feuille.open;
  if (saisie) return;
  try {
    const d = await donnees.chargerTout(etat.email);
    if (!d.moi) return;
    dernierChargement = Date.now();
    appliquerDonnees(d, { horsLigne: false, aInscrire: false });
    try { localStorage.setItem(CLE_CACHE, JSON.stringify(d)); } catch { /* stockage plein ou bloqué */ }
    if (!(document.activeElement?.matches?.('input, textarea, select') || feuille.open)) afficher();
  } catch { /* réseau indisponible : on garde l'affichage actuel */ }
}

export async function chargerNotifications(redessiner = true) {
  if (!etat.moi || etat.horsLigne) return;
  try {
    const avant = nbNonLues();
    etat.notifications = await donnees.chargerNotifications();
    if (redessiner && nbNonLues() !== avant) afficher();
  } catch { /* pas grave : on réessaiera au prochain passage */ }
}

// --- Feuilles du bas -----------------------------------------------------------------
export function ouvrirFeuilleStatut(id) {
  const c = course(id);
  if (!c) return;
  const statut = monStatut(c);
  const choix = Object.entries(STATUTS).filter(([cle]) => statutPossible(cle, c))
    .map(([cle, s]) => `<button type="button" data-action="statut" data-id="${esc(c.id)}" data-valeur="${cle}" aria-pressed="${statut === cle}">${esc(s.libelle)}</button>`).join('');
  feuille.innerHTML = `
    <div class="feuille-corps">
      <span class="etiquette">${esc(dateCourte(c.date_course))}</span>
      <h2 id="feuille-titre">${esc(c.nom)}</h2>
      <div class="choix-statut">${choix}</div>
      ${statut ? '<span class="aide">Touche à nouveau ton statut pour le retirer.</span>' : ''}
      <a class="bouton contour" href="#/course/${esc(c.id)}" data-action="fermer-feuille">Voir la course</a>
    </div>`;
  feuille.showModal();
}

// Confirmation avant une suppression. action = action à déclencher si l'on confirme.
export function confirmer({ titre, texte, bouton, action, id, valeur }) {
  feuille.innerHTML = `
    <div class="feuille-corps">
      <h2 id="feuille-titre">${esc(titre)}</h2>
      <p style="margin:0">${esc(texte)}</p>
      <button class="bouton danger" type="button" data-action="${action}" data-id="${esc(id ?? '')}"${valeur ? ` data-valeur="${esc(valeur)}"` : ''}>${esc(bouton)}</button>
      <button class="bouton contour" type="button" data-action="fermer-feuille">Annuler</button>
    </div>`;
  feuille.showModal();
}
