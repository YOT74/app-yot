// gestes.js — gestes tactiles :
//   • planning : glisser vers la gauche / la droite pour changer de semaine
//     (sauf dans la grille de la vue semaine, qui défile déjà horizontalement) ;
//   • tous les écrans : tirer vers le bas en haut de page pour actualiser.
import { etat } from './etat.js';
import { ajouterJours, lundiDe, aujourdhui } from './outils.js';

let depart = null;     // { x, y, haut: page tout en haut au départ, defile: dans une zone qui défile en largeur }
let indicateur = null;

function montrerIndicateur(etape) {
  if (!indicateur) {
    indicateur = document.createElement('div');
    indicateur.className = 'tirer-actualiser';
    document.body.append(indicateur);
  }
  indicateur.textContent = etape === 'charge' ? 'Actualisation…' : etape === 'pret' ? 'Relâche pour actualiser' : 'Tire pour actualiser';
  indicateur.dataset.etape = etape;
  indicateur.hidden = false;
}
const cacherIndicateur = () => { if (indicateur) indicateur.hidden = true; };

export function activerGestes({ afficher, actualiser }) {
  document.addEventListener('touchstart', (ev) => {
    if (ev.touches.length !== 1 || document.querySelector('dialog[open]')) { depart = null; return; }
    const t = ev.touches[0];
    depart = {
      x: t.clientX, y: t.clientY,
      haut: window.scrollY <= 0,
      defile: !!ev.target.closest('.grille-semaine, .puces, .vignettes-actu, input, textarea, select'),
    };
  }, { passive: true });

  document.addEventListener('touchmove', (ev) => {
    if (!depart?.haut || !etat.moi) return;
    const dy = ev.touches[0].clientY - depart.y;
    const dx = Math.abs(ev.touches[0].clientX - depart.x);
    if (dy > 30 && dy > dx * 1.5) montrerIndicateur(dy > 90 ? 'pret' : 'tirer');
    else cacherIndicateur();
  }, { passive: true });

  document.addEventListener('touchend', async (ev) => {
    if (!depart) return;
    const t = ev.changedTouches[0];
    const dx = t.clientX - depart.x;
    const dy = t.clientY - depart.y;
    const d = depart;
    depart = null;

    // tirer vers le bas en haut de page → actualiser
    if (d.haut && etat.moi && dy > 90 && dy > Math.abs(dx) * 1.5) {
      montrerIndicateur('charge');
      try { await actualiser(); } finally { cacherIndicateur(); }
      return;
    }
    cacherIndicateur();

    // planning : balayage horizontal → semaine précédente / suivante
    if (location.hash.startsWith('#/entrainement') && !d.defile && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2) {
      const debut = etat.semaine || lundiDe(aujourdhui());
      etat.semaine = ajouterJours(debut, dx < 0 ? 7 : -7);
      afficher();
    }
  }, { passive: true });
}
