import { requireStaffPermission } from "@/modules/auth/server";
import { listTeams } from "@/modules/backoffice/directory-service";
import { AdminSidebar } from "../admin-sidebar";

export const dynamic = "force-dynamic";
const labels: Record<string, string> = { LEAD: "Chef d’équipe", MEMBER: "Équipier" };

export default async function TeamsPage() {
  const user = await requireStaffPermission("teams.read", "/admin/equipes");
  const teams = await listTeams();
  return <main className="admin-app"><AdminSidebar active="/admin/equipes" fullName={user.fullName} roleLabel="Organisation des équipes" /><section className="admin-directory"><header><div><p>Espace entreprise sécurisé</p><h1>Équipes</h1></div><span className="admin-session">{teams.filter((team) => team.active).length} actives</span></header><p className="directory-intro">Composition, capacités et charge de travail des équipes disponibles pour l’affectation des interventions.</p><div className="team-directory">{teams.map((team) => <article key={team.id} style={{ borderTopColor: team.color || undefined }}><header><div><span>{team.active ? "Équipe active" : "Inactive"}</span><h2>{team.name}</h2></div><p>{team.scheduledMissions} mission{team.scheduledMissions > 1 ? "s" : ""} à venir</p></header><section><h3>Membres</h3>{team.members.length ? <ul>{team.members.map((member) => <li key={`${team.id}-${member.fullName}`}><strong>{member.fullName}</strong><small>{labels[member.role] ?? member.role}</small></li>)}</ul> : <p>Composition à renseigner</p>}</section><footer><b>Compétences</b><p>{team.capabilities.length ? team.capabilities.join(" · ") : "À renseigner"}</p></footer></article>)}</div></section></main>;
}
