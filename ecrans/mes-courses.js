// =====================================================================
// ecrans/mes-courses.js — mes courses à venir, mes propositions, mes résultats.
// =====================================================================
import { STATUTS, DISCIPLINES } from '../config.js';
import { etat, aVenir, monStatut, maParticipation, course } from '../etat.js';
import { esc, afficherTemps, dateCourte } from '../outils.js';
import { entete, parMois, ligneCourse, menuAdmin } from './communs.js';

// Course passée : une ligne simple ; « ⋯ » pour corriger son statut ou son résultat.
function lignePassee(c) {
  const p = maParticipation(c);
  const libelle = STATUTS[p.statut]?.libelle ?? p.statut;
  return ligneCourse(c, { droite: `<span class="droite-passee"><span class="pastille ${esc(p.statut)}">${esc(libelle)}</span>
    ${menuAdmin([['modifier-resultat', p.statut === 'finisher' ? 'Modifier mon résultat' : 'Modifier', c.id], [`#/course/${esc(c.id)}`, 'Voir la course']])}</span>` });
}

// Feuille « Modifier » d'une course passée : finisher / forfait, temps et classement.
export function feuilleResultat(id) {
  const c = course(id);
  const p = c && maParticipation(c);
  if (!p) return '';
  return `
    <div class="feuille-corps feuille-resultat">
      <span class="etiquette">${esc(dateCourte(c.date_course))}</span>
      <h2 id="feuille-titre">${esc(c.nom)}</h2>
      <div class="choix-statut">
        ${['finisher', 'forfait'].map((cle) => `<button type="button" data-action="statut" data-id="${esc(c.id)}" data-valeur="${cle}" aria-pressed="${p.statut === cle}">${esc(STATUTS[cle].libelle)}</button>`).join('')}
      </div>
      ${p.statut === 'finisher' ? `
        <form data-form="resultat" data-id="${esc(c.id)}">
          <div class="deux">
            <div class="champ"><label for="t-res">Temps</label><input id="t-res" name="temps" placeholder="hh:mm:ss" inputmode="numeric" value="${esc(afficherTemps(p.temps))}"></div>
            <div class="champ"><label for="c-res">Classement</label><input id="c-res" name="classement" type="number" min="1" value="${esc(p.classement ?? '')}"></div>
          </div>
          <button class="bouton" type="submit">Enregistrer</button>
        </form>` : ''}
      <button class="bouton contour" type="button" data-action="fermer-feuille">Fermer</button>
    </div>`;
}

// Bilan de l'année en cours : courses terminées, forfaits, répartition par discipline.
function bilanSaison(miennes) {
  const annee = new Date().getFullYear();
  const delAnnee = miennes.filter((c) => c.date_course.startsWith(String(annee)) && !aVenir(c));
  const finies = delAnnee.filter((c) => monStatut(c) === 'finisher');
  const forfaits = delAnnee.filter((c) => monStatut(c) === 'forfait').length;
  if (!finies.length && !forfaits) return '';
  const parDiscipline = {};
  for (const c of finies) parDiscipline[c.discipline] = (parDiscipline[c.discipline] ?? 0) + 1;
  return `
    <section class="bloc bilan">
      <h2>Ma saison ${annee}</h2>
      <p class="bilan-chiffres"><strong>${finies.length}</strong> course${finies.length > 1 ? 's' : ''} terminée${finies.length > 1 ? 's' : ''}${forfaits ? ` · ${forfaits} forfait${forfaits > 1 ? 's' : ''}` : ''}</p>
      ${finies.length ? `<p class="aide" style="margin:0">${Object.entries(parDiscipline).map(([d, n]) => `${esc(DISCIPLINES[d] ?? d)} : ${n}`).join(' · ')}</p>` : ''}
    </section>`;
}

export function ecranMesCourses() {
  const miennes = etat.courses.filter((c) => c.validee && monStatut(c));
  const futures = miennes.filter(aVenir);
  const passees = miennes.filter((c) => !aVenir(c)).reverse();
  const propositions = etat.courses.filter((c) => !c.validee && c.creee_par === etat.moi.id);
  return `
    ${entete('Mes courses', `<span class="etiquette">${futures.length} à venir</span>`)}
    <p class="sous-titre">${esc(etat.moi.prenom)} ${esc(etat.moi.nom)}</p>
    ${bilanSaison(miennes)}
    ${futures.length ? parMois(futures) : '<p class="vide">Aucune course prévue.</p>'}
    ${futures.some((c) => monStatut(c) !== 'forfait') ? `<button class="lien-action" type="button" data-action="agenda-tout">Ajouter mes courses à venir à mon agenda</button>` : ''}
    ${propositions.length ? `<div class="mois">Mes propositions en attente</div><div class="liste">${propositions.map((c) => ligneCourse(c)).join('')}</div>` : ''}
    <div class="mois">Courses passées · ${passees.length}</div>
    ${passees.length ? `<div class="liste">${passees.map(lignePassee).join('')}</div>` : '<p class="vide">Aucune course passée enregistrée.</p>'}`;
}
