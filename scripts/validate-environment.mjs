import { APP_ENVIRONMENTS, inspectEnvironment } from "../config/environment.mjs";

function argumentValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

const requestedEnvironment = argumentValue("environment") || process.env.APP_ENV || "development";
const requireValue = argumentValue("require");

if (!APP_ENVIRONMENTS.includes(requestedEnvironment)) {
  console.error(`Environnement inconnu : ${requestedEnvironment}`);
  process.exitCode = 1;
} else {
  const report = inspectEnvironment(process.env, {
    environment: requestedEnvironment,
    allowDevelopmentDefaults: requestedEnvironment === "development",
    requireIntegrations: requireValue === "all" ? "all" : [],
  });

  console.log(`Environnement contrôlé : ${report.environment}`);
  console.log(`Configuration principale : ${report.valid ? "valide" : "invalide"}`);
  for (const [name, status] of Object.entries(report.integrations)) {
    const label = status.complete ? "configurée" : status.configured ? "incomplète" : "en attente";
    console.log(`- ${name}: ${label}`);
  }
  for (const warning of report.warnings) console.warn(`Avertissement : ${warning}`);
  for (const error of report.errors) console.error(`Erreur : ${error}`);
  if (!report.valid) process.exitCode = 1;
}
