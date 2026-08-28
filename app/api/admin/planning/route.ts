import { getPlanningBoard } from "@/modules/scheduling/backoffice-service";
import { requirePlanningReader } from "@/modules/scheduling/backoffice-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requirePlanningReader(request);
  if (user instanceof Response) return user;
  const url = new URL(request.url);
  const board = await getPlanningBoard(url.searchParams.get("from"));
  return Response.json({ board }, { headers: { "Cache-Control": "no-store" } });
}
