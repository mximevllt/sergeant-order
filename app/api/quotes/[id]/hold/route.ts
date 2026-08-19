import { isSameOriginRequest } from "@/modules/auth/security.mjs";
import { readJson } from "@/modules/customer/api";
import { quoteActor } from "@/modules/quotes/api";
import { readQuoteDraftId } from "@/modules/quotes/security";
import { schedulingApiError } from "@/modules/scheduling/api";
import { createScheduleHold, getActiveHold, releaseScheduleHold } from "@/modules/scheduling/service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function access(request: Request) {
  const actor = await quoteActor(request);
  if (actor instanceof Response) return actor;
  return { actor, provenDraftId: await readQuoteDraftId(request.headers.get("cookie")) };
}

export async function GET(request: Request, context: Context) {
  try {
    const identity = await access(request);
    if (identity instanceof Response) return identity;
    const hold = await getActiveHold((await context.params).id, identity.actor, identity.provenDraftId);
    return Response.json({ hold }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return schedulingApiError(error);
  }
}

export async function POST(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "ORIGIN_DENIED" }, { status: 403 });
  try {
    const identity = await access(request);
    if (identity instanceof Response) return identity;
    const body = await readJson(request) as Record<string, unknown>;
    const hold = await createScheduleHold((await context.params).id, body.startsAt, identity.actor, identity.provenDraftId, request.headers.get("idempotency-key") ?? "");
    return Response.json({ hold }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return schedulingApiError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "ORIGIN_DENIED" }, { status: 403 });
  try {
    const identity = await access(request);
    if (identity instanceof Response) return identity;
    await releaseScheduleHold((await context.params).id, identity.actor, identity.provenDraftId);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return schedulingApiError(error);
  }
}
