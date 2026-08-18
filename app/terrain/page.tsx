import Image from "next/image";
import Link from "@/app/site-link";
import { requireStaffPermission } from "@/modules/auth/server";

export const dynamic = "force-dynamic";

export default async function FieldPage() {
  const user = await requireStaffPermission("field.portal.access", "/terrain");
  return <main className="field-app"><header><Link href="/" aria-label="Sergeant Paysage, accueil"><Image src="/logo-sergeant-paysage-blanc.png" alt="Sergeant Paysage" width={1784} height={387} priority /></Link><form action="/api/auth/sign-out" method="post"><button type="submit">Se déconnecter</button></form></header><section><p className="kicker">Espace terrain sécurisé</p><h1>Bonjour {user.fullName.split(" ")[0]},</h1><article><span>Vos missions</span><h2>Aucune mission affectée pour le moment.</h2><p>Seules les interventions rattachées à votre équipe apparaîtront ici lorsque le planning opérationnel sera connecté.</p></article><small>Connecté avec {user.email}</small></section></main>;
}
