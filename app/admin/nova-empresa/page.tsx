import { redirect } from "next/navigation"
import { getAdminSession } from "@/lib/auth"
import { getCommercialBillingSession } from "@/lib/billing-commercial-session"
import { getBillingSnapshotForUser } from "@/lib/billing-db"
import { OrganizationOnboardingForm } from "@/components/admin/organization-onboarding-form"

export const dynamic = "force-dynamic"

export default async function NewOrganizationPage() {
  const session = await getAdminSession()

  if (session?.mode === "tenant") {
    if (session.role !== "owner") redirect("/admin")
    return <OrganizationOnboardingForm />
  }

  const commercial = await getCommercialBillingSession()
  if (!commercial) redirect("/contratar")

  const billing = await getBillingSnapshotForUser(commercial.userId)
  if (
    billing.account?.id !== commercial.billingAccountId ||
    billing.subscription?.status !== "active" ||
    !billing.capacity.canCreateOrganization
  ) {
    redirect("/contratar/retorno")
  }

  return <OrganizationOnboardingForm />
}
