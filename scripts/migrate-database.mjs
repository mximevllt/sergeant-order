import { createClient } from "@libsql/client";
import { readFile, readdir } from "node:fs/promises";

const migrationsDirectory = new URL("../drizzle/", import.meta.url);
const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:./sergeant-paysage.local.db",
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

try {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      name TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const applied = await client.execute("SELECT name FROM app_migrations");
  const appliedNames = new Set(applied.rows.map((row) => String(row.name)));
  const migrationNames = (await readdir(migrationsDirectory))
    .filter((name) => /^\d+_.+\.sql$/u.test(name))
    .sort();

  for (const name of migrationNames) {
    if (appliedNames.has(name)) continue;
    const sql = await readFile(new URL(name, migrationsDirectory), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => ({ sql: statement, args: [] }));
    statements.push({
      sql: "INSERT INTO app_migrations (name) VALUES (?)",
      args: [name],
    });
    await client.batch(statements, "write");
    console.log(`Migration appliquée : ${name}`);
  }

  console.log(`Base à jour (${migrationNames.length} migration(s)).`);
} finally {
  client.close();
}
