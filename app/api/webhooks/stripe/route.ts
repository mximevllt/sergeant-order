import { constructStripeEvent, PaymentConfigurationError } from "@/modules/payments/stripe-adapter";
import { markStripeEventFailed, processStripeEvent } from "@/modules/payments/webhook-service";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 1_000_000) return Response.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  const payload = await request.text();
  if (new TextEncoder().encode(payload).byteLength > 1_000_000) return Response.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  let event: Stripe.Event | null = null;
  try {
    event = constructStripeEvent(payload, request.headers.get("stripe-signature"));
    const result = await processStripeEvent(event);
    return Response.json({ received: true, result });
  } catch (error) {
    if (error instanceof PaymentConfigurationError || String(error).match(/signature/iu)) {
      return Response.json({ error: "INVALID_STRIPE_SIGNATURE" }, { status: 400 });
    }
    if (event) await markStripeEventFailed(event.id).catch(() => undefined);
    return Response.json({ error: "WEBHOOK_PROCESSING_FAILED" }, { status: 500 });
  }
}
