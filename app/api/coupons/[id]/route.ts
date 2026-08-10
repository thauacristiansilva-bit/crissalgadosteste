import { NextResponse } from "next/server"
import { updateCoupon } from "@/lib/db"
import { isAdminAuthenticated } from "@/lib/auth"
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 }); const { id } = await context.params; const body = await request.json().catch(() => null) as any; const coupon = await updateCoupon(Number(id), body || {}); return coupon ? NextResponse.json({ coupon }) : NextResponse.json({ error: "Cupom não encontrado." }, { status: 404 }) }
