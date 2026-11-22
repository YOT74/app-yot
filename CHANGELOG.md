# Versions de l'app

Chaque nouvelle section « ## vX.Y.Z — titre » crée automatiquement une release sur GitHub
(workflow « Releases »).

Numérotation X.Y.Z (la version change à chaque mise en ligne, sinon les téléphones gardent l'ancienne app) :
- Z, correctif : correction, retouche de texte ou de design. Pas de section ici, donc pas de release.
- Y, fonctionnalité : nouvelle fonction visible pour les membres. Section + release.
- X, version majeure : grande étape (lancement officiel auprès des membres = v2.0.0, refonte…). Section + release.

## v1.17.0 — Doublons et dates plus précises

- Le robot des courses repère les doublons entre sources (ex. IRONMAN 70.3 Aix-en-Provence, présent chez FFTri et chez IRONMAN) : dates à un jour près, noms qui se ressemblent et une distance en commun. Il masque celle en trop, seulement si personne n'y a de statut ; sinon le bureau fusionne. Une course réaffichée par le bureau n'est plus jamais masquée.
- Dates exactes pour les grandes courses de la région déjà annoncées (10 km d'Aix-les-Bains le 21 mars, Grenoble-Vizille, Run In Lyon, Marathon des Alpes…), et période affichée quand seul le moment du mois est connu (« fin avril 2027 »).
- Deux fois par semaine, le robot cherche les dates nouvellement annoncées (pages publiques de finishers.com) pour les courses dont le jour est inconnu ou à confirmer, et les met à jour.

Base de données : colonnes `doublon_de`, `pas_doublon`, `periode` et `date_verifiee` sur `courses`.

## v1.16.0 — Courses de la région

- 309 courses sur route, trails et cross ajoutées à la base : Haute-Savoie, Savoie, Rhône, Ain, Isère et Genève (marathon d'Annecy, Run in Lyon, foulées de Villeurbanne, semi de Bourg-en-Bresse, Grenoble-Vizille, Marathon de Genève, Escalade, Maxi-Race, UTMB, SaintéLyon…). Liste tenue à la main : la FFA interdit la lecture automatique de son calendrier.
- Quand seul le mois est annoncé : le mois s'affiche à la place du jour (« MAI ») et la fiche indique « mai 2027 · date exacte pas encore annoncée », sans compte à rebours inventé.

Base de données : colonne `jour_inconnu` sur `courses`.

## v1.15.0 — Événements à plusieurs distances

- Une course peut proposer plusieurs distances (« 10 km, Semi, Marathon ») : chacun choisit la sienne avec son statut, et la fiche montre combien du club sur chaque distance, avec la distance à côté de chaque nom.
- Événement sur plusieurs jours : une date par distance. Le compte à rebours (J-x), le dossard de l'accueil et « ma prochaine course » suivent la date de MA distance ; la fiche affiche « Du … au … ».
- Export tableur : colonne Distance.

Base de données : colonnes `epreuves` (courses) et `distance` (participations).

## v1.14.0 — Fusion des courses en double

- Espace bureau : liste « Doublons possibles » (course proposée par un membre ou estimée qui ressemble à une autre, à quelques jours près).
- Bouton « Fusionner » : statuts, résultats, messages, albums et infos saisies passent sur la course gardée (la version officielle par défaut), l'autre est supprimée. Un membre présent sur les deux garde son statut le plus avancé. Aucune notification n'est envoyée pendant la fusion.
- Messages de confirmation affichés en bas de l'écran, sans bloquer la flèche retour.

Base de données : fonction `fusionner_courses`.

## v1.13.0 — Calendrier : courses suivies par le club

- Filtre explicite « Suivies par le club » (courses où au moins un membre participe, par défaut) / « Toute la base ».
- La recherche porte sur le filtre choisi ; un lien « + N courses dans toute la base » permet d'élargir.

## v1.12.0 — Brouillons et course club sur l'accueil

- Brouillons : une actualité, un message ou une proposition de course en cours d'écriture est gardé sur le téléphone et repris au retour (« Brouillon repris · Effacer »). Effacé une fois publié.
- Accueil : encart « Prochaine course club », sauf si c'est déjà ta prochaine course.
- Accueil plus compact : dossard de la prochaine course et encarts de courses réduits.
- Course club : bandeau simplifié, et retrait de « Je suis disponible pour l'équipe du club » (et de la vue bureau associée).

## v1.11.0 — Données personnelles, rappels et confort

- Page « Données personnelles » (lisible sans être connecté) et bouton « Supprimer mon compte » dans Mon compte.
- Rappel automatique 7 jours avant la clôture des inscriptions, pour les membres « Intéressé » (réglable dans les notifications).
- Sauvegarde chiffrée de la base chaque dimanche, gardée 90 jours dans GitHub.
- Planning : glisser à gauche ou à droite pour changer de semaine.
- Accueil sans course prévue : « Où va le club », les 3 prochaines courses où des membres sont engagés.
- Tirer vers le bas pour actualiser ; blocs gris pendant le chargement.

Base de données : fonctions `supprimer_mon_compte` et `envoyer_rappels` (tâche quotidienne pg_cron), colonne `notif_rappel` sur `membres`.

## v1.10.0 — Grands triathlons ajoutés à la base

- Nouvelle liste de grands triathlons (Alpe d'Huez, Embrunman, Challenge Roth, Altriman, Gérardmer, Deauville, Natureman Var), présents avant même leur arrivée au calendrier FFTri.
- Date encore estimée : badge « Date à confirmer » (jour indicatif).
- Dès que FFTri ou IRONMAN publie la course (même nom, à 30 jours près), le robot retire la version estimée.
- Accueil : « Séance du jour » jusqu'à 19 h 30, puis « Séance de demain » (selon ton groupe et tes niveaux), ou « Repos » / « Pas de séance prévue ».

Base de données : colonne `date_a_confirmer` sur `courses`.

## v1.9.4 — Actualités : mise en forme et photos

- Texte des actus : gras, italique, liens et listes, avec une barre d'outils (G, I, lien, liste). Un lien collé devient cliquable.
- Jusqu'à 4 photos par actu, réduites avant l'envoi ; vignettes dans l'actu, ouvertes en grand au toucher. Supprimer une actu supprime ses photos.
- L'écran de connexion affiche « Connexion » au lieu de « Inscription ».

Base de données : colonne `photos` sur `actualites`, dossier de stockage « actualites » (lecture pour tous, dépôt réservé au bureau).

## v1.9.3 — Installer l'app, planning plus léger

- Bouton « Installer l'app » sur l'écran de connexion et dans Plus : fenêtre d'installation sur Android, étapes illustrées sur iPhone. Il disparaît une fois l'app installée.
- Planning : barre de semaine compacte, bascule liste / semaine en icônes, « Mes séances / Toutes » en pastille.
- Accueil : petit bouton « + Publier » à côté des actualités ; bordures des boutons secondaires plus fines.

## v1.9.2 — Inscriptions validées par le bureau

- Nouveau compte en attente : le bureau accepte ou refuse depuis l'Espace bureau (notification à chaque demande).
- Planning du coach recopié automatiquement depuis Google Sheets, deux fois par jour.
- « Mes séances » / « Toutes les séances » : groupe d'heures + niveaux course à pied et vélo, attribués par le coach.
- Rôle administrateur ; seul « (coach) » s'affiche à côté du nom.
- Connexion : code à 6 chiffres, bouton « Recevoir un nouveau code ».
- Données rechargées automatiquement au retour sur l'app.
- Import Excel : les jours de récupération deviennent une seule ligne de repos.

Base de données : rôle `admin`, colonnes `en_attente`, `niveau_cap`, `niveau_velo` sur `membres`.
