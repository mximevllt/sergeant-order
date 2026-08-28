import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationsDirectory = new URL("../drizzle/", import.meta.url);

async function loadMigrations() {
  const files = (await readdir(migrationsDirectory))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();
  assert.ok(files.length > 0, "une migration SQL doit être versionnée");
  const migrations = await Promise.all(files.map(async (file) => ({
    file,
    sql: await readFile(new URL(file, migrationsDirectory), "utf8"),
  })));
  return migrations;
}

function applyMigrations(migrations) {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  for (const { sql } of migrations) {
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) database.exec(statement);
    }
  }
  return database;
}

test("la migration initiale crée un schéma SQLite cohérent", async () => {
  const database = applyMigrations(await loadMigrations());
  const tables = database.prepare(`
    SELECT name FROM sqlite_schema
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  assert.equal(tables.length, 50);
  assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
  assert.ok(tables.some(({ name }) => name === "orders"));
  assert.ok(tables.some(({ name }) => name === "schedule_reservation_slots"));
  assert.ok(tables.some(({ name }) => name === "invoices"));
  assert.ok(tables.some(({ name }) => name === "audit_events"));
  database.close();
});

test("les identités et versions tarifaires ne peuvent pas être dupliquées", async () => {
  const database = applyMigrations(await loadMigrations());
  const insertUser = database.prepare(`
    INSERT INTO users (id, email, email_normalized, full_name, status)
    VALUES (?, ?, ?, ?, 'ACTIVE')
  `);
  insertUser.run("user-1", "Client@Example.fr", "client@example.fr", "Client Test");
  assert.throws(() => insertUser.run("user-2", "client@example.fr", "client@example.fr", "Doublon"));

  database.exec("UPDATE pricing_versions SET status = 'ARCHIVED' WHERE status = 'ACTIVE'");
  const insertPricing = database.prepare(`
    INSERT INTO pricing_versions
      (id, version, status, label, half_day_ttc_cents, vat_rate_basis_points)
    VALUES (?, ?, 'ACTIVE', ?, 32900, 2000)
  `);
  insertPricing.run("pricing-101", 101, "Barème initial du test");
  assert.throws(() => insertPricing.run("pricing-102", 102, "Second barème actif"));
  assert.throws(() => database.exec(`
    INSERT INTO pricing_versions
      (id, version, status, label, half_day_ttc_cents, vat_rate_basis_points)
    VALUES ('pricing-negative', 103, 'DRAFT', 'Invalide', -1, 2000)
  `));
  database.close();
});

test("une équipe ne peut pas occuper deux fois la même demi-journée", async () => {
  const database = applyMigrations(await loadMigrations());
  database.exec(`
    INSERT INTO schedule_reservations (id, kind, status, idempotency_key)
      VALUES ('reservation-1', 'BLOCK', 'ACTIVE', 'slot-1');
    INSERT INTO schedule_reservations (id, kind, status, idempotency_key)
      VALUES ('reservation-2', 'BLOCK', 'ACTIVE', 'slot-2');
    INSERT INTO schedule_reservation_slots
      (id, reservation_id, team_id, starts_at, ends_at, status)
      VALUES ('slot-1', 'reservation-1', 'team-1', '2026-08-20T06:00:00Z', '2026-08-20T10:00:00Z', 'ACTIVE');
  `);
  assert.throws(() => database.exec(`
    INSERT INTO schedule_reservation_slots
      (id, reservation_id, team_id, starts_at, ends_at, status)
      VALUES ('slot-2', 'reservation-2', 'team-1', '2026-08-20T06:00:00Z', '2026-08-20T10:00:00Z', 'ACTIVE');
  `));

  database.exec("UPDATE schedule_reservation_slots SET status = 'RELEASED' WHERE id = 'slot-1'");
  database.exec(`
    INSERT INTO schedule_reservation_slots
      (id, reservation_id, team_id, starts_at, ends_at, status)
      VALUES ('slot-2', 'reservation-2', 'team-1', '2026-08-20T06:00:00Z', '2026-08-20T10:00:00Z', 'ACTIVE');
  `);
  database.close();
});

test("un devis ne peut porter qu’un seul verrou de planning actif", async () => {
  const database = applyMigrations(await loadMigrations());
  database.exec(`
    INSERT INTO quotes
      (id, public_reference, pricing_version_id, status, contact_email, request_snapshot, expires_at)
      VALUES ('quote-hold-test', 'SP-DV-HOLD-TEST', 'pricing-2026-v1', 'PRICED', 'hold@example.fr', '{}', '2026-08-27T12:00:00Z');
    INSERT INTO schedule_reservations
      (id, quote_id, kind, status, expires_at, idempotency_key)
      VALUES ('quote-hold-1', 'quote-hold-test', 'HOLD', 'ACTIVE', '2026-08-20T12:00:00Z', 'quote-hold-key-1');
  `);
  assert.throws(() => database.exec(`
    INSERT INTO schedule_reservations
      (id, quote_id, kind, status, expires_at, idempotency_key)
      VALUES ('quote-hold-2', 'quote-hold-test', 'HOLD', 'ACTIVE', '2026-08-20T12:00:00Z', 'quote-hold-key-2');
  `));
  database.exec("UPDATE schedule_reservations SET status = 'RELEASED' WHERE id = 'quote-hold-1'");
  database.exec(`
    INSERT INTO schedule_reservations
      (id, quote_id, kind, status, expires_at, idempotency_key)
      VALUES ('quote-hold-2', 'quote-hold-test', 'HOLD', 'ACTIVE', '2026-08-20T12:00:00Z', 'quote-hold-key-2');
  `);
  database.close();
});

test("un paiement Stripe conserve uniquement les références techniques du moyen de paiement", async () => {
  const database = applyMigrations(await loadMigrations());
  const columns = database.prepare("PRAGMA table_info(payments)").all();
  const indexes = database.prepare("PRAGMA index_list(payments)").all();
  assert.ok(columns.some(({ name }) => name === "provider_payment_method_reference"));
  assert.ok(indexes.some(({ name }) => name === "idx_payments_provider_payment_method"));
  assert.equal(columns.some(({ name }) => /card_number|cvc|pan/u.test(String(name))), false);
  database.close();
});

test("les événements d'audit sont réellement append-only", async () => {
  const database = applyMigrations(await loadMigrations());
  database.exec(`
    INSERT INTO audit_events (id, actor_type, action, entity_type, entity_id)
    VALUES ('audit-1', 'SYSTEM', 'TEST', 'schema', 'initial');
  `);
  assert.throws(() => database.exec("UPDATE audit_events SET action = 'ALTERED' WHERE id = 'audit-1'"));
  assert.throws(() => database.exec("DELETE FROM audit_events WHERE id = 'audit-1'"));
  database.close();
});

test("les requêtes métier principales utilisent les index attendus", async () => {
  const database = applyMigrations(await loadMigrations());
  const plan = database.prepare(`
    EXPLAIN QUERY PLAN
    SELECT * FROM orders
    WHERE customer_user_id = ?
    ORDER BY created_at DESC
  `).all("customer-1");
  const detail = plan.map((row) => String(row.detail)).join(" ");
  assert.match(detail, /idx_orders_customer_created/);
  database.close();
});

test("la migration inclut les protections financières et l'optimisation", async () => {
  const migrations = await loadMigrations();
  const [{ file, sql }] = migrations;
  assert.match(file, /^0000_/);
  assert.match(sql, /trg_invoices_issued_financials_immutable/);
  assert.match(sql, /trg_invoice_lines_issued_no_update/);
  assert.match(sql, /uq_provider_events_provider_id/);
  assert.match(sql, /PRAGMA optimize/);
});

test("les données de référence correspondent aux règles commerciales validées", async () => {
  const database = applyMigrations(await loadMigrations());
  const settings = database.prepare(`
    SELECT legal_name, siret, vat_number, share_capital_cents,
           vat_rate_basis_points, minimum_lead_hours, maximum_advance_days,
           timezone, aici_enabled
    FROM business_settings WHERE id = 'sergeant-paysage'
  `).get();
  assert.deepEqual({ ...settings }, {
    legal_name: "SERGEANT PAYSAGE",
    siret: "98458555400020",
    vat_number: "FR71984585554",
    share_capital_cents: 500000,
    vat_rate_basis_points: 2000,
    minimum_lead_hours: 24,
    maximum_advance_days: 31,
    timezone: "Europe/Paris",
    aici_enabled: 1,
  });

  assert.equal(database.prepare("SELECT count(*) AS count FROM teams WHERE active = 1").get().count, 2);
  assert.equal(database.prepare("SELECT count(*) AS count FROM team_weekly_hours WHERE active = 1").get().count, 20);
  assert.equal(database.prepare("SELECT count(*) AS count FROM catalog_tasks WHERE active = 1").get().count, 6);
  assert.equal(database.prepare("SELECT count(*) AS count FROM pricing_rules WHERE active = 1").get().count, 13);
  assert.deepEqual({ ...database.prepare(`
    SELECT half_day_ttc_cents, vat_rate_basis_points
    FROM pricing_versions WHERE status = 'ACTIVE'
  `).get() }, { half_day_ttc_cents: 32900, vat_rate_basis_points: 2000 });
  database.close();
});

test("les zones commerciales partielles contiennent uniquement les communes validées", async () => {
  const database = applyMigrations(await loadMigrations());
  assert.deepEqual(database.prepare(`
    SELECT code, active FROM service_zones ORDER BY code
  `).all().map((row) => ({ ...row })), [
    { code: "ALPES_MARITIMES_TO_NICE", active: 1 },
    { code: "BOUCHES_DU_RHONE_TO_MARSEILLE", active: 1 },
    { code: "VAR_ALL", active: 1 },
  ]);
  assert.equal(database.prepare("SELECT count(DISTINCT insee_code) AS count FROM zone_municipalities WHERE zone_id = 'zone-bdr' AND included = 1").get().count, 30);
  assert.equal(database.prepare("SELECT count(DISTINCT insee_code) AS count FROM zone_municipalities WHERE zone_id = 'zone-am' AND included = 1").get().count, 40);
  assert.equal(database.prepare("SELECT count(*) AS count FROM zone_municipalities WHERE insee_code = '13055'").get().count, 16);
  assert.equal(database.prepare("SELECT count(*) AS count FROM zone_municipalities WHERE city_name = 'Nice'").get().count, 4);
  assert.equal(database.prepare("SELECT count(*) AS count FROM zone_municipalities WHERE city_name = 'Menton'").get().count, 0);
  database.close();
});

test("les migrations d'authentification séparent les portails et ajoutent les index de limitation", async () => {
  const database = applyMigrations(await loadMigrations());
  const columns = database.prepare("PRAGMA table_info(magic_link_tokens)").all();
  const indexes = database.prepare("PRAGMA index_list(magic_link_tokens)").all();
  assert.ok(columns.some(({ name }) => name === "requested_name"));
  assert.ok(columns.some(({ name, dflt_value }) => name === "audience" && dflt_value === "'CUSTOMER'"));
  assert.ok(indexes.some(({ name }) => name === "idx_magic_link_tokens_email_created"));
  assert.ok(indexes.some(({ name }) => name === "idx_magic_link_tokens_ip_created"));
  assert.ok(indexes.some(({ name }) => name === "idx_magic_link_tokens_audience_email"));
  database.close();
});

test("le jeu de démonstration est idempotent et clairement isolé", async () => {
  const database = applyMigrations(await loadMigrations());
  const demoSql = await readFile(new URL("../db/seeds/demo.sql", import.meta.url), "utf8");
  database.exec(demoSql);
  database.exec(demoSql);

  assert.equal(database.prepare("SELECT count(*) AS count FROM users WHERE id LIKE 'demo-%'").get().count, 4);
  assert.equal(database.prepare("SELECT count(*) AS count FROM orders WHERE id LIKE 'demo-%'").get().count, 1);
  assert.equal(database.prepare("SELECT count(*) AS count FROM interventions WHERE id LIKE 'demo-%'").get().count, 1);
  assert.equal(database.prepare("SELECT count(*) AS count FROM schedule_reservation_slots WHERE id LIKE 'demo-%'").get().count, 1);
  assert.equal(database.prepare("PRAGMA foreign_key_check").all().length, 0);
  database.close();
});

test("le script refuse explicitement les données de démonstration hors développement", async () => {
  const script = await readFile(new URL("../scripts/seed-demo.mjs", import.meta.url), "utf8");
  assert.match(script, /environment !== "development"/);
  assert.match(script, /les données de démonstration sont interdites/);
  assert.doesNotMatch(script, /--remote/);
});
