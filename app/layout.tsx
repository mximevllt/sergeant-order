import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "Sergeant Paysage — Réservez votre jardinier en ligne";
  const description = "Configurez votre intervention de jardinage, connaissez le prix et réservez votre créneau en ligne.";

  return {
    title,
    description,
    icons: { icon: "/logo-sergeant-paysage-blanc.png", shortcut: "/logo-sergeant-paysage-blanc.png" },
    openGraph: { title, description, type: "website", locale: "fr_FR", images: [{ url: `${origin}/og.png`, width: 1729, height: 910, alt: "Sergeant Paysage — Votre jardin entretenu, sans passer un seul appel." }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
