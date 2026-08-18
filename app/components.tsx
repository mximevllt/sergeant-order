import Image from "next/image";
import Link from "@/app/site-link";

type SectionLabelProps = { number: string; children: React.ReactNode; light?: boolean };

export function SectionLabel({ number, children, light = false }: SectionLabelProps) {
  return <p className={`section-label${light ? " section-label-light" : ""}`}><span>{number}</span>{children}</p>;
}

export function Header() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Sergeant Paysage, accueil"><Image src="/logo-sergeant-paysage-blanc.png" alt="Sergeant Paysage" width={1784} height={387} priority /></Link>
      <nav aria-label="Navigation principale">
        <details className="services-menu"><summary>Services <span>⌄</span></summary><div className="service-dropdown"><small>Entretenir mon jardin</small><a href="/reserver?service=tonte">Tonte & finitions</a><a href="/reserver?service=haies">Taille de haies</a><a href="/reserver?service=debroussaillage">Débroussaillage</a><a href="/reserver?service=massifs">Désherbage & massifs</a><a href="/reserver?service=nettoyage">Nettoyage du jardin</a><a href="/reserver?service=complet">Entretien complet</a><hr /><a href="/projet">Un projet plus important ? →</a></div></details>
        <Link href="/comment-ca-marche">Comment ça marche</Link>
        <Link href="/tarifs">Tarifs</Link>
        <Link href="/#zone">Zone d’intervention</Link>
      </nav>
      <Link className="account-link" href="/espace-client"><span aria-hidden="true">◎</span> Mes interventions</Link>
      <Link className="button header-cta" href="/reserver">Réserver</Link>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer" id="zone">
      <div className="footer-top"><div><Image src="/logo-sergeant-paysage-blanc.png" alt="Sergeant Paysage" width={1784} height={387} /><p>Un extérieur à la mesure de vos exigences.</p></div><div><small>Intervention</small><strong>Brignoles · Cotignac · Le Val<br />et communes alentours</strong></div><Link className="button button-light" href="/reserver">Réserver <span>→</span></Link></div>
      <div className="footer-links"><span>© 2026 Sergeant Paysage</span><span>Mentions légales</span><span>CGV</span><span>Confidentialité</span><span>Cookies</span><span>Rétractation</span><span>Résilier un contrat</span><span>Médiation</span></div>
    </footer>
  );
}
