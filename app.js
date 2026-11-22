// =====================================================================
// app.js — point d'entrée : démarre l'app et gère les mises à jour.
//
// Où est quoi :
//   config.js        réglages (Supabase, statuts, disciplines, libellés)
//   etat.js          état de l'app et questions courantes (suis-je bureau ?…)
//   outils.js        texte, dates, icônes
//   donnees.js       lecture/écriture Supabase (demo.js en mode démo)
//   rendu.js         choix de l'écran selon l'adresse, barre du bas, chargement
//   actions.js       boutons et formulaires
//   ecrans/*.js      un fichier par rubrique (accueil, calendrier, course…)
//   import-excel.js  lecture du planning Excel du coach (avec lecteur-xlsx.js)
// =====================================================================
import { etat } from './etat.js';
import { emailConnecte } from './auth.js';
import { afficher, charger, voirNotifications, rafraichir } from './rendu.js';
import { tutoAVoir } from './actions.js';
import { DELAI_RENVOI } from './config.js';
import { ecouterInstallation } from './installation.js';
import { activerGestes } from './gestes.js';
import { suivreBrouillons } from './brouillons.js';

suivreBrouillons();

ecouterInstallation(() => afficher());
activerGestes({ afficher, actualiser: () => rafraichir(true) });

// Bouton « Recevoir un nouveau code » : compte à rebours avant de pouvoir redemander.
setInterval(() => {
  const b = document.querySelector('[data-renvoi]');
  if (!b) return;
  const reste = Math.ceil((Number(b.dataset.renvoi) + DELAI_RENVOI * 1000 - Date.now()) / 1000);
  const texte = reste > 0 ? `Nouveau code possible dans ${reste} s` : 'Recevoir un nouveau code';
  if (b.textContent !== texte) b.textContent = texte;
  if (!etat.connexion?.envoi) b.disabled = reste > 0;
}, 500);

window.addEventListener('hashchange', (ev) => {
  const avant = new URL(ev.oldURL).hash || '#/';
  // on ouvre les notifications : on retient d'où l'on vient (flèche retour) et on les marque vues
  if (location.hash.startsWith('#/notifications') && !/^#\/(notifications|reglages)/.test(avant)) {
    etat.retourNotifs = avant;
    voirNotifications();
  }
  afficher();
  window.scrollTo(0, 0);
  // depuis une notification de discussion : on descend directement au fil
  if (etat.defilerVers) { document.getElementById(etat.defilerVers)?.scrollIntoView({ block: 'start' }); etat.defilerVers = null; }
});
window.addEventListener('online', () => { if (etat.horsLigne) charger(); });

// --- Mises à jour de l'app (service worker) -----------------------------------
function proposerMiseAJour(travailleur) {
  const bandeau = document.getElementById('bandeau');
  bandeau.classList.remove('info');
  bandeau.innerHTML = '<span>Nouvelle version disponible</span><button type="button">Recharger</button>';
  bandeau.hidden = false;
  bandeau.querySelector('button').addEventListener('click', () => travailleur.postMessage('activer'), { once: true });
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then((enregistrement) => {
    if (enregistrement.waiting && navigator.serviceWorker.controller) proposerMiseAJour(enregistrement.waiting);
    enregistrement.addEventListener('updatefound', () => {
      const nouveau = enregistrement.installing;
      nouveau?.addEventListener('statechange', () => {
        if (nouveau.state === 'installed' && navigator.serviceWorker.controller) proposerMiseAJour(nouveau);
      });
    });
  }).catch((e) => console.warn('Service worker non enregistré', e));
  // Recharger seulement lors d'une MISE À JOUR (pas à la toute première installation).
  const avaitControleur = !!navigator.serviceWorker.controller;
  let rechargee = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (avaitControleur && !rechargee) { rechargee = true; window.location.reload(); }
  });
}

// --- Démarrage -------------------------------------------------------------------
(async function demarrer() {
  etat.email = await emailConnecte();
  afficher();
  if (etat.email) {
    await charger();
    if (etat.moi && tutoAVoir()) { etat.tuto = 0; afficher(); }
  }
})();
