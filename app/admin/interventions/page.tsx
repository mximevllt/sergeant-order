import { requireStaffPermission } from "@/modules/auth/server";
import { listInterventions } from "@/modules/backoffice/directory-service";
import { AdminSidebar } from "../admin-sidebar";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = { PLANNED: "Planifiée", IN_PROGRESS: "En cours", COMPLETED: "Terminée", REPORT_CLOSED: "Clôturée" };
function dateTime(value: string): string { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(value)); }

export default async function InterventionsPage() {
  const user = await requireStaffPermission("orders.read", "/admin/interventions");
  const interventions = await listInterventions();
  return <main className="admin-app"><AdminSidebar active="/admin/interventions" fullName={user.fullName} roleLabel="Suivi des interventions" /><section className="admin-directory"><header><div><p>Espace entreprise sécurisé</p><h1>Interventions</h1></div><span className="admin-session">{interventions.length} au total</span></header><p className="directory-intro">Toutes les missions transmises au terrain, avec leur équipe, leur créneau et les prestations prévues.</p>{interventions.length ? <div className="directory-list">{interventions.map((item) => <article key={item.id}><header><div><span>{statusLabel[item.status] ?? item.status}</span><h2>{item.reference}</h2></div><time>{dateTime(item.plannedStartsAt)}</time></header><div className="directory-details"><p><b>Client</b>{item.customerName}</p><p><b>Jardin</b>{item.gardenLabel}<small>{item.address}</small></p><p><b>Équipe</b>{item.teamName}</p><p><b>Prestations</b>{item.tasks.join(" · ") || "À préciser"}</p></div></article>)}</div> : <Empty title="Aucune intervention" text="Les interventions confirmées apparaîtront ici dès leur affectation au planning." />}</section></main>;
}

function Empty({ title, text }: { title: string; text: string }) { return <article className="directory-empty"><span>○</span><h2>{title}</h2><p>{text}</p></article>; }
