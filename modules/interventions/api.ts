import { getSessionFromCookie } from "@/modules/auth/service";
import { hasPermission } from "@/modules/authorization/policy.mjs";
import { InterventionConflictError, InterventionInputError, InterventionNotFoundError } from "./service";

export async function requireFieldUser(request: Request) {
  const user = await getSessionFromCookie(request.headers.get("cookie"));
  if (!user) return Response.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  if (user.sessionKind !== "STAFF" || !hasPermission(user.roles, "field.missions.read_assigned")) return Response.json({ error: "ACCESS_DENIED" }, { status: 403 });
  return user;
}

export async function requireFieldReporter(request: Request) {
  const user = await getSessionFromCookie(request.headers.get("cookie"));
  if (!user) return Response.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  if (user.sessionKind !== "STAFF" || !hasPermission(user.roles, "field.reports.write_assigned")) return Response.json({ error: "ACCESS_DENIED" }, { status: 403 });
  return user;
}

export async function requireReportReviewer(request: Request) {
  const user = await getSessionFromCookie(request.headers.get("cookie"));
  if (!user) return Response.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  if (user.sessionKind !== "STAFF" || !hasPermission(user.roles, "orders.write")) return Response.json({ error: "ACCESS_DENIED" }, { status: 403 });
  return user;
}

export function interventionApiError(error: unknown): Response {
  if (error instanceof InterventionInputError) return Response.json({ error: error.message, fields: error.fields }, { status: 400 });
  if (error instanceof InterventionConflictError) return Response.json({ error: error.code }, { status: 409 });
  if (error instanceof InterventionNotFoundError) return Response.json({ error: "INTERVENTION_NOT_FOUND" }, { status: 404 });
  return Response.json({ error: "INTERVENTION_SERVICE_UNAVAILABLE" }, { status: 503, headers: { "Retry-After": "30" } });
}
