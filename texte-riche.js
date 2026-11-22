// texte-riche.js — mise en forme simple des actualités : **gras**, *italique*,
// [texte](https://lien), listes « - », et liens collés tels quels rendus cliquables.
// Tout le texte est d'abord échappé : seules ces balises-là peuvent apparaître.
import { esc } from './outils.js';

const LIEN_MD = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;
const LIEN_NU = /https?:\/\/[^\s<]+/g;

function enLigne(texte) {
  const gardes = [];
  const garder = (html) => `\u0000${gardes.push(html) - 1}\u0000`;
  const lien = (url, libelle) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${libelle}</a>`;
  let t = texte.replace(LIEN_MD, (_, libelle, url) => garder(lien(url, libelle)));
  t = t.replace(LIEN_NU, (url) => {
    const fin = url.match(/[.,;:!?)]+$/)?.[0] ?? '';   // ponctuation collée au lien
    const propre = fin ? url.slice(0, -fin.length) : url;
    return garder(lien(propre, propre)) + fin;
  });
  t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
       .replace(/(^|[^*\w])\*([^*\n]+)\*(?![*\w])/g, '$1<em>$2</em>')
       .replace(/(^|[^_\w])_([^_\n]+)_(?![_\w])/g, '$1<em>$2</em>');
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => gardes[Number(i)]);
}

export function formaterTexte(brut) {
  const blocs = [];
  let paragraphe = [];
  let liste = [];
  const fermer = () => {
    if (paragraphe.length) blocs.push(`<p>${paragraphe.join('<br>')}</p>`);
    if (liste.length) blocs.push(`<ul>${liste.map((l) => `<li>${l}</li>`).join('')}</ul>`);
    paragraphe = []; liste = [];
  };
  for (const ligne of esc(brut ?? '').split('\n')) {
    const puce = ligne.match(/^\s*[-•]\s+(.*)$/);
    if (puce) { if (paragraphe.length) { blocs.push(`<p>${paragraphe.join('<br>')}</p>`); paragraphe = []; } liste.push(enLigne(puce[1])); }
    else if (!ligne.trim()) fermer();
    else { if (liste.length) fermer(); paragraphe.push(enLigne(ligne)); }
  }
  fermer();
  return blocs.join('');
}

// Barre d'outils au-dessus d'un champ de texte (id = cible).
export const barreFormat = (cible) => `
  <div class="barre-format" role="toolbar" aria-label="Mise en forme">
    <button type="button" data-action="format" data-valeur="gras" data-cible="${cible}" aria-label="Gras"><strong>G</strong></button>
    <button type="button" data-action="format" data-valeur="italique" data-cible="${cible}" aria-label="Italique"><em>I</em></button>
    <button type="button" data-action="format" data-valeur="lien" data-cible="${cible}" aria-label="Lien">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg></button>
    <button type="button" data-action="format" data-valeur="liste" data-cible="${cible}" aria-label="Liste à puces">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg></button>
  </div>`;

// Applique un format à la sélection du champ (ou insère un exemple à remplacer).
export function appliquerFormat(champ, type) {
  const { selectionStart: debut, selectionEnd: fin, value } = champ;
  const choisi = value.slice(debut, fin);
  let insere; let selDebut; let selFin;
  if (type === 'gras' || type === 'italique') {
    const m = type === 'gras' ? '**' : '*';
    const mot = choisi || (type === 'gras' ? 'texte en gras' : 'texte en italique');
    insere = `${m}${mot}${m}`; selDebut = debut + m.length; selFin = selDebut + mot.length;
  } else if (type === 'lien') {
    if (/^https?:\/\/\S+$/.test(choisi)) { insere = `[${choisi}](${choisi})`; selDebut = debut + 1; selFin = selDebut + choisi.length; }
    else { const mot = choisi || 'texte du lien'; insere = `[${mot}](https://)`; selDebut = debut + mot.length + 3; selFin = selDebut + 8; }
  } else {   // liste : une puce devant chaque ligne sélectionnée
    const dl = value.lastIndexOf('\n', debut - 1) + 1;
    const fl = value.indexOf('\n', fin) === -1 ? value.length : value.indexOf('\n', fin);
    const lignes = value.slice(dl, fl).split('\n').map((l) => (/^\s*[-•]\s/.test(l) ? l : `- ${l}`));
    insere = lignes.join('\n');
    champ.setRangeText(insere, dl, fl, 'end');
    champ.focus(); champ.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  champ.setRangeText(insere, debut, fin, 'end');
  champ.focus(); champ.setSelectionRange(selDebut, selFin);
  champ.dispatchEvent(new Event('input', { bubbles: true }));
}
