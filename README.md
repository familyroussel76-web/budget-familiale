# Budget Familial V3.4.1
Correctifs : alignement des cases Prioritaire ; bouton Réinitialiser les reports depuis Accueil → Revenu et répartition.

## Installation
1. Dans Supabase → SQL Editor, exécuter `SUPABASE_V3.4.1.sql` (la V3.4.0 doit déjà être installée).
2. Dans GitHub Pages, remplacer `index.html` à la racine par celui de cette archive.
3. Actualiser l'application, vérifier V3.4.1.

La réinitialisation crée un marqueur partagé par compte Supabase et par mois : elle coupe le report entrant au mois sélectionné, sans effacer les mois passés, dépenses, revenus, transferts ou budgets. Le report reprend normalement les mois suivants à partir du solde du mois réinitialisé. Cette action n'est pas annulable depuis l'interface.

Attention : les utilisateurs connectés avec des comptes Supabase distincts ne partagent pas automatiquement les données si la base est toujours organisée par `user_id`.
