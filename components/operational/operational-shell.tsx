"use client"

import type { ReactNode } from "react"
import { LogOut, ShieldCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function OperationalShell({
  title,
  subtitle,
  organizationName,
  roleLabel,
  children,
}: {
  title: string
  subtitle: string
  organizationName: string
  roleLabel: string
  children: ReactNode
}) {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  async function logout() {
    setLoggingOut(true)
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null)
    router.replace("/login")
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
                  {organizationName}
                </p>
                <h1 className="truncate text-lg font-black sm:text-xl">{title}</h1>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 sm:inline-flex">
              {roleLabel}
            </span>
            <button
              type="button"
              disabled={loggingOut}
              onClick={logout}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{loggingOut ? "Saindo..." : "Sair"}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-950">{subtitle}</p>
        </div>
        {children}
      </div>
    </main>
  )
}
