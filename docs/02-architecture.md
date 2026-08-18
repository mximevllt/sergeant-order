# Sergeant Paysage — Architecture fonctionnelle et technique

Statut : **VALIDÉ — étape 02 terminée le 18 août 2026**  
Référentiel commercial applicable : `docs/01-regles-commerciales.md`

## 1. Objectif

Transformer la maquette existante en un service transactionnel exploitable, dans lequel :

- un particulier ou un professionnel crée un vrai compte ;
- une estimation est calculée par le serveur à partir d'un barème versionné ;
- une adresse est contrôlée dans la zone desservie ;
- seuls les créneaux réellement disponibles pour les deux équipes sont proposés ;
- le créneau ne peut pas être vendu deux fois ;
- le moyen de paiement est enregistré sans exposer les données bancaires au site ;
- la commande confirmée apparaît automatiquement dans le planning de l'entreprise ;
- l'équipe reçoit une fiche mission exploitable ;
- un compte rendu clôture l'intervention ;
- le paiement normal ou l'Avance immédiate est déclenché selon le parcours choisi ;
- une facture immuable, un reçu et les documents fiscaux sont produits ;
- le client retrouve tout dans son espace ;
- toutes les actions sensibles sont historisées.

## 2. Décision structurante : monolithe modulaire

L'application restera un seul projet déployé, mais son code sera séparé en modules métier stricts. Ce choix est adapté au volume initial, à deux équipes et à la nécessité de conserver des transactions cohérentes.

Il n'y aura pas de microservices indépendants au lancement. Une architecture distribuée ajouterait des pannes, des synchronisations et des coûts sans bénéfice réel à cette échelle.

Modules prévus :

1. identité et autorisations ;
2. clients et organisations professionnelles ;
3. jardins et adresses ;
4. catalogue et versions tarifaires ;
5. devis et moteur de prix ;
6. zones et déplacements ;
7. disponibilités et planning ;
8. commandes ;
9. paiements Stripe ;
10. Avance immédiate Urssaf ;
11. interventions et comptes rendus ;
12. facturation et fiscalité ;
13. entretien régulier ;
14. notifications ;
15. fichiers et photos ;
16. audit, exploitation et sécurité.

Chaque module possède ses règles, ses validations et ses opérations serveur. Les pages ne calculent jamais seules un prix, un droit d'accès, un paiement ou une disponibilité.

## 3. Socle retenu

### 3.1 Interface et exécution

- Conservation du projet React existant et de ses routes.
- Exécution serveur dans un Worker Cloudflare via OpenAI Sites.
- Pages publiques rendues sans connexion.
- Pages client, terrain et entreprise protégées côté serveur.
- Interface responsive unique ; aucune application mobile native n'est nécessaire au lancement.
- Fuseau métier : `Europe/Paris`.
- Stockage de toutes les dates techniques en UTC, avec affichage en heure française.

### 3.2 Base de données

Choix : **Cloudflare D1 avec SQLite et Drizzle**.

D1 sera la source de vérité pour :

- utilisateurs et sessions ;
- clients, professionnels et jardins ;
- catalogue, options et versions de prix ;
- devis, commandes et statuts ;
- équipes, horaires, absences et réservations de créneaux ;
- paiements et événements reçus ;
- interventions et comptes rendus ;
- factures, avoirs et attestations ;
- plans d'entretien régulier ;
- notifications et journal d'audit.

Principes :

- identifiants techniques non prévisibles ;
- clés étrangères et contraintes d'unicité ;
- index construits à partir des requêtes réelles ;
- montants stockés en centimes entiers ;
- aucune donnée financière stockée sous forme de nombre décimal flottant ;
- migrations SQL conservées avec le projet ;
- données de démonstration séparées de la production ;
- aucune modification manuelle directe en production hors procédure contrôlée.

### 3.3 Fichiers

Choix : **Cloudflare R2**, dans un espace privé.

R2 contiendra :

- photos transmises pendant la réservation ;
- photos avant/après ;
- factures et avoirs PDF ;
- attestations fiscales ;
- exports administratifs ;
- pièces jointes autorisées.

D1 conservera uniquement les métadonnées : propriétaire, type, taille, empreinte, date, commande liée et règles de conservation.

Les fichiers privés ne seront jamais servis par une adresse publique permanente. Une route autorisée vérifiera l'identité et le rattachement avant lecture. Les téléversements seront limités en nombre, taille et format ; le type réel du fichier sera contrôlé et les métadonnées photographiques sensibles seront supprimées lorsque cela est possible.

## 4. Authentification et autorisations

### 4.1 Solution retenue

Choix : **Better Auth avec stockage D1, module Magic Link et envoi par Resend**.

Cette solution permet :

- création automatique du client lors de la première réservation ;
- vérification de la possession de l'adresse email ;
- connexion sans mot de passe par lien à usage unique ;
- sessions sécurisées dans des cookies non accessibles au JavaScript ;
- révocation des sessions ;
- séparation entre authentification et droits métier.

Règles proposées :

- lien de connexion valable 10 minutes et utilisable une seule fois ;
- jeton stocké sous forme hachée ;
- session client de 30 jours, renouvelée de façon contrôlée ;
- comptes entreprise créés uniquement sur invitation ;
- session entreprise plus courte ;
- deuxième facteur obligatoire pour administrateurs et responsables avant mise en production ;
- fermeture de toutes les sessions après changement d'email ou incident de sécurité ;
- limitation des demandes de liens par adresse et par origine réseau.

### 4.2 Rôles

- `CUSTOMER` : voit uniquement ses jardins, commandes et documents.
- `PRO_CUSTOMER_ADMIN` : gère les utilisateurs autorisés d'une organisation cliente.
- `FIELD_STAFF` : voit uniquement les missions qui lui sont affectées.
- `DISPATCHER` : organise le planning et les affectations.
- `ACCOUNTING` : gère paiements, factures, avoirs et fiscalité.
- `ADMIN` : administration complète, sauf secrets bruts jamais visibles.

Une même personne peut recevoir plusieurs rôles. Chaque opération sensible vérifiera les droits sur le serveur ; masquer un bouton ne constituera jamais une protection.

### 4.3 Professionnels

Le modèle prévoit :

- une organisation professionnelle ;
- SIREN, TVA, adresse de facturation et contacts ;
- plusieurs utilisateurs rattachés à la même organisation ;
- plusieurs jardins ou sites d'intervention ;
- séparation nette entre adresse du chantier et adresse de facturation.

L'Avance immédiate n'est proposée qu'aux particuliers éligibles.

## 5. Prestataires externes retenus

| Besoin | Solution | Rôle |
|---|---|---|
| Hébergement applicatif | OpenAI Sites / Cloudflare Worker | Exécution du site |
| Données structurées | Cloudflare D1 | Source de vérité métier |
| Photos et documents | Cloudflare R2 | Fichiers privés |
| Authentification | Better Auth | Sessions et liens de connexion |
| Emails | Resend | Connexion, confirmation, rappel, facture |
| Paiement par carte | Stripe | Carte enregistrée et débit après intervention |
| Avance immédiate | API Urssaf Tiers de prestation | Inscription et demandes de paiement AICI |
| Adresse | Géocodeur de la Géoplateforme / BAN | Recherche, normalisation et coordonnées |
| Itinéraire | Service d'itinéraire Géoplateforme | Temps de trajet et cohérence du planning |
| Erreurs applicatives | Sentry | Alertes et diagnostics sans données bancaires |
| Facturation électronique B2B | Adaptateur vers une plateforme agréée | Réception 2026, émission 2027 |

Les appels externes passeront tous par des adaptateurs internes. Le reste du site ne connaîtra pas directement le format Stripe, Urssaf, Resend ou de la plateforme de facturation électronique. Cette séparation permettra de remplacer un prestataire sans réécrire les commandes.

La plateforme agréée de facturation électronique devra être choisie avec l'expert-comptable. L'architecture est prête à l'intégrer, mais aucun fournisseur ne sera inventé sans connaître l'outil comptable déjà utilisé par l'entreprise.

## 6. Géographie et zone desservie

Le périmètre commercial validé sera représenté par des zones administrables :

- Var entier ;
- Bouches-du-Rhône depuis la limite du Var jusqu'à Marseille incluse ;
- Alpes-Maritimes depuis la limite du Var jusqu'à Nice incluse.

La configuration conservera :

- départements, communes et codes postaux inclus ;
- éventuelles exclusions ;
- polygones ou limites géographiques ;
- secteur opérationnel ;
- délai minimal propre au secteur ;
- éventuel supplément futur ;
- point de départ de l'équipe ;
- état actif/inactif.

Le géocodeur historique `api-adresse.data.gouv.fr` ne sera pas utilisé, car il a été retiré au profit de la Géoplateforme. L'adresse choisie sera normalisée et enregistrée avec coordonnées, code INSEE, commune, département et précision du résultat.

Une adresse incertaine ou hors zone ne pourra pas confirmer instantanément la commande. Elle créera une demande de vérification entreprise.

## 7. Moteur de prix

### 7.1 Autorité

Le calcul officiel s'exécute uniquement sur le serveur. L'interface peut afficher une prévisualisation, mais le serveur recalcule systématiquement avant :

- création du devis ;
- réservation d'un créneau ;
- enregistrement du moyen de paiement ;
- confirmation de commande ;
- modification de commande ;
- facture.

### 7.2 Versionnement

Chaque version tarifaire possède :

- une date d'effet ;
- un statut brouillon, actif ou archivé ;
- ses règles et valeurs ;
- l'identité de la personne ayant publié la version ;
- un historique.

Le devis et la commande enregistrent un instantané complet du barème utilisé. Une hausse future de prix ne modifie jamais les commandes existantes.

### 7.3 Résultat du calcul

Le moteur renvoie :

- durée recommandée ;
- justification de la durée ;
- prix de base ;
- chaque supplément ou réduction ;
- montant HT ;
- TVA à 20 % ;
- montant TTC ;
- part potentiellement éligible au crédit d'impôt ;
- reste à charge indicatif ou AICI ;
- avertissements ;
- version tarifaire ;
- empreinte du calcul.

### 7.4 Validation des prix

- La demande provenant du navigateur n'est jamais considérée comme un montant fiable.
- Les codes promotionnels sont validés sur le serveur.
- Une modification postérieure à la commande crée une nouvelle version de devis.
- Toute hausse après réservation requiert une acceptation explicite.
- Une baisse peut être appliquée avec une trace d'audit.

## 8. Disponibilités et planning

### 8.1 Capacité initiale

- Deux équipes.
- Du lundi au vendredi.
- Deux créneaux par jour : 08 h–12 h et 13 h–17 h.
- Délai minimal : 24 heures.
- Horizon maximal : un mois.
- Durées par pas de quatre heures.

Le modèle reste administrable afin d'ajouter des équipes, modifier les horaires, créer des absences ou fermer une journée.

### 8.2 Calcul

Un créneau est proposé seulement si :

1. il respecte le délai de 24 heures et l'horizon d'un mois ;
2. une équipe est disponible ;
3. l'équipe possède les compétences ou équipements requis ;
4. aucun congé, blocage ou autre mission n'entre en conflit ;
5. le trajet reste compatible avec la mission précédente et suivante ;
6. toutes les demi-journées nécessaires sont disponibles ;
7. le secteur est desservi ce jour-là.

### 8.3 Verrouillage anti-double réservation

Lorsqu'un client commence la confirmation :

- un verrou de créneau de courte durée est créé ;
- une contrainte unique empêche deux verrous ou commandes incompatibles ;
- le verrou expire automatiquement si le paiement ou la confirmation échoue ;
- la commande confirmée transforme le verrou en réservation durable ;
- toute relance utilise la même clé d'idempotence.

Le navigateur ne peut jamais « réserver » un créneau uniquement avec son état local.

### 8.4 Affectation

Le système peut proposer automatiquement une équipe, mais l'entreprise conserve la décision finale. Une réaffectation :

- vérifie tous les conflits ;
- conserve l'ancienne affectation dans l'historique ;
- notifie l'équipe concernée ;
- ne modifie pas le créneau client sans procédure distincte.

## 9. Commandes et machines d'état

### 9.1 Devis

`DRAFT → PRICED → SLOT_HELD → ACCEPTED → EXPIRED / CANCELLED`

### 9.2 Commande

`PENDING_PAYMENT_SETUP → CONFIRMED → TO_SCHEDULE → SCHEDULED → READY → IN_PROGRESS → COMPLETED`

Sorties contrôlées :

- `CANCELLED`;
- `PAYMENT_ACTION_REQUIRED`;
- `PAYMENT_FAILED`;
- `REFUND_PENDING`;
- `REFUNDED`;
- `DISPUTED`.

### 9.3 Intervention

`PLANNED → TEAM_EN_ROUTE → STARTED → PAUSED → COMPLETED → REPORT_CLOSED`

### 9.4 Facture

`DRAFT → ISSUED → PAYMENT_PENDING → PAID`

Branches possibles :

- `PARTIALLY_PAID`;
- `OVERDUE`;
- `CREDITED`;
- `CANCELLED_BEFORE_ISSUE`.

Une facture émise n'est jamais supprimée ni réécrite. Une correction passe par un avoir et, si nécessaire, une nouvelle facture.

## 10. Paiement Stripe

### 10.1 Réservation

Pour un paiement normal :

1. création ou récupération du client Stripe ;
2. création d'un SetupIntent prévu pour un usage ultérieur hors session ;
3. authentification bancaire éventuelle pendant la réservation ;
4. enregistrement côté D1 des identifiants Stripe, jamais du numéro de carte ;
5. confirmation de la commande après événement Stripe valide.

Le texte contractuel recueille l'autorisation de conserver le moyen de paiement et de débiter le montant déterminé selon la réservation.

### 10.2 Après l'intervention

- Le compte rendu est clôturé.
- Le montant contractuel est recalculé et comparé à la commande.
- S'il est identique ou inférieur, un PaymentIntent hors session est créé.
- S'il est supérieur, aucune tentative n'est lancée avant acceptation du client.
- Si la banque exige une authentification supplémentaire, la commande passe en `PAYMENT_ACTION_REQUIRED` et un lien sécurisé est envoyé.
- La facture n'est marquée payée qu'après événement Stripe signé.

### 10.3 Événements

Les notifications Stripe sont la source de vérité du résultat bancaire. Chaque événement :

- voit sa signature vérifiée ;
- possède un identifiant unique ;
- est conservé avant traitement ;
- peut être rejoué sans double débit ;
- met à jour le paiement et la commande dans une opération cohérente.

Remboursements, échecs et contestations ont leurs propres enregistrements ; ils ne remplacent jamais l'historique initial.

## 11. Avance immédiate Urssaf

### 11.1 Parcours particulier

Le client particulier peut choisir :

- paiement normal par carte ;
- Avance immédiate, s'il est éligible et activé.

Le système gère :

1. inscription du particulier auprès de l'API Tiers de prestation ;
2. suivi de l'activation par le particulier ;
3. conservation de l'identifiant technique Urssaf ;
4. émission de la facture éligible ;
5. transmission de la demande de paiement ;
6. suivi des statuts, rejets et virements ;
7. rapprochement du virement Urssaf avec la facture ;
8. affichage du reste à charge et du crédit appliqué.

### 11.2 Séparation des paiements

Une même facture ne peut pas être encaissée deux fois :

- le mode de règlement est figé avant l'émission ;
- une demande AICI bloque le débit Stripe de la prestation ;
- une carte peut néanmoins garantir les frais d'annulation si le consentement contractuel le prévoit ;
- un rejet Urssaf déclenche un parcours de régularisation explicite, jamais un débit silencieux non annoncé.

### 11.3 Accès technique

Les identifiants Urssaf, le numéro NOVA et les environnements de test/production seront stockés en secrets d'hébergement. Le site n'exposera jamais ces éléments au navigateur.

## 12. Facturation

### 12.1 Numérotation et immutabilité

- Série annuelle ou continue définie avec le comptable.
- Numéro attribué atomiquement au moment de l'émission.
- Aucun trou volontaire et aucune réutilisation.
- PDF et données structurées issus du même enregistrement.
- Empreinte du document conservée.
- Avoir lié à la facture d'origine.

### 12.2 Contenu

Le modèle inclut :

- identité complète de SERGEANT PAYSAGE ;
- identité et adresse du client ;
- SIREN et TVA du client professionnel lorsque requis ;
- adresse d'intervention ;
- date, numéro et période de prestation ;
- description, quantité, prix HT, TVA 20 %, TTC ;
- mode et état du règlement ;
- part SAP éligible ou non éligible ;
- mentions AICI si applicable ;
- nouvelles mentions exigées par la facturation électronique.

### 12.3 B2B et réforme électronique

Le système sépare :

- facture PDF lisible par l'humain ;
- données structurées ;
- statut d'envoi vers une plateforme agréée ;
- identifiant et cycle de vie retournés par cette plateforme.

L'EURL doit être capable de recevoir les factures électroniques à compter du 1er septembre 2026. L'émission électronique obligatoire des PME/TPE est prévue au 1er septembre 2027. Le fournisseur agréé devra être choisi avec le comptable avant activation B2B complète.

### 12.4 Documents fiscaux

Les attestations fiscales sont générées uniquement à partir de factures payées et de lignes réellement éligibles. Une régularisation ou un avoir entraîne une version rectifiée et un historique.

## 13. Comptes rendus

La fiche mission est générée depuis la commande, sans ressaisie :

- client et jardin ;
- contacts autorisés ;
- accès et informations de sécurité ;
- créneau ;
- tâches et priorités ;
- caractéristiques mesurées ;
- photos client ;
- matériel suggéré ;
- notes entreprise.

Le salarié peut :

- indiquer son départ, son arrivée, son début et sa fin ;
- cocher les tâches ;
- saisir le temps réel ;
- ajouter photos et observations ;
- signaler un incident ;
- demander une décision au responsable ;
- préparer la clôture.

La clôture définitive exige les champs obligatoires. Les notes internes et le compte rendu visible par le client sont séparés.

## 14. Notifications et travaux différés

Chaque communication est d'abord enregistrée dans une boîte d'envoi en base :

- type ;
- destinataire ;
- modèle et version ;
- données ;
- état ;
- nombre de tentatives ;
- prochaine tentative ;
- identifiant du prestataire.

Cas couverts :

- lien de connexion ;
- réservation confirmée ;
- équipe affectée ;
- rappel ;
- changement de créneau ;
- intervention terminée ;
- action bancaire nécessaire ;
- facture ou avoir ;
- activation et demande AICI ;
- annulation ou remboursement.

Les opérations critiques ne dépendent pas de la réussite immédiate d'un email. Si Resend est indisponible, la commande reste enregistrée et l'envoi est retenté.

L'email est obligatoire au lancement. Le SMS sera ajouté derrière le même système d'adaptateur lorsqu'un fournisseur et un budget auront été validés.

## 15. API et frontières

### 15.1 Routes publiques

- catalogue ;
- estimation ;
- recherche d'adresse ;
- vérification de zone ;
- disponibilités ;
- création d'un brouillon ;
- téléversement contrôlé ;
- initialisation de l'authentification ;
- initialisation Stripe.

### 15.2 Routes client protégées

- profil et organisations ;
- jardins ;
- devis et commandes ;
- reports et annulations ;
- factures et documents ;
- entretien régulier ;
- moyens de paiement ;
- AICI.

### 15.3 Routes terrain protégées

- missions affectées ;
- démarrage et fin ;
- tâches ;
- photos ;
- compte rendu.

### 15.4 Routes entreprise protégées

- planning ;
- clients et jardins ;
- commandes ;
- équipes et indisponibilités ;
- catalogue et prix ;
- zones ;
- paiements et rapprochement ;
- factures et fiscalité ;
- configuration.

### 15.5 Webhooks

- Stripe ;
- fournisseur de courrier si suivi nécessaire ;
- plateforme agréée de facturation ;
- autres connecteurs futurs.

Tous les corps de webhook sont lus et vérifiés avant interprétation. Les événements inconnus sont conservés sans changer l'état métier.

## 16. Flux principal

~~~mermaid
flowchart LR
    C["Client"] --> Q["Configurateur"]
    Q --> P["Moteur de prix serveur"]
    Q --> A["Contrôle adresse et zone"]
    P --> S["Disponibilités"]
    A --> S
    S --> H["Verrou temporaire du créneau"]
    H --> I["Compte + moyen de paiement"]
    I --> O["Commande confirmée"]
    O --> PL["Planning entreprise"]
    PL --> M["Fiche mission"]
    M --> R["Compte rendu"]
    R --> F["Facture"]
    F --> X{"Mode de règlement"}
    X --> ST["Stripe"]
    X --> U["Urssaf AICI"]
    ST --> E["Espace client et rapprochement"]
    U --> E
~~~

## 17. Flux de données et sources de vérité

| Information | Source de vérité |
|---|---|
| Identité connectée | Better Auth + D1 |
| Profil et jardins | D1 |
| Photos et PDF | R2, métadonnées D1 |
| Catalogue et tarifs | D1, version publiée |
| Prix d'une commande | Instantané de devis D1 |
| Disponibilité | Planning, verrous et commandes D1 |
| Résultat bancaire | Événements Stripe signés |
| Statut AICI | API Urssaf + historique D1 |
| Mission réalisée | Compte rendu D1 + photos R2 |
| Facture | Enregistrement immuable D1 + PDF R2 |
| Interface affichée | Lecture des sources ci-dessus, jamais données fictives |

## 18. Cohérence, reprise et idempotence

Les opérations suivantes exigeront une clé d'idempotence :

- création de devis ;
- verrouillage de créneau ;
- confirmation de commande ;
- SetupIntent et PaymentIntent ;
- remboursement ;
- clôture d'intervention ;
- émission de facture ;
- demande de paiement Urssaf ;
- envoi de notification.

Des contraintes uniques empêcheront :

- deux comptes pour la même identité non fusionnée ;
- deux traitements du même webhook ;
- deux numéros de facture identiques ;
- deux paiements actifs pour la même tentative ;
- deux commandes incompatibles sur une équipe et un créneau ;
- deux occurrences identiques d'un plan récurrent.

Chaque processus externe conserve son état, ses tentatives et sa dernière erreur. Une reprise ne recommence pas aveuglément depuis le début.

## 19. Sécurité et protection des données

- Secrets uniquement dans l'environnement d'hébergement.
- Chiffrement applicatif des codes de portail et informations d'accès sensibles.
- Journaux sans numéro de carte, secret, lien magique ou code d'accès.
- Protection CSRF des actions utilisant une session.
- Validation stricte de toutes les entrées.
- Limitation de fréquence des connexions, devis, fichiers et paiements.
- Protection anti-robot sur les formulaires exposés aux abus.
- Politique de sécurité du navigateur et en-têtes adaptés.
- Accès R2 soumis à autorisation.
- Journal d'audit append-only pour prix, commandes, planning, paiements et factures.
- Exports et suppressions RGPD contrôlés.
- Sauvegardes et tests de restauration.
- Comptes entreprise nominatifs ; aucun compte partagé.
- Révocation immédiate d'un salarié sortant.

Les durées de conservation définitives seront validées avec le conseil juridique. Les obligations comptables et fiscales prévaudront sur une demande d'effacement lorsqu'elles imposent la conservation d'un document.

## 20. Observabilité

Le système suivra :

- erreurs serveur et navigateur utiles ;
- latence des opérations principales ;
- échecs Stripe, Urssaf, email et géocodage ;
- verrous de créneau expirés ;
- notifications en attente ;
- webhooks non traités ;
- divergences de rapprochement ;
- échecs de sauvegarde ;
- actions administratives sensibles.

Les alertes doivent être actionnables et ne doivent pas contenir de données sensibles.

## 21. Stratégie de tests

### 21.1 Tests unitaires

- chaque règle tarifaire ;
- arrondis HT, TVA et TTC ;
- durée recommandée ;
- transitions d'état ;
- droits par rôle ;
- annulation ;
- récurrence ;
- numérotation.

### 21.2 Tests d'intégration

- migrations D1 ;
- contraintes de créneau ;
- création complète d'une commande ;
- traitement et répétition des webhooks ;
- Stripe en environnement de test ;
- Urssaf en environnement de test lorsque les accès sont disponibles ;
- fichiers R2 privés ;
- émission d'une facture et d'un avoir.

### 21.3 Tests de parcours

- particulier avec paiement normal ;
- particulier AICI ;
- professionnel ;
- authentification par lien ;
- réservation concurrente du dernier créneau ;
- paiement nécessitant une nouvelle authentification ;
- annulation selon chaque délai ;
- intervention et compte rendu ;
- facture, avoir et remboursement ;
- entretien régulier ;
- accès interdit aux données d'un autre compte.

## 22. Organisation du projet

Structure cible :

- `app/` : pages et routes ;
- `modules/auth/` : identité et permissions ;
- `modules/customers/` : clients, organisations et jardins ;
- `modules/catalog/` : services et prix ;
- `modules/quotes/` : estimation et devis ;
- `modules/scheduling/` : équipes, disponibilités et planning ;
- `modules/orders/` : commandes et transitions ;
- `modules/interventions/` : missions et comptes rendus ;
- `modules/payments/` : Stripe et rapprochement ;
- `modules/aici/` : Urssaf ;
- `modules/invoicing/` : factures, avoirs et fiscalité ;
- `modules/notifications/` : emails et boîte d'envoi ;
- `modules/files/` : R2 et autorisations ;
- `modules/audit/` : événements de sécurité et métier ;
- `db/` : schéma et accès D1 ;
- `drizzle/` : migrations versionnées ;
- `tests/` : tests unitaires, intégration et parcours.

Le code partagé restera limité aux éléments réellement communs. Les règles métier ne seront pas placées dans les composants visuels.

## 23. Environnements

Trois contextes seront distingués :

- local : données fictives contrôlées ;
- préproduction : services en mode test, recette complète ;
- production : comptes et paiements réels.

Chaque environnement possède :

- sa base ;
- son espace de fichiers ;
- ses clés ;
- ses webhooks ;
- ses adresses d'envoi ;
- ses données de test ou production.

Aucune donnée de production ne sera copiée telle quelle en local ou en préproduction.

## 24. Déploiement progressif

La transformation se fera par tranches verticales :

1. socle propre, environnements et base ;
2. authentification et profils ;
3. catalogue et prix serveur ;
4. disponibilités et verrous ;
5. réservation et Stripe test ;
6. planning entreprise ;
7. intervention terrain ;
8. facture et espace client ;
9. AICI ;
10. récurrence, sécurité et exploitation.

Une page ne sera considérée comme fonctionnelle que lorsque son parcours serveur, ses droits, ses données et ses tests seront présents. Les données fictives visibles actuellement disparaîtront au fur et à mesure, sans être mélangées avec la production.

## 25. Accès et comptes nécessaires avant les étapes concernées

- Stripe, avec clés de test puis de production.
- Domaine d'envoi vérifié dans Resend.
- Accès API Tiers de prestation Urssaf, environnement de test et production.
- Numéro NOVA utilisé par l'API.
- Choix de la plateforme agréée de facturation électronique avec le comptable.
- Accès Sentry ou décision explicite de le remplacer.
- Domaine public définitif et boîtes email de support.

L'absence d'un accès externe n'empêchera pas de construire l'adaptateur et les tests simulés, mais empêchera de déclarer le parcours correspondant validé en production.

## 26. Décisions d'architecture

| Décision | Choix retenu | Motif |
|---|---|---|
| Forme du système | Monolithe modulaire | Cohérence et exploitation simple |
| Base | D1 / SQLite | Intégration native au site et relations suffisantes |
| Fichiers | R2 privé | Photos et documents hors base |
| Auth client | Magic link Better Auth | Compte automatique sans mot de passe |
| Paiement | Stripe SetupIntent + débit ultérieur | Conforme au paiement après prestation |
| Crédit immédiat | API Urssaf Tiers de prestation | Parcours officiel de l'entreprise prestataire |
| Adresse | Géoplateforme | Référentiel français actuel |
| Email | Resend | Compatible avec l'exécution Cloudflare |
| Facture | Registre interne immuable + adaptateur PA | B2C, B2B et réforme électronique |
| Planning | Interne, deux équipes, verrous en base | Une seule source de disponibilité |
| Architecture distribuée | Refusée au lancement | Complexité injustifiée |

## 27. Critère de clôture de l'étape 02

L'architecture est considérée comme validée parce qu'elle :

- couvre tous les parcours commerciaux de l'étape 01 ;
- définit les sources de vérité ;
- sépare clairement les droits ;
- empêche les doubles créneaux et doubles débits ;
- intègre paiement normal et AICI sans chevauchement ;
- prévoit les obligations B2B ;
- reste compatible avec l'hébergement existant ;
- peut évoluer au-delà de deux équipes sans réécriture complète.

Toute remise en cause ultérieure d'un choix structurant sera consignée comme une nouvelle décision d'architecture datée.
