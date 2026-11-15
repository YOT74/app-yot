// auth.js — connexion par code reçu par email, déconnexion.
import { supabase } from './client.js';
import { MODE_DEMO, LONGUEUR_CODE } from './config.js';

const CLE_DEMO = 'demo-session-email';

function lireStockage(cle) {
  try { return localStorage.getItem(cle); } catch { return null; }
}
function ecrireStockage(cle, valeur) {
  try {
    if (valeur === null) localStorage.removeItem(cle);
    else localStorage.setItem(cle, valeur);
  } catch { /* stockage indisponible : la session démo ne survivra pas au rechargement */ }
}

// Renvoie l'email connecté, ou null.
export async function emailConnecte() {
  if (MODE_DEMO) return lireStockage(CLE_DEMO);
  const { data } = await supabase.auth.getSession();
  // retour de Google / Apple : on retire le code de connexion de l'adresse
  if (new URLSearchParams(location.search).has('code')) history.replaceState(null, '', location.pathname + location.hash);
  return data.session?.user?.email?.toLowerCase() ?? null;
}

// Étape 1 : envoie le code (crée le compte à la première connexion).
export async function demanderCode(email) {
  const adresse = email.trim().toLowerCase();
  if (MODE_DEMO) return;
  const { error } = await supabase.auth.signInWithOtp({ email: adresse, options: { shouldCreateUser: true } });
  if (error) {
    if (error.status === 429) throw new Error('Trop de demandes. Merci de patienter une minute avant de demander un nouveau code.');
    throw new Error("L'envoi du code a échoué. Merci de réessayer dans quelques instants.");
  }
}

// Étape 2 : vérifie le code reçu et ouvre la session.
export async function validerCode(email, code) {
  const adresse = email.trim().toLowerCase();
  const token = code.replace(/\s/g, '');
  if (MODE_DEMO) {
    if (!new RegExp(`^\\d{${LONGUEUR_CODE}}$`).test(token)) throw new Error(`Le code comporte ${LONGUEUR_CODE} chiffres.`);
    ecrireStockage(CLE_DEMO, adresse);
    return;
  }
  const { error } = await supabase.auth.verifyOtp({ email: adresse, token, type: 'email' });
  if (error) throw new Error('Ce code est incorrect ou a expiré.');
}

// Connexion avec Google ou Apple : on part chez le fournisseur, qui renvoie vers l'app.
export async function connexionFournisseur(fournisseur) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: fournisseur,
    options: { redirectTo: location.origin + location.pathname },
  });
  if (error) throw new Error('La connexion est impossible pour le moment. Utilise la connexion par code reçu par email.');
}

export async function deconnexion() {
  if (MODE_DEMO) { ecrireStockage(CLE_DEMO, null); return; }
  await supabase.auth.signOut();
}
