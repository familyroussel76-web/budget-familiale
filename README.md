# Budget Familial V3.4.0

1. AVANT de publier la version, exécuter SUPABASE_V3.4.0.sql dans Supabase → SQL Editor → New query → Run.
2. Déployer index.html, manifest.webmanifest et les deux icônes à la racine du dépôt GitHub Pages.
3. Recharger la page (cache navigateur).

Nouveautés : priorités synchronisées entre appareils, répartition au prorata des enveloppes non prioritaires avec aperçu, ajout d'enveloppes, archivage sécurisé sans effacer l'historique, modification manuelle des budgets y compris avec report négatif.

IMPORTANT : l'ajout d'une enveloppe crée des budgets sur les mois disponibles (septembre 2026 à août 2027). La suppression archive l'enveloppe ; elle est refusée en présence de dépenses ou transferts historiques. La répartition modifie uniquement les budgets de base du mois sélectionné, pas les reports ni les dépenses. Si les enveloppes prioritaires dépassent le revenu, la répartition est refusée.

L'actualisation des enveloppes n'est pas une transaction atomique : éviter les modifications simultanées sur plusieurs appareils. Les données Supabase existantes ne sont pas effacées.
