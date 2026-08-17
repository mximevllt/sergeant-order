"use client";

import { useEffect, useMemo, useState } from "react";

const tasks = [
  ["Tonte", "Tondre la pelouse", "Tonte, bordures et finition.", "/images/tonte.jpg"],
  ["Taille de haies", "Tailler les haies", "Dessus, côtés et nettoyage.", "/images/haies.jpg"],
  ["Débroussaillage", "Débroussailler", "Herbes hautes et végétation dense.", "/images/debroussaillage.jpg"],
  ["Massifs", "Désherber les massifs", "Désherbage et entretien soigné.", "/images/massifs.jpg"],
  ["Nettoyage", "Remettre au propre", "Ramassage, feuilles et finitions.", "/images/nettoyage.jpg"],
  ["Entretien complet", "Entretenir tout le jardin", "Nous suivons vos priorités.", "/images/entretien.jpg"],
];

const dates = ["lun. 17", "mar. 18", "mer. 19", "jeu. 20", "ven. 21"];

export default function BookingPage() {
  const [step, setStep] = useState(1);
  const [address, setAddress] = useState("28 rue Jules Ferry, 83170 Brignoles");
  const [selected, setSelected] = useState<string[]>(["Tonte", "Taille de haies"]);
  const [lawnSurface, setLawnSurface] = useState("250–500 m²");
  const [grass, setGrass] = useState("Entretenue");
  const [terrain, setTerrain] = useState("Plat");
  const [hedgeLength, setHedgeLength] = useState(18);
  const [hedgeHeight, setHedgeHeight] = useState("1,5–2 m");
  const [duration, setDuration] = useState(1);
  const [waste, setWaste] = useState("emporter");
  const [priority, setPriority] = useState(["Taille de haies", "Tonte", "Désherbage"]);
  const [date, setDate] = useState("jeu. 20");
  const [slot, setSlot] = useState("08:00 — 12:00");
  const [flexible, setFlexible] = useState(false);
  const [access, setAccess] = useState("Je serai sur place");
  const [animal, setAnimal] = useState(false);
  const [legal, setLegal] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [step]);

  const totals = useMemo(() => {
    const intervention = 219 * duration;
    const evacuation = waste === "emporter" ? 28 : 0;
    const reduction = flexible ? 10 : 0;
    const total = intervention + evacuation - reduction;
    return { intervention, evacuation, reduction, total, afterTax: Math.ceil(total / 2) };
  }, [duration, waste, flexible]);

  const toggleTask = (name: string) => setSelected((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  const movePriority = (index: number, direction: number) => {
    const target = index + direction;
    if (target < 0 || target >= priority.length) return;
    const next = [...priority];
    [next[index], next[target]] = [next[target], next[index]];
    setPriority(next);
  };
  const goNext = () => setStep((current) => Math.min(7, current + 1));
  const goBack = () => setStep((current) => Math.max(1, current - 1));

  return (
    <main className="booking-page">
      <header className="booking-header">
        <a href="/" aria-label="Sergeant Paysage, accueil"><img src="/logo-sergeant-paysage-blanc.png" alt="Sergeant Paysage" /></a>
        <div className="progress-wrap"><span>Étape {step} sur 7</span><div className="progress"><i style={{ width: `${(step / 7) * 100}%` }} /></div></div>
        <a className="quit" href="/" aria-label="Quitter la réservation">× <span>Quitter</span></a>
      </header>

      <div className="booking-layout">
        <section className="booking-main" key={step}>
          {step === 1 && <StepAddress address={address} setAddress={setAddress} />}
          {step === 2 && <StepNeeds selected={selected} toggleTask={toggleTask} />}
          {step === 3 && <StepDetails selected={selected} lawnSurface={lawnSurface} setLawnSurface={setLawnSurface} grass={grass} setGrass={setGrass} terrain={terrain} setTerrain={setTerrain} hedgeLength={hedgeLength} setHedgeLength={setHedgeLength} hedgeHeight={hedgeHeight} setHedgeHeight={setHedgeHeight} />}
          {step === 4 && <StepDuration duration={duration} setDuration={setDuration} priority={priority} movePriority={movePriority} waste={waste} setWaste={setWaste} />}
          {step === 5 && <StepSchedule date={date} setDate={setDate} slot={slot} setSlot={setSlot} flexible={flexible} setFlexible={setFlexible} />}
          {step === 6 && <StepAccess access={access} setAccess={setAccess} animal={animal} setAnimal={setAnimal} />}
          {step === 7 && <StepCheckout address={address} selected={selected} slot={slot} totals={totals} legal={legal} setLegal={setLegal} />}

          <div className="booking-actions">
            {step > 1 ? <button className="back-button" onClick={goBack}>← Retour</button> : <span />}
            {step < 7 ? <button className="button button-primary" onClick={goNext}>Continuer <span>→</span></button> : <a className={`button button-primary final-book${legal ? "" : " disabled"}`} href={legal ? "/confirmation" : undefined} aria-disabled={!legal}>Réserver — {totals.total} € à payer après intervention</a>}
          </div>
        </section>
        <Summary address={address} selected={selected} lawnSurface={lawnSurface} hedgeLength={hedgeLength} hedgeHeight={hedgeHeight} duration={duration} waste={waste} totals={totals} />
      </div>
      <div className="mobile-price-bar"><div><strong>{totals.total} €</strong><small>{duration === 1 ? "1/2 journée" : `${duration / 2} journée`}</small></div>{step < 7 ? <button onClick={goNext}>Continuer →</button> : <a className={!legal ? "disabled" : ""} href={legal ? "/confirmation" : undefined}>Réserver</a>}</div>
    </main>
  );
}

function Intro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <div className="step-intro"><p>{eyebrow}</p><h1>{title}</h1><span>{copy}</span></div>;
}

function StepAddress({ address, setAddress }: { address: string; setAddress: (v: string) => void }) {
  const [locating, setLocating] = useState(false);
  return <>
    <Intro eyebrow="Adresse" title="Où doit-on intervenir ?" copy="Cela nous permet de vérifier nos disponibilités et le déplacement." />
    <div className="field-group"><label htmlFor="address">Adresse du jardin</label><input id="address" autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} /><button className="location-link" onClick={() => { setLocating(true); window.setTimeout(() => { setAddress("28 rue Jules Ferry, 83170 Brignoles"); setLocating(false); }, 500); }}>⌖ {locating ? "Localisation…" : "Utiliser ma position"}</button></div>
    {address.length > 3 && <div className="address-card"><div className="mini-map" aria-hidden="true"><i /><b>SP</b><span /></div><div><strong>{address.split(",")[0]}</strong><p>{address.split(",").slice(1).join(",") || "83170 Brignoles"}</p><span>✓ Zone desservie</span></div></div>}
  </>;
}

function StepNeeds({ selected, toggleTask }: { selected: string[]; toggleTask: (v: string) => void }) {
  return <>
    <Intro eyebrow="Votre besoin" title="Que souhaitez-vous faire ?" copy="Vous pouvez sélectionner plusieurs tâches pour la même intervention." />
    <div className="task-grid">{tasks.map(([name, title, desc, image]) => <button key={name} className={selected.includes(name) ? "task-card selected" : "task-card"} onClick={() => toggleTask(name)} aria-pressed={selected.includes(name)}><img src={image} alt="" /><div><small>{name}</small><strong>{title}</strong><span>{desc}</span></div><i>{selected.includes(name) ? "✓" : "+"}</i></button>)}</div>
    <button className="unknown-link">Je ne sais pas exactement ce qu’il faut →</button>
  </>;
}

type DetailsProps = { selected: string[]; lawnSurface: string; setLawnSurface: (v: string) => void; grass: string; setGrass: (v: string) => void; terrain: string; setTerrain: (v: string) => void; hedgeLength: number; setHedgeLength: (v: number) => void; hedgeHeight: string; setHedgeHeight: (v: string) => void };
function StepDetails({ selected, lawnSurface, setLawnSurface, grass, setGrass, terrain, setTerrain, hedgeLength, setHedgeLength, hedgeHeight, setHedgeHeight }: DetailsProps) {
  return <>
    <Intro eyebrow="Les détails" title="Aidez-nous à prévoir juste." copy="Nous affichons uniquement les questions utiles aux travaux choisis." />
    {selected.includes("Tonte") && <div className="detail-card"><h2>Pelouse</h2><Choice label="Quelle surface environ ?" values={["< 100 m²", "100–250 m²", "250–500 m²", "500–1 000 m²", "+ 1 000 m²"]} value={lawnSurface} setValue={setLawnSurface} /><Choice label="État actuel" values={["Entretenue", "Haute", "Très haute"]} value={grass} setValue={setGrass} visual /><Choice label="Terrain" values={["Plat", "Légèrement en pente", "Forte pente"]} value={terrain} setValue={setTerrain} /></div>}
    {selected.includes("Taille de haies") && <div className="detail-card"><h2>Haies</h2><label className="counter-field"><span>Longueur totale</span><div><button onClick={() => setHedgeLength(Math.max(1, hedgeLength - 1))}>−</button><strong>{hedgeLength} m</strong><button onClick={() => setHedgeLength(hedgeLength + 1)}>+</button></div></label><Choice label="Hauteur" values={["< 1,5 m", "1,5–2 m", "2–2,5 m", "2,5–3 m", "+ 3 m"]} value={hedgeHeight} setValue={setHedgeHeight} /><Choice label="Que faut-il tailler ?" values={["Dessus", "1 côté", "2 côtés", "3 faces"]} value="3 faces" setValue={() => {}} /></div>}
    <div className="upload-card"><span>Photos</span><h2>Quelques photos peuvent nous éviter de vous appeler.</h2><label><input type="file" multiple accept="image/*" />+ Ajouter des photos</label><p>Prenez une vue d’ensemble et, si besoin, une photo rapprochée. Maximum 8 photos. Évitez si possible d’inclure des personnes.</p></div>
  </>;
}

function Choice({ label, values, value, setValue, visual = false }: { label: string; values: string[]; value: string; setValue: (v: string) => void; visual?: boolean }) {
  return <fieldset className="choice-field"><legend>{label}</legend><div className={visual ? "choice-row visual" : "choice-row"}>{values.map((item) => <button type="button" key={item} className={value === item ? "selected" : ""} onClick={() => setValue(item)}>{visual && <i className={`grass-${item.toLowerCase().replaceAll(" ", "-")}`} />}{item}{item === "Entretenue" && <small>Herbe &lt; 15 cm</small>}</button>)}</div></fieldset>;
}

function StepDuration({ duration, setDuration, priority, movePriority, waste, setWaste }: { duration: number; setDuration: (v: number) => void; priority: string[]; movePriority: (i: number, d: number) => void; waste: string; setWaste: (v: string) => void }) {
  return <>
    <Intro eyebrow="Notre estimation" title="Combien de temps réserver ?" copy="Le site recommande la durée la plus adaptée aux informations renseignées." />
    <div className="recommendation"><span>Recommandation</span><strong>1 demi-journée</strong><p>Environ 4 h d’intervention · Recommandé pour votre demande</p><i>✓</i></div>
    <div className="duration-grid">{[[1,"1/2 journée","4 h"],[2,"1 journée","8 h"],[3,"1,5 jour","12 h"],[4,"2 jours","16 h"]].map(([value,label,hours]) => <button key={value} className={duration === value ? "selected" : ""} onClick={() => setDuration(Number(value))}><strong>{label}</strong><span>{hours}</span>{Number(value) === 1 && <b>Recommandé</b>}</button>)}</div>
    <div className="priority-card"><h2>Si nous devons choisir, que faut-il faire en premier ?</h2>{priority.map((item,index) => <div key={item}><span>{index + 1}</span><strong>{item}</strong><button onClick={() => movePriority(index,-1)} aria-label={`Remonter ${item}`}>↑</button><button onClick={() => movePriority(index,1)} aria-label={`Descendre ${item}`}>↓</button></div>)}</div>
    <div className="waste-card"><h2>Que faisons-nous des déchets verts ?</h2><div><button className={waste === "laisser" ? "selected" : ""} onClick={() => setWaste("laisser")}><strong>Les laisser sur place</strong><span>Regroupés proprement à l’endroit de votre choix.</span></button><button className={waste === "emporter" ? "selected" : ""} onClick={() => setWaste("emporter")}><strong>Les emporter</strong><span>Chargement et évacuation · environ 1–2 m³.</span></button></div></div>
  </>;
}

function StepSchedule({ date, setDate, slot, setSlot, flexible, setFlexible }: { date: string; setDate: (v: string) => void; slot: string; setSlot: (v: string) => void; flexible: boolean; setFlexible: (v: boolean) => void }) {
  return <>
    <Intro eyebrow="Le planning" title="Quand voulez-vous que nous intervenions ?" copy="Les créneaux proposés correspondent aux disponibilités de nos équipes." />
    <div className="schedule-tabs"><button className="selected">Au plus tôt</button><button>Cette semaine</button><button>Choisir une date</button></div>
    <div className="date-strip">{dates.map((item) => <button key={item} className={date === item ? "selected" : ""} onClick={() => setDate(item)}>{item.split(" ")[0]}<strong>{item.split(" ")[1]}</strong></button>)}</div>
    <h2 className="selected-date">Jeudi 20 août</h2>
    <div className="slot-grid">{["08:00 — 12:00", "13:00 — 17:00"].map((item) => <button key={item} className={slot === item ? "selected" : ""} onClick={() => setSlot(item)}><strong>{item}</strong><span>{item.startsWith("08") ? "Matin" : "Après-midi"}</span></button>)}</div>
    <label className="flexible-toggle"><span><strong>Je suis flexible sur la journée</strong><small>Nous choisissons matin ou après-midi et confirmons au plus tard 48 h avant.</small></span><b>−10 €</b><input type="checkbox" checked={flexible} onChange={(e) => setFlexible(e.target.checked)} /><i /></label>
    <div className="weather-note"><span>☁</span><div><strong>Et s’il pleut ?</strong><p>Si les conditions rendent l’intervention impossible ou inefficace, vous pourrez choisir gratuitement un nouveau créneau.</p></div></div>
  </>;
}

function StepAccess({ access, setAccess, animal, setAnimal }: { access: string; setAccess: (v: string) => void; animal: boolean; setAnimal: (v: boolean) => void }) {
  return <>
    <Intro eyebrow="Sur place" title="Comment accéder au jardin ?" copy="Ces informations seront uniquement accessibles à l’équipe chargée de votre intervention." />
    <div className="access-grid">{["Je serai sur place", "Le jardin est accessible sans moi"].map((item) => <button key={item} className={access === item ? "selected" : ""} onClick={() => setAccess(item)}><span>{item.startsWith("Je") ? "◎" : "⌂"}</span><strong>{item}</strong><i>{access === item ? "✓" : "+"}</i></button>)}</div>
    {access.includes("sans moi") && <div className="detail-card"><h2>Type d’accès</h2><Choice label="Choisissez une option" values={["Portail ouvert", "Boîte à clés", "Code", "Autre"]} value="Code" setValue={() => {}} /><div className="field-group compact"><label htmlFor="gate">Code du portail</label><input id="gate" type="password" defaultValue="1842" /><label className="remember"><input type="checkbox" /> Conserver ces instructions pour mes prochaines interventions</label></div></div>}
    <div className="detail-card"><h2>Accès du matériel</h2><Choice label="Un utilitaire peut-il stationner à proximité ?" values={["Oui", "Non"]} value="Oui" setValue={() => {}} /><Choice label="Distance jusqu’au jardin" values={["< 20 m", "20–50 m", "> 50 m"]} value="< 20 m" setValue={() => {}} /><Choice label="Largeur du passage le plus étroit" values={["> 1 m", "80 cm–1 m", "< 80 cm", "Je ne sais pas"]} value="> 1 m" setValue={() => {}} /></div>
    <label className="animal-line"><span>Y a-t-il un chien ou un autre animal sur la propriété ?</span><button className={!animal ? "selected" : ""} onClick={() => setAnimal(false)}>Non</button><button className={animal ? "selected" : ""} onClick={() => setAnimal(true)}>Oui</button></label>
    <div className="field-group"><label htmlFor="notes">Une information utile à ajouter ? <span>Facultatif</span></label><textarea id="notes" maxLength={500} placeholder="Exemple : sonnette en panne, portail à pousser fort, attention au système d’arrosage près de la haie…" /></div>
  </>;
}

function StepCheckout({ address, selected, slot, totals, legal, setLegal }: { address: string; selected: string[]; slot: string; totals: { total: number; afterTax: number }; legal: boolean; setLegal: (v: boolean) => void }) {
  return <>
    <Intro eyebrow="Paiement" title="Dernière étape." copy="Réservez sans créer de compte. Un lien sécurisé vous sera envoyé par email." />
    <div className="checkout-card"><h2>Vos coordonnées</h2><div className="form-grid"><label>Nom complet<input autoComplete="name" defaultValue="Maxime Vallat" /></label><label>Email<input type="email" autoComplete="email" defaultValue="maxime@exemple.fr" /></label><label>Téléphone mobile<input type="tel" autoComplete="tel" defaultValue="06 12 34 56 78" /></label></div></div>
    <div className="checkout-card"><div className="payment-head"><h2>Paiement</h2><span>🔒 Paiement sécurisé</span></div><button className="wallet-button">Pay <b>●</b></button><div className="or"><span>ou par carte bancaire</span></div><div className="fake-card"><label>Numéro de carte<input inputMode="numeric" autoComplete="cc-number" placeholder="1234  1234  1234  1234" /></label><label>Expiration<input inputMode="numeric" autoComplete="cc-exp" placeholder="MM / AA" /></label><label>CVC<input inputMode="numeric" autoComplete="cc-csc" placeholder="123" /></label></div><div className="no-charge"><strong>Vous ne serez pas débité aujourd’hui.</strong><p>Votre carte garantit la réservation. La prestation sera facturée après réalisation, conformément aux conditions d’annulation.</p></div><details className="promo"><summary>Ajouter un code avantage</summary><div><input aria-label="Code avantage" /><button>Appliquer</button></div></details></div>
    <div className="final-summary"><h2>Récapitulatif final</h2><p><strong>Jeudi 20 août · {slot}</strong><br />{address}</p><p>{selected.join(" · ")}<br />1 demi-journée · Évacuation des déchets</p><strong>Total : {totals.total} € TTC</strong><span>≈ {totals.afterTax} € après crédit d’impôt*</span></div>
    <label className="legal-check"><input type="checkbox" checked={legal} onChange={(e) => setLegal(e.target.checked)} /><span>Je demande expressément que la prestation puisse commencer avant la fin du délai légal de rétractation et j’accepte les CGV.</span></label>
  </>;
}

function Summary({ address, selected, lawnSurface, hedgeLength, hedgeHeight, duration, waste, totals }: { address: string; selected: string[]; lawnSurface: string; hedgeLength: number; hedgeHeight: string; duration: number; waste: string; totals: { intervention: number; evacuation: number; reduction: number; total: number; afterTax: number } }) {
  return <aside className="booking-summary"><p className="summary-kicker">Votre intervention</p><h2>Brignoles</h2><small>{address}</small><div className="summary-lines">{selected.map((item) => <div key={item}><span>{item}</span><strong>{item === "Tonte" ? lawnSurface : item === "Taille de haies" ? `${hedgeLength} m · ${hedgeHeight}` : "Sélectionné"}</strong></div>)}<div><span>Durée</span><strong>{duration === 1 ? "1 demi-journée" : `${duration / 2} journée${duration > 2 ? "s" : ""}`}</strong></div><div><span>Déchets</span><strong>{waste === "emporter" ? "Évacuation" : "Laissés sur place"}</strong></div></div><div className="price-lines"><div><span>Intervention</span><strong>{totals.intervention} €</strong></div>{totals.evacuation > 0 && <div><span>Évacuation</span><strong>{totals.evacuation} €</strong></div>}{totals.reduction > 0 && <div><span>Flexibilité</span><strong>−{totals.reduction} €</strong></div>}<div><span>Déplacement</span><strong>Inclus</strong></div></div><div className="summary-total"><span>Total TTC</span><strong>{totals.total} €</strong><p>≈ {totals.afterTax} € après crédit d’impôt*</p></div><button>Voir le détail du prix</button><p className="summary-footnote">Prix ferme pour la durée réservée. Aucun supplément sans votre accord.</p></aside>;
}
