"use client";

import Link from "@/app/site-link";
import { useEffect, useState } from "react";
import type { CustomerOrderView } from "@/modules/orders/service";

export function PaymentStatus({ initialOrder }: { initialOrder: CustomerOrderView }) {
  const [order, setOrder] = useState(initialOrder);
  const terminal = order.status === "SCHEDULED" || order.status === "PAYMENT_FAILED";
  useEffect(() => {
    if (terminal) return;
    let attempts = 0;
    const timer = window.setInterval(async () => {
      attempts += 1;
      const response = await fetch(`/api/orders/${order.id}`, { cache: "no-store" }).catch(() => null);
      if (response?.ok) {
        const result = await response.json() as { order: CustomerOrderView };
        setOrder(result.order);
      }
      if (attempts >= 20) window.clearInterval(timer);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [order.id, terminal]);
  const confirmed = order.status === "SCHEDULED";
  const failed = order.status === "PAYMENT_FAILED";
  return <section>
    <div className={`confirm-check ${failed ? "failed" : ""}`}>{confirmed ? "✓" : failed ? "!" : "…"}</div>
    <p>Commande {order.publicReference}</p>
    <h1>{confirmed ? "Votre intervention est confirmée." : failed ? "Le créneau n’a pas pu être confirmé." : "Validation bancaire reçue."}</h1>
    <h2>{confirmed ? "La garantie bancaire est enregistrée et la commande figure désormais dans le planning de l’entreprise." : failed ? "Aucun débit n’a été effectué. Choisissez un nouveau créneau ou contactez-nous si le problème persiste." : "Stripe confirme l’opération au serveur. Cette page se met à jour automatiquement pendant quelques secondes."}</h2>
    <div className="timeline"><div className="done"><i>✓</i><span>Devis enregistré</span></div><div className="done"><i>✓</i><span>Carte sécurisée</span></div><div className={confirmed ? "done" : ""}><i>{confirmed ? "✓" : "3"}</i><span>Commande planifiée</span></div></div>
    <div className="confirm-actions">{failed && <Link className="button button-primary" href={`/reserver?devis=${encodeURIComponent(order.quoteId)}`}>Choisir un autre créneau</Link>}<Link className={failed ? "" : "button button-primary"} href="/espace-client">Ouvrir mon espace client</Link><Link href="/">Retour à l’accueil</Link></div>
  </section>;
}
