"use client";

import Link from "@/app/site-link";
import { FormEvent, useState } from "react";

type RequestState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent"; email: string; previewUrl?: string }
  | { status: "error"; message: string };

export function LoginForm({ returnTo }: { returnTo: string }) {
  const [state, setState] = useState<RequestState>({ status: "idle" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const fullName = String(data.get("fullName") ?? "").trim();
    setState({ status: "sending" });
    try {
      const response = await fetch("/api/auth/magic-link/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName, returnTo }),
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
    return <div className="login-confirmation" role="status"><span aria-hidden="true">✓</span><p>Vérifiez votre boîte email</p><h1>Votre lien est en route.</h1><p>Nous avons préparé un lien à usage unique pour <strong>{state.email}</strong>. Il reste valable 10 minutes.</p>{state.previewUrl && <a className="button button-primary" href={state.previewUrl}>Ouvrir le lien de test <span>→</span></a>}<button type="button" onClick={() => setState({ status: "idle" })}>Utiliser une autre adresse</button></div>;
  }

  return <form className="login-form" onSubmit={submit}><label>Adresse email<input name="email" type="email" inputMode="email" autoComplete="email" maxLength={254} required placeholder="vous@exemple.fr" /></label><label>Nom complet <small>utile lors de votre première connexion</small><input name="fullName" type="text" autoComplete="name" minLength={2} maxLength={120} placeholder="Prénom Nom" /></label>{state.status === "error" && <p className="login-error" role="alert">{state.message}</p>}<button className="button button-primary" type="submit" disabled={state.status === "sending"}>{state.status === "sending" ? "Envoi en cours…" : "Recevoir mon lien"}<span>→</span></button><p className="login-privacy">Aucun mot de passe à retenir. Le lien ne fonctionne qu’une fois et expire automatiquement.</p><Link href="/">← Retour au site</Link></form>;
}
