// ecrans/donnees.js — page « Données personnelles » (RGPD), lisible même sans être connecté.
import { NOM_CLUB } from '../config.js';
import { etat } from '../etat.js';
import { retour } from './communs.js';

export function ecranDonneesPerso() {
  return `
    ${etat.moi ? retour('#/compte', 'Mon compte') : retour('#/', 'Connexion')}
    <h1 class="fiche-titre">Données personnelles</h1>
    <div class="texte-riche bloc">
      <p>L’application ${NOM_CLUB} est réservée aux membres du club. Voici ce qu’elle conserve et pourquoi.</p>
      <p><strong>Ce qui est enregistré</strong></p>
      <ul>
        <li>Ton adresse email, pour te connecter avec un code.</li>
        <li>Ton prénom, ton nom, ta photo si tu en ajoutes une, et ton volume d’entraînement hebdomadaire (pour ton groupe du planning).</li>
        <li>Tes statuts sur les courses (intéressé, inscrit…), tes résultats, tes messages, tes présences et tes votes aux sondages.</li>
        <li>Tes réglages de notifications.</li>
      </ul>
      <p><strong>Qui y a accès</strong></p>
      <ul>
        <li>Les membres connectés voient les noms, photos, statuts, résultats et messages : c’est le principe de l’app.</li>
        <li>Ton adresse email n’est visible que par le bureau, et seulement le temps de valider ton inscription.</li>
        <li>Rien n’est vendu ni partagé avec qui que ce soit, et il n’y a ni publicité ni mesure d’audience.</li>
      </ul>
      <p><strong>Où sont les données</strong></p>
      <p>Chez Supabase, dans un centre de données à Paris (Union européenne). Une sauvegarde chiffrée est faite chaque semaine.</p>
      <p><strong>Combien de temps</strong></p>
      <p>Tant que ton compte existe. Le bureau peut désactiver le compte d’un ancien membre.</p>
      <p><strong>Tes droits</strong></p>
      <p>Tu peux corriger tes informations dans « Mon compte » et supprimer ton compte à tout moment depuis cette même page : ta fiche, tes statuts, tes présences, tes votes et tes notifications sont alors effacés. Tes messages dans les discussions restent visibles, signés « Ancien membre ». Pour toute autre demande, adresse-toi au bureau du club.</p>
    </div>`;
}
