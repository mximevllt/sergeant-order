import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionFromCookie, type AuthUser } from "./service";
import { safeReturnTo } from "./security.mjs";

export async function getCurrentUser(): Promise<AuthUser | null> {
  const requestHeaders = await headers();
  return getSessionFromCookie(requestHeaders.get("cookie"));
}

export async function requireCurrentUser(returnTo = "/espace-client"): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (user) return user;
  redirect(`/connexion?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`);
}
