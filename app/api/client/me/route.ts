import { NextResponse } from "next/server"
import {
  getCurrentCustomerContext,
} from "@/lib/client-auth"
import { safeTenantCustomer } from "@/lib/customer-db"

export async function GET() {
  const context = await getCurrentCustomerContext()

  return NextResponse.json({
    customer: context
      ? safeTenantCustomer(context.account)
      : null,
    sessionMode: context?.sessionMode ?? null,
  })
}
