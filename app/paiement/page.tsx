import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "@/app/site-link";
import { requireCustomerUser } from "@/modules/auth/server";
import { readQuoteDraftId } from "@/modules/quotes/security";
import { getQuote } from "@/modules/quotes/service";
import { getActiveHold } from "@/modules/scheduling/service";
import { PaymentFlow } from "./payment-flow";

export const dynamic = "force-dynamic";

export default async function PaymentPage({ searchParams }: { searchParams: Promise<{ devis?: string }> }) {
  const quoteId = (await searchParams).devis;
  if (!quoteId) redirect("/reserver");
  const user = await requireCustomerUser(`/paiement?devis=${encodeURIComponent(quoteId)}`);
  const requestHeaders = await headers();
  const proof = await readQuoteDraftId(requestHeaders.get("cookie"));
  const quote = await getQuote(quoteId, user, proof).catch(() => null);
  if (!quote) redirect("/espace-client");
  const hold = await getActiveHold(quote.id, user, proof).catch(() => null);
  if (!hold) redirect(`/confirmation?devis=${encodeURIComponent(quote.id)}`);
  const price = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(quote.totalTtcCents / 100);
  return <main className="payment-page">
    <header><Link href="/" aria-label="Sergeant Paysage, accueil"><Image src="/logo-sergeant-paysage-blanc.png" alt="Sergeant Paysage" width={1784} height={387} priority /></Link><span>Paiement sécurisé</span></header>
    <section className="payment-layout"><div className="payment-summary"><p className="kicker">Dernière étape</p><h1>Garantissez votre créneau.</h1><p>Aucun débit aujourd’hui. Votre carte est enregistrée de façon sécurisée et la commande est confirmée dès validation bancaire.</p><dl><div><dt>Devis</dt><dd>{quote.publicReference}</dd></div><div><dt>Intervention</dt><dd>{quote.tasks.map(({ label }) => label).join(" · ")}</dd></div><div><dt>Créneau</dt><dd>{hold.dateLabel}<br />{hold.timeLabel}</dd></div><div><dt>Montant prévu TTC</dt><dd>{price}</dd></div></dl><Link href={`/confirmation?devis=${encodeURIComponent(quote.id)}`}>← Revenir au récapitulatif</Link></div>
      <div className="payment-panel"><p>Bonjour {user.fullName.split(" ")[0]},</p><h2>Votre garantie bancaire</h2><PaymentFlow quoteId={quote.id} holdExpiresAt={hold.expiresAt} /><div className="payment-trust"><span>🔒 Chiffrement TLS</span><span>Carte gérée par Stripe</span><span>Débit après prestation</span></div></div>
    </section>
  </main>;
}
