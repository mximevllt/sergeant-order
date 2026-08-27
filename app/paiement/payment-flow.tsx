"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useMemo, useRef, useState, type FormEvent } from "react";
import type { PaymentSetup } from "@/modules/orders/service";

type State = { kind: "ready" | "preparing" | "card" | "confirming" | "error"; message?: string };

function GuaranteeForm({ setup }: { setup: PaymentSetup }) {
  const stripe = useStripe();
  const elements = useElements();
  const [state, setState] = useState<State>({ kind: "card" });
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setState({ kind: "confirming" });
    const returnUrl = `${window.location.origin}/paiement/retour?commande=${encodeURIComponent(setup.order.id)}`;
    const result = await stripe.confirmSetup({ elements, confirmParams: { return_url: returnUrl }, redirect: "if_required" });
    if (result.error) {
      setState({ kind: "error", message: result.error.message || "La carte n’a pas pu être enregistrée." });
      return;
    }
    window.location.assign(returnUrl);
  }
  return <form className="stripe-form" onSubmit={submit}>
    <PaymentElement options={{ layout: "tabs" }} />
    {state.message && <p className="payment-error" role="alert">{state.message}</p>}
    <button className="button button-primary" type="submit" disabled={!stripe || state.kind === "confirming"}>
      {state.kind === "confirming" ? "Validation sécurisée…" : "Garantir ma réservation"}<span>→</span>
    </button>
    <small>Le montant de {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(setup.order.totalTtcCents / 100)} ne sera débité qu’après la prestation, selon les conditions acceptées.</small>
  </form>;
}

function stripeError(code?: string): string {
  if (code === "PAYMENTS_DISABLED" || code === "STRIPE_CONFIGURATION_INCOMPLETE") return "Le paiement sécurisé n’est pas encore activé sur cet environnement. Votre devis et votre créneau restent inchangés jusqu’à l’expiration affichée.";
  if (code === "ACTIVE_HOLD_REQUIRED") return "Le créneau provisoire a expiré. Revenez au configurateur pour en choisir un nouveau.";
  if (code === "ORDER_ALREADY_CONFIRMED") return "Cette réservation est déjà confirmée dans votre espace client.";
  return "La préparation du paiement a rencontré un problème. Réessayez sans recharger la page.";
}

export function PaymentFlow({ quoteId, holdExpiresAt }: { quoteId: string; holdExpiresAt: string }) {
  const idempotencyKey = useRef(`payment_${crypto.randomUUID().replaceAll("-", "")}`);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<State>({ kind: "ready" });
  const [setup, setSetup] = useState<PaymentSetup | null>(null);
  const stripePromise = useMemo<PromiseLike<Stripe | null> | null>(() => setup ? loadStripe(setup.publishableKey) : null, [setup]);

  async function prepare() {
    if (!consent) return setState({ kind: "error", message: "Cochez l’autorisation pour poursuivre." });
    setState({ kind: "preparing" });
    const response = await fetch("/api/orders/payment-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey.current },
      body: JSON.stringify({ quoteId, consent: true }),
    }).catch(() => null);
    const result = await response?.json().catch(() => ({})) as { setup?: PaymentSetup; error?: string } | undefined;
    if (!response?.ok || !result?.setup) return setState({ kind: "error", message: stripeError(result?.error) });
    setSetup(result.setup);
    setState({ kind: "card" });
  }

  if (setup && stripePromise) return <Elements stripe={stripePromise} options={{ clientSecret: setup.clientSecret, locale: "fr", appearance: { theme: "stripe", variables: { colorPrimary: "#314735", borderRadius: "2px", fontFamily: "Arial, sans-serif" } } }}><GuaranteeForm setup={setup} /></Elements>;
  return <div className="payment-consent">
    <div className="payment-security"><i aria-hidden="true">⌁</i><div><strong>Carte enregistrée par Stripe</strong><p>SERGEANT PAYSAGE ne reçoit ni ne conserve votre numéro de carte.</p></div></div>
    <label><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>J’autorise SERGEANT PAYSAGE à enregistrer ce moyen de paiement pour garantir cette réservation et à débiter, après réalisation, le montant final prévu par la commande. Toute hausse devra faire l’objet de mon accord préalable.</span></label>
    {state.message && <p className="payment-error" role="alert">{state.message}</p>}
    <button type="button" className="button button-primary" disabled={state.kind === "preparing"} onClick={() => void prepare()}>{state.kind === "preparing" ? "Connexion sécurisée…" : "Saisir ma carte"}<span>→</span></button>
    <small>Créneau provisoire jusqu’au {new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(holdExpiresAt))}.</small>
  </div>;
}
