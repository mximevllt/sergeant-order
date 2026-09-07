import Image from "next/image";
import Link from "@/app/site-link";
import { Footer, Header, SectionLabel } from "../components";

const eligibleServices = [
  "Tonte de pelouse",
  "Débroussaillage",
  "Entretien des massifs",
  "Ramassage des feuilles",
  "Scarification",
  "Maintenance des allées et terrasses",
  "Désherbage",
  "Taille des haies, rosiers et plantes",
  "Taille des petits arbres et arbustes",
  "Évacuation des déchets végétaux",
];

export default function CreditImpotPage() {
  return (
    <main>
      <Header />

      <section className="credit-hero">
        <div className="credit-hero-copy">
          <SectionLabel number="Services à la personne">Avec la coopérative Unipros</SectionLabel>
          <p className="credit-kicker">Jusqu’à 50 % de crédit d’impôt</p>
          <h1>Votre entretien de jardin peut coûter <em>deux fois moins cher.</em></h1>
          <p>Pour les prestations éligibles réalisées à domicile, Sergeant Paysage vous fait bénéficier des services à la personne avec la coopérative Unipros.</p>
          <Link className="button button-primary" href="/reserver">Réserver une intervention <span>→</span></Link>
        </div>
        <figure className="credit-hero-image">
          <Image src="/images/hero-balais.png" alt="Équipe Sergeant Paysage lors d’un entretien de jardin" width={1063} height={1535} priority sizes="(max-width: 820px) 100vw, 46vw" />
          <figcaption><strong>-50 %</strong><span>sur les prestations d’entretien de jardin éligibles*</span></figcaption>
        </figure>
      </section>

      <section className="credit-intro">
        <div>
          <SectionLabel number="Avance immédiate">Un budget plus simple</SectionLabel>
          <h2>Pour une prestation facturée <em>200 €, ne payez que 100 €.</em></h2>
        </div>
        <p>Lorsque l’avance immédiate est disponible, le crédit d’impôt est directement déduit : vous n’avez pas à avancer la totalité de la somme. Les conditions sont précisées au moment de la démarche.</p>
      </section>

      <section className="credit-eligibility">
        <div className="credit-eligibility-visual">
          <Image src="/images/tonte-finitions.jpg" alt="Entretien d’une pelouse par Sergeant Paysage" width={1920} height={1280} sizes="(max-width: 820px) 100vw, 46vw" />
        </div>
        <div className="credit-eligibility-copy">
          <SectionLabel number="01" light>Les conditions essentielles</SectionLabel>
          <h2>Êtes-vous <em>éligible ?</em></h2>
          <p>Vous êtes contribuable et vous déclarez vos impôts en France ? Le crédit d’impôt peut s’appliquer à l’entretien de votre résidence principale comme de votre résidence secondaire.</p>
          <div className="credit-limit">
            <span>Plafond annuel</span>
            <strong>5 000 €</strong>
            <p>Ce plafond est renouvelé chaque année.</p>
          </div>
        </div>
      </section>

      <section className="credit-services section">
        <SectionLabel number="02">Prestations prises en compte</SectionLabel>
        <div className="credit-services-heading">
          <h2>Les gestes d’entretien qui entrent dans le cadre des <em>services à la personne.</em></h2>
          <p>Ces prestations sont réalisées à votre domicile et peuvent être concernées par le crédit d’impôt de 50 %, selon les règles applicables.</p>
        </div>
        <ul className="credit-service-list">
          {eligibleServices.map((service, index) => <li key={service}><span>{String(index + 1).padStart(2, "0")}</span>{service}</li>)}
        </ul>
      </section>

      <section className="credit-process">
        <div>
          <SectionLabel number="03" light>Simple, du jardin à votre déclaration</SectionLabel>
          <h2>Comment récupérer votre <em>crédit d’impôt ?</em></h2>
          <p>Chaque début d’année, la coopérative émet votre attestation fiscale. Elle vous permet de justifier les sommes dépensées auprès de l’administration fiscale.</p>
        </div>
        <ol>
          <li><span>01</span><p><strong>Nous intervenons à votre domicile.</strong></p></li>
          <li><span>02</span><p><strong>Vous réglez la prestation grâce à une facture émise par Unipros.</strong></p></li>
          <li><span>03</span><p><strong>En début d’année, votre attestation fiscale justifie les sommes dépensées en services à la personne.</strong></p></li>
          <li><span>04</span><p><strong>Si vous ne payez pas ou peu d’impôts, vous recevez un crédit d’impôt ; sinon, une réduction d’impôt.</strong></p></li>
        </ol>
      </section>

      <section className="credit-notice">
        <p><strong>À savoir :</strong> la conception et création de jardin, l’élagage et le terrassement ne font pas partie des prestations de services à la personne. Ces travaux ne sont donc pas éligibles au crédit d’impôt de 50 %.</p>
      </section>

      <section className="credit-cta">
        <div><SectionLabel number="Sergeant Paysage" light>Entretien de jardin à domicile</SectionLabel><h2>Faites-nous confiance pour <em>votre entretien.</em></h2></div>
        <Link className="button button-light" href="/reserver">Réserver mon entretien <span>→</span></Link>
      </section>

      <Footer />
    </main>
  );
}
