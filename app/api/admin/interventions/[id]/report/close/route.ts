import { isSameOriginRequest } from "@/modules/auth/security.mjs";
import { interventionApiError, requireReportReviewer } from "@/modules/interventions/api";
import { closeInterventionReport } from "@/modules/interventions/service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "ORIGIN_DENIED" }, { status: 403 });
  try {
    const user = await requireReportReviewer(request);
    if (user instanceof Response) return user;
    return Response.json({ mission: await closeInterventionReport((await context.params).id, user) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return interventionApiError(error); }
}
