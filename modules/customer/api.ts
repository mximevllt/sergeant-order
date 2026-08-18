import { getSessionFromCookie, type AuthUser } from "@/modules/auth/service";
import { hasPermission } from "@/modules/authorization/policy.mjs";
import { CustomerConflictError, CustomerInputError, CustomerNotFoundError } from "./service";

export async function requireCustomerApi(request: Request, permission: "customer.profile.manage_self" | "customer.gardens.manage_self"): Promise<AuthUser | Response> {
  const user = await getSessionFromCookie(request.headers.get("cookie"));
  if (!user) return Response.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  if (user.sessionKind !== "CUSTOMER" || !hasPermission(user.roles, permission)) return Response.json({ error: "ACCESS_DENIED" }, { status: 403 });
  return user;
}

export async function readJson(request: Request): Promise<unknown> {
  if ((request.headers.get("content-type") ?? "").split(";", 1)[0]?.trim().toLowerCase() !== "application/json") throw new CustomerInputError("JSON_REQUIRED");
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 32_000) throw new CustomerInputError("PAYLOAD_TOO_LARGE");
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > 32_000) throw new CustomerInputError("PAYLOAD_TOO_LARGE");
  try { return JSON.parse(body) as unknown; }
  catch { throw new CustomerInputError("JSON_INVALID"); }
}

export function customerApiError(error: unknown): Response {
  if (error instanceof CustomerInputError) return Response.json({ error: error.code, fields: error.fields }, { status: 400 });
  if (error instanceof CustomerConflictError) return Response.json({ error: error.message }, { status: 409 });
  if (error instanceof CustomerNotFoundError) return Response.json({ error: error.message }, { status: 404 });
  return Response.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503, headers: { "Retry-After": "30" } });
}
