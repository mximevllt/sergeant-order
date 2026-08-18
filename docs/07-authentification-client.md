# Étape 07 — Authentification client sans mot de passe

Statut : **implémentation terminée ; envoi réel des emails conditionné aux accès Resend**.

Cette étape remplace l'accès fictif à l'espace client par une identité persistante et vérifiée. Un visiteur demande un lien personnel, prouve qu'il contrôle l'adresse email, obtient automatiquement son compte client et ouvre une session révocable.

Les rôles entreprise et leurs politiques détaillées ont été ajoutés à l'étape 08. Les profils, jardins et coordonnées modifiables relèvent de l'étape 09.

## 1. Parcours livré

1. Le visiteur ouvre `/connexion`.
2. Il renseigne son email et, lors d'une première connexion, peut indiquer son nom complet.
3. Le serveur normalise et valide les données, contrôle l'origine de la requête et applique la limitation de fréquence.
4. Un jeton aléatoire valable dix minutes est créé.
5. Seule son empreinte cryptographique est stockée dans libSQL.
6. L'email contient le jeton original, qui n'existe qu'en mémoire pendant l'envoi.
7. Le premier clic consomme le lien atomiquement.
8. Si l'adresse est nouvelle, le compte, le rôle `CUSTOMER` et le profil client sont créés automatiquement.
9. L'adresse est marquée vérifiée et une session de trente jours est créée.
10. Le navigateur reçoit un cookie de session `HttpOnly`, `SameSite=Lax` et `Secure` sous HTTPS.
11. `/espace-client` vérifie la session côté serveur avant de rendre la moindre donnée.
12. La déconnexion révoque la session en base puis supprime le cookie.

## 2. Choix technique final

Le contrat initial prévoyait une bibliothèque d'authentification générique. L'implémentation finale utilise un module interne limité à ce parcours précis et directement raccordé aux tables libSQL existantes.

Ce choix évite une deuxième série de tables d'identité et permet d'assurer explicitement les garanties demandées :

- aucune valeur de lien magique en clair dans la base ;
- aucune valeur de session en clair dans la base ;
- consommation atomique du lien à la première utilisation ;
- intégration directe aux rôles, profils, journaux et contraintes métier ;
- absence de dépendance d'authentification supplémentaire dans le navigateur.

La surface reste petite : connexion par email, lecture de session et déconnexion. L'ajout d'une méthode supplémentaire pourra se faire derrière la même identité utilisateur.

## 3. Routes installées

| Route | Méthode | Rôle |
|---|---|---|
| `/connexion` | GET | Formulaire et messages de validation |
| `/api/auth/magic-link/request` | POST | Demande contrôlée d'un lien |
| `/auth/verifier` | GET | Consommation du lien et création de la session |
| `/api/auth/session` | GET | État minimal de la session courante |
| `/api/auth/sign-out` | POST | Révocation et suppression du cookie |
| `/espace-client` | GET | Surface protégée côté serveur |

Les réponses d'authentification portent `Cache-Control: no-store`. Les opérations d'écriture refusent une origine différente du site.

## 4. Données persistantes

La migration `0002_elite_madame_hydra.sql` complète `magic_link_tokens` avec :

- le nom fourni pour une première inscription ;
- un index sur l'email et la date de demande ;
- un index sur l'empreinte de l'adresse réseau et la date de demande.

Le parcours utilise ensuite les tables existantes :

- `users` pour l'identité et la vérification de l'email ;
- `user_roles` pour le rôle client minimal ;
- `customer_profiles` pour l'existence du profil métier ;
- `magic_link_tokens` pour les preuves à usage unique ;
- `auth_sessions` pour les sessions révocables ;
- `notification_outbox` pour la traçabilité de l'envoi ;
- `audit_events` pour les demandes, connexions, limitations et déconnexions.

Le contenu de `notification_outbox` ne contient ni jeton ni URL de connexion. Il conserve uniquement l'identifiant de la demande, la durée de validité et l'état d'envoi.

## 5. Protection des secrets

La variable `AUTH_SECRET` doit contenir une valeur aléatoire d'au moins 32 caractères. Elle ne doit exister que dans le coffre de l'environnement.

Des domaines HMAC distincts sont utilisés :

- `magic:` pour les liens ;
- `session:` pour les cookies de session ;
- `ip:` pour les adresses réseau utilisées par la limitation de fréquence.

Une fuite en lecture de libSQL ne suffit donc pas à réutiliser un lien ou une session active. Les journaux ne reçoivent jamais la valeur originale.

## 6. Durées et limitation de fréquence

- lien : 10 minutes, une seule utilisation ;
- session client : 30 jours ;
- trois demandes maximum par email sur quinze minutes ;
- douze demandes maximum par origine réseau sur quinze minutes ;
- session expirée révoquée lors de la connexion suivante ;
- compte suspendu ou archivé refusé même avec un lien valide.

Une demande limitée reçoit volontairement la même réponse générique qu'une demande acceptée afin de ne pas créer un canal d'observation des comptes.

## 7. Envoi des emails

Le module dispose de deux modes :

- en développement local avec `EMAIL_DELIVERY_MODE=log`, le lien de test est renvoyé uniquement à l'interface locale et n'est pas écrit dans les journaux ;
- en préproduction ou production, le lien est envoyé par l'API Resend avec une clé d'idempotence propre à la demande.

Pour activer l'envoi distant, l'environnement doit fournir :

- `APP_URL` ;
- `AUTH_SECRET` ;
- `EMAIL_DELIVERY_MODE=test` en préproduction ou `live` en production ;
- `RESEND_API_KEY` ;
- `RESEND_FROM_EMAIL`, avec un domaine expéditeur vérifié.

Sans les deux valeurs Resend, le serveur renvoie une indisponibilité générique, marque la notification en échec et invalide immédiatement le lien non envoyé. Il ne simule jamais un envoi réussi sur une adresse distante.

## 8. Espace client

L'ancienne page affichait des interventions, jardins, factures et coordonnées fictifs. Ils ont été retirés.

Après connexion, l'espace affiche maintenant uniquement :

- le vrai nom du compte ;
- le vrai email vérifié ;
- l'état opérationnel du compte ;
- des états vides explicites pour les données qui seront branchées aux prochaines étapes ;
- une déconnexion réelle.

Un visiteur sans session est redirigé vers `/connexion` avec une destination de retour interne et validée.

## 9. Contrôles automatiques

Les tests couvrent :

- normalisation de l'email et nettoyage du nom ;
- refus des redirections vers un domaine extérieur ;
- génération aléatoire et empreinte HMAC ;
- attributs de sécurité du cookie ;
- refus d'origine croisée ;
- application de la migration et présence des index ;
- demande du lien et stockage exclusivement haché ;
- limitation après trois demandes ;
- création automatique d'un utilisateur vérifié ;
- accès autorisé à l'espace avec la session ;
- refus de réutiliser le lien ;
- révocation à la déconnexion.

Le parcours est exécuté de bout en bout contre une vraie base SQLite vierge portant toutes les migrations.

## 10. Limite externe restante

Le code d'authentification, la migration, les sessions et l'interface peuvent être déployés immédiatement. L'envoi réel d'un lien à une boîte email externe ne peut toutefois être déclaré opérationnel tant que le domaine d'envoi Resend et ses identifiants n'ont pas été fournis dans l'environnement hébergé.

Cette dépendance n'a pas bloqué l'étape 08 sur les rôles et autorisations, mais elle devra être levée avant une recette publique complète des comptes clients et entreprise.
