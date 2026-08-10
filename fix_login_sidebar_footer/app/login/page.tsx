import { redirect } from "next/navigation"
import { LoginForm } from "@/components/admin/login-form"
import { getAdminEmail, isAdminAuthenticated } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function LoginPage() {
  if (await isAdminAuthenticated()) redirect("/admin")

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-5" style={{ background: "linear-gradient(180deg, #fff8ef 0%, #ffefd9 100%)" }}>
      <div className="absolute -left-24 top-0 h-80 w-80 rounded-full blur-3xl" style={{ backgroundColor: "rgba(245, 158, 11, 0.22)" }} />
      <div className="absolute -bottom-24 -right-10 h-96 w-96 rounded-full blur-3xl" style={{ backgroundColor: "rgba(60, 36, 21, 0.14)" }} />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border bg-white shadow-2xl lg:grid-cols-[1fr_1fr]" style={{ borderColor: "#f3d3a7" }}>
        <section className="hidden p-10 text-white lg:flex lg:flex-col lg:justify-between" style={{ background: "linear-gradient(135deg, #3c2415 0%, #e17b00 100%)" }}>
          <div>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg">
                <img src="/saborflow-brand.png" alt="SaborFlow" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em]" style={{ color: "#ffd9ac" }}>Marca registrada</p>
                <h1 className="text-3xl font-black">SaborFlow®</h1>
                <p className="text-sm" style={{ color: "#ffe8cc" }}>Plataforma oficial do painel</p>
              </div>
            </div>
            <h2 className="mt-10 text-4xl font-black leading-tight">Login do administrador com identidade premium.</h2>
            <p className="mt-4 max-w-md text-sm leading-6" style={{ color: "#fff0db" }}>Acesse o painel com a marca fixa do SaborFlow®, visual mais profissional, sidebar personalizada e rodapé oficial da plataforma.</p>
          </div>
          <div className="rounded-3xl border px-5 py-4" style={{ borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "#ffd9ac" }}>Empresa conectada</p>
            <p className="mt-2 text-lg font-bold text-white">Cris Salgados</p>
            <p className="text-sm" style={{ color: "#ffe8cc" }}>Painel administrativo pronto para uso comercial.</p>
          </div>
        </section>

        <section className="p-6 sm:p-10 lg:p-12">
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
              <img src="/saborflow-brand.png" alt="SaborFlow" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: "#e17b00" }}>Marca registrada</p>
              <p className="text-2xl font-black" style={{ color: "#3c2415" }}>SaborFlow®</p>
            </div>
          </div>
          <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "#e17b00" }}>Área administrativa</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-gray-950">Bem-vindo de volta</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">Entre para gerenciar os pedidos, o cardápio e toda a operação da sua empresa.</p>
          <LoginForm defaultEmail={getAdminEmail()} />
          <div className="mt-6 rounded-2xl px-4 py-3 text-xs leading-5" style={{ backgroundColor: "#fff5e7", color: "#8a4b00" }}>
            <strong>Primeiro acesso local:</strong> a senha padrão é <code className="rounded bg-white px-1.5 py-0.5 font-bold">cris1234</code>. Troque no arquivo <code className="rounded bg-white px-1.5 py-0.5 font-bold">.env.local</code> antes de publicar.
          </div>
          <div className="mt-6 rounded-2xl border px-4 py-3 text-center" style={{ borderColor: "#f3d3a7", backgroundColor: "#fffaf3" }}>
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "#e17b00" }}>Rodapé do login</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: "#3c2415" }}>SaborFlow® · acesso oficial da plataforma</p>
          </div>
        </section>
      </div>
    </main>
  )
}
