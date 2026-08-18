import {
  AuthConfigurationError,
  DisabledAccountError,
  InvalidMagicLinkError,
  verifyMagicLink,
} from "@/modules/auth/service";
import { isSecureRequest, sessionCookie } from "@/modules/auth/security.mjs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const companyPortal = url.searchParams.get("portail") === "entreprise";
  try {
    const result = await verifyMagicLink(request, token);
    return new Response(null, {
      status: 303,
      headers: {
        "Cache-Control": "no-store",
        Location: result.returnTo,
      "Set-Cookie": sessionCookie(result.token, isSecureRequest(request), result.maxAgeSeconds),
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
    const loginPath = companyPortal ? "/connexion-entreprise" : "/connexion";
    return new Response(null, {
      status: 303,
      headers: { "Cache-Control": "no-store", Location: `${loginPath}?erreur=${reason}` },
    });
  }
}
