import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { updateCategory } from "@/lib/db"

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const { id } = await context.params
  const numericId = Number(id)
  const body = (await request.json().catch(() => null)) as { name?: string; active?: boolean; sortOrder?: number } | null
  if (!Number.isInteger(numericId) || !body) return NextResponse.json({ error: "Requisição inválida." }, { status: 400 })
  try {
    const category = await updateCategory(numericId, body)
    if (!category) return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 })
    return NextResponse.json({ category })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível atualizar a categoria." }, { status: 400 })
  }
}
