# Étape fonctionnelle 15 — planning entreprise

Cette étape rend le créneau confirmé exploitable par l’entreprise. Elle ne se contente plus de le réserver : chaque commande garantie apparaît dans un planning sécurisé, rattachée à l’équipe réellement retenue par le moteur de disponibilités.

## Chaîne de création

Lorsque Stripe confirme la garantie de la carte :

1. le verrou de créneau est converti en réservation de commande durable ;
2. la commande passe à l’état `SCHEDULED` ;
3. une affectation d’équipe est créée si elle n’existe pas ;
4. une fiche d’intervention est créée pour chaque jour de travail prévu ;
5. les tâches de la commande sont copiées comme tâches d’intervention à réaliser.

Les écritures sont idempotentes. Un webhook Stripe rejoué ne crée donc ni seconde affectation, ni seconde intervention, ni seconde tâche. La mission conserve un instantané de la commande, du jardin, de l’adresse opérationnelle, des prestations et du prix ; les évolutions ultérieures du profil client ne modifient pas la mission déjà confirmée.

## Planning sécurisé

- Page entreprise : `/admin/planning`.
- API : `GET /api/admin/planning?from=YYYY-MM-DD`.
- Permission obligatoire : `planning.read` ; une session client, un salarié terrain non habilité ou un visiteur n’obtient aucune donnée.
- La vue couvre sept jours et liste les missions par journée, créneau, équipe, client, jardin, adresse et prestations.
- Les données affichées proviennent exclusivement des réservations `ORDER` actives et des commandes dans un état opérationnel.

Le tableau est intentionnellement en lecture seule à ce stade. Le prochain module de gestion opérationnelle apportera le changement d’équipe, le report contrôlé, la consultation détaillée de la mission et les actions terrain, chacune avec son autorisation et son historique.

## Limites explicites

Cette étape ne déclenche pas le débit final, n’envoie pas encore les notifications de mission et ne permet pas de clôturer une intervention. Ces opérations nécessitent respectivement les flux de compte rendu, de facturation/paiement et de messagerie différée.
