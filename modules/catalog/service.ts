import { getRuntimeEnvironment } from "@/config/runtime-environment";

export type PublicCatalogTask = {
  code: string;
  label: string;
  description: string;
  measurementKind: "NONE" | "SURFACE_M2" | "LENGTH_M" | "COUNT";
  eligibleSap: boolean;
  sortOrder: number;
};

export type PublicCatalog = {
  service: { code: string; name: string; description: string };
  tasks: PublicCatalogTask[];
  pricing: { version: number; label: string; halfDayTtcCents: number; vatRateBasisPoints: number; currency: string };
};

function database(): D1Database {
  const db = getRuntimeEnvironment().DB;
  if (!db) throw new Error("CATALOG_DATABASE_UNAVAILABLE");
  return db;
}

export async function getPublicCatalog(): Promise<PublicCatalog> {
  const db = database();
  const [service, taskRows, pricing] = await Promise.all([
    db.prepare(`SELECT id, code, name, description FROM catalog_services WHERE kind = 'ONE_OFF' AND active = 1 ORDER BY sort_order LIMIT 1`).first<{ id: string; code: string; name: string; description: string }>(),
    db.prepare(`
      SELECT t.code, t.label, t.description, t.measurement_kind AS measurementKind,
             t.eligible_sap AS eligibleSap, t.sort_order AS sortOrder
      FROM catalog_tasks t JOIN catalog_services s ON s.id = t.service_id
      WHERE s.kind = 'ONE_OFF' AND s.active = 1 AND t.active = 1
      ORDER BY t.sort_order, t.code
    `).all<Record<string, unknown>>(),
    db.prepare(`
      SELECT version, label, half_day_ttc_cents AS halfDayTtcCents,
             vat_rate_basis_points AS vatRateBasisPoints, currency
      FROM pricing_versions WHERE status = 'ACTIVE' LIMIT 1
    `).first<Record<string, unknown>>(),
  ]);
  if (!service || !pricing || !taskRows.results.length) throw new Error("CATALOG_CONFIGURATION_INCOMPLETE");
  return {
    service: { code: service.code, name: service.name, description: service.description },
    tasks: taskRows.results.map((row) => ({
      code: String(row.code), label: String(row.label), description: String(row.description ?? ""),
      measurementKind: ["SURFACE_M2", "LENGTH_M", "COUNT"].includes(String(row.measurementKind)) ? row.measurementKind as PublicCatalogTask["measurementKind"] : "NONE",
      eligibleSap: Boolean(row.eligibleSap), sortOrder: Number(row.sortOrder),
    })),
    pricing: {
      version: Number(pricing.version), label: String(pricing.label), halfDayTtcCents: Number(pricing.halfDayTtcCents),
      vatRateBasisPoints: Number(pricing.vatRateBasisPoints), currency: String(pricing.currency),
    },
  };
}
