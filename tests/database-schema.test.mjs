import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationsDirectory = new URL("../drizzle/", import.meta.url);

async function loadInitialMigration() {
  const files = (await readdir(migrationsDirectory))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();
  assert.ok(files.length > 0, "une migration SQL doit être versionnée");
  const sql = await readFile(new URL(files[0], migrationsDirectory), "utf8");
  return { file: files[0], sql };
}

function applyMigration(sql) {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  for (const statement of sql.split("--> statement-breakpoint")) {
    if (statement.trim()) database.exec(statement);
  }
  return database;
}

test("la migration initiale crée un schéma SQLite cohérent", async () => {
  const { sql } = await loadInitialMigration();
  const database = applyMigration(sql);
  const tables = database.prepare(`
    SELECT name FROM sqlite_schema
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  assert.equal(tables.length, 49);
  assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
  assert.ok(tables.some(({ name }) => name === "orders"));
  assert.ok(tables.some(({ name }) => name === "schedule_reservation_slots"));
  assert.ok(tables.some(({ name }) => name === "invoices"));
  assert.ok(tables.some(({ name }) => name === "audit_events"));
  database.close();
});

test("les identités et versions tarifaires ne peuvent pas être dupliquées", async () => {
  const { sql } = await loadInitialMigration();
  const database = applyMigration(sql);
  const insertUser = database.prepare(`
    INSERT INTO users (id, email, email_normalized, full_name, status)
    VALUES (?, ?, ?, ?, 'ACTIVE')
  `);
  insertUser.run("user-1", "Client@Example.fr", "client@example.fr", "Client Test");
  assert.throws(() => insertUser.run("user-2", "client@example.fr", "client@example.fr", "Doublon"));

  const insertPricing = database.prepare(`
    INSERT INTO pricing_versions
      (id, version, status, label, half_day_ttc_cents, vat_rate_basis_points)
    VALUES (?, ?, 'ACTIVE', ?, 32900, 2000)
  `);
  insertPricing.run("pricing-1", 1, "Barème initial");
  assert.throws(() => insertPricing.run("pricing-2", 2, "Second barème actif"));
  assert.throws(() => database.exec(`
    INSERT INTO pricing_versions
      (id, version, status, label, half_day_ttc_cents, vat_rate_basis_points)
    VALUES ('pricing-negative', 3, 'DRAFT', 'Invalide', -1, 2000)
  `));
  database.close();
});

test("une équipe ne peut pas occuper deux fois la même demi-journée", async () => {
  const { sql } = await loadInitialMigration();
  const database = applyMigration(sql);
  database.exec(`
    INSERT INTO teams (id, code, name) VALUES ('team-1', 'EQUIPE_1', 'Équipe 1');
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

test("les événements d'audit sont réellement append-only", async () => {
  const { sql } = await loadInitialMigration();
  const database = applyMigration(sql);
  database.exec(`
    INSERT INTO audit_events (id, actor_type, action, entity_type, entity_id)
    VALUES ('audit-1', 'SYSTEM', 'TEST', 'schema', 'initial');
  `);
  assert.throws(() => database.exec("UPDATE audit_events SET action = 'ALTERED' WHERE id = 'audit-1'"));
  assert.throws(() => database.exec("DELETE FROM audit_events WHERE id = 'audit-1'"));
  database.close();
});

test("les requêtes métier principales utilisent les index attendus", async () => {
  const { sql } = await loadInitialMigration();
  const database = applyMigration(sql);
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
  const { file, sql } = await loadInitialMigration();
  assert.match(file, /^0000_/);
  assert.match(sql, /trg_invoices_issued_financials_immutable/);
  assert.match(sql, /trg_invoice_lines_issued_no_update/);
  assert.match(sql, /uq_provider_events_provider_id/);
  assert.match(sql, /PRAGMA optimize/);
});
