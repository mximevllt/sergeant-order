import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionFromCookie, type AuthUser } from "./service";
import { safePortalReturnTo } from "./security.mjs";
import { hasPermission, type Permission } from "@/modules/authorization/policy.mjs";

export async function getCurrentUser(): Promise<AuthUser | null> {
  const requestHeaders = await headers();
  return getSessionFromCookie(requestHeaders.get("cookie"));
}

export async function requireCurrentUser(returnTo = "/espace-client"): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (user) return user;
  redirect(`/connexion?returnTo=${encodeURIComponent(safePortalReturnTo(returnTo, "CUSTOMER"))}`);
}

export async function requireCustomerUser(returnTo = "/espace-client"): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/connexion?returnTo=${encodeURIComponent(safePortalReturnTo(returnTo, "CUSTOMER"))}`);
  }
  if (user.sessionKind !== "CUSTOMER" || !hasPermission(user.roles, "customer.portal.access")) {
    redirect("/acces-refuse?espace=client");
  }
  return user;
}

export async function requireStaffPermission(
  permission: Permission,
  returnTo = "/admin",
): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/connexion-entreprise?returnTo=${encodeURIComponent(safePortalReturnTo(returnTo, "STAFF"))}`);
  }
  if (user.sessionKind !== "STAFF" || !hasPermission(user.roles, permission)) {
    redirect("/acces-refuse?espace=entreprise");
  }
  return user;
}
