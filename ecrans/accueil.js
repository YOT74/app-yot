// =====================================================================
// ecrans/accueil.js — accueil (tableau de bord) et formulaire d'actualité.
// =====================================================================
import { DISCIPLINES_SEANCE } from '../config.js';
import { etat, estBureau, course, alerteCloture, nbNonLues, nomMembre, nbEngages } from '../etat.js';
import { esc, icone, aujourdhui, dateLongue, dateCourte, ilYa, jourMois } from '../outils.js';
import { entete, dossardProchaine, maProchaineCourse, ligneCourse, retour, menuAdmin } from './communs.js';
import { formaterTexte, barreFormat } from '../texte-riche.js';
import { seanceDuGroupe } from './entrainement.js';
import { ajouterJours } from '../outils.js';

const partenaireExpire = (p) => p.valable_jusqu_au && p.valable_jusqu_au < aujourdhui();

// Texte coupé à 3 lignes, avec « Lire la suite » quand il est long.
function texteActu(a) {
  const long = a.contenu.length > 160 || a.contenu.split('\n').length > 3;
  const ouvert = etat.actusOuvertes.includes(a.id);
  return `<div class="texte-riche${long && !ouvert ? ' coupe' : ''}">${formaterTexte(a.contenu)}</div>
    ${long ? `<button class="lien-mini" type="button" data-action="lire-actu" data-id="${esc(a.id)}">${ouvert ? 'Réduire' : 'Lire la suite'}</button>` : ''}`;
}

// Sans course prévue : les 3 prochaines courses où des membres sont engagés, pour donner des idées.
function ouVaLeClub() {
  const idees = etat.courses.filter((c) => c.validee && c.date_course >= aujourdhui() && nbEngages(c) > 0)
    .sort((a, b) => a.date_course.localeCompare(b.date_course)).slice(0, 3);
  if (!idees.length) return '';
  return `<section class="encart">
    <h2>Où va le club</h2>
    <div class="liste">${idees.map((c) => ligneCourse(c)).join('')}</div>
    <a class="lien-discret" href="#/calendrier">Voir tout le calendrier</a>
  </section>`;
}

// Adresse d'image acceptée : stockage Supabase (https) ou image locale du mode démo.
export const imageSure = (u) => (/^https:\/\//i.test(u || '') || /^data:image\/jpeg;base64,/i.test(u || '') ? u : null);

// Photos d'une actualité : vignettes, ouvertes en grand au toucher.
function galerie(photos) {
  const sures = photos.map(imageSure).filter(Boolean);
  return `<div class="galerie n${Math.min(sures.length, 4)}">${sures.map((u) => `
    <button type="button" data-action="voir-photo" data-valeur="${esc(u)}" aria-label="Agrandir la photo">
      <img src="${esc(u)}" alt="" loading="lazy" decoding="async"></button>`).join('')}</div>`;
}

// Vignettes du formulaire : photos déjà publiées puis nouvelles, chacune avec sa croix.
export function vignettesActu() {
  const e = etat.photosActu;
  const toutes = [...e.gardees.map((u) => ({ src: imageSure(u), type: 'gardee', u })), ...e.nouvelles.map((n, i) => ({ src: n.apercu, type: 'nouvelle', u: String(i) }))];
  return `<div class="vignettes-actu" id="vignettes-actu">
    ${toutes.map((p) => `<div class="vignette"><img src="${esc(p.src)}" alt="">
      <button type="button" data-action="retirer-photo-actu" data-id="${p.type}" data-valeur="${esc(p.u)}" aria-label="Retirer la photo">×</button></div>`).join('')}
    ${toutes.length < 4 ? `<label class="vignette vignette-ajout">${icone.ajouter}<span>Photo</span>
      <input type="file" accept="image/*" multiple hidden data-action="photos-actu"></label>` : ''}
  </div>`;
}

// Sondage : un bouton par choix, avec la barre des résultats ; toucher son choix l'annule.
function blocSondage(a) {
  const votes = a.votes_sondage ?? [];
  const mesChoix = votes.filter((v) => v.membre_id === etat.moi.id).map((v) => v.option);
  const votants = new Set(votes.map((v) => v.membre_id)).size;
  const parOption = a.sondage_options.map((_, i) => votes.filter((v) => v.option === i));
  const ouvert = !a.sondage_clos;
  return `
    <div class="sondage">
      <span class="aide">${a.sondage_clos ? 'Sondage clos' : a.sondage_multiple ? 'Sondage · plusieurs choix' : 'Sondage · une réponse'}</span>
      ${a.sondage_options.map((libelle, i) => {
        const n = parOption[i].length;
        const pct = votants ? Math.round((n / votants) * 100) : 0;
        const moi = mesChoix.includes(i);
        return `<button type="button" class="choix-sondage${moi ? ' mon-choix' : ''}" ${ouvert ? `data-action="voter" data-id="${esc(a.id)}" data-valeur="${i}"` : 'disabled'} aria-pressed="${moi}" style="--pct:${pct}%">
          <span class="choix-libelle">${moi ? '✓ ' : ''}${esc(libelle)}</span><span class="choix-compte">${n} · ${pct} %</span></button>`;
      }).join('')}
      <details class="repli"><summary>${votants} votant${votants > 1 ? 's' : ''}${votants ? ' · voir qui' : ''}</summary>
        ${a.sondage_options.map((libelle, i) => parOption[i].length ? `<p class="aide" style="margin:4px 0 0"><strong>${esc(libelle)}</strong> : ${parOption[i].map((v) => esc(nomMembre(v.membre_id))).join(', ')}</p>` : '').join('')}
      </details>
    </div>`;
}

function carteActu(a) {
  const c = a.course_id ? course(a.course_id) : null;
  return `
    <article class="actu${a.epinglee ? ' epinglee' : ''}">
      <div class="actu-haut">
        <span class="etiquette">${a.epinglee ? 'Épinglée · ' : ''}${esc(ilYa(a.publiee_le))}</span>
        ${estBureau() ? menuAdmin([[`#/actualite/${esc(a.id)}`, 'Modifier'],
          ...(a.sondage_options ? [[a.sondage_clos ? 'rouvrir-sondage' : 'clore-sondage', a.sondage_clos ? 'Rouvrir le sondage' : 'Clore le sondage', a.id]] : []),
          ['supprimer-actu', 'Supprimer', a.id]]) : ''}
      </div>
      <h3>${esc(a.titre)}</h3>
      ${a.contenu ? texteActu(a) : ''}
      ${a.photos?.length ? galerie(a.photos) : ''}
      ${a.sondage_options ? blocSondage(a) : ''}
      ${c ? `<a class="lien-course" href="#/course/${esc(c.id)}">${esc(c.nom)} · ${esc(jourMois(c.date_course))} ${icone.suivant}</a>` : ''}
      <p class="aide" style="margin:0">Par ${esc(nomMembre(a.cree_par))}</p>
    </article>`;
}

export function ecranAccueil() {
  const n = nbNonLues();
  const sombre = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const bascule = `<button class="cloche bascule-theme" type="button" data-action="basculer-theme" aria-label="${sombre ? 'Passer en mode clair' : 'Passer en mode sombre'}">${sombre ? icone.soleil : icone.lune}</button>`;
  const cloche = `<a class="cloche" href="#/notifications" aria-label="Notifications${n ? ` : ${n} non lue${n > 1 ? 's' : ''}` : ''}">${icone.cloche}${n ? `<span class="compteur">${n > 9 ? '9+' : n}</span>` : ''}</a>`;

  const clotures = etat.courses.filter((c) => alerteCloture(c) !== null)
    .sort((a, b) => a.date_limite_inscription.localeCompare(b.date_limite_inscription));

  // Séance du jour jusqu'à 19 h 30 (heure des dernières séances), séance de demain ensuite.
  const maintenant = new Date();
  const avantSoir = maintenant.getHours() * 60 + maintenant.getMinutes() < 19 * 60 + 30;
  const jourSeance = avantSoir ? aujourdhui() : ajouterJours(aujourdhui(), 1);
  const duJour = etat.seances.filter((s) => s.date === jourSeance && seanceDuGroupe(s, true))   // mes séances
    .sort((a, b) => (a.heure || '').localeCompare(b.heure || ''));
  const seances = duJour.filter((s) => s.discipline !== 'repos');
  const repos = !seances.length && duJour.some((s) => s.discipline === 'repos');

  const actus = [...etat.actualites].sort((a, b) => (a.epinglee !== b.epinglee ? (a.epinglee ? -1 : 1) : b.publiee_le.localeCompare(a.publiee_le)));
  const visibles = etat.toutesActus ? actus : actus.slice(0, 3);
  const avantages = etat.partenaires.filter((p) => p.actif && !partenaireExpire(p)).length;

  return `
    ${entete(`Bonjour ${esc(etat.moi.prenom)}`, `<span class="entete-boutons">${bascule}${cloche}</span>`)}
    <p class="sous-titre">${esc(dateLongue(aujourdhui()))}</p>
    ${dossardProchaine()}
    ${maProchaineCourse() ? '' : ouVaLeClub()}

    ${clotures.length ? `
      <section class="encart alerte">
        <h2>Inscriptions qui ferment bientôt</h2>
        ${clotures.map((c) => {
          const j = alerteCloture(c);
          return `<a class="encart-lien" href="#/course/${esc(c.id)}"><span><strong>${esc(c.nom)}</strong><br>
            <span class="aide">Clôture ${j === 0 ? "aujourd'hui" : `dans ${j} jour${j > 1 ? 's' : ''}`} · course le ${esc(jourMois(c.date_course))}</span></span>${icone.suivant}</a>`;
        }).join('')}
      </section>` : ''}

    ${etat.seances.length ? `
      <section class="encart">
        <h2>${avantSoir ? 'Séance du jour' : 'Séance de demain'}</h2>
        ${repos || !seances.length ? `<a class="encart-lien" href="#/entrainement"><span><strong>${repos ? 'Repos' : 'Pas de séance prévue'}</strong></span>${icone.suivant}</a>`
          : seances.map((s) => `<a class="encart-lien" href="#/entrainement"><span><strong>${esc(s.titre)}</strong><br>
          <span class="aide">${esc(DISCIPLINES_SEANCE[s.discipline] ?? s.discipline)}${s.heure ? ` · ${esc(s.heure)}` : ''}${s.duree ? ` · ${esc(s.duree)}` : ''}${s.lieu ? ` · ${esc(s.lieu)}` : ''}</span></span>${icone.suivant}</a>`).join('')}
      </section>` : ''}

    <div class="mois mois-action">Actualités du club
      ${estBureau() ? `<a class="bouton petit discret" href="#/actualite/nouvelle">${icone.ajouter} Publier</a>` : ''}</div>
    ${visibles.length ? visibles.map(carteActu).join('') : '<p class="vide">Aucune actualité pour le moment.</p>'}
    ${actus.length > 3 && !etat.toutesActus ? '<button class="bouton discret" type="button" data-action="toutes-actus">Voir les actualités plus anciennes</button>' : ''}

    <a class="encart encart-lien" href="#/partenaires">
      <span><strong>Partenaires du club</strong><br><span class="aide">${avantages} avantage${avantages > 1 ? 's' : ''} en cours</span></span>${icone.suivant}
    </a>`;
}

export function ecranFormulaireActu(id) {
  const a = id ? etat.actualites.find((x) => x.id === id) : null;
  if (id && !a) return `${retour('#/', 'Accueil')}<p class="vide">Cette actualité n'existe plus.</p>`;
  const futures = etat.courses.filter((c) => c.validee && c.date_course >= aujourdhui());
  // photos en cours d'édition, gardées entre deux affichages du formulaire
  if (etat.photosActu?.pour !== (id || 'nouvelle')) {
    etat.photosActu = { pour: id || 'nouvelle', gardees: [...(a?.photos ?? [])], nouvelles: [], retirees: [] };
  }
  return `
    ${retour('#/', 'Accueil')}
    <h1 class="fiche-titre">${a ? "Modifier l'actualité" : 'Publier une actualité'}</h1>
    <form data-form="actualite" data-id="${esc(a?.id ?? '')}">
      <div class="champ"><label for="titre">Titre</label><input id="titre" name="titre" required maxlength="120" value="${esc(a?.titre ?? '')}"></div>
      <div class="champ"><label for="contenu">Texte</label>
        ${barreFormat('contenu')}
        <textarea id="contenu" name="contenu" maxlength="4000" rows="7">${esc(a?.contenu ?? '')}</textarea>
        <span class="aide">Sélectionne un mot puis touche <strong>G</strong>, <em>I</em> ou le lien. Un lien collé devient cliquable.</span></div>
      <div class="champ"><span class="libelle">Photos (4 au plus)</span>${vignettesActu()}</div>
      <div class="champ"><label for="course_id">Course liée (facultatif)</label>
        <select id="course_id" name="course_id"><option value="">—</option>
          ${futures.map((c) => `<option value="${esc(c.id)}" ${a?.course_id === c.id ? 'selected' : ''}>${esc(c.nom)} · ${esc(jourMois(c.date_course))}</option>`).join('')}
        </select></div>
      <label class="champ champ-case"><input type="checkbox" name="epinglee" ${a?.epinglee ? 'checked' : ''}> Épingler en haut de l'accueil</label>
      <details class="bloc sondage-form" ${a?.sondage_options ? 'open' : ''}>
        <summary>Ajouter un sondage</summary>
        <p class="aide" style="margin:0">Le titre fait office de question.${a?.votes_sondage?.length ? ' Attention : des membres ont déjà voté.' : ''}</p>
        <div class="champ"><label for="options">Choix (un par ligne, de 2 à 10)</label>
          <textarea id="options" name="options" rows="4" placeholder="60 km tranquille&#10;90 km avec un col&#10;Je ne viens pas">${esc((a?.sondage_options ?? []).join('\n'))}</textarea></div>
        <label class="champ champ-case"><input type="checkbox" name="multiple" ${a?.sondage_multiple ? 'checked' : ''}> Plusieurs réponses possibles</label>
      </details>
      <p class="erreur" data-erreur hidden></p>
      <button class="bouton large" type="submit">${a ? 'Enregistrer' : 'Publier'}</button>
    </form>`;
}
