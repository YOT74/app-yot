// brouillons.js — garde ce qu'on est en train d'écrire (actualité, message, proposition de course)
// sur le téléphone, pour le retrouver si on quitte l'écran avant de publier.
// Un formulaire porte data-brouillon="clé" ; le brouillon est effacé une fois publié.
const PREFIXE = 'brouillon:';
const lire = (cle) => { try { return JSON.parse(localStorage.getItem(PREFIXE + cle)) || null; } catch { return null; } };
const ecrire = (cle, valeurs) => { try { localStorage.setItem(PREFIXE + cle, JSON.stringify(valeurs)); } catch { /* stockage indisponible */ } };
export const effacerBrouillon = (cle) => { try { localStorage.removeItem(PREFIXE + cle); } catch { /* rien */ } };

const champsTexte = (form) => [...form.elements].filter((e) => e.name && (e.tagName === 'TEXTAREA' || ['text', 'url', 'date', 'time', 'number', 'search'].includes(e.type)));
const avecContenu = (valeurs) => Object.values(valeurs).some((v) => String(v).trim());

// À chaque frappe : on enregistre (ou on efface si tout est vide).
export function suivreBrouillons() {
  document.addEventListener('input', (ev) => {
    const form = ev.target.closest?.('form[data-brouillon]');
    if (!form) return;
    const valeurs = Object.fromEntries(champsTexte(form).map((e) => [e.name, e.value]));
    if (avecContenu(valeurs)) ecrire(form.dataset.brouillon, valeurs);
    else effacerBrouillon(form.dataset.brouillon);
  });
}

// Après chaque affichage : on remet les brouillons dans les champs encore vides.
export function restaurerBrouillons() {
  for (const form of document.querySelectorAll('form[data-brouillon]')) {
    const valeurs = lire(form.dataset.brouillon);
    if (!valeurs) continue;
    let remis = false;
    for (const e of champsTexte(form)) {
      const v = valeurs[e.name];
      if (v !== undefined && e.value !== v) { e.value = v; remis = true; }
    }
    if (remis && !form.querySelector('.brouillon-repris')) {
      form.insertAdjacentHTML('beforeend', '<p class="aide brouillon-repris" style="margin:0">Brouillon repris. <button type="button" class="lien-discret" data-action="jeter-brouillon">Effacer</button></p>');
    }
  }
}
