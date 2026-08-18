import Link from "@/app/site-link";

export default async function AccessDeniedPage({ searchParams }: { searchParams: Promise<{ espace?: string }> }) {
  const { espace } = await searchParams;
  const company = espace === "entreprise";
  return <main className="access-denied"><section><p className="kicker">Accès refusé</p><h1>Ce compte n’a pas les autorisations nécessaires.</h1><p>{company ? "L’espace entreprise est réservé aux comptes invités. Déconnectez-vous, puis utilisez votre adresse professionnelle autorisée." : "Cet espace nécessite une session client. Déconnectez-vous, puis reconnectez-vous depuis l’espace personnel."}</p><form action="/api/auth/sign-out" method="post"><button className="button button-primary" type="submit">Se déconnecter</button></form><Link href={company ? "/connexion-entreprise" : "/connexion"}>Revenir à la connexion</Link></section></main>;
}
