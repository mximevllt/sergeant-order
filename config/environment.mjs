export const APP_ENVIRONMENTS = Object.freeze(["development", "staging", "production"]);

export const CORE_VARIABLES = Object.freeze([
  "APP_ENV",
  "APP_URL",
  "COMPANY_TIMEZONE",
  "SUPPORT_EMAIL",
  "EMAIL_DELIVERY_MODE",
  "PAYMENT_MODE",
  "AICI_MODE",
]);

export const SECRET_VARIABLES = Object.freeze([
  "BETTER_AUTH_SECRET",
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "URSSAF_CLIENT_SECRET",
  "ACCESS_DATA_ENCRYPTION_KEY",
  "SENTRY_DSN",
  "TURNSTILE_SECRET_KEY",
]);

export const INTEGRATION_GROUPS = Object.freeze({
  authentication: ["BETTER_AUTH_SECRET"],
  transactionalEmail: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
  payments: [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  ],
  aici: [
    "URSSAF_CLIENT_ID",
    "URSSAF_CLIENT_SECRET",
    "URSSAF_API_BASE_URL",
    "URSSAF_NOVA_NUMBER",
    "ACCESS_DATA_ENCRYPTION_KEY",
  ],
  observability: ["SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"],
  antiAbuse: ["TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY"],
});

const DEVELOPMENT_DEFAULTS = Object.freeze({
  APP_ENV: "development",
  APP_URL: "http://localhost:3000",
  COMPANY_TIMEZONE: "Europe/Paris",
  SUPPORT_EMAIL: "support@localhost.invalid",
  EMAIL_DELIVERY_MODE: "log",
  PAYMENT_MODE: "disabled",
  AICI_MODE: "disabled",
});

const PLACEHOLDER_MARKERS = [
  "replace",
  "replace_me",
  ".invalid",
  "the-final-domain.example",
  "preproduction.sergeant-paysage.example",
];

function valueOf(source, key) {
  const value = source[key];
  return typeof value === "string" ? value.trim() : "";
}

function hasPlaceholder(value) {
  const normalized = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
}

function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function addModeChecks(environment, values, errors) {
  const expected = environment === "production"
    ? { email: "live", payment: "live", aici: "live" }
    : environment === "staging"
      ? { email: "test", payment: "test", aici: "test" }
      : null;

  if (expected) {
    if (values.EMAIL_DELIVERY_MODE !== expected.email) {
      errors.push(`EMAIL_DELIVERY_MODE doit valoir ${expected.email} en ${environment}.`);
    }
    if (values.PAYMENT_MODE !== expected.payment) {
      errors.push(`PAYMENT_MODE doit valoir ${expected.payment} en ${environment}.`);
    }
    if (values.AICI_MODE !== expected.aici) {
      errors.push(`AICI_MODE doit valoir ${expected.aici} en ${environment}.`);
    }
  }

  const allowedEmailModes = ["log", "test", "live"];
  const allowedServiceModes = ["disabled", "test", "live"];
  if (!allowedEmailModes.includes(values.EMAIL_DELIVERY_MODE)) {
    errors.push("EMAIL_DELIVERY_MODE doit valoir log, test ou live.");
  }
  if (!allowedServiceModes.includes(values.PAYMENT_MODE)) {
    errors.push("PAYMENT_MODE doit valoir disabled, test ou live.");
  }
  if (!allowedServiceModes.includes(values.AICI_MODE)) {
    errors.push("AICI_MODE doit valoir disabled, test ou live.");
  }
}

function addStripeSafetyChecks(environment, values, errors) {
  const secretKey = values.STRIPE_SECRET_KEY;
  const publicKey = values.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!secretKey && !publicKey) return;

  if (environment === "production") {
    if (!secretKey.startsWith("sk_live_")) errors.push("Stripe doit utiliser une clé secrète live en production.");
    if (!publicKey.startsWith("pk_live_")) errors.push("Stripe doit utiliser une clé publique live en production.");
  } else {
    if (secretKey.startsWith("sk_live_") || publicKey.startsWith("pk_live_")) {
      errors.push("Une clé Stripe live est interdite hors production.");
    }
    if (secretKey && !secretKey.startsWith("sk_test_")) errors.push("Stripe doit utiliser une clé secrète de test hors production.");
    if (publicKey && !publicKey.startsWith("pk_test_")) errors.push("Stripe doit utiliser une clé publique de test hors production.");
  }
}

/**
 * Contrôle une configuration sans jamais renvoyer la valeur des secrets.
 *
 * @param {Record<string, unknown>} source
 * @param {{ environment?: string, allowDevelopmentDefaults?: boolean, requireIntegrations?: string[] | "all" }} options
 */
export function inspectEnvironment(source = {}, options = {}) {
  const requestedEnvironment = options.environment || valueOf(source, "APP_ENV") || "development";
  const environment = APP_ENVIRONMENTS.includes(requestedEnvironment)
    ? requestedEnvironment
    : "development";
  const useDefaults = environment === "development" && options.allowDevelopmentDefaults !== false;
  const values = {};

  const knownVariables = new Set([
    ...CORE_VARIABLES,
    ...Object.values(INTEGRATION_GROUPS).flat(),
  ]);
  for (const key of knownVariables) {
    values[key] = valueOf(source, key) || (useDefaults ? DEVELOPMENT_DEFAULTS[key] || "" : "");
  }

  const errors = [];
  const warnings = [];
  if (!APP_ENVIRONMENTS.includes(requestedEnvironment)) {
    errors.push(`APP_ENV inconnu : ${requestedEnvironment}.`);
  }
  for (const key of CORE_VARIABLES) {
    if (!values[key]) errors.push(`${key} est obligatoire.`);
  }

  if (values.APP_ENV && values.APP_ENV !== environment) {
    errors.push(`APP_ENV (${values.APP_ENV}) ne correspond pas à l'environnement contrôlé (${environment}).`);
  }

  try {
    const appUrl = new URL(values.APP_URL);
    if (environment !== "development" && appUrl.protocol !== "https:") {
      errors.push("APP_URL doit utiliser HTTPS hors développement local.");
    }
    if (environment !== "development" && isLocalHostname(appUrl.hostname)) {
      errors.push("APP_URL ne peut pas cibler la machine locale hors développement.");
    }
  } catch {
    errors.push("APP_URL doit être une URL absolue valide.");
  }

  if (values.COMPANY_TIMEZONE && values.COMPANY_TIMEZONE !== "Europe/Paris") {
    errors.push("COMPANY_TIMEZONE doit rester Europe/Paris pour les créneaux de SERGEANT PAYSAGE.");
  }
  if (values.SUPPORT_EMAIL && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.SUPPORT_EMAIL)) {
    errors.push("SUPPORT_EMAIL n'est pas une adresse valide.");
  }
  addModeChecks(environment, values, errors);

  const required = options.requireIntegrations === "all"
    ? Object.keys(INTEGRATION_GROUPS)
    : options.requireIntegrations || [];
  const integrations = {};
  for (const [name, keys] of Object.entries(INTEGRATION_GROUPS)) {
    const configuredKeys = keys.filter((key) => Boolean(values[key]));
    const configured = configuredKeys.length > 0;
    const complete = configuredKeys.length === keys.length;
    const isRequired = required.includes(name);
    integrations[name] = { configured, complete, required: isRequired };

    if (configured && !complete) {
      const missing = keys.filter((key) => !values[key]);
      errors.push(`Configuration ${name} incomplète : ${missing.join(", ")}.`);
    } else if (isRequired && !complete) {
      errors.push(`Configuration ${name} obligatoire dans ce contrôle.`);
    } else if (!configured) {
      warnings.push(`Intégration ${name} non configurée.`);
    }
  }

  addStripeSafetyChecks(environment, values, errors);

  if (environment !== "development") {
    for (const key of knownVariables) {
      if (values[key] && hasPlaceholder(values[key])) {
        errors.push(`${key} contient encore une valeur d'exemple.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    environment,
    publicConfiguration: {
      appUrl: values.APP_URL,
      timezone: values.COMPANY_TIMEZONE,
      emailDeliveryMode: values.EMAIL_DELIVERY_MODE,
      paymentMode: values.PAYMENT_MODE,
      aiciMode: values.AICI_MODE,
    },
    integrations,
    errors,
    warnings,
  };
}
