// =====================================================================
// ecrans/connexion.js — inscription / connexion, choix du nom, tuto d'accueil.
// =====================================================================
import { MODE_DEMO, LONGUEUR_CODE, NOM_CLUB, CONNEXION_GOOGLE, CONNEXION_APPLE } from '../config.js';
import { etat } from '../etat.js';
import { esc, icone } from '../outils.js';
import { dossard } from './communs.js';

// Comptes de démonstration (mode démo seulement) : un clic pour entrer.
const COMPTES_DEMO = [
  { email: 'sophie.marchand@club-tri.fr', libelle: 'Sophie', role: 'membre' },
  { email: 'camille.ferrand@club-tri.fr', libelle: 'Camille', role: 'bureau' },
  { email: 'marc.villeneuve@club-tri.fr', libelle: 'Marc', role: 'coach' },
];

const LOGO_GOOGLE = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const LOGO_APPLE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M16.4 12.6c0-2.5 2.1-3.7 2.2-3.8-1.2-1.7-3-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.2-.9-2.2-4.2zM13.9 5.2c.7-.8 1.1-1.9 1-3-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.6 2.9-1.4z"/></svg>';

export function ecranConnexion() {
  const c = etat.connexion;
  const formulaire = c.etape === 'email'
    ? `<form data-form="connexion-email">
         <div class="champ">
           <label for="email">Ton adresse email</label>
           <input id="email" name="email" type="email" autocomplete="email" inputmode="email" required value="${esc(c.email)}">
         </div>
         ${c.erreur ? `<p class="erreur">${esc(c.erreur)}</p>` : ''}
         <button class="bouton large" type="submit" ${c.envoi ? 'disabled' : ''}>${c.envoi ? 'Envoi…' : 'Recevoir mon code'}</button>
       </form>`
    : `<form data-form="connexion-code">
         <div class="champ">
           <label for="code">Code reçu par email</label>
           <div class="code-cases">
             <input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="${LONGUEUR_CODE}" spellcheck="false" aria-describedby="code-aide">
             <div class="code-affichage" aria-hidden="true">${'<span>_</span>'.repeat(LONGUEUR_CODE)}</div>
           </div>
           <span class="aide" id="code-aide">${c.renvoye ? 'Un nouveau code' : 'Un code'} a été envoyé à ${esc(c.email)}. Pense à vérifier tes courriers indésirables.</span>
         </div>
         ${c.erreur ? `<p class="erreur">${esc(c.erreur)}</p>` : ''}
         <button class="bouton large" type="submit" ${c.envoi ? 'disabled' : ''}>${c.envoi ? 'Vérification…' : 'Valider'}</button>
         <button class="bouton contour large" type="button" data-action="renvoyer-code" data-renvoi="${c.envoyeLe || 0}" ${c.envoi ? 'disabled' : ''}>Recevoir un nouveau code</button>
         <button class="bouton discret large" type="button" data-action="changer-email">Changer d'adresse email</button>
       </form>`;

  return `
    <section class="connexion">
      ${dossard(NOM_CLUB, 'Bienvenue', `
        <span class="dossard-chiffre petit">Inscription</span>
        <span class="dossard-info">Renseigne ton adresse email pour recevoir un code de connexion.</span>`)}
      ${formulaire}
      ${c.etape === 'email' && !MODE_DEMO && (CONNEXION_GOOGLE || CONNEXION_APPLE) ? `
        <div class="separateur"><span>ou</span></div>
        <div class="fournisseurs">
          ${CONNEXION_GOOGLE ? `<button class="bouton contour large fournisseur" type="button" data-action="connexion-fournisseur" data-valeur="google">${LOGO_GOOGLE} Continuer avec Google</button>` : ''}
          ${CONNEXION_APPLE ? `<button class="bouton large fournisseur apple" type="button" data-action="connexion-fournisseur" data-valeur="apple">${LOGO_APPLE} Continuer avec Apple</button>` : ''}
        </div>` : ''}
      ${MODE_DEMO && c.etape === 'email' ? `
        <div class="avertissement">
          <p style="margin:0 0 10px">Mode démo : choisis un compte ou saisis une adresse quelconque (le code peut être composé de ${LONGUEUR_CODE} chiffres au choix).</p>
          <div class="rangee">${COMPTES_DEMO.map((d) => `<button class="bouton contour" type="button" data-action="demo-entrer" data-email="${d.email}">${d.libelle} · ${d.role}</button>`).join('')}</div>
        </div>` : ''}
    </section>`;
}

export function ecranInscription() {
  return `
    <section class="connexion">
      ${dossard(NOM_CLUB, 'Bienvenue', `
        <span class="dossard-chiffre petit">Ton nom</span>
        <span class="dossard-info">Indique ton prénom et ton nom tels que le club te connaît.</span>`)}
      <form data-form="inscription">
        <div class="champ"><label for="prenom">Prénom</label><input id="prenom" name="prenom" required maxlength="40" autocomplete="given-name"></div>
        <div class="champ"><label for="nom">Nom</label><input id="nom" name="nom" required maxlength="40" autocomplete="family-name"></div>
        <div class="champ"><label for="heures">Combien d'heures t'entraînes-tu par semaine ?</label>
          <input id="heures" name="heures" type="number" min="0" max="40" step="0.5" inputmode="decimal" required placeholder="ex. 8">
          <span class="aide">Cette information permet de t’affecter au groupe de niveau correspondant.</span></div>
        <p class="aide" style="margin:0">Connecté avec l’adresse ${esc(etat.email)}.</p>
        ${etat.erreurInscription ? `<p class="erreur">${esc(etat.erreurInscription)}</p>` : ''}
        <button class="bouton large" type="submit">C'est parti</button>
        <button class="bouton discret large" type="button" data-action="deconnexion">Ce n'est pas mon adresse</button>
      </form>
    </section>`;
}

// --- Tuto d'accueil : quelques écrans, un geste pour passer -----------------
export const ETAPES_TUTO = [
  { icone: icone.accueil, titre: 'Ton accueil', texte: "Retrouve ta prochaine course, les clôtures d'inscription, les actualités du club et la prochaine séance." },
  { icone: icone.calendrier, titre: 'Le calendrier', texte: "Consulte les courses auxquelles participent les membres. Recherche une course pour l'ajouter, ou sélectionne-la pour voir qui y participe." },
  { icone: icone.dossard, titre: 'Ton statut en un geste', texte: 'Indique si tu es intéressé, inscrit ou si tu vends ton dossard en touchant la pastille. Chaque course dispose de son fil de discussion.' },
  { icone: icone.entrainement, titre: 'Le planning', texte: "Consulte les séances de ton groupe, sous forme de liste ou de semaine." },
  { icone: icone.cloche, titre: 'Les notifications', texte: 'La cloche t’informe des nouveautés concernant tes courses et la vie du club.' },
];

export function tuto(index) {
  const e = ETAPES_TUTO[index];
  const derniere = index === ETAPES_TUTO.length - 1;
  return `
    <div class="tuto" role="dialog" aria-modal="true" aria-labelledby="tuto-titre">
      <div class="tuto-carte">
        <div class="tuto-haut">
          <span class="etiquette">${index + 1} / ${ETAPES_TUTO.length}</span>
          ${derniere ? '' : '<button class="bouton discret petit" type="button" data-action="tuto-fin">Passer</button>'}
        </div>
        <div class="tuto-icone">${e.icone}</div>
        <h2 id="tuto-titre">${e.titre}</h2>
        <p>${e.texte}</p>
        <div class="tuto-points" aria-hidden="true">${ETAPES_TUTO.map((_, i) => `<span class="${i === index ? 'actif' : ''}"></span>`).join('')}</div>
        <div class="rangee tuto-boutons">
          ${index > 0 ? '<button class="bouton contour" type="button" data-action="tuto-precedent">Retour</button>' : ''}
          <button class="bouton" type="button" data-action="${derniere ? 'tuto-fin' : 'tuto-suivant'}">${derniere ? "C'est parti" : 'Suivant'}</button>
        </div>
      </div>
    </div>`;
}
