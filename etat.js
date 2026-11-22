// =====================================================================
// etat.js — l'état de l'app (ce qui est chargé et ce que l'utilisateur a choisi)
// et les petites questions qu'on lui pose partout (« suis-je bureau ? »…).
// =====================================================================
import { STATUTS, SEUIL_CLOTURE } from './config.js';
import { aujourdhui, joursAvant } from './outils.js';

export const etat = {
  email: null,            // email connecté
  moi: null,              // ma fiche membre (avec mes réglages de notifications)
  aInscrire: false,       // connecté mais pas encore de fiche → écran d'inscription
  erreurInscription: null,
  membres: [],
  courses: [],            // chaque course porte ses participations et ses albums
  coursesMasquees: [],    // courses importées masquées par le bureau (visibles du bureau seulement)
  seances: [],
  partenaires: [],
  actualites: [],
  demandes: [],           // demandes d'inscription à valider (bureau)
  notifications: [],
  horsLigne: false,
  connexion: { etape: 'email', email: '', erreur: null, envoi: false },
  // choix d'affichage
  // base = afficher toute la base de courses (sinon : seulement celles suivies par le club)
  filtres: { disciplines: [], periode: 'tout', club: false, miennes: false, passees: false, base: false, tri: 'date', recherche: '' },
  semaine: null,          // lundi de la semaine affichée dans Entraînement
  groupe: null,           // filtre de groupe dans Entraînement (null = mon groupe, sinon 'tous' ou un groupe)
  vuePlanning: (() => { try { return localStorage.getItem('vue-planning') || 'graphique'; } catch { return 'graphique'; } })(),
  triDiscussion: 'asc',   // ordre des messages : 'asc' (anciens d'abord) ou 'desc'
  recherche: '',          // recherche dans Membres
  toutesActus: false,
  actusOuvertes: [],      // actualités dépliées (« Lire la suite »)
  formAlbum: null,        // id de la course dont le formulaire d'album est ouvert
  importExcel: null,      // aperçu de l'import du planning en cours
  tuto: null,             // étape du tuto d'accueil affichée (null = fermé)
  retourNotifs: '#/',     // écran d'où l'on a ouvert les notifications
  notifsNouvelles: [],    // notifications encore non vues à l'ouverture de l'écran
  reponseA: null,         // message auquel on est en train de répondre (discussion)
};

// --- Rôles -------------------------------------------------------------------
export const estAdmin = () => etat.moi?.role === 'admin';
export const estBureau = () => ['bureau', 'admin'].includes(etat.moi?.role);
export const estCoach = () => ['coach', 'bureau', 'admin'].includes(etat.moi?.role);

// --- Groupes de niveau ------------------------------------------------------------
// « Tous niveaux », « tous », vide : pas de groupe particulier
export const sansGroupe = (g) => !g || /^tous/i.test(String(g).trim());
export const groupeActif = () => etat.groupe ?? (etat.moi?.groupe || 'tous');

// --- Membres -------------------------------------------------------------------
export const membre = (id) => etat.membres.find((m) => m.id === id);
// Seul le rôle de coach s'affiche à côté du nom ; bureau et admin restent invisibles.
export const suffixeRole = (m) => (m?.role === 'coach' ? ' (coach)' : '');
export const nomMembre = (id) => { const m = membre(id); return m ? `${m.prenom} ${m.nom}${suffixeRole(m)}` : 'Ancien membre'; };

// --- Courses --------------------------------------------------------------------
export const course = (id) => etat.courses.find((c) => c.id === id) ?? etat.coursesMasquees.find((c) => c.id === id);
// Range les données reçues : les courses masquées à part, pour qu'aucun écran ne les montre par erreur.
export function appliquerDonnees(d, extra = {}) {
  const { courses = [], ...reste } = d;
  Object.assign(etat, reste, extra, {
    courses: courses.filter((c) => !c.masquee),
    coursesMasquees: courses.filter((c) => c.masquee),
  });
}
// Date avec l'année quand ce n'est pas l'année en cours (« dim. 29 août 2027 »).
export const avecAnnee = (texte, iso) => (iso && iso.slice(0, 4) !== String(new Date().getFullYear()) ? `${texte} ${iso.slice(0, 4)}` : texte);
// Épreuves d'un événement : [{ nom, date }]. Sur plusieurs jours, elles sont dans c.epreuves ;
// sinon ce sont les distances listées dans le format (« 10 km, Semi, Marathon »), toutes le jour de la course.
export const epreuvesDe = (c) => {
  if (Array.isArray(c?.epreuves) && c.epreuves.length) return c.epreuves.filter((e) => e?.nom).map((e) => ({ nom: String(e.nom), date: e.date || c.date_course }));
  return String(c?.format ?? '').split(/\s*,\s*/).filter(Boolean).map((nom) => ({ nom, date: c.date_course }));
};
export const plusieursDistances = (c) => epreuvesDe(c).length > 1;
export const plusieursJours = (c) => new Set(epreuvesDe(c).map((e) => e.date)).size > 1;
// dernier jour de l'événement (une course reste « à venir » jusqu'à sa dernière épreuve)
export const dernierJour = (c) => epreuvesDe(c).reduce((m, e) => (e.date > m ? e.date : m), c.date_course);
// date qui me concerne : celle de ma distance si je l'ai choisie, sinon le premier jour
export const dateDeLaDistance = (c, distance) => epreuvesDe(c).find((e) => e.nom === distance)?.date ?? c.date_course;
export const aVenir = (c) => dernierJour(c) >= aujourdhui();
export const enAttente = () => etat.courses.filter((c) => !c.validee);
export const participationDe = (c, membreId) => c.participations.find((p) => p.membre_id === membreId);
export const maParticipation = (c) => participationDe(c, etat.moi.id);
export const monStatut = (c) => maParticipation(c)?.statut ?? null;
export const maDate = (c) => dateDeLaDistance(c, maParticipation(c)?.distance);
export const nbStatut = (c, ...statuts) => c.participations.filter((p) => statuts.includes(p.statut)).length;
// Engagés = tous les statuts sauf forfait.
export const nbEngages = (c) => c.participations.filter((p) => p.statut !== 'forfait').length;
// Course « suivie par le club » : au moins un membre engagé, course club, ou proposition en attente.
export const suivieParLeClub = (c) => c.participations.length > 0 || c.course_club || !c.validee;

// Un statut est-il possible pour cette course aujourd'hui ? (finisher après, cherche dossard avant…)
export function statutPossible(cle, c) {
  const quand = STATUTS[cle]?.quand;
  if (quand === 'avant') return aVenir(c);
  if (quand === 'apres') return !aVenir(c);
  if (quand === 'toujours') return true;
  return aVenir(c);
}

// Jours avant la clôture si elle est proche et que je ne suis pas déjà inscrit, sinon null.
export function alerteCloture(c) {
  if (!c.validee || !c.date_limite_inscription || !suivieParLeClub(c)) return null;
  const j = joursAvant(c.date_limite_inscription);
  if (j < 0 || j > SEUIL_CLOTURE) return null;
  if (['inscrit', 'finisher'].includes(monStatut(c))) return null;
  return j;
}

// --- Notifications -----------------------------------------------------------------
export const nbNonLues = () => etat.notifications.filter((n) => !n.lue).length;
