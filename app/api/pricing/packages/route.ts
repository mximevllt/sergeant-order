import { getBookingRates } from "@/modules/pricing/booking-rates";

export const dynamic = "force-dynamic";

export async function GET() {
  const rates = await getBookingRates();
  return Response.json({ packages: Object.values(rates).sort((left, right) => left.sortOrder - right.sortOrder) }, { headers: { "Cache-Control": "no-store" } });
}
