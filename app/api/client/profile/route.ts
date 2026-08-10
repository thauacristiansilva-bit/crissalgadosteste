import { NextResponse } from "next/server"
import { getCurrentCustomerAccount } from "@/lib/client-auth"
import { safeCustomer, updateCustomerAccount } from "@/lib/db"
export async function PATCH(request: Request) {
  const account = await getCurrentCustomerAccount(); if (!account) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const body = await request.json().catch(() => null) as Record<string, unknown> | null; if (!body) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })
  const updated = await updateCustomerAccount(account.id, {
    ...(body.name !== undefined ? { name: String(body.name) } : {}), ...(body.phone !== undefined ? { phone: String(body.phone) } : {}), ...(body.email !== undefined ? { email: String(body.email) } : {}),
    ...(body.defaultAddress !== undefined ? { defaultAddress: String(body.defaultAddress) } : {}), ...(body.defaultNumber !== undefined ? { defaultNumber: String(body.defaultNumber) } : {}), ...(body.defaultDistrict !== undefined ? { defaultDistrict: String(body.defaultDistrict) } : {}), ...(body.defaultCity !== undefined ? { defaultCity: String(body.defaultCity) } : {}), ...(body.defaultState !== undefined ? { defaultState: String(body.defaultState) } : {}), ...(body.defaultZipCode !== undefined ? { defaultZipCode: String(body.defaultZipCode) } : {}), ...(body.defaultComplement !== undefined ? { defaultComplement: String(body.defaultComplement) } : {}), ...(body.defaultLatitude !== undefined ? { defaultLatitude: Number(body.defaultLatitude) || null } : {}), ...(body.defaultLongitude !== undefined ? { defaultLongitude: Number(body.defaultLongitude) || null } : {}),
  })
  return NextResponse.json({ customer: updated ? safeCustomer(updated) : null })
}
