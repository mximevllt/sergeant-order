import { requireCustomerUser } from "@/modules/auth/server";
import { ClientDashboard } from "./client-dashboard";

export const dynamic = "force-dynamic";

export default async function ClientPage() {
  const user = await requireCustomerUser("/espace-client");
  return <ClientDashboard fullName={user.fullName} email={user.email} phone={user.phone} />;
}
