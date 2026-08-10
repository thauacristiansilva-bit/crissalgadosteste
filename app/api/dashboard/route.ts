import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/auth"
import { getAdminData } from "@/lib/db"
export const dynamic = "force-dynamic"
export async function GET() { if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 }); return NextResponse.json(await getAdminData()) }
