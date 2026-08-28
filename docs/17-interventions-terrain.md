# Étape fonctionnelle 16 — espace terrain et exécution

Cette étape met les fiches d’intervention à la disposition des équipes de SERGEANT PAYSAGE. Elle remplace l’écran terrain vide par des missions réelles provenant du planning confirmé.

## Accès et confidentialité

- La page `/terrain` et les API `/api/field/interventions/*` exigent une session salariée avec la permission `field.missions.read_assigned`.
- Un salarié terrain ne lit que les interventions rattachées à une équipe dont il est membre actif dans `team_members`.
- Les responsables ayant la permission `orders.read` peuvent consulter les missions dans le cadre de leurs responsabilités opérationnelles.
- Les API vérifient la même portée que l’interface ; modifier un identifiant dans l’URL ne donne jamais accès à une mission d’une autre équipe.

## Actions opérationnelles

Le salarié peut enregistrer, dans l’ordre prévu par la machine d’état :

1. le départ de l’équipe ;
2. l’arrivée au jardin ;
3. le démarrage ;
4. une pause et une reprise ;
5. la fin de l’intervention.

Chaque action crée un événement append-only, avec son auteur et son horodatage. Les états incompatibles sont refusés, y compris en cas de mise à jour concurrente. Le démarrage fait passer la commande à `IN_PROGRESS`. Lorsque toutes les journées de la même commande sont terminées, elle passe à `COMPLETED`.

Les tâches de la mission peuvent être passées à « en cours », « réalisée » ou « bloquée ». Chaque changement est également historisé. Le portail n’affiche que les coordonnées indispensables à la réalisation : client, téléphone si fourni, jardin, adresse et prestations.

## Limites intentionnelles

L’étape ne permet pas encore d’ajouter les photos avant/après, les observations structurées, les incidents, le compte rendu client final ou la clôture par un responsable. Ces données sont réservées au module de compte rendu afin de séparer clairement le travail réalisé sur le terrain de sa validation, de la facturation et du débit final.
