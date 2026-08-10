import { NextResponse } from "next/server"
import { createFeedback, getFeedbacks } from "@/lib/db"
import { isAdminAuthenticated } from "@/lib/auth"
export async function GET() { if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 }); return NextResponse.json({ feedbacks: await getFeedbacks() }) }
export async function POST(request: Request) { const body = await request.json().catch(() => null) as { orderReference?: string; rating?: number; comment?: string } | null; if (!body?.orderReference || !body.rating) return NextResponse.json({ error: "Avaliação incompleta." }, { status: 400 }); try { return NextResponse.json({ feedback: await createFeedback({ orderReference: body.orderReference, rating: body.rating, comment: body.comment }) }, { status: 201 }) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao avaliar." }, { status: 400 }) } }
