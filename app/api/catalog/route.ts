import { getPublicCatalog } from "@/modules/catalog/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getPublicCatalog(), { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  } catch {
    return Response.json({ error: "CATALOG_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" } });
  }
}
