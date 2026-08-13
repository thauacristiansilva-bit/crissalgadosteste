"use client"

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Crown,
  LoaderCircle,
  MapPin,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Store,
  Users,
  WalletCards,
} from "lucide-react"
import type {
  CorporateGroupRole,
  CorporateOverview,
} from "@/lib/corporate-db"

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

export function CorporateGroupDashboard({
  currentOrganizationName,
}: {
  currentOrganizationName: string
}) {
  const [data, setData] = useState<CorporateOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const [groupName, setGroupName] = useState("")
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([])
  const [headquartersId, setHeadquartersId] = useState("")

  const [branchOrganizationId, setBranchOrganizationId] = useState("")
  const [branchCode, setBranchCode] = useState("")
  const [costCenter, setCostCenter] = useState("")

  const [memberEmail, setMemberEmail] = useState("")
  const [memberRole, setMemberRole] = useState<CorporateGroupRole>("analyst")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/corporate-group", { cache: "no-store" })
      const payload = (await response.json()) as CorporateOverview & { error?: string }
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar o grupo empresarial.")
      setData(payload)

      if (!payload.group && payload.organizations.length) {
        const current = payload.organizations.find(
          (organization) => organization.id === payload.currentOrganization.id,
        )
        const initial = current?.id || payload.organizations[0]?.id || ""
        setSelectedOrganizations((values) => (values.length ? values : initial ? [initial] : []))
        setHeadquartersId((value) => value || initial)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao carregar gestão corporativa.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function action(body: Record<string, unknown>, successMessage: string) {
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/admin/corporate-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as { error?: string; data?: CorporateOverview }
      if (!response.ok) throw new Error(payload.error || "Não foi possível concluir a ação.")
      if (payload.data) setData(payload.data)
      setMessage(successMessage)
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao concluir a ação.")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function switchOrganization(organizationId: string) {
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/admin/switch-organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(payload.error || "Não foi possível abrir a unidade.")
      window.location.assign("/admin")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao trocar de unidade.")
      setBusy(false)
    }
  }

  const grouped = useMemo(
    () => data?.organizations.filter((organization) => organization.inGroup) || [],
    [data],
  )
  const available = useMemo(
    () => data?.organizations.filter((organization) => !organization.inGroup) || [],
    [data],
  )

  if (loading) {
    return (
      <main className="min-h-screen bg-amber-50 px-4 py-10">
        <div className="mx-auto flex max-w-6xl items-center justify-center rounded-3xl border border-amber-200 bg-white p-12 shadow-sm">
          <LoaderCircle className="mr-3 h-5 w-5 animate-spin text-amber-700" />
          <span className="font-bold text-stone-700">Carregando gestão corporativa...</span>
        </div>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-amber-50 px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
          <p className="font-black text-red-700">{error || "Gestão corporativa indisponível."}</p>
          <Link href="/admin" className="mt-4 inline-flex rounded-xl bg-stone-900 px-4 py-2 text-sm font-black text-white">Voltar ao Admin</Link>
        </div>
      </main>
    )
  }

  if (!data.schemaReady) {
    return (
      <main className="min-h-screen bg-amber-50 px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-3xl border border-amber-300 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-black text-stone-950">Grupos empresariais</h1>
          <p className="mt-3 text-sm text-stone-600">A migration da Fase 19 ainda não foi aplicada.</p>
          <code className="mt-4 block rounded-xl bg-stone-950 p-4 text-sm text-amber-100">node scripts/migrate-multiempresa.mjs</code>
        </div>
      </main>
    )
  }

  const canCreate = data.permissions.canCreateGroup

  return (
    <main className="min-h-screen bg-[#fff8ef] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-amber-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-800"><Building2 className="h-6 w-6" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-amber-700">SaborFlow Corporativo</p>
              <h1 className="mt-1 text-2xl font-black text-stone-950">Matriz, filiais e visão consolidada</h1>
              <p className="mt-1 text-sm text-stone-500">Contexto atual: {currentOrganizationName}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-black text-stone-700 hover:bg-stone-50 disabled:opacity-50"><RefreshCcw className="h-4 w-4" />Atualizar</button>
            <Link href="/admin" className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-2 text-sm font-black text-white"><ArrowLeft className="h-4 w-4" />Voltar ao Admin</Link>
          </div>
        </header>

        {(error || message) && (
          <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error || message}</div>
        )}

        {!data.group ? (
          <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
            <div className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3"><Crown className="h-5 w-5 text-amber-700" /><h2 className="text-lg font-black text-stone-950">Criar grupo empresarial</h2></div>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">O grupo consolida as organizações da mesma conta comercial. Ele não mistura pedidos, estoque ou permissões operacionais entre as lojas.</p>

              {!canCreate ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Somente o proprietário da conta comercial, autenticado como owner da organização atual, pode criar o grupo.</div>
              ) : (
                <div className="mt-6 space-y-5">
                  <label className="block"><span className="text-sm font-black text-stone-700">Nome do grupo</span><input value={groupName} onChange={(event: ChangeEvent<HTMLInputElement>) => setGroupName(event.target.value)} placeholder="Ex.: Grupo SaborFlow Food" className="mt-2 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-amber-500" /></label>

                  <div>
                    <p className="text-sm font-black text-stone-700">Organizações que farão parte</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {data.organizations.map((organization) => {
                        const checked = selectedOrganizations.includes(organization.id)
                        return <label key={organization.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 ${checked ? "border-amber-400 bg-amber-50" : "border-stone-200 bg-white"}`}><input type="checkbox" checked={checked} onChange={() => { setSelectedOrganizations((current) => checked ? current.filter((id) => id !== organization.id) : [...current, organization.id]); if (checked && headquartersId === organization.id) setHeadquartersId("") }} /><div><p className="text-sm font-black text-stone-900">{organization.name}</p><p className="text-xs text-stone-500">/{organization.slug}</p></div></label>
                      })}
                    </div>
                  </div>

                  <label className="block"><span className="text-sm font-black text-stone-700">Matriz</span><select value={headquartersId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setHeadquartersId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold outline-none focus:border-amber-500"><option value="">Selecione</option>{data.organizations.filter((organization) => selectedOrganizations.includes(organization.id)).map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>

                  <button type="button" disabled={busy || !groupName.trim() || !headquartersId || !selectedOrganizations.length} onClick={() => void action({ action: "createGroup", name: groupName, headquartersOrganizationId: headquartersId, organizationIds: selectedOrganizations }, "Grupo empresarial criado.")} className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-600 px-5 text-sm font-black text-white hover:bg-amber-700 disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Criar grupo</button>
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <div className="rounded-3xl bg-stone-950 p-6 text-white shadow-sm"><ShieldCheck className="h-6 w-6 text-amber-300" /><h2 className="mt-4 text-lg font-black">Isolamento preservado</h2><p className="mt-2 text-sm leading-relaxed text-stone-300">A visão corporativa pode consolidar números, mas entrar no painel operacional de uma filial continua exigindo membership próprio naquela organização.</p></div>
              <div className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm"><h3 className="font-black text-stone-900">Conta comercial</h3><p className="mt-2 break-all text-xs text-stone-500">{data.account?.id || "Não vinculada"}</p><p className="mt-3 text-sm font-bold text-stone-700">{data.organizations.length} organização(ões) elegíveis</p></div>
            </aside>
          </section>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {[
                { label: "Unidades", value: data.metrics.units, icon: Store },
                { label: "Filiais", value: data.metrics.branches, icon: MapPin },
                { label: "Pedidos 30d", value: data.metrics.orders30d, icon: BarChart3 },
                { label: "Faturamento 30d", value: money.format(data.metrics.revenue30d), icon: WalletCards },
                { label: "Pedidos abertos", value: data.metrics.openOrders, icon: RefreshCcw },
                { label: "Despesas 30d", value: money.format(data.metrics.financialExpense30d), icon: WalletCards },
              ].map((card) => { const Icon = card.icon; return <article key={card.label} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-bold text-stone-500">{card.label}</p><Icon className="h-4 w-4 text-amber-700" /></div><p className="mt-2 text-xl font-black text-stone-950">{card.value}</p></article> })}
            </section>

            <section className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-700">Grupo ativo</p><h2 className="mt-1 text-xl font-black text-stone-950">{data.group.name}</h2><p className="mt-1 text-xs text-stone-500">Seu papel: {data.group.role || "sem acesso corporativo"}</p></div>{data.permissions.canManageGroup && <div className="flex gap-2"><input value={groupName} onChange={(event: ChangeEvent<HTMLInputElement>) => setGroupName(event.target.value)} placeholder={data.group.name} className="h-10 rounded-xl border border-stone-200 px-3 text-sm outline-none" /><button disabled={busy || !groupName.trim()} onClick={() => void action({ action: "renameGroup", groupId: data.group?.id, name: groupName }, "Nome do grupo atualizado.")} className="rounded-xl bg-stone-900 px-4 text-sm font-black text-white disabled:opacity-50">Renomear</button></div>}</div>
            </section>

            <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3"><Store className="h-5 w-5 text-amber-700" /><div><h2 className="text-lg font-black text-stone-950">Matriz e filiais</h2><p className="text-sm text-stone-500">Consolidado dos últimos 30 dias, sem remover o isolamento por organização.</p></div></div>
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-[900px] w-full text-left text-sm"><thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500"><th className="px-3 py-3">Unidade</th><th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Pedidos 30d</th><th className="px-3 py-3">Faturamento 30d</th><th className="px-3 py-3">Abertos</th><th className="px-3 py-3">Acesso operacional</th><th className="px-3 py-3 text-right">Ações</th></tr></thead><tbody>{grouped.map((organization) => <tr key={organization.id} className="border-b border-stone-100"><td className="px-3 py-4"><p className="font-black text-stone-900">{organization.name}</p><p className="text-xs text-stone-500">/{organization.slug}{organization.unitCode ? ` · ${organization.unitCode}` : ""}{organization.costCenter ? ` · ${organization.costCenter}` : ""}</p></td><td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${organization.unitType === "headquarters" ? "bg-amber-100 text-amber-800" : "bg-blue-50 text-blue-700"}`}>{organization.unitType === "headquarters" ? "Matriz" : "Filial"}</span></td><td className="px-3 py-4 font-bold">{organization.orders30d}</td><td className="px-3 py-4 font-bold">{money.format(organization.revenue30d)}</td><td className="px-3 py-4 font-bold">{organization.openOrders}</td><td className="px-3 py-4">{organization.hasTenantAccess ? <span className="font-bold text-emerald-700">{organization.tenantRole}</span> : <span className="text-stone-400">Somente consolidado</span>}</td><td className="px-3 py-4"><div className="flex justify-end gap-2">{organization.hasTenantAccess && <button disabled={busy} onClick={() => void switchOrganization(organization.id)} className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-black text-stone-700">Abrir painel</button>}{data.permissions.canManageUnits && organization.unitType !== "headquarters" && <><button disabled={busy} onClick={() => void action({ action: "setHeadquarters", groupId: data.group?.id, organizationId: organization.id }, `${organization.name} definida como matriz.`)} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-black text-amber-800">Virar matriz</button><button disabled={busy} onClick={() => void action({ action: "removeUnit", groupId: data.group?.id, organizationId: organization.id }, "Filial removida do grupo.")} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-black text-red-700">Remover</button></>}</div></td></tr>)}</tbody></table>
              </div>

              {data.permissions.canManageUnits && available.length > 0 && <div className="mt-6 grid gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 md:grid-cols-[1.4fr_.7fr_.9fr_auto]"><select value={branchOrganizationId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setBranchOrganizationId(event.target.value)} className="h-10 rounded-xl border border-amber-200 bg-white px-3 text-sm font-bold"><option value="">Adicionar organização como filial</option>{available.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select><input value={branchCode} onChange={(event: ChangeEvent<HTMLInputElement>) => setBranchCode(event.target.value)} placeholder="Código da unidade" className="h-10 rounded-xl border border-amber-200 bg-white px-3 text-sm" /><input value={costCenter} onChange={(event: ChangeEvent<HTMLInputElement>) => setCostCenter(event.target.value)} placeholder="Centro de custo" className="h-10 rounded-xl border border-amber-200 bg-white px-3 text-sm" /><button disabled={busy || !branchOrganizationId} onClick={async () => { const ok = await action({ action: "addUnit", groupId: data.group?.id, organizationId: branchOrganizationId, unitCode: branchCode, costCenter }, "Filial adicionada ao grupo."); if (ok) { setBranchOrganizationId(""); setBranchCode(""); setCostCenter("") } }} className="h-10 rounded-xl bg-amber-600 px-4 text-sm font-black text-white disabled:opacity-50">Adicionar</button></div>}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1fr_.7fr]">
              <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><Users className="h-5 w-5 text-amber-700" /><div><h2 className="text-lg font-black text-stone-950">Equipe corporativa</h2><p className="text-sm text-stone-500">Permissão corporativa não concede acesso operacional automático às lojas.</p></div></div><div className="mt-4 space-y-2">{data.members.map((member) => <div key={member.id} className="flex flex-col gap-3 rounded-2xl border border-stone-200 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-stone-900">{member.name}</p><p className="text-xs text-stone-500">{member.email} · {member.role}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs font-black ${member.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>{member.status}</span>{data.permissions.canManageMembers && <button disabled={busy} onClick={() => void action({ action: "setMemberStatus", groupId: data.group?.id, memberId: member.id, status: member.status === "active" ? "disabled" : "active" }, "Status do membro atualizado.")} className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-black text-stone-700">{member.status === "active" ? "Desativar" : "Reativar"}</button>}</div></div>)}</div>{data.permissions.canManageMembers && <div className="mt-5 grid gap-3 rounded-2xl bg-stone-50 p-4 sm:grid-cols-[1fr_.45fr_auto]"><input value={memberEmail} onChange={(event: ChangeEvent<HTMLInputElement>) => setMemberEmail(event.target.value)} type="email" placeholder="E-mail de usuário existente" className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm" /><select value={memberRole} onChange={(event: ChangeEvent<HTMLSelectElement>) => setMemberRole(event.target.value as CorporateGroupRole)} className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold"><option value="analyst">Analista</option><option value="admin">Admin corporativo</option>{data.group.role === "owner" && <option value="owner">Owner</option>}</select><button disabled={busy || !memberEmail.trim()} onClick={async () => { const ok = await action({ action: "addMember", groupId: data.group?.id, email: memberEmail, role: memberRole }, "Membro corporativo adicionado."); if (ok) setMemberEmail("") }} className="h-10 rounded-xl bg-stone-900 px-4 text-sm font-black text-white disabled:opacity-50">Adicionar</button></div>}</div>

              <aside className="rounded-3xl bg-stone-950 p-6 text-white shadow-sm"><ShieldCheck className="h-6 w-6 text-amber-300" /><h2 className="mt-4 text-lg font-black">Fronteiras de acesso</h2><div className="mt-4 space-y-3 text-sm text-stone-300"><p>✓ Somente organizações da mesma conta de cobrança podem entrar no grupo.</p><p>✓ Leitura consolidada não concede escrita em outra filial.</p><p>✓ Para abrir o painel de uma unidade, o usuário precisa de membership tenant nela.</p><p>✓ Um grupo ativo mantém exatamente uma matriz.</p></div></aside>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
