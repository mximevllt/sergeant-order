import Image from "next/image";
import Link from "@/app/site-link";
import { requireStaffPermission } from "@/modules/auth/server";
import { listReportsForReview } from "@/modules/interventions/service";
import { ReportReview } from "./report-review";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await requireStaffPermission("orders.write", "/admin/reports");
  const reports = await listReportsForReview(user);
  return <main className="admin-app"><aside><Link href="/" aria-label="Sergeant Paysage, accueil"><Image src="/logo-sergeant-paysage-blanc.png" alt="Sergeant Paysage" width={1784} height={387} priority /></Link><nav aria-label="Modules autorisés"><Link href="/admin/planning">Planning</Link><Link className="active" href="/admin/reports">Interventions</Link><span>Clients</span><span>Jardins</span><span>Équipes</span></nav><div className="admin-identity"><strong>{user.fullName}</strong><small>Validation opérationnelle</small><form action="/api/auth/sign-out" method="post"><button type="submit">Se déconnecter</button></form></div></aside><section className="report-review-section"><header><div><p>Espace entreprise sécurisé</p><h1>Comptes rendus</h1></div><span className="admin-session">{reports.length} à valider</span></header><p className="report-review-intro">La validation clôture le compte rendu et rend son résumé disponible au client. Elle ne déclenche ni facture ni débit : ces actions seront traitées séparément.</p><ReportReview initialReports={reports} /></section></main>;
}
