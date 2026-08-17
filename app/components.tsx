type SectionLabelProps = { number: string; children: React.ReactNode; light?: boolean };

export function SectionLabel({ number, children, light = false }: SectionLabelProps) {
  return <p className={`section-label${light ? " section-label-light" : ""}`}><span>{number}</span>{children}</p>;
}

export function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="Sergeant Paysage, accueil"><img src="/logo-sergeant-paysage-blanc.png" alt="Sergeant Paysage" /></a>
      <nav aria-label="Navigation principale">
        <details className="services-menu"><summary>Services <span>⌄</span></summary><div className="service-dropdown"><small>Entretenir mon jardin</small><a href="/reserver?service=tonte">Tonte & finitions</a><a href="/reserver?service=haies">Taille de haies</a><a href="/reserver?service=debroussaillage">Débroussaillage</a><a href="/reserver?service=massifs">Désherbage & massifs</a><a href="/reserver?service=nettoyage">Nettoyage du jardin</a><a href="/reserver?service=complet">Entretien complet</a><hr /><a href="/projet">Un projet plus important ? →</a></div></details>
        <a href="/comment-ca-marche">Comment ça marche</a>
        <a href="/tarifs">Tarifs</a>
        <a href="/#zone">Zone d’intervention</a>
      </nav>
      <a className="account-link" href="/espace-client"><span aria-hidden="true">◎</span> Mes interventions</a>
      <a className="button header-cta" href="/reserver">Réserver</a>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer" id="zone">
      <div className="footer-top"><div><img src="/logo-sergeant-paysage-blanc.png" alt="Sergeant Paysage" /><p>Un extérieur à la mesure de vos exigences.</p></div><div><small>Intervention</small><strong>Brignoles · Cotignac · Le Val<br />et communes alentours</strong></div><a className="button button-light" href="/reserver">Réserver <span>→</span></a></div>
      <div className="footer-links"><span>© 2026 Sergeant Paysage</span><a href="#">Mentions légales</a><a href="#">CGV</a><a href="#">Confidentialité</a><a href="#">Cookies</a><a href="#">Rétractation</a><a href="#">Résilier un contrat</a><a href="#">Médiation</a></div>
    </footer>
  );
}
