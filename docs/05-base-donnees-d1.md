# Étape 05 — Base de données D1 et modèle métier

Statut : **terminée dans le code**.

Cette étape crée le socle de données durable de SERGEANT PAYSAGE. Elle fournit le schéma complet, la migration initiale, les clés étrangères, les contraintes d'unicité, les index issus des parcours prévus et des tests sur une vraie base SQLite vierge.

Elle ne remplace pas les étapes fonctionnelles suivantes : les pages utilisent encore leurs données de démonstration tant que les modules serveur, l'authentification, le moteur de prix, le planning et les paiements ne sont pas branchés à ces tables.

## 1. Infrastructure retenue

- Source de vérité structurée : Cloudflare D1.
- Format : SQLite.
- Couche typée : Drizzle ORM.
- Liaison logique d'hébergement : `DB`.
- Schéma source : `db/schema.ts`.
- Migration initiale : `drizzle/0000_dear_gunslinger.sql`.
- Fichiers binaires : jamais dans D1 ; seules leurs métadonnées sont prévues. Les octets seront stockés dans R2 à l'étape dédiée.

Le fichier d'hébergement déclare maintenant la liaison D1 `DB`. Les identifiants physiques de la base restent gérés par Sites et ne sont pas écrits dans le dépôt.

## 2. Conventions générales

- Les identifiants métier sont des chaînes non prévisibles générées par l'application.
- Les dates techniques sont stockées en UTC sous forme ISO, puis affichées en `Europe/Paris`.
- Tous les montants sont des centimes entiers ; aucun montant financier n'utilise un flottant.
- Les taux sont exprimés en points de base : 20 % = `2000`.
- Les durées de prestation sont des nombres entiers de demi-journées.
- Les quantités de facture sont exprimées en milli-unités pour éviter les arrondis flottants.
- Les coordonnées sont stockées en millionièmes de degré.
- Les instantanés JSON conservent l'information contractuelle telle qu'elle existait au moment du devis, de la commande ou de la facture.
- Les codes d'accès ne disposent d'aucun champ en clair : seule une valeur chiffrée et sa version de clé sont prévues.
- Les suppressions en cascade sont limitées aux véritables sous-objets non contractuels. Les commandes, factures, paiements et historiques ne sont pas supprimés en cascade.

## 3. Dictionnaire des 50 tables

### Paramètres de l'entreprise

| Table | Responsabilité |
|---|---|
| `business_settings` | Identité légale, TVA, fuseau, horaires, délai minimal, horizon de réservation et activation AICI |

### Identité et autorisations

| Table | Responsabilité |
|---|---|
| `users` | Identité nominative, email normalisé, état et coordonnées |
| `user_roles` | Rôles client, terrain, planning, comptabilité et administration |
| `auth_sessions` | Sessions révocables, avec jeton uniquement sous forme hachée |
| `magic_link_tokens` | Liens de connexion ou vérification à usage unique |
| `organizations` | Clients professionnels, SIREN, TVA et identité de facturation |
| `organization_memberships` | Utilisateurs autorisés au sein d'une organisation |
| `customer_profiles` | Type particulier/professionnel et identifiant client Stripe |

### Adresses, jardins et accès

| Table | Responsabilité |
|---|---|
| `addresses` | Adresse normalisée, commune, département et coordonnées géographiques |
| `gardens` | Jardin ou site, surface, accès, animaux et notes séparées |
| `garden_contacts` | Contacts autorisés pour un jardin |
| `garden_access_secrets` | Codes et consignes sensibles chiffrés |

### Catalogue, tarifs et territoire

| Table | Responsabilité |
|---|---|
| `catalog_services` | Prestations ponctuelles ou récurrentes |
| `catalog_tasks` | Tonte, haies, débroussaillage et autres tâches mesurables |
| `pricing_versions` | Versions brouillon, active et archivées du barème |
| `pricing_rules` | Règles ordonnées et leurs conditions/calculs versionnés |
| `service_zones` | Secteurs, délai minimal, horizon et éventuel supplément |
| `zone_municipalities` | Communes et codes postaux inclus ou exclus |

### Équipes et disponibilités

| Table | Responsabilité |
|---|---|
| `teams` | Les deux équipes initiales et les futures équipes |
| `team_members` | Historique d'appartenance des salariés |
| `team_capabilities` | Compétences et matériels disponibles par équipe |
| `team_weekly_hours` | Matin/après-midi par jour ISO de la semaine |
| `team_unavailabilities` | Congés, absences, pannes ou fermetures |
| `schedule_reservations` | Verrous temporaires, réservations de commande ou blocages internes |
| `schedule_reservation_slots` | Chaque demi-journée réellement consommée par une équipe |
| `order_assignments` | Historique des affectations et réaffectations |

### Devis et commandes

| Table | Responsabilité |
|---|---|
| `quotes` | Brouillon, résultat tarifaire, durée et empreinte de calcul |
| `quote_tasks` | Tâches choisies, mesures et ordre de priorité du devis |
| `quote_adjustments` | Base, suppléments, réductions et taxes expliqués |
| `orders` | Contrat accepté, prix figé, identité et adresse figées |
| `order_tasks` | Copie contractuelle des tâches à réaliser |
| `order_status_history` | Historique append-only de chaque changement d'état |

### Intervention et entretien régulier

| Table | Responsabilité |
|---|---|
| `interventions` | Mission planifiée, équipe, temps prévu et temps réel |
| `intervention_tasks` | Avancement détaillé de chaque tâche |
| `intervention_events` | Départ, arrivée, pause, incident et chronologie append-only |
| `intervention_reports` | Compte rendu client, notes internes et validation finale |
| `recurring_plans` | Contrat d'entretien régulier et fréquence |
| `recurring_occurrences` | Occurrences uniques générées depuis un plan |

### Facturation, paiements et AICI

| Table | Responsabilité |
|---|---|
| `invoices` | Facture ou avoir, identité figée, totaux, statut et empreinte |
| `invoice_lines` | Lignes chiffrées et éligibilité service à la personne |
| `invoice_counters` | Numérotation atomique par série et année |
| `payments` | Mise en place, débit, garantie ou ajustement |
| `refunds` | Remboursements distincts et idempotents |
| `aici_customers` | Inscription et activation Urssaf du particulier |
| `aici_payment_requests` | Demande AICI, part client, crédit et règlement |
| `provider_events` | Webhooks Stripe, Urssaf, Resend et facturation électronique |

### Fichiers, communications et exploitation

| Table | Responsabilité |
|---|---|
| `stored_files` | Métadonnées R2, empreinte, propriétaire et conservation |
| `notification_outbox` | Emails/SMS fiables, tentatives et reprise après panne |
| `idempotency_keys` | Protection contre la répétition des opérations critiques |
| `audit_events` | Journal de sécurité et métier append-only |

## 4. Protections assurées par la base

### Identité

- un seul compte par email normalisé ;
- un seul rôle donné par utilisateur ;
- jetons de session et liens magiques uniques ;
- un seul rattachement d'un utilisateur à une organisation.

### Prix

- une seule version de barème peut être `ACTIVE` ;
- une version porte un numéro unique ;
- les montants et taux invalides sont rejetés ;
- les devis et commandes conservent les instantanés qui empêchent une modification rétroactive.

### Planning

- chaque verrou possède une clé d'idempotence unique ;
- une réservation multi-jours est découpée en demi-journées explicites ;
- l'index partiel `uq_schedule_slots_team_start_active` interdit deux occupations actives de la même équipe au même début de créneau ;
- un créneau libéré peut être réattribué ;
- une seule affectation courante existe par commande, les précédentes restant historisées.

### Paiements et connecteurs

- références fournisseur et clés d'idempotence uniques ;
- un webhook ne peut être enregistré deux fois pour le même fournisseur ;
- l'identité et le contenu brut d'un événement fournisseur deviennent immuables après réception ;
- les remboursements sont des objets distincts du paiement d'origine ;
- la somme part client + crédit d'impôt doit être égale au montant AICI éligible.

### Factures

- numéro de facture unique ;
- couple série/numéro de séquence unique ;
- un avoir doit référencer sa facture d'origine ;
- après sortie du brouillon, les données financières et contractuelles d'une facture ne peuvent plus être modifiées ;
- une facture émise ne peut pas être supprimée ;
- ses lignes ne peuvent plus être ajoutées, modifiées ou supprimées ;
- son état de paiement peut néanmoins continuer à évoluer normalement.

### Audit

Les événements d'audit, l'historique des commandes et la chronologie des interventions sont append-only : la migration installe des déclencheurs SQLite qui refusent leurs modifications et suppressions.

## 5. Index et requêtes visées

Les index ne sont pas génériques. Ils correspondent notamment à :

- chargement des commandes d'un client par date ;
- planning d'une équipe sur une période ;
- créneaux actifs et expirants ;
- devis arrivant à expiration ;
- interventions du jour par équipe et statut ;
- factures d'un client et factures à relancer ;
- paiements, demandes AICI et webhooks en attente ;
- emails prêts à être envoyés ou retentés ;
- plans d'entretien dont une occurrence doit être créée ;
- fichiers arrivant à leur échéance de conservation ;
- recherche d'audit par entité, acteur ou action.

La migration termine par `PRAGMA optimize` pour préparer le planificateur SQLite. Un test `EXPLAIN QUERY PLAN` confirme que la liste des commandes client utilise bien son index composite.

## 6. Tests automatiques de la migration

Le test `tests/database-schema.test.mjs` exécute réellement toute la migration dans une base SQLite en mémoire, avec les clés étrangères activées. Il contrôle :

1. la création des 50 tables ;
2. l'absence de référence étrangère invalide ;
3. l'unicité des emails ;
4. l'impossibilité d'avoir deux barèmes actifs ;
5. le refus des montants tarifaires négatifs ;
6. le refus d'un double créneau pour une équipe ;
7. la réutilisation correcte d'un créneau libéré ;
8. l'immutabilité du journal d'audit ;
9. l'utilisation d'un index métier par SQLite ;
10. la présence des protections de facturation et de l'optimisation.

La commande `npm run db:validate` permet d'exécuter uniquement ces contrôles. La suite générale les exécute également.

## 7. Discipline de migration

- Toute évolution commence dans `db/schema.ts`.
- Une nouvelle migration est générée et relue ; une migration déjà appliquée n'est jamais réécrite.
- Chaque migration est exécutée sur une base vierge et sur une copie de préproduction avant production.
- Les changements destructifs passent par ajout, recopie contrôlée, vérification puis retrait dans une migration ultérieure.
- La production n'est jamais modifiée manuellement pour contourner une migration.
- Une sauvegarde et un retour arrière applicatif sont préparés avant toute migration sensible.

## 8. État à la fin de l'étape

- la structure de données couvre le cycle complet, du compte client à la facture et au compte rendu ;
- le code dispose d'un accès D1 centralisé via `getDb()` ;
- la liaison logique `DB` est active dans la configuration Sites ;
- la migration structurelle initiale est versionnée et exécutable ;
- les protections critiques sont vérifiées automatiquement ;
- aucune donnée fictive n'est injectée dans une future base de production ;
- depuis l'étape 06, une seconde migration installe séparément les paramètres réels de la société, les deux équipes, les horaires, le catalogue, le barème à 329 € et les zones initiales.
