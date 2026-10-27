# brain. — ton deuxième cerveau personnel

Une application **mobile-first**, sans framework côté navigateur, conçue pour **GitHub Pages**. En mode connecté, une petite API privée sur ton **VPS OVH** sauvegarde toutes tes notes dans **SQLite**.

## Ce que contient la V1

- Capture rapide et sauvegarde d'idées (Ctrl/Cmd + Entrée)
- Espaces personnalisés, boîte de réception et tags
- Recherche plein texte dans les titres, contenus, espaces et tags (Ctrl/Cmd + K)
- Notes épinglées, archives, édition et suppression
- Thème clair/sombre, grille/liste, interface téléphone
- Export et import JSON (sans doublons)
- Connexion par mot de passe en mode VPS

## Architecture

```text
Téléphone / navigateur
         │
         ▼
GitHub Pages (frontend public, aucun mot de passe ni note dans le dépôt)
         │  API HTTPS + jeton de session temporaire
         ▼
Nginx (VPS OVH)
         │
         ▼
Docker : FastAPI ── SQLite (volume persistant)
```

### 1) Tester immédiatement en local

Ouvre `index.html` dans ton navigateur, ou lance un serveur local :

```bash
python -m http.server 8080
```

Puis ouvre `http://localhost:8080`. La configuration `config.js` par défaut a `apiBase: ''` : **tes notes de démonstration sont enregistrées uniquement dans le stockage local de ce navigateur**. Elles ne sont PAS accessibles depuis un autre appareil. Utilise le bouton **Exporter** pour faire une copie.

### 2) Publier l'interface avec GitHub Pages

Le dépôt contient déjà le workflow `.github/workflows/checks.yml`, qui **teste l'application et publie automatiquement le frontend** à chaque push sur `main`, seulement si les tests passent.

Pour activer la première publication, ouvre **Settings → Pages → Build and deployment → Source** et sélectionne **GitHub Actions** (une seule fois). Tu n'as pas besoin de choisir un modèle de workflow : celui de Brain est déjà configuré.

Puis ouvre `https://rambouraxel-del.github.io/Brain/`.

Le workflow prépare un artefact contenant **seulement** `index.html`, `styles.css`, `app.js`, `config.js`, `favicon.svg` et `.nojekyll`. Les dossiers `backend/`, `tests/`, ainsi que les exemples d'environnement, ne sont pas servis comme site web. Ne mets jamais tes notes ou de véritables secrets dans les fichiers GitHub.

**Important :** un site Pages seul ne peut pas enregistrer les données dans SQLite sur ton VPS. Il doit appeler l'API HTTPS privée ci-dessous. Ne mets **jamais** ton `.env` ou un mot de passe dans le dépôt ni dans `config.js`.

### 3) Démarrer l'API sur ton VPS

Sur ton VPS, copie le dossier entier dans un répertoire dédié, puis :

```bash
cp .env.example .env
# Modifie .env : mot de passe unique, clé secrète aléatoire, origine GitHub Pages réelle
chmod 600 .env
docker compose up -d --build
curl http://127.0.0.1:8787/api/health
```

Génère la clé secrète avec `python3 -c "import secrets;print(secrets.token_urlsafe(48))"`. Choisis un mot de passe fort et unique, **14 caractères minimum**. **Les valeurs d’exemple sont volontairement refusées par l’API : il faut les remplacer avant de démarrer.** Pour `BRAIN_ALLOWED_ORIGINS`, mets l'ORIGINE exacte (`https://pseudo.github.io`, sans `/brain/`), ou ton domaine web personnalisé.

L'API n'écoute sur le VPS que sur `127.0.0.1:8787`, donc pas directement sur Internet. Configure Nginx et HTTPS sur un sous-domaine, par exemple `https://brain-api.ton-domaine.fr`. Le fichier `nginx-brain-api.conf.example` donne le bloc de proxy. Pense à renouveler automatiquement ton certificat TLS.

### 4) Relier Pages au VPS

Modifie **uniquement** `config.js` dans le dépôt public :

```js
window.BRAIN_CONFIG = { apiBase: 'https://brain-api.ton-domaine.fr' };
```

Recharge le site : un écran de connexion apparaît. Les notes seront cette fois sauvegardées sur le VPS et accessibles depuis tous tes appareils avec le même mot de passe.

### 5) Sauvegarde indispensable

Le volume Docker est **persistant**, mais n'est **pas une sauvegarde**. Fais des backups **quotidiens et hors du VPS**, idéalement chiffrés. L'export JSON manuel se fait dans **Paramètres → Exporter**. Il sauvegarde les notes et espaces actuellement chargés. Pour automatiser les sauvegardes cohérentes de SQLite, utilise l'API SQLite `backup` (ne recopie pas à chaud le fichier `.sqlite3` avec WAL actif).

## Sécurité et limites de cette V1

- Authentification simple **mono-utilisateur** : mot de passe stocké uniquement dans l'environnement de l'API, jamais sur Pages.
- Connexions API chiffrées **via HTTPS Nginx**. L'API utilise des jetons HMAC temporaires (12 h), conservés en **sessionStorage** et non transmis à GitHub.
- Blocage simple des tentatives de connexion : 8 échecs / 15 min / adresse vue par le serveur (après redémarrage le compteur repart à zéro).
- CORS limité à tes origines autorisées. **CORS ne remplace pas l'authentification.**
- Le mode local `localStorage` est une démonstration : ce n'est ni un stockage privé robuste, ni une synchronisation. Évite-le sur un poste partagé.
- Ce n'est pas encore du chiffrement de bout en bout : l'administrateur VPS peut techniquement lire la base. Le chiffrement de disque, un VPN ou un vrai système E2EE peuvent être ajoutés plus tard.
- Le code est fourni pour une V1 personnelle, sans prétendre avoir subi un audit de sécurité indépendant. Envisage une restriction d'accès supplémentaire (Cloudflare Access, Tailscale, etc.) selon tes besoins.
- Sur ordinateur professionnel, respecte la politique de sécurité de l'entreprise. **N'enregistre jamais des données de clients, risques de crédit ou documents de travail confidentiels** sur ce site privé.

## Développement et tests

```bash
python -m pip install -r backend/requirements.txt httpx
python tests/test_api.py
node --check app.js
```

Le dépôt versionne le **code uniquement**. `.gitignore` exclut les secrets, bases et exports de notes.

## Améliorations V2

Recherche sémantique IA, liens bidirectionnels entre notes, synthèses automatiques, tâches et rappels, captures vocales, PWA hors connexion, versioning, automatisation des sauvegardes.
