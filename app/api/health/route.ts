import { inspectEnvironment } from "@/config/environment.mjs";

export const dynamic = "force-dynamic";

function isLocalRequest(request: Request) {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export async function GET(request: Request) {
  const local = isLocalRequest(request);
  const environment = process.env.APP_ENV || "development";
  const report = inspectEnvironment(process.env, {
    allowDevelopmentDefaults: local,
    requireIntegrations: local ? [] : environment === "staging" ? ["database", "authentication"] : "all",
  });

  return Response.json(
    {
      status: report.valid ? "ok" : "misconfigured",
      environment: report.environment,
      configuration: report.valid ? "ok" : "error",
    },
    {
      status: report.valid ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
