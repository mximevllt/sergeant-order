import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "@/app/site-link";
import { getSessionFromCookie } from "@/modules/auth/service";
import { readQuoteDraftId } from "@/modules/quotes/security";
import { getQuote } from "@/modules/quotes/service";

export const dynamic = "force-dynamic";

function durationLabel(halfDays: number) {
  if (halfDays === 1) return "1 demi-journée";
  const days = halfDays / 2;
  return days === 1 ? "1 jour" : `${Number.isInteger(days) ? days : String(days).replace(".", ",")} jours`;
}

export default async function ConfirmationPage({ searchParams }: { searchParams: Promise<{ devis?: string }> }) {
  const quoteId = (await searchParams).devis;
  if (!quoteId) redirect("/reserver");
  const requestHeaders = await headers();
  const actor = await getSessionFromCookie(requestHeaders.get("cookie"));
  const proof = await readQuoteDraftId(requestHeaders.get("cookie"));
  const quote = await getQuote(quoteId, actor, proof).catch(() => null);
  if (!quote) redirect("/reserver");
  const request = quote.requestSnapshot;
  const address = typeof request.address === "string" ? request.address : "Adresse à confirmer";
  const schedule = [request.date, request.slot].filter((item): item is string => typeof item === "string" && item.length > 0).join(" · ") || "À choisir selon les disponibilités";
  const expires = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date(quote.expiresAt));
  const price = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(quote.totalTtcCents / 100);

  return <main className="confirmation-page"><header><Link href="/" aria-label="Sergeant Paysage, accueil"><Image src="/logo-sergeant-paysage-blanc.png" alt="Sergeant Paysage" width={1784} height={387} priority /></Link></header><section><div className="confirm-check">✓</div><p>Devis {quote.publicReference}</p><h1>Votre devis est enregistré.</h1><h2>Son tarif est conservé jusqu’au {expires}. Vous pouvez le modifier ou le reprendre plus tard.</h2><div className="confirm-card"><div><span>Adresse</span><strong>{address}</strong></div><div><span>Prestations</span><strong>{quote.tasks.map(({ label }) => label).join(" + ")}<br />{durationLabel(quote.selectedHalfDays)}</strong></div><div><span>Souhait indiqué</span><strong>{schedule}<br /><small>sous réserve des disponibilités réelles</small></strong></div><div><span>Prix du devis</span><strong>{price} TTC<br /><small>aucun paiement effectué</small></strong></div></div><div className="timeline"><div className="done"><i>✓</i><span>Devis enregistré</span></div><div><i>2</i><span>Créneau à confirmer</span></div><div><i>3</i><span>Paiement sécurisé</span></div><div><i>4</i><span>Commande confirmée</span></div></div><div className="confirm-actions"><Link className="button button-primary" href={`/reserver?devis=${encodeURIComponent(quote.id)}`}>Modifier le devis</Link><Link href="/espace-client">Voir mes devis</Link><Link href="/">Retour à l’accueil</Link></div><aside><strong>Ce devis n’est pas encore une réservation.</strong><p>Aucun créneau n’est bloqué et aucun paiement n’a été enregistré. Ces fonctions seront raccordées aux étapes planning et paiement.</p></aside></section></main>;
}
