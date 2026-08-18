import {
  AuthConfigurationError,
  DisabledAccountError,
  InvalidMagicLinkError,
  verifyMagicLink,
} from "@/modules/auth/service";
import { isSecureRequest, sessionCookie } from "@/modules/auth/security.mjs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  try {
    const result = await verifyMagicLink(request, token);
    return new Response(null, {
      status: 303,
      headers: {
        "Cache-Control": "no-store",
        Location: result.returnTo,
        "Set-Cookie": sessionCookie(result.token, isSecureRequest(request)),
      },
    });
  } catch (error) {
    const reason = error instanceof DisabledAccountError
      ? "compte-bloque"
      : error instanceof AuthConfigurationError
        ? "service-indisponible"
        : error instanceof InvalidMagicLinkError
          ? "lien-invalide"
          : "lien-invalide";
    return new Response(null, {
      status: 303,
      headers: { "Cache-Control": "no-store", Location: `/connexion?erreur=${reason}` },
    });
  }
}
