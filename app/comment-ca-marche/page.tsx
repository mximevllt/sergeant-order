import { Footer, Header, SectionLabel } from "../components";

const steps = [
  ["01", "Vous configurez", "Décrivez les tâches et l’état du jardin. Quelques paramètres visuels suffisent.", "Tonte + haies", "250–500 m² · 18 m"],
  ["02", "Nous préparons", "Le temps, le matériel et les priorités sont transmis automatiquement à l’équipe.", "Fiche mission #1842", "Tondeuse · taille-haie · remorque"],
  ["03", "Nous intervenons", "Le jardinier accède au jardin selon vos instructions, même en votre absence.", "Jeudi 20 août", "08:00 — 12:00"],
  ["04", "Vous recevez le compte-rendu", "Photos avant/après, travaux terminés et recommandations arrivent dans votre espace.", "Intervention terminée", "Photos · note · facture"],
];

export default function HowPage() {
  return <main><Header /><section className="inner-hero"><SectionLabel number="Le principe">Simple et préparé</SectionLabel><h1>Réserver un jardinier, <em>sans zone d’ombre.</em></h1><p>Du premier clic au compte-rendu, chaque étape sert une seule promesse : que le jardinier puisse arriver sans devoir vous appeler.</p></section><section className="process-list">{steps.map(([n,title,copy,label,data]) => <article key={n}><span>{n}</span><div><h2>{title}</h2><p>{copy}</p></div><aside><small>{label}</small><strong>{data}</strong></aside></article>)}</section><section className="service-cta"><p>Votre prix et les vrais créneaux disponibles vous attendent.</p><a className="button button-light" href="/reserver">Commencer ma réservation</a></section><Footer /></main>;
}
