import { getSessionFromCookie } from "@/modules/auth/service";
import { hasPermission } from "@/modules/authorization/policy.mjs";

export async function requirePlanningReader(request: Request) {
  const user = await getSessionFromCookie(request.headers.get("cookie"));
  if (!user) return Response.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  if (user.sessionKind !== "STAFF" || !hasPermission(user.roles, "planning.read")) return Response.json({ error: "ACCESS_DENIED" }, { status: 403 });
  return user;
}
