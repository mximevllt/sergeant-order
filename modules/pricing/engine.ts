export type PricingInput = {
  taskCodes: string[];
  halfDays: number;
  lawnSurfaceBand: string;
  grassState: string;
  hedgeLengthM: number;
  hedgeHeightBand: string;
  hedgeFaces: string;
  greenWaste: string;
  customerPresence: boolean;
  accessType: string;
  nearbyParking: boolean;
  vehicleDistanceBand: string;
  flexibleOnDay: boolean;
};

export type PricingRule = {
  code: string;
  label: string;
  ruleType: string;
  condition: Record<string, unknown>;
  calculation: Record<string, unknown>;
};

export type PriceLine = { code: string; label: string; category: "intervention" | "tasks" | "details" | "access" | "waste" | "discount"; amountTtcCents: number };

const surfaceHours: Record<string, number> = { UNDER_100: .8, FROM_100_TO_250: 1.3, FROM_250_TO_500: 2.1, FROM_500_TO_1000: 3.6, OVER_1000: 5.2 };
const hedgeFactor: Record<string, number> = { UNDER_1_5M: .8, FROM_1_5_TO_2M: 1, FROM_2_TO_2_5M: 1.25, FROM_2_5_TO_3M: 1.55, OVER_3M: 2.1 };
const otherTaskHours: Record<string, number> = { BRUSH_CLEARING: 2.4, FLOWER_BEDS: 1.6, GARDEN_CLEANING: 1.4, COMPLETE_MAINTENANCE: 3.8 };

export function recommendedHalfDays(input: PricingInput): number {
  let hours = 0;
  if (input.taskCodes.includes("MOWING")) hours += surfaceHours[input.lawnSurfaceBand] ?? 1.3;
  if (input.taskCodes.includes("HEDGE_TRIMMING")) hours += 2.4 * (hedgeFactor[input.hedgeHeightBand] ?? 1);
  for (const task of input.taskCodes) hours += otherTaskHours[task] ?? 0;
  return Math.max(1, Math.ceil(hours / 4));
}

export function calculatePrice(input: PricingInput, rules: PricingRule[]): PriceLine[] {
  const context: Record<string, unknown> = {
    taskCodes: input.taskCodes, taskCount: input.taskCodes.length, grassState: input.grassState,
    lengthM: input.hedgeLengthM, faces: input.hedgeFaces, heightBand: input.hedgeHeightBand,
    greenWaste: input.greenWaste, customerPresence: input.customerPresence, accessType: input.accessType,
    nearbyParking: input.nearbyParking, vehicleDistanceBand: input.vehicleDistanceBand, flexibleOnDay: input.flexibleOnDay,
  };
  const lines: PriceLine[] = [];
  for (const rule of rules) {
    if (!matches(rule.condition, context, input.taskCodes)) continue;
    const amount = calculateAmount(rule, input, context);
    if (amount === null || amount === 0) continue;
    lines.push({ code: rule.code, label: rule.label, category: categoryFor(rule.code), amountTtcCents: amount });
  }
  return lines;
}

function matches(condition: Record<string, unknown>, context: Record<string, unknown>, taskCodes: string[]): boolean {
  return Object.entries(condition).every(([field, expected]) => {
    if (field === "task") return taskCodes.includes(String(expected));
    const actual = context[field];
    if (expected && typeof expected === "object" && "greaterThan" in expected) return Number(actual) > Number((expected as { greaterThan: unknown }).greaterThan);
    return actual === expected;
  });
}

function calculateAmount(rule: PricingRule, input: PricingInput, context: Record<string, unknown>): number | null {
  const calculation = rule.calculation;
  const operation = String(calculation.operation ?? "");
  const unitAmount = Number(calculation.amountTtcCents ?? 0);
  let amount: number;
  if (operation === "multiply" && calculation.unit === "HALF_DAY") amount = input.halfDays * unitAmount;
  else if (operation === "fixed") amount = unitAmount;
  else if (operation === "perUnitAfter") {
    const units = rule.code === "ADDITIONAL_TASK" ? input.taskCodes.length : input.hedgeLengthM;
    amount = Math.max(0, units - Number(calculation.includedUnits ?? 0)) * unitAmount;
  } else if (operation === "map") {
    const values = calculation.amountsTtcCents;
    if (!values || typeof values !== "object") return null;
    amount = Number((values as Record<string, unknown>)[String(context[String(calculation.field)] ?? "")] ?? 0);
  } else return null;
  const maximum = Number(calculation.maximumTtcCents);
  if (Number.isFinite(maximum)) amount = Math.min(amount, maximum);
  return Number.isFinite(amount) ? Math.round(amount) : null;
}

function categoryFor(code: string): PriceLine["category"] {
  if (code === "BASE_HALF_DAY") return "intervention";
  if (code === "ADDITIONAL_TASK") return "tasks";
  if (["GRASS_HIGH", "GRASS_VERY_HIGH", "HEDGE_LENGTH_OVER_5M", "HEDGE_FACES", "HEDGE_HEIGHT"].includes(code)) return "details";
  if (code === "GREEN_WASTE_1_TO_2M3") return "waste";
  if (code === "FLEXIBLE_DAY") return "discount";
  return "access";
}
