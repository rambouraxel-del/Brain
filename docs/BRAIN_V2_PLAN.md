# Brain V2 — Plan en trois parties

Statut : **partie 1 en cours sur branche dédiée**, aucune migration backend ou base de données.

## Partie 1 — Identité visuelle et fondations (13–22 h)

- [x] Préparer une branche indépendante du site public.
- [x] Définir les quatre thèmes globaux : Archipel, Forêt enchantée, Cosmos, Riviera.
- [x] Implémenter la sélection manuelle Jour/Nuit et la mémorisation locale du choix.
- [x] Intégrer un aperçu et une première bannière de thème, sans toucher à l'API.
- [ ] Remplacer les paysages vectoriels provisoires par **8 illustrations générées** (4 scènes × jour/nuit), strictement cohérentes par paire, validées visuellement.
- [ ] Optimiser les images WebP/AVIF et contrôler le poids sur réseau mobile.
- [ ] Valider les contrastes, la lisibilité et le rendu iPhone/PC ; vérifier le parcours authentifié.
- [ ] Exécuter la suite de tests et vérifier la branche avant fusion.

## Partie 2 — Refonte PC et mobile (14–24 h)

- [ ] PC : accueil illustré, espaces en cartes, recherche, navigation latérale et panneau d'édition.
- [ ] Mobile : accueil condensé, barre de navigation, bouton capture rapide, notes lisibles, édition adaptée au clavier.
- [ ] Conserver les fonctions V1 (notes, espaces, tags, recherche, favoris, archives, import/export, connexion).
- [ ] Éviter les modifications backend si le contrat API existant suffit.

## Partie 3 — Brain interactif et finalisation (13–24 h)

- [ ] Carte mentale interactive espaces/notes, zoom, navigation, sans IA obligatoire.
- [ ] Accueil personnalisable : blocs activables, désactivables et réordonnables.
- [ ] Tests d'accessibilité, mobile, réseau lent, sauvegarde, non-régression et publication.
- [ ] Documentation des changements et vérification finale.

## Contraintes permanentes

- Thème **global** ; choix **manuel** jour/nuit ; pas de bascule automatique.
- Une paire jour/nuit conserve la **même composition** et les mêmes objets.
- Aucun secret ni donnée utilisateur dans GitHub ; aucune suppression de notes ni réinitialisation SQLite.
- Aucun changement aux services VPS Polar Rift / VTD-BOT.
- L'ancien frontend peut être simplifié ou remplacé, mais les données et fonctionnalités essentielles doivent rester fiables.
- Sauvegarde chiffrée externe et audit SSH : reportés à la demande du propriétaire.

## Note de réalisation

La première intégration utilise des **illustrations SVG vectorielles provisoires**, générées localement dans le navigateur. Elles sont légères et garantissent une composition stable entre jour et nuit. **Ce ne sont pas encore les illustrations IA finales** ; leur création et validation constituent le prochain jalon de la partie 1.
