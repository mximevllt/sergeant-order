import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

process.env.APP_ENV = "development";
process.env.APP_URL = "http://localhost";
process.env.EMAIL_DELIVERY_MODE = "log";
process.env.AUTH_SECRET = "test-secret-sergeant-paysage-authentication-2026";

const projectRoot = new URL("../", import.meta.url);
const appRoot = new URL("../app/", import.meta.url);
const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const workerPromise = import(workerUrl.href).then(({ default: worker }) => worker);

async function render(pathname, options = {}) {
  const worker = await workerPromise;
  const headers = new Headers(options.headers);
  if (!headers.has("accept")) headers.set("accept", options.accept ?? "text/html");
  return worker.fetch(
    new Request(new URL(pathname, options.origin ?? "http://localhost"), {
      method: options.method ?? "GET",
      headers,
      body: options.body,
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      ...options.bindings,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function readAppSources(directory = appRoot) {
  const entries = await readdir(directory, { withFileTypes: true });
  const sources = [];

  for (const entry of entries) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) {
      sources.push(...await readAppSources(url));
    } else if (entry.name.endsWith(".tsx")) {
      sources.push([url.pathname, await readFile(url, "utf8")]);
    }
  }

  return sources;
}

test("reports environment health without exposing configuration values", async () => {
  const localResponse = await render("/api/health", { accept: "application/json" });
  assert.equal(localResponse.status, 200);
  assert.deepEqual(await localResponse.json(), {
    status: "ok",
    environment: "development",
    configuration: "ok",
  });

  const remoteResponse = await render("/api/health", {
    origin: "https://production.sergeant-paysage.fr",
    accept: "application/json",
  });
  assert.equal(remoteResponse.status, 503);
  assert.deepEqual(await remoteResponse.json(), {
    status: "misconfigured",
    environment: "development",
    configuration: "error",
  });
});

test("server-renders the current product routes", async () => {
  const routes = [
    ["/", /Votre jardin entretenu/, /Les services/],
    ["/reserver", /Étape/, /Que souhaitez-vous faire/],
    ["/connexion", /Accédez à votre espace/, /Recevoir mon lien/],
    ["/connexion-entreprise", /Connectez-vous à votre poste/, /Recevoir mon accès/],
    ["/tarifs", /Des prix simples/, /Votre estimation/],
  ];

  for (const [pathname, firstExpected, secondExpected] of routes) {
    const response = await render(pathname);
    assert.equal(response.status, 200, `${pathname} should respond successfully`);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

    const html = await response.text();
    assert.match(html, firstExpected);
    assert.match(html, secondExpected);
    assert.doesNotMatch(html, /Your site is taking shape|Building your site|codex-preview/i);
  }

  const protectedResponse = await render("/espace-client");
  assert.equal(protectedResponse.status, 307);
  assert.match(protectedResponse.headers.get("location") ?? "", /^\/connexion\?returnTo=/u);
  const protectedAdmin = await render("/admin");
  assert.equal(protectedAdmin.status, 307);
  assert.match(protectedAdmin.headers.get("location") ?? "", /^\/connexion-entreprise\?returnTo=/u);
  const protectedField = await render("/terrain");
  assert.equal(protectedField.status, 307);
  assert.match(protectedField.headers.get("location") ?? "", /^\/connexion-entreprise\?returnTo=/u);
});

test("crée un compte par lien, ouvre une session, interdit la réutilisation et déconnecte", async () => {
  const database = await createMigratedDatabase();
  const binding = createD1Binding(database);
  const requestResponse = await render("/api/auth/magic-link/request", {
    accept: "application/json",
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    body: JSON.stringify({
      email: "Camille.Jardin@Example.fr",
      fullName: "Camille Jardin",
      returnTo: "/espace-client",
    }),
    bindings: { DB: binding },
  });
  assert.equal(requestResponse.status, 202);
  const requestPayload = await requestResponse.json();
  assert.match(requestPayload.previewUrl, /^http:\/\/localhost\/auth\/verifier\?token=/u);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const repeated = await render("/api/auth/magic-link/request", {
      accept: "application/json",
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost" },
      body: JSON.stringify({ email: "camille.jardin@example.fr", returnTo: "/espace-client" }),
      bindings: { DB: binding },
    });
    assert.equal(repeated.status, 202);
    assert.ok((await repeated.json()).previewUrl);
  }
  const throttled = await render("/api/auth/magic-link/request", {
    accept: "application/json",
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    body: JSON.stringify({ email: "camille.jardin@example.fr", returnTo: "/espace-client" }),
    bindings: { DB: binding },
  });
  assert.equal(throttled.status, 202);
  assert.equal((await throttled.json()).previewUrl, undefined);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM magic_link_tokens").get().count, 3);

  const rawToken = new URL(requestPayload.previewUrl).searchParams.get("token");
  const storedToken = database.prepare("SELECT token_hash, used_at FROM magic_link_tokens").get();
  assert.notEqual(storedToken.token_hash, rawToken);
  assert.equal(storedToken.used_at, null);

  const verifyUrl = new URL(requestPayload.previewUrl);
  const verifyResponse = await render(`${verifyUrl.pathname}${verifyUrl.search}`, { bindings: { DB: binding } });
  assert.equal(verifyResponse.status, 303);
  assert.equal(verifyResponse.headers.get("location"), "/espace-client");
  const cookie = verifyResponse.headers.get("set-cookie");
  assert.match(cookie ?? "", /sp_session=/u);
  assert.match(cookie ?? "", /HttpOnly/u);

  const sessionCookie = cookie?.split(";", 1)[0] ?? "";
  const accountResponse = await render("/espace-client", {
    headers: { Cookie: sessionCookie },
    bindings: { DB: binding },
  });
  assert.equal(accountResponse.status, 200);
  const accountHtml = await accountResponse.text();
  assert.match(accountHtml, /Compte de Camille Jardin/u);
  assert.match(accountHtml, /camille\.jardin@example\.fr/u);
  assert.equal(database.prepare("SELECT email_verified_at IS NOT NULL AS verified FROM users").get().verified, 1);

  const profileResponse = await render("/api/customer/profile", {
    accept: "application/json",
    method: "PATCH",
    headers: { Cookie: sessionCookie, Origin: "http://localhost", "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Camille Jardinier",
      phone: "06 12 34 56 78",
      customerType: "PROFESSIONAL",
      organization: {
        legalName: "Les Jardins de Camille",
        tradeName: "Camille & Jardin",
        siren: "123456789",
        vatNumber: "FR12123456789",
        billingEmail: "factures@example.fr",
        billingAddress: { line1: "8 rue des Fleurs", postalCode: "83170", city: "Brignoles" },
      },
    }),
    bindings: { DB: binding },
  });
  assert.equal(profileResponse.status, 200);
  assert.equal((await profileResponse.json()).profile.customerType, "PROFESSIONAL");
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM organizations").get().count, 1);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM user_roles WHERE role = 'PRO_CUSTOMER_ADMIN'").get().count, 1);

  const gardenPayload = {
    label: "Maison de Brignoles",
    address: { label: "Entrée principale", line1: "22 chemin des Consacs", postalCode: "83170", city: "Brignoles" },
    surfaceM2: 850,
    terrainSlope: "GENTLE",
    accessWidthCm: 240,
    hasAnimals: true,
    parkingNotes: "Stationnement devant le portail",
    publicNotes: "Prévenir avant l’arrivée",
  };
  const createGardenResponse = await render("/api/customer/gardens", {
    accept: "application/json",
    method: "POST",
    headers: { Cookie: sessionCookie, Origin: "http://localhost", "Content-Type": "application/json" },
    body: JSON.stringify(gardenPayload),
    bindings: { DB: binding },
  });
  assert.equal(createGardenResponse.status, 201);
  const garden = (await createGardenResponse.json()).garden;
  assert.match(garden.id, /^[a-f0-9-]{36}$/u);
  assert.equal(database.prepare("SELECT owner_user_id AS owner, internal_notes AS internalNotes FROM gardens WHERE id = ?").get(garden.id).owner, database.prepare("SELECT id FROM users").get().id);

  const crossOriginGarden = await render(`/api/customer/gardens/${garden.id}`, {
    accept: "application/json",
    method: "PATCH",
    headers: { Cookie: sessionCookie, Origin: "https://malveillant.example", "Content-Type": "application/json" },
    body: JSON.stringify(gardenPayload),
    bindings: { DB: binding },
  });
  assert.equal(crossOriginGarden.status, 403);

  const updateGardenResponse = await render(`/api/customer/gardens/${garden.id}`, {
    accept: "application/json",
    method: "PATCH",
    headers: { Cookie: sessionCookie, Origin: "http://localhost", "Content-Type": "application/json" },
    body: JSON.stringify({ ...gardenPayload, label: "Jardin principal", surfaceM2: 900 }),
    bindings: { DB: binding },
  });
  assert.equal(updateGardenResponse.status, 200);
  assert.equal((await updateGardenResponse.json()).garden.surfaceM2, 900);

  database.prepare("INSERT INTO users (id, email, email_normalized, full_name, status) VALUES ('other-user', 'other@example.fr', 'other@example.fr', 'Autre Client', 'ACTIVE')").run();
  database.prepare("INSERT INTO addresses (id, owner_user_id, kind, line1, postal_code, city, department_code) VALUES ('22222222-2222-4222-8222-222222222221', 'other-user', 'SERVICE', '1 rue privée', '06000', 'Nice', '06')").run();
  database.prepare("INSERT INTO gardens (id, owner_user_id, address_id, label) VALUES ('22222222-2222-4222-8222-222222222222', 'other-user', '22222222-2222-4222-8222-222222222221', 'Jardin privé')").run();
  const foreignGardenResponse = await render("/api/customer/gardens/22222222-2222-4222-8222-222222222222", {
    accept: "application/json",
    method: "PATCH",
    headers: { Cookie: sessionCookie, Origin: "http://localhost", "Content-Type": "application/json" },
    body: JSON.stringify(gardenPayload),
    bindings: { DB: binding },
  });
  assert.equal(foreignGardenResponse.status, 404);

  const refreshedAccount = await render("/espace-client", { headers: { Cookie: sessionCookie }, bindings: { DB: binding } });
  const refreshedHtml = await refreshedAccount.text();
  assert.match(refreshedHtml, /Camille Jardinier/u);
  assert.match(refreshedHtml, /Jardin principal/u);

  const archiveResponse = await render(`/api/customer/gardens/${garden.id}`, {
    accept: "application/json",
    method: "DELETE",
    headers: { Cookie: sessionCookie, Origin: "http://localhost" },
    bindings: { DB: binding },
  });
  assert.equal(archiveResponse.status, 204);
  assert.equal(database.prepare("SELECT archived_at IS NOT NULL AS archived FROM gardens WHERE id = ?").get(garden.id).archived, 1);
  const listedGardens = await render("/api/customer/gardens", { accept: "application/json", headers: { Cookie: sessionCookie }, bindings: { DB: binding } });
  assert.deepEqual((await listedGardens.json()).gardens, []);
  assert.ok(database.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action IN ('CUSTOMER_PROFILE_UPDATED', 'GARDEN_CREATED', 'GARDEN_UPDATED', 'GARDEN_ARCHIVED')").get().count >= 4);

  const forbiddenAdmin = await render("/admin", {
    headers: { Cookie: sessionCookie },
    bindings: { DB: binding },
  });
  assert.equal(forbiddenAdmin.status, 307);
  assert.equal(forbiddenAdmin.headers.get("location"), "/acces-refuse?espace=entreprise");

  const replayResponse = await render(`${verifyUrl.pathname}${verifyUrl.search}`, { bindings: { DB: binding } });
  assert.equal(replayResponse.status, 303);
  assert.equal(replayResponse.headers.get("location"), "/connexion?erreur=lien-invalide");

  const signOutResponse = await render("/api/auth/sign-out", {
    method: "POST",
    headers: { Cookie: sessionCookie, Origin: "http://localhost" },
    bindings: { DB: binding },
  });
  assert.equal(signOutResponse.status, 303);
  assert.match(signOutResponse.headers.get("set-cookie") ?? "", /Max-Age=0/u);
  assert.equal(database.prepare("SELECT revoked_at IS NOT NULL AS revoked FROM auth_sessions").get().revoked, 1);
  database.close();
});

test("réserve l'accès entreprise aux comptes invités et respecte leurs rôles", async () => {
  const database = await createMigratedDatabase();
  const binding = createD1Binding(database);
  database.prepare(`
    INSERT INTO users (id, email, email_normalized, full_name, status)
    VALUES ('staff-1', 'equipe@sergeant-paysage.fr', 'equipe@sergeant-paysage.fr', 'Camille Équipe', 'INVITED')
  `).run();
  database.prepare(`INSERT INTO user_roles (user_id, role) VALUES ('staff-1', 'DISPATCHER')`).run();
  database.prepare(`INSERT INTO user_roles (user_id, role) VALUES ('staff-1', 'FIELD_STAFF')`).run();

  const unknownResponse = await render("/api/auth/staff/magic-link/request", {
    accept: "application/json",
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    body: JSON.stringify({ email: "inconnu@example.fr", returnTo: "/admin" }),
    bindings: { DB: binding },
  });
  assert.equal(unknownResponse.status, 202);
  assert.equal((await unknownResponse.json()).previewUrl, undefined);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM users").get().count, 1);

  const requestResponse = await render("/api/auth/staff/magic-link/request", {
    accept: "application/json",
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    body: JSON.stringify({ email: "equipe@sergeant-paysage.fr", returnTo: "/admin" }),
    bindings: { DB: binding },
  });
  assert.equal(requestResponse.status, 202);
  const requestPayload = await requestResponse.json();
  assert.match(requestPayload.previewUrl, /portail=entreprise/u);

  const verifyUrl = new URL(requestPayload.previewUrl);
  const verifyResponse = await render(`${verifyUrl.pathname}${verifyUrl.search}`, { bindings: { DB: binding } });
  assert.equal(verifyResponse.status, 303);
  assert.equal(verifyResponse.headers.get("location"), "/admin");
  assert.match(verifyResponse.headers.get("set-cookie") ?? "", /Max-Age=28800/u);
  const staffCookie = verifyResponse.headers.get("set-cookie")?.split(";", 1)[0] ?? "";

  assert.equal(database.prepare("SELECT kind FROM auth_sessions").get().kind, "STAFF");
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM user_roles WHERE role = 'CUSTOMER'").get().count, 0);
  assert.equal(database.prepare("SELECT status FROM users WHERE id = 'staff-1'").get().status, "ACTIVE");

  const adminResponse = await render("/admin", {
    headers: { Cookie: staffCookie },
    bindings: { DB: binding },
  });
  assert.equal(adminResponse.status, 200);
  const adminHtml = await adminResponse.text();
  assert.match(adminHtml, /Espace entreprise sécurisé/u);
  assert.match(adminHtml, /Responsable planning/u);
  assert.doesNotMatch(adminHtml, /Paiements/u);

  const fieldResponse = await render("/terrain", {
    headers: { Cookie: staffCookie },
    bindings: { DB: binding },
  });
  assert.equal(fieldResponse.status, 200);
  assert.match(await fieldResponse.text(), /Espace terrain sécurisé/u);

  const forbiddenCustomer = await render("/espace-client", {
    headers: { Cookie: staffCookie },
    bindings: { DB: binding },
  });
  assert.equal(forbiddenCustomer.status, 307);
  assert.equal(forbiddenCustomer.headers.get("location"), "/acces-refuse?espace=client");

  const bootstrapResponse = await render("/api/auth/staff/magic-link/request", {
    accept: "application/json",
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    body: JSON.stringify({ email: "direction@sergeant-paysage.fr", returnTo: "/admin" }),
    bindings: { DB: binding, INITIAL_ADMIN_EMAIL: "direction@sergeant-paysage.fr" },
  });
  assert.equal(bootstrapResponse.status, 202);
  assert.match((await bootstrapResponse.json()).previewUrl, /portail=entreprise/u);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM user_roles WHERE role = 'ADMIN'").get().count, 1);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action = 'INITIAL_ADMIN_PROVISIONED'").get().count, 1);
  database.close();
});

test("ships Sergeant Paysage metadata and social preview", async () => {
  const [response, layout] = await Promise.all([
    render("/"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    access(new URL("../public/og.png", import.meta.url)),
  ]);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="fr"/i);
  assert.match(html, /<title>Sergeant Paysage — Réservez votre jardinier en ligne<\/title>/i);
  assert.match(html, /og\.png/i);
  assert.match(layout, /Sergeant Paysage — Réservez votre jardinier en ligne/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/);
});

test("keeps application sources free of starter and dead-link remnants", async () => {
  const sources = await readAppSources();

  for (const [pathname, source] of sources) {
    assert.doesNotMatch(source, /<img\b/, `${pathname} should use the image component`);
    assert.doesNotMatch(source, /href=["']#["']/, `${pathname} should not contain dead links`);
    assert.doesNotMatch(source, /SkeletonPreview|codex-preview/, `${pathname} should not contain starter code`);
  }

  await assert.rejects(access(new URL("../app/_sites-preview/", import.meta.url)));
  await assert.rejects(access(new URL("../public/_sites-preview/", projectRoot)));
});

async function createMigratedDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  const migrationNames = (await readdir(new URL("../drizzle/", import.meta.url)))
    .filter((name) => /^\d+_.+\.sql$/u.test(name))
    .sort();
  for (const name of migrationNames) {
    const sql = await readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) database.exec(statement);
    }
  }
  return database;
}

function createD1Binding(database) {
  class Prepared {
    constructor(sql, values = []) {
      this.sql = sql;
      this.values = values;
    }
    bind(...values) { return new Prepared(this.sql, values); }
    async first(columnName) {
      const row = database.prepare(this.sql).get(...this.values) ?? null;
      return columnName && row ? row[columnName] : row;
    }
    async all() {
      return { results: database.prepare(this.sql).all(...this.values), success: true, meta: {} };
    }
    async run() { return this.execute(); }
    execute() {
      const result = database.prepare(this.sql).run(...this.values);
      return { results: [], success: true, meta: { changes: Number(result.changes) } };
    }
  }

  return {
    prepare(sql) { return new Prepared(sql); },
    async batch(statements) {
      database.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map((statement) => statement.execute());
        database.exec("COMMIT");
        return results;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
    async exec(sql) { database.exec(sql); return { count: 0, duration: 0 }; },
  };
}
