import { isSameOriginRequest } from "@/modules/auth/security.mjs";
import { readJson } from "@/modules/customer/api";
import { orderApiError, requireOrderCustomer } from "@/modules/orders/api";
import { startCardSetup } from "@/modules/orders/service";
import { readQuoteDraftId } from "@/modules/quotes/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "ORIGIN_DENIED" }, { status: 403 });
  try {
    const user = await requireOrderCustomer(request);
    if (user instanceof Response) return user;
    const body = await readJson(request) as { quoteId?: unknown; consent?: unknown };
    const setup = await startCardSetup(body, user, await readQuoteDraftId(request.headers.get("cookie")), request.headers.get("idempotency-key") ?? "");
    return Response.json({ setup }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return orderApiError(error); }
}
