import { redirect } from "next/navigation"
import { LoginForm } from "@/components/admin/login-form"
import { isAdminAuthenticated } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function LoginPage() {
  if (await isAdminAuthenticated()) redirect("/admin")

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-5" style={{ background: "linear-gradient(145deg, #fff9f1 0%, #fff1dc 52%, #f7e3cc 100%)" }}>
      <div className="absolute -left-20 -top-24 h-80 w-80 rounded-full blur-3xl" style={{ backgroundColor: "rgba(245,158,11,.22)" }} />
      <div className="absolute -bottom-28 -right-24 h-96 w-96 rounded-full blur-3xl" style={{ backgroundColor: "rgba(60,36,21,.13)" }} />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[32px] border bg-white shadow-2xl lg:grid-cols-[1fr_1fr]" style={{ borderColor: "#f0d0aa", boxShadow: "0 30px 80px rgba(60,36,21,.16)" }}>
        <section className="hidden min-h-[650px] p-10 text-white lg:flex lg:flex-col lg:justify-between" style={{ background: "linear-gradient(155deg, #2f1c13 0%, #4b2c1d 46%, #d96d00 100%)" }}>
          <div>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-white p-1 shadow-xl">
                <img src="/saborflow-brand.png" alt="SaborFlow" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.28em]" style={{ color: "#ffd39f" }}>Plataforma SaborFlow</p>
                <h1 className="mt-1 text-3xl font-black">SaborFlow</h1>
                <p className="text-sm" style={{ color: "#ffe5c5" }}>Gestão completa em um único fluxo</p>
              </div>
            </div>

            <p className="mt-12 text-xs font-black uppercase tracking-[0.28em]" style={{ color: "#ffc47a" }}>Área administrativa</p>
            <h2 className="mt-4 max-w-md text-4xl font-black leading-[1.08]">Sua operação inteira em um fluxo simples.</h2>
            <p className="mt-5 max-w-md text-sm leading-7" style={{ color: "#ffe9cf" }}>Pedidos, PDV, estoque, clientes, financeiro, equipe e operação conectados em uma única plataforma.</p>
          </div>

          <div className="rounded-3xl border p-5" style={{ borderColor: "rgba(255,255,255,.13)", backgroundColor: "rgba(255,255,255,.07)" }}>
            <p className="text-sm font-black">SaborFlow</p>
            <p className="mt-1 text-xs leading-5" style={{ color: "#ffe5c5" }}>Acesse sua conta para abrir o ambiente exclusivo da sua empresa.</p>
          </div>
        </section>

        <section className="flex min-h-[650px] flex-col justify-center p-6 sm:p-10 lg:p-12">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: "#f0d0aa" }}>
              <img src="/saborflow-brand.png" alt="SaborFlow" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: "#d96d00" }}>Plataforma SaborFlow</p>
              <p className="text-2xl font-black" style={{ color: "#3c2415" }}>SaborFlow</p>
            </div>
          </div>

          <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: "#d96d00" }}>Acesso ao sistema</p>
          <h2 className="mt-2 text-4xl font-black tracking-tight text-gray-950">Bem-vindo de volta</h2>
          <p className="mt-3 text-sm leading-6 text-gray-500">Entre na sua conta SaborFlow para acessar o painel da sua empresa.</p>
          <LoginForm />

          <div className="mt-7 rounded-2xl border px-4 py-3 text-center" style={{ borderColor: "#f0d0aa", backgroundColor: "#fff9f1" }}>
            <p className="text-xs font-black" style={{ color: "#3c2415" }}>Plataforma SaborFlow</p>
            <p className="mt-1 text-[11px] text-gray-500">Gestão de negócios com acesso individual e seguro.</p>
          </div>
        </section>
      </div>
    </main>
  )
}
