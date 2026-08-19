import { requireCustomerUser } from "@/modules/auth/server";
import { getCustomerWorkspace } from "@/modules/customer/service";
import { headers } from "next/headers";
import { readQuoteDraftId } from "@/modules/quotes/security";
import { getCurrentQuote, listCustomerQuotes } from "@/modules/quotes/service";
import { ClientDashboard } from "./client-dashboard";

export const dynamic = "force-dynamic";

export default async function ClientPage() {
  const user = await requireCustomerUser("/espace-client");
  const proof = await readQuoteDraftId((await headers()).get("cookie"));
  if (proof) await getCurrentQuote(user, proof).catch(() => null);
  const [workspace, quotes] = await Promise.all([getCustomerWorkspace(user.id), listCustomerQuotes(user.id)]);
  return <ClientDashboard initialProfile={workspace.profile} initialGardens={workspace.gardens} initialQuotes={quotes} />;
}
