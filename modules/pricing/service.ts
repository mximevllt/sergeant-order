import { getRuntimeEnvironment } from "@/config/runtime-environment";
import { calculatePrice, recommendedHalfDays, type PricingInput, type PricingRule } from "./engine";

export class PricingInputError extends Error {
  constructor(public fields: Record<string, string>) { super("PRICING_INPUT_INVALID"); }
}

type Estimate = {
  pricingVersion: { id: string; version: number; label: string; currency: string; vatRateBasisPoints: number };
  recommendedHalfDays: number;
  warnings: string[];
  lines: ReturnType<typeof calculatePrice>;
  totals: { intervention: number; taskFee: number; detailFee: number; accessFee: number; evacuation: number; reduction: number; total: number; afterTax: number };
};

function database(): D1Database {
  const db = getRuntimeEnvironment().DB;
  if (!db) throw new Error("PRICING_DATABASE_UNAVAILABLE");
  return db;
}

const enumValues = {
  lawnSurfaceBand: ["UNDER_100", "FROM_100_TO_250", "FROM_250_TO_500", "FROM_500_TO_1000", "OVER_1000"],
  grassState: ["MAINTAINED", "HIGH", "VERY_HIGH"],
  hedgeHeightBand: ["UNDER_1_5M", "FROM_1_5_TO_2M", "FROM_2_TO_2_5M", "FROM_2_5_TO_3M", "OVER_3M"],
  hedgeFaces: ["TOP", "ONE_SIDE", "TWO_SIDES", "THREE_FACES"],
  greenWaste: ["LEAVE_ON_SITE", "REMOVE_1_TO_2M3"],
  accessType: ["OPEN_GATE", "KEY_BOX", "CODE", "OTHER"],
  vehicleDistanceBand: ["UNDER_20M", "FROM_20_TO_50M", "OVER_50M"],
} as const;

export async function estimatePrice(value: unknown): Promise<Estimate> {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const fields: Record<string, string> = {};
  const halfDays = Number(raw.halfDays);
  if (!Number.isInteger(halfDays) || halfDays < 1 || halfDays > 60) fields.halfDays = "La durée doit être comprise entre une demi-journée et 30 jours.";
  const hedgeLengthM = Number(raw.hedgeLengthM);
  if (!Number.isFinite(hedgeLengthM) || hedgeLengthM < 1 || hedgeLengthM > 500) fields.hedgeLengthM = "La longueur de haie doit être comprise entre 1 et 500 mètres.";
  const taskCodes = Array.isArray(raw.taskCodes) ? [...new Set(raw.taskCodes.filter((item): item is string => typeof item === "string"))] : [];
  if (taskCodes.length > 12) fields.taskCodes = "Trop de prestations sélectionnées.";
  for (const [field, allowed] of Object.entries(enumValues)) if (!(allowed as readonly string[]).includes(String(raw[field]))) fields[field] = "Choix invalide.";
  for (const field of ["customerPresence", "nearbyParking", "flexibleOnDay"] as const) if (typeof raw[field] !== "boolean") fields[field] = "Choix invalide.";
  if (Object.keys(fields).length) throw new PricingInputError(fields);

  const db = database();
  const [version, taskRows] = await Promise.all([
    db.prepare(`SELECT id, version, label, currency, vat_rate_basis_points AS vatRateBasisPoints FROM pricing_versions WHERE status = 'ACTIVE' LIMIT 1`).first<Record<string, unknown>>(),
    db.prepare(`SELECT code FROM catalog_tasks WHERE active = 1`).all<{ code: string }>(),
  ]);
  if (!version) throw new Error("ACTIVE_PRICING_VERSION_MISSING");
  const activeCodes = new Set(taskRows.results.map(({ code }) => code));
  if (taskCodes.some((code) => !activeCodes.has(code))) throw new PricingInputError({ taskCodes: "Une prestation sélectionnée n’est plus disponible." });
  const ruleRows = await db.prepare(`SELECT code, label, rule_type AS ruleType, condition_json AS conditionJson, calculation_json AS calculationJson FROM pricing_rules WHERE pricing_version_id = ? AND active = 1 ORDER BY priority, code`).bind(String(version.id)).all<Record<string, unknown>>();
  const rules: PricingRule[] = ruleRows.results.map((row) => ({ code: String(row.code), label: String(row.label), ruleType: String(row.ruleType), condition: parseJson(row.conditionJson), calculation: parseJson(row.calculationJson) }));
  const input: PricingInput = {
    taskCodes, halfDays, hedgeLengthM,
    lawnSurfaceBand: String(raw.lawnSurfaceBand), grassState: String(raw.grassState),
    hedgeHeightBand: String(raw.hedgeHeightBand), hedgeFaces: String(raw.hedgeFaces), greenWaste: String(raw.greenWaste),
    customerPresence: raw.customerPresence as boolean, accessType: String(raw.accessType), nearbyParking: raw.nearbyParking as boolean,
    vehicleDistanceBand: String(raw.vehicleDistanceBand), flexibleOnDay: raw.flexibleOnDay as boolean,
  };
  const lines = calculatePrice(input, rules);
  const recommended = recommendedHalfDays(input);
  const cents = (category: string) => lines.filter((line) => line.category === category).reduce((sum, line) => sum + line.amountTtcCents, 0);
  const totalCents = lines.reduce((sum, line) => sum + line.amountTtcCents, 0);
  const warnings: string[] = [];
  if (halfDays < recommended) warnings.push("La durée choisie est inférieure à la recommandation : l’équipe suivra vos priorités sans garantir toutes les tâches.");
  if (taskCodes.includes("HEDGE_TRIMMING") && input.hedgeHeightBand === "OVER_3M") warnings.push("Une haie de plus de 3 m nécessite une vérification de sécurité et de matériel avant confirmation.");
  return {
    pricingVersion: { id: String(version.id), version: Number(version.version), label: String(version.label), currency: String(version.currency), vatRateBasisPoints: Number(version.vatRateBasisPoints) },
    recommendedHalfDays: recommended, warnings, lines,
    totals: {
      intervention: cents("intervention") / 100, taskFee: cents("tasks") / 100, detailFee: cents("details") / 100,
      accessFee: cents("access") / 100, evacuation: cents("waste") / 100, reduction: Math.abs(cents("discount")) / 100,
      total: totalCents / 100, afterTax: Math.ceil(totalCents / 2) / 100,
    },
  };
}

function parseJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string") throw new Error("PRICING_RULE_INVALID");
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("PRICING_RULE_INVALID");
  return parsed as Record<string, unknown>;
}
