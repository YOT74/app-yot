// =====================================================================
// avatar.js — photo de profil, ou à défaut un triathlète dessiné
// (bonnet de bain + lunettes, trifonction), aux couleurs propres à chaque membre.
// =====================================================================

const FONDS = ['#E9DDF5', '#DCEFE3', '#FCE9C8', '#DDE9F7', '#F8DCD8', '#E8E3D6'];
const BONNETS = ['#5B2A86', '#E2572B', '#2F6DB5', '#2E8B57', '#D4A106', '#C2362F'];
const PEAUX = ['#F3CDAA', '#E2AF83', '#C68B5F', '#94603F', '#F7DAC4'];
const VERRES = ['#7FD3E8', '#F2A65A', '#9BE3B0', '#C3B1F2'];

// Petit nombre stable tiré de l'identifiant (le même membre a toujours le même dessin).
function graine(texte) {
  let h = 2166136261;
  for (const c of String(texte)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function avatarParDefaut(id) {
  const g = graine(id);
  const fond = FONDS[g % FONDS.length];
  const bonnet = BONNETS[(g >>> 3) % BONNETS.length];
  const peau = PEAUX[(g >>> 6) % PEAUX.length];
  const verre = VERRES[(g >>> 9) % VERRES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="${fond}"/>
  <g transform="translate(-4.8 -8.6) scale(1.15)">
  <path d="M7 64c2-14 12-21 25-21s23 7 25 21z" fill="#1F2430"/>
  <path d="M21 45.5 32 60l11-14.5" fill="none" stroke="${bonnet}" stroke-width="3.2" stroke-linejoin="round"/>
  <rect x="27" y="35" width="10" height="10" rx="3" fill="${peau}"/>
  <ellipse cx="32" cy="27" rx="11.5" ry="12.5" fill="${peau}"/>
  <path d="M20.6 27.5C20 15.5 25 11.5 32 11.5s12 4 11.4 16c-3.2-3.8-19.6-3.8-22.8 0z" fill="${bonnet}"/>
  <path d="M20.8 21.6h22.4" stroke="#1a1a1a" stroke-width="1.3" stroke-linecap="round"/>
  <rect x="23.2" y="18.8" width="7.4" height="5" rx="2.4" fill="${verre}" stroke="#1a1a1a" stroke-width="1.2"/>
  <rect x="33.4" y="18.8" width="7.4" height="5" rx="2.4" fill="${verre}" stroke="#1a1a1a" stroke-width="1.2"/>
  <circle cx="27.8" cy="30" r="1.3" fill="#1a1a1a"/><circle cx="36.2" cy="30" r="1.3" fill="#1a1a1a"/>
  <path d="M28.4 34.2q3.6 2.8 7.2 0" fill="none" stroke="#1a1a1a" stroke-width="1.3" stroke-linecap="round"/>
  </g>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Source d'image sûre : photo envoyée (https ou image intégrée), sinon le dessin.
export function sourceAvatar(m) {
  const p = m?.photo;
  if (p && (/^https:\/\//i.test(p) || /^data:image\/(jpeg|png|webp);base64,/i.test(p))) return p;
  return avatarParDefaut(m?.id ?? 'inconnu');
}

// <img> rond ; taille en pixels.
export function avatar(m, taille = 36) {
  const src = sourceAvatar(m).replace(/"/g, '&quot;');
  return `<img class="avatar" src="${src}" alt="" width="${taille}" height="${taille}" loading="lazy" decoding="async">`;
}

// Recadre une image choisie en carré 320 px, en JPEG (photo légère, envoi rapide).
export async function preparerPhoto(fichier) {
  const image = await createImageBitmap(fichier);
  const cote = Math.min(image.width, image.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 320;
  canvas.getContext('2d').drawImage(image, (image.width - cote) / 2, (image.height - cote) / 2, cote, cote, 0, 0, 320, 320);
  return new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error('Image illisible.'))), 'image/jpeg', 0.85));
}
