import Stripe from "stripe";
import { runtimeValue } from "@/config/runtime-environment";

let stripeClient: Stripe | null = null;
let stripeClientKey = "";

export class PaymentConfigurationError extends Error {}

export function paymentMode(): "disabled" | "test" | "live" {
  const mode = runtimeValue("PAYMENT_MODE");
  return mode === "test" || mode === "live" ? mode : "disabled";
}

export function stripePublishableKey(): string {
  return runtimeValue("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
}

export function getStripe(): Stripe {
  const mode = paymentMode();
  const key = runtimeValue("STRIPE_SECRET_KEY");
  const publishableKey = stripePublishableKey();
  if (mode === "disabled") throw new PaymentConfigurationError("PAYMENTS_DISABLED");
  if (!key || !publishableKey) throw new PaymentConfigurationError("STRIPE_CONFIGURATION_INCOMPLETE");
  if (mode === "live" && (!key.startsWith("sk_live_") || !publishableKey.startsWith("pk_live_"))) {
    throw new PaymentConfigurationError("STRIPE_LIVE_KEYS_REQUIRED");
  }
  if (mode === "test" && (!key.startsWith("sk_test_") || !publishableKey.startsWith("pk_test_"))) {
    throw new PaymentConfigurationError("STRIPE_TEST_KEYS_REQUIRED");
  }
  if (!stripeClient || stripeClientKey !== key) {
    stripeClient = new Stripe(key, { appInfo: { name: "SERGEANT PAYSAGE", version: "0.1.0" }, maxNetworkRetries: 2 });
    stripeClientKey = key;
  }
  return stripeClient;
}

export function constructStripeEvent(payload: string, signature: string | null): Stripe.Event {
  const secret = runtimeValue("STRIPE_WEBHOOK_SECRET");
  if (!signature || !secret) throw new PaymentConfigurationError("STRIPE_WEBHOOK_CONFIGURATION_INCOMPLETE");
  return getStripe().webhooks.constructEvent(payload, signature, secret);
}
