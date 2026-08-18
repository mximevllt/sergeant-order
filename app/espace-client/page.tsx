import { requireCurrentUser } from "@/modules/auth/server";
import { ClientDashboard } from "./client-dashboard";

export const dynamic = "force-dynamic";

export default async function ClientPage() {
  const user = await requireCurrentUser("/espace-client");
  return <ClientDashboard fullName={user.fullName} email={user.email} phone={user.phone} />;
}
