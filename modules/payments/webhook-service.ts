import type Stripe from "stripe";
import { getDatabase } from "@/db/runtime";
import { orderInterventionStatements } from "@/modules/scheduling/service";

function metadata(object: Stripe.SetupIntent): { orderId: string; paymentId: string; quoteId: string; holdId: string } | null {
  const { orderId, paymentId, quoteId, holdId } = object.metadata ?? {};
  return orderId && paymentId && quoteId && holdId ? { orderId, paymentId, quoteId, holdId } : null;
}

export async function processStripeEvent(event: Stripe.Event): Promise<"processed" | "ignored" | "duplicate"> {
  const database = getDatabase();
  let eventId = crypto.randomUUID();
  const inserted = await database.prepare(`
    INSERT OR IGNORE INTO provider_events
      (id, provider, provider_event_id, event_type, signature_verified, status, payload_json)
    VALUES (?, 'STRIPE', ?, ?, 1, 'RECEIVED', ?)
  `).bind(eventId, event.id, event.type, JSON.stringify(event)).run();
  if (Number(inserted.meta.changes) === 0) {
    const existing = await database.prepare(`SELECT id, status FROM provider_events WHERE provider = 'STRIPE' AND provider_event_id = ? LIMIT 1`).bind(event.id).first<{ id: string; status: string }>();
    if (!existing || existing.status !== "FAILED") return "duplicate";
    eventId = existing.id;
  }
  await database.prepare(`UPDATE provider_events SET status = 'PROCESSING', attempts = attempts + 1, last_error_safe = NULL WHERE id = ?`).bind(eventId).run();

  if (!["setup_intent.succeeded", "setup_intent.setup_failed", "setup_intent.canceled"].includes(event.type)) {
    await database.prepare(`UPDATE provider_events SET status = 'IGNORED', processed_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(eventId).run();
    return "ignored";
  }

  const intent = event.data.object as Stripe.SetupIntent;
  const ids = metadata(intent);
  if (!ids) {
    await database.prepare(`UPDATE provider_events SET status = 'FAILED', last_error_safe = 'METADATA_MISSING' WHERE id = ?`).bind(eventId).run();
    throw new Error("STRIPE_METADATA_MISSING");
  }
  const payment = await database.prepare(`
    SELECT p.id, p.order_id AS orderId, o.quote_id AS quoteId
    FROM payments p JOIN orders o ON o.id = p.order_id
    WHERE p.id = ? AND p.provider_reference = ? AND p.method = 'STRIPE' LIMIT 1
  `).bind(ids.paymentId, intent.id).first<{ id: string; orderId: string; quoteId: string }>();
  if (!payment || payment.orderId !== ids.orderId || payment.quoteId !== ids.quoteId) {
    await database.prepare(`UPDATE provider_events SET status = 'FAILED', last_error_safe = 'RESOURCE_MISMATCH' WHERE id = ?`).bind(eventId).run();
    throw new Error("STRIPE_RESOURCE_MISMATCH");
  }

  if (event.type === "setup_intent.succeeded") {
    const activeHold = await database.prepare(`
      SELECT id FROM schedule_reservations
      WHERE id = ? AND order_id = ? AND quote_id = ? AND kind = 'HOLD' AND status = 'ACTIVE' LIMIT 1
    `).bind(ids.holdId, ids.orderId, ids.quoteId).first<{ id: string }>();
    const paymentMethod = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id ?? null;
    if (!activeHold) {
      await database.batch([
        database.prepare(`UPDATE payments SET status = 'SUCCEEDED', provider_payment_method_reference = ?, succeeded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(paymentMethod, ids.paymentId),
        database.prepare(`UPDATE orders SET status = 'PAYMENT_FAILED', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'PENDING_PAYMENT_SETUP'`).bind(ids.orderId),
        database.prepare(`INSERT INTO order_status_history (id, order_id, from_status, to_status, reason, metadata_json) VALUES (?, ?, 'PENDING_PAYMENT_SETUP', 'PAYMENT_FAILED', 'SLOT_NO_LONGER_AVAILABLE', ?)`)
          .bind(crypto.randomUUID(), ids.orderId, JSON.stringify({ stripeEventId: event.id })),
        database.prepare(`UPDATE provider_events SET status = 'PROCESSED', processed_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(eventId),
      ]);
      return "processed";
    }
    await database.batch([
      database.prepare(`UPDATE payments SET status = 'SUCCEEDED', provider_payment_method_reference = ?, succeeded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('CREATED','PENDING','REQUIRES_ACTION')`).bind(paymentMethod, ids.paymentId),
      database.prepare(`UPDATE schedule_reservations SET kind = 'ORDER', expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND order_id = ? AND status = 'ACTIVE'`).bind(ids.holdId, ids.orderId),
      database.prepare(`UPDATE quotes SET status = 'ACCEPTED', accepted_at = COALESCE(accepted_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'SLOT_HELD'`).bind(ids.quoteId),
      database.prepare(`UPDATE orders SET status = 'SCHEDULED', confirmed_at = COALESCE(confirmed_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('PENDING_PAYMENT_SETUP','PAYMENT_FAILED')`).bind(ids.orderId),
      database.prepare(`INSERT INTO order_status_history (id, order_id, from_status, to_status, reason, metadata_json) VALUES (?, ?, 'PENDING_PAYMENT_SETUP', 'SCHEDULED', 'CARD_GUARANTEE_CONFIRMED', ?)`)
        .bind(crypto.randomUUID(), ids.orderId, JSON.stringify({ stripeEventId: event.id, setupIntentId: intent.id })),
      database.prepare(`INSERT INTO audit_events (id, actor_type, action, entity_type, entity_id, metadata_json) VALUES (?, 'PROVIDER', 'ORDER_CONFIRMED_BY_STRIPE', 'order', ?, ?)`)
        .bind(crypto.randomUUID(), ids.orderId, JSON.stringify({ stripeEventId: event.id, paymentId: ids.paymentId, reservationId: ids.holdId })),
      database.prepare(`UPDATE provider_events SET status = 'PROCESSED', processed_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(eventId),
      ...orderInterventionStatements(database, ids.orderId),
    ]);
    return "processed";
  }

  const cancelled = event.type === "setup_intent.canceled";
  const safeMessage = cancelled ? "La préparation de la carte a été annulée." : "La carte n’a pas pu être enregistrée.";
  await database.batch([
    database.prepare(`UPDATE payments SET status = ?, failure_code = ?, failure_message_safe = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('CREATED','PENDING','REQUIRES_ACTION')`)
      .bind(cancelled ? "CANCELLED" : "FAILED", intent.last_setup_error?.code ?? event.type, safeMessage, ids.paymentId),
    database.prepare(`UPDATE orders SET status = 'PAYMENT_FAILED', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'PENDING_PAYMENT_SETUP'`).bind(ids.orderId),
    database.prepare(`INSERT INTO order_status_history (id, order_id, from_status, to_status, reason, metadata_json) VALUES (?, ?, 'PENDING_PAYMENT_SETUP', 'PAYMENT_FAILED', ?, ?)`)
      .bind(crypto.randomUUID(), ids.orderId, cancelled ? "CARD_SETUP_CANCELLED" : "CARD_SETUP_FAILED", JSON.stringify({ stripeEventId: event.id })),
    database.prepare(`UPDATE provider_events SET status = 'PROCESSED', processed_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(eventId),
  ]);
  return "processed";
}

export async function markStripeEventFailed(providerEventId: string): Promise<void> {
  await getDatabase().prepare(`
    UPDATE provider_events SET status = 'FAILED', last_error_safe = 'PROCESSING_FAILED',
      next_attempt_at = datetime(CURRENT_TIMESTAMP, '+1 minute')
    WHERE provider = 'STRIPE' AND provider_event_id = ? AND status = 'PROCESSING'
  `).bind(providerEventId).run();
}
