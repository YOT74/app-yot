// installation.js — proposer d'installer l'app sur l'écran d'accueil du téléphone.
// Android (Chrome) : le navigateur fournit une fenêtre d'installation qu'on déclenche au clic.
// iPhone (Safari) : pas de fenêtre possible, on montre les étapes à suivre.
import { etat } from './etat.js';

export const estInstallee = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

export const estIphone = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Le bouton n'apparaît que si on peut vraiment aider : fenêtre Android disponible, ou iPhone.
export const installationPossible = () => !estInstallee() && (!!etat.invitationInstall || estIphone());

export function ecouterInstallation(redessiner) {
  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();             // on garde la fenêtre pour notre bouton
    etat.invitationInstall = ev;
    redessiner();
  });
  window.addEventListener('appinstalled', () => { etat.invitationInstall = null; redessiner(); });
}

// Étapes pour iPhone, affichées dans la feuille du bas.
const PARTAGER = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
const AJOUTER = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>';
export function etapesIphone() {
  return `<div class="feuille-corps">
    <h2 style="margin:0">Installer l’app sur ton iPhone</h2>
    <ol class="etapes-install">
      <li><span class="etape-num">1</span><span>Ouvre cette page dans <strong>Safari</strong>.</span></li>
      <li><span class="etape-num">2</span><span>Touche le bouton <strong>Partager</strong> <span class="etape-icone">${PARTAGER}</span> en bas de l’écran.</span></li>
      <li><span class="etape-num">3</span><span>Choisis <strong>Sur l’écran d’accueil</strong> <span class="etape-icone">${AJOUTER}</span>, puis <strong>Ajouter</strong>.</span></li>
    </ol>
    <p class="aide" style="margin:0">L’app apparaît ensuite avec son icône, comme les autres applications.</p>
    <button class="bouton contour" type="button" data-action="fermer-feuille">J’ai compris</button>
  </div>`;
}
