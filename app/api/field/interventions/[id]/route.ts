import { isSameOriginRequest } from "@/modules/auth/security.mjs";
import { readJson } from "@/modules/customer/api";
import { requireFieldUser, interventionApiError } from "@/modules/interventions/api";
import { updateFieldMission } from "@/modules/interventions/service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "ORIGIN_DENIED" }, { status: 403 });
  try {
    const user = await requireFieldUser(request);
    if (user instanceof Response) return user;
    return Response.json({ mission: await updateFieldMission((await context.params).id, await readJson(request), user) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return interventionApiError(error); }
}
