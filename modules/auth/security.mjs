const encoder = new TextEncoder();

export const AUTH_COOKIE_NAME = "sp_session";
export const MAGIC_LINK_TTL_SECONDS = 10 * 60;
export const CUSTOMER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const STAFF_SESSION_TTL_SECONDS = 8 * 60 * 60;
export const MAGIC_LINK_EMAIL_LIMIT = 3;
export const MAGIC_LINK_IP_LIMIT = 12;
export const MAGIC_LINK_RATE_WINDOW_MINUTES = 15;

export function normalizeEmail(value) {
  return String(value ?? "").trim().normalize("NFKC").toLowerCase();
}

export function isValidEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

export function cleanDisplayName(value) {
  const name = String(value ?? "")
    .normalize("NFKC")
    .split("")
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127 ? " " : character;
    })
    .join("")
    .replace(/\s+/gu, " ")
    .trim();
  if (!name) return null;
  return name.length >= 2 && name.length <= 120 ? name : null;
}

export function fallbackDisplayName(email) {
  const localPart = email.split("@", 1)[0] ?? "Client";
  const readable = localPart.replace(/[._+-]+/gu, " ").replace(/\s+/gu, " ").trim();
  if (!readable) return "Client SERGEANT PAYSAGE";
  return readable.slice(0, 120).replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase());
}

export function safeReturnTo(value, fallback = "/espace-client") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
  let url;
  try {
    url = new URL(value, "https://sergeant-paysage.local");
  } catch {
    return fallback;
  }
  if (url.origin !== "https://sergeant-paysage.local") return fallback;
  if (
    url.pathname === "/connexion" ||
    url.pathname === "/auth/verifier" ||
    url.pathname.startsWith("/api/auth/")
  ) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function safePortalReturnTo(value, audience = "CUSTOMER") {
  const fallback = audience === "STAFF" ? "/admin" : "/espace-client";
  const returnTo = safeReturnTo(value, fallback);
  const pathname = new URL(returnTo, "https://sergeant-paysage.local").pathname;
  if (audience === "STAFF") {
    return pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/terrain" || pathname.startsWith("/terrain/")
      ? returnTo
      : fallback;
  }
  return pathname === "/espace-client" || pathname.startsWith("/espace-client/")
    ? returnTo
    : fallback;
}

export function isSameOriginRequest(request) {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin) return origin === requestOrigin;
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === requestOrigin;
    } catch {
      return false;
    }
  }
  return ["same-origin", "none"].includes(request.headers.get("sec-fetch-site") ?? "");
}

export function getClientIp(request) {
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return cloudflareIp;
  return request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || "unknown";
}

export function getUserAgent(request) {
  return (request.headers.get("user-agent") ?? "unknown").slice(0, 512);
}

export function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function hashSecret(value, secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("AUTH_SECRET_INVALID");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function readCookie(cookieHeader, name = AUTH_COOKIE_NAME) {
  for (const pair of String(cookieHeader ?? "").split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(pair.slice(separator + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function sessionCookie(token, secure = true, maxAgeSeconds = CUSTOMER_SESSION_TTL_SECONDS) {
  return [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : null,
    `Max-Age=${maxAgeSeconds}`,
  ].filter(Boolean).join("; ");
}

export function clearSessionCookie(secure = true) {
  return [
    `${AUTH_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : null,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ].filter(Boolean).join("; ");
}

export function isSecureRequest(request) {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  return forwarded ? forwarded === "https" : new URL(request.url).protocol === "https:";
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/gu, "");
}
