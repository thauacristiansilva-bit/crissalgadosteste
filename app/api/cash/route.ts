import { NextResponse } from "next/server"
import { isAdminAuthenticated, getAdminEmail } from "@/lib/auth"
import { closeCashSession, getCashSessions, openCashSession } from "@/lib/db"
export async function GET() { if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 }); return NextResponse.json({ sessions: await getCashSessions() }) }
export async function POST(request: Request) { if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 }); const body = await request.json().catch(() => null) as any; try { const session = body?.action === "close" ? await closeCashSession(Number(body.id), Number(body.amount || 0), String(body.notes || "")) : await openCashSession(getAdminEmail(), Number(body?.amount || 0)); return NextResponse.json({ session }) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Erro no caixa." }, { status: 400 }) } }
