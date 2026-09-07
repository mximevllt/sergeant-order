"use client";

import { useState } from "react";
import { Footer, Header, SectionLabel } from "../components";

const offers = [
  { code: "2h", label: "Forfait 2 heures", detail: "2 h · déplacement inclus", price: 350 },
  { code: "half", label: "Demi-journée", detail: "4 h · déplacement inclus", price: 520 },
  { code: "day", label: "Journée complète", detail: "8 h · déplacement inclus", price: 980 },
  { code: "two-days", label: "Deux journées", detail: "16 h · déplacement inclus", price: 1900 },
] as const;

export default function PricingPage() {
  const [selected, setSelected] = useState<(typeof offers)[number]["code"]>("half");
  const offer = offers.find(({ code }) => code === selected) ?? offers[1];
  return <main><Header /><section className="inner-hero"><SectionLabel number="Tarifs">Transparents avant de réserver</SectionLabel><h1>Des forfaits simples, <em>plus avantageux quand ils durent.</em></h1><p>Le temps de déplacement jusqu’au chantier est compris dans chaque forfait : il fait partie du temps réservé et n’est jamais ajouté en supplément.</p></section><section className="pricing-layout"><div className="pricing-principles"><article><span>01</span><h2>Forfait 2 heures</h2><p><strong>350 € TTC</strong><br />Déplacement inclus</p></article><article><span>02</span><h2>Demi-journée</h2><p><strong>520 € TTC</strong><br />4 h, déplacement inclus</p></article><article><span>03</span><h2>Journée complète</h2><p><strong>980 € TTC</strong><br />8 h, déplacement inclus</p></article><article className="pricing-saving"><span>Meilleur prix</span><h2>Deux journées</h2><p><strong>1 900 € TTC</strong><br /><b>Économisez 60 € TTC</b> par rapport à deux journées séparées (1 960 €).</p></article></div><div className="pricing-calc"><span>Choisissez votre forfait</span><h2>Votre tarif TTC</h2><label>Durée<select value={selected} onChange={(e) => setSelected(e.target.value as typeof selected)}>{offers.map((item) => <option key={item.code} value={item.code}>{item.label} — {item.price} € TTC</option>)}</select></label><div><small>{offer.detail}</small><strong>{offer.price} €</strong><p>Déplacement compris dans la durée du forfait</p></div><a className="button button-light" href="/reserver">Réserver ce forfait →</a></div></section><section className="tax-explainer" id="fiscalite"><SectionLabel number="Déchets végétaux" light>Deux choix pendant la commande</SectionLabel><h2>Broyage gratuit ou <em>évacuation à 28 € TTC.</em></h2><p>Le broyage sur place est l’option gratuite : le broyat est laissé dans le jardin pour servir de paillage ou d’apport de matière organique. L’évacuation de 1 à 2 m³ est disponible à 28 € TTC.</p></section><Footer /></main>;
}
