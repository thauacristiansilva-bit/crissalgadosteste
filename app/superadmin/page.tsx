import { redirect } from "next/navigation"
import { SuperadminDashboard } from "@/components/superadmin/superadmin-dashboard"
import { getAdminSession } from "@/lib/auth"
import { getSuperadminAccess } from "@/lib/superadmin-auth"
import { getSuperadminSnapshot } from "@/lib/superadmin-db"

export const dynamic = "force-dynamic"

export default async function SuperadminPage() {
  const session = await getAdminSession()
  if (!session) redirect("/login?next=/superadmin")

  const access = await getSuperadminAccess()
  if (!access) {
    return (
      <main className="min-h-screen bg-stone-950 px-5 py-16 text-white">
        <div className="mx-auto max-w-2xl rounded-[28px] border border-white/10 bg-white/5 p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">SaborFlow Control Plane</p>
          <h1 className="mt-3 text-3xl font-black">Acesso restrito</h1>
          <p className="mt-4 text-sm leading-6 text-stone-300">Sua conta está autenticada no painel de uma organização, mas não possui permissão de plataforma. O acesso ao Superadmin só pode ser concedido no servidor por um operador autorizado.</p>
        </div>
      </main>
    )
  }

  return <SuperadminDashboard access={{ email: access.email, role: access.role }} initialData={await getSuperadminSnapshot()} />
}
