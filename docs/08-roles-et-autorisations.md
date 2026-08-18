# Étape 08 — Rôles et autorisations

Statut : **implémentation terminée ; premier compte administrateur à inviter avant usage entreprise réel**.

Cette étape transforme les rôles prévus dans le schéma en une politique effectivement appliquée côté serveur. Elle sépare strictement les sessions client, terrain et back-office, protège `/admin` et `/terrain`, et empêche une adresse inconnue de créer elle-même un compte salarié.

## 1. Principes de sécurité

- Une authentification prouve l'identité ; elle ne donne aucun droit par elle-même.
- Chaque lecture ou écriture sensible devra vérifier une permission côté serveur.
- Masquer un bouton ou un module dans l'interface ne constitue jamais la protection principale.
- Les comptes entreprise sont nominatifs et existent uniquement après invitation.
- Une connexion demandée avec une adresse inconnue reçoit la même réponse visuelle qu'une adresse autorisée, sans créer de compte ni envoyer de lien.
- Une session client ne peut jamais être utilisée comme session entreprise, même si la personne possède plusieurs rôles.
- Une session entreprise expire après huit heures, contre trente jours pour une session client.
- Un compte suspendu ou archivé est refusé quel que soit son rôle.

## 2. Rôles

| Rôle | Portée |
|---|---|
| `CUSTOMER` | Son profil, ses jardins, commandes, factures et documents |
| `PRO_CUSTOMER_ADMIN` | Ses données et l'organisation professionnelle qu'il administre |
| `FIELD_STAFF` | Uniquement les missions auxquelles la personne est affectée et leurs comptes rendus |
| `DISPATCHER` | Planning, commandes, clients, jardins, équipes et affectations |
| `ACCOUNTING` | Paiements, factures, fiscalité, clients nécessaires au rapprochement et statistiques financières |
| `ADMIN` | Toutes les permissions fonctionnelles et la gestion des comptes entreprise |

Les permissions de plusieurs rôles s'additionnent. Un responsable planning qui travaille aussi sur le terrain peut donc posséder `DISPATCHER` et `FIELD_STAFF` sans recevoir les permissions de comptabilité.

## 3. Matrice appliquée

La source de vérité est `modules/authorization/policy.mjs`. Elle énumère les permissions suivantes :

- accès aux portails client, terrain et back-office ;
- gestion de son propre profil et de ses propres jardins ;
- lecture de ses commandes et factures ;
- gestion d'une organisation cliente professionnelle ;
- lecture des missions affectées et saisie de leur compte rendu ;
- lecture/écriture du planning, des commandes, des équipes, des tarifs, des zones, des paiements, des factures et de la fiscalité ;
- consultation des clients, jardins, statistiques et audits ;
- gestion des réglages et des comptes entreprise.

Les fonctions de portée ajoutent déjà deux protections réutilisables pour les étapes suivantes :

- une ressource client appartient bien à l'utilisateur courant ;
- une mission terrain est réellement affectée à la personne, sauf rôle de supervision autorisé.

## 4. Portails et connexions

| Route | Accès |
|---|---|
| `/connexion` | Connexion client et création automatique d'un compte client |
| `/espace-client` | Session `CUSTOMER` et permission client |
| `/connexion-entreprise` | Connexion d'un compte salarié préalablement invité |
| `/admin` | Session `STAFF` avec permission `backoffice.access` |
| `/terrain` | Session `STAFF` avec permission `field.portal.access` |
| `/acces-refuse` | Explication neutre et déconnexion lorsque le bon compte n'est pas utilisé |

Le menu du back-office est calculé à partir des permissions réelles. Un profil comptable ne voit pas le planning ; un responsable planning ne voit pas les paiements ; un salarié terrain ne peut pas ouvrir le back-office.

## 5. Liens et sessions

La migration `0003_chubby_morph.sql` ajoute l'audience `CUSTOMER` ou `STAFF` aux liens magiques. Cette audience est incluse dans l'index de recherche et ne provient jamais d'une décision du navigateur : chaque route serveur impose sa propre audience.

Lors de la vérification :

1. le lien est retrouvé par son empreinte HMAC ;
2. son audience est lue en base ;
3. pour `STAFF`, le compte doit déjà exister et posséder au moins un rôle entreprise ;
4. la session créée reprend l'audience du lien ;
5. la destination est limitée au portail correspondant ;
6. les rôles sont relus depuis D1 à chaque chargement de session.

Une connexion entreprise ne crée ni rôle `CUSTOMER` ni profil client. Inversement, une connexion client ne permet jamais d'obtenir une session `STAFF`.

## 6. État des interfaces

L'ancienne page d'administration contenait de faux chiffres, six équipes et des interventions fictives. Ces données ont été retirées.

Le back-office affiche maintenant :

- l'identité réellement connectée ;
- les rôles autorisés ;
- uniquement les modules accessibles ;
- un état d'attente explicite jusqu'au branchement des données métier.

L'interface terrain est également protégée et n'affiche aucune mission fictive. Les missions réelles seront raccordées à l'étape consacrée aux interventions.

## 7. Contrôles automatiques

Les tests vérifient notamment :

- la matrice des six rôles ;
- l'addition de plusieurs rôles ;
- la séparation planning/comptabilité/terrain ;
- la propriété des ressources client ;
- la portée des missions affectées ;
- le refus d'une adresse entreprise inconnue sans création de compte ;
- la connexion d'un salarié invité ;
- la session entreprise de huit heures ;
- l'absence de rôle client ajouté à un salarié ;
- l'accès autorisé au back-office et au portail terrain ;
- le refus du back-office à une session client ;
- le refus de l'espace client à une session entreprise ;
- la migration et l'index de séparation des audiences.

## 8. Activation du premier administrateur

Aucun administrateur réel n'est créé avec une adresse inventée ou récupérée implicitement. Avant la recette entreprise, le dirigeant devra fournir l'adresse nominative à inviter dans `INITIAL_ADMIN_EMAIL`. Si aucun administrateur n'existe encore, cette adresse pourra créer l'unique premier compte `ADMIN` depuis `/connexion-entreprise`. L'opération est auditée, ne fonctionne qu'une fois et exige le service d'email configuré.

Cette absence volontaire n'affaiblit pas la protection du site : tant que le premier compte n'est pas invité, personne ne peut s'auto-attribuer un rôle entreprise.

## 9. Limites réservées aux étapes suivantes

- Les profils, coordonnées, organisations et jardins modifiables relèvent de l'étape 09.
- Les données réelles du planning et des interventions seront branchées dans leurs étapes spécialisées.
- L'interface d'administration des invitations et des changements de rôles sera ajoutée avec la gestion d'équipe ; la politique et les contrôles serveur sont déjà prêts.
- Le second facteur obligatoire des administrateurs et responsables sera finalisé dans la tranche de durcissement sécurité, après choix du moyen de second facteur.
