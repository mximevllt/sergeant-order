# Étape fonctionnelle 13 — disponibilités et verrous de créneau

## Résultat

Le planning du configurateur n’est plus une liste de dates fictives. Les propositions sont calculées par le serveur à partir des données opérationnelles enregistrées dans libSQL, puis le créneau choisi est protégé par un verrou temporaire anti-double-réservation.

Le fonctionnement validé est le suivant :

- interventions du lundi au vendredi ;
- deux périodes par jour et par équipe : `08:00–12:00` et `13:00–17:00` ;
- deux équipes actives ;
- délai minimum de 24 heures ;
- réservation au maximum 31 jours à l’avance ;
- durée exprimée en demi-journées ;
- blocage temporaire de 15 minutes avant paiement ;
- tous les calculs calendaires utilisent le fuseau `Europe/Paris`, y compris lors des changements d’heure.

## Calcul des disponibilités

`POST /api/availability/search` reçoit uniquement l’adresse, les codes des tâches et le nombre de demi-journées. Le serveur :

1. contrôle à nouveau la zone d’intervention ;
2. contrôle que chaque tâche existe encore dans le catalogue actif ;
3. récupère les capacités requises par ces tâches ;
4. conserve uniquement les équipes actives possédant toutes ces capacités ;
5. construit leurs périodes de travail depuis `team_weekly_hours` ;
6. retire les absences de `team_unavailabilities` ;
7. retire les créneaux déjà occupés dans `schedule_reservation_slots` ;
8. vérifie qu’une même équipe peut assurer toute la durée sur des périodes travaillées successives ;
9. regroupe les propositions identiques et indique le nombre d’équipes encore disponibles, sans exposer leur identité au public.

Pour une journée demandée depuis le vendredi après-midi, par exemple, le moteur peut proposer le vendredi après-midi puis le lundi matin : le week-end n’est pas compté comme temps d’intervention. Une absence ou une réservation sur l’une des périodes invalide toute la proposition pour l’équipe concernée.

## Verrou temporaire

`POST /api/quotes/:id/hold` est protégé par la preuve du devis anonyme ou par la session du client. Il exige une clé d’idempotence et recalcule la disponibilité avant toute écriture.

Si le créneau est toujours libre :

- une réservation `HOLD` est créée dans `schedule_reservations` ;
- chaque demi-journée est écrite dans `schedule_reservation_slots` pour une seule équipe ;
- le devis passe à l’état `SLOT_HELD` ;
- la date, la fin prévue et l’expiration du verrou sont ajoutées à l’instantané du devis ;
- un événement d’audit `SCHEDULE_HOLD_CREATED` est enregistré.

L’index partiel `uq_schedule_slots_team_start_active` empêche matériellement deux verrous actifs sur la même équipe et la même demi-journée. L’index `uq_schedule_reservations_quote_active_hold` interdit parallèlement deux verrous actifs pour un même devis, même si deux requêtes arrivent au même instant. Avec deux équipes, deux clients peuvent donc choisir le même horaire ; le troisième reçoit un conflit `409` et l’interface recharge immédiatement les disponibilités.

Une répétition réseau avec la même clé d’idempotence retourne le verrou déjà créé. Une réutilisation de cette clé pour un autre devis ou un autre horaire est refusée.

## Expiration et libération

Les verrous dépassant leur échéance sont nettoyés avant chaque recherche ou consultation :

- la réservation devient `EXPIRED` ;
- ses demi-journées deviennent `RELEASED` ;
- le devis redevient `PRICED` et reste reprenable tant que sa validité commerciale de sept jours n’est pas dépassée.

`DELETE /api/quotes/:id/hold` libère volontairement le verrou. Modifier un devis ayant un créneau provisoire libère aussi automatiquement l’ancien verrou, puisque les tâches, la durée, l’adresse ou le tarif peuvent avoir changé. Annuler le devis annule également son verrou.

## Interface client

L’étape planning présente :

- les premières dates réellement disponibles ;
- les modes « Au plus tôt », « Cette semaine » et « Choisir une date » ;
- le matin ou l’après-midi disponible ;
- le nombre d’équipes compatibles restantes ;
- la date et l’heure de fin prévues pour les interventions de plusieurs demi-journées ;
- les états de chargement, d’indisponibilité et de conflit ;
- l’explication du blocage de 15 minutes.

La confirmation distingue explicitement trois faits : le devis est enregistré, le créneau est provisoirement bloqué et aucun paiement n’a encore été effectué. L’espace client affiche l’état « Créneau provisoire » et permet de modifier ou d’annuler le devis.

## Garanties testées

Le parcours automatisé vérifie notamment :

- le délai minimal de 24 heures ;
- la limite de 31 jours ;
- l’absence de proposition le week-end ;
- l’affectation d’une durée complète ;
- deux verrous simultanés sur les deux équipes ;
- le refus d’un troisième verrou sur le même horaire ;
- la libération d’un verrou et la réutilisation immédiate du créneau ;
- la protection des API par le cookie signé du devis ;
- l’affichage du verrou réel sur la page de confirmation.

## Limite à l’issue de l’étape 13

Un verrou n’est pas encore une commande. Il n’y a toujours ni débit bancaire, ni mandat d’avance immédiate, ni conversion du verrou `HOLD` en réservation `ORDER`. Cette conversion atomique avec le paiement et la création de la commande relève de l’étape 14.

Cette limite est désormais levée pour le parcours par carte par l’étape 14, documentée dans `15-commandes-et-garantie-stripe.md`. Le parcours Avance immédiate reste distinct.
