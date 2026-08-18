import { isSameOriginRequest } from "@/modules/auth/security.mjs";
import { readJson } from "@/modules/customer/api";
import { estimatePrice, PricingInputError } from "@/modules/pricing/service";
import { CustomerInputError } from "@/modules/customer/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "ORIGIN_DENIED" }, { status: 403 });
  try {
    return Response.json(await estimatePrice(await readJson(request)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PricingInputError) return Response.json({ error: error.message, fields: error.fields }, { status: 400 });
    if (error instanceof CustomerInputError) return Response.json({ error: error.code, fields: error.fields }, { status: 400 });
    return Response.json({ error: "PRICING_UNAVAILABLE" }, { status: 503, headers: { "Retry-After": "30" } });
  }
}
