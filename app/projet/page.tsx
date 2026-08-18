"use client";

import Link from "next/link";
import { useState } from "react";
import { Footer, Header, SectionLabel } from "../components";

const projects = ["Création de jardin", "Plantation importante", "Arrosage automatique", "Terrassement", "Élagage / travaux arboricoles", "Autre"];

export default function ProjectPage() {
  const [type,setType] = useState("Création de jardin");
  const [sent,setSent] = useState(false);
  return <main><Header /><section className="project-page"><div className="project-intro"><SectionLabel number="Projet">Étude séparée</SectionLabel><h1>Un projet <em>plus important ?</em></h1><p>Conception, terrassement, plantations ou travaux arboricoles : décrivez-nous le besoin sans le mélanger à la réservation instantanée.</p><div><strong>Pour l’entretien courant</strong><span>Tonte, haies, débroussaillage, massifs et nettoyage restent réservables immédiatement.</span><Link href="/reserver">Réserver un entretien →</Link></div></div>{sent ? <div className="project-success"><span>✓</span><h2>Votre projet est transmis.</h2><p>Nous revenons vers vous avec la bonne méthode d’étude, sans vous faire recommencer ce formulaire.</p><Link className="button button-primary" href="/">Retour à l’accueil</Link></div> : <form className="project-form" onSubmit={(e)=>{e.preventDefault();setSent(true);}}><fieldset><legend>Quel type de projet ?</legend><div>{projects.map(item=><button type="button" key={item} className={type===item?"selected":""} onClick={()=>setType(item)}>{item}<span>{type===item?"✓":"+"}</span></button>)}</div></fieldset><label>Adresse du projet<input autoComplete="street-address" defaultValue="83170 Brignoles" /></label><label>Décrivez votre projet<textarea placeholder="Surface, contraintes, résultat souhaité, délai idéal…" /></label><label className="project-upload"><input type="file" multiple accept="image/*" />+ Ajouter des photos</label><label>Vos coordonnées<input autoComplete="name" placeholder="Nom complet" /><input type="email" autoComplete="email" placeholder="Email" /></label><button className="button button-primary" type="submit">Faire étudier mon projet →</button></form>}</section><Footer /></main>;
}
