import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { getCustomerAccounts, safeCustomer } from "@/lib/db"
import {
  getTenantCustomerAccounts,
  isTenantCustomersReady,
  safeTenantCustomer,
} from "@/lib/customer-db"
import { getVerifiedTenantSession } from "@/lib/tenant-access"
import { canUsePdv } from "@/lib/admin-access"

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  try {
    const session = await getVerifiedTenantSession()

    if (session) {
      if (!canUsePdv(session.role)) {
        return NextResponse.json({ error: "Seu perfil não pode usar o PDV." }, { status: 403 })
      }

      const ready = await isTenantCustomersReady(session.organizationId).catch(() => false)
      if (!ready) return NextResponse.json({ customers: [] })

      const accounts = await getTenantCustomerAccounts(session.organizationId)
      return NextResponse.json({ customers: accounts.map(safeTenantCustomer) })
    }

    const accounts = await getCustomerAccounts()
    return NextResponse.json({ customers: accounts.map(safeCustomer) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível carregar os clientes do PDV." },
      { status: 400 },
    )
  }
}
