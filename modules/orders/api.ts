import { getSessionFromCookie, type AuthUser } from "@/modules/auth/service";
import { hasPermission } from "@/modules/authorization/policy.mjs";
import { CustomerInputError } from "@/modules/customer/service";
import { PaymentConfigurationError } from "@/modules/payments/stripe-adapter";
import { QuoteAccessError, QuoteNotFoundError } from "@/modules/quotes/service";
import { OrderConflictError, OrderInputError, OrderNotFoundError } from "./service";

export async function requireOrderCustomer(request: Request): Promise<AuthUser | Response> {
  const user = await getSessionFromCookie(request.headers.get("cookie"));
  if (!user) return Response.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  if (user.sessionKind !== "CUSTOMER" || !hasPermission(user.roles, "customer.portal.access")) return Response.json({ error: "ACCESS_DENIED" }, { status: 403 });
  return user;
}

export function orderApiError(error: unknown): Response {
  if (error instanceof OrderInputError) return Response.json({ error: error.message, fields: error.fields }, { status: 400 });
  if (error instanceof CustomerInputError) return Response.json({ error: error.code, fields: error.fields }, { status: 400 });
  if (error instanceof OrderConflictError) return Response.json({ error: error.message }, { status: 409 });
  if (error instanceof OrderNotFoundError || error instanceof QuoteNotFoundError || error instanceof QuoteAccessError) return Response.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
  if (error instanceof PaymentConfigurationError) return Response.json({ error: error.message }, { status: 503, headers: { "Retry-After": "60" } });
  return Response.json({ error: "ORDER_SERVICE_UNAVAILABLE" }, { status: 503, headers: { "Retry-After": "30" } });
}
