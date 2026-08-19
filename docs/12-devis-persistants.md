# Étape fonctionnelle 11 — devis persistants

## Résultat

Le configurateur n’est plus une simple maquette volatile. Il sauvegarde la progression sur l’appareil, enregistre un devis dans libSQL dès qu’une adresse email valide est connue et permet sa reprise depuis le même navigateur ou l’espace client.

Un devis enregistré contient notamment :

- le client et, lorsqu’il est choisi, le jardin et l’organisation autorisés ;
- les prestations, leur ordre de priorité et leurs mesures ;
- les réponses des six étapes, hors codes d’accès et données bancaires ;
- la durée recommandée et choisie ;
- chaque ligne tarifaire, le montant HT, la TVA à 20 %, le TTC et la part éligible SAP ;
- la version du barème, son instantané et une empreinte empêchant toute ambiguïté ;
- une référence publique `SP-DV-…`, un statut, une date de mise à jour et une expiration à sept jours.

## Sécurité et fiabilité

- Le prix reçu du navigateur n’est jamais accepté : l’API recalcule le montant avec le barème actif.
- Une création porte une clé d’idempotence ; une répétition identique retourne le même devis et une réutilisation différente est refusée.
- Un client authentifié n’accède qu’à ses devis et jardins.
- Un visiteur anonyme reçoit un cookie HTTP-only signé qui prouve l’accès à son unique devis courant.
- Une connexion avec le même email rattache le devis anonyme au compte client.
- Créations, modifications et annulations produisent un événement d’audit.
- Le configurateur ne collecte aucune donnée bancaire tant que Stripe n’est pas réellement raccordé.

## API

- `POST /api/quotes` : crée un devis recalculé côté serveur.
- `GET /api/quotes/current` : reprend le devis courant autorisé.
- `GET /api/quotes/:id` : consulte un devis autorisé.
- `PATCH /api/quotes/:id` : remplace son instantané et recalcule son tarif.
- `DELETE /api/quotes/:id` : annule un devis non accepté.

Toutes les réponses sont non mises en cache. Les écritures exigent une requête de même origine.

## Limite volontaire de cette étape

Le choix affiché de date et d’horaire reste un souhait enregistré dans le devis. Aucun créneau réel n’est encore bloqué, aucune commande n’est créée et aucun paiement n’est effectué. La page de confirmation l’indique explicitement. Le moteur de disponibilités, la réservation transactionnelle du créneau puis Stripe appartiennent aux étapes fonctionnelles suivantes.
