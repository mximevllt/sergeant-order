import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const wrangler = fileURLToPath(new URL("../node_modules/.bin/wrangler", import.meta.url));
const environment = process.env.APP_ENV || "development";

if (environment !== "development") {
  console.error(`Refus : les données de démonstration sont interdites en ${environment}.`);
  process.exit(1);
}

function run(args) {
  const result = spawnSync(wrangler, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["d1", "migrations", "apply", "DB", "--local", "--config", "wrangler.local.jsonc"]);
run(["d1", "execute", "DB", "--local", "--config", "wrangler.local.jsonc", "--file", "db/seeds/demo.sql"]);

console.log("Base locale prête avec le jeu de démonstration SERGEANT PAYSAGE.");
