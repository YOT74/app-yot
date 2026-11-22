// =====================================================================
// donnees.js — le SEUL fichier qui lit et écrit dans la base.
// Le reste de l'app appelle ces fonctions sans savoir d'où viennent les données.
// En mode démo, les mêmes fonctions travaillent sur les données du POC (demo.js).
// =====================================================================
import { supabase } from './client.js';
import { MODE_DEMO } from './config.js';
import { demo } from './demo.js';

let moiId = null;
let monEmail = null;

function verifier(error, message) {
  if (error) {
    console.error(message, error);
    throw new Error(message);
  }
}

// --- Chargement --------------------------------------------------------------

// Charge tout ce dont l'app a besoin en une fois (un club = quelques milliers de lignes au plus).
// moi = null : première connexion, l'app affiche l'écran d'inscription.
async function chargerTout(email) {
  monEmail = email;
  const moiRep = await supabase.from('membres').select('*').eq('email', email).maybeSingle();
  verifier(moiRep.error, 'Chargement des données impossible.');
  if (!moiRep.data) return { moi: null };
  moiId = moiRep.data.id;
  // demande d'inscription pas encore validée par le bureau : l'app n'affiche que l'écran d'attente
  if (moiRep.data.en_attente) return { moi: moiRep.data, membres: [], courses: [], seances: [], partenaires: [], actualites: [], demandes: [] };
  const bureau = ['bureau', 'admin'].includes(moiRep.data.role);
  const [membres, courses, seances, partenaires, actualites, demandes] = await Promise.all([
    supabase.from('membres').select('id, prenom, nom, role, actif, cree_le, photo, groupe, heures_semaine, niveau_cap, niveau_velo').eq('en_attente', false).order('prenom'),
    supabase.from('courses').select('*, participations(*), albums(*), messages(*)').order('date_course'),
    supabase.from('seances').select('*, presences(membre_id, vient)').order('date'),
    supabase.from('partenaires').select('*').order('nom'),
    supabase.from('actualites').select('*, votes_sondage(membre_id, option)').order('publiee_le', { ascending: false }),
    bureau ? supabase.from('membres').select('id, prenom, nom, email, heures_semaine, cree_le').eq('en_attente', true).order('cree_le')
      : Promise.resolve({ data: [] }),
  ]);
  verifier(membres.error || courses.error || seances.error || partenaires.error || actualites.error,
    'Chargement des données impossible.');
  return {
    moi: moiRep.data,
    membres: membres.data,
    courses: courses.data,
    seances: seances.data,
    partenaires: partenaires.data,
    actualites: actualites.data,
    demandes: demandes.data ?? [],
  };
}

async function chargerNotifications() {
  const { data, error } = await supabase.from('notifications').select('*')
    .order('cree_le', { ascending: false }).limit(60);
  verifier(error, 'Chargement des notifications impossible.');
  return data;
}

// --- Présences aux séances ------------------------------------------------------

// vient : true = je viens, false = je ne viens pas, null = pas de réponse
async function repondrePresence(seanceId, vient) {
  const { error } = vient === null
    ? await supabase.from('presences').delete().eq('seance_id', seanceId).eq('membre_id', moiId)
    : await supabase.from('presences').upsert({ seance_id: seanceId, membre_id: moiId, vient });
  verifier(error, "Impossible d'enregistrer ta réponse.");
}

// Coach : groupe de niveau d'un membre.
async function changerNiveau(membreId, discipline, niveau) {
  const { error } = await supabase.rpc('changer_niveau', { membre: membreId, discipline, nouveau: niveau || null });
  verifier(error, 'Impossible de changer le niveau.');
}

async function changerGroupe(membreId, groupe) {
  const { error } = await supabase.rpc('changer_groupe', { membre: membreId, nouveau: groupe || null });
  verifier(error, 'Impossible de changer le groupe.');
}

// --- Mon compte --------------------------------------------------------------

async function inscrire({ prenom, nom, heures_semaine = null, groupe = null }) {
  const { error } = await supabase.from('membres').insert({ email: monEmail, prenom, nom, heures_semaine, groupe });
  if (error?.code === '23505') throw new Error("Ce compte a été désactivé par le bureau. Contacte-le si c'est une erreur.");
  verifier(error, "Impossible d'enregistrer ton inscription.");
}

// champs = { prenom, nom } ou des réglages { notif_mot: false, … }
// Supprimer mon compte : photo, fiche et compte de connexion (fonction supprimer_mon_compte).
async function supprimerMonCompte() {
  await supabase.storage.from('avatars').remove([`${moiId}.jpg`]);
  const { error } = await supabase.rpc('supprimer_mon_compte');
  verifier(error, 'Impossible de supprimer le compte.');
  await supabase.auth.signOut({ scope: 'local' });
}

// Fusion de deux courses en double (bureau) : tout passe sur « garder », « retirer » est supprimée.
async function fusionnerCourses(garder, retirer) {
  const { error } = await supabase.rpc('fusionner_courses', { garder, retirer });
  verifier(error, 'Impossible de fusionner ces courses.');
}

async function modifierMaFiche(champs) {
  const { error } = await supabase.from('membres').update(champs).eq('id', moiId);
  verifier(error, "Impossible d'enregistrer.");
}

// Photo de profil : fichier JPEG déjà recadré (carré) → dossier « avatars », puis adresse dans ma fiche.
async function changerPhoto(blob) {
  const chemin = `${moiId}.jpg`;
  const envoi = await supabase.storage.from('avatars').upload(chemin, blob, { upsert: true, contentType: 'image/jpeg' });
  verifier(envoi.error, "Impossible d'envoyer la photo.");
  const { data } = supabase.storage.from('avatars').getPublicUrl(chemin);
  const photo = `${data.publicUrl}?v=${Date.now()}`;   // ?v= : le téléphone ne garde pas l'ancienne en cache
  await modifierMaFiche({ photo });
  return photo;
}

async function retirerPhoto() {
  await supabase.storage.from('avatars').remove([`${moiId}.jpg`]);
  await modifierMaFiche({ photo: null });
}

// --- Discussion d'une course ---------------------------------------------------------

async function posterMessage(courseId, texte, parentId = null) {
  const { error } = await supabase.from('messages').insert({ course_id: courseId, membre_id: moiId, texte, parent_id: parentId });
  verifier(error, "Impossible d'envoyer le message.");
}

async function supprimerMessage(id) {
  const { error } = await supabase.from('messages').delete().eq('id', id);
  verifier(error, 'Impossible de retirer le message.');
}

// --- Participations -------------------------------------------------------------

// statut = clé de STATUTS, ou null pour retirer sa participation.
async function changerStatut(courseId, statut) {
  if (statut === null) {
    const { error } = await supabase.from('participations').delete()
      .eq('course_id', courseId).eq('membre_id', moiId);
    return verifier(error, 'Impossible de retirer ta participation.');
  }
  const { error } = await supabase.from('participations')
    .upsert({ course_id: courseId, membre_id: moiId, statut });
  verifier(error, "Impossible d'enregistrer ton statut.");
}

// champs = { dispo_equipe } | { temps, classement }
async function majParticipation(courseId, champs) {
  const { error } = await supabase.from('participations').update(champs)
    .eq('course_id', courseId).eq('membre_id', moiId);
  verifier(error, "Impossible d'enregistrer.");
}

// --- Courses ----------------------------------------------------------------------

async function proposerCourse(champs, valideeDirectement) {
  const { data, error } = await supabase.from('courses')
    .insert({ ...champs, creee_par: moiId, validee: valideeDirectement })
    .select('id').single();
  verifier(error, "Impossible d'enregistrer la course.");
  return data;
}

async function modifierCourse(id, champs) {
  const { error } = await supabase.from('courses').update(champs).eq('id', id);
  verifier(error, 'Impossible de modifier la course.');
}

async function validerCourse(id) {
  const { error } = await supabase.from('courses').update({ validee: true }).eq('id', id);
  verifier(error, 'Impossible de valider la course.');
}

async function supprimerCourse(id) {
  const { error } = await supabase.from('courses').delete().eq('id', id);
  verifier(error, 'Impossible de supprimer la course.');
}

// Bureau : refuser une proposition (l'auteur est prévenu, avec le motif s'il y en a un).
async function refuserCourse(id, motif) {
  const { error } = await supabase.rpc('refuser_course', { course: id, motif: motif || null });
  verifier(error, 'Impossible de refuser la proposition.');
}

// Bureau : masquer / réafficher une course importée (supprimée, le robot la réimporterait).
async function masquerCourse(id, masquee) {
  const { error } = await supabase.from('courses').update({ masquee }).eq('id', id);
  verifier(error, 'Impossible de masquer la course.');
}

// Bureau : message à tous les engagés d'une course → nombre de membres prévenus.
async function messageEngages(id, texte) {
  const { data, error } = await supabase.rpc('message_engages', { course: id, texte });
  verifier(error, "Impossible d'envoyer le message.");
  return data;
}

// Bureau : rôle et activation d'un membre.
// Demandes d'inscription (bureau) : accepter ouvre l'accès, refuser supprime la demande.
async function accepterMembre(id) {
  const { error } = await supabase.from('membres').update({ en_attente: false }).eq('id', id).eq('en_attente', true);
  verifier(error, "Impossible d'accepter cette demande.");
}
async function refuserMembre(id) {
  const { error } = await supabase.from('membres').delete().eq('id', id).eq('en_attente', true);
  verifier(error, 'Impossible de refuser cette demande.');
}

async function modifierMembre(id, champs) {
  const { error } = await supabase.from('membres').update(champs).eq('id', id);
  verifier(error, 'Impossible de modifier ce membre.');
}

async function ajouterAlbum(courseId, { titre, url, type }) {
  const { error } = await supabase.from('albums').insert({ course_id: courseId, titre, url, type, ajoute_par: moiId });
  verifier(error, "Impossible d'ajouter l'album.");
}

async function supprimerAlbum(id) {
  const { error } = await supabase.from('albums').delete().eq('id', id);
  verifier(error, "Impossible de supprimer l'album.");
}

// --- Entraînement -----------------------------------------------------------------

async function enregistrerSeance(id, champs) {
  const req = id
    ? supabase.from('seances').update(champs).eq('id', id)
    : supabase.from('seances').insert({ ...champs, cree_par: moiId });
  const { error } = await req;
  verifier(error, "Impossible d'enregistrer la séance.");
}

async function supprimerSeance(id) {
  const { error } = await supabase.from('seances').delete().eq('id', id);
  verifier(error, 'Impossible de supprimer la séance.');
}

// Import Excel : remplace les séances de la période [debut, fin] par la liste importée.
async function remplacerSeances(debut, fin, seances) {
  const suppr = await supabase.from('seances').delete().gte('date', debut).lte('date', fin);
  verifier(suppr.error, "Impossible de remplacer les séances de la période.");
  if (!seances.length) return;
  const { error } = await supabase.from('seances').insert(seances.map((s) => ({ ...s, cree_par: moiId })));
  verifier(error, "Impossible d'importer les séances.");
}

// --- Partenaires et actualités (bureau) -----------------------------------------------

async function enregistrerPartenaire(id, champs) {
  const req = id ? supabase.from('partenaires').update(champs).eq('id', id) : supabase.from('partenaires').insert(champs);
  const { error } = await req;
  verifier(error, "Impossible d'enregistrer le partenaire.");
}

async function supprimerPartenaire(id) {
  const { error } = await supabase.from('partenaires').delete().eq('id', id);
  verifier(error, 'Impossible de supprimer le partenaire.');
}

async function enregistrerActualite(id, champs) {
  const req = id
    ? supabase.from('actualites').update(champs).eq('id', id)
    : supabase.from('actualites').insert({ ...champs, cree_par: moiId });
  const { error } = await req;
  verifier(error, "Impossible d'enregistrer l'actualité.");
}

// Sondage : voter pour un choix (retirer = annuler ce vote). Choix unique : la base remplace l'ancien vote.
async function voter(actualiteId, option, retirer) {
  const { error } = retirer
    ? await supabase.from('votes_sondage').delete().eq('actualite_id', actualiteId).eq('membre_id', moiId).eq('option', option)
    : await supabase.from('votes_sondage').insert({ actualite_id: actualiteId, membre_id: moiId, option });
  verifier(error, "Impossible d'enregistrer ton vote (le sondage est peut-être clos).");
}

// Photos d'actualité : déposées dans le dossier public « actualites », sous un nom aléatoire.
async function envoyerPhotosActu(blobs) {
  const adresses = [];
  for (const blob of blobs) {
    const chemin = `${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from('actualites').upload(chemin, blob, { contentType: 'image/jpeg' });
    if (error) { await supprimerPhotosActu(adresses); verifier(error, "Impossible d'envoyer les photos."); }
    adresses.push(supabase.storage.from('actualites').getPublicUrl(chemin).data.publicUrl);
  }
  return adresses;
}
async function supprimerPhotosActu(adresses) {
  const chemins = (adresses ?? []).map((u) => u.split('/actualites/')[1]).filter(Boolean);
  if (chemins.length) await supabase.storage.from('actualites').remove(chemins);
}

async function supprimerActualite(id) {
  const { error } = await supabase.from('actualites').delete().eq('id', id);
  verifier(error, "Impossible de supprimer l'actualité.");
}

// --- Notifications ----------------------------------------------------------------------

// ids = liste d'identifiants, ou null pour tout marquer comme lu.
async function marquerLues(ids) {
  let req = supabase.from('notifications').update({ lue: true }).eq('lue', false);
  if (ids) req = req.in('id', ids);
  const { error } = await req;
  verifier(error, 'Impossible de mettre à jour les notifications.');
}

const reel = {
  chargerTout, chargerNotifications, inscrire, modifierMaFiche, changerPhoto, retirerPhoto,
  posterMessage, supprimerMessage,
  changerStatut, majParticipation,
  proposerCourse, modifierCourse, validerCourse, supprimerCourse, refuserCourse, masquerCourse, messageEngages, modifierMembre,
  ajouterAlbum, supprimerAlbum,
  enregistrerSeance, supprimerSeance, remplacerSeances, repondrePresence, changerGroupe, changerNiveau, accepterMembre, refuserMembre,
  enregistrerPartenaire, supprimerPartenaire, supprimerMonCompte, fusionnerCourses, enregistrerActualite, supprimerActualite, envoyerPhotosActu, supprimerPhotosActu, voter,
  marquerLues,
};

export const donnees = MODE_DEMO ? demo : reel;
