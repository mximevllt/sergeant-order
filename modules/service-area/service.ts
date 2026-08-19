import { getDatabase } from "@/db/runtime";

export type ServiceAreaReason = "ELIGIBLE" | "ADDRESS_INCOMPLETE" | "OUTSIDE_DEPARTMENT" | "OUTSIDE_ZONE" | "ZONE_UNAVAILABLE";
export type ServiceAreaResult = {
  eligible: boolean;
  reason: ServiceAreaReason;
  postalCode: string;
  city: string;
  matchedCity: string | null;
  candidates: string[];
  zone: null | { id: string; code: string; name: string; minLeadHours: number; maxAdvanceDays: number; surchargeTtcCents: number };
  message: string;
};

type AddressParts = { postalCode: string; city: string };
type ZoneRow = { id: string; code: string; name: string; minLeadHours: number; maxAdvanceDays: number; surchargeTtcCents: number };

function cleanText(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/gu, " ").slice(0, maximum) : "";
}

function normalizeCity(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("fr-FR").replace(/[’'-]/gu, " ").replace(/[^a-z0-9 ]/gu, " ").replace(/\s+/gu, " ").trim();
}

export function parseServiceAddress(value: unknown): AddressParts {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const raw = value as Record<string, unknown>;
    return { postalCode: cleanText(raw.postalCode, 5).replace(/\D/gu, ""), city: cleanText(raw.city, 100) };
  }
  const address = cleanText(value, 300);
  const matches = [...address.matchAll(/\b(\d{5})\s+([^,]+)/gu)];
  const last = matches.at(-1);
  return last ? { postalCode: last[1], city: last[2].trim() } : { postalCode: "", city: "" };
}

function rejected(parts: AddressParts, reason: ServiceAreaReason, message: string, candidates: string[] = []): ServiceAreaResult {
  return { eligible: false, reason, postalCode: parts.postalCode, city: parts.city, matchedCity: null, candidates, zone: null, message };
}

export async function checkServiceArea(value: unknown): Promise<ServiceAreaResult> {
  const parts = parseServiceAddress(value);
  if (!/^\d{5}$/u.test(parts.postalCode) || !parts.city) {
    return rejected(parts, "ADDRESS_INCOMPLETE", "Ajoutez un code postal et une ville pour vérifier la zone desservie.");
  }
  const department = parts.postalCode.slice(0, 2);
  if (!["06", "13", "83"].includes(department)) {
    return rejected(parts, "OUTSIDE_DEPARTMENT", "Cette adresse se trouve en dehors de notre zone d’intervention.");
  }

  const database = getDatabase();
  const zone = await database.prepare(`
    SELECT id, code, name, min_lead_hours AS minLeadHours, max_advance_days AS maxAdvanceDays,
           surcharge_ttc_cents AS surchargeTtcCents
    FROM service_zones WHERE department_code = ? AND active = 1 LIMIT 1
  `).bind(department).first<ZoneRow>();
  if (!zone) return rejected(parts, "ZONE_UNAVAILABLE", "Ce secteur n’est pas encore ouvert à la réservation en ligne.");

  if (zone.code === "VAR_ALL") {
    return { eligible: true, reason: "ELIGIBLE", postalCode: parts.postalCode, city: parts.city, matchedCity: parts.city, candidates: [], zone, message: "Adresse desservie dans tout le Var." };
  }

  const municipalities = await database.prepare(`
    SELECT DISTINCT city_name AS cityName FROM zone_municipalities
    WHERE zone_id = ? AND postal_code = ? AND included = 1 ORDER BY city_name
  `).bind(zone.id, parts.postalCode).all<{ cityName: string }>();
  const candidates = municipalities.results.map(({ cityName }) => cityName);
  const requestedCity = normalizeCity(parts.city);
  const matchedCity = candidates.find((candidate) => {
    const normalized = normalizeCity(candidate);
    return requestedCity === normalized || requestedCity.startsWith(`${normalized} `);
  }) ?? null;
  if (!matchedCity) {
    return rejected(parts, "OUTSIDE_ZONE", candidates.length ? `Le code postal existe dans notre secteur, mais pas pour la ville « ${parts.city} ». Vérifiez l’adresse.` : "Cette commune se trouve en dehors de notre zone d’intervention.", candidates);
  }
  return { eligible: true, reason: "ELIGIBLE", postalCode: parts.postalCode, city: parts.city, matchedCity, candidates, zone, message: `Adresse desservie — secteur ${zone.name}.` };
}

export async function requireServiceArea(value: unknown): Promise<ServiceAreaResult> {
  const result = await checkServiceArea(value);
  if (!result.eligible) throw new ServiceAreaError(result);
  return result;
}

export class ServiceAreaError extends Error {
  constructor(public result: ServiceAreaResult) { super(result.reason); }
}
