import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_COOKIE_NAME,
  STAFF_SESSION_TTL_SECONDS,
  cleanDisplayName,
  clearSessionCookie,
  hashSecret,
  isSameOriginRequest,
  isValidEmail,
  normalizeEmail,
  randomToken,
  readCookie,
  safeReturnTo,
  safePortalReturnTo,
  sessionCookie,
} from "../modules/auth/security.mjs";

const secret = "test-secret-sergeant-paysage-authentication-2026";

test("normalise et valide les identités sans accepter d'entrée ambiguë", () => {
  assert.equal(normalizeEmail("  CLIENT@Exemple.FR "), "client@exemple.fr");
  assert.equal(isValidEmail("client@exemple.fr"), true);
  assert.equal(isValidEmail("client@example"), false);
  assert.equal(cleanDisplayName("  Camille   Jardin  "), "Camille Jardin");
  assert.equal(cleanDisplayName("x"), null);
});

test("limite strictement les destinations après connexion", () => {
  assert.equal(safeReturnTo("/espace-client?vue=factures"), "/espace-client?vue=factures");
  assert.equal(safeReturnTo("https://evil.example/vol"), "/espace-client");
  assert.equal(safeReturnTo("//evil.example/vol"), "/espace-client");
  assert.equal(safeReturnTo("/auth/verifier?token=secret"), "/espace-client");
  assert.equal(safeReturnTo("/api/auth/session"), "/espace-client");
  assert.equal(safePortalReturnTo("/admin?vue=planning", "STAFF"), "/admin?vue=planning");
  assert.equal(safePortalReturnTo("/espace-client", "STAFF"), "/admin");
  assert.equal(safePortalReturnTo("/admin", "CUSTOMER"), "/espace-client");
});

test("génère des secrets imprévisibles et ne conserve que leur empreinte", async () => {
  const first = randomToken();
  const second = randomToken();
  assert.match(first, /^[A-Za-z0-9_-]{40,180}$/u);
  assert.notEqual(first, second);
  const firstHash = await hashSecret(`magic:${first}`, secret);
  assert.equal(firstHash, await hashSecret(`magic:${first}`, secret));
  assert.notEqual(firstHash, first);
  assert.match(firstHash, /^[a-f0-9]{64}$/u);
});

test("produit un cookie de session protégé et révocable", () => {
  const cookie = sessionCookie("jeton-test", true);
  assert.match(cookie, new RegExp(`^${AUTH_COOKIE_NAME}=`));
  assert.match(cookie, /HttpOnly/u);
  assert.match(cookie, /SameSite=Lax/u);
  assert.match(cookie, /Secure/u);
  assert.equal(readCookie(`${cookie}; preference=compact`), "jeton-test");
  assert.match(clearSessionCookie(true), /Max-Age=0/u);
  assert.match(sessionCookie("jeton-equipe", true, STAFF_SESSION_TTL_SECONDS), /Max-Age=28800/u);
});

test("refuse les requêtes d'écriture provenant d'une autre origine", () => {
  const sameOrigin = new Request("https://sergeant.example/api/auth/sign-out", {
    method: "POST",
    headers: { Origin: "https://sergeant.example" },
  });
  const crossOrigin = new Request("https://sergeant.example/api/auth/sign-out", {
    method: "POST",
    headers: { Origin: "https://evil.example" },
  });
  assert.equal(isSameOriginRequest(sameOrigin), true);
  assert.equal(isSameOriginRequest(crossOrigin), false);
});
