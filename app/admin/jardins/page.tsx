import { requireStaffPermission } from "@/modules/auth/server";
import { listGardens } from "@/modules/backoffice/directory-service";
import { AdminSidebar } from "../admin-sidebar";

export const dynamic = "force-dynamic";
const slopes: Record<string, string> = { FLAT: "Plat", GENTLE: "Légère pente", STEEP: "Pente forte", UNKNOWN: "À préciser" };

export default async function JardinsPage() {
  const user = await requireStaffPermission("gardens.read", "/admin/jardins");
  const gardens = await listGardens();
  return <main className="admin-app"><AdminSidebar active="/admin/jardins" fullName={user.fullName} roleLabel="Parc de jardins" /><section className="admin-directory"><header><div><p>Espace entreprise sécurisé</p><h1>Jardins</h1></div><span className="admin-session">{gardens.length} jardin{gardens.length > 1 ? "s" : ""}</span></header><p className="directory-intro">Les jardins associés aux clients et aux commandes, pour préparer chaque intervention avec le bon contexte.</p>{gardens.length ? <div className="directory-list">{gardens.map((garden) => <article key={garden.id}><header><div><span>{garden.customerName}</span><h2>{garden.label}</h2></div><p>{garden.orders} commande{garden.orders > 1 ? "s" : ""}</p></header><div className="directory-details"><p className="detail-wide"><b>Adresse</b>{garden.address}</p><p><b>Surface</b>{garden.surfaceM2 ? `${garden.surfaceM2} m²` : "Non renseignée"}</p><p><b>Terrain</b>{slopes[garden.slope] ?? garden.slope}</p></div></article>)}</div> : <Empty />}</section></main>;
}
function Empty() { return <article className="directory-empty"><span>○</span><h2>Aucun jardin</h2><p>Les jardins enregistrés par les clients apparaîtront ici.</p></article>; }
