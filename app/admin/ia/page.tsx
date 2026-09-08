import { redirect } from "next/navigation"

import {
  AiChatPanel,
} from "@/components/admin/ai-chat-panel"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"

export const dynamic = "force-dynamic"

export default async function AdminAiPage() {
  const session =
    await getVerifiedTenantSession()

  if (!session) {
    redirect("/login")
  }

  return <AiChatPanel />
}
