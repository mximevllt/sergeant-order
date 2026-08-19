import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "@/app/site-link";
import { getSessionFromCookie } from "@/modules/auth/service";
import { readQuoteDraftId } from "@/modules/quotes/security";
import { getQuote } from "@/modules/quotes/service";
import { getActiveHold } from "@/modules/scheduling/service";

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
  const hold = await getActiveHold(quote.id, actor, proof).catch(() => null);
  const request = quote.requestSnapshot;
  const address = typeof request.address === "string" ? request.address : "Adresse à confirmer";
  const schedule = hold ? `${hold.dateLabel} · ${hold.timeLabel}` : [request.date, request.slot].filter((item): item is string => typeof item === "string" && item.length > 0).join(" · ") || "À choisir selon les disponibilités";
  const expires = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date(quote.expiresAt));
  const holdExpires = hold ? new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(hold.expiresAt)) : "";
  const price = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(quote.totalTtcCents / 100);

  return <main className="confirmation-page"><header><Link href="/" aria-label="Sergeant Paysage, accueil"><Image src="/logo-sergeant-paysage-blanc.png" alt="Sergeant Paysage" width={1784} height={387} priority /></Link></header><section><div className="confirm-check">✓</div><p>Devis {quote.publicReference}</p><h1>{hold ? "Votre créneau est bloqué." : "Votre devis est enregistré."}</h1><h2>{hold ? `Cette disponibilité vous est réservée jusqu’au ${holdExpires}, le temps de poursuivre vers le paiement.` : `Son tarif est conservé jusqu’au ${expires}. Vous pouvez le modifier ou le reprendre plus tard.`}</h2><div className="confirm-card"><div><span>Adresse</span><strong>{address}</strong></div><div><span>Prestations</span><strong>{quote.tasks.map(({ label }) => label).join(" + ")}<br />{durationLabel(quote.selectedHalfDays)}</strong></div><div><span>{hold ? "Créneau bloqué" : "Souhait indiqué"}</span><strong>{schedule}<br /><small>{hold ? hold.completionLabel : "sous réserve des disponibilités réelles"}</small></strong></div><div><span>Prix du devis</span><strong>{price} TTC<br /><small>aucun paiement effectué</small></strong></div></div><div className="timeline"><div className="done"><i>✓</i><span>Devis enregistré</span></div><div className={hold ? "done" : ""}><i>{hold ? "✓" : "2"}</i><span>{hold ? "Créneau bloqué" : "Créneau à confirmer"}</span></div><div><i>3</i><span>Paiement sécurisé</span></div><div><i>4</i><span>Commande confirmée</span></div></div><div className="confirm-actions"><Link className="button button-primary" href={`/reserver?devis=${encodeURIComponent(quote.id)}`}>{hold ? "Modifier le devis et le créneau" : "Modifier le devis"}</Link><Link href="/espace-client">Voir mes devis</Link><Link href="/">Retour à l’accueil</Link></div><aside><strong>{hold ? "Créneau protégé, commande non payée." : "Ce devis n’est pas encore une réservation."}</strong><p>{hold ? "Le verrou empêche une double réservation pendant 15 minutes. La création de la commande et le paiement sécurisé seront raccordés à l’étape 14." : "Aucun créneau n’est bloqué et aucun paiement n’a été enregistré."}</p></aside></section></main>;
}
