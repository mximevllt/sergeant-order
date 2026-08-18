"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const views = ["Accueil", "Mes interventions", "Mes jardins", "Factures & fiscalité", "Mon profil"] as const;
type View = typeof views[number];

export function ClientDashboard({ fullName, email, phone }: { fullName: string; email: string; phone: string | null }) {
  const [view, setView] = useState<View>("Accueil");
  const firstName = fullName.split(/\s+/u)[0] || "Bonjour";
  const initials = fullName.split(/\s+/u).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "SP";
  return <main className="client-app"><aside className="client-nav"><Link href="/" aria-label="Sergeant Paysage, accueil"><Image src="/logo-sergeant-paysage-blanc.png" alt="Sergeant Paysage" width={1784} height={387} priority /></Link><nav aria-label="Espace client">{views.map((item) => <button type="button" key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item}</button>)}</nav><form action="/api/auth/sign-out" method="post"><button type="submit">Se déconnecter</button></form><Link href="/">← Retour au site</Link></aside><section className="client-content"><header><div><p>Espace client sécurisé</p><h1>Bonjour {firstName},</h1></div><span aria-label={`Compte de ${fullName}`}>{initials}</span></header>{view === "Accueil" && <AccountHome email={email} />}{view === "Mes interventions" && <EmptySection title="Mes interventions" text="Vos prochaines interventions et leur suivi apparaîtront ici dès votre première réservation." action="Réserver une intervention" href="/reserver" />}{view === "Mes jardins" && <EmptySection title="Mes jardins" text="Les adresses et consignes enregistrées pendant vos réservations seront regroupées ici." action="Ajouter mon premier jardin" href="/reserver" />}{view === "Factures & fiscalité" && <EmptySection title="Factures & fiscalité" text="Vos factures, avoirs et attestations fiscales seront disponibles dans cet espace." />}{view === "Mon profil" && <Profile fullName={fullName} email={email} phone={phone} />}</section></main>;
}

function AccountHome({ email }: { email: string }) {
  return <><article className="account-ready-card"><div><span>Compte opérationnel</span><h2>Votre email est vérifié.</h2><p>{email}</p></div><i aria-hidden="true">✓</i></article><div className="account-start-grid"><article><span>Première étape</span><h3>Planifier une intervention</h3><p>Configurez votre besoin et choisissez votre créneau disponible.</p><Link href="/reserver">Commencer ma réservation →</Link></article><article><span>Sécurité</span><h3>Connexion sans mot de passe</h3><p>Chaque lien reçu par email est personnel, temporaire et utilisable une seule fois.</p></article></div></>;
}

function EmptySection({ title, text, action, href }: { title: string; text: string; action?: string; href?: string }) {
  return <><h2 className="dashboard-title">{title}</h2><article className="client-empty"><span aria-hidden="true">○</span><h3>Rien à afficher pour le moment.</h3><p>{text}</p>{action && href && <Link className="button button-primary" href={href}>{action}<span>→</span></Link>}</article></>;
}

function Profile({ fullName, email, phone }: { fullName: string; email: string; phone: string | null }) {
  return <><h2 className="dashboard-title">Mon profil</h2><div className="profile-card"><label>Nom complet<input value={fullName} readOnly /></label><label>Email vérifié<input value={email} readOnly /></label><label>Téléphone<input value={phone ?? "À compléter lors de votre réservation"} readOnly /></label><p>La modification du profil et des coordonnées sera activée avec le module clients et jardins.</p></div></>;
}
