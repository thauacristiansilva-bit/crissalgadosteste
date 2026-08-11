import { redirect } from "next/navigation"
import {
  getAdminSession,
} from "@/lib/auth"
import {
  OrganizationOnboardingForm,
} from "@/components/admin/organization-onboarding-form"

export const dynamic = "force-dynamic"

export default async function NewOrganizationPage() {
  const session =
    await getAdminSession()

  if (!session) {
    redirect("/login")
  }

  if (session.mode !== "tenant") {
    redirect("/admin")
  }

  if (
    session.role !== "owner" &&
    session.role !== "admin"
  ) {
    redirect("/admin")
  }

  return (
    <OrganizationOnboardingForm />
  )
}
