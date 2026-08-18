# Migration GitHub + Vercel

Statut : **code migré et vérifié localement ; création des ressources distantes à faire dans les comptes du propriétaire**.

## Changements réalisés

- remplacement de Vinext par Next.js officiel ;
- suppression du Worker, de Vite, de Wrangler et de la configuration Sites ;
- remplacement de Turso/libSQL par Turso/libSQL ;
- conservation du dialecte SQLite, des 50 tables, des déclencheurs et des quatre migrations ;
- ajout d’un adaptateur de base commun pour les services d’authentification, de profil, de catalogue et de prix ;
- ajout d’un script de migration idempotent ;
- ajout de `vercel.json`, d’un verrou pnpm et d’une intégration continue GitHub ;
- remplacement des tests propres au Worker par des tests exécutant réellement le serveur Next.js.

## Checklist avant la bascule publique

- [ ] Créer deux bases Turso séparées : préproduction et production.
- [ ] Appliquer les migrations aux deux bases.
- [ ] Créer le dépôt GitHub privé et y pousser le projet.
- [ ] Importer le dépôt dans Vercel.
- [ ] Renseigner les variables Preview et Production sans réutiliser les secrets.
- [ ] Configurer le domaine d’envoi Resend et l’adresse expéditrice.
- [ ] Ajouter le domaine final à Vercel et mettre `APP_URL` à jour.
- [ ] Vérifier que `/api/health` répond `200`.
- [ ] Tester un compte client et le premier administrateur.
- [ ] Exécuter une commande Stripe de test avant l’activation du mode réel.
- [ ] Exporter/importer les données de l’ancienne base si elle contient autre chose que les données de référence.
- [ ] Basculer le DNS seulement après la recette complète.

## Correspondance des ressources

| Ancienne fondation | Nouvelle fondation |
|---|---|
| Vinext/Vite | Next.js App Router |
| fonctions Vercel | Fonctions serveur Vercel |
| Turso/libSQL | Turso/libSQL |
| Liaison `DB` | `TURSO_DATABASE_URL` et `TURSO_AUTH_TOKEN` |
| Déploiement Sites | Déploiement GitHub → Vercel |

Le futur stockage de photos devra utiliser un stockage objet durable, par exemple Vercel Blob. Aucune migration de fichiers n’est nécessaire aujourd’hui, car le projet précédent ne déclarait pas encore de stockage objet actif.
