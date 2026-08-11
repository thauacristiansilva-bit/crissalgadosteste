import { NextResponse } from "next/server"
import {
  getCurrentCustomerContext,
} from "@/lib/client-auth"
import {
  isTenantCustomersReady,
  safeTenantCustomer,
  updateTenantCustomerAccount,
} from "@/lib/customer-db"
import {
  isCurrentDeploymentOrganization,
} from "@/lib/catalog-db"
import {
  safeCustomer,
  syncLegacyCustomerAccountFromTenant,
  updateCustomerAccount as updateLegacyCustomerAccount,
} from "@/lib/db"

export async function PATCH(request: Request) {
  const context = await getCurrentCustomerContext()

  if (!context) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    )
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null

  if (!body) {
    return NextResponse.json(
      { error: "Dados inválidos." },
      { status: 400 },
    )
  }

  const patch = {
    ...(body.name !== undefined
      ? { name: String(body.name) }
      : {}),
    ...(body.phone !== undefined
      ? { phone: String(body.phone) }
      : {}),
    ...(body.email !== undefined
      ? { email: String(body.email) }
      : {}),
    ...(body.defaultAddress !== undefined
      ? { defaultAddress: String(body.defaultAddress) }
      : {}),
    ...(body.defaultNumber !== undefined
      ? { defaultNumber: String(body.defaultNumber) }
      : {}),
    ...(body.defaultDistrict !== undefined
      ? { defaultDistrict: String(body.defaultDistrict) }
      : {}),
    ...(body.defaultCity !== undefined
      ? { defaultCity: String(body.defaultCity) }
      : {}),
    ...(body.defaultState !== undefined
      ? { defaultState: String(body.defaultState) }
      : {}),
    ...(body.defaultZipCode !== undefined
      ? { defaultZipCode: String(body.defaultZipCode) }
      : {}),
    ...(body.defaultComplement !== undefined
      ? { defaultComplement: String(body.defaultComplement) }
      : {}),
    ...(body.defaultLatitude !== undefined
      ? {
          defaultLatitude:
            Number(body.defaultLatitude) || null,
        }
      : {}),
    ...(body.defaultLongitude !== undefined
      ? {
          defaultLongitude:
            Number(body.defaultLongitude) || null,
        }
      : {}),
  }

  const customersReady =
    await isTenantCustomersReady(
      context.organizationId,
    ).catch(() => false)

  const updated = customersReady
    ? await updateTenantCustomerAccount(
        context.organizationId,
        context.account.id,
        patch,
      )
    : await updateLegacyCustomerAccount(
        context.account.id,
        patch,
      )

  if (
    updated &&
    customersReady &&
    (await isCurrentDeploymentOrganization(
      context.organizationId,
    ))
  ) {
    await syncLegacyCustomerAccountFromTenant(updated)
  }

  return NextResponse.json({
    customer: updated
      ? customersReady
        ? safeTenantCustomer(updated)
        : safeCustomer(updated)
      : null,
  })
}
