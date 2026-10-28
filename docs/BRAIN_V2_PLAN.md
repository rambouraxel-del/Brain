# Brain V2 — Plan en trois parties

Statut : **les fonctionnalités des parties 1, 2 et 3 sont développées sur branche dédiée et disponibles en préversion démo GitHub Pages**. Les illustrations IA définitives de la partie 1 restent à créer ; la publication en version principale attend l'évaluation humaine. Aucune migration backend ou base de données.

## Partie 1 — Identité visuelle et fondations (13–22 h)

- [x] Préparer une branche indépendante du site public.
- [x] Définir les quatre thèmes globaux : Archipel, Forêt enchantée, Cosmos, Riviera.
- [x] Implémenter la sélection manuelle Jour/Nuit et la mémorisation locale du choix.
- [x] Intégrer un aperçu et une première bannière de thème, sans toucher à l'API.
- [ ] Remplacer les paysages vectoriels provisoires par **8 illustrations générées** (4 scènes × jour/nuit), strictement cohérentes par paire, validées visuellement.
- [ ] Optimiser les images WebP/AVIF et contrôler le poids sur réseau mobile.
- [ ] Valider les contrastes, la lisibilité et le rendu iPhone/PC ; vérifier le parcours authentifié.
- [x] Ajouter des contrôles CI : syntaxe, contrats d'interface, conservation des fonctionnalités et parcours DOM simulé.
- [ ] Valider les images finales et le parcours connecté sur iPhone/PC avant fusion.

## Partie 2 — Refonte PC et mobile (14–24 h)

- [x] PC : accueil illustré, espaces en cartes, recherche, navigation latérale, filtres et panneau d'édition à droite sur grands écrans.
- [x] Mobile : accueil condensé, barre Notes / Espaces / + / Recherche / Réglages, volet des espaces, capture rapide et édition en fenêtre.
- [x] Conserver la logique V1 (notes, espaces, tags, recherche, favoris, archives, import/export, connexion) : code préservé et parcours démo automatisé réussi.
- [x] Ne pas changer le backend : uniquement `index.html`, `app.js`, feuilles de style, scripts de thème, tests et documentation.
- [x] Vérifier le parcours DOM simulé : créer/modifier note, navigation, recherche, filtres, thèmes, panneau PC et édition mobile.
- [ ] Vérifier la mise en page réellement sur iPhone et PC (captures et tests manuels) et résoudre les défauts éventuels avant publication.

## Partie 3 — Brain interactif et finalisation (13–24 h)

- [x] Carte mentale interactive fondée sur les espaces et notes existants : nœuds, ouverture d'une note, navigation vers un espace, déplacement, zoom et recadrage, navigation clavier.
- [x] Accueil personnalisable : capture rapide, espaces, favoris, statistiques ; activer/masquer et monter/descendre les widgets ; préférence locale et réinitialisation.
- [x] Tests automatiques de non-régression : création/édition, recherche, filtres, mode jour/nuit, personnalisation, carte mentale, édition PC/mobile, séparation de la préversion.
- [x] Publication d'une version de test **sans fusionner la PR V2** : https://rambouraxel-del.github.io/Brain/v2-preview/
- [ ] Validation humaine sur iPhone et PC : clavier, lisibilité, clic/touch, performances, accessibilité et rendu visuel.
- [ ] Remplacer les illustrations vectorielles provisoires par les 8 paysages IA finaux de la partie 1.
- [ ] Après retours et dernières corrections : fusion contrôlée de la PR #2 et publication de la version définitive.

### Preview GitHub Pages — fonctionnement

Une [PR #3](https://github.com/rambouraxel-del/Brain/pull/3) limitée au workflow Pages a été fusionnée pour permettre un **dossier de prévisualisation à côté de la V1**, sans fusionner le code V2 dans l'application publique. La [publication GitHub Actions](https://github.com/rambouraxel-del/Brain/actions/runs/40649142432) a réussi et l'archive contient tous les fichiers de la preview. Le backend VPS n'a pas été déployé.

- URL production inchangée : https://rambouraxel-del.github.io/Brain/
- URL test : https://rambouraxel-del.github.io/Brain/v2-preview/
- Configuration de préversion : `apiBase: ''`, `preview: true`, donc **aucune connexion à l'API de production**.
- Notes démo : stockage local sous `brain.v2.preview.notes` et `brain.v2.preview.spaces` ; aucune modification de SQLite.
- Choix de thème et de widgets en local sur le navigateur.
- La preview est figée sur un commit V2 testé ; les changements ultérieurs de la branche ne s'y publieront pas automatiquement.
- En cas de mise en production finale, rétablir les publications normales et supprimer le dossier de preview quand il n'est plus nécessaire. Ne jamais écraser les données VPS.


## Contraintes permanentes

- Thème **global** ; choix **manuel** jour/nuit ; pas de bascule automatique.
- Une paire jour/nuit conserve la **même composition** et les mêmes objets.
- Aucun secret ni donnée utilisateur dans GitHub ; aucune suppression de notes ni réinitialisation SQLite.
- Aucun changement aux services VPS Polar Rift / VTD-BOT.
- L'ancien frontend peut être simplifié ou remplacé, mais les données et fonctionnalités essentielles doivent rester fiables.
- Sauvegarde chiffrée externe et audit SSH : reportés à la demande du propriétaire.

## État et validation technique de la partie 2

- Branche : `feat/brain-v2-foundations` ; [PR #2 en brouillon](https://github.com/rambouraxel-del/Brain/pull/2), non fusionnée.
- Fichiers visuels : `v2-layout.css`, `visual-themes.css`, `visual-themes.js`, `index.html` ; logique frontend uniquement dans `app.js`.
- Tests : `tests/test_frontend_v2.cjs`, `tests/test_frontend_runtime.cjs`, et tests API existants déclenchés par `.github/workflows/checks.yml`.
- API et base SQLite inchangées ; CI sur pull request ne déploie ni GitHub Pages ni VPS.
- Le chantier est **développé et validé automatiquement**, mais le rendu réel sur appareils et les illustrations définitives restent à vérifier. Ne pas confondre tests DOM simulés et tests iPhone réels.

## Note de réalisation

La première intégration utilise des **illustrations SVG vectorielles provisoires**, générées localement dans le navigateur. Elles sont légères et garantissent une composition stable entre jour et nuit. **Ce ne sont pas encore les illustrations IA finales** ; leur création et validation constituent le prochain jalon de la partie 1.
