import { getRuntimeEnvironment, runtimeValue } from "@/config/runtime-environment";
import {
  CUSTOMER_SESSION_TTL_SECONDS,
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
  safeReturnTo,
} from "./security.mjs";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  roles: string[];
  sessionId: string;
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
};

export class AuthConfigurationError extends Error {}
export class AuthDeliveryError extends Error {}
export class InvalidMagicLinkError extends Error {}
export class DisabledAccountError extends Error {}

function getDatabase(): D1Database {
  const env = getRuntimeEnvironment();
  const database = env.DB;
  if (!database) throw new AuthConfigurationError("AUTH_DATABASE_UNAVAILABLE");
  return database;
}

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
    requestUrl.hostname.endsWith(".chatgpt.site");
  if (!allowedHost) throw new AuthConfigurationError("APP_URL_UNAVAILABLE");
  return requestUrl.origin;
}

export async function requestMagicLink(
  request: Request,
  input: { email?: unknown; fullName?: unknown; returnTo?: unknown },
): Promise<MagicLinkRequestResult> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) throw new TypeError("EMAIL_INVALID");

  const fullName = cleanDisplayName(input.fullName);
  if (String(input.fullName ?? "").trim() && !fullName) throw new TypeError("FULL_NAME_INVALID");

  const database = getDatabase();
  const secret = getAuthSecret();
  const returnTo = safeReturnTo(input.returnTo);
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

  const token = randomToken();
  const tokenHash = await hashSecret(`magic:${token}`, secret);
  const tokenId = crypto.randomUUID();
  const notificationId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_SECONDS * 1000).toISOString();
  const magicLink = `${canonicalOrigin(request)}/auth/verifier?token=${encodeURIComponent(token)}`;
  const notificationPayload = JSON.stringify({
    magicLinkRequestId: tokenId,
    expiresInMinutes: MAGIC_LINK_TTL_SECONDS / 60,
  });

  await database.batch([
    database.prepare(`
      INSERT INTO magic_link_tokens
        (id, email_normalized, requested_name, token_hash, purpose, return_to, expires_at, requested_ip_hash)
      VALUES (?, ?, ?, ?, 'SIGN_IN', ?, ?, ?)
    `).bind(tokenId, email, fullName, tokenHash, returnTo, expiresAt, ipHash),
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
      JSON.stringify({ expiresInSeconds: MAGIC_LINK_TTL_SECONDS }),
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
}> {
  if (!/^[A-Za-z0-9_-]{40,180}$/u.test(token)) throw new InvalidMagicLinkError("MAGIC_LINK_INVALID");

  const database = getDatabase();
  const secret = getAuthSecret();
  const tokenHash = await hashSecret(`magic:${token}`, secret);
  const ipHash = await hashSecret(`ip:${getClientIp(request)}`, secret);
  const userAgent = getUserAgent(request);
  const link = await database.prepare(`
    SELECT id, email_normalized AS emailNormalized, requested_name AS requestedName, return_to AS returnTo
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

  const userId = user?.id ?? crypto.randomUUID();
  const fullName = link.requestedName ?? user?.fullName ?? fallbackDisplayName(link.emailNormalized);
  const sessionId = crypto.randomUUID();
  const sessionToken = randomToken();
  const sessionHash = await hashSecret(`session:${sessionToken}`, secret);
  const expiresAt = new Date(Date.now() + CUSTOMER_SESSION_TTL_SECONDS * 1000).toISOString();
  const statements: D1PreparedStatement[] = [
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

  statements.push(
    database.prepare(`
      INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'CUSTOMER')
    `).bind(userId),
    database.prepare(`
      INSERT OR IGNORE INTO customer_profiles (user_id, customer_type) VALUES (?, 'INDIVIDUAL')
    `).bind(userId),
    database.prepare(`
      UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND revoked_at IS NULL AND unixepoch(expires_at) <= unixepoch()
    `).bind(userId),
    database.prepare(`
      INSERT INTO auth_sessions
        (id, user_id, token_hash, kind, expires_at, ip_hash, user_agent)
      VALUES (?, ?, ?, 'CUSTOMER', ?, ?, ?)
    `).bind(sessionId, userId, sessionHash, expiresAt, ipHash, userAgent),
    database.prepare(`
      INSERT INTO audit_events
        (id, actor_user_id, actor_type, action, entity_type, entity_id, ip_hash, metadata_json)
      VALUES (?, ?, 'USER', 'AUTH_SIGN_IN_SUCCEEDED', 'auth_session', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      userId,
      sessionId,
      ipHash,
      JSON.stringify({ method: "MAGIC_LINK", kind: "CUSTOMER" }),
    ),
  );

  let results: D1Result[];
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
    returnTo: safeReturnTo(link.returnTo),
    user: {
      id: userId,
      email: link.emailNormalized,
      fullName,
      phone: user?.phone ?? null,
      roles: ["CUSTOMER"],
      sessionId,
    },
  };
}

export async function getSessionFromCookie(cookieHeader: string | null | undefined): Promise<AuthUser | null> {
  const sessionToken = readCookie(cookieHeader);
  if (!sessionToken || !/^[A-Za-z0-9_-]{40,180}$/u.test(sessionToken)) return null;

  const database = getDatabase();
  const sessionHash = await hashSecret(`session:${sessionToken}`, getAuthSecret());
  const record = await database.prepare(`
    SELECT s.id AS sessionId, u.id AS userId, u.email, u.full_name AS fullName, u.phone,
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
