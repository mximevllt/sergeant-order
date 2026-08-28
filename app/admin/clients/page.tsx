import { requireStaffPermission } from "@/modules/auth/server";
import { listCustomers } from "@/modules/backoffice/directory-service";
import { AdminSidebar } from "../admin-sidebar";

export const dynamic = "force-dynamic";
function date(value: string | null): string { return value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value)) : "Aucune commande"; }

export default async function ClientsPage() {
  const user = await requireStaffPermission("customers.read", "/admin/clients");
  const customers = await listCustomers();
  return <main className="admin-app"><AdminSidebar active="/admin/clients" fullName={user.fullName} roleLabel="Répertoire clients" /><section className="admin-directory"><header><div><p>Espace entreprise sécurisé</p><h1>Clients</h1></div><span className="admin-session">{customers.length} client{customers.length > 1 ? "s" : ""}</span></header><p className="directory-intro">Coordonnées et activité des clients enregistrés. Les informations affichées servent uniquement au suivi des prestations.</p>{customers.length ? <div className="directory-list customer-list">{customers.map((customer) => <article key={customer.id}><header><div><span>Client</span><h2>{customer.fullName}</h2></div><p>{customer.orders} commande{customer.orders > 1 ? "s" : ""}</p></header><div className="directory-details"><p><b>Email</b>{customer.email}</p><p><b>Téléphone</b>{customer.phone || "Non renseigné"}</p><p><b>Jardins</b>{customer.gardens}</p><p><b>Dernière activité</b>{date(customer.latestOrderAt)}</p></div></article>)}</div> : <Empty />}</section></main>;
}
function Empty() { return <article className="directory-empty"><span>○</span><h2>Aucun client</h2><p>Les clients créés lors d’une réservation apparaîtront ici.</p></article>; }
