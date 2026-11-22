// =====================================================================
// ecrans/communs.js — morceaux d'interface réutilisés par plusieurs écrans.
// =====================================================================
import { NOM_CLUB, STATUTS, DISCIPLINES } from '../config.js';
import { etat, aVenir, monStatut, maParticipation, participationDe, nbStatut, nbEngages, alerteCloture } from '../etat.js';
import { esc, enDate, moisAnnee, jourMois, afficherTemps, icone, dateCourte, joursAvant } from '../outils.js';

export const libelleDiscipline = (cle) => DISCIPLINES[cle] ?? cle;

export function entete(titre, droite = '') {
  return `<header class="entete"><h1>${titre}</h1>${droite}</header>`;
}

export function retour(href, libelle) {
  return `<a class="retour" href="${href}">${icone.retour} ${esc(libelle)}</a>`;
}

// Le dossard (bandeau violet + trous d'épingle). corps = HTML intérieur.
export function dossard(gauche, droite, corps, href = null) {
  const balise = href ? 'a' : 'div';
  return `
    <${balise} class="dossard"${href ? ` href="${href}"` : ''}>
      <div class="dossard-bandeau"><span>${esc(gauche)}</span><span>${esc(droite)}</span></div>
      <span class="dossard-trou hg"></span><span class="dossard-trou hd"></span>
      <span class="dossard-trou bg"></span><span class="dossard-trou bd"></span>
      <div class="dossard-corps">${corps}</div>
    </${balise}>`;
}
export const NOM_DU_CLUB = NOM_CLUB;

// Pastille de statut cliquable (ouvre la feuille de choix) ou badge « En attente ».
export function pastilleStatut(c, membreId = etat.moi.id) {
  if (!c.validee) return '<span class="pastille attente">En attente</span>';
  const p = participationDe(c, membreId);
  const statut = p?.statut ?? null;
  if (membreId !== etat.moi.id) return statut ? `<span class="pastille ${statut}">${esc(STATUTS[statut]?.libelle ?? statut)}</span>` : '';
  if (!aVenir(c) && !statut) return '';
  const libelle = statut ? STATUTS[statut]?.libelle ?? statut : "J'y vais ?";
  return `<button class="pastille ${statut ?? ''}" type="button" data-action="ouvrir-statut" data-id="${esc(c.id)}"
            aria-label="${statut ? `Mon statut : ${esc(libelle)}. Changer` : 'Indiquer mon statut'}">${esc(libelle)}</button>`;
}

// Une ligne de course dans une liste. compteur = 'engages' | 'inscrits' | 'interesses'
// droite = HTML qui remplace la pastille de statut (ex. menu « ⋯ » dans Mes courses)
export function ligneCourse(c, { membreId = etat.moi.id, compteur = 'engages', droite = null } = {}) {
  const jour = String(enDate(c.date_course).getDate()).padStart(2, '0');
  const n = compteur === 'inscrits' ? nbStatut(c, 'inscrit') : compteur === 'interesses' ? nbStatut(c, 'interesse') : nbEngages(c);
  const unite = compteur === 'inscrits' ? 'inscrit' : compteur === 'interesses' ? 'intéressé' : 'engagé';
  const lieu = c.lieu ? `${esc(c.lieu)}${c.departement ? ` (${esc(c.departement)})` : ''}` : '';
  const ligne1 = [esc(libelleDiscipline(c.discipline)), c.format ? esc(c.format) : null, lieu || null].filter(Boolean).join(' · ');
  const badges = [];
  if (c.course_club) badges.push('<span class="badge badge-club">Course club</span>');
  if (c.date_a_confirmer) badges.push('<span class="badge">Date à confirmer</span>');
  const j = alerteCloture(c);
  if (j !== null && membreId === etat.moi.id) badges.push(`<span class="badge alerte">Clôture ${j === 0 ? "aujourd'hui" : `dans ${j} j`}</span>`);
  let detail = `${n ? `${n} ${unite}${n > 1 ? 's' : ''}` : 'personne pour l’instant'}`;
  const p = participationDe(c, membreId);
  const nbMessages = c.messages?.length ?? 0;
  if (nbMessages) detail += ` · ${nbMessages} message${nbMessages > 1 ? 's' : ''}`;
  if (!aVenir(c) && p?.temps) detail = `${membreId === etat.moi.id ? 'Ton temps' : 'Temps'} : ${esc(afficherTemps(p.temps))}${p.classement ? ` · ${esc(p.classement)}e` : ''}`;
  return `
    <div class="ligne${c.course_club ? ' course-club' : ''}${p && membreId === etat.moi.id ? ` statut-${p.statut}` : ''}">
      <a class="ligne-lien" href="#/course/${esc(c.id)}">
        <span class="ligne-jour" aria-hidden="true">${jour}</span>
        <span class="ligne-texte">
          <span class="ligne-nom">${esc(c.nom)}</span>
          <span class="ligne-detail">${ligne1}</span>
          <span class="ligne-detail">${badges.join(' ')} ${detail}</span>
        </span>
      </a>
      ${droite ?? pastilleStatut(c, membreId)}
    </div>`;
}

// Regroupe une liste de courses par mois.
export function parMois(liste, options) {
  const groupes = [];
  for (const c of liste) {
    const cle = c.date_course.slice(0, 7);
    let g = groupes.find((x) => x.cle === cle);
    if (!g) { g = { cle, titre: moisAnnee(c.date_course), courses: [] }; groupes.push(g); }
    g.courses.push(c);
  }
  return groupes.map((g) => `<div class="mois">${esc(g.titre)}</div><div class="liste">${g.courses.map((c) => ligneCourse(c, options)).join('')}</div>`).join('');
}

// Ma prochaine échéance sous forme de dossard.
export const maProchaineCourse = () => etat.courses
  .filter((c) => c.validee && aVenir(c) && ['inscrit', 'interesse', 'cherche_dossard'].includes(monStatut(c)))
  .sort((a, b) => a.date_course.localeCompare(b.date_course))[0];

export function dossardProchaine() {
  const p = maProchaineCourse();
  if (!p) {
    return dossard(NOM_CLUB, 'Saison', `
      <span class="dossard-chiffre petit">À toi</span>
      <span class="dossard-nom">Pas encore de course prévue</span>
      <span class="dossard-info">Choisis une course dans le calendrier et indique ton statut.</span>`, '#/calendrier');
  }
  const jours = joursAvant(p.date_course);
  // les autres membres engagés (hors forfait), sans me compter
  const autres = nbEngages(p) - 1;
  const statut = STATUTS[monStatut(p)]?.libelle ?? '';
  return dossard(NOM_CLUB, dateCourte(p.date_course), `
    <span class="dossard-chiffre">${jours <= 0 ? 'Jour J' : `J-${jours}`}</span>
    <span class="dossard-nom">${esc(p.nom)}</span>
    <span class="dossard-info">${esc(statut)} · ${autres > 0 ? `toi + ${autres} du club` : 'personne d’autre du club pour l’instant'}</span>`, `#/course/${esc(p.id)}`);
}

// Menu « ⋯ » des actions du bureau (modifier, supprimer…), pour ne pas encombrer les cartes.
// items : [[href, libellé]] pour un lien, [[action, libellé, id]] pour un bouton.
export function menuAdmin(items) {
  return `<details class="menu-admin"><summary aria-label="Actions du bureau">⋯</summary><div class="menu-admin-liste">
    ${items.map(([cible, libelle, id]) => (cible.startsWith('#')
      ? `<a href="${cible}">${esc(libelle)}</a>`
      : `<button type="button" data-action="${cible}" data-id="${esc(id ?? '')}" class="${/supprimer/.test(cible) ? 'danger' : ''}">${esc(libelle)}</button>`)).join('')}
  </div></details>`;
}

export const vide = (texte, action = '') => `<div class="vide"><p>${texte}</p>${action}</div>`;

export { jourMois, maParticipation };
