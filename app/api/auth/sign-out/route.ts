import { revokeSession } from "@/modules/auth/service";
import {
  clearSessionCookie,
  isSameOriginRequest,
  isSecureRequest,
} from "@/modules/auth/security.mjs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return new Response("Requête refusée.", { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  try {
    await revokeSession(request.headers.get("cookie"));
  } catch {
    // Le cookie est tout de même supprimé : une panne ne doit pas bloquer la déconnexion locale.
  }
  return new Response(null, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
      Location: "/",
      "Set-Cookie": clearSessionCookie(isSecureRequest(request)),
    },
  });
}
