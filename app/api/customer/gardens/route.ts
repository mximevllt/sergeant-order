import { isSameOriginRequest } from "@/modules/auth/security.mjs";
import { customerApiError, readJson, requireCustomerApi } from "@/modules/customer/api";
import { createGarden, getCustomerWorkspace } from "@/modules/customer/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireCustomerApi(request, "customer.gardens.manage_self");
    if (user instanceof Response) return user;
    return Response.json({ gardens: (await getCustomerWorkspace(user.id)).gardens }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return customerApiError(error); }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "ORIGIN_DENIED" }, { status: 403 });
  try {
    const user = await requireCustomerApi(request, "customer.gardens.manage_self");
    if (user instanceof Response) return user;
    const garden = await createGarden(user.id, await readJson(request));
    return Response.json({ garden }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return customerApiError(error); }
}
