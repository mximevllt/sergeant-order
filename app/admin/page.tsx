import Link from "@/app/site-link";
import { requireStaffPermission } from "@/modules/auth/server";
import { AdminSidebar } from "./admin-sidebar";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  DISPATCHER: "Responsable planning",
  ACCOUNTING: "Comptabilité",
  ADMIN: "Administration",
};

export default async function AdminPage() {
  const user = await requireStaffPermission("backoffice.access", "/admin");
  const roleLabels = user.roles.map((role) => ROLE_LABELS[role]).filter(Boolean);

  return <main className="admin-app"><AdminSidebar fullName={user.fullName} roleLabel={roleLabels.join(" · ") || "Administration"} /><section><header><div><p>Espace entreprise sécurisé</p><h1>Tableau de bord</h1></div><span className="admin-session">Session 8 h</span></header><div className="admin-welcome"><p className="kicker">Autorisations actives</p><h2>Bonjour {user.fullName.split(" ")[0]}.</h2><p>Le planning opérationnel affiche maintenant les créneaux garantis et les équipes qui leur sont automatiquement affectées.</p><div>{roleLabels.map((label) => <span key={label}>{label}</span>)}</div></div><div className="admin-empty"><span>Organisation</span><h2>Les modules opérationnels sont accessibles.</h2><p>Consultez le planning, les interventions, les clients, les jardins et la composition des équipes depuis le menu.</p><Link className="text-link" href="/admin/planning">Ouvrir le planning <span>→</span></Link></div></section></main>;
}
