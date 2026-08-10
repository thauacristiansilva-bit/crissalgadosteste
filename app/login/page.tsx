import { redirect } from "next/navigation"
import { LoginForm } from "@/components/admin/login-form"
import { getAdminEmail, isAdminAuthenticated } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function LoginPage() {
  if (await isAdminAuthenticated()) redirect("/admin")

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-5">
      <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl" />

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-3xl border border-white bg-white shadow-2xl shadow-slate-200/70 lg:grid-cols-[.9fr_1.1fr]">
        <section className="hidden bg-gradient-to-br from-blue-800 to-blue-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-3xl ring-1 ring-white/15">🥟</div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-blue-200">Cris Salgados</p>
            <h1 className="mt-3 text-4xl font-black leading-tight">Seu negócio organizado em um só painel.</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-blue-100">Pedidos, cardápio, pagamentos e operação conectados ao servidor.</p>
          </div>
          <p className="text-xs text-blue-300">Painel administrativo · Bacabal - MA</p>
        </section>

        <section className="p-6 sm:p-10 lg:p-12">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-2xl lg:hidden">🥟</div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Área administrativa</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-gray-950">Bem-vindo de volta</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">Entre para gerenciar os pedidos e o cardápio da Cris Salgados.</p>
          <LoginForm defaultEmail={getAdminEmail()} />
          <div className="mt-6 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
            <strong>Primeiro acesso local:</strong> a senha padrão é <code className="rounded bg-white px-1.5 py-0.5 font-bold">cris1234</code>. Troque no arquivo <code className="rounded bg-white px-1.5 py-0.5 font-bold">.env.local</code> antes de publicar.
          </div>
        </section>
      </div>
    </main>
  )
}
