// =====================================================================
// ecrans/plus.js — menu « Plus » : membres, partenaires, notifications,
// réglages, mon compte, espace bureau.
// =====================================================================
import { VERSION, MODE_DEMO, REGLAGES_NOTIF, STATUTS, SOURCES, GROUPES_NIVEAU, NIVEAUX } from '../config.js';
import { libelleGroupe } from './entrainement.js';
import { etat, estAdmin, estBureau, estCoach, membre, nomMembre, suffixeRole, course, aVenir, enAttente, nbNonLues, nbEngages, avecAnnee } from '../etat.js';
import { esc, icone, normalise, aujourdhui, ajouterJours, jourMois, dateCourte, ilYa, lienSur } from '../outils.js';
import { entete, retour, ligneCourse, menuAdmin } from './communs.js';
import { avatar } from '../avatar.js';
import { installationPossible, installable } from '../installation.js';
import { doublonsPossibles } from './calendrier.js';

const lienMenu = (href, titre, detail = '', extra = '') =>
  `<a class="menu-lien" href="${href}"><span><strong>${titre}</strong>${detail ? `<br><span class="aide">${detail}</span>` : ''}</span>${extra}${icone.suivant}</a>`;

export function ecranPlus() {
  const n = nbNonLues();
  const attente = enAttente().length + etat.demandes.length;
  return `
    ${entete('Plus')}
    <nav class="menu" aria-label="Autres rubriques">
      ${lienMenu('#/notifications', 'Notifications', n ? `${n} non lue${n > 1 ? 's' : ''}` : 'Ce qui s’est passé sur tes courses')}
      ${lienMenu('#/membres', 'Membres', 'Leurs courses et résultats')}
      ${lienMenu('#/partenaires', 'Partenaires', 'Codes promo et réductions')}
      ${estBureau() ? lienMenu('#/bureau', 'Espace bureau', 'Inscriptions, validations, tableau de bord', attente ? `<span class="compteur">${attente}</span>` : '') : ''}
      ${installationPossible() ? `<button class="menu-lien" type="button" data-action="installer-app"><span><strong>Installer l’app</strong><br><span class="aide">Sur l’écran d’accueil du téléphone</span></span>${icone.suivant}</button>` : ''}
      ${lienMenu('#/compte', 'Mon compte', `${esc(etat.moi.prenom)} ${esc(etat.moi.nom)} · ${esc(etat.email)}`)}
    </nav>
    <section class="bloc apparence">
      <h2>Apparence</h2>
      <div class="segments" role="group" aria-label="Thème">
        ${[['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']].map(([v, l]) => `<button type="button" data-action="theme" data-valeur="${v}" aria-pressed="${(document.documentElement.dataset.theme ?? 'auto') === v}">${l}</button>`).join('')}
      </div>
    </section>
    <button class="bouton discret" type="button" data-action="tuto-debut">Revoir la présentation de l'app</button>
    ${installable() && !installationPossible() ? '<button class="lien-discret" type="button" data-action="installer-app">Installer l’app sur ce téléphone</button>' : ''}
    <p class="aide">Version ${esc(VERSION)}${MODE_DEMO ? ' · mode démo' : ''}</p>`;
}

// --- Membres ------------------------------------------------------------------
export function listeMembres() {
  const q = normalise(etat.recherche);
  const trouves = etat.membres.filter((m) => m.actif !== false || estBureau())
    .filter((m) => !q || normalise(`${m.prenom} ${m.nom}`).includes(q))
    .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'));
  if (!trouves.length) return '<p class="vide">Aucun membre ne correspond.</p>';
  return trouves.map((m) => {
    const siennes = etat.courses.filter((c) => c.participations.some((p) => p.membre_id === m.id));
    const futures = siennes.filter(aVenir).length;
    return lienMenu(`#/membre/${esc(m.id)}`, `${avatar(m, 32)} ${esc(m.prenom)} ${esc(m.nom)}${suffixeRole(m)}${m.actif === false ? ' <span class="badge alerte">désactivé</span>' : ''}`,
      `${futures} à venir · ${siennes.length} au total`);
  }).join('');
}

export function ecranMembres() {
  return `
    ${retour('#/plus', 'Plus')}
    ${entete('Membres', `<span class="etiquette">${etat.membres.filter((m) => m.actif !== false).length}</span>`)}
    <div class="champ"><label for="recherche-membre">Chercher un membre</label>
      <input id="recherche-membre" type="search" value="${esc(etat.recherche)}" placeholder="nom ou prénom" autocomplete="off" data-action="recherche-membre"></div>
    <nav class="menu" id="resultats-membres" aria-label="Membres">${listeMembres()}</nav>`;
}

// Coach : groupe de niveau du membre (proposé d'après ses heures déclarées).
function blocGroupeMembre(m) {
  return `
    <section class="bloc">
      <h2>Groupes et niveaux</h2>
      <div class="champ"><label for="groupe-membre">Groupe du planning${m.heures_semaine ? ` · déclare ${esc(m.heures_semaine)} h par semaine` : ''}</label>
        <select id="groupe-membre" data-action="groupe-membre" data-id="${esc(m.id)}">
          <option value="">Pas de groupe</option>
          ${GROUPES_NIVEAU.map((g) => `<option value="${esc(g.cle)}" ${m.groupe === g.cle ? 'selected' : ''}>${esc(libelleGroupe(g.cle))}</option>`).join('')}
        </select></div>
      ${[['course_a_pied', 'niveau_cap', 'Niveau en course à pied'], ['velo', 'niveau_velo', 'Niveau en vélo']].map(([d, champ, libelle]) => `
      <div class="champ"><label for="${champ}">${libelle}</label>
        <select id="${champ}" data-action="niveau-membre" data-discipline="${d}" data-id="${esc(m.id)}">
          <option value="">Pas de niveau</option>
          ${NIVEAUX.map((n) => `<option value="${n}" ${m[champ] === n ? 'selected' : ''}>Niveau ${n}</option>`).join('')}
        </select></div>`).join('')}
    </section>`;
}

// Bureau : rôle et activation (pas sur sa propre fiche, pour ne pas s'enfermer dehors).
function blocGestionMembre(m) {
  const moi = m.id === etat.moi.id;
  return `
    <section class="bloc bureau">
      <h2>Gestion · vue bureau</h2>
      ${moi ? '<p class="aide" style="margin:0">Seul un autre membre du bureau peut modifier ton rôle.</p>'
        : m.role === 'admin' && !estAdmin() ? '<p class="aide" style="margin:0">Ce compte ne peut pas être modifié.</p>' : `
      <div class="champ"><label for="role-membre">Rôle</label>
        <select id="role-membre" data-action="role-membre" data-id="${esc(m.id)}">
          ${[['membre', 'Membre'], ['coach', 'Coach (gère le planning)'], ['bureau', 'Bureau (gestion du club)'], ...(estAdmin() ? [['admin', 'Administrateur (tous les droits)']] : [])].map(([v, l]) => `<option value="${v}" ${m.role === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
      <button class="bouton ${m.actif === false ? '' : 'contour danger'}" type="button" data-action="${m.actif === false ? 'reactiver-membre' : 'desactiver-membre'}" data-id="${esc(m.id)}">
        ${m.actif === false ? 'Réactiver le compte' : 'Désactiver le compte'}</button>`}
    </section>`;
}

export function ecranMembre(id) {
  const m = membre(id);
  if (!m) return `${retour('#/membres', 'Membres')}<p class="vide">Membre introuvable.</p>`;
  const siennes = etat.courses.filter((c) => c.validee && c.participations.some((p) => p.membre_id === m.id));
  const futures = siennes.filter(aVenir);
  const passees = siennes.filter((c) => !aVenir(c)).reverse();
  const finish = passees.filter((c) => c.participations.some((p) => p.membre_id === m.id && p.statut === 'finisher')).length;
  return `
    ${retour('#/membres', 'Membres')}
    <div class="tete-membre">${avatar(m, 72)}<h1 class="fiche-titre">${esc(m.prenom)} ${esc(m.nom)}${m.role === 'coach' ? ' <span class="aide">(coach)</span>' : ''}</h1></div>
    <p class="sous-titre">${m.groupe ? `${esc(libelleGroupe(m.groupe))} · ` : ''}${finish} course${finish > 1 ? 's' : ''} terminée${finish > 1 ? 's' : ''} · ${futures.length} à venir</p>
    ${estCoach() ? blocGroupeMembre(m) : ''}
    ${estBureau() ? blocGestionMembre(m) : ''}
    <div class="mois">À venir · ${futures.length}</div>
    ${futures.length ? `<div class="liste">${futures.map((c) => ligneCourse(c, { membreId: m.id })).join('')}</div>` : '<p class="vide">Aucun engagement à venir.</p>'}
    <div class="mois">Passées · ${passees.length}</div>
    ${passees.length ? `<div class="liste">${passees.map((c) => ligneCourse(c, { membreId: m.id })).join('')}</div>` : '<p class="vide">Aucune course passée enregistrée.</p>'}`;
}

// --- Partenaires --------------------------------------------------------------------
const expire = (p) => p.valable_jusqu_au && p.valable_jusqu_au < aujourdhui();

function cartePartenaire(p) {
  const lien = lienSur(p.lien);
  return `
    <article class="partenaire${expire(p) ? ' expire' : ''}">
      <div class="actu-haut"><h3>${esc(p.nom)}</h3>
        ${estBureau() ? menuAdmin([[`#/partenaire/${esc(p.id)}`, 'Modifier'], ['supprimer-partenaire', 'Supprimer', p.id]]) : ''}</div>
      ${p.activite ? `<p class="aide" style="margin:0">${esc(p.activite)}</p>` : ''}
      ${p.avantage ? `<p style="margin:0"><strong>${esc(p.avantage)}</strong></p>` : ''}
      ${p.code_promo ? `<div class="ligne-poster"><span class="code-promo">${esc(p.code_promo)}</span>
        <button class="bouton contour" type="button" data-action="copier-code" data-valeur="${esc(p.code_promo)}">${icone.copier} Copier</button></div>`
        : '<p class="aide" style="margin:0">Aucun code nécessaire : présente ta licence sur place.</p>'}
      <p class="aide" style="margin:0">
        ${p.valable_jusqu_au ? `${expire(p) ? 'Expiré le' : "Jusqu'au"} ${esc(jourMois(p.valable_jusqu_au))}` : ''}
        ${lien ? ` · <a href="${esc(lien)}" target="_blank" rel="noopener noreferrer">Site du partenaire ${icone.lien}</a>` : ''}</p>
    </article>`;
}

export function ecranPartenaires() {
  const actifs = etat.partenaires.filter((p) => p.actif !== false);
  const courants = actifs.filter((p) => !expire(p));
  const expires = actifs.filter(expire);
  return `
    ${retour('#/plus', 'Plus')}
    ${entete('Partenaires', `<span class="etiquette">${courants.length} en cours</span>`)}
    ${estBureau() ? '<a class="bouton contour" href="#/partenaire/nouveau">Ajouter un partenaire</a>' : ''}
    ${courants.map(cartePartenaire).join('') || '<p class="vide">Aucun avantage en cours.</p>'}
    ${expires.length ? `<div class="mois">Avantages expirés</div>${expires.map(cartePartenaire).join('')}` : ''}`;
}

export function ecranFormulairePartenaire(id) {
  const p = id ? etat.partenaires.find((x) => x.id === id) : null;
  if (id && !p) return `${retour('#/partenaires', 'Partenaires')}<p class="vide">Ce partenaire n'existe plus.</p>`;
  const v = (k) => esc(p?.[k] ?? '');
  return `
    ${retour('#/partenaires', 'Partenaires')}
    <h1 class="fiche-titre">${p ? 'Modifier le partenaire' : 'Ajouter un partenaire'}</h1>
    <form data-form="partenaire" data-id="${esc(p?.id ?? '')}">
      <div class="champ"><label for="nom">Nom</label><input id="nom" name="nom" required maxlength="80" value="${v('nom')}"></div>
      <div class="champ"><label for="activite">Activité</label><input id="activite" name="activite" maxlength="120" value="${v('activite')}" placeholder="ex. Vélociste, atelier"></div>
      <div class="champ"><label for="avantage">Avantage</label><input id="avantage" name="avantage" maxlength="160" value="${v('avantage')}" placeholder="ex. −10 % sur les pièces"></div>
      <div class="deux">
        <div class="champ"><label for="code_promo">Code promo</label><input id="code_promo" name="code_promo" maxlength="40" value="${v('code_promo')}"></div>
        <div class="champ"><label for="valable_jusqu_au">Valable jusqu'au</label><input id="valable_jusqu_au" name="valable_jusqu_au" type="date" value="${v('valable_jusqu_au')}"></div>
      </div>
      <div class="champ"><label for="lien">Site</label><input id="lien" name="lien" type="url" value="${v('lien')}" placeholder="https://…"></div>
      <button class="bouton large" type="submit">${p ? 'Enregistrer' : 'Ajouter'}</button>
    </form>`;
}

// --- Notifications ---------------------------------------------------------------------
function texteNotif(n) {
  const qui = `<strong>${esc(nomMembre(n.auteur))}</strong>`;
  const c = n.course_id ? course(n.course_id) : null;
  const nomCourse = c ? `<strong>${esc(c.nom)}</strong>` : 'une course';
  switch (n.type) {
    case 'mot': return `${qui} a écrit sur ${nomCourse} : « ${esc(n.extrait ?? '')} »`;
    case 'reponse': return `${qui} a répondu dans la discussion de ${nomCourse} : « ${esc(n.extrait ?? '')} »`;
    case 'inscription': return `${qui} s'est inscrit${''} à ${nomCourse}`;
    case 'proposition': return `${qui} propose une course à valider : <strong>${esc(n.extrait ?? '')}</strong>`;
    case 'adhesion': return `<strong>${esc(n.extrait ?? '')}</strong> demande à rejoindre l’application`;
    case 'validation': return `Le bureau a validé ta proposition <strong>${esc(n.extrait ?? '')}</strong>`;
    case 'actualite': return `${etat.actualites.find((a) => a.id === n.actualite_id)?.sondage_options ? 'Nouveau sondage' : 'Nouvelle actualité'} : <strong>${esc(n.extrait ?? '')}</strong>`;
    case 'refus': return `Le bureau n'a pas retenu ta proposition <strong>${esc(n.extrait ?? '')}</strong>`;
    case 'message': return `${qui} (bureau) aux engagés de ${nomCourse} : « ${esc(n.extrait ?? '')} »`;
    case 'dossard': return n.extrait === 'vend_dossard'
      ? `${qui} vend son dossard pour ${nomCourse}, et tu en cherches un`
      : `${qui} cherche un dossard pour ${nomCourse}, et tu vends le tien`;
    default: return esc(n.extrait ?? '');
  }
}

// Pastille du club pour les notifications sans auteur (ex. course validée automatiquement).
const pastilleClub = '<span class="avatar avatar-club" aria-hidden="true">YOT</span>';

export function ecranNotifications() {
  const liste = etat.notifications;
  const nouvelles = etat.notifsNouvelles ?? [];
  const retourVers = etat.retourNotifs && !etat.retourNotifs.startsWith('#/notifications') ? etat.retourNotifs : '#/';
  return `
    ${retour(retourVers, 'Retour')}
    ${entete('Notifications', `<a class="lien-mini" href="#/reglages">Réglages</a>`)}
    ${liste.length ? `<div class="notifs">${liste.map((x) => {
      const auteur = x.auteur ? membre(x.auteur) : null;
      return `
      <button type="button" class="notif${nouvelles.includes(x.id) ? ' non-lue' : ''}" data-action="ouvrir-notif" data-id="${esc(x.id)}">
        ${auteur ? avatar(auteur, 44) : pastilleClub}
        <span class="notif-texte"><span>${texteNotif(x)}</span>
        <span class="aide">${esc(ilYa(x.cree_le))}</span></span>
      </button>`;
    }).join('')}</div>`
      : '<p class="vide">Aucune nouvelle notification.</p>'}`;
}

export function ecranReglages() {
  const lignes = Object.entries(REGLAGES_NOTIF).filter(([, r]) => !r.bureau || estBureau());
  return `
    ${retour('#/notifications', 'Notifications')}
    <h1 class="fiche-titre">Réglages des notifications</h1>
    <section class="bloc">
      ${lignes.map(([cle, r]) => `
        <label class="champ champ-case reglage"><input type="checkbox" data-action="reglage-notif" data-valeur="${cle}" ${etat.moi[`notif_${cle}`] !== false ? 'checked' : ''}> ${esc(r.libelle)}</label>`).join('')}
    </section>
`;
}

// --- Mon compte -------------------------------------------------------------------------
export function ecranCompte() {
  return `
    ${retour('#/plus', 'Plus')}
    <h1 class="fiche-titre">Mon compte</h1>
    <p class="aide" style="margin:0">${esc(etat.email)}</p>
    <section class="bloc photo-profil">
      ${avatar(etat.moi, 96)}
      <div>
        <label class="bouton contour" for="choix-photo">${etat.moi.photo ? 'Changer ma photo' : 'Ajouter une photo'}</label>
        <input id="choix-photo" type="file" accept="image/*" data-action="choisir-photo" hidden>
        ${etat.moi.photo ? '<button class="lien-mini" type="button" data-action="retirer-photo">Revenir au dessin par défaut</button>'  : ''}
      </div>
    </section>
    <form data-form="mon-nom">
      <div class="deux">
        <div class="champ"><label for="prenom">Prénom</label><input id="prenom" name="prenom" required maxlength="40" value="${esc(etat.moi.prenom)}" autocomplete="given-name"></div>
        <div class="champ"><label for="nom">Nom</label><input id="nom" name="nom" required maxlength="40" value="${esc(etat.moi.nom)}" autocomplete="family-name"></div>
      </div>
      <button class="bouton contour" type="submit">Enregistrer mon nom</button>
    </form>
    <section class="bloc">
      <h2>Entraînement</h2>
      <form data-form="mes-heures" class="champ">
        <label for="mes-heures">Heures d'entraînement par semaine</label>
        <div class="ligne-poster"><input id="mes-heures" name="heures" type="number" min="0" max="40" step="0.5" inputmode="decimal" value="${esc(etat.moi.heures_semaine ?? '')}" placeholder="ex. 8">
          <button class="bouton contour" type="submit">Enregistrer</button></div>
        <span class="aide">${etat.moi.groupe ? `Ton groupe du planning : <strong>${esc(libelleGroupe(etat.moi.groupe))}</strong>. ` : ''}</span>
      </form>
    </section>
    <button class="bouton discret" type="button" data-action="deconnexion">Me déconnecter</button>`;
}

// --- Espace bureau ------------------------------------------------------------------------
function tableauDeBord() {
  const actifs = etat.membres.filter((m) => m.actif !== false);
  const il30 = ajouterJours(aujourdhui(), -30);
  const il180 = ajouterJours(aujourdhui(), -180);
  const nouveaux = actifs.filter((m) => (m.cree_le ?? '').slice(0, 10) >= il30);
  // actif = une participation mise à jour ou un « je viens » depuis 6 mois
  const vus = new Set();
  for (const c of etat.courses) for (const p of c.participations) if ((p.maj_le ?? c.date_course).slice(0, 10) >= il180) vus.add(p.membre_id);
  for (const s of etat.seances) if (s.date >= il180) for (const x of s.presences ?? []) vus.add(x.membre_id);
  const endormis = actifs.filter((m) => !vus.has(m.id) && (m.cree_le ?? '').slice(0, 10) < il180);
  const suivies = etat.courses.filter((c) => c.validee && aVenir(c) && nbEngages(c) > 0)
    .sort((a, b) => nbEngages(b) - nbEngages(a)).slice(0, 5);
  return `
    <section class="bloc">
      <h2>Tableau de bord</h2>
      <div class="chiffres">
        <div><strong>${actifs.length}</strong><span>membres actifs</span></div>
        <div><strong>${nouveaux.length}</strong><span>nouveaux (30 j)</span></div>
        <div><strong>${endormis.length}</strong><span>sans activité (6 mois)</span></div>
      </div>
      ${suivies.length ? `<h3>Courses à venir les plus suivies</h3>
        <ol class="classement">${suivies.map((c) => `<li><a href="#/course/${esc(c.id)}">${esc(c.nom)}</a> <span class="aide">${esc(avecAnnee(dateCourte(c.date_course), c.date_course))} · ${nbEngages(c)} engagé${nbEngages(c) > 1 ? 's' : ''}</span></li>`).join('')}</ol>` : ''}
      ${endormis.length ? `<details class="repli"><summary>Voir les membres sans activité depuis 6 mois</summary>
        <p class="aide" style="margin:0">${endormis.map((m) => `<a href="#/membre/${esc(m.id)}">${esc(m.prenom)} ${esc(m.nom)}</a>`).join(', ')}</p></details>` : ''}
    </section>`;
}

export function ecranBureau() {
  const attente = enAttente();
  const masquees = etat.coursesMasquees;
  return `
    ${retour('#/plus', 'Plus')}
    <h1 class="fiche-titre">Espace bureau</h1>
    ${etat.demandes.length ? `<section class="bloc">
      <h2>Demandes d’inscription <span class="compteur">${etat.demandes.length}</span></h2>
      ${etat.demandes.map((d) => `
        <div class="a-valider">
          <span class="ligne-texte"><strong>${esc(d.prenom)} ${esc(d.nom)}</strong>
            <span class="ligne-detail">${esc(d.email)}${d.heures_semaine ? ` · ${esc(d.heures_semaine)} h par semaine` : ''} · ${esc(ilYa(d.cree_le))}</span></span>
          <div class="rangee">
            <button class="bouton" type="button" data-action="accepter-membre" data-id="${esc(d.id)}">Accepter</button>
            <button class="bouton contour danger" type="button" data-action="refuser-membre" data-id="${esc(d.id)}">Refuser</button>
          </div>
        </div>`).join('')}
    </section>` : ''}
    <section class="bloc">
      <h2>À valider ${attente.length ? `<span class="compteur">${attente.length}</span>` : ''}</h2>
      ${attente.length ? attente.map((c) => {
        const suspects = doublonsPossibles(c.nom, c.date_course, c.id);
        return `
        <div class="a-valider">
          <a class="ligne-lien" href="#/course/${esc(c.id)}"><span class="ligne-texte">
            <span class="ligne-nom">${esc(c.nom)}</span>
            <span class="ligne-detail">${esc(avecAnnee(dateCourte(c.date_course), c.date_course))} · par ${esc(nomMembre(c.creee_par))}</span></span></a>
          ${suspects.length ? `<p class="avertissement">Ressemble à : ${suspects.map((x) => `<a href="#/course/${esc(x.id)}">${esc(x.nom)}</a> (${esc(SOURCES[x.source] ?? 'membre')}, ${esc(avecAnnee(dateCourte(x.date_course), x.date_course))})`).join(', ')}</p>` : ''}
          <div class="rangee">
            <button class="bouton" type="button" data-action="valider" data-id="${esc(c.id)}">Valider</button>
            <a class="bouton contour" href="#/modifier/${esc(c.id)}">Modifier</a>
            <button class="bouton contour danger" type="button" data-action="refuser" data-id="${esc(c.id)}">Refuser…</button>
          </div>
        </div>`;
      }).join('') : '<p class="aide" style="margin:0">Aucune proposition en attente.</p>'}
    </section>
    ${tableauDeBord()}
    ${masquees.length ? `
      <section class="bloc">
        <h2>Courses masquées · ${masquees.length}</h2>
            ${masquees.map((c) => `<div class="ligne-simple"><span>${esc(c.nom)} <span class="aide">· ${esc(avecAnnee(dateCourte(c.date_course), c.date_course))}</span></span>
          <button class="lien-mini" type="button" data-action="reafficher-course" data-id="${esc(c.id)}">Réafficher</button></div>`).join('')}
      </section>` : ''}
    <section class="bloc">
      <h2>Export</h2>
      <p class="aide" style="margin:0">Exporte l’ensemble des participations au format tableur.</p>
      <button class="bouton contour" type="button" data-action="export-csv">Télécharger le fichier CSV</button>
    </section>
    <section class="bloc">
      <h2>Rôles et membres</h2>
      <p class="aide" style="margin:0">Le rôle (membre, coach, bureau) et la désactivation d'un compte se gèrent depuis la fiche du membre : <a href="#/membres">Plus → Membres</a>.</p>
    </section>`;
}

export { STATUTS };
