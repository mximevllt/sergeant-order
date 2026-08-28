"use client";

import { useState } from "react";
import type { FieldMission } from "@/modules/interventions/service";

export function ReportReview({ initialReports }: { initialReports: FieldMission[] }) {
  const [reports, setReports] = useState(initialReports);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  async function closeReport(id: string) {
    setClosing(id); setError(null);
    const response = await fetch(`/api/admin/interventions/${id}/report/close`, { method: "PATCH" }).catch(() => null);
    if (!response?.ok) { setClosing(null); return setError("Le compte rendu n’a pas pu être validé. Actualisez la page et réessayez."); }
    setReports((current) => current.filter((report) => report.id !== id)); setClosing(null);
  }
  if (!reports.length) return <article className="admin-empty"><span>Compte rendu</span><h2>Aucun compte rendu à valider.</h2><p>Les rapports transmis par les équipes apparaîtront ici avant toute facturation ou suite opérationnelle.</p></article>;
  return <>{error && <p className="form-status error" role="alert">{error}</p>}<div className="report-review-list">{reports.map((mission) => <article key={mission.id}><header><div><span>{mission.orderReference}</span><h2>{mission.customerName} · {mission.gardenLabel}</h2></div><small>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(mission.completedAt ?? mission.plannedEndsAt))}</small></header><section><div><span>Résumé client</span><p>{mission.report?.customerSummary}</p></div><div><span>Notes internes</span><p>{mission.report?.internalSummary || "Aucune note interne."}</p></div>{mission.report?.incidentReported && <div className="report-incident"><span>Incident signalé</span><p>{mission.report.incidentDetails}</p></div>}</section><footer><p>{mission.tasks.map((task) => `${task.label} : ${task.status}`).join(" · ")}</p><button type="button" className="button button-primary" disabled={closing === mission.id} onClick={() => void closeReport(mission.id)}>{closing === mission.id ? "Validation…" : "Valider et clôturer"}<span>→</span></button></footer></article>)}</div></>;
}
