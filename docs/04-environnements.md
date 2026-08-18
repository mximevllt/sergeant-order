# Étape 04 — Environnements, variables et secrets

Statut : **terminée dans le code**.

Cette étape fixe les frontières entre le développement, la préproduction et la production. Elle ne crée pas encore les bases D1, les espaces R2, les comptes clients ni les connexions Stripe et Urssaf : ces ressources et intégrations ont leurs propres étapes. Elle garantit en revanche qu'elles ne pourront pas être branchées indistinctement.

## 1. Les trois environnements

| Environnement | Usage | Données | Emails | Paiements | Avance immédiate |
|---|---|---|---|---|---|
| Développement | Travail local et tests automatisés | Fictives | Écrits dans les journaux, aucun envoi réel | Désactivés ou Stripe test | Désactivée ou API de test |
| Préproduction | Recette complète avant mise en ligne | Fictives et dédiées | Destinataires de test contrôlés | Stripe test uniquement | API Urssaf de test uniquement |
| Production | Site utilisé par les vrais clients et l'entreprise | Réelles | Envois réels | Stripe live uniquement | API Urssaf de production uniquement |

Une ressource appartient à un seul environnement. Une base, un espace de fichiers, une clé, un webhook ou une adresse d'envoi de production ne doit jamais être réutilisé en développement ou en préproduction.

## 2. Fichiers de configuration suivis

Trois modèles sans secret réel sont maintenant versionnés :

- `.env.example` : développement local ;
- `.env.staging.example` : préproduction ;
- `.env.production.example` : production.

Les véritables fichiers `.env*` restent ignorés par Git. Seuls les fichiers terminant par `.example` peuvent être suivis. Une valeur réelle ne doit jamais être écrite dans l'un de ces modèles.

Pour travailler localement, copier `.env.example` vers `.env.local`, puis ne renseigner que les services nécessaires à l'étape en cours. Les modes par défaut sont volontairement inoffensifs : emails dans les journaux, paiements désactivés et avance immédiate désactivée.

## 3. Variables principales obligatoires

| Variable | Rôle | Règle |
|---|---|---|
| `APP_ENV` | Identifie l'environnement courant | `development`, `staging` ou `production` uniquement |
| `APP_URL` | URL canonique du site | HTTPS obligatoire hors développement local |
| `COMPANY_TIMEZONE` | Fuseau des réservations | Fixé à `Europe/Paris` |
| `SUPPORT_EMAIL` | Adresse de contact opérationnelle | Adresse valide et non fictive hors local |
| `EMAIL_DELIVERY_MODE` | Sécurité d'envoi | `log` en local, `test` en préproduction, `live` en production |
| `PAYMENT_MODE` | Sécurité Stripe | `disabled` ou `test` en local, `test` en préproduction, `live` en production |
| `AICI_MODE` | Sécurité Urssaf | `disabled` ou `test` en local, `test` en préproduction, `live` en production |

La préproduction et la production ne bénéficient d'aucune valeur implicite. Si une variable principale manque, leur contrôle de santé échoue.

## 4. Inventaire des intégrations

Les groupes sont contrôlés comme des ensembles : dès qu'une variable d'un groupe est renseignée, toutes celles nécessaires au groupe doivent l'être.

### Authentification

- `AUTH_SECRET` : empreinte cryptographique des sessions, adresses réseau et liens de connexion.
- `INITIAL_ADMIN_EMAIL` : adresse nominative autorisée à créer l'unique premier administrateur lorsqu'aucun rôle `ADMIN` n'existe encore.

### Emails transactionnels

- `RESEND_API_KEY` : clé serveur Resend ;
- `RESEND_FROM_EMAIL` : expéditeur vérifié.

### Paiements Stripe

- `STRIPE_SECRET_KEY` : clé serveur ;
- `STRIPE_WEBHOOK_SECRET` : signature des événements entrants ;
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` : clé publiable utilisée dans le navigateur.

Une clé commençant par `sk_live_` ou `pk_live_` est automatiquement refusée hors production. À l'inverse, la production refuse les clés de test.

### Avance immédiate Urssaf

- `URSSAF_CLIENT_ID` ;
- `URSSAF_CLIENT_SECRET` ;
- `URSSAF_API_BASE_URL` ;
- `URSSAF_NOVA_NUMBER` ;
- `ACCESS_DATA_ENCRYPTION_KEY` : chiffrement applicatif des données sensibles nécessaires au service.

Les identifiants de test et de production doivent provenir de deux jeux d'accès distincts.

### Supervision et protection

- `SENTRY_DSN` et `NEXT_PUBLIC_SENTRY_DSN` ;
- `TURNSTILE_SECRET_KEY` et `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

Ces services restent facultatifs pendant le développement, mais doivent être complets avant l'ouverture au public.

## 5. Ressources isolées à créer dans les étapes suivantes

| Ressource | Développement | Préproduction | Production |
|---|---|---|---|
| Base D1 | Base locale | Base D1 dédiée recette | Base D1 dédiée réelle |
| Fichiers R2 | Stockage local | Bucket dédié recette | Bucket privé dédié réel |
| Webhook Stripe | Endpoint et secret test | Endpoint et secret test dédiés | Endpoint et secret live dédiés |
| Webhook Urssaf | Simulateur/test | Endpoint de recette | Endpoint réel |
| Domaine | `localhost` | Sous-domaine de recette non indexé | Domaine public final |
| Emails | Journal local | Domaine ou flux de test | Domaine expéditeur vérifié |

Les identifiants physiques de D1 et R2 ne sont pas écrits manuellement dans `.openai/hosting.json`. Le fichier conserve le projet Sites et ses noms de liaisons logiques ; l'hébergement gère les ressources physiques.

## 6. Contrôles automatiques ajoutés

Le module `config/environment.mjs` réalise les contrôles suivants sans renvoyer la valeur d'un secret :

- environnement reconnu ;
- présence des variables principales ;
- URL absolue et HTTPS hors local ;
- fuseau horaire cohérent avec le planning ;
- modes test/réel conformes ;
- groupes d'intégration complets ;
- absence de valeurs d'exemple ;
- impossibilité d'utiliser Stripe live hors production ;
- impossibilité d'utiliser Stripe test en production.

Commandes disponibles :

- `npm run env:check` : contrôle quotidien de la configuration locale ;
- `npm run env:check:all` : contrôle de mise en service, exigeant toutes les intégrations ;
- `npm run check` : inclut désormais le contrôle d'environnement avant les contrôles de code et les tests.

Six tests automatiques couvrent les valeurs locales sûres, les exigences de préproduction, les modes de production, les groupes partiels, le cloisonnement des clés Stripe et l'absence de fuite des secrets dans les rapports.

## 7. Contrôle de santé

La route `GET /api/health` fournit uniquement trois informations non sensibles : état général, environnement reconnu et état de la configuration. Elle ne renvoie ni nom de variable manquante ni valeur.

- en local, les valeurs sûres par défaut sont autorisées ;
- sur une adresse distante, toutes les variables principales et toutes les intégrations doivent être opérationnelles ;
- tant que ce n'est pas le cas, la route répond `503 misconfigured`, ce qui empêche de considérer prématurément un déploiement comme prêt.

## 8. Procédure de promotion

Une version ne passe à l'environnement suivant que dans cet ordre :

1. contrôles et tests réussis en développement ;
2. déploiement en préproduction avec ses propres ressources ;
3. recette des parcours client, entreprise, paiement, AICI, facturation et emails ;
4. sauvegarde et procédure de retour arrière vérifiées ;
5. validation explicite de la mise en production ;
6. déploiement du même code en production avec les secrets de production injectés par l'hébergement ;
7. contrôle de santé, test de réservation à faible risque et surveillance des erreurs.

Il est interdit de copier des données clients réelles vers la préproduction. Si un cas réaliste est nécessaire, il doit être recréé avec des données fictives ou anonymisées de manière irréversible.

## 9. État à la fin de l'étape

- la configuration locale est exploitable sans service réel ;
- les modèles de préproduction et de production sont prêts à recevoir leurs valeurs dans le coffre de secrets de l'hébergement ;
- le code sait détecter un mélange dangereux entre environnements ;
- les futurs branchements D1, R2, authentification, Resend, Stripe, Urssaf, Sentry et Turnstile disposent de noms stables ;
- aucune clé réelle n'a été demandée, enregistrée ou exposée pendant cette étape ;
- les ressources distantes seront créées au moment de leurs étapes dédiées, afin d'éviter une infrastructure vide ou mal liée.
