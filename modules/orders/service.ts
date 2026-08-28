import type Stripe from "stripe";
import { getDatabase } from "@/db/runtime";
import type { AppDatabase, PreparedStatement } from "@/db/database";
import type { AuthUser } from "@/modules/auth/service";
import { getQuote, type QuoteView } from "@/modules/quotes/service";
import { getActiveHold } from "@/modules/scheduling/service";
import { getStripe, stripePublishableKey } from "@/modules/payments/stripe-adapter";
import { parseServiceAddress } from "@/modules/service-area/service";

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,100}$/u;
const CONSENT_VERSION = "card-guarantee-v1-2026-08-27";

export type OrderStatus = "PENDING_PAYMENT_SETUP" | "CONFIRMED" | "TO_SCHEDULE" | "SCHEDULED" | "READY" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "PAYMENT_ACTION_REQUIRED" | "PAYMENT_FAILED" | "REFUND_PENDING" | "REFUNDED" | "DISPUTED";
export type CustomerOrderView = {
  id: string;
  publicReference: string;
  quoteId: string;
  quoteReference: string;
  status: OrderStatus;
  totalTtcCents: number;
  selectedHalfDays: number;
  confirmedAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  tasks: string[];
  reports: Array<{ customerSummary: string; closedAt: string }>;
};
export type PaymentSetup = { order: CustomerOrderView; clientSecret: string; publishableKey: string; holdExpiresAt: string };

export class OrderInputError extends Error { constructor(public fields: Record<string, string>) { super("ORDER_INPUT_INVALID"); } }
export class OrderConflictError extends Error {}
export class OrderNotFoundError extends Error {}

function json(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") { try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; } }
  return {};
}

function orderReference(): string {
  return `SP-CMD-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

function splitAddress(value: unknown): { line1: string; postalCode: string; city: string } {
  const raw = typeof value === "string" ? value.normalize("NFKC").trim().slice(0, 300) : "";
  const parts = parseServiceAddress(raw);
  const marker = raw.lastIndexOf(parts.postalCode);
  const line1 = (marker > 0 ? raw.slice(0, marker) : raw).replace(/[\s,]+$/gu, "").slice(0, 160);
  if (!line1 || !parts.postalCode || !parts.city) throw new OrderInputError({ address: "L’adresse d’intervention doit comporter une voie, un code postal et une ville." });
  return { line1, postalCode: parts.postalCode, city: parts.city };
}

async function customerContext(database: AppDatabase, user: AuthUser): Promise<Record<string, unknown>> {
  const row = await database.prepare(`
    SELECT u.full_name AS fullName, u.email, u.phone, COALESCE(cp.customer_type, 'INDIVIDUAL') AS customerType,
      cp.stripe_customer_id AS stripeCustomerId, o.id AS organizationId, o.legal_name AS legalName,
      o.trade_name AS tradeName, o.siren, o.vat_number AS vatNumber, o.billing_email AS billingEmail,
      o.billing_address_snapshot AS billingAddress
    FROM users u LEFT JOIN customer_profiles cp ON cp.user_id = u.id
    LEFT JOIN organization_memberships om ON om.user_id = u.id AND om.role = 'ADMIN'
    LEFT JOIN organizations o ON o.id = om.organization_id AND o.status = 'ACTIVE'
    WHERE u.id = ? ORDER BY o.created_at DESC LIMIT 1
  `).bind(user.id).first<Record<string, unknown>>();
  if (!row) throw new OrderNotFoundError("CUSTOMER_NOT_FOUND");
  return row;
}

async function resolveGarden(database: AppDatabase, quote: QuoteView, user: AuthUser): Promise<{ id: string; statements: PreparedStatement[]; address: Record<string, unknown> }> {
  if (quote.gardenId) {
    const garden = await database.prepare(`
      SELECT g.id, a.label, a.line1, a.line2, a.postal_code AS postalCode, a.city, a.country_code AS countryCode
      FROM gardens g JOIN addresses a ON a.id = g.address_id
      LEFT JOIN organization_memberships om ON om.organization_id = g.organization_id AND om.user_id = ?
      WHERE g.id = ? AND g.archived_at IS NULL AND (g.owner_user_id = ? OR om.user_id = ?) LIMIT 1
    `).bind(user.id, quote.gardenId, user.id, user.id).first<Record<string, unknown>>();
    if (!garden) throw new OrderConflictError("GARDEN_NOT_ACCESSIBLE");
    return { id: String(garden.id), statements: [], address: garden };
  }
  const parsed = splitAddress(quote.requestSnapshot.address);
  const addressId = crypto.randomUUID();
  const gardenId = crypto.randomUUID();
  const snapshot = quote.requestSnapshot;
  const surfaceBands: Record<string, number | null> = { UNDER_100: 75, FROM_100_TO_250: 175, FROM_250_TO_500: 375, FROM_500_TO_1000: 750, OVER_1000: 1000 };
  const pricingInput = json(snapshot.pricingInput);
  return {
    id: gardenId,
    address: { ...parsed, line2: null, countryCode: "FR", label: "Adresse de la réservation" },
    statements: [
      database.prepare(`INSERT INTO addresses (id, owner_user_id, kind, label, line1, postal_code, city, department_code, country_code) VALUES (?, ?, 'SERVICE', 'Adresse de la réservation', ?, ?, ?, ?, 'FR')`)
        .bind(addressId, user.id, parsed.line1, parsed.postalCode, parsed.city, parsed.postalCode.slice(0, 2)),
      database.prepare(`INSERT INTO gardens (id, owner_user_id, address_id, label, surface_m2, terrain_slope, access_width_cm, has_animals, parking_notes, public_notes) VALUES (?, ?, ?, 'Jardin principal', ?, 'UNKNOWN', ?, ?, ?, ?)`)
        .bind(gardenId, user.id, addressId, surfaceBands[String(pricingInput.lawnSurfaceBand)] ?? null, Number.parseInt(String(snapshot.passageWidth), 10) || null, snapshot.animal === true ? 1 : 0, String(snapshot.parking ?? "") || null, String(snapshot.notes ?? "") || null),
    ],
  };
}

async function viewOrder(database: AppDatabase, orderId: string, userId: string): Promise<CustomerOrderView> {
  const row = await database.prepare(`
    SELECT o.id, o.public_reference AS publicReference, o.quote_id AS quoteId, q.public_reference AS quoteReference,
      o.status, o.total_ttc_cents AS totalTtcCents, o.selected_half_days AS selectedHalfDays,
      o.confirmed_at AS confirmedAt, MIN(s.starts_at) AS startsAt, MAX(s.ends_at) AS endsAt
    FROM orders o JOIN quotes q ON q.id = o.quote_id
    LEFT JOIN schedule_reservations r ON r.order_id = o.id AND r.status = 'ACTIVE'
    LEFT JOIN schedule_reservation_slots s ON s.reservation_id = r.id AND s.status = 'ACTIVE'
    WHERE o.id = ? AND o.customer_user_id = ? GROUP BY o.id LIMIT 1
  `).bind(orderId, userId).first<Record<string, unknown>>();
  if (!row) throw new OrderNotFoundError("ORDER_NOT_FOUND");
  const [tasks, reports] = await Promise.all([
    database.prepare(`SELECT label_snapshot AS label FROM order_tasks WHERE order_id = ? ORDER BY priority, label_snapshot`).bind(orderId).all<{ label: string }>(),
    database.prepare(`
      SELECT r.customer_summary AS customerSummary, r.closed_at AS closedAt
      FROM intervention_reports r
      JOIN interventions i ON i.id = r.intervention_id
      WHERE i.order_id = ? AND r.status = 'CLOSED' AND r.customer_summary IS NOT NULL
      ORDER BY i.sequence ASC
    `).bind(orderId).all<{ customerSummary: string; closedAt: string }>(),
  ]);
  return {
    id: String(row.id), publicReference: String(row.publicReference), quoteId: String(row.quoteId), quoteReference: String(row.quoteReference),
    status: String(row.status) as OrderStatus, totalTtcCents: Number(row.totalTtcCents), selectedHalfDays: Number(row.selectedHalfDays),
    confirmedAt: row.confirmedAt ? String(row.confirmedAt) : null, startsAt: row.startsAt ? String(row.startsAt) : null,
    endsAt: row.endsAt ? String(row.endsAt) : null,
    tasks: tasks.results.map(({ label }) => label),
    reports: reports.results.map(({ customerSummary, closedAt }) => ({ customerSummary, closedAt })),
  };
}

export async function getCustomerOrder(orderId: string, userId: string): Promise<CustomerOrderView> {
  return viewOrder(getDatabase(), orderId, userId);
}

export async function listCustomerOrders(userId: string): Promise<CustomerOrderView[]> {
  const database = getDatabase();
  const rows = await database.prepare(`SELECT id FROM orders WHERE customer_user_id = ? ORDER BY created_at DESC`).bind(userId).all<{ id: string }>();
  return Promise.all(rows.results.map(({ id }) => viewOrder(database, id, userId)));
}

async function ensureStripeCustomer(database: AppDatabase, user: AuthUser, context: Record<string, unknown>): Promise<string> {
  if (context.stripeCustomerId) return String(context.stripeCustomerId);
  const customer = await getStripe().customers.create({ email: user.email, name: user.fullName, phone: user.phone ?? undefined, metadata: { userId: user.id } }, { idempotencyKey: `sp_customer_${user.id}` });
  await database.prepare(`UPDATE customer_profiles SET stripe_customer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND stripe_customer_id IS NULL`).bind(customer.id, user.id).run();
  const stored = await database.prepare(`SELECT stripe_customer_id AS id FROM customer_profiles WHERE user_id = ?`).bind(user.id).first<{ id: string }>();
  return stored?.id ?? customer.id;
}

export async function startCardSetup(input: { quoteId?: unknown; consent?: unknown }, user: AuthUser, provenDraftId: string | null, idempotencyKey: string): Promise<PaymentSetup> {
  if (!IDEMPOTENCY_KEY.test(idempotencyKey)) throw new OrderInputError({ idempotencyKey: "Clé de requête invalide." });
  if (input.consent !== true) throw new OrderInputError({ consent: "Votre autorisation est nécessaire pour garantir la réservation." });
  const quoteId = typeof input.quoteId === "string" ? input.quoteId : "";
  const stripe = getStripe(); // Refuse toute mutation si Stripe n'est pas correctement configuré.
  const database = getDatabase();
  const quote = await getQuote(quoteId, user, provenDraftId);
  const hold = await getActiveHold(quoteId, user, provenDraftId);
  if (quote.status !== "SLOT_HELD" || !hold) throw new OrderConflictError("ACTIVE_HOLD_REQUIRED");
  const context = await customerContext(database, user);

  let payment = await database.prepare(`SELECT id, order_id AS orderId, provider_reference AS providerReference FROM payments WHERE idempotency_key = ? LIMIT 1`).bind(idempotencyKey).first<Record<string, unknown>>();
  let orderId = payment?.orderId ? String(payment.orderId) : "";
  if (!payment) {
    payment = await database.prepare(`
      SELECT p.id, p.order_id AS orderId, p.provider_reference AS providerReference
      FROM payments p JOIN orders o ON o.id = p.order_id
      WHERE o.quote_id = ? AND o.customer_user_id = ? AND p.kind = 'SETUP' AND p.status IN ('CREATED','PENDING','REQUIRES_ACTION')
      ORDER BY p.created_at DESC LIMIT 1
    `).bind(quote.id, user.id).first<Record<string, unknown>>();
    if (payment) orderId = String(payment.orderId);
  }
  if (!payment) {
    const existingOrder = await database.prepare(`SELECT id FROM orders WHERE quote_id = ? LIMIT 1`).bind(quote.id).first<{ id: string }>();
    orderId = existingOrder?.id ?? crypto.randomUUID();
    const paymentId = crypto.randomUUID();
    const garden = existingOrder ? null : await resolveGarden(database, quote, user);
    const serviceAddress = garden?.address ?? {};
    const professional = context.customerType === "PROFESSIONAL" && context.organizationId;
    const billingIdentity = professional ? {
      type: "PROFESSIONAL", legalName: context.legalName, tradeName: context.tradeName, siren: context.siren,
      vatNumber: context.vatNumber, email: context.billingEmail, address: json(context.billingAddress),
    } : { type: "INDIVIDUAL", fullName: user.fullName, email: user.email, phone: user.phone, address: serviceAddress };
    const statements: PreparedStatement[] = [
      database.prepare(`INSERT INTO customer_profiles (user_id, customer_type, terms_accepted_at) VALUES (?, 'INDIVIDUAL', CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET terms_accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP`).bind(user.id),
      ...(garden?.statements ?? []),
    ];
    if (!existingOrder) statements.push(
      database.prepare(`
        INSERT INTO orders (id, public_reference, quote_id, customer_user_id, organization_id, garden_id, status, payment_method,
          pricing_snapshot, service_address_snapshot, billing_identity_snapshot, selected_half_days, subtotal_ht_cents, vat_cents, total_ttc_cents, eligible_sap_cents)
        SELECT ?, ?, q.id, ?, q.organization_id, ?, 'PENDING_PAYMENT_SETUP', 'STRIPE', q.pricing_snapshot, ?, ?,
          q.selected_half_days, q.subtotal_ht_cents, q.vat_cents, q.total_ttc_cents, q.eligible_sap_cents
        FROM quotes q WHERE q.id = ? AND q.status = 'SLOT_HELD' AND EXISTS (
          SELECT 1 FROM schedule_reservations r WHERE r.quote_id = q.id AND r.kind = 'HOLD' AND r.status = 'ACTIVE' AND r.expires_at > ?
        )
      `).bind(orderId, orderReference(), user.id, garden!.id, JSON.stringify(serviceAddress), JSON.stringify(billingIdentity), quote.id, new Date().toISOString()),
      database.prepare(`INSERT INTO order_tasks (id, order_id, catalog_task_id, code_snapshot, label_snapshot, priority, measurement_snapshot, price_impact_ttc_cents) SELECT lower(hex(randomblob(16))), ?, catalog_task_id, code_snapshot, label_snapshot, priority, measurement_json, price_impact_ttc_cents FROM quote_tasks WHERE quote_id = ?`).bind(orderId, quote.id),
      database.prepare(`INSERT INTO order_status_history (id, order_id, to_status, reason, actor_user_id, metadata_json) VALUES (?, ?, 'PENDING_PAYMENT_SETUP', 'CARD_GUARANTEE_STARTED', ?, ?)`).bind(crypto.randomUUID(), orderId, user.id, JSON.stringify({ consentVersion: CONSENT_VERSION })),
    );
    if (existingOrder) statements.push(
      database.prepare(`UPDATE orders SET status = 'PENDING_PAYMENT_SETUP', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND customer_user_id = ? AND status = 'PAYMENT_FAILED'`).bind(orderId, user.id),
      database.prepare(`INSERT INTO order_status_history (id, order_id, from_status, to_status, reason, actor_user_id, metadata_json) VALUES (?, ?, 'PAYMENT_FAILED', 'PENDING_PAYMENT_SETUP', 'CARD_GUARANTEE_RETRIED', ?, ?)`).bind(crypto.randomUUID(), orderId, user.id, JSON.stringify({ consentVersion: CONSENT_VERSION })),
    );
    statements.push(
      database.prepare(`UPDATE schedule_reservations SET order_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND kind = 'HOLD' AND status = 'ACTIVE' AND expires_at > ?`).bind(orderId, hold.id, new Date().toISOString()),
      database.prepare(`INSERT INTO payments (id, order_id, method, kind, status, amount_cents, currency, idempotency_key) VALUES (?, ?, 'STRIPE', 'SETUP', 'CREATED', 0, 'EUR', ?)`).bind(paymentId, orderId, idempotencyKey),
      database.prepare(`INSERT INTO audit_events (id, actor_user_id, actor_type, action, entity_type, entity_id, metadata_json) VALUES (?, ?, 'USER', 'PAYMENT_METHOD_CONSENTED', 'order', ?, ?)`).bind(crypto.randomUUID(), user.id, orderId, JSON.stringify({ consentVersion: CONSENT_VERSION, quoteId: quote.id, holdId: hold.id })),
    );
    try { await database.batch(statements); }
    catch (error) {
      const repeated = await database.prepare(`SELECT id, order_id AS orderId, provider_reference AS providerReference FROM payments WHERE idempotency_key = ? LIMIT 1`).bind(idempotencyKey).first<Record<string, unknown>>();
      if (!repeated) throw error;
      payment = repeated; orderId = String(repeated.orderId);
    }
    payment ??= { id: paymentId, orderId, providerReference: null };
  }
  const order = await viewOrder(database, orderId, user.id);
  if (order.status === "SCHEDULED") throw new OrderConflictError("ORDER_ALREADY_CONFIRMED");
  const customerId = await ensureStripeCustomer(database, user, context);
  let setupIntent: Stripe.SetupIntent;
  if (payment.providerReference) setupIntent = await stripe.setupIntents.retrieve(String(payment.providerReference));
  else {
    setupIntent = await stripe.setupIntents.create({
      customer: customerId, usage: "off_session", automatic_payment_methods: { enabled: true },
      metadata: { orderId, paymentId: String(payment.id), quoteId: quote.id, holdId: hold.id, consentVersion: CONSENT_VERSION },
      description: `Garantie de réservation ${order.publicReference}`,
    }, { idempotencyKey: `setup_${idempotencyKey}` });
    await database.prepare(`UPDATE payments SET provider_reference = ?, status = 'PENDING', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'CREATED'`).bind(setupIntent.id, String(payment.id)).run();
  }
  if (!setupIntent.client_secret) throw new OrderConflictError("PAYMENT_SETUP_UNAVAILABLE");
  return { order, clientSecret: setupIntent.client_secret, publishableKey: stripePublishableKey(), holdExpiresAt: hold.expiresAt };
}
