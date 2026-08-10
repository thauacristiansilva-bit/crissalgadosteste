import { NextResponse } from "next/server"
import { CLIENT_SESSION_COOKIE } from "@/lib/client-auth"
export async function POST() { const response = NextResponse.json({ ok: true }); response.cookies.set(CLIENT_SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 }); return response }
