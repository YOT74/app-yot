// client.js — crée la connexion à Supabase (rien à modifier ici).
// En mode démo, pas de connexion : `supabase` vaut null.
import { SUPABASE_URL, SUPABASE_CLE_PUBLIQUE, MODE_DEMO } from './config.js';

let supabase = null;

if (!MODE_DEMO) {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
  supabase = createClient(SUPABASE_URL, SUPABASE_CLE_PUBLIQUE, {
    // detectSessionInUrl : au retour de Google ou Apple, la session est lue dans l'adresse
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });
}

export { supabase };
