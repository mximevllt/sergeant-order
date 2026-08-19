import { getSessionFromCookie, type AuthUser } from "@/modules/auth/service";
import { CustomerInputError } from "@/modules/customer/service";
import { PricingInputError } from "@/modules/pricing/service";
import {
  QuoteAccessError,
  QuoteConflictError,
  QuoteExpiredError,
  QuoteInputError,
  QuoteNotFoundError,
} from "./service";

export async function quoteActor(request: Request): Promise<AuthUser | null | Response> {
  const user = await getSessionFromCookie(request.headers.get("cookie"));
  if (user?.sessionKind === "STAFF") return Response.json({ error: "CUSTOMER_ACCESS_REQUIRED" }, { status: 403 });
  return user;
}

export function quoteApiError(error: unknown): Response {
  if (error instanceof QuoteInputError || error instanceof PricingInputError) {
    return Response.json({ error: error.message, fields: error.fields }, { status: 400 });
  }
  if (error instanceof CustomerInputError) return Response.json({ error: error.code, fields: error.fields }, { status: 400 });
  if (error instanceof QuoteExpiredError) return Response.json({ error: "QUOTE_EXPIRED" }, { status: 410 });
  if (error instanceof QuoteConflictError) return Response.json({ error: error.message }, { status: 409 });
  if (error instanceof QuoteNotFoundError || error instanceof QuoteAccessError) return Response.json({ error: "QUOTE_NOT_FOUND" }, { status: 404 });
  return Response.json({ error: "QUOTE_SERVICE_UNAVAILABLE" }, { status: 503, headers: { "Retry-After": "30" } });
}
