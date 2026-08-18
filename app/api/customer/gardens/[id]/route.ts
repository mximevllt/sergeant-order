import { isSameOriginRequest } from "@/modules/auth/security.mjs";
import { customerApiError, readJson, requireCustomerApi } from "@/modules/customer/api";
import { archiveGarden, updateGarden } from "@/modules/customer/service";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "ORIGIN_DENIED" }, { status: 403 });
  try {
    const user = await requireCustomerApi(request, "customer.gardens.manage_self");
    if (user instanceof Response) return user;
    const { id } = await context.params;
    return Response.json({ garden: await updateGarden(user.id, id, await readJson(request)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return customerApiError(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "ORIGIN_DENIED" }, { status: 403 });
  try {
    const user = await requireCustomerApi(request, "customer.gardens.manage_self");
    if (user instanceof Response) return user;
    const { id } = await context.params;
    await archiveGarden(user.id, id);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return customerApiError(error); }
}
