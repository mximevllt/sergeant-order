import { runtimeValue } from "@/config/runtime-environment";

/**
 * Accès serveur uniquement au planning partagé du CRM. La clé Supabase ne
 * doit jamais recevoir le préfixe NEXT_PUBLIC : aucune donnée de planning ou
 * de client n'est interrogée depuis le navigateur.
 */
type CrmConfig = { url: string; secret: string; bookingTeamIds: string[] };

export type CrmTeam = { id: string; name: string };
export type CrmIntervention = { team_id: string | null; scheduled_date: string; start_time: string | null; end_time: string | null };
export type CrmAbsence = { team_id: string | null; starts_on: string; ends_on: string | null };
export type CrmSiteReservation = { id: string; team_id: string; starts_at: string; ends_at: string; status: "hold" | "confirmed"; expires_at: string | null };
export type CrmPlanningSnapshot = {
  teams: CrmTeam[];
  interventions: CrmIntervention[];
  absences: CrmAbsence[];
  siteReservations: CrmSiteReservation[];
};

export class CrmSchedulingError extends Error {}
export class CrmSchedulingConflictError extends CrmSchedulingError {}

function config(): CrmConfig | null {
  const url = runtimeValue("CRM_SUPABASE_URL").replace(/\/$/u, "");
  const secret = runtimeValue("CRM_SUPABASE_SECRET_KEY");
  const bookingTeamIds = [...new Set(runtimeValue("CRM_BOOKING_TEAM_IDS").split(",").map((id) => id.trim()).filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id)))];
  if (!url || !secret || !bookingTeamIds.length) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    return { url: parsed.toString().replace(/\/$/u, ""), secret, bookingTeamIds };
  } catch {
    return null;
  }
}

export function crmSchedulingEnabled(): boolean {
  return Boolean(config());
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const settings = config();
  if (!settings) throw new CrmSchedulingError("CRM_SCHEDULING_NOT_CONFIGURED");
  const response = await fetch(`${settings.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: settings.secret,
      Authorization: `Bearer ${settings.secret}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response) throw new CrmSchedulingError("CRM_SCHEDULING_UNREACHABLE");
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof result === "object" && result && "message" in result ? String(result.message) : "CRM_SCHEDULING_REQUEST_FAILED";
    if (response.status === 409 || /SCHEDULE_CONFLICT|already reserved/iu.test(message)) throw new CrmSchedulingConflictError(message);
    throw new CrmSchedulingError(message);
  }
  return result as T;
}

function query(table: string, params: Record<string, string>): string {
  return `${table}?${new URLSearchParams(params).toString()}`;
}

export async function getCrmPlanningSnapshot(from: string, to: string, startsAt: string, endsAt: string, nowIso: string): Promise<CrmPlanningSnapshot> {
  const settings = config();
  if (!settings) throw new CrmSchedulingError("CRM_SCHEDULING_NOT_CONFIGURED");
  const [teams, interventions, absences, siteReservations] = await Promise.all([
    request<CrmTeam[]>(query("equipes", { select: "id,name", is_active: "eq.true", id: `in.(${settings.bookingTeamIds.join(",")})`, order: "name.asc" })),
    request<CrmIntervention[]>(query("interventions", { select: "team_id,scheduled_date,start_time,end_time", and: `(scheduled_date.gte.${from},scheduled_date.lte.${to},status.neq.cancelled)` })),
    request<CrmAbsence[]>(query("planning_absences", { select: "team_id,starts_on,ends_on", starts_on: `lte.${to}`, "or": `(ends_on.is.null,ends_on.gte.${from})` })),
    request<CrmSiteReservation[]>(query("reservations_site", {
      select: "id,team_id,starts_at,ends_at,status,expires_at",
      starts_at: `lt.${endsAt}`,
      ends_at: `gt.${startsAt}`,
      status: "in.(hold,confirmed)",
      "or": `(status.eq.confirmed,expires_at.gt.${nowIso})`,
    })),
  ]);
  return { teams, interventions, absences, siteReservations };
}

export type RemoteReservation = {
  id: string;
  quoteId: string;
  orderId?: string | null;
  teamId: string;
  startsAt: string;
  endsAt: string;
  expiresAt: string;
  customerName: string;
  customerEmail: string;
  title: string;
};

export async function createRemoteScheduleHold(value: RemoteReservation): Promise<void> {
  await request("rpc/reserve_site_reservation", {
    method: "POST",
    body: JSON.stringify({
      p_id: value.id,
      p_quote_id: value.quoteId,
      p_order_id: value.orderId ?? null,
      p_team_id: value.teamId,
      p_starts_at: value.startsAt,
      p_ends_at: value.endsAt,
      p_expires_at: value.expiresAt,
      p_customer_name: value.customerName,
      p_customer_email: value.customerEmail,
      p_title: value.title,
    }),
  });
}

export async function setRemoteScheduleReservationStatus(id: string, status: "released" | "confirmed", orderId?: string): Promise<void> {
  const body: Record<string, unknown> = { status };
  if (status === "released") body.expires_at = new Date().toISOString();
  if (orderId) body.order_id = orderId;
  await request(query("reservations_site", { id: `eq.${id}` }), {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
}
