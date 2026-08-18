"use client";

import Link from "@/app/site-link";
import { FormEvent, useState } from "react";

type RequestState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent"; email: string; previewUrl?: string }
  | { status: "error"; message: string };

export function StaffLoginForm({ returnTo }: { returnTo: string }) {
  const [state, setState] = useState<RequestState>({ status: "idle" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    setState({ status: "sending" });
    try {
      const response = await fetch("/api/auth/staff/magic-link/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, returnTo }),
      });
      const payload = await response.json() as { previewUrl?: string; message?: string };
      if (!response.ok) {
        setState({ status: "error", message: payload.message ?? "Impossible d’envoyer le lien pour le moment." });
        return;
      }
      setState({ status: "sent", email, previewUrl: payload.previewUrl });
      form.reset();
    } catch {
      setState({ status: "error", message: "Impossible de contacter le service de connexion." });
    }
  }

  if (state.status === "sent") {
    return <div className="login-confirmation" role="status"><span aria-hidden="true">✓</span><p>Demande prise en compte</p><h1>Consultez votre messagerie.</h1><p>Si <strong>{state.email}</strong> correspond à un compte autorisé, le lien personnel reste valable 10 minutes.</p>{state.previewUrl && <a className="button button-primary" href={state.previewUrl}>Ouvrir le lien de test <span>→</span></a>}<button type="button" onClick={() => setState({ status: "idle" })}>Utiliser une autre adresse</button></div>;
  }

  return <form className="login-form" onSubmit={submit}><label>Adresse email professionnelle<input name="email" type="email" inputMode="email" autoComplete="email" maxLength={254} required placeholder="prenom@sergeant-paysage.fr" /></label>{state.status === "error" && <p className="login-error" role="alert">{state.message}</p>}<button className="button button-primary" type="submit" disabled={state.status === "sending"}>{state.status === "sending" ? "Vérification…" : "Recevoir mon accès"}<span>→</span></button><p className="login-privacy">Seules les personnes préalablement invitées peuvent ouvrir l’espace entreprise.</p><Link href="/">← Retour au site</Link></form>;
}
