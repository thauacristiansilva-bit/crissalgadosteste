import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { createCustomerAccount, getCustomers, safeCustomer } from "@/lib/db"

interface CustomerInput { cpf?: string; pin?: string; name?: string; phone?: string; email?: string }

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const body = await request.json().catch(() => null) as (CustomerInput & { customers?: CustomerInput[] }) | null
  if (!body) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })

  const entries = Array.isArray(body.customers) ? body.customers : [body]
  if (!entries.length || entries.length > 300) return NextResponse.json({ error: "Envie entre 1 e 300 clientes por vez." }, { status: 400 })

  const created = []
  const errors: Array<{ row: number; error: string }> = []
  for (let index = 0; index < entries.length; index += 1) {
    const item = entries[index]
    try {
      const account = await createCustomerAccount({
        cpf: item.cpf || "",
        pin: item.pin || "",
        name: item.name || "",
        phone: item.phone || "",
        email: item.email || "",
      })
      created.push(safeCustomer(account))
    } catch (error) {
      errors.push({ row: index + 1, error: error instanceof Error ? error.message : "Não foi possível cadastrar." })
    }
  }

  return NextResponse.json({ created, errors, customers: await getCustomers() }, { status: created.length ? 201 : 400 })
}
