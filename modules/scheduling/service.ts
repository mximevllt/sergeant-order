import { getDatabase } from "@/db/runtime";
import type { AppDatabase, PreparedStatement } from "@/db/database";
import type { AuthUser } from "@/modules/auth/service";
import { getQuote, type QuoteView } from "@/modules/quotes/service";
import { requireServiceArea } from "@/modules/service-area/service";

const COMPANY_TIMEZONE = "Europe/Paris";
const HOLD_TTL_MS = 15 * 60 * 1000;
const MAX_HALF_DAYS = 60;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,100}$/u;

type PeriodCode = "MORNING" | "AFTERNOON";
type TeamRow = { id: string; name: string };
type WeeklyHourRow = { teamId: string; isoWeekday: number; period: PeriodCode; startsLocal: string; endsLocal: string };
type BusyRange = { teamId: string; startsAt: string; endsAt: string };
type WorkPeriod = {
  teamId: string;
  teamName: string;
  startsAt: string;
  endsAt: string;
  localDate: string;
  period: PeriodCode;
  timeLabel: string;
};
type InternalAvailability = AvailabilityOption & { candidates: Array<{ teamId: string; teamName: string; slots: WorkPeriod[] }> };

export type AvailabilityOption = {
  startsAt: string;
  endsAt: string;
  localDate: string;
  period: PeriodCode;
  dateLabel: string;
  timeLabel: string;
  completionLabel: string;
  halfDays: number;
  availableTeams: number;
};

export type AvailabilityResult = {
  timezone: string;
  minimumLeadHours: number;
  maximumAdvanceDays: number;
  holdMinutes: number;
  options: AvailabilityOption[];
};

export type ScheduleHoldView = {
  id: string;
  quoteId: string;
  status: "ACTIVE";
  expiresAt: string;
  startsAt: string;
  endsAt: string;
  halfDays: number;
  dateLabel: string;
  timeLabel: string;
  completionLabel: string;
};

export class SchedulingInputError extends Error {
  constructor(public fields: Record<string, string>) { super("SCHEDULING_INPUT_INVALID"); }
}
export class SchedulingConflictError extends Error {}
export class SchedulingUnavailableError extends Error {}

function cleanTaskCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter((item) => /^[A-Z0-9_]{2,50}$/u.test(item)))].slice(0, 20);
}

function parseHalfDays(value: unknown): number {
  const halfDays = Number(value);
  return Number.isInteger(halfDays) && halfDays >= 1 && halfDays <= MAX_HALF_DAYS ? halfDays : 0;
}

function parseParts(date: Date, timezone = COMPANY_TIMEZONE): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, Number(value)]));
}

function localDate(date: Date): string {
  const parts = parseParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function addLocalDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return date.toISOString().slice(0, 10);
}

function isoWeekday(value: string): number {
  const day = new Date(`${value}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function zonedDateTime(value: string, time: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = new Date(wanted);
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const displayed = parseParts(candidate);
    const displayedAsUtc = Date.UTC(displayed.year, displayed.month - 1, displayed.day, displayed.hour, displayed.minute, displayed.second);
    candidate = new Date(candidate.getTime() + wanted - displayedAsUtc);
  }
  return candidate;
}

function dateLabel(startsAt: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: COMPANY_TIMEZONE, weekday: "long", day: "numeric", month: "long" }).format(new Date(startsAt));
}

function completionLabel(endsAt: string): string {
  return `Fin prévue ${new Intl.DateTimeFormat("fr-FR", { timeZone: COMPANY_TIMEZONE, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(endsAt))}`;
}

function overlaps(period: WorkPeriod, range: BusyRange): boolean {
  return period.startsAt < range.endsAt && period.endsAt > range.startsAt;
}

function placeholders(values: unknown[]): string {
  return values.map(() => "?").join(",");
}

async function cleanupExpiredHolds(database: AppDatabase, nowIso = new Date().toISOString()): Promise<void> {
  await database.batch([
    database.prepare(`
      UPDATE quotes SET status = 'PRICED', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'SLOT_HELD' AND id IN (
        SELECT quote_id FROM schedule_reservations
        WHERE kind = 'HOLD' AND status = 'ACTIVE' AND expires_at IS NOT NULL AND expires_at <= ?
      )
    `).bind(nowIso),
    database.prepare(`
      UPDATE schedule_reservation_slots SET status = 'RELEASED'
      WHERE status = 'ACTIVE' AND reservation_id IN (
        SELECT id FROM schedule_reservations
        WHERE kind = 'HOLD' AND status = 'ACTIVE' AND expires_at IS NOT NULL AND expires_at <= ?
      )
    `).bind(nowIso),
    database.prepare(`
      UPDATE schedule_reservations SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
      WHERE kind = 'HOLD' AND status = 'ACTIVE' AND expires_at IS NOT NULL AND expires_at <= ?
    `).bind(nowIso),
  ]);
}

async function internalAvailability(value: unknown, now = new Date()): Promise<{ result: AvailabilityResult; internal: InternalAvailability[] }> {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const taskCodes = cleanTaskCodes(raw.taskCodes);
  const halfDays = parseHalfDays(raw.halfDays);
  const fields: Record<string, string> = {};
  if (!taskCodes.length) fields.taskCodes = "Sélectionnez au moins une prestation.";
  if (!halfDays) fields.halfDays = "Choisissez une durée comprise entre une demi-journée et 30 jours.";
  if (Object.keys(fields).length) throw new SchedulingInputError(fields);

  const area = await requireServiceArea(raw.address);
  const database = getDatabase();
  await cleanupExpiredHolds(database, now.toISOString());
  const catalogRows = await database.prepare(`
    SELECT code, required_capability AS requiredCapability
    FROM catalog_tasks WHERE active = 1 AND code IN (${placeholders(taskCodes)})
  `).bind(...taskCodes).all<{ code: string; requiredCapability: string | null }>();
  if (catalogRows.results.length !== taskCodes.length) throw new SchedulingInputError({ taskCodes: "Une prestation n’est plus disponible." });
  const requiredCapabilities = [...new Set(catalogRows.results.map(({ requiredCapability }) => requiredCapability).filter((item): item is string => Boolean(item)))];

  const [teamsResult, capabilitiesResult, hoursResult] = await Promise.all([
    database.prepare(`SELECT id, name FROM teams WHERE active = 1 ORDER BY code`).all<TeamRow>(),
    database.prepare(`SELECT team_id AS teamId, capability FROM team_capabilities WHERE active = 1`).all<{ teamId: string; capability: string }>(),
    database.prepare(`
      SELECT team_id AS teamId, iso_weekday AS isoWeekday, period, starts_local AS startsLocal, ends_local AS endsLocal
      FROM team_weekly_hours WHERE active = 1 ORDER BY team_id, iso_weekday, starts_local
    `).all<WeeklyHourRow>(),
  ]);
  const capabilityMap = new Map<string, Set<string>>();
  for (const row of capabilitiesResult.results) {
    const set = capabilityMap.get(row.teamId) ?? new Set<string>();
    set.add(row.capability);
    capabilityMap.set(row.teamId, set);
  }
  const teams = teamsResult.results.filter((team) => requiredCapabilities.every((capability) => capabilityMap.get(team.id)?.has(capability)));
  if (!teams.length) return { result: { timezone: COMPANY_TIMEZONE, minimumLeadHours: area.zone!.minLeadHours, maximumAdvanceDays: area.zone!.maxAdvanceDays, holdMinutes: HOLD_TTL_MS / 60_000, options: [] }, internal: [] };

  const minimumStart = new Date(now.getTime() + area.zone!.minLeadHours * 60 * 60 * 1000);
  const maximumStart = new Date(now.getTime() + area.zone!.maxAdvanceDays * 24 * 60 * 60 * 1000);
  const extraDays = Math.ceil(halfDays / 10) * 7 + 7;
  const firstDate = localDate(now);
  const lastGeneratedDate = addLocalDays(firstDate, area.zone!.maxAdvanceDays + extraDays);
  const rangeEnd = zonedDateTime(lastGeneratedDate, "23:59").toISOString();
  const teamIds = teams.map(({ id }) => id);
  const [unavailabilityResult, occupiedResult] = await Promise.all([
    database.prepare(`
      SELECT team_id AS teamId, starts_at AS startsAt, ends_at AS endsAt
      FROM team_unavailabilities
      WHERE team_id IN (${placeholders(teamIds)}) AND starts_at < ? AND ends_at > ?
    `).bind(...teamIds, rangeEnd, now.toISOString()).all<BusyRange>(),
    database.prepare(`
      SELECT s.team_id AS teamId, s.starts_at AS startsAt, s.ends_at AS endsAt
      FROM schedule_reservation_slots s
      JOIN schedule_reservations r ON r.id = s.reservation_id
      WHERE s.team_id IN (${placeholders(teamIds)}) AND s.status = 'ACTIVE' AND r.status = 'ACTIVE'
        AND (r.expires_at IS NULL OR r.expires_at > ?) AND s.starts_at < ? AND s.ends_at > ?
    `).bind(...teamIds, now.toISOString(), rangeEnd, now.toISOString()).all<BusyRange>(),
  ]);
  const busy = [...unavailabilityResult.results, ...occupiedResult.results];
  const hoursByTeam = new Map<string, WeeklyHourRow[]>();
  for (const row of hoursResult.results) {
    const rows = hoursByTeam.get(row.teamId) ?? [];
    rows.push(row);
    hoursByTeam.set(row.teamId, rows);
  }

  const grouped = new Map<string, InternalAvailability>();
  for (const team of teams) {
    const weekly = hoursByTeam.get(team.id) ?? [];
    const periods: WorkPeriod[] = [];
    for (let offset = 0; offset <= area.zone!.maxAdvanceDays + extraDays; offset += 1) {
      const day = addLocalDays(firstDate, offset);
      for (const hour of weekly.filter(({ isoWeekday: weekday }) => weekday === isoWeekday(day))) {
        periods.push({
          teamId: team.id,
          teamName: team.name,
          startsAt: zonedDateTime(day, hour.startsLocal).toISOString(),
          endsAt: zonedDateTime(day, hour.endsLocal).toISOString(),
          localDate: day,
          period: hour.period,
          timeLabel: `${hour.startsLocal} — ${hour.endsLocal}`,
        });
      }
    }
    periods.sort((left, right) => left.startsAt.localeCompare(right.startsAt));
    for (let index = 0; index + halfDays <= periods.length; index += 1) {
      const slots = periods.slice(index, index + halfDays);
      const first = slots[0];
      const last = slots.at(-1)!;
      const startTime = new Date(first.startsAt);
      if (startTime < minimumStart || startTime > maximumStart) continue;
      if (slots.some((period) => busy.some((range) => range.teamId === team.id && overlaps(period, range)))) continue;
      const key = `${first.startsAt}|${last.endsAt}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.availableTeams += 1;
        existing.candidates.push({ teamId: team.id, teamName: team.name, slots });
      } else {
        grouped.set(key, {
          startsAt: first.startsAt,
          endsAt: last.endsAt,
          localDate: first.localDate,
          period: first.period,
          dateLabel: dateLabel(first.startsAt),
          timeLabel: first.timeLabel,
          completionLabel: completionLabel(last.endsAt),
          halfDays,
          availableTeams: 1,
          candidates: [{ teamId: team.id, teamName: team.name, slots }],
        });
      }
    }
  }
  const internal = [...grouped.values()].sort((left, right) => left.startsAt.localeCompare(right.startsAt)).slice(0, 100);
  return {
    result: {
      timezone: COMPANY_TIMEZONE,
      minimumLeadHours: area.zone!.minLeadHours,
      maximumAdvanceDays: area.zone!.maxAdvanceDays,
      holdMinutes: HOLD_TTL_MS / 60_000,
      options: internal.map((option) => ({
        startsAt: option.startsAt,
        endsAt: option.endsAt,
        localDate: option.localDate,
        period: option.period,
        dateLabel: option.dateLabel,
        timeLabel: option.timeLabel,
        completionLabel: option.completionLabel,
        halfDays: option.halfDays,
        availableTeams: option.availableTeams,
      })),
    },
    internal,
  };
}

export async function searchAvailability(value: unknown, now = new Date()): Promise<AvailabilityResult> {
  return (await internalAvailability(value, now)).result;
}

function holdView(row: Record<string, unknown>, slots: Array<{ startsAt: string; endsAt: string }>): ScheduleHoldView {
  const startsAt = slots[0].startsAt;
  const endsAt = slots.at(-1)!.endsAt;
  const time = new Intl.DateTimeFormat("fr-FR", { timeZone: COMPANY_TIMEZONE, hour: "2-digit", minute: "2-digit" });
  return {
    id: String(row.id),
    quoteId: String(row.quoteId),
    status: "ACTIVE",
    expiresAt: String(row.expiresAt),
    startsAt,
    endsAt,
    halfDays: slots.length,
    dateLabel: dateLabel(startsAt),
    timeLabel: `${time.format(new Date(startsAt))} — ${time.format(new Date(slots[0].endsAt))}`,
    completionLabel: completionLabel(endsAt),
  };
}

async function activeHoldRow(database: AppDatabase, quoteId: string, nowIso: string): Promise<Record<string, unknown> | null> {
  return database.prepare(`
    SELECT id, quote_id AS quoteId, expires_at AS expiresAt
    FROM schedule_reservations
    WHERE quote_id = ? AND kind = 'HOLD' AND status = 'ACTIVE' AND expires_at > ?
    ORDER BY created_at DESC LIMIT 1
  `).bind(quoteId, nowIso).first<Record<string, unknown>>();
}

async function slotsForHold(database: AppDatabase, reservationId: string): Promise<Array<{ startsAt: string; endsAt: string }>> {
  const rows = await database.prepare(`
    SELECT starts_at AS startsAt, ends_at AS endsAt
    FROM schedule_reservation_slots WHERE reservation_id = ? AND status = 'ACTIVE' ORDER BY starts_at
  `).bind(reservationId).all<{ startsAt: string; endsAt: string }>();
  return rows.results;
}

export async function getActiveHold(quoteId: string, actor: AuthUser | null, provenDraftId: string | null, now = new Date()): Promise<ScheduleHoldView | null> {
  const database = getDatabase();
  await cleanupExpiredHolds(database, now.toISOString());
  await getQuote(quoteId, actor, provenDraftId);
  const row = await activeHoldRow(database, quoteId, now.toISOString());
  if (!row) return null;
  const slots = await slotsForHold(database, String(row.id));
  return slots.length ? holdView(row, slots) : null;
}

function availabilityInput(quote: QuoteView): Record<string, unknown> {
  return { address: quote.requestSnapshot.address, taskCodes: quote.tasks.map(({ code }) => code), halfDays: quote.selectedHalfDays };
}

export async function createScheduleHold(quoteId: string, startsAtValue: unknown, actor: AuthUser | null, provenDraftId: string | null, idempotencyKey: string, now = new Date()): Promise<ScheduleHoldView> {
  const startsAt = typeof startsAtValue === "string" && !Number.isNaN(Date.parse(startsAtValue)) ? new Date(startsAtValue).toISOString() : "";
  const fields: Record<string, string> = {};
  if (!startsAt) fields.startsAt = "Choisissez un créneau disponible.";
  if (!IDEMPOTENCY_KEY.test(idempotencyKey)) fields.idempotencyKey = "Clé de requête invalide.";
  if (Object.keys(fields).length) throw new SchedulingInputError(fields);
  const database = getDatabase();
  await cleanupExpiredHolds(database, now.toISOString());
  const quote = await getQuote(quoteId, actor, provenDraftId);
  if (!["PRICED", "SLOT_HELD"].includes(quote.status)) throw new SchedulingConflictError("QUOTE_NOT_HOLDABLE");

  const repeated = await database.prepare(`
    SELECT id, quote_id AS quoteId, expires_at AS expiresAt FROM schedule_reservations
    WHERE idempotency_key = ? LIMIT 1
  `).bind(idempotencyKey).first<Record<string, unknown>>();
  if (repeated) {
    if (String(repeated.quoteId) !== quoteId) throw new SchedulingConflictError("IDEMPOTENCY_KEY_REUSED");
    const repeatedSlots = await slotsForHold(database, String(repeated.id));
    if (repeatedSlots[0]?.startsAt !== startsAt) throw new SchedulingConflictError("IDEMPOTENCY_KEY_REUSED");
    if (String(repeated.expiresAt) <= now.toISOString()) throw new SchedulingUnavailableError("HOLD_EXPIRED");
    return holdView(repeated, repeatedSlots);
  }

  const current = await activeHoldRow(database, quoteId, now.toISOString());
  if (current) {
    const currentSlots = await slotsForHold(database, String(current.id));
    if (currentSlots[0]?.startsAt === startsAt) return holdView(current, currentSlots);
  }

  const availability = await internalAvailability(availabilityInput(quote), now);
  const option = availability.internal.find((candidate) => candidate.startsAt === startsAt);
  if (!option?.candidates.length) throw new SchedulingUnavailableError("SLOT_NO_LONGER_AVAILABLE");
  const chosen = option.candidates[0];
  const holdId = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + HOLD_TTL_MS).toISOString();
  const snapshot = { ...quote.requestSnapshot, selectedStart: option.startsAt, date: option.localDate, slot: option.timeLabel, scheduleHold: { startsAt: option.startsAt, endsAt: option.endsAt, expiresAt, halfDays: option.halfDays } };
  const statements: PreparedStatement[] = [];
  if (current) {
    statements.push(
      database.prepare(`UPDATE schedule_reservation_slots SET status = 'RELEASED' WHERE reservation_id = ? AND status = 'ACTIVE'`).bind(String(current.id)),
      database.prepare(`UPDATE schedule_reservations SET status = 'RELEASED', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'ACTIVE'`).bind(String(current.id)),
    );
  }
  statements.push(
    database.prepare(`
      INSERT INTO schedule_reservations (id, quote_id, kind, status, expires_at, idempotency_key, created_by_user_id)
      VALUES (?, ?, 'HOLD', 'ACTIVE', ?, ?, ?)
    `).bind(holdId, quoteId, expiresAt, idempotencyKey, actor?.sessionKind === "CUSTOMER" ? actor.id : null),
    ...chosen.slots.map((period) => database.prepare(`
      INSERT INTO schedule_reservation_slots (id, reservation_id, team_id, starts_at, ends_at, status)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE')
    `).bind(crypto.randomUUID(), holdId, chosen.teamId, period.startsAt, period.endsAt)),
    database.prepare(`UPDATE quotes SET status = 'SLOT_HELD', request_snapshot = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('PRICED', 'SLOT_HELD')`).bind(JSON.stringify(snapshot), quoteId),
    database.prepare(`
      INSERT INTO audit_events (id, actor_user_id, actor_type, action, entity_type, entity_id, metadata_json)
      VALUES (?, ?, ?, 'SCHEDULE_HOLD_CREATED', 'quote', ?, ?)
    `).bind(crypto.randomUUID(), actor?.sessionKind === "CUSTOMER" ? actor.id : null, actor ? "USER" : "SYSTEM", quoteId, JSON.stringify({ reservationId: holdId, startsAt: option.startsAt, endsAt: option.endsAt, halfDays: option.halfDays })),
  );
  try {
    await database.batch(statements);
  } catch (error) {
    if (String(error).match(/schedule_slots|UNIQUE constraint failed/iu)) throw new SchedulingUnavailableError("SLOT_NO_LONGER_AVAILABLE");
    if (String(error).match(/idempotency/iu)) throw new SchedulingConflictError("IDEMPOTENCY_KEY_REUSED");
    throw error;
  }
  return holdView({ id: holdId, quoteId, expiresAt }, chosen.slots);
}

export async function releaseScheduleHold(quoteId: string, actor: AuthUser | null, provenDraftId: string | null): Promise<void> {
  const database = getDatabase();
  const quote = await getQuote(quoteId, actor, provenDraftId);
  const active = await database.prepare(`SELECT id FROM schedule_reservations WHERE quote_id = ? AND kind = 'HOLD' AND status = 'ACTIVE'`).bind(quoteId).all<{ id: string }>();
  if (!active.results.length) return;
  const ids = active.results.map(({ id }) => id);
  await database.batch([
    database.prepare(`UPDATE schedule_reservation_slots SET status = 'RELEASED' WHERE reservation_id IN (${placeholders(ids)}) AND status = 'ACTIVE'`).bind(...ids),
    database.prepare(`UPDATE schedule_reservations SET status = 'RELEASED', updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders(ids)}) AND status = 'ACTIVE'`).bind(...ids),
    database.prepare(`UPDATE quotes SET status = 'PRICED', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'SLOT_HELD'`).bind(quoteId),
    database.prepare(`
      INSERT INTO audit_events (id, actor_user_id, actor_type, action, entity_type, entity_id)
      VALUES (?, ?, ?, 'SCHEDULE_HOLD_RELEASED', 'quote', ?)
    `).bind(crypto.randomUUID(), actor?.sessionKind === "CUSTOMER" ? actor.id : null, actor ? "USER" : "SYSTEM", quote.id),
  ]);
}
