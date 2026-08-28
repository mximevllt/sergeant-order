import Image from "next/image";
import Link from "@/app/site-link";
import { hasPermission, type Permission } from "@/modules/authorization/policy.mjs";
import { requireStaffPermission } from "@/modules/auth/server";

export const dynamic = "force-dynamic";

const NAVIGATION: Array<{ label: string; permission: Permission }> = [
  { label: "Planning", permission: "planning.read" },
  { label: "Interventions", permission: "orders.read" },
  { label: "Clients", permission: "customers.read" },
  { label: "Jardins", permission: "gardens.read" },
  { label: "Tarifs", permission: "pricing.read" },
  { label: "Zones", permission: "zones.read" },
  { label: "Équipes", permission: "teams.read" },
  { label: "Paiements", permission: "payments.read" },
  { label: "Facturation", permission: "invoices.read" },
  { label: "Fiscalité", permission: "fiscality.read" },
  { label: "Statistiques", permission: "analytics.read" },
  { label: "Réglages", permission: "settings.read" },
];

const navigationHref: Record<string, string> = { Planning: "/admin/planning" };

const ROLE_LABELS: Record<string, string> = {
  DISPATCHER: "Responsable planning",
  ACCOUNTING: "Comptabilité",
  ADMIN: "Administration",
};

export default async function AdminPage() {
  const user = await requireStaffPermission("backoffice.access", "/admin");
  const navigation = NAVIGATION.filter(({ permission }) => hasPermission(user.roles, permission));
  const roleLabels = user.roles.map((role) => ROLE_LABELS[role]).filter(Boolean);

  return <main className="admin-app"><aside><Link href="/" aria-label="Sergeant Paysage, accueil"><Image src="/logo-sergeant-paysage-blanc.png" alt="Sergeant Paysage" width={1784} height={387} priority /></Link><nav aria-label="Modules autorisés">{navigation.map((item) => navigationHref[item.label] ? <Link className="active" href={navigationHref[item.label]} key={item.label}>{item.label}</Link> : <span key={item.label}>{item.label}</span>)}</nav><div className="admin-identity"><strong>{user.fullName}</strong><small>{roleLabels.join(" · ")}</small><form action="/api/auth/sign-out" method="post"><button type="submit">Se déconnecter</button></form></div></aside><section><header><div><p>Espace entreprise sécurisé</p><h1>Tableau de bord</h1></div><span className="admin-session">Session 8 h</span></header><div className="admin-welcome"><p className="kicker">Autorisations actives</p><h2>Bonjour {user.fullName.split(" ")[0]}.</h2><p>Le planning opérationnel affiche maintenant les créneaux garantis et les équipes qui leur sont automatiquement affectées.</p><div>{roleLabels.map((label) => <span key={label}>{label}</span>)}</div></div><div className="admin-empty"><span>Étape 15</span><h2>Le planning est prêt à piloter.</h2><p>Consultez les missions confirmées, leurs informations essentielles et leur répartition par équipe. Les changements d’équipe et les comptes rendus seront traités par les modules opérationnels suivants.</p><Link className="text-link" href="/admin/planning">Ouvrir le planning <span>→</span></Link></div></section></main>;
}
