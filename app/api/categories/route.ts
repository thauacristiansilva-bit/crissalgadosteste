import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { createCategory, getCategories } from "@/lib/db"

export async function GET() {
  const categories = await getCategories()
  return NextResponse.json({ categories })
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { name?: string } | null
  try {
    const category = await createCategory(body?.name || "")
    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível criar a categoria." }, { status: 400 })
  }
}
