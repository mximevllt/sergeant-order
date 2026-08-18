import { createClient } from "@libsql/client";
import { readFile } from "node:fs/promises";

const environment = process.env.APP_ENV || "development";

if (environment !== "development") {
  console.error(`Refus : les données de démonstration sont interdites en ${environment}.`);
  process.exit(1);
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:./sergeant-paysage.local.db",
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

try {
  const demoSql = await readFile(new URL("../db/seeds/demo.sql", import.meta.url), "utf8");
  await client.executeMultiple(demoSql);
  console.log("Jeu de démonstration SERGEANT PAYSAGE chargé dans la base locale.");
} finally {
  client.close();
}
