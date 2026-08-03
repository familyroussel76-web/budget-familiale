# Budget Familial V3.0.0

Application familiale partagée utilisant GitHub Pages et Supabase.

## Mise en ligne

1. Ouvrir le dépôt GitHub `budget-familiale`.
2. Supprimer les anciens fichiers de la V2.
3. Envoyer tout le contenu de ce dossier à la racine du dépôt :
   - `index.html`
   - `style.css`
   - `config.js`
   - `app.js`
   - `manifest.webmanifest`
   - `service-worker.js`
   - `README.md`
   - dossier `assets`
4. Valider avec `Commit changes`.
5. Attendre le déploiement GitHub Pages.
6. Ouvrir :
   `https://familyroussel76-web.github.io/budget-familiale/`

## Fonctions V3.0.0

- authentification Supabase ;
- données communes entre appareils ;
- tableau de bord ;
- écran Enveloppes ;
- écran Ajouter une dépense ;
- écran Historique ;
- modification des budgets ;
- modification du revenu mensuel ;
- mise à jour en temps réel ;
- export CSV ;
- interface adaptée à l’iPhone ;
- PWA ajoutable à l’écran d’accueil.

## Sécurité

`config.js` contient uniquement l’URL publique Supabase et la clé publique publishable.
Aucun mot de passe ni clé secrète n’est inclus.
