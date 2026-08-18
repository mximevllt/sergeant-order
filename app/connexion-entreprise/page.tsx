import Image from "next/image";
import Link from "@/app/site-link";
import { redirect } from "next/navigation";
import { hasAnyStaffRole } from "@/modules/authorization/policy.mjs";
import { getCurrentUser } from "@/modules/auth/server";
import { safePortalReturnTo } from "@/modules/auth/security.mjs";
import { StaffLoginForm } from "./staff-login-form";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  "lien-invalide": "Ce lien est invalide, déjà utilisé ou expiré. Demandez-en un nouveau.",
  "compte-bloque": "Ce compte ne peut pas se connecter. Contactez l’administrateur.",
  "service-indisponible": "Le service de connexion est momentanément indisponible.",
};

export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; erreur?: string }> }) {
  const parameters = await searchParams;
  const returnTo = safePortalReturnTo(parameters.returnTo, "STAFF");
  const user = await getCurrentUser();
  if (user?.sessionKind === "STAFF" && hasAnyStaffRole(user.roles)) redirect(returnTo);
  if (user) redirect("/acces-refuse?espace=entreprise");
  const errorMessage = parameters.erreur ? ERROR_MESSAGES[parameters.erreur] : null;

  return <main className="login-page staff-login-page"><section className="login-brand-panel"><Link href="/" aria-label="Sergeant Paysage, accueil"><Image src="/logo-sergeant-paysage-blanc.png" alt="Sergeant Paysage" width={1784} height={387} priority /></Link><div><p>Espace entreprise</p><h2>Chaque personne voit uniquement ce dont elle a besoin.</h2><ul><li>Compte nominatif sur invitation</li><li>Droits contrôlés côté serveur</li><li>Session entreprise limitée à 8 heures</li></ul></div></section><section className="login-card-wrap"><div className="login-card"><p className="kicker">Accès réservé à l’équipe</p><h1>Connectez-vous à votre poste.</h1><p>Utilisez l’adresse professionnelle invitée par l’administrateur. La réponse reste identique même lorsqu’une adresse n’est pas autorisée.</p>{errorMessage && <p className="login-banner" role="alert">{errorMessage}</p>}<StaffLoginForm returnTo={returnTo} /></div></section></main>;
}
