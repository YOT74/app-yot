# Versions de l'app

Chaque nouvelle section « ## vX.Y.Z — titre » crée automatiquement une release sur GitHub
(workflow « Releases »). Les petites retouches (un texte, une couleur) n'ont pas de section.

## v1.9.2 — Inscriptions validées par le bureau

- Nouveau compte en attente : le bureau accepte ou refuse depuis l'Espace bureau (notification à chaque demande).
- Planning du coach recopié automatiquement depuis Google Sheets, deux fois par jour.
- « Mes séances » / « Toutes les séances » : groupe d'heures + niveaux course à pied et vélo, attribués par le coach.
- Rôle administrateur ; seul « (coach) » s'affiche à côté du nom.
- Connexion : code à 6 chiffres, bouton « Recevoir un nouveau code ».
- Données rechargées automatiquement au retour sur l'app.
- Import Excel : les jours de récupération deviennent une seule ligne de repos.

Base de données : rôle `admin`, colonnes `en_attente`, `niveau_cap`, `niveau_velo` sur `membres`.
