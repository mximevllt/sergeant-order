import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);
const appRoot = new URL("../app/", import.meta.url);
const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const workerPromise = import(workerUrl.href).then(({ default: worker }) => worker);

async function render(pathname, options = {}) {
  const worker = await workerPromise;
  return worker.fetch(
    new Request(new URL(pathname, options.origin ?? "http://localhost"), {
      headers: { accept: options.accept ?? "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      ...options.bindings,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function readAppSources(directory = appRoot) {
  const entries = await readdir(directory, { withFileTypes: true });
  const sources = [];

  for (const entry of entries) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) {
      sources.push(...await readAppSources(url));
    } else if (entry.name.endsWith(".tsx")) {
      sources.push([url.pathname, await readFile(url, "utf8")]);
    }
  }

  return sources;
}

test("reports environment health without exposing configuration values", async () => {
  const localResponse = await render("/api/health", { accept: "application/json" });
  assert.equal(localResponse.status, 200);
  assert.deepEqual(await localResponse.json(), {
    status: "ok",
    environment: "development",
    configuration: "ok",
  });

  const remoteResponse = await render("/api/health", {
    origin: "https://production.sergeant-paysage.fr",
    accept: "application/json",
  });
  assert.equal(remoteResponse.status, 503);
  assert.deepEqual(await remoteResponse.json(), {
    status: "misconfigured",
    environment: "development",
    configuration: "error",
  });
});

test("server-renders the current product routes", async () => {
  const routes = [
    ["/", /Votre jardin entretenu/, /Les services/],
    ["/reserver", /Étape/, /Que souhaitez-vous faire/],
    ["/espace-client", /Bonjour Maxime/, /Mes interventions/],
    ["/admin", /Planning/, /Nouvelle intervention/],
    ["/tarifs", /Des prix simples/, /Votre estimation/],
  ];

  for (const [pathname, firstExpected, secondExpected] of routes) {
    const response = await render(pathname);
    assert.equal(response.status, 200, `${pathname} should respond successfully`);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

    const html = await response.text();
    assert.match(html, firstExpected);
    assert.match(html, secondExpected);
    assert.doesNotMatch(html, /Your site is taking shape|Building your site|codex-preview/i);
  }
});

test("ships Sergeant Paysage metadata and social preview", async () => {
  const [response, layout] = await Promise.all([
    render("/"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    access(new URL("../public/og.png", import.meta.url)),
  ]);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="fr"/i);
  assert.match(html, /<title>Sergeant Paysage — Réservez votre jardinier en ligne<\/title>/i);
  assert.match(html, /og\.png/i);
  assert.match(layout, /Sergeant Paysage — Réservez votre jardinier en ligne/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/);
});

test("keeps application sources free of starter and dead-link remnants", async () => {
  const sources = await readAppSources();

  for (const [pathname, source] of sources) {
    assert.doesNotMatch(source, /<img\b/, `${pathname} should use the image component`);
    assert.doesNotMatch(source, /href=["']#["']/, `${pathname} should not contain dead links`);
    assert.doesNotMatch(source, /SkeletonPreview|codex-preview/, `${pathname} should not contain starter code`);
  }

  await assert.rejects(access(new URL("../app/_sites-preview/", import.meta.url)));
  await assert.rejects(access(new URL("../public/_sites-preview/", projectRoot)));
});
