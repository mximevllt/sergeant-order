import { Footer, Header, SectionLabel } from "../components";

const services = [
  ["Tonte & finitions", "Pelouse, bordures et finitions nettes.", "/images/tonte.jpg", "/reserver?service=tonte"],
  ["Taille de haies", "Entretien courant, dessus et côtés.", "/images/haies.jpg", "/services/taille-haies"],
  ["Débroussaillage", "Zones denses, herbes hautes et ronces.", "/images/debroussaillage.jpg", "/reserver?service=debroussaillage"],
  ["Désherbage & massifs", "Massifs, graviers, pavés et potager.", "/images/massifs.jpg", "/reserver?service=massifs"],
  ["Nettoyage du jardin", "Feuilles, ramassage et remise au propre.", "/images/nettoyage.jpg", "/reserver?service=nettoyage"],
  ["Entretien complet", "Plusieurs travaux, dans l’ordre de vos priorités.", "/images/entretien.jpg", "/reserver?service=complet"],
];

export default function ServicesPage() {
  return <main><Header /><section className="inner-hero"><SectionLabel number="Services">Entretien à domicile</SectionLabel><h1>Qu’est-ce qu’on fait <em>dans le jardin ?</em></h1><p>Six prestations réservables directement en ligne. Vous pouvez les combiner librement dans la même intervention.</p></section><section className="section inner-service-grid">{services.map(([name,desc,image,href],i) => <a href={href} className="inner-service-card" key={name}><figure><img src={image} alt="" /><span>0{i+1}</span></figure><div><h2>{name}</h2><p>{desc}</p><b>Voir le service →</b></div></a>)}</section><section className="combo-band"><div><span>Tonte</span><b>✓</b></div><i>+</i><div><span>Haies</span><b>✓</b></div><i>+</i><div><span>Massifs</span><b>✓</b></div><strong>→ 1 demi-journée</strong><a className="button button-light" href="/reserver">Composer mon intervention</a></section><Footer /></main>;
}
