// =====================================================================
// ecrans/course.js — fiche d'une course.
// =====================================================================
import { STATUTS, TYPES_ALBUM, SOURCES } from '../config.js';
import { etat, estBureau, course, maParticipation, aVenir, statutPossible, alerteCloture, nomMembre } from '../etat.js';
import { esc, icone, lienSur, dateLongue, jourMois, joursAvant, afficherTemps, ilYa, horodatage } from '../outils.js';
import { retour, libelleDiscipline } from './communs.js';
import { avatar } from '../avatar.js';
import { membre } from '../etat.js';

const ORDRE_CLUB = ['inscrit', 'interesse', 'cherche_dossard', 'vend_dossard', 'finisher', 'forfait'];

function blocParticipation(c) {
  const p = maParticipation(c);
  const boutons = Object.entries(STATUTS).map(([cle, s]) => {
    const possible = statutPossible(cle, c);
    const raison = s.quand === 'apres' ? 'Possible seulement après la date de la course' : "La course est passée, ce statut n'a plus d'objet";
    return `<button type="button" data-action="statut" data-id="${esc(c.id)}" data-valeur="${cle}" aria-pressed="${p?.statut === cle}"
              ${possible ? '' : `disabled title="${raison}"`}>${esc(s.libelle)}</button>`;
  }).join('');
  return `
    <section class="bloc">
      <h2>Ma participation</h2>
      <div class="choix-statut">${boutons}</div>
      ${p ? '<span class="aide">Touche à nouveau la pastille pour annuler.</span>' : ''}
      ${p && c.course_club && aVenir(c) ? `
        <label class="champ champ-case"><input type="checkbox" data-action="dispo" data-id="${esc(c.id)}" ${p.dispo_equipe ? 'checked' : ''}> Je suis disponible pour l'équipe du club</label>` : ''}
      ${p?.statut === 'finisher' ? `
        <form data-form="resultat" data-id="${esc(c.id)}">
          <div class="deux">
            <div class="champ"><label for="temps">Temps</label><input id="temps" name="temps" placeholder="hh:mm:ss" inputmode="numeric" value="${esc(afficherTemps(p.temps))}"></div>
            <div class="champ"><label for="classement">Classement</label><input id="classement" name="classement" type="number" min="1" value="${esc(p.classement ?? '')}"></div>
          </div>
          <button class="bouton contour" type="submit">Enregistrer mon résultat</button>
        </form>` : ''}
    </section>`;
}

// Temps « hh:mm:ss » → secondes, pour classer les finishers du club (sans temps : à la fin).
const secondes = (t) => {
  if (!t) return Infinity;
  const [h, m, s] = String(t).split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
};

function blocClub(c) {
  const passee = !aVenir(c);
  const groupes = ORDRE_CLUB.map((statut) => {
    let ps = c.participations.filter((x) => x.statut === statut);
    if (!ps.length) return '';
    const classement = statut === 'finisher' && ps.some((x) => x.temps);
    if (classement) ps = [...ps].sort((a, b) => secondes(a.temps) - secondes(b.temps));
    return `
      <div class="groupe-statut ${statut}">
        <h3>${esc(classement ? 'Résultats du club' : ps.length > 1 ? STATUTS[statut].pluriel ?? STATUTS[statut].libelle : STATUTS[statut].libelle)} · ${ps.length}</h3>
        <ul class="engages${classement ? ' resultats' : ''}">${ps.map((x, i) => {
          const chrono = [afficherTemps(x.temps), x.classement ? `${x.classement}e au scratch` : ''].filter(Boolean).join(' · ');
          return `<li>
            ${classement && x.temps ? `<span class="rang">${i + 1}</span>` : ''}
            <a href="#/membre/${esc(x.membre_id)}" class="engage-nom ${x.membre_id === etat.moi.id ? 'moi' : ''}">${avatar(membre(x.membre_id), 28)} ${esc(nomMembre(x.membre_id))}</a>
            ${chrono ? `<span class="chrono">${esc(chrono)}</span>` : ''}
          </li>`;
        }).join('')}</ul>
      </div>`;
  }).join('');
  const vide = passee ? 'Personne du club.' : 'Personne pour l’instant.';
  return `<section class="bloc"><h2>Le club sur cette course</h2>${groupes || `<p class="aide" style="margin:0">${vide}</p>`}</section>`;
}

function blocBureau(c) {
  const dispos = c.participations.filter((x) => x.dispo_equipe === true);
  const non = c.participations.filter((x) => x.dispo_equipe === false).length;
  const sans = c.participations.length - dispos.length - non;
  return `
    <section class="bloc bureau">
      <h2>Équipe du club · vue bureau</h2>
      <p class="jauge"><strong>${dispos.length}</strong> dispo${dispos.length > 1 ? 's' : ''} sur ${c.participations.length} engagé${c.participations.length > 1 ? 's' : ''}</p>
      ${dispos.length ? `<ul class="engages">${dispos.map((x) => `<li><span class="engage-nom">${avatar(membre(x.membre_id), 28)} ${esc(nomMembre(x.membre_id))}</span><span class="chrono">${esc(STATUTS[x.statut]?.libelle ?? '')}</span></li>`).join('')}</ul>` : '<p class="aide" style="margin:0">Aucun dispo.</p>'}
      <p class="aide" style="margin:0">${non} indisponible${non > 1 ? 's' : ''}, ${sans} sans réponse.</p>
    </section>`;
}

// Bureau : écrire aux engagés de la course, exporter la liste.
function blocOutilsBureau(c) {
  const n = c.participations.filter((x) => x.statut !== 'forfait' && x.membre_id !== etat.moi.id).length;
  return `
    <section class="bloc bureau">
      <h2>Outils du bureau</h2>
      ${n ? `
        <form data-form="message-engages" data-id="${esc(c.id)}" class="champ">
          <label for="message-engages">Message aux engagés (${n} membre${n > 1 ? 's' : ''})</label>
          <textarea id="message-engages" name="texte" rows="3" maxlength="500" required placeholder="ex. RDV 6h45 au parking du lac, maillots du club"></textarea>
          <button class="bouton" type="submit">Envoyer aux ${n} engagé${n > 1 ? 's' : ''}</button>
        </form>` : '<p class="aide" style="margin:0">Aucun autre membre n’est engagé sur cette course.</p>'}
      ${c.participations.length ? `<button class="bouton contour" type="button" data-action="export-course" data-id="${esc(c.id)}">Exporter la liste des engagés (CSV)</button>` : ''}
    </section>`;
}

// Discussion : messages et réponses (un niveau), comme sous une activité Strava.
function carteMessage(m, reponse = false) {
  const auteur = membre(m.membre_id);
  const peutRetirer = m.membre_id === etat.moi.id || estBureau();
  return `
    <div class="msg${reponse ? ' reponse' : ''}">
      ${avatar(auteur, reponse ? 28 : 36)}
      <div class="msg-corps">
        <div class="msg-tete"><a href="#/membre/${esc(m.membre_id)}">${esc(nomMembre(m.membre_id))}</a> <time class="aide" datetime="${esc(m.cree_le ?? '')}">${esc(horodatage(m.cree_le))}</time></div>
        <p class="texte-libre">${esc(m.texte).replace(/(^|\s)@([\p{L}][\p{L}'-]*)/gu, '$1<strong class="mention">@$2</strong>')}</p>
        <div class="msg-actions">
          <button class="lien-mini" type="button" data-action="repondre" data-id="${esc(m.parent_id ?? m.id)}" data-nom="${esc(auteur?.prenom ?? '')}" data-mention="${m.membre_id !== etat.moi.id ? '1' : ''}">Répondre</button>
          ${peutRetirer ? `<button class="lien-mini danger" type="button" data-action="supprimer-message" data-id="${esc(m.id)}">Retirer</button>` : ''}
        </div>
      </div>
    </div>`;
}

function blocDiscussion(c) {
  const tous = [...(c.messages ?? [])].sort((a, b) => (a.cree_le ?? '').localeCompare(b.cree_le ?? ''));
  const racines = tous.filter((m) => !m.parent_id);
  if (etat.triDiscussion === 'desc') racines.reverse();   // les réponses restent dans l'ordre sous leur message
  const moi = membre(etat.moi.id) ?? etat.moi;
  return `
    <section class="bloc" id="discussion">
      <div class="tete-discussion"><h2>Discussion${tous.length ? ` · ${tous.length}` : ''}</h2>
        ${racines.length > 1 ? `<button class="lien-mini" type="button" data-action="tri-discussion">${etat.triDiscussion === 'asc' ? 'Plus anciens d’abord ↓' : 'Plus récents d’abord ↑'}</button>` : ''}</div>
      ${racines.length ? racines.map((r) => `
        <div class="fil">
          ${carteMessage(r)}
          ${tous.filter((m) => m.parent_id === r.id).map((m) => carteMessage(m, true)).join('')}
          ${etat.reponseA?.id === r.id ? `
            <form data-form="message" data-id="${esc(c.id)}" data-parent="${esc(r.id)}" class="composer reponse">
              ${avatar(moi, 28)}
              <textarea name="texte" rows="2" maxlength="1000" required placeholder="Répondre à ${esc(etat.reponseA.nom || 'ce message')}…" id="champ-reponse">${etat.reponseA.mention ? `@${esc(etat.reponseA.nom)} ` : ''}</textarea>
              <div class="rangee"><button class="bouton" type="submit">Répondre</button><button class="bouton discret" type="button" data-action="annuler-reponse">Annuler</button></div>
            </form>` : ''}
        </div>`).join('') : '<p class="aide" style="margin:0">Aucun message pour le moment.</p>'}
      <form data-form="message" data-id="${esc(c.id)}" class="composer">
        ${avatar(moi, 36)}
        <textarea name="texte" rows="2" maxlength="1000" required placeholder="Écrire au club…"></textarea>
        <button class="bouton" type="submit">Envoyer</button>
      </form>
    </section>`;
}

function blocAlbums(c) {
  const ouvert = etat.formAlbum === c.id;
  return `
    <section class="bloc">
      <h2>Albums photos</h2>
      ${c.albums?.length ? `<ul class="engages">${c.albums.map((a) => `
        <li>
          <a href="${esc(lienSur(a.url) ?? '#')}" target="_blank" rel="noopener noreferrer">${esc(a.titre)} ${icone.lien}</a>
          <span class="chrono">${esc(TYPES_ALBUM[a.type] ?? a.type)}</span>
          <span class="mot">Ajouté par ${esc(nomMembre(a.ajoute_par))}, ${esc(ilYa(a.cree_le))}
            ${a.ajoute_par === etat.moi.id || estBureau() ? `<button class="lien-mini danger" type="button" data-action="supprimer-album" data-id="${esc(a.id)}">Supprimer</button>` : ''}</span>
        </li>`).join('')}</ul>`
        : '<p class="aide" style="margin:0">Aucun album pour le moment. Tu peux ajouter le lien d’un album partagé (Google Photos, iCloud…).</p>'}
      ${ouvert ? `
        <form data-form="album" data-id="${esc(c.id)}" class="encadre">
          <div class="champ"><label for="album-titre">Titre</label><input id="album-titre" name="titre" required maxlength="80" placeholder="ex. Photos de l'arrivée"></div>
          <div class="champ"><label for="album-url">Lien de l'album partagé</label><input id="album-url" name="url" type="url" required placeholder="https://photos.app.goo.gl/…">
</div>
          <div class="champ"><label for="album-type">Contenu</label><select id="album-type" name="type">${Object.entries(TYPES_ALBUM).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
          <div class="rangee"><button class="bouton" type="submit">Ajouter l'album</button><button class="bouton discret" type="button" data-action="fermer-album">Annuler</button></div>
        </form>`
        : `<button class="bouton contour" type="button" data-action="ouvrir-album" data-id="${esc(c.id)}">Ajouter un album</button>`}
    </section>`;
}

export function ecranCourse(id) {
  const c = course(id);
  if (!c) return `${retour('#/calendrier', 'Calendrier')}<p class="vide">Cette course n'existe plus.</p>`;
  const future = aVenir(c);
  const auteur = c.creee_par === etat.moi.id;
  const lien = lienSur(c.url_inscription);
  const j = alerteCloture(c);

  const actions = [];
  if (estBureau() && !c.validee) actions.push(`<button class="bouton" type="button" data-action="valider" data-id="${esc(c.id)}">Valider la course</button>`);
  const importee = c.source && c.source !== 'membre';
  if (estBureau() && !c.validee) actions.push(`<button class="bouton contour danger" type="button" data-action="refuser" data-id="${esc(c.id)}">Refuser…</button>`);
  if (estBureau() || (auteur && !c.validee)) actions.push(`<a class="bouton contour" href="#/modifier/${esc(c.id)}">Modifier</a>`);
  if (estBureau() && c.validee) {
    actions.push(importee
      ? `<button class="bouton contour" type="button" data-action="${c.masquee ? 'reafficher-course' : 'masquer-course'}" data-id="${esc(c.id)}">${c.masquee ? 'Réafficher' : 'Masquer'}</button>`
      : `<button class="bouton contour danger" type="button" data-action="supprimer-course" data-id="${esc(c.id)}">Supprimer</button>`);
  }
  if (!estBureau() && auteur && !c.validee) actions.push(`<button class="bouton contour danger" type="button" data-action="supprimer-course" data-id="${esc(c.id)}">Retirer ma proposition</button>`);

  return `
    ${retour('#/calendrier', 'Calendrier')}
    <span class="etiquette">${esc(dateLongue(c.date_course))}${c.date_a_confirmer ? ' · date à confirmer' : future ? ` · J-${joursAvant(c.date_course)}` : ''}</span>
    <h1 class="fiche-titre">${esc(c.nom)}</h1>
    <div class="fiche-meta">
      <span>${[esc(libelleDiscipline(c.discipline)), c.format ? esc(c.format) : '', c.lieu ? `${esc(c.lieu)}${c.departement ? ` (${esc(c.departement)})` : ''}` : ''].filter(Boolean).join(' · ')}</span>
    </div>
    ${c.course_club ? '<div class="bandeau-club"><strong>Course club</strong><span>Course par équipe, organisée par le bureau.</span></div>' : ''}
    ${c.masquee ? '<p class="avertissement">Course masquée.</p>' : ''}
    ${!c.validee ? `<p class="avertissement">Proposée par ${esc(nomMembre(c.creee_par))}, en attente de validation par le bureau.</p>` : ''}
    ${actions.length ? `<div class="rangee">${actions.join('')}</div>` : ''}

    ${future && (lien || c.date_limite_inscription) ? `
      <section class="bloc">
        <h2>Inscription</h2>
        ${c.date_limite_inscription ? `<p style="margin:0" class="${j !== null ? 'erreur' : ''}">Clôture le ${esc(dateLongue(c.date_limite_inscription))}${j !== null ? ` · ${j === 0 ? "aujourd'hui" : `J-${j}`}` : ''}</p>` : ''}
        ${lien ? `<a class="bouton contour" href="${esc(lien)}" target="_blank" rel="noopener noreferrer">S'inscrire sur le site de l'organisateur ${icone.lien}</a>` : ''}
      </section>` : ''}
    ${future && c.validee ? `<button class="lien-action" type="button" data-action="agenda" data-id="${esc(c.id)}">${icone.calendrier} Ajouter à mon agenda</button>` : ''}
    ${c.infos ? `<section class="bloc"><h2>Infos</h2><p class="texte-libre">${esc(c.infos)}</p></section>` : ''}

    ${c.validee ? blocParticipation(c) + blocClub(c) + blocDiscussion(c) : ''}
    ${c.validee && c.course_club && estBureau() ? blocBureau(c) : ''}
    ${c.validee && estBureau() ? blocOutilsBureau(c) : ''}
    ${c.validee && !future ? blocAlbums(c) : ''}
    ${c.validee && future && c.albums?.length ? blocAlbums(c) : ''}
    <p class="aide">${origine(c)}</p>`;
}

// D'où vient la course : un membre, ou une source importée par le robot (avec le lien de sa page).
function origine(c) {
  if (!c.source || c.source === 'membre') return `Ajoutée par ${esc(nomMembre(c.creee_par))} · course le ${esc(jourMois(c.date_course))}`;
  const lien = lienSur(c.url_source);
  const nom = esc(SOURCES[c.source] ?? c.source);
  return `Importée automatiquement · ${lien ? `<a href="${esc(lien)}" target="_blank" rel="noopener noreferrer">${nom} ${icone.lien}</a>` : nom}`;
}
