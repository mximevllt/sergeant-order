import { getDatabase } from "@/db/runtime";

const COMPANY_TIMEZONE = "Europe/Paris";
const DATE = /^\d{4}-\d{2}-\d{2}$/u;

type Period = "MORNING" | "AFTERNOON";
type TeamRow = { id: string; name: string; code: string };
type SlotRow = {
  orderId: string;
  orderReference: string;
  status: string;
  customerName: string;
  customerPhone: string | null;
  gardenLabel: string;
  line1: string;
  postalCode: string;
  city: string;
  teamId: string;
  teamName: string;
  startsAt: string;
  endsAt: string;
  taskLabel: string | null;
};

export type PlanningMission = {
  orderId: string;
  orderReference: string;
  status: string;
  customerName: string;
  customerPhone: string | null;
  gardenLabel: string;
  address: string;
  teamId: string;
  teamName: string;
  startsAt: string;
  endsAt: string;
  period: Period;
  tasks: string[];
};

export type PlanningBoard = {
  from: string;
  to: string;
  teams: TeamRow[];
  days: Array<{ date: string; label: string; missions: PlanningMission[] }>;
};

function localDate(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: COMPANY_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const values = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value: item }) => [type, item]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(value: string, count: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + count, 12));
  return date.toISOString().slice(0, 10);
}

function dayLabel(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: COMPANY_TIMEZONE, weekday: "long", day: "numeric", month: "long" })
    .format(new Date(`${value}T12:00:00Z`));
}

function requestedStart(value: unknown): string {
  if (typeof value === "string" && DATE.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`))) return value;
  return localDate(new Date());
}

export async function getPlanningBoard(fromInput?: unknown, visibleDays = 7): Promise<PlanningBoard> {
  const from = requestedStart(fromInput);
  const dayCount = Math.min(Math.max(Number.isInteger(visibleDays) ? visibleDays : 7, 1), 14);
  const to = addDays(from, dayCount);
  const database = getDatabase();
  const [teamsResult, slotsResult] = await Promise.all([
    database.prepare(`SELECT id, name, code FROM teams WHERE active = 1 ORDER BY code`).all<TeamRow>(),
    database.prepare(`
      SELECT o.id AS orderId, o.public_reference AS orderReference, o.status,
        u.full_name AS customerName, u.phone AS customerPhone,
        g.label AS gardenLabel, a.line1, a.postal_code AS postalCode, a.city,
        s.team_id AS teamId, t.name AS teamName, s.starts_at AS startsAt, s.ends_at AS endsAt,
        ot.label_snapshot AS taskLabel
      FROM schedule_reservation_slots s
      JOIN schedule_reservations r ON r.id = s.reservation_id AND r.kind = 'ORDER' AND r.status = 'ACTIVE'
      JOIN orders o ON o.id = r.order_id AND o.status IN ('CONFIRMED','TO_SCHEDULE','SCHEDULED','READY','IN_PROGRESS')
      JOIN users u ON u.id = o.customer_user_id
      JOIN gardens g ON g.id = o.garden_id
      JOIN addresses a ON a.id = g.address_id
      JOIN teams t ON t.id = s.team_id
      LEFT JOIN order_tasks ot ON ot.order_id = o.id
      WHERE s.status = 'ACTIVE' AND s.starts_at >= ? AND s.starts_at < ?
      ORDER BY s.starts_at, t.code, o.public_reference, ot.priority, ot.label_snapshot
    `).bind(`${from}T00:00:00.000Z`, `${to}T00:00:00.000Z`).all<SlotRow>(),
  ]);
  const missionMap = new Map<string, PlanningMission>();
  for (const row of slotsResult.results) {
    const date = row.startsAt.slice(0, 10);
    const key = `${row.orderId}:${row.teamId}:${date}`;
    const current = missionMap.get(key) ?? {
      orderId: row.orderId,
      orderReference: row.orderReference,
      status: row.status,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      gardenLabel: row.gardenLabel,
      address: `${row.line1}, ${row.postalCode} ${row.city}`,
      teamId: row.teamId,
      teamName: row.teamName,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      period: row.startsAt.slice(11, 13) < "12" ? "MORNING" : "AFTERNOON",
      tasks: [],
    };
    if (row.startsAt < current.startsAt) current.startsAt = row.startsAt;
    if (row.endsAt > current.endsAt) current.endsAt = row.endsAt;
    if (row.taskLabel && !current.tasks.includes(row.taskLabel)) current.tasks.push(row.taskLabel);
    missionMap.set(key, current);
  }
  const missions = [...missionMap.values()];
  return {
    from,
    to: addDays(to, -1),
    teams: teamsResult.results,
    days: Array.from({ length: dayCount }, (_, index) => {
      const date = addDays(from, index);
      return { date, label: dayLabel(date), missions: missions.filter((mission) => mission.startsAt.slice(0, 10) === date) };
    }),
  };
}
