import assert from "node:assert/strict";
import test from "node:test";
import { inspectEnvironment } from "../config/environment.mjs";

const stagingCore = {
  APP_ENV: "staging",
  APP_URL: "https://staging.sergeant-paysage.fr",
  COMPANY_TIMEZONE: "Europe/Paris",
  SUPPORT_EMAIL: "recette@sergeant-paysage.fr",
  EMAIL_DELIVERY_MODE: "test",
  PAYMENT_MODE: "test",
  AICI_MODE: "test",
};

const productionCore = {
  APP_ENV: "production",
  APP_URL: "https://www.sergeant-paysage.fr",
  COMPANY_TIMEZONE: "Europe/Paris",
  SUPPORT_EMAIL: "contact@sergeant-paysage.fr",
  EMAIL_DELIVERY_MODE: "live",
  PAYMENT_MODE: "live",
  AICI_MODE: "live",
};

test("le développement local dispose de valeurs sûres par défaut", () => {
  const report = inspectEnvironment({}, { environment: "development" });
  assert.equal(report.valid, true);
  assert.equal(report.publicConfiguration.paymentMode, "disabled");
  assert.equal(report.publicConfiguration.aiciMode, "disabled");
});

test("la préproduction exige une configuration explicite et des modes de test", () => {
  const missing = inspectEnvironment({}, {
    environment: "staging",
    allowDevelopmentDefaults: false,
  });
  assert.equal(missing.valid, false);

  const valid = inspectEnvironment(stagingCore, { environment: "staging" });
  assert.equal(valid.valid, true);
});

test("les modes réels sont obligatoires en production", () => {
  const report = inspectEnvironment({ ...productionCore, PAYMENT_MODE: "test" });
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.includes("PAYMENT_MODE")));
});

test("une intégration partiellement renseignée est refusée", () => {
  const report = inspectEnvironment({
    ...stagingCore,
    STRIPE_SECRET_KEY: "sk_test_secret-value-never-print",
  });
  assert.equal(report.valid, false);
  assert.equal(report.integrations.payments.configured, true);
  assert.equal(report.integrations.payments.complete, false);
  assert.equal(JSON.stringify(report).includes("secret-value-never-print"), false);
});

test("une clé Stripe réelle ne peut pas être chargée hors production", () => {
  const report = inspectEnvironment({
    ...stagingCore,
    STRIPE_SECRET_KEY: "sk_live_secret-value-never-print",
    STRIPE_WEBHOOK_SECRET: "whsec_value",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_public-value-never-print",
  });
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.includes("interdite hors production")));
});

test("les clés Stripe live cohérentes sont acceptées en production", () => {
  const report = inspectEnvironment({
    ...productionCore,
    STRIPE_SECRET_KEY: "sk_live_secret-value-never-print",
    STRIPE_WEBHOOK_SECRET: "whsec_value",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_public-value-never-print",
  });
  assert.equal(report.valid, true);
});
