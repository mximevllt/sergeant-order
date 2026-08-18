# Étape 09 — Profils, coordonnées et jardins

## Résultat fonctionnel

L’espace client utilise désormais D1 comme source de vérité. Un client connecté peut modifier son nom et son téléphone, choisir un compte particulier ou professionnel, enregistrer les informations de facturation d’une entreprise et gérer plusieurs jardins.

Chaque jardin comprend une adresse française, une surface indicative, l’inclinaison, la largeur d’accès, la présence éventuelle d’animaux et des consignes non sensibles. La suppression depuis l’interface est un archivage : l’historique n’est pas détruit et le jardin n’est plus proposé au client.

## Garanties de sécurité

- Toutes les lectures et écritures exigent une session client valide et la permission correspondante.
- Le propriétaire est toujours déduit de la session ; aucun identifiant de propriétaire fourni par le navigateur n’est accepté.
- Les mises à jour et archivages incluent le propriétaire dans la requête SQL, ce qui empêche un client d’accéder au jardin d’un autre.
- Les écritures refusent les requêtes provenant d’une autre origine.
- Les entrées sont bornées et validées côté serveur ; les notes internes ne sont jamais exposées au portail.
- Les créations, modifications et archivages sont consignés dans le journal d’audit sans recopier l’adresse ni les consignes.

## Limite volontaire

Les codes de portail, boîtes à clés et autres secrets d’accès ne sont pas collectés à cette étape. Ils devront être chiffrés avec une clé dédiée et une politique d’accès terrain avant leur activation.
