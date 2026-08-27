import { getCustomerOrder } from "@/modules/orders/service";
import { orderApiError, requireOrderCustomer } from "@/modules/orders/api";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const user = await requireOrderCustomer(request);
    if (user instanceof Response) return user;
    return Response.json({ order: await getCustomerOrder((await context.params).id, user.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return orderApiError(error); }
}
