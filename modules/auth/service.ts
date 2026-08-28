import { runtimeValue } from "@/config/runtime-environment";
import { getDatabase } from "@/db/runtime";
import type { AppDatabase, DatabaseResult, PreparedStatement } from "@/db/database";
import {
  CUSTOMER_SESSION_TTL_SECONDS,
  STAFF_SESSION_TTL_SECONDS,
  MAGIC_LINK_EMAIL_LIMIT,
  MAGIC_LINK_IP_LIMIT,
  MAGIC_LINK_RATE_WINDOW_MINUTES,
  MAGIC_LINK_TTL_SECONDS,
  cleanDisplayName,
  fallbackDisplayName,
  getClientIp,
  getUserAgent,
  hashSecret,
  isValidEmail,
  normalizeEmail,
  randomToken,
  readCookie,
  safePortalReturnTo,
} from "./security.mjs";
import { hasAnyStaffRole } from "@/modules/authorization/policy.mjs";

export type AuthAudience = "CUSTOMER" | "STAFF";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  roles: string[];
  sessionId: string;
  sessionKind: AuthAudience;
};

export type MagicLinkRequestResult = {
  accepted: true;
  previewUrl?: string;
  throttled?: boolean;
};

type MagicLinkRecord = {
  id: string;
  emailNormalized: string;
  requestedName: string | null;
  returnTo: string | null;
  audience: AuthAudience;
};

type UserRecord = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: string;
};

type SessionRecord = {
  sessionId: string;
  userId: string;
  email: string;
  fullName: string;
  phone: string | null;
  roles: string | null;
  kind: AuthAudience;
};

export class AuthConfigurationError extends Error {}
export class AuthDeliveryError extends Error {}
export class InvalidMagicLinkError extends Error {}
export class DisabledAccountError extends Error {}

function getAuthSecret(): string {
  const secret = runtimeValue("AUTH_SECRET");
  if (secret.length < 32) throw new AuthConfigurationError("AUTH_SECRET_UNAVAILABLE");
  return secret;
}

function canonicalOrigin(request: Request): string {
  const configured = runtimeValue("APP_URL");
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
        return url.origin;
      }
    } catch {
      throw new AuthConfigurationError("APP_URL_INVALID");
    }
  }

  const requestUrl = new URL(request.url);
  const allowedHost =
    ["localhost", "127.0.0.1", "[::1]"].includes(requestUrl.hostname) ||
    requestUrl.hostname.endsWith(".vercel.app");
  if (!allowedHost) throw new AuthConfigurationError("APP_URL_UNAVAILABLE");
  return requestUrl.origin;
}

function assertEmailDeliveryAvailable(request: Request): void {
  const requestUrl = new URL(request.url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(requestUrl.hostname);
  const mode = runtimeValue("EMAIL_DELIVERY_MODE") || (local ? "log" : "");
  if (mode === "log" && local) return;
  if (!["test", "live"].includes(mode) || !runtimeValue("RESEND_API_KEY") || !runtimeValue("RESEND_FROM_EMAIL")) {
    throw new AuthDeliveryError("AUTH_EMAIL_UNAVAILABLE");
  }
}

function staffAllowlist(): string[] {
  return [...new Set(runtimeValue("STAFF_ALLOWED_EMAILS").split(",").map((entry) => normalizeEmail(entry)).filter(isValidEmail))];
}

function bootstrapAdminEmails(): string[] {
  return [...new Set([...staffAllowlist(), normalizeEmail(runtimeValue("INITIAL_ADMIN_EMAIL"))].filter(isValidEmail))];
}

async function provisionBootstrapAdmin(database: AppDatabase, email: string, ipHash: string): Promise<void> {
  if (!bootstrapAdminEmails().includes(email)) return;

  const existing = await database.prepare(`
    SELECT id, status FROM users WHERE email_normalized = ? LIMIT 1
  `).bind(email).first<{ id: string; status: string }>();
  if (existing && !["INVITED", "ACTIVE"].includes(existing.status)) return;

  const userId = existing?.id ?? crypto.randomUUID();
  const statements: PreparedStatement[] = [];
  if (!existing) {
    statements.push(database.prepare(`
      INSERT INTO users (id, email, email_normalized, full_name, status)
      VALUES (?, ?, ?, ?, 'INVITED')
    `).bind(userId, email, email, fallbackDisplayName(email)));
  }
  statements.push(
    database.prepare(`
      INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'ADMIN')
    `).bind(userId),
    database.prepare(`
      INSERT INTO audit_events
        (id, actor_type, action, entity_type, entity_id, ip_hash, metadata_json)
      VALUES (?, 'SYSTEM', 'BOOTSTRAP_ADMIN_PROVISIONED', 'user', ?, ?, ?)
    `).bind(crypto.randomUUID(), userId, ipHash, JSON.stringify({ source: "HOSTING_CONFIGURATION" })),
  );
  await database.batch(statements);
}

export async function requestMagicLink(
  request: Request,
  input: { email?: unknown; fullName?: unknown; returnTo?: unknown; audience?: AuthAudience },
): Promise<MagicLinkRequestResult> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) throw new TypeError("EMAIL_INVALID");

  const audience: AuthAudience = input.audience === "STAFF" ? "STAFF" : "CUSTOMER";
  const fullName = audience === "CUSTOMER" ? cleanDisplayName(input.fullName) : null;
  if (audience === "CUSTOMER" && String(input.fullName ?? "").trim() && !fullName) {
    throw new TypeError("FULL_NAME_INVALID");
  }

  const database = getDatabase();
  const secret = getAuthSecret();
  const returnTo = safePortalReturnTo(input.returnTo, audience);
  const ipHash = await hashSecret(`ip:${getClientIp(request)}`, secret);
  const rateWindow = `-${MAGIC_LINK_RATE_WINDOW_MINUTES} minutes`;
  const [emailRate, ipRate] = await Promise.all([
    database.prepare(`
      SELECT COUNT(*) AS count
      FROM magic_link_tokens
      WHERE email_normalized = ? AND datetime(created_at) >= datetime('now', ?)
    `).bind(email, rateWindow).first<{ count: number }>(),
    database.prepare(`
      SELECT COUNT(*) AS count
      FROM magic_link_tokens
      WHERE requested_ip_hash = ? AND datetime(created_at) >= datetime('now', ?)
    `).bind(ipHash, rateWindow).first<{ count: number }>(),
  ]);

  if (Number(emailRate?.count ?? 0) >= MAGIC_LINK_EMAIL_LIMIT || Number(ipRate?.count ?? 0) >= MAGIC_LINK_IP_LIMIT) {
    await database.prepare(`
      INSERT INTO audit_events
        (id, actor_type, action, entity_type, entity_id, ip_hash, metadata_json)
      VALUES (?, 'SYSTEM', 'AUTH_MAGIC_LINK_RATE_LIMITED', 'authentication', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      ipHash.slice(0, 24),
      ipHash,
      JSON.stringify({ windowMinutes: MAGIC_LINK_RATE_WINDOW_MINUTES }),
    ).run();
    return { accepted: true, throttled: true };
  }

  assertEmailDeliveryAvailable(request);

  const allowedStaffEmails = staffAllowlist();
  if (audience === "STAFF") await provisionBootstrapAdmin(database, email, ipHash);

  const existingRoles = await database.prepare(`
    SELECT GROUP_CONCAT(ur.role) AS roles, u.status
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    WHERE u.email_normalized = ?
    GROUP BY u.id
    LIMIT 1
  `).bind(email).first<{ roles: string | null; status: string }>();
  const roleList = existingRoles?.roles?.split(",").filter(Boolean) ?? [];
  const staffAllowed = Boolean(
    existingRoles && ["INVITED", "ACTIVE"].includes(existingRoles.status) && hasAnyStaffRole(roleList)
      && (allowedStaffEmails.length === 0 || allowedStaffEmails.includes(email)),
  );
  if (audience === "STAFF" && !staffAllowed) {
    const deniedId = crypto.randomUUID();
    const deniedHash = await hashSecret(`denied:${randomToken()}`, secret);
    await database.batch([
      database.prepare(`
        INSERT INTO magic_link_tokens
          (id, email_normalized, token_hash, purpose, audience, return_to, expires_at, used_at, requested_ip_hash)
        VALUES (?, ?, ?, 'SIGN_IN', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
      `).bind(deniedId, email, deniedHash, audience, returnTo, ipHash),
      database.prepare(`
        INSERT INTO audit_events
          (id, actor_type, action, entity_type, entity_id, ip_hash, metadata_json)
        VALUES (?, 'SYSTEM', 'AUTH_PORTAL_REQUEST_REJECTED', 'authentication', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        deniedId,
        ipHash,
        JSON.stringify({ audience }),
      ),
    ]);
    return { accepted: true };
  }

  const token = randomToken();
  const tokenHash = await hashSecret(`magic:${token}`, secret);
  const tokenId = crypto.randomUUID();
  const notificationId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_SECONDS * 1000).toISOString();
  const portalQuery = audience === "STAFF" ? "&portail=entreprise" : "";
  const magicLink = `${canonicalOrigin(request)}/auth/verifier?token=${encodeURIComponent(token)}${portalQuery}`;
  const notificationPayload = JSON.stringify({
    magicLinkRequestId: tokenId,
    expiresInMinutes: MAGIC_LINK_TTL_SECONDS / 60,
  });

  await database.batch([
    database.prepare(`
      INSERT INTO magic_link_tokens
        (id, email_normalized, requested_name, token_hash, purpose, audience, return_to, expires_at, requested_ip_hash)
      VALUES (?, ?, ?, ?, 'SIGN_IN', ?, ?, ?, ?)
    `).bind(tokenId, email, fullName, tokenHash, audience, returnTo, expiresAt, ipHash),
    database.prepare(`
      INSERT INTO notification_outbox
        (id, channel, template, template_version, recipient, payload_json, status, idempotency_key)
      VALUES (?, 'EMAIL', 'AUTH_MAGIC_LINK', 1, ?, ?, 'PENDING', ?)
    `).bind(notificationId, email, notificationPayload, `auth-magic-link:${tokenId}`),
    database.prepare(`
      INSERT INTO audit_events
        (id, actor_type, action, entity_type, entity_id, ip_hash, metadata_json)
      VALUES (?, 'SYSTEM', 'AUTH_MAGIC_LINK_REQUESTED', 'magic_link', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      tokenId,
      ipHash,
      JSON.stringify({ expiresInSeconds: MAGIC_LINK_TTL_SECONDS, audience }),
    ),
  ]);

  try {
    const delivery = await deliverMagicLink(request, { email, fullName, magicLink, tokenId });
    await database.prepare(`
      UPDATE notification_outbox
      SET status = 'SENT', attempts = attempts + 1, provider_reference = ?, sent_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP, last_error_safe = NULL
      WHERE id = ?
    `).bind(delivery.providerReference, notificationId).run();
    return { accepted: true, previewUrl: delivery.previewUrl };
  } catch (error) {
    await database.batch([
      database.prepare(`
        UPDATE notification_outbox
        SET status = 'FAILED', attempts = attempts + 1, last_error_safe = 'Service email indisponible',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(notificationId),
      database.prepare(`
        UPDATE magic_link_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ? AND used_at IS NULL
      `).bind(tokenId),
    ]);
    if (error instanceof AuthDeliveryError) throw error;
    throw new AuthDeliveryError("AUTH_EMAIL_DELIVERY_FAILED");
  }
}

export async function verifyMagicLink(request: Request, token: string): Promise<{
  token: string;
  returnTo: string;
  user: AuthUser;
  maxAgeSeconds: number;
}> {
  if (!/^[A-Za-z0-9_-]{40,180}$/u.test(token)) throw new InvalidMagicLinkError("MAGIC_LINK_INVALID");

  const database = getDatabase();
  const secret = getAuthSecret();
  const tokenHash = await hashSecret(`magic:${token}`, secret);
  const ipHash = await hashSecret(`ip:${getClientIp(request)}`, secret);
  const userAgent = getUserAgent(request);
  const link = await database.prepare(`
    SELECT id, email_normalized AS emailNormalized, requested_name AS requestedName,
           return_to AS returnTo, audience
    FROM magic_link_tokens
    WHERE token_hash = ? AND purpose = 'SIGN_IN' AND used_at IS NULL
      AND unixepoch(expires_at) > unixepoch()
    LIMIT 1
  `).bind(tokenHash).first<MagicLinkRecord>();
  if (!link) throw new InvalidMagicLinkError("MAGIC_LINK_INVALID_OR_EXPIRED");

  let user = await database.prepare(`
    SELECT id, email, full_name AS fullName, phone, status
    FROM users WHERE email_normalized = ? LIMIT 1
  `).bind(link.emailNormalized).first<UserRecord>();

  if (user && ["SUSPENDED", "ARCHIVED"].includes(user.status)) {
    throw new DisabledAccountError("ACCOUNT_DISABLED");
  }

  const storedRoles = user
    ? await database.prepare(`SELECT role FROM user_roles WHERE user_id = ? ORDER BY role`).bind(user.id).all<{ role: string }>()
    : { results: [] as Array<{ role: string }> };
  const existingRoles = storedRoles.results.map(({ role }) => role);
  if (link.audience === "STAFF" && (!user || !hasAnyStaffRole(existingRoles))) {
    throw new InvalidMagicLinkError("STAFF_ACCESS_NOT_INVITED");
  }
  const userId = user?.id ?? crypto.randomUUID();
  const fullName = link.requestedName ?? user?.fullName ?? fallbackDisplayName(link.emailNormalized);
  const sessionKind = link.audience;
  const roles = user ? [...existingRoles] : ["CUSTOMER"];
  if (sessionKind === "CUSTOMER" && !roles.includes("CUSTOMER")) roles.push("CUSTOMER");
  const sessionId = crypto.randomUUID();
  const sessionToken = randomToken();
  const sessionHash = await hashSecret(`session:${sessionToken}`, secret);
  const maxAgeSeconds = sessionKind === "STAFF" ? STAFF_SESSION_TTL_SECONDS : CUSTOMER_SESSION_TTL_SECONDS;
  const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000).toISOString();
  const statements: PreparedStatement[] = [
    database.prepare(`
      UPDATE magic_link_tokens SET used_at = CURRENT_TIMESTAMP
      WHERE id = ? AND used_at IS NULL AND unixepoch(expires_at) > unixepoch()
    `).bind(link.id),
  ];

  if (user) {
    statements.push(database.prepare(`
      UPDATE users
      SET email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP), full_name = ?,
          status = 'ACTIVE', last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status IN ('INVITED', 'ACTIVE')
    `).bind(fullName, userId));
  } else {
    statements.push(database.prepare(`
      INSERT INTO users
        (id, email, email_normalized, email_verified_at, full_name, status, last_login_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, 'ACTIVE', CURRENT_TIMESTAMP)
    `).bind(userId, link.emailNormalized, link.emailNormalized, fullName));
  }

  if (sessionKind === "CUSTOMER") {
    statements.push(
      database.prepare(`
        INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'CUSTOMER')
      `).bind(userId),
      database.prepare(`
        INSERT OR IGNORE INTO customer_profiles (user_id, customer_type) VALUES (?, 'INDIVIDUAL')
      `).bind(userId),
    );
  }

  statements.push(
    database.prepare(`
      UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND revoked_at IS NULL AND unixepoch(expires_at) <= unixepoch()
    `).bind(userId),
    database.prepare(`
      INSERT INTO auth_sessions
        (id, user_id, token_hash, kind, expires_at, ip_hash, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(sessionId, userId, sessionHash, sessionKind, expiresAt, ipHash, userAgent),
    database.prepare(`
      INSERT INTO audit_events
        (id, actor_user_id, actor_type, action, entity_type, entity_id, ip_hash, metadata_json)
      VALUES (?, ?, 'USER', 'AUTH_SIGN_IN_SUCCEEDED', 'auth_session', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      userId,
      sessionId,
      ipHash,
      JSON.stringify({ method: "MAGIC_LINK", kind: sessionKind }),
    ),
  );

  let results: DatabaseResult[];
  try {
    results = await database.batch(statements);
  } catch (error) {
    if (!user) {
      user = await database.prepare(`
        SELECT id, email, full_name AS fullName, phone, status
        FROM users WHERE email_normalized = ? LIMIT 1
      `).bind(link.emailNormalized).first<UserRecord>();
    }
    if (!user) throw error;
    throw new InvalidMagicLinkError("MAGIC_LINK_CONCURRENT_USE");
  }

  if (Number(results[0]?.meta?.changes ?? 0) !== 1) {
    throw new InvalidMagicLinkError("MAGIC_LINK_ALREADY_USED");
  }

  return {
    token: sessionToken,
    returnTo: safePortalReturnTo(link.returnTo, sessionKind),
    maxAgeSeconds,
    user: {
      id: userId,
      email: link.emailNormalized,
      fullName,
      phone: user?.phone ?? null,
      roles,
      sessionId,
      sessionKind,
    },
  };
}

export async function getSessionFromCookie(cookieHeader: string | null | undefined): Promise<AuthUser | null> {
  const sessionToken = readCookie(cookieHeader);
  if (!sessionToken || !/^[A-Za-z0-9_-]{40,180}$/u.test(sessionToken)) return null;

  const database = getDatabase();
  const sessionHash = await hashSecret(`session:${sessionToken}`, getAuthSecret());
  const record = await database.prepare(`
    SELECT s.id AS sessionId, s.kind, u.id AS userId, u.email, u.full_name AS fullName, u.phone,
           GROUP_CONCAT(ur.role) AS roles
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND unixepoch(s.expires_at) > unixepoch()
      AND u.status = 'ACTIVE'
    GROUP BY s.id, u.id
    LIMIT 1
  `).bind(sessionHash).first<SessionRecord>();
  if (!record) return null;

  await database.prepare(`
    UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP
    WHERE id = ? AND datetime(last_seen_at) < datetime('now', '-15 minutes')
  `).bind(record.sessionId).run();

  return {
    id: record.userId,
    email: record.email,
    fullName: record.fullName,
    phone: record.phone,
    roles: record.roles?.split(",").filter(Boolean) ?? [],
    sessionId: record.sessionId,
    sessionKind: record.kind,
  };
}

export async function revokeSession(cookieHeader: string | null | undefined): Promise<void> {
  const sessionToken = readCookie(cookieHeader);
  if (!sessionToken || !/^[A-Za-z0-9_-]{40,180}$/u.test(sessionToken)) return;
  const database = getDatabase();
  const sessionHash = await hashSecret(`session:${sessionToken}`, getAuthSecret());
  const session = await database.prepare(`
    SELECT id, user_id AS userId FROM auth_sessions WHERE token_hash = ? AND revoked_at IS NULL LIMIT 1
  `).bind(sessionHash).first<{ id: string; userId: string }>();
  if (!session) return;

  await database.batch([
    database.prepare(`
      UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL
    `).bind(session.id),
    database.prepare(`
      INSERT INTO audit_events
        (id, actor_user_id, actor_type, action, entity_type, entity_id)
      VALUES (?, ?, 'USER', 'AUTH_SIGN_OUT', 'auth_session', ?)
    `).bind(crypto.randomUUID(), session.userId, session.id),
  ]);
}

async function deliverMagicLink(
  request: Request,
  input: { email: string; fullName: string | null; magicLink: string; tokenId: string },
): Promise<{ providerReference: string; previewUrl?: string }> {
  const requestUrl = new URL(request.url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(requestUrl.hostname);
  const mode = runtimeValue("EMAIL_DELIVERY_MODE") || (local ? "log" : "");
  if (mode === "log" && local) {
    return { providerReference: `local:${input.tokenId}`, previewUrl: input.magicLink };
  }

  const apiKey = runtimeValue("RESEND_API_KEY");
  const from = runtimeValue("RESEND_FROM_EMAIL");
  if (!apiKey || !from || !["test", "live"].includes(mode)) {
    throw new AuthDeliveryError("AUTH_EMAIL_UNAVAILABLE");
  }

  const greeting = input.fullName ? `Bonjour ${escapeHtml(input.fullName)},` : "Bonjour,";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `auth-magic-link:${input.tokenId}`,
    },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: "Votre lien de connexion SERGEANT PAYSAGE",
      text: `Votre lien de connexion, valable 10 minutes : ${input.magicLink}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
      html: `<p>${greeting}</p><p>Utilisez le bouton ci-dessous pour accéder à votre espace SERGEANT PAYSAGE. Ce lien est valable 10 minutes et ne peut être utilisé qu'une fois.</p><p><a href="${escapeHtml(input.magicLink)}">Accéder à mon espace</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
    }),
  });

  if (!response.ok) throw new AuthDeliveryError("AUTH_EMAIL_PROVIDER_REJECTED");
  const payload = await response.json().catch(() => ({})) as { id?: string };
  return { providerReference: payload.id ?? `resend:${input.tokenId}` };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}
