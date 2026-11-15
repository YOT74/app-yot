# App du club — calendrier des courses

PWA en JavaScript sans build : on modifie un fichier, on recharge la page.
Données et connexion : Supabase. Hébergement : GitHub Pages.

## Tester tout de suite (mode démo)

`config.js` laissé tel quel (URL Supabase vide) = mode démo, avec des données fictives.

```bash
cd app-club
python3 -m http.server 8000
```

Ou, dans Spyder : ouvrir `lancer.py` et l'exécuter (F5).

Ouvrir http://localhost:8000 et entrer avec un des boutons de démo (Sophie membre,
Camille bureau, Marc coach), ou taper n'importe quelle adresse pour tester l'inscription
(code : 6 chiffres au choix).
Les changements de la démo disparaissent au rechargement.

## Tester en local avec une vraie base (Supabase local)

Pour tester la vraie connexion par code, les règles d'accès et la validation,
sans rien mettre en ligne. Il faut **Docker Desktop** installé et lancé.

1. Dans le dossier `app-club` :
   ```bash
   npx supabase init          # crée supabase/config.toml (répondre non aux questions)
   mkdir -p supabase/migrations
   cp supabase/schema.sql supabase/migrations/20261115000000_init.sql
   ```
2. Dans `supabase/config.toml`, ajouter à la fin :
   ```toml
   [auth.email.template.magic_link]
   subject = "Ton code de connexion au club"
   content_path = "./supabase/templates/code.html"
   ```
   et, dans la section `[auth.rate_limit]` si elle existe, passer `email_sent` à `30`
   (la valeur locale par défaut bloque après 2 emails par heure).
3. Démarrer (le premier lancement télécharge les images, quelques minutes) :
   ```bash
   npx supabase start
   npx supabase db reset      # applique le schéma et seed.sql (données de test)
   ```
   `start` affiche l'**API URL** (http://127.0.0.1:54321) et la clé publique
   (*anon key* ou *publishable key*).
4. Coller ces deux valeurs dans `config.js`, puis servir l'app :
   ```bash
   python3 -m http.server 8000
   ```
5. Ouvrir http://localhost:8000, se connecter avec `sophie.marchand@club-tri.fr` (membre),
   `camille.ferrand@club-tri.fr` (bureau), `marc.villeneuve@club-tri.fr` (coach), ou une autre adresse.
   Le code arrive dans **Mailpit** : http://127.0.0.1:54324.
6. Les tables se consultent dans **Supabase Studio** : http://127.0.0.1:54323.

`npx supabase db reset` remet la base à zéro avec les données de test.
`npx supabase stop` arrête tout. Avant la mise en prod, remettre l'URL et la clé
du projet en ligne dans `config.js`.

## Où modifier quoi

| Fichier | Contenu | Fréquence |
| --- | --- | --- |
| `config.js` | Clés Supabase, nom du club, statuts, disciplines, intensités, libellés des réglages, version | Souvent |
| `style.css` | Couleurs (variables en haut du fichier, mode clair puis sombre), typo, espacements | Souvent |
| `ecrans/*.js` | Un fichier par rubrique : `accueil`, `calendrier`, `course`, `entrainement`, `mes-courses`, `plus`, `connexion` (+ tuto), `communs` | Pour changer un écran |
| `actions.js` | Ce que font les boutons et les formulaires | Pour une fonctionnalité |
| `rendu.js` | Quelle adresse affiche quel écran, barre du bas, chargement | Rarement |
| `etat.js`, `outils.js` | État de l'app, dates, icônes, petites fonctions | Rarement |
| `donnees.js` | Lecture et écriture Supabase | Quand la base change |
| `import-excel.js`, `lecteur-xlsx.js` | Lecture du planning Excel du coach | Si le format du fichier change |
| `demo.js`, `demo-donnees.js` | Mode démo (données du POC v3) | Si tu veux une autre démo |
| `robot/` | Robot qui remplit la base de courses (FFTri, IRONMAN, liste des marathons) | Si une source change ; la liste une fois par an |
| `auth.js`, `client.js`, `index.html`, `sw.js`, `manifest.webmanifest` | Plomberie | Presque jamais |
| `supabase/schema.sql` | Tables, règles d'accès, notifications automatiques (le script de prod) | À chaque évolution de la base |
| `supabase/seed.sql` | Données de test du POC, base locale uniquement | Si tu veux d'autres données |

## Rôles

- **membre** : calendrier, statuts, mots, albums, résultats, propositions de courses.
- **coach** : en plus, saisit ou importe les séances du planning.
- **bureau** : en plus, valide les courses, publie les actualités, gère les partenaires ; peut aussi gérer le planning.

Le bureau change le rôle d'un membre, ou désactive son compte, depuis sa fiche (Plus → Membres).
Pour le tout premier compte bureau : Supabase → Table Editor → membres → colonne `role`.

## Calendrier et base de courses

La table `courses` contient toute la base : les courses importées automatiquement
(colonne `source` : `fftri`, `ironman`, `liste`…, déjà validées) et celles proposées
par les membres (`source = 'membre'`, validées par le bureau).
Le calendrier n'affiche par défaut que les courses **suivies par le club** (au moins
un membre engagé, course club, ou proposition en attente). La recherche, ou le filtre
« Toute la base », porte sur tout. Dès qu'un membre indique un statut sur une course,
elle apparaît dans le calendrier du club. Si la recherche ne trouve rien, un lien
mène à la proposition manuelle.

## Robot de la base de courses

`robot/importer.mjs` (Node 20, aucune dépendance) lit les courses à venir et les
envoie dans la table `courses` :

| Source | Fichier | Comment |
| --- | --- | --- |
| FFTri | `robot/sources/fftri.mjs` | page fftri.t2area.com/calendrier.html, 10 épreuves par page, données de la carte (`mapEvents`) |
| IRONMAN | `robot/sources/ironman.mjs` | page www.ironman.com/races, cartes de course, `?page=N` |
| Grands marathons et semis | `robot/liste-marathons.json` | liste tenue à la main, **à mettre à jour une fois par an** |

Il tourne chaque lundi via `.github/workflows/courses.yml` (secrets `SUPABASE_URL`
et `SUPABASE_CLE_SERVICE`, la clé service_role, qui ne va jamais dans `config.js`).
Une course déjà importée est mise à jour, jamais dupliquée ni supprimée ; le lien
d'inscription, les infos et « course club » saisis dans l'app ne sont pas touchés.
Une course corrigée par le bureau (nom, date, lieu…) garde ses corrections ; une course
masquée par le bureau ne revient pas (Espace bureau → Courses masquées pour la réafficher).
Si une source change sa page, le workflow échoue et GitHub t'envoie un email :
c'est le fichier de la source qu'il faut adapter.

Tester sans rien écrire (Windows, dans le dossier `app-club`) :
```bash
node robot/importer.mjs --essai            # toutes les sources, affiche ce qui serait importé
node robot/importer.mjs --essai fftri      # une seule source
```
Importer dans le Supabase local (PowerShell ; la clé *service_role* s'affiche avec `npx supabase status`) :
```powershell
$env:SUPABASE_URL="http://127.0.0.1:54321"; $env:SUPABASE_CLE_SERVICE="<clé service_role>"
node robot/importer.mjs
```

## Import du planning Excel

Onglet Planning → « Importer un fichier Excel » (coach et bureau). Fichier `.xlsx`
(depuis Google Sheets : Fichier → Télécharger → Microsoft Excel). Un onglet par
semaine ; les onglets d'explications (autre format) sont ignorés, ainsi qu'un onglet
qui couvre les mêmes dates qu'un autre (copie). Dans chaque onglet : une ligne d'en-têtes
DUREE / GROUPE / INTENSITE / SEANCE répétée pour course à pied, vélo, natation (de
gauche à droite, ordre fixé dans `ORDRE_DISCIPLINES` de `import-excel.js`), la date
du jour à gauche, une ligne par groupe de niveau, cellules fusionnées acceptées.
L'app liste les semaines trouvées (cochées par défaut, sauf celles déjà passées) ;
chaque semaine importée remplace les séances déjà saisies sur sa période. Rien n'est
envoyé ailleurs que dans la base du club.

## Publier une nouvelle version

1. Augmenter `VERSION` dans `config.js` **et** dans `sw.js` (même valeur).
2. `git commit` puis `git push` : GitHub Pages met en ligne en une à deux minutes.
3. Les membres voient un bandeau « Nouvelle version disponible » à l'ouverture suivante.

## Mise en prod

Le pas-à-pas complet (Supabase, script SQL, Gmail du club, GitHub Pages,
anti-pause) est dans le document « App club triathlon — passage en v1 ».
Le workflow anti-pause est déjà dans `.github/workflows/eveil.yml`.
