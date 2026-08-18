"use client";

import Image from "next/image";
import Link from "@/app/site-link";
import { useEffect, useRef, useState } from "react";

type CatalogTask = { code: string; label: string; description: string; measurementKind: string; eligibleSap: boolean; sortOrder: number };
type TotalData = { intervention: number; taskFee: number; detailFee: number; accessFee: number; evacuation: number; reduction: number; total: number; afterTax: number };
type PricingResponse = { recommendedHalfDays: number; warnings: string[]; totals: TotalData; pricingVersion: { version: number; label: string } };

const taskPresentation: Record<string, { title: string; image: string }> = {
  MOWING: { title: "Tondre la pelouse", image: "/images/tonte.jpg" },
  HEDGE_TRIMMING: { title: "Tailler les haies", image: "/images/haies.jpg" },
  BRUSH_CLEARING: { title: "Débroussailler", image: "/images/debroussaillage.jpg" },
  FLOWER_BEDS: { title: "Désherber les massifs", image: "/images/massifs.jpg" },
  GARDEN_CLEANING: { title: "Remettre au propre", image: "/images/nettoyage.jpg" },
  COMPLETE_MAINTENANCE: { title: "Entretenir tout le jardin", image: "/images/entretien.jpg" },
};

const emptyTotals: TotalData = { intervention: 0, taskFee: 0, detailFee: 0, accessFee: 0, evacuation: 0, reduction: 0, total: 0, afterTax: 0 };

const datesByMode: Record<string, string[]> = {
  soon: ["lun. 17", "mar. 18", "mer. 19", "jeu. 20", "ven. 21"],
  week: ["lun. 17", "mar. 18", "mer. 19", "jeu. 20", "ven. 21", "sam. 22"],
};

function durationLabel(blocks: number) {
  if (blocks === 1) return "1/2 journée";
  if (blocks === 2) return "1 journée";
  const days = blocks / 2;
  return `${Number.isInteger(days) ? days : String(days).replace(".", ",")} jours`;
}

function longDurationLabel(blocks: number) {
  return blocks === 1 ? "1 demi-journée" : durationLabel(blocks);
}

export default function BookingPage() {
  const [step, setStep] = useState(1);
  const [address, setAddress] = useState("28 rue Jules Ferry, 83170 Brignoles");
  const [tasks, setTasks] = useState<CatalogTask[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  const [selected, setSelected] = useState<string[]>(["MOWING", "HEDGE_TRIMMING"]);
  const [unknownNeed, setUnknownNeed] = useState(false);
  const [lawnSurface, setLawnSurface] = useState("250–500 m²");
  const [grass, setGrass] = useState("Entretenue");
  const [terrain, setTerrain] = useState("Plat");
  const [hedgeLength, setHedgeLength] = useState(18);
  const [hedgeHeight, setHedgeHeight] = useState("1,5–2 m");
  const [hedgeFaces, setHedgeFaces] = useState("3 faces");
  const [duration, setDuration] = useState(2);
  const [waste, setWaste] = useState("emporter");
  const [priority, setPriority] = useState<string[]>(["MOWING", "HEDGE_TRIMMING"]);
  const [scheduleMode, setScheduleMode] = useState("soon");
  const [date, setDate] = useState("jeu. 20");
  const [customDate, setCustomDate] = useState("");
  const [slot, setSlot] = useState("08:00 — 12:00");
  const [flexible, setFlexible] = useState(false);
  const [access, setAccess] = useState("Je serai sur place");
  const [accessType, setAccessType] = useState("Code");
  const [parking, setParking] = useState("Oui");
  const [distance, setDistance] = useState("< 20 m");
  const [passageWidth, setPassageWidth] = useState("> 1 m");
  const [animal, setAnimal] = useState(false);
  const [legal, setLegal] = useState(false);
  const [totals, setTotals] = useState<TotalData>(emptyTotals);
  const [recommended, setRecommended] = useState(2);
  const [pricingWarnings, setPricingWarnings] = useState<string[]>([]);
  const [pricingLabel, setPricingLabel] = useState("Chargement du barème…");
  const [pricingError, setPricingError] = useState(false);
  const lastRecommendationKey = useRef("");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [step]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/catalog", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("CATALOG_UNAVAILABLE");
      const catalog = await response.json() as { tasks: CatalogTask[]; pricing: { label: string } };
      setTasks(catalog.tasks);
      setPricingLabel(catalog.pricing.label);
      const requested = new URLSearchParams(window.location.search).get("service") ?? "";
      const aliases: Record<string, string> = { tonte: "MOWING", "Tonte & finitions": "MOWING", haies: "HEDGE_TRIMMING", "Taille de haies": "HEDGE_TRIMMING", debroussaillage: "BRUSH_CLEARING", "Débroussaillage": "BRUSH_CLEARING", massifs: "FLOWER_BEDS", "Désherbage & massifs": "FLOWER_BEDS", nettoyage: "GARDEN_CLEANING", "Nettoyage du jardin": "GARDEN_CLEANING", complet: "COMPLETE_MAINTENANCE", "Entretien complet": "COMPLETE_MAINTENANCE" };
      const requestedCode = aliases[requested];
      if (requestedCode && catalog.tasks.some(({ code }) => code === requestedCode)) { setSelected([requestedCode]); setPriority([requestedCode]); }
      else setSelected((current) => current.filter((code) => catalog.tasks.some((task) => task.code === code)));
    }).catch((error) => { if (error instanceof Error && error.name !== "AbortError") setCatalogError(true); });
    return () => controller.abort();
  }, []);

  const recommendationKey = JSON.stringify([selected, lawnSurface, grass, hedgeLength, hedgeHeight, hedgeFaces, waste, access, accessType, parking, distance, flexible]);
  useEffect(() => {
    if (!tasks.length) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const body = {
        taskCodes: selected, halfDays: duration,
        lawnSurfaceBand: ({ "< 100 m²": "UNDER_100", "100–250 m²": "FROM_100_TO_250", "250–500 m²": "FROM_250_TO_500", "500–1 000 m²": "FROM_500_TO_1000", "+ 1 000 m²": "OVER_1000" } as Record<string, string>)[lawnSurface],
        grassState: ({ Entretenue: "MAINTAINED", Haute: "HIGH", "Très haute": "VERY_HIGH" } as Record<string, string>)[grass],
        hedgeLengthM: hedgeLength,
        hedgeHeightBand: ({ "< 1,5 m": "UNDER_1_5M", "1,5–2 m": "FROM_1_5_TO_2M", "2–2,5 m": "FROM_2_TO_2_5M", "2,5–3 m": "FROM_2_5_TO_3M", "+ 3 m": "OVER_3M" } as Record<string, string>)[hedgeHeight],
        hedgeFaces: ({ Dessus: "TOP", "1 côté": "ONE_SIDE", "2 côtés": "TWO_SIDES", "3 faces": "THREE_FACES" } as Record<string, string>)[hedgeFaces],
        greenWaste: waste === "emporter" ? "REMOVE_1_TO_2M3" : "LEAVE_ON_SITE",
        customerPresence: !access.includes("sans moi"),
        accessType: ({ "Portail ouvert": "OPEN_GATE", "Boîte à clés": "KEY_BOX", Code: "CODE", Autre: "OTHER" } as Record<string, string>)[accessType],
        nearbyParking: parking === "Oui",
        vehicleDistanceBand: ({ "< 20 m": "UNDER_20M", "20–50 m": "FROM_20_TO_50M", "> 50 m": "OVER_50M" } as Record<string, string>)[distance],
        flexibleOnDay: flexible,
      };
      fetch("/api/pricing/estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal }).then(async (response) => {
        if (!response.ok) throw new Error("PRICING_UNAVAILABLE");
        const quote = await response.json() as PricingResponse;
        setTotals(quote.totals); setRecommended(quote.recommendedHalfDays); setPricingWarnings(quote.warnings); setPricingLabel(quote.pricingVersion.label); setPricingError(false);
        if (lastRecommendationKey.current !== recommendationKey) {
          lastRecommendationKey.current = recommendationKey;
          if (duration !== quote.recommendedHalfDays) setDuration(quote.recommendedHalfDays);
        }
      }).catch((error) => { if (error instanceof Error && error.name !== "AbortError") setPricingError(true); });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [tasks.length, recommendationKey, duration, selected, lawnSurface, grass, hedgeLength, hedgeHeight, hedgeFaces, waste, access, accessType, parking, distance, flexible]);

  const toggleTask = (name: string) => {
    setUnknownNeed(false);
    const next = selected.includes(name) ? selected.filter((item) => item !== name) : [...selected, name];
    setSelected(next);
    setPriority((priorities) => {
      const kept = priorities.filter((task) => next.includes(task));
      const added = next.filter((task) => !kept.includes(task));
      return [...kept, ...added];
    });
  };
  const updateLawnSurface = (value: string) => setLawnSurface(value);
  const updateHedgeHeight = (value: string) => setHedgeHeight(value);
  const movePriority = (index: number, direction: number) => {
    const target = index + direction;
    if (target < 0 || target >= priority.length) return;
    const next = [...priority];
    [next[index], next[target]] = [next[target], next[index]];
    setPriority(next);
  };
  const goNext = () => setStep((current) => Math.min(6, current + 1));
  const goBack = () => setStep((current) => Math.max(1, current - 1));
  const taskLabel = (code: string) => tasks.find((task) => task.code === code)?.label ?? code;
  const selectedLabels = selected.map(taskLabel);

  return (
    <main className="booking-page">
      <header className="booking-header">
        <Link href="/" aria-label="Sergeant Paysage, accueil"><Image src="/logo-sergeant-paysage-blanc.png" alt="Sergeant Paysage" width={1784} height={387} priority /></Link>
        <div className="progress-wrap"><span>Étape {step} sur 6</span><div className="progress"><i style={{ width: `${(step / 6) * 100}%` }} /></div></div>
        <Link className="quit" href="/" aria-label="Quitter la réservation">× <span>Quitter</span></Link>
      </header>

      <div className="booking-layout">
        <section className="booking-main" key={step}>
          {step === 1 && <StepNeeds tasks={tasks} catalogError={catalogError} selected={selected} toggleTask={toggleTask} unknownNeed={unknownNeed} setUnknownNeed={setUnknownNeed} />}
          {step === 2 && <StepDetails selected={selected} lawnSurface={lawnSurface} setLawnSurface={updateLawnSurface} grass={grass} setGrass={setGrass} terrain={terrain} setTerrain={setTerrain} hedgeLength={hedgeLength} setHedgeLength={setHedgeLength} hedgeHeight={hedgeHeight} setHedgeHeight={updateHedgeHeight} hedgeFaces={hedgeFaces} setHedgeFaces={setHedgeFaces} />}
          {step === 3 && <StepDuration duration={duration} setDuration={setDuration} recommended={recommended} priority={priority} taskLabel={taskLabel} warnings={pricingWarnings} movePriority={movePriority} waste={waste} setWaste={setWaste} />}
          {step === 4 && <StepSchedule mode={scheduleMode} setMode={setScheduleMode} date={date} setDate={setDate} customDate={customDate} setCustomDate={setCustomDate} slot={slot} setSlot={setSlot} flexible={flexible} setFlexible={setFlexible} />}
          {step === 5 && <StepAccess access={access} setAccess={setAccess} accessType={accessType} setAccessType={setAccessType} parking={parking} setParking={setParking} distance={distance} setDistance={setDistance} passageWidth={passageWidth} setPassageWidth={setPassageWidth} animal={animal} setAnimal={setAnimal} />}
          {step === 6 && <StepCheckout address={address} setAddress={setAddress} selected={selectedLabels} slot={slot} duration={duration} waste={waste} totals={totals} legal={legal} setLegal={setLegal} />}

          {pricingError && <p className="pricing-error" role="alert">Le tarif n’a pas pu être recalculé. Vérifiez votre connexion avant de continuer.</p>}

          <div className="booking-actions">
            {step === 1 ? <Link className="back-button" href="/">← Retour à l’accueil</Link> : <button className="back-button" onClick={goBack}>← Retour</button>}
            {step < 6 ? <button className="button button-primary" onClick={goNext}>Continuer <span>→</span></button> : <a className={`button button-primary final-book${legal ? "" : " disabled"}`} href={legal ? "/confirmation" : undefined} aria-disabled={!legal}>Réserver — {totals.total} € à payer après intervention</a>}
          </div>
        </section>
        <Summary address={address} selected={selected} taskLabel={taskLabel} lawnSurface={lawnSurface} hedgeLength={hedgeLength} hedgeHeight={hedgeHeight} duration={duration} waste={waste} totals={totals} pricingLabel={pricingLabel} />
      </div>
      <div className="mobile-price-bar">
        {step === 1 ? <Link className="mobile-back" href="/" aria-label="Retour à l’accueil">←</Link> : <button className="mobile-back" onClick={goBack} aria-label="Étape précédente">←</button>}
        <div><strong>{totals.total} €</strong><small>{durationLabel(duration)}</small></div>
        {step < 6 ? <button onClick={goNext}>Continuer →</button> : <a className={!legal ? "disabled" : ""} href={legal ? "/confirmation" : undefined}>Réserver</a>}
      </div>
    </main>
  );
}

function Intro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <div className="step-intro"><p>{eyebrow}</p><h1>{title}</h1><span>{copy}</span></div>;
}

function AddressFields({ address, setAddress }: { address: string; setAddress: (v: string) => void }) {
  const [locating, setLocating] = useState(false);
  return <>
    <div className="field-group"><label htmlFor="address">Adresse du jardin</label><input id="address" autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} /><button type="button" className="location-link" onClick={() => { setLocating(true); window.setTimeout(() => { setAddress("28 rue Jules Ferry, 83170 Brignoles"); setLocating(false); }, 500); }}>⌖ {locating ? "Localisation…" : "Utiliser ma position"}</button></div>
    {address.length > 3 && <div className="address-card checkout-address-card"><div className="mini-map" aria-hidden="true"><i /><b>SP</b><span /></div><div><strong>{address.split(",")[0]}</strong><p>{address.split(",").slice(1).join(",") || "83170 Brignoles"}</p><span>✓ Zone desservie</span></div></div>}
  </>;
}

function StepNeeds({ tasks, catalogError, selected, toggleTask, unknownNeed, setUnknownNeed }: { tasks: CatalogTask[]; catalogError: boolean; selected: string[]; toggleTask: (v: string) => void; unknownNeed: boolean; setUnknownNeed: (v: boolean) => void }) {
  const openUnknown = () => {
    setUnknownNeed(!unknownNeed);
    if (!unknownNeed) setTimeout(() => document.getElementById("unknown-description")?.focus(), 50);
  };
  return <>
    <Intro eyebrow="Votre besoin" title="Que souhaitez-vous faire ?" copy="Vous pouvez sélectionner plusieurs tâches pour la même intervention." />
    {catalogError && <p className="pricing-error" role="alert">Le catalogue des prestations est momentanément indisponible.</p>}
    {!tasks.length && !catalogError && <p className="catalog-loading" role="status">Chargement des prestations disponibles…</p>}
    <div className="task-grid">{tasks.map((task) => { const presentation = taskPresentation[task.code] ?? { title: task.label, image: "/images/entretien.jpg" }; return <button type="button" key={task.code} className={selected.includes(task.code) ? "task-card selected" : "task-card"} onClick={() => toggleTask(task.code)} aria-pressed={selected.includes(task.code)}><Image src={presentation.image} alt="" width={1000} height={668} sizes="(max-width: 600px) 110px, 150px" /><div><small>{task.label}</small><strong>{presentation.title}</strong><span>{task.description}</span></div><i>{selected.includes(task.code) ? "✓" : "+"}</i></button>; })}</div>
    <button type="button" className={`unknown-link${unknownNeed ? " selected" : ""}`} onClick={openUnknown} aria-expanded={unknownNeed}>Je ne sais pas exactement ce qu’il faut {unknownNeed ? "↑" : "→"}</button>
    {unknownNeed && <div className="unknown-panel"><h2>Montrez-nous simplement le jardin.</h2><p>Décrivez ce que vous observez et ajoutez quelques photos. L’équipe préparera la mission à partir de ces éléments.</p><label htmlFor="unknown-description">Ce qu’il faudrait améliorer<textarea id="unknown-description" placeholder="Exemple : le jardin n’a pas été entretenu depuis plusieurs mois, je souhaite surtout qu’il soit remis au propre…" /></label><label className="unknown-upload"><input type="file" multiple accept="image/*" />+ Ajouter des photos</label></div>}
  </>;
}

type DetailsProps = { selected: string[]; lawnSurface: string; setLawnSurface: (v: string) => void; grass: string; setGrass: (v: string) => void; terrain: string; setTerrain: (v: string) => void; hedgeLength: number; setHedgeLength: (v: number) => void; hedgeHeight: string; setHedgeHeight: (v: string) => void; hedgeFaces: string; setHedgeFaces: (v: string) => void };
function StepDetails({ selected, lawnSurface, setLawnSurface, grass, setGrass, terrain, setTerrain, hedgeLength, setHedgeLength, hedgeHeight, setHedgeHeight, hedgeFaces, setHedgeFaces }: DetailsProps) {
  return <>
    <Intro eyebrow="Les détails" title="Aidez-nous à prévoir juste." copy="Ces informations affinent la durée recommandée, le matériel nécessaire et le prix." />
    {selected.includes("MOWING") && <div className="detail-card"><h2>Pelouse</h2><Choice label="Quelle surface à entretenir environ ?" values={["< 100 m²", "100–250 m²", "250–500 m²", "500–1 000 m²", "+ 1 000 m²"]} value={lawnSurface} setValue={setLawnSurface} /><Choice label="État actuel" values={["Entretenue", "Haute", "Très haute"]} value={grass} setValue={setGrass} visual /><Choice label="Inclinaison du terrain" values={["Plat", "Légèrement en pente", "Forte pente"]} value={terrain} setValue={setTerrain} /></div>}
    {selected.includes("HEDGE_TRIMMING") && <div className="detail-card"><h2>Haies</h2><div className="counter-field"><span>Longueur totale</span><div><button type="button" onClick={() => setHedgeLength(Math.max(1, hedgeLength - 1))}>−</button><strong>{hedgeLength} m</strong><button type="button" onClick={() => setHedgeLength(hedgeLength + 1)}>+</button></div></div><Choice label="Hauteur" values={["< 1,5 m", "1,5–2 m", "2–2,5 m", "2,5–3 m", "+ 3 m"]} value={hedgeHeight} setValue={setHedgeHeight} /><Choice label="Que faut-il tailler ?" values={["Dessus", "1 côté", "2 côtés", "3 faces"]} value={hedgeFaces} setValue={setHedgeFaces} /></div>}
    <div className="upload-card"><span>Photos</span><h2>Quelques photos peuvent nous éviter de vous appeler.</h2><label><input type="file" multiple accept="image/*" />+ Ajouter des photos</label><p>Prenez une vue d’ensemble et, si besoin, une photo rapprochée. Maximum 8 photos. Évitez si possible d’inclure des personnes.</p></div>
  </>;
}

function Choice({ label, values, value, setValue, visual = false }: { label: string; values: string[]; value: string; setValue: (v: string) => void; visual?: boolean }) {
  return <fieldset className="choice-field"><legend>{label}</legend><div className={visual ? "choice-row visual" : "choice-row"}>{values.map((item) => <button type="button" key={item} className={value === item ? "selected" : ""} onClick={() => setValue(item)}>{visual && <i className={`grass-${item.toLowerCase().replaceAll(" ", "-")}`} />}{item}{item === "Entretenue" && <small>Herbe &lt; 15 cm</small>}</button>)}</div></fieldset>;
}

function StepDuration({ duration, setDuration, recommended, priority, taskLabel, warnings, movePriority, waste, setWaste }: { duration: number; setDuration: (v: number) => void; recommended: number; priority: string[]; taskLabel: (code: string) => string; warnings: string[]; movePriority: (i: number, d: number) => void; waste: string; setWaste: (v: string) => void }) {
  const [showMore, setShowMore] = useState(duration > 4 || recommended > 4);
  const fixed = [[1, "1/2 journée", "4 h"], [2, "1 journée", "8 h"], [3, "1,5 jour", "12 h"], [4, "2 jours", "16 h"]] as const;
  const customSelected = duration > 4;
  return <>
    <Intro eyebrow="Notre estimation" title="Combien de temps réserver ?" copy="Le site recommande la durée la plus adaptée aux informations renseignées." />
    <div className="recommendation"><span>Recommandation mise à jour</span><strong>{longDurationLabel(recommended)}</strong><p>Environ {recommended * 4} h d’intervention · Calculé selon vos réponses</p><i>✓</i></div>
    {warnings.map((warning) => <p className="pricing-warning" key={warning}>{warning}</p>)}
    <div className="duration-grid">{fixed.map(([value, label, hours]) => <button type="button" key={value} className={duration === value ? "selected" : ""} onClick={() => setDuration(value)}><strong>{label}</strong><span>{hours}</span>{value === recommended && <b>Recommandé</b>}</button>)}<button type="button" className={`duration-more${customSelected ? " selected" : ""}`} onClick={() => { setShowMore(true); if (duration <= 4) setDuration(Math.max(5, recommended)); }} aria-expanded={showMore}><strong>+</strong><span>Plus de jours</span>{recommended > 4 && <b>Recommandé</b>}</button></div>
    {showMore && <div className="custom-duration"><label htmlFor="custom-duration">Durée en jours</label><div><button type="button" onClick={() => setDuration(Math.max(5, duration - 1))} aria-label="Retirer une demi-journée">−</button><input id="custom-duration" type="number" min="2.5" step="0.5" value={Math.max(2.5, duration / 2)} onChange={(e) => setDuration(Math.max(5, Math.round(Number(e.target.value) * 2)))} /><span>jours</span><button type="button" onClick={() => setDuration(Math.max(5, duration + 1))} aria-label="Ajouter une demi-journée">+</button></div><small>Les flèches ajustent la durée par pas de 0,5 jour.</small></div>}
    <div className="priority-card"><h2>Si nous devons choisir, que faut-il faire en premier ?</h2>{priority.map((item, index) => <div key={item}><span>{index + 1}</span><strong>{taskLabel(item)}</strong><button type="button" onClick={() => movePriority(index, -1)} aria-label={`Remonter ${taskLabel(item)}`}>↑</button><button type="button" onClick={() => movePriority(index, 1)} aria-label={`Descendre ${taskLabel(item)}`}>↓</button></div>)}</div>
    <div className="waste-card"><h2>Que faisons-nous des déchets verts ?</h2><div><button type="button" className={waste === "laisser" ? "selected" : ""} onClick={() => setWaste("laisser")}><strong>Les laisser sur place</strong><span>Regroupés proprement à l’endroit de votre choix.</span></button><button type="button" className={waste === "emporter" ? "selected" : ""} onClick={() => setWaste("emporter")}><strong>Les emporter</strong><span>Chargement et évacuation · environ 1–2 m³.</span></button></div></div>
  </>;
}

function StepSchedule({ mode, setMode, date, setDate, customDate, setCustomDate, slot, setSlot, flexible, setFlexible }: { mode: string; setMode: (v: string) => void; date: string; setDate: (v: string) => void; customDate: string; setCustomDate: (v: string) => void; slot: string; setSlot: (v: string) => void; flexible: boolean; setFlexible: (v: boolean) => void }) {
  const setSchedule = (next: string) => {
    setMode(next);
    if (next !== "custom") setDate(datesByMode[next][next === "soon" ? 0 : 3]);
  };
  const displayDate = mode === "custom" && customDate ? new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${customDate}T12:00:00`)) : date;
  return <>
    <Intro eyebrow="Le planning" title="Quand voulez-vous que nous intervenions ?" copy="Les créneaux proposés correspondent aux disponibilités de nos équipes." />
    <div className="schedule-tabs"><button type="button" className={mode === "soon" ? "selected" : ""} onClick={() => setSchedule("soon")}>Au plus tôt</button><button type="button" className={mode === "week" ? "selected" : ""} onClick={() => setSchedule("week")}>Cette semaine</button><button type="button" className={mode === "custom" ? "selected" : ""} onClick={() => setSchedule("custom")}>Choisir une date</button></div>
    {mode === "custom" ? <div className="custom-date"><label htmlFor="booking-date">Date souhaitée</label><input id="booking-date" type="date" min="2026-08-17" value={customDate} onChange={(e) => { setCustomDate(e.target.value); setDate(e.target.value); }} /></div> : <div className="date-strip">{datesByMode[mode].map((item) => <button type="button" key={item} className={date === item ? "selected" : ""} onClick={() => setDate(item)}>{item.split(" ")[0]}<strong>{item.split(" ")[1]}</strong></button>)}</div>}
    <h2 className="selected-date">{displayDate || "Choisissez une date"}</h2>
    <div className="slot-grid">{["08:00 — 12:00", "13:00 — 17:00"].map((item) => <button type="button" key={item} className={slot === item ? "selected" : ""} onClick={() => setSlot(item)}><strong>{item}</strong><span>{item.startsWith("08") ? "Matin" : "Après-midi"}</span></button>)}</div>
    <label className="flexible-toggle"><span><strong>Je suis flexible sur la journée</strong><small>Nous choisissons matin ou après-midi et confirmons au plus tard 48 h avant.</small></span><b>−10 €</b><input type="checkbox" checked={flexible} onChange={(e) => setFlexible(e.target.checked)} /><i /></label>
    <div className="weather-note"><span>☁</span><div><strong>Et s’il pleut ?</strong><p>Si les conditions rendent l’intervention impossible ou inefficace, vous pourrez choisir gratuitement un nouveau créneau.</p></div></div>
  </>;
}

type AccessProps = { access: string; setAccess: (v: string) => void; accessType: string; setAccessType: (v: string) => void; parking: string; setParking: (v: string) => void; distance: string; setDistance: (v: string) => void; passageWidth: string; setPassageWidth: (v: string) => void; animal: boolean; setAnimal: (v: boolean) => void };
function StepAccess({ access, setAccess, accessType, setAccessType, parking, setParking, distance, setDistance, passageWidth, setPassageWidth, animal, setAnimal }: AccessProps) {
  return <>
    <Intro eyebrow="Sur place" title="Comment accéder au jardin ?" copy="Chaque contrainte logistique affine légèrement le prix, sauf les animaux et la largeur du passage." />
    <div className="access-grid">{["Je serai sur place", "Le jardin est accessible sans moi"].map((item) => <button type="button" key={item} className={access === item ? "selected" : ""} onClick={() => setAccess(item)}><span>{item.startsWith("Je") ? "◎" : "⌂"}</span><strong>{item}</strong><i>{access === item ? "✓" : "+"}</i></button>)}</div>
    {access.includes("sans moi") && <div className="detail-card"><h2>Type d’accès</h2><Choice label="Choisissez une option" values={["Portail ouvert", "Boîte à clés", "Code", "Autre"]} value={accessType} setValue={setAccessType} />{accessType === "Code" && <div className="field-group compact"><label htmlFor="gate">Code du portail</label><input id="gate" type="password" autoComplete="off" placeholder="Votre code" /><label className="remember"><input type="checkbox" /> Conserver ces instructions pour mes prochaines interventions</label></div>}</div>}
    <div className="detail-card"><h2>Accès du matériel</h2><Choice label="Un utilitaire peut-il stationner à proximité ?" values={["Oui", "Non"]} value={parking} setValue={setParking} /><Choice label="Distance jusqu’au jardin" values={["< 20 m", "20–50 m", "> 50 m"]} value={distance} setValue={setDistance} /><Choice label="Largeur du passage le plus étroit" values={["> 1 m", "80 cm–1 m", "< 80 cm", "Je ne sais pas"]} value={passageWidth} setValue={setPassageWidth} /></div>
    <div className="animal-line"><span>Y a-t-il un chien ou un autre animal sur la propriété ?</span><button type="button" className={!animal ? "selected" : ""} onClick={() => setAnimal(false)}>Non</button><button type="button" className={animal ? "selected" : ""} onClick={() => setAnimal(true)}>Oui</button></div>
    <div className="field-group"><label htmlFor="notes">Une information utile à ajouter ? <span>Facultatif</span></label><textarea id="notes" maxLength={500} placeholder="Exemple : sonnette en panne, portail à pousser fort, attention au système d’arrosage près de la haie…" /></div>
  </>;
}

function StepCheckout({ address, setAddress, selected, slot, duration, waste, totals, legal, setLegal }: { address: string; setAddress: (v: string) => void; selected: string[]; slot: string; duration: number; waste: string; totals: { total: number; afterTax: number }; legal: boolean; setLegal: (v: boolean) => void }) {
  return <>
    <Intro eyebrow="Paiement" title="Dernière étape." copy="Réservez sans créer de compte. Un lien sécurisé vous sera envoyé par email." />
    <div className="checkout-card"><h2>Vos coordonnées</h2><div className="form-grid"><label>Nom complet<input autoComplete="name" placeholder="Prénom Nom" /></label><label>Email<input type="email" autoComplete="email" placeholder="vous@exemple.fr" /></label><label>Téléphone mobile<input type="tel" autoComplete="tel" placeholder="06 00 00 00 00" /></label></div></div>
    <div className="checkout-card address-checkout"><h2>Adresse du jardin</h2><p className="checkout-helper">Indiquez ici le lieu exact de l’intervention.</p><AddressFields address={address} setAddress={setAddress} /></div>
    <div className="checkout-card"><div className="payment-head"><h2>Paiement</h2><span>🔒 Paiement sécurisé</span></div><button type="button" className="wallet-button">Pay <b>●</b></button><div className="or"><span>ou par carte bancaire</span></div><div className="fake-card"><label>Numéro de carte<input inputMode="numeric" autoComplete="cc-number" placeholder="1234  1234  1234  1234" /></label><label>Expiration<input inputMode="numeric" autoComplete="cc-exp" placeholder="MM / AA" /></label><label>CVC<input inputMode="numeric" autoComplete="cc-csc" placeholder="123" /></label></div><div className="no-charge"><strong>Vous ne serez pas débité aujourd’hui.</strong><p>Votre carte garantit la réservation. La prestation sera facturée après réalisation, conformément aux conditions d’annulation.</p></div><details className="promo"><summary>Ajouter un code avantage</summary><div><input aria-label="Code avantage" /><button type="button">Appliquer</button></div></details></div>
    <div className="final-summary"><h2>Récapitulatif final</h2><p><strong>Créneau choisi · {slot}</strong><br />{address}</p><p>{selected.join(" · ")}<br />{longDurationLabel(duration)} · {waste === "emporter" ? "Évacuation des déchets" : "Déchets laissés sur place"}</p><strong>Total : {totals.total} € TTC</strong><span>≈ {totals.afterTax} € après crédit d’impôt*</span></div>
    <label className="legal-check"><input type="checkbox" checked={legal} onChange={(e) => setLegal(e.target.checked)} /><span>Je demande expressément que la prestation puisse commencer avant la fin du délai légal de rétractation et j’accepte les CGV.</span></label>
  </>;
}

function Summary({ address, selected, taskLabel, lawnSurface, hedgeLength, hedgeHeight, duration, waste, totals, pricingLabel }: { address: string; selected: string[]; taskLabel: (code: string) => string; lawnSurface: string; hedgeLength: number; hedgeHeight: string; duration: number; waste: string; totals: TotalData; pricingLabel: string }) {
  const adjustments = totals.taskFee + totals.detailFee + totals.accessFee;
  return <aside className="booking-summary"><p className="summary-kicker">Votre intervention</p><h2>Brignoles</h2><small>{address}</small><div className="summary-lines">{selected.map((item) => <div key={item}><span>{taskLabel(item)}</span><strong>{item === "MOWING" ? lawnSurface : item === "HEDGE_TRIMMING" ? `${hedgeLength} m · ${hedgeHeight}` : "Sélectionné"}</strong></div>)}<div><span>Durée</span><strong>{longDurationLabel(duration)}</strong></div><div><span>Déchets</span><strong>{waste === "emporter" ? "Évacuation" : "Laissés sur place"}</strong></div></div><div className="price-lines"><div><span>Intervention</span><strong>{totals.intervention} €</strong></div>{adjustments > 0 && <div><span>Ajustements</span><strong>{adjustments} €</strong></div>}{totals.evacuation > 0 && <div><span>Évacuation</span><strong>{totals.evacuation} €</strong></div>}{totals.reduction > 0 && <div><span>Flexibilité</span><strong>−{totals.reduction} €</strong></div>}<div><span>Déplacement</span><strong>Inclus</strong></div></div><div className="summary-total"><span>Total TTC</span><strong>{totals.total} €</strong><p>≈ {totals.afterTax} € après crédit d’impôt*</p></div><button type="button">Voir le détail du prix</button><p className="summary-footnote">Prix ferme selon {pricingLabel}. Aucun supplément sans votre accord.</p></aside>;
}
