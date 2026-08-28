"use client";

import { useState } from "react";
import type { FieldMission, InterventionStatus, InterventionTaskStatus } from "@/modules/interventions/service";

type RequestState = { kind: "idle" | "saving" | "error"; message?: string };
const STATUS_LABEL: Record<InterventionStatus, string> = { PLANNED: "À préparer", TEAM_EN_ROUTE: "En route", STARTED: "En cours", PAUSED: "En pause", COMPLETED: "Terminée", REPORT_CLOSED: "Compte rendu clôturé" };
const TASK_LABEL: Record<InterventionTaskStatus, string> = { TODO: "À faire", IN_PROGRESS: "En cours", DONE: "Réalisée", NOT_DONE: "Non réalisée", BLOCKED: "Bloquée" };

function localDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function actionOptions(status: InterventionStatus): Array<{ action: string; label: string; secondary?: boolean }> {
  if (status === "PLANNED") return [{ action: "DEPART", label: "Partir vers le jardin" }];
  if (status === "TEAM_EN_ROUTE") return [{ action: "ARRIVE", label: "Signaler l’arrivée", secondary: true }, { action: "START", label: "Démarrer l’intervention" }];
  if (status === "STARTED") return [{ action: "PAUSE", label: "Mettre en pause", secondary: true }, { action: "COMPLETE", label: "Terminer l’intervention" }];
  if (status === "PAUSED") return [{ action: "RESUME", label: "Reprendre l’intervention" }, { action: "COMPLETE", label: "Terminer l’intervention", secondary: true }];
  return [];
}

export function FieldDashboard({ initialMissions }: { initialMissions: FieldMission[] }) {
  const [missions, setMissions] = useState(initialMissions);
  const [state, setState] = useState<RequestState>({ kind: "idle" });

  function replaceMission(mission: FieldMission) {
    setMissions((current) => current.map((item) => item.id === mission.id ? mission : item));
  }

  async function updateMission(id: string, action: string) {
    setState({ kind: "saving" });
    const response = await fetch(`/api/field/interventions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }).catch(() => null);
    const data = await response?.json().catch(() => ({})) as { mission?: FieldMission; error?: string } | undefined;
    if (!response?.ok || !data?.mission) return setState({ kind: "error", message: data?.error === "STATUS_TRANSITION_DENIED" ? "Cette action n’est plus disponible : la mission a changé d’état." : "La mise à jour n’a pas pu être enregistrée." });
    replaceMission(data.mission); setState({ kind: "idle" });
  }

  async function updateTask(missionId: string, taskId: string, status: InterventionTaskStatus) {
    setState({ kind: "saving" });
    const response = await fetch(`/api/field/interventions/${missionId}/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => null);
    const data = await response?.json().catch(() => ({})) as { mission?: FieldMission } | undefined;
    if (!response?.ok || !data?.mission) return setState({ kind: "error", message: "La tâche n’a pas pu être mise à jour." });
    replaceMission(data.mission); setState({ kind: "idle" });
  }

  return <section className="field-content"><header><p className="kicker">Espace terrain sécurisé</p><h1>Vos missions</h1><p>Vos actions sont enregistrées dans l’historique de l’intervention. Seules les missions de vos équipes sont accessibles.</p></header>{state.kind === "error" && <p className="field-status" role="alert">{state.message}</p>}{!missions.length ? <article className="field-empty"><span>○</span><h2>Aucune mission à traiter.</h2><p>Les interventions affectées à votre équipe apparaîtront ici dès leur confirmation.</p></article> : <div className="field-mission-list">{missions.map((mission) => <MissionCard key={mission.id} mission={mission} saving={state.kind === "saving"} onMissionAction={updateMission} onTaskAction={updateTask} />)}</div>}</section>;
}

function MissionCard({ mission, saving, onMissionAction, onTaskAction }: { mission: FieldMission; saving: boolean; onMissionAction: (id: string, action: string) => Promise<void>; onTaskAction: (missionId: string, taskId: string, status: InterventionTaskStatus) => Promise<void> }) {
  return <article className="field-mission"><header><div><span>{STATUS_LABEL[mission.status]}</span><h2>{mission.customerName}</h2></div><time dateTime={mission.plannedStartsAt}>{localDate(mission.plannedStartsAt)}</time></header><div className="field-address"><strong>{mission.gardenLabel}</strong><p>{mission.address}</p>{mission.customerPhone && <a href={`tel:${mission.customerPhone.replace(/\s+/gu, "")}`}>Appeler le client</a>}</div><div className="field-tasks"><h3>Prestations</h3>{mission.tasks.map((task) => <div key={task.id}><strong>{task.label}</strong><span>{TASK_LABEL[task.status]}</span>{mission.status !== "COMPLETED" && <div className="field-task-actions"><button type="button" disabled={saving || task.status === "IN_PROGRESS"} onClick={() => void onTaskAction(mission.id, task.id, "IN_PROGRESS")}>En cours</button><button type="button" disabled={saving || task.status === "DONE"} onClick={() => void onTaskAction(mission.id, task.id, "DONE")}>Fait</button><button type="button" disabled={saving || task.status === "BLOCKED"} onClick={() => void onTaskAction(mission.id, task.id, "BLOCKED")}>Bloquée</button></div>}</div>)}</div>{mission.status !== "COMPLETED" && <footer>{actionOptions(mission.status).map(({ action, label, secondary }) => <button key={action} type="button" className={secondary ? "field-secondary" : "field-primary"} disabled={saving} onClick={() => void onMissionAction(mission.id, action)}>{label}</button>)}</footer>}{mission.status === "COMPLETED" && <p className="field-finished">Intervention terminée. Le compte rendu pourra être finalisé depuis le prochain module.</p>}</article>;
}
