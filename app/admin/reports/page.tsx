import { requireStaffPermission } from "@/modules/auth/server";
import { listReportsForReview } from "@/modules/interventions/service";
import { ReportReview } from "./report-review";
import { AdminSidebar } from "../admin-sidebar";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await requireStaffPermission("orders.write", "/admin/reports");
  const reports = await listReportsForReview(user);
  return <main className="admin-app"><AdminSidebar active="/admin/interventions" fullName={user.fullName} roleLabel="Validation opérationnelle" /><section className="report-review-section"><header><div><p>Espace entreprise sécurisé</p><h1>Comptes rendus</h1></div><span className="admin-session">{reports.length} à valider</span></header><p className="report-review-intro">La validation clôture le compte rendu et rend son résumé disponible au client. Elle ne déclenche ni facture ni débit : ces actions seront traitées séparément.</p><ReportReview initialReports={reports} /></section></main>;
}
