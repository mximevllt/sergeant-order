import Image from "next/image";
import Link from "@/app/site-link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/server";
import { safeReturnTo } from "@/modules/auth/security.mjs";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  "lien-invalide": "Ce lien est invalide, déjà utilisé ou expiré. Demandez-en un nouveau.",
  "compte-bloque": "Ce compte ne peut pas se connecter. Contactez SERGEANT PAYSAGE.",
  "service-indisponible": "Le service de connexion est momentanément indisponible.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; erreur?: string }> }) {
  const parameters = await searchParams;
  const returnTo = safeReturnTo(parameters.returnTo);
  const user = await getCurrentUser();
  if (user) redirect(returnTo);
  const errorMessage = parameters.erreur ? ERROR_MESSAGES[parameters.erreur] : null;

  return <main className="login-page"><section className="login-brand-panel"><Link href="/" aria-label="Sergeant Paysage, accueil"><Image src="/logo-sergeant-paysage-blanc.png" alt="Sergeant Paysage" width={1784} height={387} priority /></Link><div><p>Espace personnel</p><h2>Vos jardins, interventions et documents au même endroit.</h2><ul><li>Email vérifié</li><li>Connexion sans mot de passe</li><li>Session révocable à tout moment</li></ul></div></section><section className="login-card-wrap"><div className="login-card"><p className="kicker">Connexion sécurisée</p><h1>Accédez à votre espace.</h1><p>Indiquez votre adresse email. Nous vous envoyons un lien personnel pour vous connecter.</p>{errorMessage && <p className="login-banner" role="alert">{errorMessage}</p>}<LoginForm returnTo={returnTo} /></div></section></main>;
}
