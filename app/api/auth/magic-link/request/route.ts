import {
  AuthConfigurationError,
  AuthDeliveryError,
  requestMagicLink,
} from "@/modules/auth/service";
import { isSameOriginRequest } from "@/modules/auth/security.mjs";

export const dynamic = "force-dynamic";

const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "ORIGIN_FORBIDDEN" }, { status: 403, headers: JSON_HEADERS });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8192) {
    return Response.json({ error: "REQUEST_TOO_LARGE" }, { status: 413, headers: JSON_HEADERS });
  }

  let body: { email?: unknown; fullName?: unknown; returnTo?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_JSON" }, { status: 400, headers: JSON_HEADERS });
  }

  try {
    const result = await requestMagicLink(request, body);
    return Response.json(
      {
        accepted: true,
        message: "Si cette adresse peut être utilisée, un lien de connexion vient d’être envoyé.",
        ...(result.previewUrl ? { previewUrl: result.previewUrl } : {}),
      },
      { status: 202, headers: JSON_HEADERS },
    );
  } catch (error) {
    if (error instanceof TypeError) {
      return Response.json({ error: "INVALID_INPUT" }, { status: 400, headers: JSON_HEADERS });
    }
    if (error instanceof AuthDeliveryError) {
      return Response.json(
        { error: "EMAIL_UNAVAILABLE", message: "L’envoi du lien est temporairement indisponible." },
        { status: 503, headers: { ...JSON_HEADERS, "Retry-After": "60" } },
      );
    }
    if (error instanceof AuthConfigurationError) {
      return Response.json(
        { error: "AUTH_UNAVAILABLE", message: "La connexion est temporairement indisponible." },
        { status: 503, headers: { ...JSON_HEADERS, "Retry-After": "60" } },
      );
    }
    return Response.json(
      { error: "AUTH_UNAVAILABLE", message: "La connexion est temporairement indisponible." },
      { status: 503, headers: { ...JSON_HEADERS, "Retry-After": "60" } },
    );
  }
}
