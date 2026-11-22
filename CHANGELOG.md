# Versions de l'app

Chaque nouvelle section « ## vX.Y.Z — titre » crée automatiquement une release sur GitHub
(workflow « Releases »). Les petites retouches (un texte, une couleur) n'ont pas de section.

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
