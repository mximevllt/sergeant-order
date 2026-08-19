import { isSameOriginRequest, isSecureRequest } from "@/modules/auth/security.mjs";
import { readJson } from "@/modules/customer/api";
import { quoteActor, quoteApiError } from "@/modules/quotes/api";
import { quoteDraftCookie, readQuoteDraftId } from "@/modules/quotes/security";
import { cancelQuote, getQuote, updateQuote } from "@/modules/quotes/service";

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
    const quote = await getQuote((await context.params).id, identity.actor, identity.provenDraftId);
    return Response.json({ quote }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return quoteApiError(error); }
}

export async function PATCH(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "ORIGIN_DENIED" }, { status: 403 });
  try {
    const identity = await access(request);
    if (identity instanceof Response) return identity;
    const quote = await updateQuote((await context.params).id, await readJson(request), identity.actor, identity.provenDraftId);
    return Response.json({ quote }, { headers: { "Cache-Control": "no-store", "Set-Cookie": await quoteDraftCookie(quote.id, isSecureRequest(request)) } });
  } catch (error) { return quoteApiError(error); }
}

export async function DELETE(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "ORIGIN_DENIED" }, { status: 403 });
  try {
    const identity = await access(request);
    if (identity instanceof Response) return identity;
    await cancelQuote((await context.params).id, identity.actor, identity.provenDraftId);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return quoteApiError(error); }
}
