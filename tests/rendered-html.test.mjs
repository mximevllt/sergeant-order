import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const appRoot = new URL("../app/", import.meta.url);
const port = 43217;
const origin = `http://127.0.0.1:${port}`;
let server;
let temporaryDirectory;

async function runNode(arguments_, environment) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, arguments_, {
      cwd: projectRoot,
      env: { ...process.env, ...environment },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(output)));
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.status === 200) return;
    } catch {
      // Le serveur peut ne pas encore écouter pendant son démarrage.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Le serveur Next.js de test n'a pas démarré.");
}

async function request(pathname, options = {}) {
  const headers = new Headers(options.headers);
  if (!headers.has("accept")) headers.set("accept", options.accept ?? "text/html");
  return fetch(`${origin}${pathname}`, { ...options, headers, redirect: options.redirect ?? "manual" });
}

async function readAppSources(directory = appRoot) {
  const entries = await readdir(directory, { withFileTypes: true });
  const sources = [];
  for (const entry of entries) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) sources.push(...await readAppSources(url));
    else if (entry.name.endsWith(".tsx")) sources.push([url.pathname, await readFile(url, "utf8")]);
  }
  return sources;
}

before(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "sergeant-paysage-next-"));
  const databaseUrl = `file:${join(temporaryDirectory, "integration.db")}`;
  const environment = {
    APP_ENV: "development",
    APP_URL: origin,
    COMPANY_TIMEZONE: "Europe/Paris",
    SUPPORT_EMAIL: "support@localhost.invalid",
    AUTH_SECRET: "test-secret-sergeant-paysage-authentication-2026",
    EMAIL_DELIVERY_MODE: "log",
    PAYMENT_MODE: "disabled",
    AICI_MODE: "disabled",
    TURSO_DATABASE_URL: databaseUrl,
  };
  await runNode(["scripts/migrate-database.mjs"], environment);
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
    cwd: projectRoot,
    env: { ...process.env, ...environment },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer();
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
});

test("Next.js sert les pages publiques et protège les portails", async () => {
  const routes = [
    ["/", /Votre jardin entretenu/, /Les services/],
    ["/reserver", /Étape/, /Que souhaitez-vous faire/],
    ["/connexion", /Accédez à votre espace/, /Recevoir mon lien/],
    ["/connexion-entreprise", /Connectez-vous à votre poste/, /Recevoir mon accès/],
    ["/tarifs", /Des prix simples/, /Votre estimation/],
  ];
  for (const [pathname, firstExpected, secondExpected] of routes) {
    const response = await request(pathname);
    assert.equal(response.status, 200, pathname);
    const html = await response.text();
    assert.match(html, firstExpected);
    assert.match(html, secondExpected);
  }
  const customer = await request("/espace-client");
  assert.equal(customer.status, 307);
  assert.match(customer.headers.get("location") ?? "", /\/connexion\?returnTo=/u);
  const admin = await request("/admin");
  assert.equal(admin.status, 307);
  assert.match(admin.headers.get("location") ?? "", /\/connexion-entreprise\?returnTo=/u);
  const payment = await request("/paiement?devis=devis-inconnu");
  assert.equal(payment.status, 307);
  assert.match(decodeURIComponent(payment.headers.get("location") ?? ""), /returnTo=\/paiement\?devis=/u);
  const protectedSetup = await request("/api/orders/payment-setup", {
    method: "POST",
    headers: { "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json", "Idempotency-Key": "payment-auth-test-00001" },
    body: JSON.stringify({ quoteId: "devis-inconnu", consent: true }),
    accept: "application/json",
  });
  assert.equal(protectedSetup.status, 401);
  const forgedWebhook = await request("/api/webhooks/stripe", { method: "POST", headers: { "Content-Type": "application/json", "Stripe-Signature": "forged" }, body: "{}", accept: "application/json" });
  assert.equal(forgedWebhook.status, 400);
});

test("le catalogue et le calcul tarifaire utilisent la base libSQL", async () => {
  const catalogResponse = await request("/api/catalog", { accept: "application/json" });
  assert.equal(catalogResponse.status, 200);
  const catalog = await catalogResponse.json();
  assert.equal(catalog.tasks.length, 6);
  assert.equal(catalog.pricing.halfDayTtcCents, 32900);

  const payload = {
    taskCodes: ["MOWING", "HEDGE_TRIMMING"], halfDays: 2,
    lawnSurfaceBand: "FROM_250_TO_500", grassState: "MAINTAINED",
    hedgeLengthM: 18, hedgeHeightBand: "FROM_1_5_TO_2M", hedgeFaces: "THREE_FACES",
    greenWaste: "REMOVE_1_TO_2M3", customerPresence: true, accessType: "CODE",
    nearbyParking: true, vehicleDistanceBand: "UNDER_20M", flexibleOnDay: false,
  };
  const response = await request("/api/pricing/estimate", {
    method: "POST",
    headers: { "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(response.status, 200);
  const estimate = await response.json();
  assert.equal(estimate.recommendedHalfDays, 2);
  assert.equal(estimate.totals.total, 717);
  assert.equal(estimate.totals.afterTax, 358.5);
});

test("la zone d'intervention est contrôlée par commune sur le serveur", async () => {
  const cases = [
    [{ postalCode: "83170", city: "Brignoles" }, true, "VAR_ALL"],
    [{ postalCode: "13008", city: "Marseille" }, true, "BOUCHES_DU_RHONE_TO_MARSEILLE"],
    [{ postalCode: "06000", city: "Nice" }, true, "ALPES_MARITIMES_TO_NICE"],
    [{ postalCode: "06500", city: "Menton" }, false, null],
    [{ postalCode: "84000", city: "Avignon" }, false, null],
  ];
  for (const [body, eligible, zoneCode] of cases) {
    const response = await request("/api/service-area/check", { method: "POST", headers: { "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" }, body: JSON.stringify(body) });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.eligible, eligible, JSON.stringify(body));
    assert.equal(result.zone?.code ?? null, zoneCode, JSON.stringify(body));
  }
});

test("les disponibilités respectent le délai, la fenêtre et les jours travaillés", async () => {
  const requestedAt = Date.now();
  const response = await request("/api/availability/search", {
    method: "POST",
    headers: { "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" },
    body: JSON.stringify({ address: "22 chemin des Consacs, 83170 Brignoles", taskCodes: ["MOWING", "HEDGE_TRIMMING"], halfDays: 2 }),
  });
  assert.equal(response.status, 200);
  const availability = await response.json();
  assert.equal(availability.timezone, "Europe/Paris");
  assert.equal(availability.minimumLeadHours, 24);
  assert.equal(availability.maximumAdvanceDays, 31);
  assert.equal(availability.holdMinutes, 15);
  assert.ok(availability.options.length > 0);
  for (const option of availability.options) {
    const startsAt = Date.parse(option.startsAt);
    assert.ok(startsAt >= requestedAt + 24 * 60 * 60 * 1000 - 2_000);
    assert.ok(startsAt <= requestedAt + 31 * 24 * 60 * 60 * 1000 + 2_000);
    const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short" }).format(new Date(startsAt));
    assert.ok(["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday));
    assert.equal(option.halfDays, 2);
    assert.ok(option.availableTeams >= 1 && option.availableTeams <= 2);
  }
});

test("un créneau est bloqué sans double réservation puis libérable", async () => {
  const pricing = {
    taskCodes: ["MOWING"], halfDays: 1,
    lawnSurfaceBand: "UNDER_100", grassState: "MAINTAINED",
    hedgeLengthM: 5, hedgeHeightBand: "UNDER_1_5M", hedgeFaces: "TOP",
    greenWaste: "LEAVE_ON_SITE", customerPresence: true, accessType: "OPEN_GATE",
    nearbyParking: true, vehicleDistanceBand: "UNDER_20M", flexibleOnDay: false,
  };
  async function createHoldQuote(index) {
    const response = await request("/api/quotes", {
      method: "POST",
      headers: { "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json", "Idempotency-Key": `schedule-quote-test-000${index}` },
      body: JSON.stringify({
        contact: { email: `planning-${index}@example.fr` },
        request: { step: 6, address: "22 chemin des Consacs, 83170 Brignoles", selected: ["MOWING"], priority: ["MOWING"], fullName: `Client Planning ${index}`, duration: 1 },
        pricing,
      }),
    });
    assert.equal(response.status, 201);
    return { quote: (await response.json()).quote, cookie: response.headers.get("set-cookie")?.split(";", 1)[0] ?? "" };
  }
  const availabilityResponse = await request("/api/availability/search", {
    method: "POST",
    headers: { "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" },
    body: JSON.stringify({ address: "83170 Brignoles", taskCodes: ["MOWING"], halfDays: 1 }),
  });
  const startsAt = (await availabilityResponse.json()).options[0].startsAt;
  const [first, second, third] = await Promise.all([createHoldQuote(1), createHoldQuote(2), createHoldQuote(3)]);
  async function hold(item, key) {
    return request(`/api/quotes/${item.quote.id}/hold`, {
      method: "POST",
      headers: { Cookie: item.cookie, "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify({ startsAt }),
    });
  }
  const firstHold = await hold(first, "schedule-hold-test-00001");
  assert.equal(firstHold.status, 201);
  const firstHoldBody = await firstHold.json();
  assert.equal(firstHoldBody.hold.startsAt, startsAt);
  assert.equal(firstHoldBody.hold.halfDays, 1);
  assert.ok(Date.parse(firstHoldBody.hold.expiresAt) > Date.now());
  assert.equal((await hold(first, "schedule-hold-test-00001")).status, 201);

  assert.equal((await hold(second, "schedule-hold-test-00002")).status, 201);
  const unavailable = await hold(third, "schedule-hold-test-00003");
  assert.equal(unavailable.status, 409);
  assert.equal((await unavailable.json()).error, "SLOT_NO_LONGER_AVAILABLE");

  const protectedHold = await request(`/api/quotes/${first.quote.id}/hold`, { headers: { Cookie: first.cookie }, accept: "application/json" });
  assert.equal(protectedHold.status, 200);
  assert.equal((await protectedHold.json()).hold.startsAt, startsAt);
  const confirmation = await request(`/confirmation?devis=${first.quote.id}`, { headers: { Cookie: first.cookie } });
  assert.equal(confirmation.status, 200);
  const confirmationHtml = await confirmation.text();
  assert.match(confirmationHtml, /Votre créneau est bloqué/u);
  assert.match(confirmationHtml, /Se connecter pour confirmer/u);
  assert.match(confirmationHtml, /Aucun débit à la réservation/u);

  const released = await request(`/api/quotes/${first.quote.id}/hold`, { method: "DELETE", headers: { Cookie: first.cookie, "Sec-Fetch-Site": "same-origin" } });
  assert.equal(released.status, 204);
  assert.equal((await hold(third, "schedule-hold-test-00004")).status, 201);
});

test("un devis anonyme est idempotent, protégé et reprenable", async () => {
  const pricing = {
    taskCodes: ["MOWING", "HEDGE_TRIMMING"], halfDays: 2,
    lawnSurfaceBand: "FROM_250_TO_500", grassState: "MAINTAINED",
    hedgeLengthM: 18, hedgeHeightBand: "FROM_1_5_TO_2M", hedgeFaces: "THREE_FACES",
    greenWaste: "REMOVE_1_TO_2M3", customerPresence: true, accessType: "CODE",
    nearbyParking: true, vehicleDistanceBand: "UNDER_20M", flexibleOnDay: false,
  };
  const body = JSON.stringify({
    contact: { email: "devis@example.fr", phone: "06 10 20 30 40" },
    request: { step: 6, address: "22 chemin des Consacs, 83170 Brignoles", selected: pricing.taskCodes, priority: pricing.taskCodes, fullName: "Client Devis", duration: 2 },
    pricing,
  });
  const outsideBody = JSON.parse(body);
  outsideBody.request.address = "1 promenade du Soleil, 06500 Menton";
  const outside = await request("/api/quotes", { method: "POST", headers: { "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json", "Idempotency-Key": "quote-outside-area-00001" }, body: JSON.stringify(outsideBody) });
  assert.equal(outside.status, 400);
  assert.match((await outside.json()).fields.address, /dehors de notre zone/u);
  const key = "quote-anonymous-test-0001";
  const created = await request("/api/quotes", { method: "POST", headers: { "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json", "Idempotency-Key": key }, body });
  assert.equal(created.status, 201);
  const { quote } = await created.json();
  assert.match(quote.publicReference, /^SP-DV-/u);
  assert.equal(quote.totalTtcCents, 71700);
  assert.equal(quote.tasks.length, 2);
  const draftCookie = created.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
  assert.match(draftCookie, /^sp_quote_draft=/u);

  const repeated = await request("/api/quotes", { method: "POST", headers: { "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json", "Idempotency-Key": key }, body });
  assert.equal(repeated.status, 201);
  assert.equal((await repeated.json()).quote.id, quote.id);
  const conflicting = await request("/api/quotes", { method: "POST", headers: { "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json", "Idempotency-Key": key }, body: body.replace("Client Devis", "Autre Client") });
  assert.equal(conflicting.status, 409);

  const denied = await request(`/api/quotes/${quote.id}`, { accept: "application/json" });
  assert.equal(denied.status, 404);
  const resumed = await request(`/api/quotes/${quote.id}`, { headers: { Cookie: draftCookie }, accept: "application/json" });
  assert.equal(resumed.status, 200);
  const changed = JSON.parse(body);
  changed.pricing.halfDays = 3;
  changed.request.duration = 3;
  const updated = await request(`/api/quotes/${quote.id}`, { method: "PATCH", headers: { Cookie: draftCookie, "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" }, body: JSON.stringify(changed) });
  assert.equal(updated.status, 200);
  const updatedQuote = (await updated.json()).quote;
  assert.equal(updatedQuote.id, quote.id);
  assert.ok(updatedQuote.totalTtcCents > quote.totalTtcCents);
  const confirmation = await request(`/confirmation?devis=${quote.id}`, { headers: { Cookie: draftCookie } });
  assert.equal(confirmation.status, 200);
  assert.match(await confirmation.text(), /Votre devis est enregistré/u);
  const cancelled = await request(`/api/quotes/${quote.id}`, { method: "DELETE", headers: { Cookie: draftCookie, "Sec-Fetch-Site": "same-origin" } });
  assert.equal(cancelled.status, 204);
  const cancelledQuote = await request(`/api/quotes/${quote.id}`, { headers: { Cookie: draftCookie }, accept: "application/json" });
  assert.equal((await cancelledQuote.json()).quote.status, "CANCELLED");
});

test("un client crée son compte, sa session, son profil et son jardin", async () => {
  const magicResponse = await request("/api/auth/magic-link/request", {
    method: "POST",
    headers: { "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" },
    body: JSON.stringify({ email: "camille@example.fr", fullName: "Camille Jardin", returnTo: "/espace-client" }),
  });
  assert.equal(magicResponse.status, 202);
  const magic = await magicResponse.json();
  const verificationUrl = new URL(magic.previewUrl);
  const verification = await request(`${verificationUrl.pathname}${verificationUrl.search}`);
  assert.equal(verification.status, 303);
  const cookie = verification.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
  assert.match(cookie, /^sp_session=/u);

  const profileResponse = await request("/api/customer/profile", {
    method: "PATCH",
    headers: { Cookie: cookie, "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "Camille Jardinier", phone: "06 12 34 56 78", customerType: "INDIVIDUAL" }),
  });
  assert.equal(profileResponse.status, 200);

  const gardenResponse = await request("/api/customer/gardens", {
    method: "POST",
    headers: { Cookie: cookie, "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" },
    body: JSON.stringify({
      label: "Maison de Brignoles",
      address: { line1: "22 chemin des Consacs", postalCode: "83170", city: "Brignoles" },
      surfaceM2: 850, terrainSlope: "GENTLE", accessWidthCm: 240, hasAnimals: true,
    }),
  });
  assert.equal(gardenResponse.status, 201);
  const garden = (await gardenResponse.json()).garden;
  const outsideGarden = await request("/api/customer/gardens", {
    method: "POST",
    headers: { Cookie: cookie, "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" },
    body: JSON.stringify({ label: "Hors secteur", address: { line1: "1 promenade du Soleil", postalCode: "06500", city: "Menton" }, terrainSlope: "FLAT" }),
  });
  assert.equal(outsideGarden.status, 400);
  assert.equal((await outsideGarden.json()).error, "GARDEN_OUTSIDE_SERVICE_AREA");

  const pricing = {
    taskCodes: ["MOWING"], halfDays: 2,
    lawnSurfaceBand: "FROM_500_TO_1000", grassState: "HIGH",
    hedgeLengthM: 5, hedgeHeightBand: "UNDER_1_5M", hedgeFaces: "TOP",
    greenWaste: "LEAVE_ON_SITE", customerPresence: true, accessType: "OPEN_GATE",
    nearbyParking: true, vehicleDistanceBand: "UNDER_20M", flexibleOnDay: false,
  };
  const quoteResponse = await request("/api/quotes", {
    method: "POST",
    headers: { Cookie: cookie, "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json", "Idempotency-Key": "quote-customer-test-00001" },
    body: JSON.stringify({ contact: { email: "ignored@example.fr" }, gardenId: garden.id, request: { step: 6, address: "22 chemin des Consacs, 83170 Brignoles", selected: ["MOWING"], priority: ["MOWING"], fullName: "Camille Jardinier", duration: 2 }, pricing }),
  });
  assert.equal(quoteResponse.status, 201);
  const customerQuote = (await quoteResponse.json()).quote;
  assert.equal(customerQuote.contactEmail, "camille@example.fr");
  assert.equal(customerQuote.gardenId, garden.id);
  const dashboard = await request("/espace-client", { headers: { Cookie: cookie } });
  assert.equal(dashboard.status, 200);
  const html = await dashboard.text();
  assert.match(html, /Camille Jardinier/u);
  assert.match(html, /Maison de Brignoles/u);
  assert.match(html, new RegExp(customerQuote.publicReference, "u"));
});

test("les métadonnées et les sources ne contiennent plus le starter Sites", async () => {
  const [home, layout, sources] = await Promise.all([
    request("/"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readAppSources(),
    access(new URL("../public/og.png", import.meta.url)),
  ]);
  const html = await home.text();
  assert.match(html, /<html[^>]*lang="fr"/iu);
  assert.match(html, /Sergeant Paysage — Réservez votre jardinier en ligne/u);
  assert.match(layout, /Sergeant Paysage — Réservez votre jardinier en ligne/u);
  for (const [pathname, source] of sources) {
    assert.doesNotMatch(source, /href=["']#["']/u, pathname);
    assert.doesNotMatch(source, /codex-preview|_sites-preview/u, pathname);
  }
  await assert.rejects(access(new URL("../.openai/hosting.json", import.meta.url)));
  await assert.rejects(access(new URL("../vite.config.ts", import.meta.url)));
});
