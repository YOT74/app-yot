// =====================================================================
// demo.js — mode démo (SUPABASE_URL vide dans config.js).
// Mêmes fonctions que donnees.js, sur les données du POC v3 (demo-donnees.js),
// avec les mêmes règles que la base : visibilité des propositions, droits du
// bureau et du coach, notifications automatiques.
// N'importe quelle adresse fonctionne ; une adresse inconnue passe par l'inscription.
// Les changements restent en mémoire : tout revient à zéro au rechargement.
// =====================================================================
import { DONNEES, REFERENCE } from './demo-donnees.js';

// Décale toutes les dates d'un nombre entier de semaines pour que la démo
// tombe autour d'aujourd'hui (les jours de la semaine sont conservés).
const JOUR = 86400000;
const ref = Date.parse(REFERENCE);
const auj = Date.parse(new Date().toISOString().slice(0, 10));
const decalage = Math.round((auj - ref) / JOUR / 7) * 7;
const decaler = (iso) => {
  if (!iso) return iso;
  const d = new Date(Date.parse(iso.slice(0, 10)) + decalage * JOUR).toISOString().slice(0, 10);
  return iso.length > 10 ? d + iso.slice(10) : d;
};

const copie = (x) => JSON.parse(JSON.stringify(x));
const pause = () => new Promise((r) => setTimeout(r, 120));
let compteur = 1000;
const nouvelId = (p) => `${p}_${compteur++}`;
const maintenant = () => new Date().toISOString();

const REGLAGES_DEFAUT = { notif_mot: true, notif_inscription: true, notif_proposition: true, notif_validation: true, notif_actualite: true, notif_dossard: true };

const db = {
  membres: DONNEES.membres.map((m, i) => ({ ...REGLAGES_DEFAUT, cree_le: decaler(`2025-${String(9 + (i % 4)).padStart(2, '0')}-1${i % 10}`), ...m, email: m.email.toLowerCase() })),
  courses: DONNEES.courses.map((c) => ({ ...c, date_course: decaler(c.date_course), date_limite_inscription: decaler(c.date_limite_inscription) })),
  participations: DONNEES.participations.map((p) => ({ ...p, maj_le: decaler(p.maj_le) })),
  messages: DONNEES.messages.map((m) => ({ ...m, cree_le: decaler(m.cree_le) })),
  albums: DONNEES.albums.map((a) => ({ ...a, cree_le: decaler(a.cree_le) })),
  seances: DONNEES.seances.map((s) => ({ ...s, date: decaler(s.date) })),
  partenaires: DONNEES.partenaires.map((p) => ({ ...p, valable_jusqu_au: decaler(p.valable_jusqu_au) })),
  actualites: DONNEES.actualites.map((a) => ({ ...a, publiee_le: decaler(a.publiee_le) })),
  notifications: [],
  presences: [],
};
// un sondage du bureau, pour voir à quoi ça ressemble
db.votes = [];
{
  const auteur = db.membres.find((m) => m.role === 'bureau');
  const sondage = { id: 'sondage_1', titre: 'Sortie vélo de dimanche : quelle distance ?', contenu: 'Départ 9h du parking d\'Albigny. Vote avant vendredi.',
    epinglee: false, course_id: null, cree_par: auteur?.id, publiee_le: new Date(Date.now() - 86400000).toISOString(),
    sondage_options: ['60 km tranquille', '90 km avec le col de la Forclaz', 'Je ne viens pas'], sondage_multiple: false, sondage_clos: false };
  db.actualites.push(sondage);
  db.membres.filter((m) => m.actif && m.role !== 'bureau').slice(0, 7).forEach((m, i) => db.votes.push({ actualite_id: 'sondage_1', membre_id: m.id, option: [0, 1, 1, 0, 2, 1, 0][i] }));
}

// quelques « je viens » sur les séances, pour voir l'écran rempli
db.seances.forEach((s, i) => {
  if (s.discipline === 'repos') return;
  db.membres.filter((m) => m.actif).slice(i % 5, (i % 5) + 1 + (i % 4)).forEach((m, k) => db.presences.push({ seance_id: s.id, membre_id: m.id, vient: k !== 2 }));
});

let moi = null;
let monEmail = null;
const estAdmin = () => moi?.role === 'admin';
const estBureau = () => ['bureau', 'admin'].includes(moi?.role);
const estCoach = () => ['coach', 'bureau', 'admin'].includes(moi?.role);
const refuse = () => { throw new Error("Tu n'as pas les droits pour cette action."); };

function notifier(destinataires, type, champs) {
  for (const m of db.membres) {
    if (!destinataires(m) || !m.actif || m[`notif_${type}`] === false) continue;
    db.notifications.unshift({ id: nouvelId('n'), destinataire: m.id, type, lue: false, cree_le: maintenant(), ...champs });
  }
}
const engagesSur = (courseId, statuts) => (m) =>
  db.participations.some((p) => p.course_id === courseId && p.membre_id === m.id && statuts.includes(p.statut));

// Quelques notifications de départ pour voir l'écran rempli.
function notificationsDeDepart() {
  if (db.notifications.some((n) => n.destinataire === moi.id)) return;
  const mesCourses = db.participations.filter((p) => p.membre_id === moi.id).map((p) => p.course_id);
  const mots = db.messages
    .filter((m) => mesCourses.includes(m.course_id) && m.membre_id !== moi.id)
    .sort((a, b) => (a.cree_le ?? '').localeCompare(b.cree_le ?? '')).slice(-3);
  for (const m of mots) {
    db.notifications.push({ id: nouvelId('n'), destinataire: moi.id, type: m.parent_id ? 'reponse' : 'mot', course_id: m.course_id, auteur: m.membre_id,
      extrait: m.texte, lue: false, cree_le: m.cree_le || maintenant() });
  }
  const actu = db.actualites.find((a) => a.epinglee);
  if (actu) db.notifications.push({ id: nouvelId('n'), destinataire: moi.id, type: 'actualite', actualite_id: actu.id,
    auteur: actu.cree_par, extrait: actu.titre, lue: true, cree_le: actu.publiee_le });
  db.notifications.sort((a, b) => b.cree_le.localeCompare(a.cree_le));
}

function coursesVisibles() {
  return db.courses
    .filter((c) => (c.validee && !c.masquee) || c.creee_par === moi.id || estBureau())
    .sort((a, b) => a.date_course.localeCompare(b.date_course))
    .map((c) => ({
      ...c,
      participations: db.participations.filter((p) => p.course_id === c.id),
      albums: db.albums.filter((a) => a.course_id === c.id),
      messages: db.messages.filter((m) => m.course_id === c.id),
    }));
}

function maParticipation(courseId) {
  return db.participations.find((p) => p.course_id === courseId && p.membre_id === moi.id);
}

export const demo = {
  async chargerTout(email) {
    await pause();
    monEmail = email;
    moi = db.membres.find((m) => m.email === email && m.actif) ?? null;
    if (!moi) return { moi: null };
    if (moi.en_attente) return copie({ moi, membres: [], courses: [], seances: [], partenaires: [], actualites: [], demandes: [] });
    notificationsDeDepart();
    return copie({
      moi,
      demandes: estBureau() ? db.membres.filter((m) => m.en_attente).map(({ id, prenom, nom, email, heures_semaine, cree_le }) => ({ id, prenom, nom, email, heures_semaine, cree_le })) : [],
      membres: db.membres.filter((m) => !m.en_attente).map(({ id, prenom, nom, role, actif, cree_le, photo, groupe, heures_semaine, niveau_cap, niveau_velo }) =>
        ({ id, prenom, nom, role, actif, cree_le, photo: photo ?? null, groupe: groupe ?? null, heures_semaine: heures_semaine ?? null,
           niveau_cap: niveau_cap ?? null, niveau_velo: niveau_velo ?? null })),
      courses: coursesVisibles(),
      seances: [...db.seances].sort((a, b) => a.date.localeCompare(b.date))
        .map((s) => ({ ...s, presences: db.presences.filter((x) => x.seance_id === s.id).map(({ membre_id, vient }) => ({ membre_id, vient })) })),
      partenaires: db.partenaires,
      actualites: [...db.actualites].sort((a, b) => b.publiee_le.localeCompare(a.publiee_le))
        .map((a) => ({ sondage_options: null, sondage_multiple: false, sondage_clos: false, ...a,
          votes_sondage: db.votes.filter((v) => v.actualite_id === a.id).map(({ membre_id, option }) => ({ membre_id, option })) })),
    });
  },
  async chargerNotifications() {
    await pause();
    return copie(db.notifications.filter((n) => n.destinataire === moi.id).slice(0, 60));
  },

  async inscrire({ prenom, nom, heures_semaine = null, groupe = null }) {
    await pause();
    if (db.membres.some((m) => m.email === monEmail)) throw new Error('Ce compte a été désactivé par le bureau.');
    const m = { ...REGLAGES_DEFAUT, id: nouvelId('m'), email: monEmail, prenom, nom, role: 'membre', actif: true, en_attente: true, heures_semaine, groupe, cree_le: maintenant() };
    db.membres.push(m);
    notifier((x) => ['bureau', 'admin'].includes(x.role) && !x.en_attente, 'adhesion', { auteur: m.id, extrait: `${prenom} ${nom}` });
  },
  async modifierMaFiche(champs) {
    await pause();
    Object.assign(moi, champs);
  },

  async changerStatut(courseId, statut) {
    await pause();
    const i = db.participations.findIndex((p) => p.course_id === courseId && p.membre_id === moi.id);
    if (statut === null) { if (i >= 0) db.participations.splice(i, 1); return; }
    const avant = i >= 0 ? db.participations[i].statut : null;
    if (i >= 0) db.participations[i].statut = statut;
    else db.participations.push({ course_id: courseId, membre_id: moi.id, statut, dispo_equipe: null, temps: null, classement: null });
    if (statut === 'inscrit' && avant !== 'inscrit') {
      notifier((m) => m.id !== moi.id && engagesSur(courseId, ['inscrit'])(m), 'inscription', { course_id: courseId, auteur: moi.id });
    }
    if (['vend_dossard', 'cherche_dossard'].includes(statut) && avant !== statut) {
      const enFace = statut === 'vend_dossard' ? 'cherche_dossard' : 'vend_dossard';
      notifier((m) => m.id !== moi.id && engagesSur(courseId, [enFace])(m), 'dossard', { course_id: courseId, auteur: moi.id, extrait: statut });
    }
  },
  async majParticipation(courseId, champs) {
    await pause();
    const p = maParticipation(courseId);
    if (!p) return;
    Object.assign(p, champs, { maj_le: maintenant() });
  },

  // photo : en démo, gardée en mémoire sous forme d'image intégrée
  async changerPhoto(blob) {
    await pause();
    const photo = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
    moi.photo = photo;
    return photo;
  },
  async retirerPhoto() { await pause(); moi.photo = null; },

  // discussion : mêmes règles que la base (un seul niveau de réponse, notifications)
  async posterMessage(courseId, texte, parentId = null) {
    await pause();
    let parent = parentId ? db.messages.find((m) => m.id === parentId) : null;
    if (parent?.parent_id) parent = db.messages.find((m) => m.id === parent.parent_id);
    const msg = { id: nouvelId('msg'), course_id: courseId, membre_id: moi.id, parent_id: parent?.id ?? null, texte, cree_le: maintenant() };
    db.messages.push(msg);
    const extrait = texte.slice(0, 140);
    if (!parent) {
      const ecrivains = new Set(db.messages.filter((m) => m.course_id === courseId && m.id !== msg.id).map((m) => m.membre_id));
      notifier((m) => m.id !== moi.id && (ecrivains.has(m.id) || db.participations.some((p) => p.course_id === courseId && p.membre_id === m.id && p.statut !== 'forfait')),
        'mot', { course_id: courseId, auteur: moi.id, extrait });
    } else {
      const fil = new Set(db.messages.filter((m) => (m.id === parent.id || m.parent_id === parent.id) && m.id !== msg.id).map((m) => m.membre_id));
      for (const m of db.membres) {
        if (m.id === moi.id || !fil.has(m.id) || !m.actif || !m.notif_mot) continue;
        db.notifications.unshift({ id: nouvelId('n'), destinataire: m.id, type: 'reponse', course_id: courseId, auteur: moi.id, extrait, lue: false, cree_le: maintenant() });
      }
    }
  },
  async supprimerMessage(id) {
    await pause();
    const m = db.messages.find((x) => x.id === id);
    if (!m) return;
    if (m.membre_id !== moi.id && !estBureau()) refuse();
    db.messages = db.messages.filter((x) => x.id !== id && x.parent_id !== id);
  },

  async proposerCourse(champs, valideeDirectement) {
    await pause();
    const course = { id: nouvelId('c'), ...champs, creee_par: moi.id, source: 'membre', validee: valideeDirectement && estBureau() };
    db.courses.push(course);
    if (!course.validee) notifier((m) => ['bureau', 'admin'].includes(m.role) && m.id !== moi.id, 'proposition', { course_id: course.id, auteur: moi.id, extrait: course.nom });
    return { id: course.id };
  },
  async modifierCourse(id, champs) {
    await pause();
    const c = db.courses.find((x) => x.id === id);
    if (!estBureau() && !(c.creee_par === moi.id && !c.validee)) refuse();
    const suivis = ['nom', 'date_course', 'lieu', 'departement', 'discipline', 'format'];
    if (c.source && c.source !== 'membre' && suivis.some((k) => k in champs && champs[k] !== c[k])) c.corrigee = true;
    Object.assign(c, champs);
  },
  async refuserCourse(id, motif) {
    await pause();
    if (!estBureau()) refuse();
    const c = db.courses.find((x) => x.id === id && !x.validee);
    if (!c) throw new Error('Proposition introuvable');
    if (c.creee_par && c.creee_par !== moi.id) {
      db.notifications.unshift({ id: nouvelId('n'), destinataire: c.creee_par, type: 'refus', auteur: moi.id, lue: false, cree_le: maintenant(),
        extrait: `${c.nom}${motif?.trim() ? ` — ${motif.trim()}` : ''}` });
    }
    db.courses = db.courses.filter((x) => x.id !== id);
  },
  async masquerCourse(id, masquee) {
    await pause();
    if (!estBureau()) refuse();
    db.courses.find((x) => x.id === id).masquee = masquee;
  },
  async messageEngages(id, texte) {
    await pause();
    if (!estBureau()) refuse();
    const avant = db.notifications.length;
    for (const p of db.participations.filter((x) => x.course_id === id && x.statut !== 'forfait' && x.membre_id !== moi.id)) {
      const m = db.membres.find((x) => x.id === p.membre_id);
      if (!m?.actif) continue;
      db.notifications.unshift({ id: nouvelId('n'), destinataire: m.id, type: 'message', course_id: id, auteur: moi.id, extrait: texte.trim(), lue: false, cree_le: maintenant() });
    }
    return db.notifications.length - avant;
  },
  async modifierMembre(id, champs) {
    await pause();
    if (!estBureau()) refuse();
    const cible = db.membres.find((m) => m.id === id);
    if (!estAdmin() && (cible.role === 'admin' || champs.role === 'admin')) refuse();
    Object.assign(cible, champs);
  },
  async validerCourse(id) {
    await pause();
    if (!estBureau()) refuse();
    const c = db.courses.find((x) => x.id === id);
    c.validee = true;
    if (c.creee_par && c.creee_par !== moi.id) notifier((m) => m.id === c.creee_par, 'validation', { course_id: id, auteur: moi.id, extrait: c.nom });
  },
  async supprimerCourse(id) {
    await pause();
    const c = db.courses.find((x) => x.id === id);
    if (!estBureau() && !(c.creee_par === moi.id && !c.validee)) refuse();
    db.courses = db.courses.filter((x) => x.id !== id);
    db.participations = db.participations.filter((p) => p.course_id !== id);
    db.albums = db.albums.filter((a) => a.course_id !== id);
    db.messages = db.messages.filter((m) => m.course_id !== id);
  },
  async ajouterAlbum(courseId, { titre, url, type }) {
    await pause();
    db.albums.push({ id: nouvelId('a'), course_id: courseId, titre, url, type, ajoute_par: moi.id, cree_le: maintenant() });
  },
  async supprimerAlbum(id) {
    await pause();
    const a = db.albums.find((x) => x.id === id);
    if (a.ajoute_par !== moi.id && !estBureau()) refuse();
    db.albums = db.albums.filter((x) => x.id !== id);
  },

  async enregistrerSeance(id, champs) {
    await pause();
    if (!estCoach()) refuse();
    if (id) Object.assign(db.seances.find((s) => s.id === id), champs);
    else db.seances.push({ id: nouvelId('s'), ...champs, cree_par: moi.id });
  },
  async supprimerSeance(id) {
    await pause();
    if (!estCoach()) refuse();
    db.seances = db.seances.filter((s) => s.id !== id);
    db.presences = db.presences.filter((x) => x.seance_id !== id);
  },
  async remplacerSeances(debut, fin, seances) {
    await pause();
    if (!estCoach()) refuse();
    const retirees = new Set(db.seances.filter((s) => s.date >= debut && s.date <= fin).map((s) => s.id));
    db.seances = db.seances.filter((s) => !retirees.has(s.id));
    db.presences = db.presences.filter((x) => !retirees.has(x.seance_id));
    for (const s of seances) db.seances.push({ id: nouvelId('s'), ...s, cree_par: moi.id });
  },

  async repondrePresence(seanceId, vient) {
    await pause();
    db.presences = db.presences.filter((x) => !(x.seance_id === seanceId && x.membre_id === moi.id));
    if (vient !== null) db.presences.push({ seance_id: seanceId, membre_id: moi.id, vient });
  },
  async accepterMembre(id) {
    await pause();
    if (!estBureau()) refuse();
    db.membres.find((m) => m.id === id).en_attente = false;
  },
  async refuserMembre(id) {
    await pause();
    if (!estBureau()) refuse();
    db.membres = db.membres.filter((m) => !(m.id === id && m.en_attente));
  },
  async changerNiveau(membreId, discipline, niveau) {
    await pause();
    if (!estCoach()) refuse();
    db.membres.find((m) => m.id === membreId)[discipline === 'velo' ? 'niveau_velo' : 'niveau_cap'] = niveau || null;
  },
  async changerGroupe(membreId, groupe) {
    await pause();
    if (!estCoach()) refuse();
    db.membres.find((m) => m.id === membreId).groupe = groupe || null;
  },

  async enregistrerPartenaire(id, champs) {
    await pause();
    if (!estBureau()) refuse();
    if (id) Object.assign(db.partenaires.find((p) => p.id === id), champs);
    else db.partenaires.push({ id: nouvelId('p'), actif: true, ...champs });
  },
  async supprimerPartenaire(id) {
    await pause();
    if (!estBureau()) refuse();
    db.partenaires = db.partenaires.filter((p) => p.id !== id);
  },
  async enregistrerActualite(id, champs) {
    await pause();
    if (!estBureau()) refuse();
    if (id) { Object.assign(db.actualites.find((a) => a.id === id), champs); return; }
    const actu = { id: nouvelId('n'), ...champs, cree_par: moi.id, publiee_le: maintenant() };
    db.actualites.push(actu);
    notifier((m) => m.id !== moi.id, 'actualite', { actualite_id: actu.id, course_id: actu.course_id, auteur: moi.id, extrait: actu.titre });
  },
  async voter(actualiteId, option, retirer) {
    await pause();
    const a = db.actualites.find((x) => x.id === actualiteId);
    if (!a?.sondage_options || a.sondage_clos) throw new Error("Impossible d'enregistrer ton vote (le sondage est peut-être clos).");
    if (retirer) { db.votes = db.votes.filter((v) => !(v.actualite_id === actualiteId && v.membre_id === moi.id && v.option === option)); return; }
    if (!a.sondage_multiple) db.votes = db.votes.filter((v) => !(v.actualite_id === actualiteId && v.membre_id === moi.id));
    if (!db.votes.some((v) => v.actualite_id === actualiteId && v.membre_id === moi.id && v.option === option)) db.votes.push({ actualite_id: actualiteId, membre_id: moi.id, option });
  },
  async envoyerPhotosActu(blobs) {
    await pause();
    if (!estBureau()) refuse();
    return Promise.all(blobs.map((b) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); })));
  },
  async supprimerPhotosActu() { await pause(); },
  async supprimerActualite(id) {
    await pause();
    if (!estBureau()) refuse();
    db.actualites = db.actualites.filter((a) => a.id !== id);
  },

  async marquerLues(ids) {
    await pause();
    for (const n of db.notifications) {
      if (n.destinataire === moi.id && (!ids || ids.includes(n.id))) n.lue = true;
    }
  },
};
