import { isSameOriginRequest } from "@/modules/auth/security.mjs";
import { readJson } from "@/modules/customer/api";
import { schedulingApiError } from "@/modules/scheduling/api";
import { searchAvailability } from "@/modules/scheduling/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "ORIGIN_DENIED" }, { status: 403 });
  try {
    const result = await searchAvailability(await readJson(request));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return schedulingApiError(error);
  }
}
