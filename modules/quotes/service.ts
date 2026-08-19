import { getDatabase } from "@/db/runtime";
import type { AppDatabase, PreparedStatement } from "@/db/database";
import type { AuthUser } from "@/modules/auth/service";
import { cleanDisplayName, isValidEmail, normalizeEmail } from "@/modules/auth/security.mjs";
import { estimatePrice, normalizePricingInput, type Estimate } from "@/modules/pricing/service";
import type { PricingInput, PriceLine } from "@/modules/pricing/engine";

const QUOTE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const QUOTE_ID = /^[a-f0-9-]{20,50}$/iu;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,100}$/u;

export type QuoteStatus = "DRAFT" | "PRICED" | "SLOT_HELD" | "ACCEPTED" | "EXPIRED" | "CANCELLED";

export type QuoteView = {
  id: string;
  publicReference: string;
  status: QuoteStatus;
  contactEmail: string;
  contactPhone: string | null;
  gardenId: string | null;
  organizationId: string | null;
  requestSnapshot: Record<string, unknown>;
  pricingSnapshot: Record<string, unknown>;
  recommendedHalfDays: number;
  selectedHalfDays: number;
  subtotalHtCents: number;
  vatCents: number;
  totalTtcCents: number;
  eligibleSapCents: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  tasks: Array<{ code: string; label: string; priority: number; measurement: Record<string, unknown>; priceImpactTtcCents: number }>;
};

export class QuoteInputError extends Error {
  constructor(public fields: Record<string, string>) { super("QUOTE_INPUT_INVALID"); }
}
export class QuoteNotFoundError extends Error {}
export class QuoteAccessError extends Error {}
export class QuoteConflictError extends Error {}
export class QuoteExpiredError extends Error {}

type QuoteRecord = Record<string, unknown> & {
  id: string;
  customerUserId: string | null;
  contactEmail: string;
  status: QuoteStatus;
  expiresAt: string;
};

type PreparedQuote = {
  contactEmail: string;
  contactPhone: string | null;
  requestSnapshot: Record<string, unknown>;
  pricingInput: PricingInput;
  estimate: Estimate;
  totalTtcCents: number;
  subtotalHtCents: number;
  vatCents: number;
  eligibleSapCents: number;
  taskRows: Array<{ id: string; code: string; label: string; eligibleSap: boolean }>;
  priority: string[];
  gardenId: string | null;
  organizationId: string | null;
};

function text(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.normalize("NFKC").trim().slice(0, maximum) : "";
}

function parseJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function fingerprint(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableJson(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function quoteReference(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `SP-DV-${date}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

function requestSnapshot(value: unknown, pricingInput: PricingInput): Record<string, unknown> {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const selected = Array.isArray(raw.selected) ? raw.selected.filter((item): item is string => typeof item === "string" && pricingInput.taskCodes.includes(item)) : pricingInput.taskCodes;
  const priorityRaw = Array.isArray(raw.priority) ? raw.priority.filter((item): item is string => typeof item === "string" && selected.includes(item)) : [];
  const priority = [...new Set([...priorityRaw, ...selected])];
  const step = Math.min(6, Math.max(1, Math.round(Number(raw.step) || 1)));
  return {
    schemaVersion: 1,
    clientRevision: Math.max(0, Math.round(Number(raw.clientRevision) || Date.now())),
    step,
    address: text(raw.address, 250),
    selected,
    priority,
    unknownNeed: raw.unknownNeed === true,
    unknownDescription: text(raw.unknownDescription, 1500),
    lawnSurface: text(raw.lawnSurface, 40),
    grass: text(raw.grass, 40),
    terrain: text(raw.terrain, 60),
    hedgeLength: pricingInput.hedgeLengthM,
    hedgeHeight: text(raw.hedgeHeight, 40),
    hedgeFaces: text(raw.hedgeFaces, 40),
    duration: pricingInput.halfDays,
    waste: text(raw.waste, 30),
    scheduleMode: text(raw.scheduleMode, 20),
    date: text(raw.date, 40),
    customDate: text(raw.customDate, 20),
    slot: text(raw.slot, 40),
    flexible: pricingInput.flexibleOnDay,
    access: text(raw.access, 80),
    accessType: text(raw.accessType, 50),
    parking: text(raw.parking, 20),
    distance: text(raw.distance, 30),
    passageWidth: text(raw.passageWidth, 30),
    animal: raw.animal === true,
    notes: text(raw.notes, 500),
    fullName: cleanDisplayName(raw.fullName),
    pricingInput,
  };
}

async function prepareQuote(value: unknown, actor: AuthUser | null): Promise<PreparedQuote> {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const pricingInput = normalizePricingInput(raw.pricing);
  const fields: Record<string, string> = {};
  if (!pricingInput.taskCodes.length) fields.selected = "Sélectionnez au moins une prestation.";
  const contact = raw.contact && typeof raw.contact === "object" ? raw.contact as Record<string, unknown> : {};
  const contactEmail = actor?.sessionKind === "CUSTOMER" ? actor.email : normalizeEmail(contact.email);
  if (!isValidEmail(contactEmail)) fields.email = "Saisissez une adresse email valide pour enregistrer le devis.";
  const contactPhone = text(contact.phone, 40) || actor?.phone || null;
  if (contactPhone && !/^[+\d][\d .()-]{7,39}$/u.test(contactPhone)) fields.phone = "Saisissez un numéro de téléphone valide.";
  const requestedGardenId = text(raw.gardenId, 60) || null;
  let gardenId: string | null = null;
  let organizationId: string | null = null;
  if (requestedGardenId) {
    if (actor?.sessionKind !== "CUSTOMER") fields.gardenId = "Connectez-vous pour utiliser un jardin enregistré.";
    else {
      const garden = await getDatabase().prepare(`
        SELECT g.id, g.organization_id AS organizationId
        FROM gardens g
        LEFT JOIN organization_memberships om ON om.organization_id = g.organization_id AND om.user_id = ?
        WHERE g.id = ? AND g.archived_at IS NULL AND (g.owner_user_id = ? OR om.user_id = ?)
        LIMIT 1
      `).bind(actor.id, requestedGardenId, actor.id, actor.id).first<{ id: string; organizationId: string | null }>();
      if (!garden) fields.gardenId = "Ce jardin n’est pas accessible depuis votre compte.";
      else { gardenId = garden.id; organizationId = garden.organizationId; }
    }
  } else if (actor?.sessionKind === "CUSTOMER") {
    const membership = await getDatabase().prepare(`
      SELECT om.organization_id AS organizationId
      FROM organization_memberships om
      JOIN organizations o ON o.id = om.organization_id AND o.status = 'ACTIVE'
      WHERE om.user_id = ? ORDER BY om.created_at LIMIT 1
    `).bind(actor.id).first<{ organizationId: string }>();
    organizationId = membership?.organizationId ?? null;
  }
  if (Object.keys(fields).length) throw new QuoteInputError(fields);

  const estimate = await estimatePrice(pricingInput);
  const totalTtcCents = estimate.lines.reduce((sum, line) => sum + line.amountTtcCents, 0);
  const vatCents = Math.round(totalTtcCents * estimate.pricingVersion.vatRateBasisPoints / (10_000 + estimate.pricingVersion.vatRateBasisPoints));
  const subtotalHtCents = totalTtcCents - vatCents;
  const placeholders = pricingInput.taskCodes.map(() => "?").join(",");
  const taskRows = (await getDatabase().prepare(`
    SELECT id, code, label, eligible_sap AS eligibleSap
    FROM catalog_tasks WHERE active = 1 AND code IN (${placeholders})
  `).bind(...pricingInput.taskCodes).all<Record<string, unknown>>()).results.map((row) => ({
    id: String(row.id), code: String(row.code), label: String(row.label), eligibleSap: Boolean(row.eligibleSap),
  }));
  if (taskRows.length !== pricingInput.taskCodes.length) throw new QuoteInputError({ selected: "Une prestation n’est plus disponible." });
  const snapshot = requestSnapshot(raw.request, pricingInput);
  return {
    contactEmail,
    contactPhone,
    requestSnapshot: snapshot,
    pricingInput,
    estimate,
    totalTtcCents,
    subtotalHtCents,
    vatCents,
    eligibleSapCents: taskRows.every(({ eligibleSap }) => eligibleSap) ? totalTtcCents : 0,
    taskRows,
    priority: snapshot.priority as string[],
    gardenId,
    organizationId,
  };
}

function measurement(code: string, input: PricingInput, snapshot: Record<string, unknown>): Record<string, unknown> {
  if (code === "MOWING") return { surfaceBand: input.lawnSurfaceBand, grassState: input.grassState, terrain: snapshot.terrain };
  if (code === "HEDGE_TRIMMING") return { lengthM: input.hedgeLengthM, heightBand: input.hedgeHeightBand, faces: input.hedgeFaces };
  return { selected: true };
}

function taskImpact(code: string, lines: PriceLine[]): number {
  const related: Record<string, string[]> = {
    MOWING: ["GRASS_HIGH", "GRASS_VERY_HIGH"],
    HEDGE_TRIMMING: ["HEDGE_LENGTH_OVER_5M", "HEDGE_FACES", "HEDGE_HEIGHT"],
  };
  return lines.filter((line) => related[code]?.includes(line.code)).reduce((sum, line) => sum + line.amountTtcCents, 0);
}

function taskStatements(database: AppDatabase, quoteId: string, prepared: PreparedQuote): PreparedStatement[] {
  return prepared.taskRows.map((task) => database.prepare(`
    INSERT INTO quote_tasks
      (id, quote_id, catalog_task_id, code_snapshot, label_snapshot, priority, measurement_json, price_impact_ttc_cents)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(), quoteId, task.id, task.code, task.label,
    Math.max(0, prepared.priority.indexOf(task.code)),
    JSON.stringify(measurement(task.code, prepared.pricingInput, prepared.requestSnapshot)),
    taskImpact(task.code, prepared.estimate.lines),
  ));
}

function adjustmentStatements(database: AppDatabase, quoteId: string, prepared: PreparedQuote): PreparedStatement[] {
  return prepared.estimate.lines.map((line, index) => database.prepare(`
    INSERT INTO quote_adjustments
      (id, quote_id, code, label, kind, amount_ttc_cents, calculation_snapshot, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(), quoteId, line.code, line.label,
    line.amountTtcCents < 0 ? "DISCOUNT" : line.category === "intervention" ? "BASE" : "SURCHARGE",
    line.amountTtcCents,
    JSON.stringify({ category: line.category, pricingVersion: prepared.estimate.pricingVersion.version }),
    index,
  ));
}

function pricingSnapshot(prepared: PreparedQuote): Record<string, unknown> {
  return {
    pricingVersion: prepared.estimate.pricingVersion,
    input: prepared.pricingInput,
    lines: prepared.estimate.lines,
    totals: prepared.estimate.totals,
    warnings: prepared.estimate.warnings,
    calculatedAt: new Date().toISOString(),
  };
}

async function recordToView(database: AppDatabase, row: Record<string, unknown>): Promise<QuoteView> {
  const tasks = await database.prepare(`
    SELECT code_snapshot AS code, label_snapshot AS label, priority,
           measurement_json AS measurement, price_impact_ttc_cents AS priceImpactTtcCents
    FROM quote_tasks WHERE quote_id = ? ORDER BY priority, code_snapshot
  `).bind(String(row.id)).all<Record<string, unknown>>();
  return {
    id: String(row.id), publicReference: String(row.publicReference), status: String(row.status) as QuoteStatus,
    contactEmail: String(row.contactEmail), contactPhone: row.contactPhone ? String(row.contactPhone) : null,
    gardenId: row.gardenId ? String(row.gardenId) : null,
    organizationId: row.organizationId ? String(row.organizationId) : null,
    requestSnapshot: parseJson(row.requestSnapshot), pricingSnapshot: parseJson(row.pricingSnapshot),
    recommendedHalfDays: Number(row.recommendedHalfDays), selectedHalfDays: Number(row.selectedHalfDays),
    subtotalHtCents: Number(row.subtotalHtCents), vatCents: Number(row.vatCents), totalTtcCents: Number(row.totalTtcCents),
    eligibleSapCents: Number(row.eligibleSapCents), expiresAt: String(row.expiresAt),
    createdAt: String(row.createdAt), updatedAt: String(row.updatedAt),
    tasks: tasks.results.map((task) => ({
      code: String(task.code), label: String(task.label), priority: Number(task.priority),
      measurement: parseJson(task.measurement), priceImpactTtcCents: Number(task.priceImpactTtcCents),
    })),
  };
}

async function quoteRow(database: AppDatabase, quoteId: string): Promise<QuoteRecord | null> {
  if (!QUOTE_ID.test(quoteId)) return null;
  return database.prepare(`
    SELECT id, public_reference AS publicReference, customer_user_id AS customerUserId,
           organization_id AS organizationId, garden_id AS gardenId,
           status, contact_email AS contactEmail, contact_phone AS contactPhone,
           request_snapshot AS requestSnapshot, pricing_snapshot AS pricingSnapshot,
           recommended_half_days AS recommendedHalfDays, selected_half_days AS selectedHalfDays,
           subtotal_ht_cents AS subtotalHtCents, vat_cents AS vatCents, total_ttc_cents AS totalTtcCents,
           eligible_sap_cents AS eligibleSapCents, expires_at AS expiresAt,
           created_at AS createdAt, updated_at AS updatedAt
    FROM quotes WHERE id = ? LIMIT 1
  `).bind(quoteId).first<QuoteRecord>();
}

async function accessibleRow(database: AppDatabase, quoteId: string, actor: AuthUser | null, provenDraftId: string | null): Promise<QuoteRecord> {
  const row = await quoteRow(database, quoteId);
  if (!row) throw new QuoteNotFoundError("QUOTE_NOT_FOUND");
  const owns = actor?.sessionKind === "CUSTOMER" && row.customerUserId === actor.id;
  const proven = provenDraftId === row.id;
  if (!owns && !proven) throw new QuoteAccessError("QUOTE_ACCESS_DENIED");
  if (!row.customerUserId && proven && actor?.sessionKind === "CUSTOMER" && normalizeEmail(row.contactEmail) === actor.email) {
    await database.prepare(`UPDATE quotes SET customer_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND customer_user_id IS NULL`).bind(actor.id, row.id).run();
    row.customerUserId = actor.id;
  }
  if (["DRAFT", "PRICED"].includes(row.status) && Date.parse(row.expiresAt) <= Date.now()) {
    await database.prepare(`UPDATE quotes SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('DRAFT', 'PRICED')`).bind(row.id).run();
    row.status = "EXPIRED";
  }
  return row;
}

export async function createQuote(value: unknown, actor: AuthUser | null, idempotencyKey: string): Promise<QuoteView> {
  if (!IDEMPOTENCY_KEY.test(idempotencyKey)) throw new QuoteInputError({ idempotencyKey: "Clé de requête invalide." });
  const prepared = await prepareQuote(value, actor);
  const database = getDatabase();
  const requestHash = await fingerprint({ value, actor: actor?.id ?? prepared.contactEmail });
  const existing = await database.prepare(`
    SELECT request_hash AS requestHash, resource_id AS resourceId
    FROM idempotency_keys WHERE scope = 'QUOTE_CREATE' AND key = ? AND status = 'COMPLETED' LIMIT 1
  `).bind(idempotencyKey).first<{ requestHash: string; resourceId: string | null }>();
  if (existing) {
    if (existing.requestHash !== requestHash) throw new QuoteConflictError("IDEMPOTENCY_KEY_REUSED");
    const row = existing.resourceId ? await quoteRow(database, existing.resourceId) : null;
    if (!row || (row.customerUserId && row.customerUserId !== actor?.id) || (!row.customerUserId && normalizeEmail(row.contactEmail) !== prepared.contactEmail)) {
      throw new QuoteConflictError("IDEMPOTENCY_RESOURCE_UNAVAILABLE");
    }
    return recordToView(database, row);
  }

  const quoteId = crypto.randomUUID();
  const reference = quoteReference();
  const expiresAt = new Date(Date.now() + QUOTE_TTL_MS).toISOString();
  const priceSnapshot = pricingSnapshot(prepared);
  const priceFingerprint = await fingerprint({ quoteId, request: prepared.requestSnapshot, pricing: priceSnapshot });
  const statements: PreparedStatement[] = [
    database.prepare(`
      INSERT INTO quotes
        (id, public_reference, customer_user_id, organization_id, garden_id, pricing_version_id, status, contact_email, contact_phone,
         request_snapshot, pricing_snapshot, pricing_fingerprint, recommended_half_days, selected_half_days,
         subtotal_ht_cents, vat_cents, total_ttc_cents, eligible_sap_cents, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, 'PRICED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      quoteId, reference, actor?.sessionKind === "CUSTOMER" ? actor.id : null,
      prepared.organizationId, prepared.gardenId, prepared.estimate.pricingVersion.id, prepared.contactEmail, prepared.contactPhone,
      JSON.stringify(prepared.requestSnapshot), JSON.stringify(priceSnapshot), priceFingerprint,
      prepared.estimate.recommendedHalfDays, prepared.pricingInput.halfDays,
      prepared.subtotalHtCents, prepared.vatCents, prepared.totalTtcCents, prepared.eligibleSapCents, expiresAt,
    ),
    ...taskStatements(database, quoteId, prepared),
    ...adjustmentStatements(database, quoteId, prepared),
    database.prepare(`
      INSERT INTO idempotency_keys
        (id, scope, key, request_hash, status, response_status, response_body_json, resource_type, resource_id, expires_at)
      VALUES (?, 'QUOTE_CREATE', ?, ?, 'COMPLETED', 201, ?, 'quote', ?, ?)
    `).bind(crypto.randomUUID(), idempotencyKey, requestHash, JSON.stringify({ id: quoteId, publicReference: reference }), quoteId, expiresAt),
    database.prepare(`
      INSERT INTO audit_events (id, actor_user_id, actor_type, action, entity_type, entity_id, metadata_json)
      VALUES (?, ?, ?, 'QUOTE_CREATED', 'quote', ?, ?)
    `).bind(crypto.randomUUID(), actor?.sessionKind === "CUSTOMER" ? actor.id : null, actor ? "USER" : "SYSTEM", quoteId, JSON.stringify({ publicReference: reference })),
  ];
  try {
    await database.batch(statements);
  } catch (error) {
    if (String(error).includes("idempotency") || String(error).includes("uq_idempotency")) {
      const repeated = await database.prepare(`SELECT request_hash AS requestHash, resource_id AS resourceId FROM idempotency_keys WHERE scope = 'QUOTE_CREATE' AND key = ?`).bind(idempotencyKey).first<{ requestHash: string; resourceId: string }>();
      if (repeated && repeated.requestHash !== requestHash) throw new QuoteConflictError("IDEMPOTENCY_KEY_REUSED");
      const row = repeated?.resourceId ? await quoteRow(database, repeated.resourceId) : null;
      if (row && ((!row.customerUserId && normalizeEmail(row.contactEmail) === prepared.contactEmail) || row.customerUserId === actor?.id)) return recordToView(database, row);
    }
    throw error;
  }
  const row = await quoteRow(database, quoteId);
  if (!row) throw new Error("QUOTE_CREATION_FAILED");
  return recordToView(database, row);
}

export async function updateQuote(quoteId: string, value: unknown, actor: AuthUser | null, provenDraftId: string | null): Promise<QuoteView> {
  const database = getDatabase();
  const current = await accessibleRow(database, quoteId, actor, provenDraftId);
  if (current.status === "EXPIRED") throw new QuoteExpiredError("QUOTE_EXPIRED");
  if (!["DRAFT", "PRICED"].includes(current.status)) throw new QuoteConflictError("QUOTE_NOT_EDITABLE");
  const prepared = await prepareQuote(value, actor);
  if (!current.customerUserId && normalizeEmail(current.contactEmail) !== prepared.contactEmail) throw new QuoteAccessError("QUOTE_EMAIL_MISMATCH");
  const priceSnapshot = pricingSnapshot(prepared);
  const priceFingerprint = await fingerprint({ quoteId, request: prepared.requestSnapshot, pricing: priceSnapshot });
  await database.batch([
    database.prepare(`DELETE FROM quote_tasks WHERE quote_id = ?`).bind(quoteId),
    database.prepare(`DELETE FROM quote_adjustments WHERE quote_id = ?`).bind(quoteId),
    database.prepare(`
      UPDATE quotes SET status = 'PRICED', organization_id = ?, garden_id = ?, contact_email = ?, contact_phone = ?, request_snapshot = ?,
        pricing_snapshot = ?, pricing_fingerprint = ?, pricing_version_id = ?, recommended_half_days = ?,
        selected_half_days = ?, subtotal_ht_cents = ?, vat_cents = ?, total_ttc_cents = ?,
        eligible_sap_cents = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      prepared.organizationId, prepared.gardenId, prepared.contactEmail, prepared.contactPhone, JSON.stringify(prepared.requestSnapshot), JSON.stringify(priceSnapshot),
      priceFingerprint, prepared.estimate.pricingVersion.id, prepared.estimate.recommendedHalfDays,
      prepared.pricingInput.halfDays, prepared.subtotalHtCents, prepared.vatCents,
      prepared.totalTtcCents, prepared.eligibleSapCents, new Date(Date.now() + QUOTE_TTL_MS).toISOString(), quoteId,
    ),
    ...taskStatements(database, quoteId, prepared),
    ...adjustmentStatements(database, quoteId, prepared),
    database.prepare(`
      INSERT INTO audit_events (id, actor_user_id, actor_type, action, entity_type, entity_id)
      VALUES (?, ?, ?, 'QUOTE_UPDATED', 'quote', ?)
    `).bind(crypto.randomUUID(), actor?.sessionKind === "CUSTOMER" ? actor.id : null, actor ? "USER" : "SYSTEM", quoteId),
  ]);
  const row = await quoteRow(database, quoteId);
  if (!row) throw new QuoteNotFoundError("QUOTE_NOT_FOUND");
  return recordToView(database, row);
}

export async function getQuote(quoteId: string, actor: AuthUser | null, provenDraftId: string | null): Promise<QuoteView> {
  const database = getDatabase();
  return recordToView(database, await accessibleRow(database, quoteId, actor, provenDraftId));
}

export async function getCurrentQuote(actor: AuthUser | null, provenDraftId: string | null): Promise<QuoteView | null> {
  const database = getDatabase();
  if (provenDraftId) {
    try { return recordToView(database, await accessibleRow(database, provenDraftId, actor, provenDraftId)); }
    catch (error) { if (!(error instanceof QuoteNotFoundError || error instanceof QuoteAccessError)) throw error; }
  }
  if (actor?.sessionKind !== "CUSTOMER") return null;
  const row = await database.prepare(`
    SELECT id, public_reference AS publicReference, customer_user_id AS customerUserId,
           organization_id AS organizationId, garden_id AS gardenId,
           status, contact_email AS contactEmail, contact_phone AS contactPhone,
           request_snapshot AS requestSnapshot, pricing_snapshot AS pricingSnapshot,
           recommended_half_days AS recommendedHalfDays, selected_half_days AS selectedHalfDays,
           subtotal_ht_cents AS subtotalHtCents, vat_cents AS vatCents, total_ttc_cents AS totalTtcCents,
           eligible_sap_cents AS eligibleSapCents, expires_at AS expiresAt,
           created_at AS createdAt, updated_at AS updatedAt
    FROM quotes WHERE customer_user_id = ? AND status IN ('DRAFT', 'PRICED')
    ORDER BY updated_at DESC LIMIT 1
  `).bind(actor.id).first<QuoteRecord>();
  return row ? recordToView(database, row) : null;
}

export async function listCustomerQuotes(userId: string): Promise<QuoteView[]> {
  const database = getDatabase();
  const rows = await database.prepare(`
    SELECT id, public_reference AS publicReference, customer_user_id AS customerUserId,
           organization_id AS organizationId, garden_id AS gardenId,
           status, contact_email AS contactEmail, contact_phone AS contactPhone,
           request_snapshot AS requestSnapshot, pricing_snapshot AS pricingSnapshot,
           recommended_half_days AS recommendedHalfDays, selected_half_days AS selectedHalfDays,
           subtotal_ht_cents AS subtotalHtCents, vat_cents AS vatCents, total_ttc_cents AS totalTtcCents,
           eligible_sap_cents AS eligibleSapCents, expires_at AS expiresAt,
           created_at AS createdAt, updated_at AS updatedAt
    FROM quotes WHERE customer_user_id = ? ORDER BY updated_at DESC LIMIT 25
  `).bind(userId).all<QuoteRecord>();
  return Promise.all(rows.results.map((row) => recordToView(database, row)));
}

export async function cancelQuote(quoteId: string, actor: AuthUser | null, provenDraftId: string | null): Promise<void> {
  const database = getDatabase();
  const current = await accessibleRow(database, quoteId, actor, provenDraftId);
  if (["ACCEPTED", "SLOT_HELD"].includes(current.status)) throw new QuoteConflictError("QUOTE_NOT_CANCELLABLE");
  if (current.status === "CANCELLED") return;
  await database.batch([
    database.prepare(`UPDATE quotes SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(quoteId),
    database.prepare(`
      INSERT INTO audit_events (id, actor_user_id, actor_type, action, entity_type, entity_id)
      VALUES (?, ?, ?, 'QUOTE_CANCELLED', 'quote', ?)
    `).bind(crypto.randomUUID(), actor?.sessionKind === "CUSTOMER" ? actor.id : null, actor ? "USER" : "SYSTEM", quoteId),
  ]);
}
