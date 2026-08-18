# SERGEANT PAYSAGE — réservation en ligne

Application web de réservation de prestations de paysagisme, construite avec Next.js et prête à être versionnée sur GitHub puis déployée sur Vercel.

## Architecture

- Next.js 16 App Router et React 19 pour le site, les portails et les API.
- Fonctions serveur Node.js déployables nativement sur Vercel.
- Turso/libSQL comme base SQLite distante pour conserver les 50 tables, les contraintes et les migrations existantes.
- Drizzle ORM pour le schéma typé.
- Authentification interne sans mot de passe par lien à usage unique.
- Région Vercel principale : Paris (`cdg1`).

Le projet ne contient plus de Worker Cloudflare, de liaison D1, de configuration Vite spécifique ni de métadonnée d’hébergement OpenAI Sites.

## Développement local

Pré-requis : Node.js 22 ou plus récent et Corepack.

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

Dans `.env.local`, donnez à `AUTH_SECRET` une valeur aléatoire d’au moins 32 caractères. La base locale par défaut est `sergeant-paysage.local.db`; elle est ignorée par Git.

Commandes utiles :

- `pnpm dev` : lance le site local.
- `pnpm build` : produit le build Next.js de production.
- `pnpm test` : construit le site et vérifie pages, API, comptes, base et sécurité.
- `pnpm lint` : contrôle la qualité du code.
- `pnpm typecheck` : contrôle les types.
- `pnpm db:migrate` : applique uniquement les migrations absentes.
- `pnpm db:seed:demo` : ajoute les données de démonstration, uniquement en développement.

## Mise en ligne avec GitHub et Vercel

1. Créez une base Turso de production et récupérez son URL `libsql://…` ainsi que son jeton.
2. Créez un dépôt GitHub privé et poussez l’intégralité de ce dossier. Ne poussez aucun fichier `.env.local`.
3. Dans Vercel, choisissez **Add New > Project**, importez le dépôt et laissez Vercel détecter Next.js.
4. Ajoutez les variables décrites dans `.env.production.example` dans **Project Settings > Environment Variables**.
5. Depuis un poste sécurisé disposant des variables de production, exécutez une fois `pnpm db:migrate` avant d’ouvrir le site au public.
6. Déployez, vérifiez `/api/health`, puis associez le domaine définitif et mettez `APP_URL` à jour avec ce domaine.

Vercel utilise automatiquement `pnpm-lock.yaml`, lance `pnpm build` et publie la sortie Next.js. `vercel.json` fixe explicitement le framework et la région d’exécution.

### Variables minimales pour un premier déploiement technique

```dotenv
APP_ENV=staging
APP_URL=https://votre-preview.vercel.app
COMPANY_TIMEZONE=Europe/Paris
SUPPORT_EMAIL=votre-adresse@domaine.fr
TURSO_DATABASE_URL=libsql://votre-base.turso.io
TURSO_AUTH_TOKEN=secret
AUTH_SECRET=secret-aleatoire-de-32-caracteres-minimum
EMAIL_DELIVERY_MODE=test
PAYMENT_MODE=test
AICI_MODE=test
```

Les intégrations Resend, Stripe, Urssaf, Sentry et Turnstile sont contrôlées par les fichiers d’environnement mais seront réellement activées dans leurs étapes fonctionnelles respectives. Le mode production refuse les configurations incomplètes ou les clés Stripe de test.

Avec cette configuration minimale, la santé d’une préproduction vérifie le socle et l’authentification. En production, `/api/health` exige en plus toutes les intégrations réelles avant de répondre `200`.

## Base de données

Les migrations SQL versionnées sont dans `drizzle/`. Le script `scripts/migrate-database.mjs` tient un registre `app_migrations` et applique chaque fichier une seule fois, dans l’ordre.

- En local : `TURSO_DATABASE_URL=file:./sergeant-paysage.local.db`; aucun jeton n’est requis.
- Sur Vercel : utilisez obligatoirement une URL Turso distante et `TURSO_AUTH_TOKEN`.
- N’utilisez jamais une base `file:` sur Vercel : le système de fichiers d’une fonction est éphémère.
- Préproduction et production doivent utiliser deux bases différentes.

La migration recrée les données de référence validées (entreprise, deux équipes, catalogue et barème à 329 € TTC la demi-journée). Elle ne copie pas d’éventuels comptes ou commandes créés dans l’ancienne base d’hébergement. Si des données réelles y existaient, elles devront être exportées et importées séparément avant la bascule DNS.

## Déploiement continu

Le workflow `.github/workflows/ci.yml` vérifie automatiquement chaque pull request et chaque envoi sur `main` : installation verrouillée, migration d’une base temporaire, lint, types, build et tests de bout en bout. Vercel peut ensuite créer une prévisualisation pour chaque pull request et mettre la production à jour lorsque `main` est validée.

## Sécurité

- Les secrets ne sont jamais écrits dans le dépôt.
- Les liens de connexion et sessions sont stockés uniquement sous forme d’empreintes.
- Les actions d’écriture vérifient l’origine de la requête.
- Les rôles client, entreprise et terrain sont contrôlés côté serveur.
- Le contenu financier et les événements d’audit sont protégés par des contraintes SQLite.

Consultez aussi `docs/11-migration-github-vercel.md` pour la checklist de bascule.
