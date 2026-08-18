import Image from "next/image";
import Link from "@/app/site-link";
import { Footer, Header, SectionLabel } from "./components";

const services = [
  { name: "Tonte & finitions", desc: "Pelouse, bordures et nettoyage après tonte.", image: "/images/tonte.jpg" },
  { name: "Taille de haies", desc: "Une coupe nette, régulière et adaptée à vos végétaux.", image: "/images/haies.jpg" },
  { name: "Débroussaillage", desc: "Herbes hautes, végétation dense et zones difficiles.", image: "/images/debroussaillage.jpg" },
  { name: "Désherbage & massifs", desc: "Des massifs propres, aérés et remis en valeur.", image: "/images/massifs.jpg" },
  { name: "Nettoyage du jardin", desc: "Ramassage, soufflage et remise au propre complète.", image: "/images/nettoyage.jpg" },
  { name: "Entretien complet", desc: "Composez librement les priorités de votre jardin.", image: "/images/entretien.jpg" },
];

const testimonials = [
  ["Tout s’est fait en ligne, je n’étais même pas sur place. J’ai reçu les photos en fin d’intervention.", "Entretien de résidence secondaire · Cotignac"],
  ["Le prix et le créneau étaient clairs dès le départ. Le jardin était impeccable à notre retour.", "Tonte + taille de haies · Brignoles"],
  ["Une demi-journée a suffi pour reprendre tout ce que je repoussais depuis des semaines.", "Entretien complet · Le Val"],
];

export default function Home() {
  return (
    <main>
      <Header />
      <section className="hero" id="top">
        <div className="hero-copy reveal-now">
          <p className="kicker">Jardinage à domicile · Réservation en ligne</p>
          <h1>Votre jardin entretenu, <em>sans passer un seul appel.</em></h1>
          <p className="hero-lead">Choisissez les travaux, la durée et votre créneau. Votre prix se calcule immédiatement et nous venons avec tout le matériel.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/reserver">Commencer ma réservation <span>→</span></Link>
            <p>Déjà client ? <Link href="/espace-client">Reprogrammer une intervention</Link></p>
          </div>
          <div className="proofs" aria-label="Les engagements Sergeant Paysage">
            <span>✓ Prix connu à l’avance</span><span>✓ Matériel professionnel inclus</span><span>✓ Réservation 100 % en ligne</span><span>✓ Intervention assurée</span>
          </div>
          <p className="tax-note">Jusqu’à 50 % de crédit d’impôt sur les prestations éligibles*</p>
        </div>
        <div className="hero-visual reveal-now">
          <div className="hero-image-wrap"><Image src="/images/hero-gardener.jpg" alt="Paysagiste de dos entretenant une grande pelouse" width={1800} height={2400} sizes="(max-width: 820px) 92vw, 48vw" priority /></div>
          <div className="booking-float">
            <span className="booking-status">Réservé <b>✓</b></span>
            <small>Jeudi 20 août</small>
            <strong>08:00 — 12:00</strong>
            <p>Tonte + taille de haies<br />1 demi-journée</p>
          </div>
          <div className="hero-coordinate">43°24’ N<br />06°03’ E</div>
        </div>
      </section>

      <section className="section services-section" id="services">
        <SectionLabel number="01">Les services</SectionLabel>
        <div className="section-heading split-heading">
          <h2>Un jardinier pour ce qu’il y a <em>vraiment à faire.</em></h2>
          <p>Une seule tâche ou tout le jardin : composez librement votre intervention.</p>
        </div>
        <div className="service-grid">
          {services.map((service, index) => (
            <Link className="service-card" href={`/reserver?service=${encodeURIComponent(service.name)}`} key={service.name}>
              <figure><Image src={service.image} alt="" width={1000} height={668} sizes="(max-width: 560px) 88vw, (max-width: 1120px) 44vw, 29vw" /><span>0{index + 1}</span></figure>
              <div><h3>{service.name}</h3><p>{service.desc}</p><b>Réserver <span>→</span></b></div>
            </Link>
          ))}
        </div>
        <Link className="project-door" href="/projet"><span>Un projet plus important ?</span><b>Création, plantation, terrassement, arrosage…</b><i>→</i></Link>
      </section>

      <section className="dark-section how-section" id="fonctionnement">
        <SectionLabel number="02" light>Comment ça marche</SectionLabel>
        <div className="how-grid">
          <article><span>01</span><h3>Dites-nous ce qu’il faut faire</h3><p>Quelques questions simples nous permettent de prévoir le temps et le matériel nécessaires.</p></article>
          <article><span>02</span><h3>Choisissez votre créneau</h3><p>Les disponibilités affichées sont de vraies disponibilités.</p></article>
          <article><span>03</span><h3>On s’occupe du reste</h3><p>Votre jardinier arrive avec les informations et le matériel nécessaires.</p></article>
        </div>
        <Link className="button button-light" href="/reserver">Réserver une intervention <span>→</span></Link>
      </section>

      <section className="mission-section">
        <div className="mission-copy">
          <SectionLabel number="03" light>Préparation</SectionLabel>
          <h2>Vous n’avez rien à préparer. <em>Nous, si.</em></h2>
          <p>Toutes les informations sont transmises au jardinier avant son départ. Le bon matériel, le bon ordre de priorité, sans appel supplémentaire.</p>
        </div>
        <article className="mission-sheet">
          <header><div><span>Fiche mission</span><strong>Intervention #1842</strong></div><b>Prête</b></header>
          <div className="mission-columns">
            <div><small>01 · Tonte</small><p>280 m²<br />Herbe normale<br />Terrain plat</p></div>
            <div><small>02 · Haies</small><p>18 ml<br />1,8 m · 3 faces<br />Entretien courant</p></div>
            <div><small>03 · Accès</small><p>Portail 110 cm<br />Stationnement devant<br />Client absent</p></div>
          </div>
          <div className="equipment"><small>À prévoir</small><span>✓ Tondeuse</span><span>✓ Coupe-bordure</span><span>✓ Taille-haie</span><span>✓ Souffleur</span><span>✓ Remorque</span></div>
        </article>
      </section>

      <section className="section reviews-section">
        <div className="rating"><strong>4,9</strong><span>/ 5</span><p>★★★★★<br /><small>264 interventions évaluées</small></p></div>
        <div className="testimonials">
          {testimonials.map(([quote, context]) => <blockquote key={context}><p>“{quote}”</p><footer>{context}</footer></blockquote>)}
        </div>
      </section>

      <section className="tax-section">
        <div><SectionLabel number="04">Services à la personne</SectionLabel><h2>Votre jardin peut aussi coûter <em>deux fois moins cher.</em></h2></div>
        <div><p>Certaines prestations d’entretien de jardin sont éligibles au crédit d’impôt de 50 %, dans la limite réglementaire applicable.</p><span className="advance">Avance immédiate disponible</span><Link className="text-link" href="/tarifs#fiscalite">Comprendre le crédit d’impôt <span>→</span></Link></div>
      </section>

      <section className="section recurring-section">
        <SectionLabel number="05">Entretien régulier</SectionLabel>
        <h2>Et si votre jardin restait <em>toujours comme ça ?</em></h2>
        <div className="frequency-grid">
          <Link href="/reserver?recurrence=2-semaines">Toutes les 2 semaines<span>Jardin très suivi</span></Link>
          <Link className="recommended" href="/reserver?recurrence=4-semaines"><b>Recommandé</b>Toutes les 4 semaines<span>Le bon rythme saisonnier</span></Link>
          <Link href="/reserver?recurrence=6-semaines">Toutes les 6 semaines<span>Entretien essentiel</span></Link>
          <Link href="/reserver?recurrence=sur-mesure">Sur mesure<span>Un calendrier adapté</span></Link>
        </div>
      </section>

      <section className="faq-section" id="faq">
        <div><SectionLabel number="06" light>Questions fréquentes</SectionLabel><h2>Tout ce qu’il faut savoir, <em>avant de réserver.</em></h2></div>
        <div className="faq-list">
          {[
            ["Dois-je être présent ?", "Non. Vous pouvez nous transmettre les instructions d’accès au moment de la réservation."],
            ["Le matériel est-il inclus ?", "Oui, sauf mention contraire clairement indiquée lors de la réservation."],
            ["Que se passe-t-il s’il pleut ?", "Si la météo empêche correctement l’intervention, nous vous proposons un nouveau créneau sans frais."],
            ["Et si je me suis trompé sur la quantité de travail ?", "Votre réservation reste valable pour la durée réservée. Rien n’est ajouté sans votre accord."],
            ["Puis-je faire plusieurs travaux pendant la même demi-journée ?", "Oui. C’est même l’un des intérêts du service."],
          ].map(([q, a], i) => <details key={q} open={i === 0}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}
        </div>
      </section>
      <Footer />
    </main>
  );
}
