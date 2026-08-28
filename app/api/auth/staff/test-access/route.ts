import { isSecureRequest, isSameOriginRequest, sessionCookie } from "@/modules/auth/security.mjs";
import { startTestAdminSession, TestAdminBypassDeniedError } from "@/modules/auth/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "ORIGIN_FORBIDDEN" }, { status: 403 });
  try {
    const body = await request.json() as { email?: unknown };
    const result = await startTestAdminSession(request, body.email);
    return Response.json({ redirect: result.returnTo }, {
      headers: { "Cache-Control": "no-store", "Set-Cookie": sessionCookie(result.token, isSecureRequest(request), result.maxAgeSeconds) },
    });
  } catch (error) {
    if (error instanceof TestAdminBypassDeniedError) return Response.json({ error: "TEST_ACCESS_DENIED", message: "Cette adresse n’est pas autorisée pour le test." }, { status: 403 });
    return Response.json({ error: "TEST_ACCESS_UNAVAILABLE", message: "L’accès de test est momentanément indisponible." }, { status: 503 });
  }
}
