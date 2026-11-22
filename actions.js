// =====================================================================
// actions.js — ce qui se passe quand on touche un bouton ou envoie un formulaire.
// Chaque bouton porte data-action="…" ; chaque formulaire data-form="…".
// =====================================================================
import { STATUTS, NOM_CLUB, DISCIPLINES_SEANCE, groupePourHeures, DELAI_RENVOI, LONGUEUR_CODE } from './config.js';
import { etat, estBureau, course, maParticipation, monStatut, membre, nomMembre } from './etat.js';
import { donnees } from './donnees.js';
import { demanderCode, validerCode, deconnexion, connexionFournisseur } from './auth.js';
import { esc, aujourdhui, lundiDe, ajouterJours, vide, lienSur, normaliserTemps, fichierAgenda } from './outils.js';
import { afficher, charger, chargerNotifications, rafraichir, message, feuille, ouvrirFeuilleStatut, confirmer } from './rendu.js';
import { ETAPES_TUTO } from './ecrans/connexion.js';
import { avertissementDoublons, listeCalendrier } from './ecrans/calendrier.js';
import { listeMembres } from './ecrans/plus.js';
import { lireFichier, seancesAImporter, trierFeuilles } from './import-excel.js';
import { preparerPhoto } from './avatar.js';
import { detailSeance } from './ecrans/entrainement.js';
import { groupeActif, sansGroupe } from './etat.js';
import { etapesIphone } from './installation.js';
import { appliquerFormat } from './texte-riche.js';
import { effacerBrouillon } from './brouillons.js';
import { vignettesActu, imageSure } from './ecrans/accueil.js';
import { reduireImage } from './avatar.js';

const bloquerSiHorsLigne = () => {
  if (etat.horsLigne) { message('Tu es hors ligne. Réessaie lorsque la connexion sera rétablie.'); return true; }
  return false;
};

// Exécute une écriture, recharge les données, affiche un message ; gère l'erreur.
async function ecrire(action, texteOk, apres) {
  if (bloquerSiHorsLigne()) return false;
  try {
    await action();
    await charger();
    if (apres) apres();
    if (texteOk) message(texteOk);
    return true;
  } catch (e) {
    message(e.message);
    return false;
  }
}

// --- Tuto ----------------------------------------------------------------------
const cleTuto = () => `tuto-vu-${etat.email}`;
export function tutoAVoir() {
  try { return !localStorage.getItem(cleTuto()); } catch { return false; }
}
function finirTuto() {
  try { localStorage.setItem(cleTuto(), '1'); } catch { /* sans stockage, le tuto reviendra : pas grave */ }
  etat.tuto = null;
  afficher();
}

// --- Statut (l'écran change tout de suite, la base suit) ---------------------------
async function changerStatut(id, valeur) {
  if (bloquerSiHorsLigne()) return;
  const c = course(id);
  const statut = valeur || null;
  const avant = JSON.parse(JSON.stringify(c.participations));
  const p = maParticipation(c);
  if (!statut) c.participations = c.participations.filter((x) => x.membre_id !== etat.moi.id);
  else if (p) p.statut = statut;
  else c.participations.push({ course_id: id, membre_id: etat.moi.id, statut, commentaire: null, temps: null, classement: null });
  if (feuille.open) feuille.close();
  afficher();
  try {
    await donnees.changerStatut(id, statut);
  } catch (e) {
    c.participations = avant;
    afficher();
    message(e.message);
  }
}

// Toucher le statut déjà choisi le retire (avec confirmation si un résultat serait perdu).
function toucherStatut(id, valeur) {
  const c = course(id);
  if (!valeur || valeur !== monStatut(c)) return changerStatut(id, valeur);
  const p = maParticipation(c);
  if (p?.temps) {
    confirmer({ titre: 'Retirer ta participation ?', texte: 'Ton temps et ton classement sur cette course seront effacés.', bouton: 'Retirer', action: 'confirmer-retrait', id });
    return;
  }
  return changerStatut(id, '');
}

// Télécharge un fichier .ics (ajout à l'agenda du téléphone).
function telechargerAgenda(courses, nomFichier, contenu = fichierAgenda(courses, NOM_CLUB)) {
  const blob = new Blob([contenu], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

// Je viens / je ne viens pas ; toucher à nouveau sa réponse l'efface.
async function repondrePresence(id, valeur) {
  if (bloquerSiHorsLigne()) return;
  const s = etat.seances.find((x) => x.id === id);
  if (!s) return;
  const avant = [...(s.presences ?? [])];
  const actuelle = avant.find((x) => x.membre_id === etat.moi.id);
  const voulue = valeur === 'true';
  const vient = actuelle && actuelle.vient === voulue ? null : voulue;
  s.presences = avant.filter((x) => x.membre_id !== etat.moi.id);
  if (vient !== null) s.presences.push({ membre_id: etat.moi.id, vient });
  afficher();
  if (document.getElementById('feuille')?.open) document.getElementById('feuille').innerHTML = detailSeance(id);
  try { await donnees.repondrePresence(id, vient); }
  catch (e) { s.presences = avant; afficher(); message(e.message); }
}


// Thème : 'auto' suit le téléphone, sinon clair ou sombre forcé (mémorisé sur cet appareil).
export function appliquerTheme(theme) {
  if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  try { if (theme === 'auto') localStorage.removeItem('theme'); else localStorage.setItem('theme', theme); } catch { /* stockage bloqué */ }
}
export const themeSombre = () => (document.documentElement.dataset.theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';

// Export tableur (toutes les courses, ou une seule depuis sa fiche).
function exporterCSV(courses = etat.courses, nomFichier = `participations-${aujourdhui()}.csv`) {
  const lignes = [['Course', 'Date', 'Validée', 'Membre', 'Statut', 'Temps', 'Classement']];
  for (const c of courses) {
    for (const p of c.participations) {
      const m = membre(p.membre_id);
      lignes.push([c.nom, c.date_course, c.validee ? 'oui' : 'non', m ? `${m.prenom} ${m.nom}` : '', STATUTS[p.statut]?.libelle ?? p.statut,
        p.temps ?? '', p.classement ?? '']);
    }
  }
  const csv = lignes.map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = nomFichier;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function reinitialiserEtat() {
  Object.assign(etat, {
    email: null, moi: null, aInscrire: false, erreurInscription: null, membres: [], courses: [], coursesMasquees: [], seances: [],
    partenaires: [], actualites: [], notifications: [], tuto: null, importExcel: null,
    connexion: { etape: 'email', email: '', erreur: null, envoi: false },
  });
}

// =====================================================================
// Clics
// =====================================================================
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el || el.matches('input, select')) return;   // cases à cocher et listes : voir « change »
  const { action, id, valeur } = el.dataset;
  const f = etat.filtres;
  switch (action) {
    // connexion
    case 'demo-entrer':
      await validerCode(el.dataset.email, '000000');
      etat.email = el.dataset.email;
      await charger();
      if (tutoAVoir()) { etat.tuto = 0; afficher(); }
      break;
    case 'renvoyer-code': {
      const c = etat.connexion;
      if (c.envoi || Date.now() - (c.envoyeLe || 0) < DELAI_RENVOI * 1000) break;
      etat.connexion = { ...c, envoi: true, erreur: null, renvoye: false };
      afficher();
      try {
        await demanderCode(c.email);
        etat.connexion = { ...etat.connexion, envoi: false, envoyeLe: Date.now(), renvoye: true };
      } catch (e) {
        etat.connexion = { ...etat.connexion, envoi: false, erreur: e.message };
      }
      afficher();
      break;
    }
    case 'changer-email': etat.connexion = { ...etat.connexion, etape: 'email', erreur: null }; afficher(); break;
    case 'supprimer-compte':
      confirmer({ titre: 'Supprimer ton compte ?', texte: 'Ta fiche, tes statuts, tes présences, tes votes et tes notifications seront effacés définitivement. Tes messages resteront, signés « Ancien membre ». Tu pourras te réinscrire plus tard.', bouton: 'Supprimer définitivement', action: 'confirmer-supprimer-compte' });
      break;
    case 'confirmer-supprimer-compte':
      feuille.close();
      if (bloquerSiHorsLigne()) break;
      try {
        await donnees.supprimerMonCompte();
        await deconnexion();
        try { localStorage.removeItem('cache-donnees-v2'); } catch { /* rien */ }
        reinitialiserEtat();
        location.hash = '#/';
        afficher();
        message('Ton compte a été supprimé.');
      } catch (e) { message(e.message); }
      break;
    case 'deconnexion':
      await deconnexion();
      try { localStorage.removeItem('cache-donnees-v2'); } catch { /* rien */ }
      reinitialiserEtat();
      location.hash = '#/';
      afficher();
      break;

    // tuto
    case 'tuto-debut': etat.tuto = 0; afficher(); break;
    case 'tuto-suivant': etat.tuto = Math.min(etat.tuto + 1, ETAPES_TUTO.length - 1); afficher(); break;
    case 'tuto-precedent': etat.tuto = Math.max(etat.tuto - 1, 0); afficher(); break;
    case 'tuto-fin': finirTuto(); break;

    // accueil et actualités
    case 'toutes-actus': etat.toutesActus = true; afficher(); break;
    case 'supprimer-actu':
      confirmer({ titre: 'Supprimer cette actualité ?', texte: 'Elle disparaîtra de l’accueil de tous les membres.', bouton: 'Supprimer', action: 'confirmer-supprimer-actu', id });
      break;
    case 'confirmer-supprimer-actu': {
      feuille.close();
      const photos = etat.actualites.find((a) => a.id === id)?.photos ?? [];
      await ecrire(async () => { await donnees.supprimerActualite(id); await donnees.supprimerPhotosActu(photos); }, 'Actualité supprimée.');
      break;
    }
    case 'jeter-brouillon': {
      const f = el.closest('form[data-brouillon]');
      effacerBrouillon(f.dataset.brouillon);
      f.querySelectorAll('textarea, input[type="text"], input[type="url"]').forEach((e) => { e.value = ''; });
      el.closest('.brouillon-repris')?.remove();
      break;
    }
    case 'format': appliquerFormat(document.getElementById(el.dataset.cible), valeur); break;
    case 'voir-photo':
      if (!imageSure(valeur)) break;
      feuille.innerHTML = `<div class="feuille-corps"><img class="photo-grande" src="${esc(valeur)}" alt="">
        <button class="bouton contour" type="button" data-action="fermer-feuille">Fermer</button></div>`;
      feuille.showModal();
      break;
    case 'retirer-photo-actu': {
      const e = etat.photosActu;
      if (id === 'gardee') { e.gardees = e.gardees.filter((u) => u !== valeur); e.retirees.push(valeur); }
      else { const [n] = e.nouvelles.splice(Number(valeur), 1); if (n) URL.revokeObjectURL(n.apercu); }
      document.getElementById('vignettes-actu').outerHTML = vignettesActu();
      break;
    }

    // calendrier
    case 'filtre-discipline':
      f.disciplines = f.disciplines.includes(valeur) ? f.disciplines.filter((d) => d !== valeur) : [...f.disciplines, valeur];
      afficher(); break;
    case 'filtre-periode': f.periode = valeur; afficher(); break;
    case 'filtre-bascule': f[valeur] = !f[valeur]; afficher(); break;
    case 'tri': f.tri = valeur; afficher(); break;
    case 'vider-filtres': Object.assign(f, { disciplines: [], periode: 'tout', club: false, miennes: false, passees: false, base: false, tri: 'date' }); afficher(); break;

    // participation
    case 'ouvrir-statut': ouvrirFeuilleStatut(id); break;
    case 'statut': {
      const depuisResultat = !!el.closest('.feuille-resultat');
      await toucherStatut(id, valeur);
      if (depuisResultat && valeur === 'finisher' && monStatut(course(id)) === 'finisher') {
        const { feuilleResultat } = await import('./ecrans/mes-courses.js');
        feuille.innerHTML = feuilleResultat(id);
        feuille.showModal();
      }
      break;
    }
    case 'confirmer-retrait': feuille.close(); await changerStatut(id, ''); break;
    case 'agenda': { const c = course(id); if (c) telechargerAgenda([c], `${c.nom}.ics`); break; }
    case 'agenda-tout': {
      const futures = etat.courses.filter((c) => c.validee && c.date_course >= aujourdhui() && monStatut(c) && monStatut(c) !== 'forfait');
      telechargerAgenda(futures, 'mes-courses.ics');
      break;
    }
    case 'presence': await repondrePresence(id, valeur); break;
    case 'connexion-fournisseur':
      try { await connexionFournisseur(valeur); } catch (e) { etat.connexion.erreur = e.message; afficher(); }
      break;
    case 'vue-planning':
      etat.vuePlanning = valeur;
      try { localStorage.setItem('vue-planning', valeur); } catch { /* stockage bloqué */ }
      afficher();
      break;
    case 'voir-seance': feuille.innerHTML = detailSeance(id); feuille.showModal(); break;
    case 'theme': appliquerTheme(valeur); afficher(); break;
    case 'basculer-theme': appliquerTheme(themeSombre() ? 'light' : 'dark'); afficher(); break;
    case 'tri-discussion': etat.triDiscussion = etat.triDiscussion === 'asc' ? 'desc' : 'asc'; afficher(); break;
    case 'modifier-resultat': {
      const { feuilleResultat } = await import('./ecrans/mes-courses.js');
      feuille.innerHTML = feuilleResultat(id);
      feuille.showModal();
      break;
    }
    case 'lire-actu':
      etat.actusOuvertes = etat.actusOuvertes.includes(id) ? etat.actusOuvertes.filter((x) => x !== id) : [...etat.actusOuvertes, id];
      afficher();
      break;
    case 'fermer-feuille': if (feuille.open) feuille.close(); break;
    // discussion
    case 'repondre': {
      // répondre à quelqu'un dans un fil : son prénom est mentionné (@Prénom), comme sur Strava
      etat.reponseA = { id, nom: el.dataset.nom, mention: el.dataset.mention === '1' };
      afficher();
      const champ = document.getElementById('champ-reponse');
      if (champ) { champ.focus(); champ.setSelectionRange(champ.value.length, champ.value.length); }
      break;
    }
    case 'annuler-reponse': etat.reponseA = null; afficher(); break;
    case 'supprimer-message':
      confirmer({ titre: 'Retirer ce message ?', texte: 'Il disparaît de la discussion, avec les réponses s’il en a.', bouton: 'Retirer', action: 'confirmer-supprimer-message', id });
      break;
    case 'voter': {
      if (bloquerSiHorsLigne()) break;
      const a = etat.actualites.find((x) => x.id === id);
      const option = Number(valeur);
      const dejaVote = (a.votes_sondage ?? []).some((v) => v.membre_id === etat.moi.id && v.option === option);
      const avant = [...(a.votes_sondage ?? [])];
      // affichage immédiat, puis enregistrement
      let votes = avant.filter((v) => !(v.membre_id === etat.moi.id && (v.option === option || !a.sondage_multiple)));
      if (!dejaVote) votes = [...votes, { membre_id: etat.moi.id, option }];
      a.votes_sondage = votes;
      afficher();
      try { await donnees.voter(id, option, dejaVote); }
      catch (e) { a.votes_sondage = avant; afficher(); message(e.message); }
      break;
    }
    case 'clore-sondage': await ecrire(() => donnees.enregistrerActualite(id, { sondage_clos: true }), 'Sondage clos.'); break;
    case 'rouvrir-sondage': await ecrire(() => donnees.enregistrerActualite(id, { sondage_clos: false }), 'Sondage rouvert.'); break;
    case 'confirmer-supprimer-message': feuille.close(); await ecrire(() => donnees.supprimerMessage(id), 'Message retiré.'); break;
    case 'retirer-photo':
      await ecrire(() => donnees.retirerPhoto(), 'Photo retirée.', () => { etat.moi.photo = null; const m = membre(etat.moi.id); if (m) m.photo = null; });
      break;

    // courses
    case 'valider':
      el.disabled = true;
      await ecrire(() => donnees.validerCourse(id), 'Course validée.');
      break;
    case 'supprimer-course': {
      const c = course(id);
      const n = c.participations.length;
      confirmer({
        titre: `${c.validee ? 'Supprimer' : estBureau() ? 'Refuser' : 'Retirer'} « ${c.nom} » ?`,
        texte: c.validee ? `La course${n ? ` et ses ${n} engagement${n > 1 ? 's' : ''}` : ''} seront effacés.` : 'La proposition sera effacée.',
        bouton: c.validee ? 'Supprimer' : estBureau() ? 'Refuser' : 'Retirer', action: 'confirmer-supprimer-course', id,
      });
      break;
    }
    case 'refuser': {
      const c = course(id);
      feuille.innerHTML = `
        <div class="feuille-corps">
          <h2 id="feuille-titre">Refuser « ${esc(c.nom)} » ?</h2>
          <p style="margin:0">${esc(nomMembre(c.creee_par))} sera prévenu, avec ton motif s'il y en a un.</p>
          <div class="champ"><label for="motif-refus">Motif (facultatif)</label>
            <textarea id="motif-refus" rows="2" maxlength="200" placeholder="ex. déjà dans le calendrier sous le nom « Triathlon de Lyon-Miribel »"></textarea></div>
          <button class="bouton danger" type="button" data-action="confirmer-refus" data-id="${esc(id)}">Refuser et prévenir</button>
          <button class="bouton contour" type="button" data-action="fermer-feuille">Annuler</button>
        </div>`;
      feuille.showModal();
      break;
    }
    case 'confirmer-refus': {
      const motif = document.getElementById('motif-refus')?.value.trim() ?? '';
      feuille.close();
      if (await ecrire(() => donnees.refuserCourse(id, motif), 'Proposition refusée.') && location.hash.startsWith('#/course/')) location.hash = '#/bureau';
      break;
    }
    case 'masquer-course':
      confirmer({ titre: 'Masquer cette course ?', texte: 'Elle disparaît du calendrier. Tu pourras la réafficher depuis l’espace bureau.', bouton: 'Masquer', action: 'confirmer-masquer', id });
      break;
    case 'confirmer-masquer': feuille.close(); await ecrire(() => donnees.masquerCourse(id, true), 'Course masquée.'); break;
    case 'reafficher-course': await ecrire(() => donnees.masquerCourse(id, false), 'Course réaffichée.'); break;
    case 'export-course': { const c = course(id); if (c) exporterCSV([c], `${c.nom} - engages.csv`); break; }
    case 'desactiver-membre': {
      const m = membre(id);
      confirmer({ titre: `Désactiver ${m.prenom} ${m.nom} ?`, texte: 'Il ne pourra plus se connecter. Tu pourras le réactiver.', bouton: 'Désactiver', action: 'confirmer-desactiver', id });
      break;
    }
    case 'confirmer-desactiver': feuille.close(); await ecrire(() => donnees.modifierMembre(id, { actif: false }), 'Compte désactivé.'); break;
    case 'reactiver-membre': await ecrire(() => donnees.modifierMembre(id, { actif: true }), 'Compte réactivé.'); break;

    case 'confirmer-supprimer-course':
      feuille.close();
      if (await ecrire(() => donnees.supprimerCourse(id), 'Course supprimée.')) location.hash = '#/calendrier';
      break;
    case 'ouvrir-album': etat.formAlbum = id; afficher(); document.getElementById('album-titre')?.focus(); break;
    case 'fermer-album': etat.formAlbum = null; afficher(); break;
    case 'supprimer-album':
      confirmer({ titre: 'Retirer cet album ?', texte: 'Les photos restent dans l’album d’origine.', bouton: 'Retirer', action: 'confirmer-supprimer-album', id });
      break;
    case 'confirmer-supprimer-album': feuille.close(); await ecrire(() => donnees.supprimerAlbum(id), 'Album retiré.'); break;

    // entraînement
    case 'semaine': etat.semaine = valeur; afficher(); break;
    case 'filtre-groupe': etat.groupe = valeur || null; afficher(); break;   // null = mes séances (mon groupe)
    case 'supprimer-seance':
      confirmer({ titre: 'Supprimer cette séance ?', texte: 'Elle disparaîtra du planning de tout le club.', bouton: 'Supprimer', action: 'confirmer-supprimer-seance', id });
      break;
    case 'confirmer-supprimer-seance': feuille.close(); await ecrire(() => donnees.supprimerSeance(id), 'Séance supprimée.'); break;
    case 'importer-planning': {
      const imp = etat.importExcel;
      const choisies = imp.tri.retenues.filter((f) => imp.cochees.includes(f.nom));
      if (!choisies.length) break;
      const nb = choisies.reduce((n, f) => n + seancesAImporter(f.analyse).filter((s) => s.discipline !== 'repos').length, 0);
      el.disabled = true;
      // une semaine après l'autre : chacune remplace les séances de sa propre période
      const ok = await ecrire(async () => {
        for (const f of choisies) await donnees.remplacerSeances(f.analyse.debut, f.analyse.fin, seancesAImporter(f.analyse));
      }, `${nb} séances importées sur ${choisies.length} semaine${choisies.length > 1 ? 's' : ''}.`);
      if (ok) { etat.importExcel = null; etat.semaine = lundiDe(choisies[0].analyse.debut); location.hash = '#/entrainement'; }
      else el.disabled = false;
      break;
    }

    // plus
    case 'copier-code':
      try { await navigator.clipboard.writeText(valeur); message(`Code ${valeur} copié.`); }
      catch { message(`Code : ${valeur}`); }
      break;
    case 'supprimer-partenaire':
      confirmer({ titre: 'Supprimer ce partenaire ?', texte: 'Il disparaîtra de la liste des partenaires.', bouton: 'Supprimer', action: 'confirmer-supprimer-partenaire', id });
      break;
    case 'confirmer-supprimer-partenaire': feuille.close(); await ecrire(() => donnees.supprimerPartenaire(id), 'Partenaire supprimé.'); break;
    case 'export-csv': exporterCSV(); break;

    // notifications
    case 'installer-app': {
      const invitation = etat.invitationInstall;
      if (invitation) {                 // Android : fenêtre d'installation du navigateur
        etat.invitationInstall = null;
        await invitation.prompt();
        afficher();
      } else { feuille.innerHTML = etapesIphone(); feuille.showModal(); }
      break;
    }
    case 'verifier-attente': {
      etat.infoAttente = null;
      await charger();
      if (etat.moi?.en_attente) { etat.infoAttente = 'Ta demande n’a pas encore été validée.'; afficher(); }
      else if (etat.moi && tutoAVoir()) { etat.tuto = 0; afficher(); }
      break;
    }
    case 'accepter-membre': {
      const d = etat.demandes.find((x) => x.id === id);
      await ecrire(() => donnees.accepterMembre(id), `${d?.prenom ?? 'Le membre'} a maintenant accès à l’application.`);
      break;
    }
    case 'refuser-membre': {
      const d = etat.demandes.find((x) => x.id === id);
      confirmer({ titre: `Refuser la demande de ${d?.prenom ?? 'ce membre'} ?`, texte: 'La demande sera supprimée. La personne pourra en refaire une.', bouton: 'Refuser', action: 'confirmer-refus-membre', id });
      break;
    }
    case 'confirmer-refus-membre':
      feuille.close();
      await ecrire(() => donnees.refuserMembre(id), 'Demande refusée.');
      break;
    case 'ouvrir-notif': {
      const n = etat.notifications.find((x) => x.id === id);
      if (!n) break;
      if (!n.lue) { n.lue = true; donnees.marquerLues([n.id]).catch(() => {}); }
      if (['mot', 'reponse'].includes(n.type)) etat.defilerVers = 'discussion';
      location.hash = n.type === 'adhesion' ? '#/bureau' : n.course_id && course(n.course_id) ? `#/course/${n.course_id}` : '#/';
      break;
    }
  }
});

feuille.addEventListener('click', (ev) => { if (ev.target === feuille) feuille.close(); });

// =====================================================================
// Cases à cocher, listes, fichier
// =====================================================================
document.addEventListener('change', async (ev) => {
  const el = ev.target;
  const { action, id, valeur } = el.dataset;
  switch (action) {
    case 'niveau-membre': {
      const m = membre(id);
      const nom = el.dataset.discipline === 'velo' ? 'vélo' : 'course à pied';
      if (!(await ecrire(() => donnees.changerNiveau(id, el.dataset.discipline, el.value), `${m.prenom} : ${el.value ? `niveau ${el.value}` : 'sans niveau'} en ${nom}.`))) afficher();
      break;
    }
    case 'groupe-membre': {
      const m = membre(id);
      if (!(await ecrire(() => donnees.changerGroupe(id, el.value), `${m.prenom} : ${el.value ? `groupe ${el.value}` : 'sans groupe'}.`))) afficher();
      break;
    }
    case 'photos-actu': {
      const e = etat.photosActu;
      const place = 4 - e.gardees.length - e.nouvelles.length;
      const fichiers = [...(el.files ?? [])].slice(0, Math.max(place, 0));
      if (el.files?.length > fichiers.length) message('4 photos au plus par actualité.');
      for (const f of fichiers) {
        try { const blob = await reduireImage(f); e.nouvelles.push({ blob, apercu: URL.createObjectURL(blob) }); }
        catch { message('Une des images n’a pas pu être lue.'); }
      }
      document.getElementById('vignettes-actu').outerHTML = vignettesActu();
      return;
    }
    case 'choisir-photo': {
      const fichier = el.files?.[0];
      if (!fichier) return;
      if (bloquerSiHorsLigne()) return;
      try {
        message('Envoi de la photo…');
        const photo = await donnees.changerPhoto(await preparerPhoto(fichier));
        etat.moi.photo = photo;
        const m = membre(etat.moi.id);
        if (m) m.photo = photo;
        afficher();
        message('Photo enregistrée.');
      } catch (e) { message(e.message || 'Photo impossible à lire.'); }
      break;
    }
    case 'role-membre': {
      const m = membre(id);
      const role = el.value;
      if (!(await ecrire(() => donnees.modifierMembre(id, { role }), `${m.prenom} est maintenant ${role}.`))) afficher();
      break;
    }
    case 'reglage-notif': {
      const cle = `notif_${valeur}`;
      try {
        await donnees.modifierMaFiche({ [cle]: el.checked });
        etat.moi[cle] = el.checked;
        message('Réglage enregistré.');
      } catch (e) { el.checked = !el.checked; message(e.message); }
      break;
    }
    case 'choisir-fichier': {
      const fichier = el.files?.[0];
      if (!fichier) return;
      etat.importExcel = { chargement: true };
      afficher();
      try {
        const feuilles = await lireFichier(fichier);
        if (!feuilles.length) throw new Error('Aucune feuille lisible dans ce fichier.');
        const tri = trierFeuilles(feuilles);
        // par défaut : toutes les semaines du fichier, sauf celles déjà entièrement passées
        let cochees = tri.retenues.filter((f) => f.analyse.fin >= lundiDe(aujourdhui())).map((f) => f.nom);
        if (!cochees.length) cochees = tri.retenues.map((f) => f.nom);
        etat.importExcel = { feuilles, tri, cochees };
      } catch (e) {
        etat.importExcel = { erreur: e.message };
      }
      afficher();
      break;
    }
    case 'cocher-feuille': {
      const imp = etat.importExcel;
      imp.cochees = el.checked ? [...imp.cochees, valeur] : imp.cochees.filter((n) => n !== valeur);
      afficher();
      break;
    }
  }
});

// =====================================================================
// Saisie en direct : code, recherche, doublons
// =====================================================================
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.id === 'code') {
    const chiffres = el.value.replace(/\D/g, '').slice(0, LONGUEUR_CODE);
    if (el.value !== chiffres) el.value = chiffres;
    const cases = el.parentElement.querySelectorAll('.code-affichage span');
    const position = Math.min(chiffres.length, LONGUEUR_CODE - 1);
    cases.forEach((s, i) => { s.textContent = chiffres[i] ?? '_'; s.classList.toggle('rempli', i < chiffres.length); s.classList.toggle('actif', i === position); });
    if (chiffres.length === LONGUEUR_CODE) el.form.requestSubmit();
  }
  if (el.dataset.action === 'recherche-course') {
    etat.filtres.recherche = el.value;
    document.getElementById('liste-courses').innerHTML = listeCalendrier();
  }
  if (el.dataset.action === 'recherche-membre') {
    etat.recherche = el.value;
    document.getElementById('resultats-membres').innerHTML = listeMembres();
  }
  const form = el.closest('form[data-form="course"]');
  if (form && (el.name === 'nom' || el.name === 'date_course')) {
    document.getElementById('zone-doublon').innerHTML =
      avertissementDoublons(form.nom.value.trim(), form.date_course.value, form.dataset.id || null);
  }
});

// =====================================================================
// Formulaires
// =====================================================================
document.addEventListener('submit', async (ev) => {
  const form = ev.target.closest('form[data-form]');
  if (!form) return;
  ev.preventDefault();
  const champs = Object.fromEntries(new FormData(form));
  const bouton = form.querySelector('button[type="submit"]');
  const erreur = form.querySelector('[data-erreur]');
  const montrerErreur = (t) => { if (erreur) { erreur.textContent = t; erreur.hidden = false; } else message(t); };

  switch (form.dataset.form) {
    case 'connexion-email': {
      etat.connexion = { ...etat.connexion, email: champs.email.trim(), envoi: true, erreur: null };
      afficher();
      try {
        await demanderCode(champs.email);
        etat.connexion = { ...etat.connexion, etape: 'code', envoi: false, envoyeLe: Date.now(), renvoye: false };
      } catch (e) {
        etat.connexion = { ...etat.connexion, envoi: false, erreur: e.message };
      }
      afficher();
      document.getElementById(etat.connexion.etape === 'code' ? 'code' : 'email')?.focus();
      break;
    }
    case 'connexion-code': {
      const code = (champs.code || '').replace(/\D/g, '');
      if (code.length !== LONGUEUR_CODE) {
        etat.connexion = { ...etat.connexion, erreur: `Le code comporte ${LONGUEUR_CODE} chiffres.` };
        afficher();
        document.getElementById('code')?.focus();
        break;
      }
      etat.connexion = { ...etat.connexion, envoi: true, erreur: null };
      afficher();
      try {
        await validerCode(etat.connexion.email, code);
        etat.email = etat.connexion.email.toLowerCase();
        etat.connexion = { etape: 'email', email: '', erreur: null, envoi: false };
        afficher();
        await charger();
        if (etat.moi && tutoAVoir()) { etat.tuto = 0; afficher(); }
      } catch (e) {
        etat.connexion = { ...etat.connexion, envoi: false, erreur: e.message };
        afficher();
        document.getElementById('code')?.focus();
      }
      break;
    }
    case 'inscription': {
      const heures = champs.heures === '' || champs.heures === undefined ? null : Number(champs.heures);
      const identite = { prenom: champs.prenom.trim(), nom: champs.nom.trim(), heures_semaine: heures, groupe: heures === null ? null : groupePourHeures(heures) };
      if (!identite.prenom || !identite.nom) break;
      bouton.disabled = true;
      try {
        await donnees.inscrire(identite);
        etat.erreurInscription = null;
        await charger();
        if (etat.moi && !etat.moi.en_attente) { etat.tuto = 0; afficher(); }   // présentation de l'app
      } catch (e) {
        etat.erreurInscription = e.message;
        afficher();
      }
      break;
    }
    case 'mes-heures': {
      const heures = champs.heures === '' ? null : Number(champs.heures);
      const groupe = heures === null ? etat.moi.groupe : groupePourHeures(heures);
      bouton.disabled = true;
      await ecrire(() => donnees.modifierMaFiche({ heures_semaine: heures, groupe }), groupe ? `Enregistré : groupe ${groupe}.` : 'Enregistré.',
        () => { etat.groupe = null; });   // le planning revient sur mon (nouveau) groupe
      break;
    }
    case 'mon-nom': {
      const identite = { prenom: champs.prenom.trim(), nom: champs.nom.trim() };
      bouton.disabled = true;
      await ecrire(() => donnees.modifierMaFiche(identite), 'Nom enregistré.');
      break;
    }
    case 'message-engages': {
      const texte = vide(champs.texte);
      if (!texte) break;
      bouton.disabled = true;
      try {
        const n = await donnees.messageEngages(form.dataset.id, texte);
        form.reset();
        message(`Message envoyé à ${n} engagé${n > 1 ? 's' : ''}.`);
      } catch (e) { message(e.message); }
      bouton.disabled = false;
      break;
    }
    case 'message': {
      const texte = vide(champs.texte);
      if (!texte) break;
      bouton.disabled = true;
      const ok = await ecrire(async () => { await donnees.posterMessage(form.dataset.id, texte, form.dataset.parent || null); etat.reponseA = null; effacerBrouillon(form.dataset.brouillon); },
        form.dataset.parent ? 'Réponse envoyée.' : 'Message envoyé.');
      if (!ok) bouton.disabled = false;
      break;
    }
    case 'resultat': {
      const temps = normaliserTemps(champs.temps);
      if (temps === false) { message('Format attendu : 2:31:05 ou 37:50.'); break; }
      bouton.disabled = true;
      await ecrire(() => donnees.majParticipation(form.dataset.id, { temps, classement: champs.classement ? Number(champs.classement) : null }),
        'Résultat enregistré. Bravo !');
      if (feuille.open) feuille.close();
      break;
    }
    case 'album': {
      if (!lienSur(champs.url)) { message('Le lien doit commencer par https://'); break; }
      bouton.disabled = true;
      await ecrire(() => donnees.ajouterAlbum(form.dataset.id, { titre: champs.titre.trim(), url: champs.url.trim(), type: champs.type }),
        'Album ajouté.', () => { etat.formAlbum = null; afficher(); });
      break;
    }
    case 'course': {
      const c = {
        nom: champs.nom.trim(),
        date_course: champs.date_course,
        date_limite_inscription: vide(champs.date_limite_inscription),
        lieu: vide(champs.lieu),
        departement: vide(champs.departement),
        discipline: champs.discipline,
        format: vide(champs.format),
        url_inscription: vide(champs.url_inscription),
        course_club: champs.course_club === 'on',
        infos: vide(champs.infos),
      };
      if (c.url_inscription && !lienSur(c.url_inscription)) { montrerErreur('Le lien doit commencer par https://'); break; }
      if (c.date_limite_inscription && c.date_limite_inscription > c.date_course) { montrerErreur('La clôture des inscriptions doit être avant la course.'); break; }
      bouton.disabled = true;
      let id = form.dataset.id;
      const valider = ev.submitter?.name === 'valider';   // « Enregistrer et valider » (bureau, sur une proposition)
      const ok = await ecrire(async () => {
        if (id) await donnees.modifierCourse(id, c);
        else id = (await donnees.proposerCourse(c, estBureau())).id;
        if (valider) await donnees.validerCourse(id);
        effacerBrouillon(form.dataset.brouillon);
      }, valider ? 'Course validée.' : form.dataset.id ? 'Course modifiée.' : estBureau() ? 'Course ajoutée au calendrier.' : 'Proposition envoyée au bureau.');
      if (ok) location.hash = `#/course/${id}`;
      else bouton.disabled = false;
      break;
    }
    case 'seance': {
      const s = {
        date: champs.date, heure: vide(champs.heure), discipline: champs.discipline, groupe: vide(champs.groupe),
        duree: vide(champs.duree), intensite: vide(champs.intensite), titre: champs.titre.trim(),
        contenu: vide(champs.contenu), lieu: vide(champs.lieu),
      };
      bouton.disabled = true;
      const ok = await ecrire(() => donnees.enregistrerSeance(form.dataset.id || null, s), form.dataset.id ? 'Séance modifiée.' : 'Séance ajoutée.');
      if (ok) { etat.semaine = lundiDe(s.date); location.hash = '#/entrainement'; }
      else bouton.disabled = false;
      break;
    }
    case 'actualite': {
      const options = String(champs.options ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
      if (options.length === 1 || options.length > 10) { montrerErreur('Un sondage a entre 2 et 10 choix (un par ligne).'); break; }
      const a = { titre: champs.titre.trim(), contenu: vide(champs.contenu), course_id: vide(champs.course_id), epinglee: champs.epinglee === 'on',
        sondage_options: options.length ? options : null, sondage_multiple: champs.multiple === 'on' };
      bouton.disabled = true;
      const p = etat.photosActu;
      let nouvelles = [];
      const ok = await ecrire(async () => {
        if (p.nouvelles.length) { message('Envoi des photos…'); nouvelles = await donnees.envoyerPhotosActu(p.nouvelles.map((n) => n.blob)); }
        a.photos = [...p.gardees, ...nouvelles];
        if (!a.photos.length) a.photos = null;
        try { await donnees.enregistrerActualite(form.dataset.id || null, a); effacerBrouillon(form.dataset.brouillon); }
        catch (e) { await donnees.supprimerPhotosActu(nouvelles); throw e; }   // pas de photo orpheline
        await donnees.supprimerPhotosActu(p.retirees);
      }, form.dataset.id ? 'Actualité modifiée.' : 'Actualité publiée.');
      if (ok) { p.nouvelles.forEach((n) => URL.revokeObjectURL(n.apercu)); etat.photosActu = null; location.hash = '#/'; }
      else bouton.disabled = false;
      break;
    }
    case 'partenaire': {
      const p = {
        nom: champs.nom.trim(), activite: vide(champs.activite), avantage: vide(champs.avantage), code_promo: vide(champs.code_promo),
        valable_jusqu_au: vide(champs.valable_jusqu_au), lien: vide(champs.lien),
      };
      if (p.lien && !lienSur(p.lien)) { message('Le lien doit commencer par https://'); break; }
      bouton.disabled = true;
      const ok = await ecrire(() => donnees.enregistrerPartenaire(form.dataset.id || null, p), 'Partenaire enregistré.');
      if (ok) location.hash = '#/partenaires';
      else bouton.disabled = false;
      break;
    }
  }
});

// Les notifications se rafraîchissent toutes les minutes et au retour sur l'app.
setInterval(() => chargerNotifications(), 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { chargerNotifications(); rafraichir(); } });
