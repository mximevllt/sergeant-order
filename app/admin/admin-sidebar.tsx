import Image from "next/image";
import Link from "@/app/site-link";

const items = [
  { label: "Planning", href: "/admin/planning" },
  { label: "Interventions", href: "/admin/interventions" },
  { label: "Clients", href: "/admin/clients" },
  { label: "Jardins", href: "/admin/jardins" },
  { label: "Équipes", href: "/admin/equipes" },
] as const;

type Props = { active?: (typeof items)[number]["href"]; fullName: string; roleLabel: string };

export function AdminSidebar({ active, fullName, roleLabel }: Props) {
  return <aside>
    <Link href="/" aria-label="Sergeant Paysage, accueil"><Image src="/logo-sergeant-paysage-blanc.png" alt="Sergeant Paysage" width={1784} height={387} priority /></Link>
    <nav aria-label="Modules entreprise">
      {items.map((item) => <Link className={item.href === active ? "active" : undefined} href={item.href} key={item.href}>{item.label}</Link>)}
    </nav>
    <div className="admin-identity"><strong>{fullName}</strong><small>{roleLabel}</small><form action="/api/auth/sign-out" method="post"><button type="submit">Se déconnecter</button></form></div>
  </aside>;
}
