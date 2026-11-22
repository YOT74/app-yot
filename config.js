// =====================================================================
// config.js — LES RÉGLAGES. C'est le fichier que tu modifies le plus.
// =====================================================================

// --- Connexion à Supabase ---------------------------------------------
// À coller depuis Supabase → Project Settings → API.
// Clé PUBLIQUE uniquement (publishable / anon), jamais la clé service_role.
// Laisser vide = MODE DÉMO : l'app tourne avec les données du POC,
// sans base ni email, pour tester l'interface.
// Supabase local : 'http://127.0.0.1:54321' et la clé affichée par `npx supabase start`.
export const SUPABASE_URL = 'https://pkydrqrtfxfvoykzplqb.supabase.co';
export const SUPABASE_CLE_PUBLIQUE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBreWRycXJ0Znhmdm95a3pwbHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NzQ3NzIsImV4cCI6MjExMDM1MDc3Mn0.saNFPzHhN-WjuGrtZEu8bBVQe50Z7NNSU76_wFUQiYY';

export const MODE_DEMO = !SUPABASE_URL;

// Connexion avec un compte Google ou Apple, en plus du code par email.
// À passer à true une fois le fournisseur activé dans Supabase → Authentication → Sign In / Providers.
export const CONNEXION_GOOGLE = false;
export const CONNEXION_APPLE = false;

// --- Identité du club ---------------------------------------------------
export const NOM_CLUB = 'YOT';

// --- Version de l'app ---------------------------------------------------
// À augmenter à chaque publication (et la même valeur dans sw.js),
// sinon les téléphones gardent l'ancienne version en cache.
export const VERSION = '1.15.0';

// Nombre de chiffres du code reçu par email (réglage Supabase : Authentication → Sign In / Providers → Email → Email OTP Length).
export const LONGUEUR_CODE = 6;

// Délai minimal entre deux demandes de code de connexion, en secondes (limite Supabase).
export const DELAI_RENVOI = 60;

// --- Statuts d'un membre sur une course ---------------------------------
// La clé doit exister dans la base (type statut_participation).
// quand : 'avant' = seulement avant la course, 'apres' = seulement après,
// 'toujours' = avant ou après, rien = avant la course (statuts d'intention).
export const STATUTS = {
  interesse:       { libelle: 'Intéressé', pluriel: 'Intéressés' },
  inscrit:         { libelle: 'Inscrit', pluriel: 'Inscrits' },
  cherche_dossard: { libelle: 'Cherche dossard', pluriel: 'Cherchent un dossard', quand: 'avant' },
  vend_dossard:    { libelle: 'Vend dossard', pluriel: 'Vendent un dossard', quand: 'avant' },
  finisher:        { libelle: 'Finisher', pluriel: 'Finishers', quand: 'apres' },
  forfait:         { libelle: 'Forfait', pluriel: 'Forfaits', quand: 'toujours' },
};

// --- Disciplines des courses (clé enregistrée → libellé affiché) ---------
export const DISCIPLINES = {
  triathlon: 'Triathlon',
  duathlon: 'Duathlon',
  aquathlon: 'Aquathlon',
  swimrun: 'Swimrun',
  bike_and_run: 'Bike & Run',
  cyclo: 'Cyclo',
  trail: 'Trail',
  course_a_pied: 'Course à pied',
  natation: 'Natation',
};

// Suggestions pour le champ « Format » (saisie libre).
export const FORMATS_SUGGERES = ['XS', 'S', 'M', 'L', 'XL', 'Relais', '10 km', 'Semi', 'Marathon'];

// --- Entraînement --------------------------------------------------------
export const DISCIPLINES_SEANCE = {
  course_a_pied: 'Course à pied',
  velo: 'Vélo',
  natation: 'Natation',
  renfo: 'Renforcement',
  repos: 'Récupération',
};

// Intensité d'une séance : libellé et couleur de la pastille.
export const INTENSITES = {
  vert:   { libelle: 'Vert',   couleur: '#2E8B57' },
  jaune:  { libelle: 'Jaune',  couleur: '#C99A06' },
  orange: { libelle: 'Orange', couleur: '#D9661F' },
  rouge:  { libelle: 'Rouge',  couleur: '#C2362F' },
};

// Disciplines dont la présence se gère ailleurs (TeamPulse) : pas de « Je viens » dans l'app.
export const SANS_PRESENCE = ['natation', 'velo'];

// --- Groupes de niveau du planning -------------------------------------------
// Un groupe = une tranche d'heures d'entraînement par semaine (bornes incluses),
// avec les mêmes noms que la colonne GROUPE du fichier Excel du coach.
// À l'inscription, le membre indique ses heures et il est rangé dans un groupe ;
// le coach peut ensuite le changer depuis la fiche du membre.
export const GROUPES_NIVEAU = [
  { cle: '3-6', a: 6 },
  { cle: '7-10', a: 10 },
  { cle: '11-15', a: 99 },
];
// Niveaux de course à pied et de vélo (colonne GROUPE du fichier : 1, 2, 3), attribués par le coach.
export const NIVEAUX = ['1', '2', '3'];

export const groupePourHeures = (h) => (GROUPES_NIVEAU.find((g) => Number(h) <= g.a) ?? GROUPES_NIVEAU.at(-1)).cle;


// --- Origine des courses ---------------------------------------------------
// Les courses importées par le robot portent leur source ; 'membre' = proposée dans l'app.
export const SOURCES = {
  membre: 'Proposée par un membre',
  fftri: 'Calendrier FFTri',
  ironman: 'IRONMAN',
  liste: 'Grandes courses (liste du club)',
};

// --- Albums ----------------------------------------------------------------
export const TYPES_ALBUM = { photos: 'Photos', videos: 'Vidéos', mixte: 'Photos et vidéos' };

// --- Seuils ------------------------------------------------------------------
export const SEUIL_CLOTURE = 10;  // jours avant clôture pour afficher l'alerte
export const SEUIL_DOUBLON = 7;   // jours d'écart pour soupçonner un doublon de course

// --- Notifications : libellés des réglages -------------------------------------
// La clé correspond à la colonne notif_<clé> de la table membres.
export const REGLAGES_NOTIF = {
  mot:         { libelle: 'Discussion : un nouveau message sur une course où je suis engagé, ou une réponse dans un fil où j\'ai écrit' },
  inscription: { libelle: "Quelqu'un s'inscrit à une course où je suis inscrit" },
  actualite:   { libelle: 'Le club publie une actualité' },
  validation:  { libelle: 'Le bureau valide une course que j\'ai proposée' },
  rappel:      { libelle: 'Rappel 7 jours avant la clôture des inscriptions d\'une course où je suis intéressé' },
  dossard:     { libelle: 'Quelqu\'un vend un dossard sur une course où j\'en cherche un (ou en cherche un là où je vends le mien)' },
  proposition: { libelle: 'Une course est proposée et attend validation', bureau: true },
};
