import { requireFieldUser, interventionApiError } from "@/modules/interventions/api";
import { listFieldMissions } from "@/modules/interventions/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireFieldUser(request);
    if (user instanceof Response) return user;
    return Response.json({ missions: await listFieldMissions(user) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return interventionApiError(error); }
}
