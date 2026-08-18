# Étape 06 — Installation de la base et cycle de migrations

Statut : **terminée dans le code et prête au déploiement**.

Cette étape rend la base de l'étape 05 réellement installable. Elle ajoute une migration ordonnée, les données de référence de SERGEANT PAYSAGE, un jeu de démonstration strictement local, une commande d'initialisation répétable et une procédure de mise à jour contrôlée.

Elle ne branche pas encore les écrans aux comptes et commandes réels : ce travail commence à l'étape 07 avec l'authentification, puis se poursuit module par module.

## 1. Résultat installé

La base contient désormais **50 tables** et deux migrations ordonnées :

| Migration | Rôle |
|---|---|
| `0000_dear_gunslinger.sql` | Structure métier complète, contraintes, index et protections append-only |
| `0001_chief_greymalkin.sql` | Paramètres de l'entreprise et données de référence validées |

Le schéma source reste `db/schema.ts`. La nouvelle table `business_settings` centralise les paramètres qui doivent être partagés par les futurs moteurs de réservation, de prix, de paiement et de facturation.

## 2. Données de référence réelles

La seconde migration installe de manière idempotente :

- l'identité légale de SERGEANT PAYSAGE, son siège, son SIREN, son SIRET, son numéro de TVA, son capital et son RCS ;
- la TVA à 20 %, la devise EUR et le fuseau `Europe/Paris` ;
- le délai minimal de 24 heures et l'horizon de réservation de 31 jours ;
- les jours travaillés du lundi au vendredi et deux demi-journées par jour ;
- l'activation déclarée de l'avance immédiate ;
- deux équipes actives, leurs 20 plages hebdomadaires et leurs 12 capacités ;
- les prestations ponctuelle et récurrente ;
- six tâches initiales : tonte, taille de haies, débroussaillage, massifs, nettoyage et entretien complet ;
- la version active du barème à 329 € TTC la demi-journée ;
- treize règles tarifaires explicites, dont 1 € par mètre de haie au-delà de 5 m et un supplément de hauteur plafonné à 25 € ;
- les trois zones commerciales déclarées.

La zone du Var est active. Les zones « Bouches-du-Rhône jusqu'à Marseille » et « Alpes-Maritimes jusqu'à Nice » sont présentes mais restent inactives tant que la liste exacte des communes n'a pas été figée à l'étape 12. Cela empêche d'accepter par erreur une adresse hors du périmètre souhaité.

## 3. Séparation entre réel et démonstration

Les données réelles et les données fictives ne suivent jamais le même chemin :

| Contenu | Fichier | Local | Préproduction | Production |
|---|---|---:|---:|---:|
| Structure et références réelles | `drizzle/*.sql` | Oui | Oui | Oui |
| Parcours fictif complet | `db/seeds/demo.sql` | Oui | Non | Non |

Le jeu local crée des identifiants préfixés par `demo-`, des emails sous le domaine réservé `.invalid`, un client, un jardin, un devis, une commande, une réservation, une affectation et une intervention. Il utilise `INSERT OR IGNORE`, ce qui permet de le rejouer sans doublon.

Le lanceur `scripts/seed-demo.mjs` :

- n'accepte que `APP_ENV=development` ;
- s'arrête avant toute opération dans un autre environnement ;
- ne contient aucune option distante ;
- applique d'abord les migrations locales, puis le jeu fictif.

## 4. Initialisation locale

Pré-requis : Node.js 22.13 ou plus récent et les dépendances du projet installées.

```bash
npm run db:seed:demo
```

Cette commande suffit pour une première installation. Elle utilise la liaison logique `DB` déclarée dans `wrangler.local.jsonc`, sans identifiant de base distante.

Pour appliquer uniquement les migrations, sans cas de démonstration :

```bash
npm run db:migrate:local
```

Pour valider le schéma, les contraintes, les références et l'idempotence du jeu de démonstration :

```bash
npm run db:validate
```

Une seconde exécution de `db:seed:demo` doit afficher qu'aucune migration ne reste à appliquer et ne doit créer aucun doublon.

## 5. Création d'une nouvelle migration

Toute évolution suit cet ordre :

1. modifier `db/schema.ts` ;
2. générer une nouvelle migration avec `npm run db:generate` ;
3. relire le SQL généré et compléter uniquement la nouvelle migration si des données de référence ou protections spécifiques sont nécessaires ;
4. exécuter l'ensemble depuis une base locale vierge ;
5. exécuter la suite de tests ;
6. appliquer sur la base de préproduction dédiée ;
7. réaliser la recette fonctionnelle ;
8. sauvegarder la production et préparer le retour arrière ;
9. déployer exactement la version testée ;
10. contrôler la migration, la santé du site et les journaux après déploiement.

Une migration déjà appliquée n'est jamais modifiée, renommée ou supprimée. Une correction est toujours ajoutée dans une migration ultérieure.

## 6. Déploiement et mise à jour

Le site utilise la liaison D1 logique `DB` déclarée dans `.openai/hosting.json`. Le paquet de déploiement contient le dossier `drizzle` ; Sites applique les migrations encore absentes dans leur ordre numérique à la base liée à la version.

La promotion respecte les frontières définies à l'étape 04 :

```text
développement local → préproduction dédiée → production
```

Les interdictions suivantes sont permanentes :

- ne jamais copier le fichier de démonstration dans `drizzle` ;
- ne jamais ajouter une option distante au script de démonstration ;
- ne jamais réutiliser une base entre deux environnements ;
- ne jamais corriger la production par une commande SQL manuelle non versionnée ;
- ne jamais mettre un secret ou un identifiant physique de base dans le dépôt.

## 7. Sauvegarde et retour arrière

Avant une migration sensible :

1. créer un export ou une sauvegarde restaurable de la base concernée ;
2. noter la version du site et la dernière migration appliquée ;
3. tester la restauration sur une ressource isolée ;
4. vérifier que la version précédente du code reste compatible avec le schéma étendu ;
5. prévoir une migration corrective en avant pour toute transformation non réversible.

Le retour arrière du code ne retire pas automatiquement une migration. Les évolutions doivent donc être compatibles pendant la fenêtre de déploiement. Pour une transformation destructive, la méthode obligatoire est : ajout du nouveau champ, double lecture/écriture temporaire, recopie contrôlée, bascule vérifiée, puis retrait dans une étape ultérieure.

## 8. Contrôles automatiques

Les tests vérifient notamment :

- l'application de toutes les migrations dans l'ordre sur une base vierge ;
- la présence des 50 tables et l'absence de clé étrangère invalide ;
- les protections d'identité, de prix, de planning, d'audit et de facturation ;
- les paramètres réels de l'entreprise ;
- les deux équipes et leurs horaires ;
- le barème actif à 329 € TTC et ses treize règles ;
- l'application deux fois du jeu fictif sans doublon ;
- le refus explicite du jeu fictif hors développement.

La validation locale D1 a également été effectuée deux fois : première création complète des deux migrations, puis nouvelle exécution sans migration restante.

## 9. État à la fin de l'étape

- la structure et les références réelles sont versionnées ensemble ;
- une base locale complète peut être créée avec une seule commande ;
- les développeurs disposent d'un scénario fictif cohérent sans risque de contamination de la production ;
- le déploiement peut appliquer les migrations à la base D1 liée ;
- les mises à jour futures disposent d'une discipline de promotion, de sauvegarde et de correction ;
- la prochaine étape peut construire l'authentification sur une base réellement persistante.
