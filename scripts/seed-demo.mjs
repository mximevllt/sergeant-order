import { createClient } from "@libsql/client";
import { readFile } from "node:fs/promises";

const environment = process.env.APP_ENV || "development";

if (environment !== "development") {
  console.error(`Refus : les données de démonstration sont interdites en ${environment}.`);
  process.exit(1);
}

const databaseUrl = process.env.TURSO_DATABASE_URL || "file:./sergeant-paysage.local.db";
const isRemoteLibsql = /^libsqls?:\/\//iu.test(databaseUrl);
const client = createClient({
  url: databaseUrl,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

try {
  const demoSql = await readFile(new URL("../db/seeds/demo.sql", import.meta.url), "utf8");
  if (isRemoteLibsql) {
    const statements = demoSql
      .split(/;\s*(?=\r?\n|$)/u)
      .map((statement) => statement.trim())
      .filter(Boolean)
      .filter((statement) => !/^PRAGMA\s+optimize\s*;?$/iu.test(statement))
      .map((sql) => ({ sql, args: [] }));
    await client.batch(statements, "write");
  } else {
    await client.executeMultiple(demoSql);
  }
  console.log("Jeu de démonstration SERGEANT PAYSAGE chargé.");
} finally {
  client.close();
}
