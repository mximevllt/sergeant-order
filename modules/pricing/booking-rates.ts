import { runtimeValue } from "@/config/runtime-environment";

export const bookingPackageCodes = ["TWO_HOURS", "HALF_DAY", "FULL_DAY", "TWO_DAYS"] as const;
export type BookingPackageCode = (typeof bookingPackageCodes)[number];
export type BookingRate = { code: BookingPackageCode; label: string; hoursLabel: string; halfDays: number; priceTtcCents: number; sortOrder: number };

const fallbackRates: Record<BookingPackageCode, BookingRate> = {
  TWO_HOURS: { code: "TWO_HOURS", label: "Forfait 2 heures", hoursLabel: "2 h", halfDays: 1, priceTtcCents: 35000, sortOrder: 10 },
  HALF_DAY: { code: "HALF_DAY", label: "Demi-journée", hoursLabel: "4 h", halfDays: 1, priceTtcCents: 52000, sortOrder: 20 },
  FULL_DAY: { code: "FULL_DAY", label: "Journée complète", hoursLabel: "8 h", halfDays: 2, priceTtcCents: 98000, sortOrder: 30 },
  TWO_DAYS: { code: "TWO_DAYS", label: "Deux journées", hoursLabel: "16 h", halfDays: 4, priceTtcCents: 190000, sortOrder: 40 },
};

export function defaultBookingRates(): Record<BookingPackageCode, BookingRate> { return { ...fallbackRates }; }

/** Lit la même base Supabase que le CRM. En cas d'indisponibilité, le dernier
 * barème de référence embarqué protège le parcours de commande. */
export async function getBookingRates(): Promise<Record<BookingPackageCode, BookingRate>> {
  const url = runtimeValue("CRM_SUPABASE_URL").replace(/\/$/u, "");
  const secret = runtimeValue("CRM_SUPABASE_SECRET_KEY");
  if (!url || !secret) return defaultBookingRates();
  const response = await fetch(`${url}/rest/v1/tarifs_reservation_site?select=code,label,hours_label,half_days,price_ttc_cents,sort_order&order=sort_order.asc`, {
    headers: { apikey: secret, Authorization: `Bearer ${secret}` }, cache: "no-store", signal: AbortSignal.timeout(4_000),
  }).catch(() => null);
  if (!response?.ok) return defaultBookingRates();
  const rows = await response.json().catch(() => []) as unknown;
  if (!Array.isArray(rows)) return defaultBookingRates();
  const rates = defaultBookingRates();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const raw = row as Record<string, unknown>;
    const code = String(raw.code) as BookingPackageCode;
    if (!bookingPackageCodes.includes(code)) continue;
    const priceTtcCents = Number(raw.price_ttc_cents);
    const halfDays = Number(raw.half_days);
    if (!Number.isInteger(priceTtcCents) || priceTtcCents < 0 || !Number.isInteger(halfDays) || halfDays < 1 || halfDays > 4) continue;
    rates[code] = {
      code,
      label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim().slice(0, 120) : rates[code].label,
      hoursLabel: typeof raw.hours_label === "string" && raw.hours_label.trim() ? raw.hours_label.trim().slice(0, 24) : rates[code].hoursLabel,
      halfDays,
      priceTtcCents,
      sortOrder: Number.isFinite(Number(raw.sort_order)) ? Number(raw.sort_order) : rates[code].sortOrder,
    };
  }
  return rates;
}
