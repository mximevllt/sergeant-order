import { getSessionFromCookie } from "@/modules/auth/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getSessionFromCookie(request.headers.get("cookie"));
    return Response.json(
      user
        ? { authenticated: true, user: { id: user.id, email: user.email, fullName: user.fullName, roles: user.roles, sessionKind: user.sessionKind } }
        : { authenticated: false, user: null },
      { status: user ? 200 : 401, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { authenticated: false, user: null },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
    );
  }
}
