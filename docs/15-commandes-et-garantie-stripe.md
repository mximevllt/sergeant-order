# Étape fonctionnelle 14 — commandes et garantie bancaire Stripe

## Résultat

Un devis doté d’un créneau provisoire peut désormais devenir une vraie commande. Le client doit d’abord vérifier son email, puis autoriser explicitement l’enregistrement de sa carte. Stripe collecte les données bancaires dans ses propres composants : le navigateur et le serveur SERGEANT PAYSAGE ne reçoivent jamais le numéro de carte ni le cryptogramme.

La règle commerciale reste inchangée : **aucun débit n’est effectué lors de la réservation**. Le moyen de paiement garantit le créneau. Le débit du montant final interviendra après la prestation et la clôture du compte rendu, dans une étape fonctionnelle ultérieure.

## Parcours client

1. Le client valide son devis et obtient un verrou de créneau de 15 minutes.
2. La page de confirmation lui demande de se connecter s’il ne possède pas encore de session vérifiée.
3. Le retour après lien magique est limité à `/paiement` ou `/paiement/retour` ; aucune redirection vers un domaine externe n’est acceptée.
4. Le client accepte le texte d’autorisation daté et versionné.
5. `POST /api/orders/payment-setup` crée ou reprend une commande idempotente.
6. Stripe affiche le formulaire bancaire à partir d’un `SetupIntent` prévu pour un usage ultérieur hors session.
7. Une authentification bancaire est effectuée si la banque l’exige.
8. La page de retour attend la confirmation serveur et ne se déclare jamais elle-même réussie.

L’espace client affiche ensuite la commande, ses tâches, son montant prévu, son créneau et son statut. Une commande dont le verrou a expiré est proposée à la reprogrammation.

## Création atomique de la commande

Avant l’appel externe à Stripe, le serveur vérifie de nouveau :

- la session client et la propriété du devis ;
- l’état `SLOT_HELD` du devis ;
- l’existence d’un verrou actif non expiré ;
- la présence des montants calculés côté serveur ;
- la validité du jardin enregistré ou de l’adresse issue du devis ;
- la clé d’idempotence de la tentative.

Une transaction libSQL crée alors :

- la commande `PENDING_PAYMENT_SETUP` avec une référence publique `SP-CMD-…` ;
- les instantanés immuables du prix, de l’adresse de prestation et de l’identité de facturation ;
- la copie des tâches du devis dans `order_tasks` ;
- la tentative `payments` de type `SETUP`, toujours d’un montant nul ;
- l’historique initial de commande ;
- l’événement d’audit du consentement ;
- le rattachement du verrou à la commande.

Si le devis anonyme ne visait pas encore un jardin enregistré, une adresse et un jardin appartenant au compte vérifié sont créés dans la même opération. Une contrainte unique sur `orders.quote_id` interdit les doubles commandes. Les tentatives réseau réutilisent la même tentative de paiement et le même SetupIntent.

## Stripe et données conservées

Le serveur crée ou récupère un `Customer` Stripe, puis crée un `SetupIntent` avec `usage=off_session`. libSQL conserve uniquement :

- l’identifiant du client Stripe dans `customer_profiles.stripe_customer_id` ;
- l’identifiant du SetupIntent dans `payments.provider_reference` ;
- l’identifiant du moyen de paiement dans `payments.provider_payment_method_reference` après validation ;
- les statuts, dates, codes d’échec non sensibles et clés d’idempotence.

Aucun champ de la base ne prévoit de numéro de carte, date d’expiration ou cryptogramme.

## Webhook source de vérité

Stripe doit envoyer ses événements à :

`POST https://DOMAINE/api/webhooks/stripe`

Les événements traités à cette étape sont :

- `setup_intent.succeeded` ;
- `setup_intent.setup_failed` ;
- `setup_intent.canceled`.

La signature est contrôlée sur le corps brut avec `STRIPE_WEBHOOK_SECRET`. L’événement est enregistré dans `provider_events` avec son identifiant Stripe unique avant traitement. Un événement déjà terminé ne peut produire aucun doublon ; un traitement réellement échoué est marqué rejouable.

Sur `setup_intent.succeeded`, une seule opération cohérente :

- marque la tentative de paiement `SUCCEEDED` ;
- enregistre la référence du moyen de paiement ;
- transforme le verrou `HOLD` en réservation durable `ORDER` sans date d’expiration ;
- passe le devis à `ACCEPTED` ;
- passe la commande à `SCHEDULED` ;
- ajoute l’historique et l’audit fournisseur.

Le moteur de disponibilités considère immédiatement cette réservation `ORDER` comme occupée. Une commande confirmée est donc déjà connectée aux données du planning entreprise, même si l’interface de gestion détaillée sera enrichie dans les étapes suivantes.

## Expiration et échecs

Si les 15 minutes expirent avant la confirmation Stripe :

- les demi-journées sont libérées ;
- le verrou devient `EXPIRED` ;
- le devis redevient `PRICED` ;
- la commande passe à `PAYMENT_FAILED` ;
- la tentative non terminée devient `CANCELLED` avec le code sûr `HOLD_EXPIRED`.

Si la carte échoue, la commande et le paiement conservent leur historique. Le client peut réessayer tant que le verrou est actif ou sélectionner un nouveau créneau. Un SetupIntent réussi après libération effective du créneau n’effectue toujours aucun débit et ne recrée pas silencieusement une réservation devenue indisponible.

## Configuration

Trois variables sont nécessaires dès que `PAYMENT_MODE` vaut `test` ou `live` :

```dotenv
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

La préproduction exige des clés `test`. La production exige des clés `live`. Les contrôles d’environnement refusent le mélange des modes. En développement, `PAYMENT_MODE=disabled` permet de parcourir le site sans créer de commande ni contacter Stripe ; l’interface explique alors que le paiement n’est pas activé.

## Garanties automatisées

La suite vérifie :

- la compilation Next.js et TypeScript des pages et routes de paiement ;
- la protection de la page et des API par session client ;
- la conservation sûre du retour après connexion ;
- le rejet d’un webhook à signature invalide ;
- la présence du champ de référence Stripe sans champ bancaire sensible ;
- les 35 contrôles déjà existants sur comptes, devis, tarifs, zones, disponibilités et verrous.

Une recette Stripe réelle nécessite enfin les trois clés de test du compte SERGEANT PAYSAGE, l’enregistrement du webhook et une carte de test Stripe. Ces secrets ne sont volontairement ni générés ni stockés dans le dépôt.
