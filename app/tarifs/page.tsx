"use client";

import { useEffect, useMemo, useState } from "react";
import { Footer, Header, SectionLabel } from "../components";

type PackageCode = "TWO_HOURS" | "HALF_DAY" | "FULL_DAY" | "TWO_DAYS";
type Offer = { code: PackageCode; label: string; detail: string; price: number; sortOrder: number };

const defaultOffers: Offer[] = [
  { code: "TWO_HOURS", label: "Forfait 2 heures", detail: "2 h · déplacement inclus", price: 350, sortOrder: 10 },
  { code: "HALF_DAY", label: "Demi-journée", detail: "4 h · déplacement inclus", price: 520, sortOrder: 20 },
  { code: "FULL_DAY", label: "Journée complète", detail: "8 h · déplacement inclus", price: 980, sortOrder: 30 },
  { code: "TWO_DAYS", label: "Deux journées", detail: "16 h · déplacement inclus", price: 1900, sortOrder: 40 },
];

const packageCodes = new Set<PackageCode>(defaultOffers.map(({ code }) => code));

export default function PricingPage() {
  const [offers, setOffers] = useState<Offer[]>(defaultOffers);
  const [selected, setSelected] = useState<PackageCode>("HALF_DAY");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/pricing/packages", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("PACKAGES_UNAVAILABLE");
      const data = await response.json() as { packages?: Array<{ code: string; label: string; hoursLabel: string; priceTtcCents: number; sortOrder: number }> };
      const updated = (data.packages ?? []).flatMap((item): Offer[] => {
        if (!packageCodes.has(item.code as PackageCode) || !Number.isFinite(item.priceTtcCents)) return [];
        return [{ code: item.code as PackageCode, label: item.label, detail: `${item.hoursLabel} · déplacement inclus`, price: item.priceTtcCents / 100, sortOrder: item.sortOrder }];
      });
      if (updated.length === defaultOffers.length) setOffers(updated.sort((left, right) => left.sortOrder - right.sortOrder));
    }).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const offer = offers.find(({ code }) => code === selected) ?? offers[1];
  const twoDays = offers.find(({ code }) => code === "TWO_DAYS") ?? defaultOffers[3];
  const fullDay = offers.find(({ code }) => code === "FULL_DAY") ?? defaultOffers[2];
  const saving = Math.max(0, fullDay.price * 2 - twoDays.price);
  const shortOffers = useMemo(() => offers.filter(({ code }) => code !== "TWO_DAYS"), [offers]);

  return <main><Header /><section className="inner-hero"><SectionLabel number="Tarifs">Transparents avant de réserver</SectionLabel><h1>Des forfaits simples, <em>plus avantageux quand ils durent.</em></h1><p>Le temps de déplacement jusqu’au chantier est compris dans chaque forfait : il fait partie du temps réservé et n’est jamais ajouté en supplément.</p></section><section className="pricing-layout"><div className="pricing-principles">{shortOffers.map((item, index) => <article key={item.code}><span>{String(index + 1).padStart(2, "0")}</span><h2>{item.label}</h2><p><strong>{item.price} € TTC</strong><br />{item.detail}</p></article>)}<article className="pricing-saving"><span>Meilleur prix</span><h2>{twoDays.label}</h2><p><strong>{twoDays.price} € TTC</strong><br />{saving > 0 ? <><b>Économisez {saving} € TTC</b> par rapport à deux journées séparées ({fullDay.price * 2} €).</> : <>Le déplacement est inclus dans la durée du forfait.</>}</p></article></div><div className="pricing-calc"><span>Choisissez votre forfait</span><h2>Votre tarif TTC</h2><label>Durée<select value={selected} onChange={(e) => setSelected(e.target.value as PackageCode)}>{offers.map((item) => <option key={item.code} value={item.code}>{item.label} — {item.price} € TTC</option>)}</select></label><div><small>{offer.detail}</small><strong>{offer.price} €</strong><p>Déplacement compris dans la durée du forfait</p></div><a className="button button-light" href="/reserver">Réserver ce forfait →</a></div></section><section className="tax-explainer" id="fiscalite"><SectionLabel number="Déchets végétaux" light>Deux choix pendant la commande</SectionLabel><h2>Broyage gratuit ou <em>évacuation à 28 € TTC.</em></h2><p>Le broyage sur place est l’option gratuite : le broyat est laissé dans le jardin pour servir de paillage ou d’apport de matière organique. L’évacuation de 1 à 2 m³ est disponible à 28 € TTC.</p></section><Footer /></main>;
}
