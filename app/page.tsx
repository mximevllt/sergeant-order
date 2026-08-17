"use client";

import { useMemo, useState } from "react";
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
  const [lawn, setLawn] = useState(true);
  const [hedges, setHedges] = useState(true);
  const [surface, setSurface] = useState(250);
  const [length, setLength] = useState(18);
  const estimate = useMemo(() => {
    const workload = (lawn ? surface / 125 : 0) + (hedges ? length / 9 : 0);
    const blocks = Math.max(1, Math.ceil(workload / 4));
    return { blocks, price: 219 * blocks };
  }, [lawn, hedges, surface, length]);

  return (
    <main>
      <Header />
      <section className="hero" id="top">
        <div className="hero-copy reveal-now">
          <p className="kicker">Jardinage à domicile · Réservation en ligne</p>
          <h1>Votre jardin entretenu, <em>sans passer un seul appel.</em></h1>
          <p className="hero-lead">Choisissez les travaux, la durée et votre créneau. Votre prix se calcule immédiatement et nous venons avec tout le matériel.</p>
          <form className="postcode-form" action="/reserver">
            <label htmlFor="cp">Code postal du jardin</label>
            <div className="postcode-row">
              <input id="cp" name="cp" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} defaultValue="83170" aria-describedby="postcode-help" />
              <button className="button button-primary" type="submit">Commencer ma réservation <span>→</span></button>
            </div>
            <p id="postcode-help" className="form-meta">Déjà client ? <a href="/espace-client">Reprogrammer une intervention</a></p>
          </form>
          <div className="proofs" aria-label="Les engagements Sergeant Paysage">
            <span>✓ Prix connu à l’avance</span><span>✓ Matériel professionnel inclus</span><span>✓ Réservation 100 % en ligne</span><span>✓ Intervention assurée</span>
          </div>
          <p className="tax-note">Jusqu’à 50 % de crédit d’impôt sur les prestations éligibles*</p>
        </div>
        <div className="hero-visual reveal-now">
          <div className="hero-image-wrap"><img src="/images/hero-gardener.jpg" alt="Paysagiste de dos entretenant une grande pelouse" /></div>
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
            <a className="service-card" href={`/reserver?service=${encodeURIComponent(service.name)}`} key={service.name}>
              <figure><img src={service.image} alt="" /><span>0{index + 1}</span></figure>
              <div><h3>{service.name}</h3><p>{service.desc}</p><b>Réserver <span>→</span></b></div>
            </a>
          ))}
        </div>
        <a className="project-door" href="/projet"><span>Un projet plus important ?</span><b>Création, plantation, terrassement, arrosage…</b><i>→</i></a>
      </section>

      <section className="dark-section how-section" id="fonctionnement">
        <SectionLabel number="02" light>Comment ça marche</SectionLabel>
        <div className="how-grid">
          <article><span>01</span><h3>Dites-nous ce qu’il faut faire</h3><p>Quelques questions simples nous permettent de prévoir le temps et le matériel nécessaires.</p></article>
          <article><span>02</span><h3>Choisissez votre créneau</h3><p>Les disponibilités affichées sont de vraies disponibilités.</p></article>
          <article><span>03</span><h3>On s’occupe du reste</h3><p>Votre jardinier arrive avec les informations et le matériel nécessaires.</p></article>
        </div>
        <a className="button button-light" href="/reserver">Réserver une intervention <span>→</span></a>
      </section>

      <section className="section demo-section" id="tarifs">
        <div className="demo-copy">
          <SectionLabel number="03">Prix instantané</SectionLabel>
          <h2>Votre prix évolue avec votre besoin. <em>Pas de devis à attendre.</em></h2>
          <p>Le site estime la durée à votre place. Vous gardez toujours la main sur la formule recommandée.</p>
          <a className="text-link" href="/reserver">Configurer mon jardin <span>→</span></a>
        </div>
        <div className="demo-card" aria-label="Démonstrateur de prix">
          <div className="demo-title"><span>Votre intervention</span><small>Prix mis à jour</small></div>
          <div className="demo-toggles">
            <button className={lawn ? "selected" : ""} onClick={() => setLawn(!lawn)} aria-pressed={lawn}>Tonte <span>{lawn ? "✓" : "+"}</span></button>
            <button className={hedges ? "selected" : ""} onClick={() => setHedges(!hedges)} aria-pressed={hedges}>Taille de haies <span>{hedges ? "✓" : "+"}</span></button>
          </div>
          {lawn && <label className="range-field">Surface pelouse <output>{surface} m²</output><input type="range" min="50" max="1000" step="50" value={surface} onChange={(e) => setSurface(Number(e.target.value))} /></label>}
          {hedges && <label className="range-field">Longueur des haies <output>{length} m</output><input type="range" min="2" max="60" step="2" value={length} onChange={(e) => setLength(Number(e.target.value))} /></label>}
          <div className="select-line"><span>Hauteur</span><strong>1,5–2 m</strong></div>
          <div className="demo-total">
            <div><small>Durée recommandée</small><strong>{estimate.blocks === 1 ? "1 demi-journée" : `${estimate.blocks / 2} journée${estimate.blocks > 2 ? "s" : ""}`}</strong></div>
            <div><small>Prix TTC</small><strong key={estimate.price}>{estimate.price} €</strong><span>≈ {Math.ceil(estimate.price / 2)} € après crédit d’impôt*</span></div>
          </div>
        </div>
      </section>

      <section className="mission-section">
        <div className="mission-copy">
          <SectionLabel number="04" light>Préparation</SectionLabel>
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
        <div><SectionLabel number="05">Services à la personne</SectionLabel><h2>Votre jardin peut aussi coûter <em>deux fois moins cher.</em></h2></div>
        <div><p>Certaines prestations d’entretien de jardin sont éligibles au crédit d’impôt de 50 %, dans la limite réglementaire applicable.</p><span className="advance">Avance immédiate disponible</span><a className="text-link" href="/tarifs#fiscalite">Comprendre le crédit d’impôt <span>→</span></a></div>
      </section>

      <section className="section recurring-section">
        <SectionLabel number="06">Entretien régulier</SectionLabel>
        <h2>Et si votre jardin restait <em>toujours comme ça ?</em></h2>
        <div className="frequency-grid">
          <button>Toutes les 2 semaines<span>Jardin très suivi</span></button>
          <button className="recommended"><b>Recommandé</b>Toutes les 4 semaines<span>Le bon rythme saisonnier</span></button>
          <button>Toutes les 6 semaines<span>Entretien essentiel</span></button>
          <button>Sur mesure<span>Un calendrier adapté</span></button>
        </div>
      </section>

      <section className="faq-section" id="faq">
        <div><SectionLabel number="07" light>Questions fréquentes</SectionLabel><h2>Tout ce qu’il faut savoir, <em>avant de réserver.</em></h2></div>
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
