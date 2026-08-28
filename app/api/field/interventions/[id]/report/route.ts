import { isSameOriginRequest } from "@/modules/auth/security.mjs";
import { readJson } from "@/modules/customer/api";
import { interventionApiError, requireFieldReporter } from "@/modules/interventions/api";
import { saveFieldReport } from "@/modules/interventions/service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "ORIGIN_DENIED" }, { status: 403 });
  try {
    const user = await requireFieldReporter(request);
    if (user instanceof Response) return user;
    return Response.json({ mission: await saveFieldReport((await context.params).id, await readJson(request), user) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return interventionApiError(error); }
}
