"use client"

import { useState, type FormEvent } from "react"
import { KeyRound, UserPlus } from "lucide-react"

export function ExtraAccessPanel() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("Andressa Silva")
  const [email, setEmail] = useState("")
  const [created, setCreated] = useState<{email: string, password: string} | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function createAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true); setError(""); setCreated(null)
    try {
      const response = await fetch("/api/admin/quick-access", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({name, email}),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível criar o acesso.")
      setCreated({email: data.email, password: data.password})
    } catch (err) { setError(err instanceof Error ? err.message : "Erro ao criar o acesso.") }
    finally {setLoading(false)}
  }

  return <div className="rounded-2xl border border-gray-200 bg-white p-4" data-sf-extra-access="v1">
    <button type="button" onClick={() => {setOpen(!open); setCreated(null); setError("")}} aria-expanded={open} className="flex w-full items-center justify-between gap-2 text-left text-sm font-bold text-gray-800"><span className="inline-flex items-center gap-2"><UserPlus className="h-4 w-4 text-blue-700"/> Criar outro acesso para a Cris Salgados</span><span>{open ? "Fechar" : "Abrir"}</span></button>
    {open && <div className="mt-4 space-y-3 border-t pt-4">
      <p className="text-sm text-gray-600">Para administradores autorizados. O login atual não muda. O novo usuário terá seu próprio e-mail, senha e verificação em duas etapas.</p>
      <form onSubmit={createAccess} className="space-y-3">
        <label className="block text-sm font-semibold">Nome<input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={120} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" /></label>
        <label className="block text-sm font-semibold">E-mail do novo usuário<input value={email} onChange={e => setEmail(e.target.value)} type="email" required maxLength={254} placeholder="nome@seudominio.com" className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" /></label>
        <p className="text-xs text-amber-700">Use um e-mail real para permitir recuperação de conta. Endereços fictícios não recebem mensagens.</p>
        <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><KeyRound className="h-4 w-4"/> {loading ? "Criando..." : "Criar acesso com senha segura"}</button>
      </form>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {created && <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm"><p className="font-bold text-emerald-800">Acesso criado. Guarde a senha agora: ela só é exibida aqui.</p><p><strong>E-mail:</strong> {created.email}</p><p><strong>Senha:</strong> <code className="break-all rounded bg-white px-2 py-1 select-all">{created.password}</code></p><button type="button" onClick={() => navigator.clipboard?.writeText(`E-mail: ${created.email}\nSenha: ${created.password}`)} className="rounded-lg border border-emerald-300 px-3 py-1.5 font-semibold">Copiar dados</button><p className="text-xs text-emerald-800">Ao fechar, a senha deixa de aparecer. A primeira entrada exigirá configurar a verificação em duas etapas.</p></div>}
    </div>}
  </div>
}
