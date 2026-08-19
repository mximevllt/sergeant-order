import { quoteActor, quoteApiError } from "@/modules/quotes/api";
import { readQuoteDraftId } from "@/modules/quotes/security";
import { getCurrentQuote } from "@/modules/quotes/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await quoteActor(request);
    if (actor instanceof Response) return actor;
    const quote = await getCurrentQuote(actor, await readQuoteDraftId(request.headers.get("cookie")));
    if (!quote) return Response.json({ error: "QUOTE_NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } });
    return Response.json({ quote }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return quoteApiError(error); }
}
