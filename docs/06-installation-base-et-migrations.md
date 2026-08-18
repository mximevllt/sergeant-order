# Étape 06 — Installation de la base et cycle de migrations

Statut : **terminée dans le code et compatible avec Turso/Vercel**.

## Contenu installé

Quatre migrations SQL ordonnées créent les 50 tables et les données de référence :

| Migration | Rôle |
|---|---|
| `0000_dear_gunslinger.sql` | Structure métier, contraintes, index et protections append-only |
| `0001_chief_greymalkin.sql` | Entreprise, équipes, horaires, catalogue, barème et zones |
| `0002_elite_madame_hydra.sql` | Authentification client et entreprise |
| `0003_chubby_morph.sql` | Profils, jardins et compléments applicatifs |

Les références réelles comprennent notamment SERGEANT PAYSAGE, deux équipes, les horaires du lundi au vendredi, le délai de 24 heures, l’horizon de 31 jours, six tâches et le barème à 329 € TTC par demi-journée.

## Initialisation locale

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm db:seed:demo
```

`pnpm db:migrate` utilise `TURSO_DATABASE_URL`. Sans configuration explicite, le code utilise `file:./sergeant-paysage.local.db`. Le jeton Turso n’est pas requis pour un fichier local.

Le jeu `db/seeds/demo.sql` est séparé des migrations. Son lanceur refuse tout environnement autre que `development`, ce qui empêche son exécution accidentelle en préproduction ou en production.

## Installation sur Turso

1. Créer une base distincte pour l’environnement visé.
2. Charger `TURSO_DATABASE_URL` et `TURSO_AUTH_TOKEN` dans un terminal sécurisé.
3. Exécuter `pnpm db:migrate` depuis exactement la révision qui sera déployée.
4. Vérifier la sortie : chaque migration nouvelle est annoncée, puis le nombre total de migrations est affiché.
5. Déployer la même révision sur Vercel.

Le script crée `app_migrations`, lit les fichiers dans l’ordre et inscrit chaque migration seulement après l’exécution réussie de son lot. Une deuxième exécution ne rejoue rien.

Vercel ne lance volontairement pas les migrations pendant chaque build : un build de prévisualisation ne doit jamais modifier silencieusement la production. La migration reste une opération explicite avant promotion.

## Nouvelle migration

1. Modifier `db/schema.ts`.
2. Générer une nouvelle migration avec `pnpm db:generate`.
3. Relire le SQL et ne jamais modifier une migration déjà appliquée.
4. Tester la suite complète sur une base locale vierge.
5. Sauvegarder la base de préproduction et y appliquer la migration.
6. Faire la recette fonctionnelle.
7. Sauvegarder la production, appliquer la migration, puis déployer le code validé.

Une transformation destructive doit passer par ajout, recopie contrôlée, bascule puis retrait dans une migration ultérieure. Un retour arrière du code ne retire jamais automatiquement une migration.

## Contrôles

Les tests vérifient la création des 50 tables, les clés étrangères, l’unicité, les protections tarifaires et financières, l’exclusivité des créneaux, l’immutabilité de l’audit, les données de référence et l’idempotence du jeu de démonstration.

Commandes :

- `pnpm db:validate` : schéma et contraintes ;
- `pnpm typecheck` : contrats TypeScript ;
- `pnpm test` : build Next.js et parcours de bout en bout avec une base libSQL temporaire.

Avant toute bascule publique, préproduction et production doivent avoir leurs propres bases Turso, secrets, sauvegardes et procédures de restauration.
