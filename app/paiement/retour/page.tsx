import Image from "next/image";
import { redirect } from "next/navigation";
import Link from "@/app/site-link";
import { requireCustomerUser } from "@/modules/auth/server";
import { getCustomerOrder } from "@/modules/orders/service";
import { PaymentStatus } from "./payment-status";

export const dynamic = "force-dynamic";

export default async function PaymentReturnPage({ searchParams }: { searchParams: Promise<{ commande?: string }> }) {
  const orderId = (await searchParams).commande;
  if (!orderId) redirect("/espace-client");
  const user = await requireCustomerUser(`/paiement/retour?commande=${encodeURIComponent(orderId)}`);
  const order = await getCustomerOrder(orderId, user.id).catch(() => null);
  if (!order) redirect("/espace-client");
  return <main className="confirmation-page payment-return"><header><Link href="/" aria-label="Sergeant Paysage, accueil"><Image src="/logo-sergeant-paysage-blanc.png" alt="Sergeant Paysage" width={1784} height={387} priority /></Link></header><PaymentStatus initialOrder={order} /></main>;
}
