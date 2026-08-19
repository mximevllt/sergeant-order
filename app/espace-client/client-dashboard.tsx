"use client";

import Image from "next/image";
import Link from "@/app/site-link";
import { useState, type FormEvent } from "react";
import type { CustomerProfile, Garden, TerrainSlope } from "@/modules/customer/service";
import type { QuoteView } from "@/modules/quotes/service";

const views = ["Accueil", "Mes devis", "Mes interventions", "Mes jardins", "Factures & fiscalité", "Mon profil"] as const;
type View = typeof views[number];
type RequestState = { kind: "idle" | "saving" | "success" | "error"; message?: string };

const emptyGarden = (): Garden => ({ id: "", label: "", addressLabel: null, line1: "", line2: null, postalCode: "", city: "", surfaceM2: null, terrainSlope: "UNKNOWN", accessWidthCm: null, hasAnimals: false, parkingNotes: null, publicNotes: null });

export function ClientDashboard({ initialProfile, initialGardens, initialQuotes }: { initialProfile: CustomerProfile; initialGardens: Garden[]; initialQuotes: QuoteView[] }) {
  const [view, setView] = useState<View>("Accueil");
  const [profile, setProfile] = useState(initialProfile);
  const [gardens, setGardens] = useState(initialGardens);
  const [quotes, setQuotes] = useState(initialQuotes);
  const firstName = profile.fullName.split(/\s+/u)[0] || "Bonjour";
  const initials = profile.fullName.split(/\s+/u).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "SP";
  return <main className="client-app"><aside className="client-nav"><Link href="/" aria-label="Sergeant Paysage, accueil"><Image src="/logo-sergeant-paysage-blanc.png" alt="Sergeant Paysage" width={1784} height={387} priority /></Link><nav aria-label="Espace client">{views.map((item) => <button type="button" key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item}</button>)}</nav><form action="/api/auth/sign-out" method="post"><button type="submit">Se déconnecter</button></form><Link href="/">← Retour au site</Link></aside><section className="client-content"><header><div><p>Espace client sécurisé</p><h1>Bonjour {firstName},</h1></div><span aria-label={`Compte de ${profile.fullName}`}>{initials}</span></header>
    {view === "Accueil" && <AccountHome email={profile.email} gardenCount={gardens.length} quoteCount={quotes.filter(({ status }) => status === "PRICED" || status === "DRAFT" || status === "SLOT_HELD").length} openGardens={() => setView("Mes jardins")} openQuotes={() => setView("Mes devis")} />}
    {view === "Mes devis" && <Quotes quotes={quotes} onChange={setQuotes} />}
    {view === "Mes interventions" && <EmptySection title="Mes interventions" text="Vos prochaines interventions et leur suivi apparaîtront ici dès votre première réservation." action="Réserver une intervention" href="/reserver" />}
    {view === "Mes jardins" && <Gardens gardens={gardens} onChange={setGardens} />}
    {view === "Factures & fiscalité" && <EmptySection title="Factures & fiscalité" text="Vos factures, avoirs et attestations fiscales seront disponibles dans cet espace." />}
    {view === "Mon profil" && <Profile profile={profile} onChange={setProfile} />}
  </section></main>;
}

function AccountHome({ email, gardenCount, quoteCount, openGardens, openQuotes }: { email: string; gardenCount: number; quoteCount: number; openGardens: () => void; openQuotes: () => void }) {
  return <><article className="account-ready-card"><div><span>Compte opérationnel</span><h2>Votre email est vérifié.</h2><p>{email}</p></div><i aria-hidden="true">✓</i></article><div className="account-start-grid"><article><span>Mes devis</span><h3>{quoteCount ? `${quoteCount} devis à reprendre` : "Planifier une intervention"}</h3><p>Vos devis sont conservés avec le tarif et toutes les réponses du configurateur.</p>{quoteCount ? <button type="button" className="text-action" onClick={openQuotes}>Voir mes devis →</button> : <Link href="/reserver">Commencer un devis →</Link>}</article><article><span>Mes adresses</span><h3>{gardenCount ? `${gardenCount} jardin${gardenCount > 1 ? "s" : ""} enregistré${gardenCount > 1 ? "s" : ""}` : "Ajoutez votre jardin"}</h3><p>Préparez l’adresse et les consignes utiles avant votre réservation.</p><button type="button" className="text-action" onClick={openGardens}>{gardenCount ? "Gérer mes jardins" : "Ajouter un jardin"} →</button></article></div></>;
}

function Quotes({ quotes, onChange }: { quotes: QuoteView[]; onChange: (quotes: QuoteView[]) => void }) {
  const [state, setState] = useState<RequestState>({ kind: "idle" });
  async function cancel(quote: QuoteView) {
    if (!window.confirm(`Annuler le devis ${quote.publicReference} ?`)) return;
    setState({ kind: "saving" });
    const response = await fetch(`/api/quotes/${quote.id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) return setState({ kind: "error", message: "Le devis n’a pas pu être annulé." });
    onChange(quotes.map((item) => item.id === quote.id ? { ...item, status: "CANCELLED" } : item));
    setState({ kind: "success", message: "Le devis a été annulé." });
  }
  const statusLabel: Record<string, string> = { DRAFT: "Brouillon", PRICED: "Tarif enregistré", EXPIRED: "Expiré", CANCELLED: "Annulé", SLOT_HELD: "Créneau provisoire", ACCEPTED: "Accepté" };
  return <><div className="dashboard-heading"><div><h2 className="dashboard-title">Mes devis</h2><p>Retrouvez le tarif, les prestations et toutes les informations déjà renseignées.</p></div><Link className="button button-primary" href="/reserver">Nouveau devis <span>＋</span></Link></div>{state.message && <Status state={state} />}{!quotes.length ? <article className="client-empty"><span aria-hidden="true">◇</span><h3>Aucun devis enregistré.</h3><p>Commencez le configurateur : votre progression sera sauvegardée automatiquement.</p><Link className="button button-primary" href="/reserver">Créer mon premier devis <span>→</span></Link></article> : <div className="quote-grid">{quotes.map((quote) => <article className="quote-card" key={quote.id}><header><div><span>{statusLabel[quote.status] ?? quote.status}</span><h3>{quote.publicReference}</h3></div><strong>{new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(quote.totalTtcCents / 100)}</strong></header><p>{quote.tasks.map(({ label }) => label).join(" · ")}</p><small>Mis à jour le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(quote.updatedAt))}</small><footer>{(["PRICED", "DRAFT", "SLOT_HELD"].includes(quote.status)) && <><Link href={`/reserver?devis=${encodeURIComponent(quote.id)}`}>{quote.status === "SLOT_HELD" ? "Modifier le créneau" : "Reprendre le devis"} →</Link><button type="button" onClick={() => void cancel(quote)}>Annuler</button></>}</footer></article>)}</div>}</>;
}

function EmptySection({ title, text, action, href }: { title: string; text: string; action?: string; href?: string }) {
  return <><h2 className="dashboard-title">{title}</h2><article className="client-empty"><span aria-hidden="true">○</span><h3>Rien à afficher pour le moment.</h3><p>{text}</p>{action && href && <Link className="button button-primary" href={href}>{action}<span>→</span></Link>}</article></>;
}

function Gardens({ gardens, onChange }: { gardens: Garden[]; onChange: (gardens: Garden[]) => void }) {
  const [editing, setEditing] = useState<Garden | null>(null);
  const [state, setState] = useState<RequestState>({ kind: "idle" });
  async function archive(garden: Garden) {
    if (!window.confirm(`Retirer « ${garden.label} » de vos jardins ?`)) return;
    setState({ kind: "saving" });
    const response = await fetch(`/api/customer/gardens/${garden.id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) return setState({ kind: "error", message: "Le jardin n’a pas pu être retiré. Réessayez." });
    onChange(gardens.filter(({ id }) => id !== garden.id)); setEditing(null);
    setState({ kind: "success", message: "Le jardin a été retiré de votre espace." });
  }
  return <><div className="dashboard-heading"><div><h2 className="dashboard-title">Mes jardins</h2><p>Adresses, accès et consignes utiles à vos interventions.</p></div><button type="button" className="button button-primary" onClick={() => { setEditing(emptyGarden()); setState({ kind: "idle" }); }}>Ajouter un jardin <span>＋</span></button></div>
    {state.message && <Status state={state} />}
    {editing && <GardenForm garden={editing} onCancel={() => setEditing(null)} onSaved={(saved) => { onChange(gardens.some(({ id }) => id === saved.id) ? gardens.map((item) => item.id === saved.id ? saved : item) : [saved, ...gardens]); setEditing(null); setState({ kind: "success", message: "Votre jardin est enregistré." }); }} onArchive={editing.id ? () => archive(editing) : undefined} />}
    {!gardens.length && !editing ? <article className="client-empty"><span aria-hidden="true">⌂</span><h3>Aucun jardin enregistré.</h3><p>Ajoutez votre première adresse d’intervention. Vous pourrez la sélectionner pendant une réservation.</p><button className="button button-primary" type="button" onClick={() => setEditing(emptyGarden())}>Ajouter mon premier jardin <span>→</span></button></article> : <div className="garden-grid">{gardens.map((garden) => <article className="garden-card" key={garden.id}><span>Jardin enregistré</span><h3>{garden.label}</h3><p>{garden.line1}{garden.line2 ? <><br />{garden.line2}</> : null}<br />{garden.postalCode} {garden.city}</p><dl><div><dt>Surface</dt><dd>{garden.surfaceM2 === null ? "Non renseignée" : `${garden.surfaceM2.toLocaleString("fr-FR")} m²`}</dd></div><div><dt>Accès</dt><dd>{garden.accessWidthCm === null ? "Non renseigné" : `${garden.accessWidthCm} cm`}</dd></div></dl><button type="button" onClick={() => { setEditing(garden); setState({ kind: "idle" }); }}>Modifier les informations</button></article>)}</div>}
  </>;
}

function GardenForm({ garden, onCancel, onSaved, onArchive }: { garden: Garden; onCancel: () => void; onSaved: (garden: Garden) => void; onArchive?: () => void }) {
  const [form, setForm] = useState(garden);
  const [state, setState] = useState<RequestState>({ kind: "idle" });
  const change = (key: keyof Garden, value: string | number | boolean | null) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault(); setState({ kind: "saving" });
    const payload = { ...form, address: { label: form.addressLabel, line1: form.line1, line2: form.line2, postalCode: form.postalCode, city: form.city } };
    const response = await fetch(form.id ? `/api/customer/gardens/${form.id}` : "/api/customer/gardens", { method: form.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
    if (!response) return setState({ kind: "error", message: "Le service est momentanément indisponible." });
    const result = await response.json().catch(() => ({})) as { garden?: Garden; fields?: Record<string, string> };
    if (!response.ok || !result.garden) return setState({ kind: "error", message: Object.values(result.fields ?? {})[0] ?? "Vérifiez les informations saisies." });
    onSaved(result.garden);
  }
  return <form className="garden-form" onSubmit={submit}><header><div><span>{form.id ? "Modification" : "Nouveau jardin"}</span><h3>{form.id ? form.label : "Informations du lieu"}</h3></div><button type="button" onClick={onCancel} aria-label="Fermer le formulaire">×</button></header>{state.message && <Status state={state} />}<div className="form-columns"><fieldset><legend>Adresse d’intervention</legend><label>Nom du jardin<input required maxLength={80} value={form.label} onChange={(e) => change("label", e.target.value)} placeholder="Maison, bureaux, résidence…" /></label><label>Adresse<input required autoComplete="street-address" maxLength={160} value={form.line1} onChange={(e) => change("line1", e.target.value)} placeholder="Numéro et voie" /></label><label>Complément<input maxLength={160} value={form.line2 ?? ""} onChange={(e) => change("line2", e.target.value || null)} placeholder="Bâtiment, lieu-dit…" /></label><div className="compact-fields"><label>Code postal<input required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} value={form.postalCode} onChange={(e) => change("postalCode", e.target.value)} /></label><label>Ville<input required maxLength={100} value={form.city} onChange={(e) => change("city", e.target.value)} /></label></div></fieldset><fieldset><legend>Caractéristiques utiles</legend><div className="compact-fields"><label>Surface approximative (m²)<input type="number" min={0} max={1000000} value={form.surfaceM2 ?? ""} onChange={(e) => change("surfaceM2", e.target.value === "" ? null : Number(e.target.value))} /></label><label>Largeur du passage (cm)<input type="number" min={30} max={2000} value={form.accessWidthCm ?? ""} onChange={(e) => change("accessWidthCm", e.target.value === "" ? null : Number(e.target.value))} /></label></div><label>Inclinaison du terrain<select value={form.terrainSlope} onChange={(e) => change("terrainSlope", e.target.value as TerrainSlope)}><option value="UNKNOWN">Je ne sais pas</option><option value="FLAT">Plat</option><option value="GENTLE">Légèrement incliné</option><option value="STEEP">Fortement incliné</option></select></label><label className="check-line"><input type="checkbox" checked={form.hasAnimals} onChange={(e) => change("hasAnimals", e.target.checked)} /> Des animaux peuvent être présents</label><label>Stationnement<textarea maxLength={500} value={form.parkingNotes ?? ""} onChange={(e) => change("parkingNotes", e.target.value || null)} placeholder="Où l’équipe peut-elle stationner ?" /></label><label>Consignes générales<textarea maxLength={1000} value={form.publicNotes ?? ""} onChange={(e) => change("publicNotes", e.target.value || null)} placeholder="Informations utiles, sans code d’accès ni donnée sensible." /></label></fieldset></div><footer><button type="submit" className="button button-primary" disabled={state.kind === "saving"}>{state.kind === "saving" ? "Enregistrement…" : "Enregistrer le jardin"}<span>→</span></button><button type="button" className="button-secondary" onClick={onCancel}>Annuler</button>{onArchive && <button type="button" className="danger-action" onClick={onArchive}>Retirer ce jardin</button>}</footer></form>;
}

function Profile({ profile, onChange }: { profile: CustomerProfile; onChange: (profile: CustomerProfile) => void }) {
  const [form, setForm] = useState(profile);
  const [state, setState] = useState<RequestState>({ kind: "idle" });
  const organization = form.organization ?? { legalName: "", tradeName: null, siren: null, vatNumber: null, billingEmail: form.email, billingAddress: { label: null, line1: "", line2: null, postalCode: "", city: "" } };
  const updateOrganization = (updates: Partial<typeof organization>) => setForm((current) => ({ ...current, organization: { ...organization, ...updates } }));
  async function submit(event: FormEvent) {
    event.preventDefault(); setState({ kind: "saving" });
    const response = await fetch("/api/customer/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).catch(() => null);
    if (!response) return setState({ kind: "error", message: "Le service est momentanément indisponible." });
    const result = await response.json().catch(() => ({})) as { profile?: CustomerProfile; fields?: Record<string, string>; error?: string };
    if (!response.ok || !result.profile) return setState({ kind: "error", message: result.error === "SIREN_ALREADY_USED" ? "Ce SIREN est déjà rattaché à un autre compte." : Object.values(result.fields ?? {})[0] ?? "Vérifiez les informations saisies." });
    setForm(result.profile); onChange(result.profile); setState({ kind: "success", message: "Vos coordonnées ont été mises à jour." });
  }
  return <><h2 className="dashboard-title">Mon profil</h2><form className="profile-card" onSubmit={submit}>{state.message && <Status state={state} />}<fieldset><legend>Vos coordonnées</legend><label>Nom complet<input required autoComplete="name" maxLength={120} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label><label>Email vérifié<input value={form.email} readOnly /><small>Pour votre sécurité, un changement d’email nécessitera une nouvelle vérification.</small></label><label>Téléphone<input autoComplete="tel" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value || null })} placeholder="06 12 34 56 78" /></label></fieldset><fieldset><legend>Type de compte</legend><div className="profile-type"><label><input type="radio" name="customerType" checked={form.customerType === "INDIVIDUAL"} onChange={() => setForm({ ...form, customerType: "INDIVIDUAL" })} /> Particulier</label><label><input type="radio" name="customerType" checked={form.customerType === "PROFESSIONAL"} onChange={() => setForm({ ...form, customerType: "PROFESSIONAL", organization })} /> Professionnel</label></div></fieldset>{form.customerType === "PROFESSIONAL" && <fieldset><legend>Entreprise et facturation</legend><label>Raison sociale<input required maxLength={160} value={organization.legalName} onChange={(e) => updateOrganization({ legalName: e.target.value })} /></label><label>Nom commercial<input maxLength={160} value={organization.tradeName ?? ""} onChange={(e) => updateOrganization({ tradeName: e.target.value || null })} /></label><div className="compact-fields"><label>SIREN<input inputMode="numeric" pattern="[0-9 ]{9,12}" value={organization.siren ?? ""} onChange={(e) => updateOrganization({ siren: e.target.value || null })} /></label><label>TVA intracommunautaire<input value={organization.vatNumber ?? ""} onChange={(e) => updateOrganization({ vatNumber: e.target.value || null })} /></label></div><label>Email de facturation<input required type="email" value={organization.billingEmail} onChange={(e) => updateOrganization({ billingEmail: e.target.value })} /></label><label>Adresse de facturation<input required maxLength={160} value={organization.billingAddress.line1} onChange={(e) => updateOrganization({ billingAddress: { ...organization.billingAddress, line1: e.target.value } })} /></label><label>Complément<input maxLength={160} value={organization.billingAddress.line2 ?? ""} onChange={(e) => updateOrganization({ billingAddress: { ...organization.billingAddress, line2: e.target.value || null } })} /></label><div className="compact-fields"><label>Code postal<input required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} value={organization.billingAddress.postalCode} onChange={(e) => updateOrganization({ billingAddress: { ...organization.billingAddress, postalCode: e.target.value } })} /></label><label>Ville<input required maxLength={100} value={organization.billingAddress.city} onChange={(e) => updateOrganization({ billingAddress: { ...organization.billingAddress, city: e.target.value } })} /></label></div></fieldset>}<button type="submit" disabled={state.kind === "saving"}>{state.kind === "saving" ? "Enregistrement…" : "Enregistrer mes coordonnées"}</button></form></>;
}

function Status({ state }: { state: RequestState }) {
  if (!state.message) return null;
  return <p className={`form-status ${state.kind === "error" ? "error" : "success"}`} role={state.kind === "error" ? "alert" : "status"}>{state.message}</p>;
}
