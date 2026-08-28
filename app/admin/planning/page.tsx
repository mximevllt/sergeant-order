import Image from "next/image";
import Link from "@/app/site-link";
import { requireStaffPermission } from "@/modules/auth/server";
import { getPlanningBoard } from "@/modules/scheduling/backoffice-service";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ from?: string }> };

function time(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function weekShift(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export default async function PlanningPage({ searchParams }: Props) {
  const user = await requireStaffPermission("planning.read", "/admin/planning");
  const board = await getPlanningBoard((await searchParams).from);
  return <main className="admin-app"><aside><Link href="/" aria-label="Sergeant Paysage, accueil"><Image src="/logo-sergeant-paysage-blanc.png" alt="Sergeant Paysage" width={1784} height={387} priority /></Link><nav aria-label="Modules autorisés"><Link className="active" href="/admin/planning">Planning</Link><span>Interventions</span><span>Clients</span><span>Jardins</span><span>Équipes</span></nav><div className="admin-identity"><strong>{user.fullName}</strong><small>Responsable planning</small><form action="/api/auth/sign-out" method="post"><button type="submit">Se déconnecter</button></form></div></aside><section className="planning-section"><header><div><p>Espace entreprise sécurisé</p><h1>Planning des équipes</h1></div><span className="admin-session">2 équipes actives</span></header><div className="planning-toolbar"><div><p className="kicker">Créneaux garantis</p><h2>Du {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(`${board.from}T12:00:00Z`))} au {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(`${board.to}T12:00:00Z`))}</h2></div><div><Link href={`/admin/planning?from=${weekShift(board.from, -7)}`}>← Semaine précédente</Link><Link href={`/admin/planning?from=${weekShift(board.from, 7)}`}>Semaine suivante →</Link></div></div><p className="planning-note">Chaque mission provient d’une commande dont la garantie de paiement a été validée. Les informations affichées sont limitées aux données nécessaires à l’organisation de l’intervention.</p><div className="planning-team-key">{board.teams.map((team) => <span key={team.id}><i aria-hidden="true" />{team.name}</span>)}</div><div className="planning-grid">{board.days.map((day) => <article key={day.date}><header><time dateTime={day.date}>{day.label}</time><small>{day.missions.length} mission{day.missions.length > 1 ? "s" : ""}</small></header>{day.missions.length ? <div>{day.missions.map((mission) => <section className={`planning-mission ${mission.period === "AFTERNOON" ? "afternoon" : ""}`} key={`${mission.orderId}-${mission.teamId}-${mission.startsAt}`}><div><time>{time(mission.startsAt)} — {time(mission.endsAt)}</time><span>{mission.teamName}</span></div><h2>{mission.customerName}</h2><p>{mission.gardenLabel} · {mission.address}</p><small>{mission.tasks.join(" · ") || "Prestations à préciser"}</small><footer><b>{mission.orderReference}</b><em>{mission.status === "SCHEDULED" ? "Planifiée" : mission.status}</em></footer></section>)}</div> : <p className="planning-empty">Aucune mission confirmée.</p>}</article>)}</div></section></main>;
}
