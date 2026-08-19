import { isSameOriginRequest, isSecureRequest } from "@/modules/auth/security.mjs";
import { readJson } from "@/modules/customer/api";
import { quoteActor, quoteApiError } from "@/modules/quotes/api";
import { quoteDraftCookie } from "@/modules/quotes/security";
import { createQuote } from "@/modules/quotes/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "ORIGIN_DENIED" }, { status: 403 });
  try {
    const actor = await quoteActor(request);
    if (actor instanceof Response) return actor;
    const quote = await createQuote(await readJson(request), actor, request.headers.get("idempotency-key") ?? "");
    return Response.json({ quote }, {
      status: 201,
      headers: { "Cache-Control": "no-store", "Set-Cookie": await quoteDraftCookie(quote.id, isSecureRequest(request)) },
    });
  } catch (error) { return quoteApiError(error); }
}
