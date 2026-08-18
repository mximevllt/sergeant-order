import { isSameOriginRequest } from "@/modules/auth/security.mjs";
import { customerApiError, readJson, requireCustomerApi } from "@/modules/customer/api";
import { getCustomerWorkspace, updateCustomerProfile } from "@/modules/customer/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireCustomerApi(request, "customer.profile.manage_self");
    if (user instanceof Response) return user;
    return Response.json({ profile: (await getCustomerWorkspace(user.id)).profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return customerApiError(error); }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "ORIGIN_DENIED" }, { status: 403 });
  try {
    const user = await requireCustomerApi(request, "customer.profile.manage_self");
    if (user instanceof Response) return user;
    const profile = await updateCustomerProfile(user.id, await readJson(request));
    return Response.json({ profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return customerApiError(error); }
}
