import { getDatabase } from "@/db/runtime";
import type { AuthUser } from "@/modules/auth/service";
import { hasPermission } from "@/modules/authorization/policy.mjs";

export type InterventionStatus = "PLANNED" | "TEAM_EN_ROUTE" | "STARTED" | "PAUSED" | "COMPLETED" | "REPORT_CLOSED";
export type InterventionTaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "NOT_DONE" | "BLOCKED";
export type FieldMission = {
  id: string;
  orderId: string;
  orderReference: string;
  status: InterventionStatus;
  plannedStartsAt: string;
  plannedEndsAt: string;
  departedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  customerName: string;
  customerPhone: string | null;
  gardenLabel: string;
  address: string;
  teamName: string;
  tasks: Array<{ id: string; label: string; status: InterventionTaskStatus; notes: string | null }>;
  report: InterventionReport | null;
};
export type InterventionReport = {
  status: "DRAFT" | "READY_FOR_REVIEW" | "CLOSED";
  customerSummary: string | null;
  internalSummary: string | null;
  incidentReported: boolean;
  incidentDetails: string | null;
  closedAt: string | null;
};

export class InterventionNotFoundError extends Error {}
export class InterventionConflictError extends Error { constructor(public code: string) { super(code); } }
export class InterventionInputError extends Error { constructor(public fields: Record<string, string>) { super("INTERVENTION_INPUT_INVALID"); } }

type MissionRow = Omit<FieldMission, "tasks" | "report">;
type TaskRow = { id: string; label: string; status: InterventionTaskStatus; notes: string | null };
const FIELD_ACTIONS = ["DEPART", "ARRIVE", "START", "PAUSE", "RESUME", "COMPLETE"] as const;
type FieldAction = typeof FIELD_ACTIONS[number];
const TASK_STATUSES: InterventionTaskStatus[] = ["TODO", "IN_PROGRESS", "DONE", "NOT_DONE", "BLOCKED"];

function canReadAll(user: AuthUser): boolean {
  return hasPermission(user.roles, "orders.read");
}

function cleanNote(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const note = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (!note) return null;
  if (note.length > 1000) throw new InterventionInputError({ note: "La note ne peut pas dépasser 1 000 caractères." });
  return note;
}

function cleanReportText(value: unknown, field: string, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.normalize("NFKC").trim();
  if (!text) return null;
  if (text.length > maximum) throw new InterventionInputError({ [field]: `Ce texte ne peut pas dépasser ${maximum.toLocaleString("fr-FR")} caractères.` });
  return text;
}

async function assertMissionAccess(interventionId: string, user: AuthUser): Promise<MissionRow> {
  const database = getDatabase();
  const row = await database.prepare(`
    SELECT i.id, i.order_id AS orderId, o.public_reference AS orderReference, i.status,
      i.planned_starts_at AS plannedStartsAt, i.planned_ends_at AS plannedEndsAt,
      i.departed_at AS departedAt, i.arrived_at AS arrivedAt, i.started_at AS startedAt, i.completed_at AS completedAt,
      u.full_name AS customerName, u.phone AS customerPhone, g.label AS gardenLabel,
      a.line1 || ', ' || a.postal_code || ' ' || a.city AS address, t.name AS teamName
    FROM interventions i
    JOIN orders o ON o.id = i.order_id
    JOIN users u ON u.id = o.customer_user_id
    JOIN gardens g ON g.id = o.garden_id
    JOIN addresses a ON a.id = g.address_id
    JOIN teams t ON t.id = i.team_id
    WHERE i.id = ? AND (
      ? = 1 OR EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = i.team_id AND tm.user_id = ? AND tm.ends_at IS NULL
      )
    ) LIMIT 1
  `).bind(interventionId, canReadAll(user) ? 1 : 0, user.id).first<MissionRow>();
  if (!row) throw new InterventionNotFoundError();
  return row;
}

async function viewMission(interventionId: string, user: AuthUser): Promise<FieldMission> {
  const mission = await assertMissionAccess(interventionId, user);
  const database = getDatabase();
  const [tasks, report] = await Promise.all([
    database.prepare(`
    SELECT it.id, ot.label_snapshot AS label, it.status, it.notes
    FROM intervention_tasks it JOIN order_tasks ot ON ot.id = it.order_task_id
    WHERE it.intervention_id = ? ORDER BY ot.priority, ot.label_snapshot
  `).bind(interventionId).all<TaskRow>(),
    database.prepare(`
      SELECT status, customer_summary AS customerSummary, internal_summary AS internalSummary,
        incident_reported AS incidentReported, incident_details AS incidentDetails, closed_at AS closedAt
      FROM intervention_reports WHERE intervention_id = ? LIMIT 1
    `).bind(interventionId).first<InterventionReport>(),
  ]);
  return { ...mission, tasks: tasks.results, report };
}

export async function listFieldMissions(user: AuthUser): Promise<FieldMission[]> {
  const database = getDatabase();
  const result = await database.prepare(`
    SELECT i.id
    FROM interventions i
    WHERE i.status != 'REPORT_CLOSED' AND (
      ? = 1 OR EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = i.team_id AND tm.user_id = ? AND tm.ends_at IS NULL
      )
    )
    ORDER BY CASE WHEN i.status IN ('STARTED','PAUSED','TEAM_EN_ROUTE') THEN 0 ELSE 1 END,
      i.planned_starts_at ASC
  `).bind(canReadAll(user) ? 1 : 0, user.id).all<{ id: string }>();
  return Promise.all(result.results.map(({ id }) => viewMission(id, user)));
}

export async function updateFieldMission(interventionId: string, input: unknown, user: AuthUser): Promise<FieldMission> {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const action = typeof raw.action === "string" && FIELD_ACTIONS.includes(raw.action as FieldAction) ? raw.action as FieldAction : null;
  if (!action) throw new InterventionInputError({ action: "Action terrain invalide." });
  const mission = await assertMissionAccess(interventionId, user);
  if (mission.status === "REPORT_CLOSED") throw new InterventionConflictError("MISSION_CLOSED");
  const note = cleanNote(raw.note);
  const transition: Record<FieldAction, { from: InterventionStatus[]; to: InterventionStatus; field?: string; event: string }> = {
    DEPART: { from: ["PLANNED"], to: "TEAM_EN_ROUTE", field: "departed_at", event: "TEAM_DEPARTED" },
    ARRIVE: { from: ["TEAM_EN_ROUTE"], to: "TEAM_EN_ROUTE", field: "arrived_at", event: "TEAM_ARRIVED" },
    START: { from: ["TEAM_EN_ROUTE"], to: "STARTED", field: "started_at", event: "INTERVENTION_STARTED" },
    PAUSE: { from: ["STARTED"], to: "PAUSED", event: "INTERVENTION_PAUSED" },
    RESUME: { from: ["PAUSED"], to: "STARTED", event: "INTERVENTION_RESUMED" },
    COMPLETE: { from: ["STARTED", "PAUSED"], to: "COMPLETED", field: "completed_at", event: "INTERVENTION_COMPLETED" },
  };
  const rule = transition[action];
  if (!rule.from.includes(mission.status)) throw new InterventionConflictError("STATUS_TRANSITION_DENIED");
  const database = getDatabase();
  const setTimestamp = rule.field ? `, ${rule.field} = COALESCE(${rule.field}, CURRENT_TIMESTAMP)` : "";
  const changed = await database.prepare(`
    UPDATE interventions SET status = ?${setTimestamp}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = ?
  `).bind(rule.to, interventionId, mission.status).run();
  if (Number(changed.meta.changes) !== 1) throw new InterventionConflictError("MISSION_CHANGED_CONCURRENTLY");
  const statements = [database.prepare(`
    INSERT INTO intervention_events (id, intervention_id, event_type, actor_user_id, public_note, internal_note, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), interventionId, rule.event, user.id, action === "COMPLETE" ? note : null, action === "COMPLETE" ? null : note, JSON.stringify({ from: mission.status, to: rule.to }))];
  if (action === "START") statements.push(database.prepare(`UPDATE orders SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('SCHEDULED','READY')`).bind(mission.orderId));
  if (action === "COMPLETE") statements.push(database.prepare(`
    UPDATE orders SET status = 'COMPLETED', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND NOT EXISTS (
      SELECT 1 FROM interventions remaining WHERE remaining.order_id = ? AND remaining.status NOT IN ('COMPLETED','REPORT_CLOSED')
    )
  `).bind(mission.orderId, mission.orderId));
  await database.batch(statements);
  return viewMission(interventionId, user);
}

export async function updateFieldTask(interventionId: string, taskId: string, input: unknown, user: AuthUser): Promise<FieldMission> {
  await assertMissionAccess(interventionId, user);
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const status = typeof raw.status === "string" && TASK_STATUSES.includes(raw.status as InterventionTaskStatus) ? raw.status as InterventionTaskStatus : null;
  if (!status) throw new InterventionInputError({ status: "Statut de tâche invalide." });
  const notes = cleanNote(raw.notes);
  const database = getDatabase();
  const result = await database.prepare(`
    UPDATE intervention_tasks SET status = ?, notes = ?,
      completed_at = CASE WHEN ? IN ('DONE','NOT_DONE','BLOCKED') THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE NULL END,
      completed_by_user_id = CASE WHEN ? IN ('DONE','NOT_DONE','BLOCKED') THEN ? ELSE NULL END
    WHERE id = ? AND intervention_id = ?
  `).bind(status, notes, status, status, user.id, taskId, interventionId).run();
  if (Number(result.meta.changes) !== 1) throw new InterventionNotFoundError();
  await database.prepare(`
    INSERT INTO intervention_events (id, intervention_id, event_type, actor_user_id, internal_note, metadata_json)
    VALUES (?, ?, 'TASK_UPDATED', ?, ?, ?)
  `).bind(crypto.randomUUID(), interventionId, user.id, notes, JSON.stringify({ taskId, status })).run();
  return viewMission(interventionId, user);
}

export async function saveFieldReport(interventionId: string, input: unknown, user: AuthUser): Promise<FieldMission> {
  const mission = await assertMissionAccess(interventionId, user);
  if (mission.status !== "COMPLETED") throw new InterventionConflictError("REPORT_REQUIRES_COMPLETED_MISSION");
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const customerSummary = cleanReportText(raw.customerSummary, "customerSummary", 2_000);
  const internalSummary = cleanReportText(raw.internalSummary, "internalSummary", 3_000);
  const incidentReported = raw.incidentReported === true;
  const incidentDetails = cleanReportText(raw.incidentDetails, "incidentDetails", 2_000);
  if (incidentReported && !incidentDetails) throw new InterventionInputError({ incidentDetails: "Décrivez l’incident signalé au responsable." });
  const submit = raw.submit === true;
  if (submit && !customerSummary) throw new InterventionInputError({ customerSummary: "Un résumé destiné au client est nécessaire avant envoi au responsable." });
  const database = getDatabase();
  const saved = await database.prepare(`
    INSERT INTO intervention_reports (id, intervention_id, status, customer_summary, internal_summary, incident_reported, incident_details)
    VALUES (?, ?, 'DRAFT', ?, ?, ?, ?)
    ON CONFLICT(intervention_id) DO UPDATE SET
      customer_summary = excluded.customer_summary, internal_summary = excluded.internal_summary,
      incident_reported = excluded.incident_reported, incident_details = excluded.incident_details,
      updated_at = CURRENT_TIMESTAMP
    WHERE intervention_reports.status = 'DRAFT'
  `).bind(crypto.randomUUID(), interventionId, customerSummary, internalSummary, incidentReported ? 1 : 0, incidentDetails).run();
  if (Number(saved.meta.changes) !== 1) throw new InterventionConflictError("REPORT_ALREADY_SUBMITTED");
  const statements = [database.prepare(`
    INSERT INTO intervention_events (id, intervention_id, event_type, actor_user_id, internal_note, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), interventionId, submit ? "REPORT_SUBMITTED" : "REPORT_SAVED", user.id, internalSummary, JSON.stringify({ incidentReported }))];
  if (submit) {
    const tasks = await database.prepare(`SELECT status FROM intervention_tasks WHERE intervention_id = ?`).bind(interventionId).all<{ status: InterventionTaskStatus }>();
    if (tasks.results.some((task) => !["DONE", "NOT_DONE", "BLOCKED"].includes(task.status))) throw new InterventionConflictError("REPORT_TASKS_INCOMPLETE");
    statements.push(database.prepare(`UPDATE intervention_reports SET status = 'READY_FOR_REVIEW', updated_at = CURRENT_TIMESTAMP WHERE intervention_id = ? AND status = 'DRAFT'`).bind(interventionId));
  }
  await database.batch(statements);
  return viewMission(interventionId, user);
}

export async function listReportsForReview(user: AuthUser): Promise<FieldMission[]> {
  const database = getDatabase();
  const rows = await database.prepare(`
    SELECT i.id FROM interventions i JOIN intervention_reports r ON r.intervention_id = i.id
    WHERE r.status = 'READY_FOR_REVIEW' ORDER BY i.completed_at ASC
  `).all<{ id: string }>();
  return Promise.all(rows.results.map(({ id }) => viewMission(id, user)));
}

export async function closeInterventionReport(interventionId: string, user: AuthUser): Promise<FieldMission> {
  if (!hasPermission(user.roles, "orders.write")) throw new InterventionConflictError("REPORT_REVIEW_DENIED");
  await assertMissionAccess(interventionId, user);
  const database = getDatabase();
  const closed = await database.prepare(`
    UPDATE intervention_reports SET status = 'CLOSED', closed_by_user_id = ?, closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE intervention_id = ? AND status = 'READY_FOR_REVIEW'
  `).bind(user.id, interventionId).run();
  if (Number(closed.meta.changes) !== 1) throw new InterventionConflictError("REPORT_NOT_READY");
  await database.batch([
    database.prepare(`UPDATE interventions SET status = 'REPORT_CLOSED', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'COMPLETED'`).bind(interventionId),
    database.prepare(`INSERT INTO intervention_events (id, intervention_id, event_type, actor_user_id, metadata_json) VALUES (?, ?, 'REPORT_CLOSED', ?, ?)`)
      .bind(crypto.randomUUID(), interventionId, user.id, JSON.stringify({ review: "approved" })),
  ]);
  return viewMission(interventionId, user);
}
