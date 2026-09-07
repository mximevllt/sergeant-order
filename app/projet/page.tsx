"use client";

import Link from "@/app/site-link";
import { useEffect, useState, type FormEvent } from "react";
import { Footer, Header, SectionLabel } from "../components";

const categories = [
  ["creation", "Création de jardin"],
  ["amenagement", "Aménagement extérieur"],
  ["entretien", "Entretien paysager"],
  ["terrassement", "Terrassement"],
  ["maconnerie", "Maçonnerie"],
  ["elagage", "Élagage"],
  ["autre", "Autre demande"],
] as const;

type FormData = {
  firstName: string; lastName: string; phone: string; email: string;
  line1: string; postalCode: string; city: string;
  title: string; category: string; description: string; desiredDate: string; budget: string;
};

const blankForm: FormData = { firstName: "", lastName: "", phone: "", email: "", line1: "", postalCode: "", city: "", title: "", category: "amenagement", description: "", desiredDate: "", budget: "" };

export default function ProjectPage() {
  const [form, setForm] = useState<FormData>(blankForm);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  useEffect(() => { void (async () => {
    const response = await fetch("/api/project-requests", { cache: "no-store" }).catch(() => null);
    const data = await response?.json().catch(() => null) as { authenticated?: boolean; contact?: Partial<FormData>; address?: Partial<FormData> } | null;
    if (data?.authenticated) {
      setAuthenticated(true);
      setForm((current) => ({ ...current, firstName: data.contact?.firstName || "", lastName: data.contact?.lastName || "", phone: data.contact?.phone || "", email: data.contact?.email || "", line1: data.address?.line1 || "", postalCode: data.address?.postalCode || "", city: data.address?.city || "" }));
    }
    setLoading(false);
  })(); }, []);
  const update = (field: keyof FormData, value: string) => setForm((current) => ({ ...current, [field]: value }));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const response = await fetch("/api/project-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contact: { firstName: form.firstName, lastName: form.lastName, phone: form.phone, email: form.email }, address: { line1: form.line1, postalCode: form.postalCode, city: form.city }, project: { title: form.title, category: form.category, description: form.description, desiredDate: form.desiredDate || null, budget: form.budget || null } }) }).catch(() => null);
    const result = await response?.json().catch(() => ({})) as { error?: string } | null;
    if (!response?.ok) { setError(result?.error || "Le service est momentanément indisponible. Réessayez dans un instant."); setSaving(false); return; }
    setSent(true); setSaving(false);
  }
  return <main><Header /><section className="project-page"><div className="project-intro"><SectionLabel number="Projet">Étude séparée</SectionLabel><h1>Un projet <em>plus important ?</em></h1><p>Conception, terrassement, plantations ou travaux arboricoles : décrivez-nous le besoin sans le mélanger à la réservation instantanée.</p><div><strong>Pour l’entretien courant</strong><span>Tonte, haies, débroussaillage, massifs et nettoyage restent réservables immédiatement.</span><Link href="/reserver">Réserver un entretien →</Link></div></div>{sent ? <div className="project-success"><span>✓</span><h2>Votre projet est transmis.</h2><p>Notre équipe l’a reçu dans son espace de suivi et revient vers vous avec la bonne méthode d’étude.</p><Link className="button button-primary" href="/">Retour à l’accueil</Link></div> : <form className="project-form project-request-form" onSubmit={submit}>{authenticated && <p className="project-account-note">Vos coordonnées de compte ont été reprises. Vous pouvez les ajuster pour cette demande.</p>}{loading && <p className="project-account-note">Préparation de vos informations…</p>} {error && <p className="project-form-error" role="alert">{error}</p>}<fieldset><legend>Vos coordonnées</legend><div className="project-two-columns"><label>Prénom<input required autoComplete="given-name" maxLength={120} value={form.firstName} onChange={(event) => update("firstName", event.target.value)} /></label><label>Nom<input required autoComplete="family-name" maxLength={120} value={form.lastName} onChange={(event) => update("lastName", event.target.value)} /></label><label>Téléphone<input type="tel" autoComplete="tel" maxLength={40} value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="06 12 34 56 78" /></label><label>E-mail<input required type="email" autoComplete="email" maxLength={254} value={form.email} onChange={(event) => update("email", event.target.value)} /></label></div></fieldset><fieldset><legend>Lieu du projet</legend><label>Adresse<input required autoComplete="street-address" maxLength={240} value={form.line1} onChange={(event) => update("line1", event.target.value)} placeholder="Numéro et voie" /></label><div className="project-two-columns"><label>Code postal<input required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} value={form.postalCode} onChange={(event) => update("postalCode", event.target.value)} /></label><label>Ville<input required autoComplete="address-level2" maxLength={120} value={form.city} onChange={(event) => update("city", event.target.value)} /></label></div></fieldset><fieldset><legend>Votre demande</legend><label>Objet de la demande<input required maxLength={160} value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Ex. Réaménagement complet du jardin" /></label><label>Type de besoin<select value={form.category} onChange={(event) => update("category", event.target.value)}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Ce que vous souhaitez<textarea required maxLength={4000} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Résultat attendu, éléments à conserver, style souhaité…" /></label><div className="project-two-columns"><label>Date ou période souhaitée<input type="date" value={form.desiredDate} onChange={(event) => update("desiredDate", event.target.value)} /></label><label>Budget évoqué<input type="number" min="0" max="99999999" step="0.01" inputMode="decimal" value={form.budget} onChange={(event) => update("budget", event.target.value)} placeholder="€ TTC" /></label></div></fieldset><button className="button button-primary" type="submit" disabled={saving}>{saving ? "Transmission…" : "Faire étudier mon projet →"}</button></form>}</section><Footer /></main>;
}
