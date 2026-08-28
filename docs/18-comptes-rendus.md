# Étape fonctionnelle 17 — comptes rendus et validation

## Objectif

Une intervention terminée donne lieu à un compte rendu distinct de son exécution terrain. L’équipe le prépare, un responsable le valide, puis seul le résumé explicitement destiné au client devient visible dans son espace.

## Règles de traitement

- L’équipe ne peut enregistrer un rapport que lorsque la mission est terminée.
- Elle peut sauvegarder un brouillon autant que nécessaire, mais la soumission verrouille ce brouillon.
- Une soumission exige un résumé client et le traitement final de chaque tâche : réalisée, non réalisée ou bloquée.
- Un incident implique obligatoirement un détail à destination du responsable.
- Les notes internes et les détails d’incident ne sont jamais exposés au client.
- Un utilisateur disposant de `orders.write` valide le rapport. Cette action clôture l’intervention et crée un événement d’historique.
- La validation ne crée pas de facture, ne modifie aucun prix et ne déclenche aucun débit. Ces décisions restent dans les étapes comptables ultérieures.

## Parcours

1. Dans `/terrain`, l’équipe termine la mission et renseigne le compte rendu.
2. Elle le transmet au responsable depuis la même mission.
3. Le responsable le retrouve dans `/admin/reports`, contrôle le résumé client, les notes internes, les incidents et les statuts de tâche.
4. Après validation, l’intervention passe à `REPORT_CLOSED`.
5. Dans `/espace-client`, le client voit uniquement le résumé validé rattaché à sa commande.

## Sécurité et traçabilité

- Les deux API d’écriture vérifient l’origine de la requête et la session entreprise.
- La saisie terrain exige la permission `field.reports.write_assigned` et l’appartenance à l’équipe affectée.
- La clôture exige `orders.write`.
- Chaque sauvegarde, soumission ou clôture ajoute un événement append-only dans `intervention_events`.
- Les tables `intervention_reports`, `intervention_tasks` et `intervention_events` étaient déjà versionnées dans la migration initiale : aucune migration additionnelle n’est nécessaire pour cette étape.
