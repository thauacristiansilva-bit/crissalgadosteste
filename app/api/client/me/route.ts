import { NextResponse } from "next/server"
import { getCurrentCustomerAccount } from "@/lib/client-auth"
import { safeCustomer } from "@/lib/db"
export async function GET() { const account = await getCurrentCustomerAccount(); return NextResponse.json({ customer: account ? safeCustomer(account) : null }) }
