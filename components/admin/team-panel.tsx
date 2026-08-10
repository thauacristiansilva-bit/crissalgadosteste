"use client"

import { FormEvent, useState } from "react"
import { Power, UserPlus, Users } from "lucide-react"
import type { StaffMember, StaffRole } from "@/lib/types"

const roleLabels: Record<StaffRole, string> = { admin: "Administrador", manager: "Gerente", cashier: "Caixa / PDV", kitchen: "Cozinha", courier: "Entregador" }
const permissionsByRole: Record<StaffRole, string[]> = {
  admin: ["all"], manager: ["orders","products","customers","reports","settings"], cashier: ["pdv","orders","cash"], kitchen: ["kitchen","orders"], courier: ["delivery"],
}

export function TeamPanel({ staffMembers: initialStaff }: { staffMembers: StaffMember[] }) {
  const [staffMembers, setStaffMembers] = useState(initialStaff)
  const [draft, setDraft] = useState({ name: "", email: "", phone: "", role: "cashier" as StaffRole })
  const [message, setMessage] = useState("")

  async function add(event: FormEvent) {
    event.preventDefault(); setMessage("")
    const response = await fetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, permissions: permissionsByRole[draft.role] }) })
    const data = await response.json(); if (!response.ok) return setMessage(data.error || "Erro ao cadastrar.")
    setStaffMembers((current) => [...current, data.staffMember]); setDraft({ name: "", email: "", phone: "", role: "cashier" }); setMessage("Colaborador cadastrado.")
  }

  async function toggle(member: StaffMember) {
    const response = await fetch(`/api/staff/${member.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !member.active }) })
    const data = await response.json(); if (response.ok) setStaffMembers((current) => current.map((item) => item.id === member.id ? data.staffMember : item))
  }

  return <div className="space-y-5">
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Users className="h-5 w-5" /></div><div><h2 className="text-lg font-black">Equipe e funções</h2><p className="text-sm text-gray-500">Cadastre colaboradores e defina o perfil operacional.</p></div></div>
      <form onSubmit={add} className="mt-5 grid gap-3 rounded-2xl bg-gray-50 p-4 md:grid-cols-2 xl:grid-cols-5">
        <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nome" className="h-10 rounded-xl border border-gray-200 px-3 text-sm" />
        <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="E-mail" className="h-10 rounded-xl border border-gray-200 px-3 text-sm" />
        <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="Telefone" className="h-10 rounded-xl border border-gray-200 px-3 text-sm" />
        <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as StaffRole })} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm">{Object.entries(roleLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white"><UserPlus className="h-4 w-4" />Cadastrar</button>
      </form>
      {message && <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">{message}</p>}
      <div className="mt-5 overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Colaborador</th><th className="px-4 py-3">Função</th><th className="px-4 py-3">Permissões base</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-gray-100">{staffMembers.map((member) => <tr key={member.id}><td className="px-4 py-3"><strong>{member.name}</strong><div className="text-xs text-gray-400">{member.email || member.phone || "Sem contato"}</div></td><td className="px-4 py-3">{roleLabels[member.role]}</td><td className="px-4 py-3 text-xs text-gray-500">{member.permissions.join(", ")}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${member.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{member.active ? "Ativo" : "Inativo"}</span></td><td className="px-4 py-3"><button onClick={() => toggle(member)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Power className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>
      {!staffMembers.length && <p className="mt-4 rounded-xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">Nenhum colaborador cadastrado além do login principal do administrador.</p>}
      <p className="mt-4 text-xs text-gray-400">Os perfis ficam cadastrados para organização e futura autenticação individual. O login administrativo principal continua protegido pelas variáveis ADMIN_EMAIL/ADMIN_PASSWORD.</p>
    </section>
  </div>
}
