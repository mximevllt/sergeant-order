import Image from "next/image";
import Link from "@/app/site-link";
import { requireStaffPermission } from "@/modules/auth/server";
import { listFieldMissions } from "@/modules/interventions/service";
import { FieldDashboard } from "./field-dashboard";

export const dynamic = "force-dynamic";

export default async function FieldPage() {
  const user = await requireStaffPermission("field.portal.access", "/terrain");
  const missions = await listFieldMissions(user);
  return <main className="field-app"><header><Link href="/" aria-label="Sergeant Paysage, accueil"><Image src="/logo-sergeant-paysage-blanc.png" alt="Sergeant Paysage" width={1784} height={387} priority /></Link><div><span>{user.fullName}</span><form action="/api/auth/sign-out" method="post"><button type="submit">Se déconnecter</button></form></div></header><FieldDashboard initialMissions={missions} /></main>;
}
