import { requireCustomerUser } from "@/modules/auth/server";
import { getCustomerWorkspace } from "@/modules/customer/service";
import { ClientDashboard } from "./client-dashboard";

export const dynamic = "force-dynamic";

export default async function ClientPage() {
  const user = await requireCustomerUser("/espace-client");
  const workspace = await getCustomerWorkspace(user.id);
  return <ClientDashboard initialProfile={workspace.profile} initialGardens={workspace.gardens} />;
}
