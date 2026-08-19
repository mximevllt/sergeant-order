import { isSameOriginRequest } from "@/modules/auth/security.mjs";
import { readJson } from "@/modules/customer/api";
import { CustomerInputError } from "@/modules/customer/service";
import { checkServiceArea } from "@/modules/service-area/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "ORIGIN_DENIED" }, { status: 403 });
  try {
    const result = await checkServiceArea(await readJson(request));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof CustomerInputError) return Response.json({ error: error.code, fields: error.fields }, { status: 400 });
    return Response.json({ error: "SERVICE_AREA_UNAVAILABLE" }, { status: 503, headers: { "Retry-After": "30" } });
  }
}
