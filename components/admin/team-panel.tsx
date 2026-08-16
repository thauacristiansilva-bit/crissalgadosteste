"use client"

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  Copy,
  KeyRound,
  Pencil,
  Power,
  Save,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  UserPlus,
  Users,
  X,
} from "lucide-react"
import type {
  StaffEmploymentType,
  StaffMember,
  StaffRole,
} from "@/lib/types"
import { HelpLabel, HelpTip } from "@/components/admin/help-tip"
import {
  OPERATIONAL_PERMISSION_CATALOG,
  getCustomPermissionsFromStorage,
  getRolePermissionPreset,
  storedPermissionsAreCustom,
  toCustomPermissionStorage,
  type OperationalPermission,
} from "@/lib/operational-permissions"

type TeamAccess = {
  staffMemberId: number
  name: string
  email: string
  role: StaffRole
  staffActive: boolean
  userId: string | null
  userStatus:
    | "active"
    | "blocked"
    | "pending"
    | null
  membershipStatus:
    | "active"
    | "invited"
    | "disabled"
    | null
  passwordReady: boolean
}

const roleLabels: Record<
  StaffRole,
  string
> = {
  admin: "Administrador",
  manager: "Gerente",
  cashier: "Caixa / PDV",
  kitchen: "Cozinha",
  courier: "Entregador",
}

const employmentLabels: Record<StaffEmploymentType, string> = {
  employee: "Funcionário",
  contractor: "Prestador / PJ",
  temporary: "Temporário",
  partner: "Sócio / parceiro",
  other: "Outro",
}

function accessLabel(
  access?: TeamAccess,
) {
  if (!access?.userId) {
    return {
      text: "Sem login",
      className:
        "bg-gray-100 text-gray-600",
    }
  }

  if (
    access.membershipStatus ===
    "active"
  ) {
    return {
      text: "Login ativo",
      className:
        "bg-emerald-50 text-emerald-700",
    }
  }

  if (
    access.membershipStatus ===
    "invited"
  ) {
    return {
      text: "Convite pendente",
      className:
        "bg-amber-50 text-amber-700",
    }
  }

  return {
    text: "Acesso desativado",
    className:
      "bg-red-50 text-red-700",
  }
}

export function TeamPanel({
  staffMembers: initialStaff,
  canManageTeam,
  canManageAccess,
}: {
  staffMembers: StaffMember[]
  canManageTeam: boolean
  canManageAccess: boolean
}) {
  const [
    staffMembers,
    setStaffMembers,
  ] = useState(initialStaff)

  const [access, setAccess] =
    useState<TeamAccess[]>([])

  const [draft, setDraft] =
    useState({
      name: "",
      email: "",
      phone: "",
      role:
        "cashier" as StaffRole,
    })

  const [message, setMessage] =
    useState("")
  const [busyId, setBusyId] =
    useState<number | null>(null)
  const [permissionEditorId, setPermissionEditorId] =
    useState<number | null>(null)
  const [permissionDraft, setPermissionDraft] =
    useState<OperationalPermission[]>([])
  const [editorId, setEditorId] =
    useState<number | null>(null)
  const [editDraft, setEditDraft] = useState({
    name: "",
    email: "",
    phone: "",
    role: "cashier" as StaffRole,
    active: true,
    hireDate: "",
    employmentType: "" as StaffEmploymentType | "",
    notes: "",
  })

  async function reloadAccess() {
    const response = await fetch(
      "/api/admin/team/access",
      { cache: "no-store" },
    )

    const data =
      await response.json()

    if (response.ok) {
      setAccess(
        Array.isArray(data.access)
          ? data.access
          : [],
      )
    }
  }

  useEffect(() => {
    void reloadAccess()
  }, [])

  const accessByStaff =
    useMemo(
      () =>
        new Map(
          access.map((item) => [
            item.staffMemberId,
            item,
          ]),
        ),
      [access],
    )

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, Array<(typeof OPERATIONAL_PERMISSION_CATALOG)[number]>>()
    for (const item of OPERATIONAL_PERMISSION_CATALOG) {
      if (item.id === "billing.view") continue
      const current = groups.get(item.group) || []
      current.push(item)
      groups.set(item.group, current)
    }
    return [...groups.entries()]
  }, [])

  const permissionEditor = permissionEditorId === null
    ? null
    : staffMembers.find((member) => member.id === permissionEditorId) || null

  const editor = editorId === null
    ? null
    : staffMembers.find((member) => member.id === editorId) || null

  async function add(
    event: FormEvent,
  ) {
    event.preventDefault()
    if (!canManageTeam) return
    setMessage("")

    const response = await fetch(
      "/api/staff",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          ...draft,
          permissions: [],
        }),
      },
    )

    const data =
      await response.json()

    if (!response.ok) {
      return setMessage(
        data.error ||
          "Erro ao cadastrar.",
      )
    }

    setStaffMembers(
      (current) => [
        ...current,
        data.staffMember,
      ],
    )

    setDraft({
      name: "",
      email: "",
      phone: "",
      role: "cashier",
    })

    setMessage(
      "Colaborador cadastrado. Agora você pode criar o login individual.",
    )

    await reloadAccess()
  }

  async function toggle(
    member: StaffMember,
  ) {
    if (!canManageTeam) return
    setBusyId(member.id)
    setMessage("")

    const response = await fetch(
      `/api/staff/${member.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          active:
            !member.active,
        }),
      },
    )

    const data =
      await response.json()

    setBusyId(null)

    if (!response.ok) {
      return setMessage(
        data.error ||
          "Não foi possível alterar.",
      )
    }

    setStaffMembers(
      (current) =>
        current.map((item) =>
          item.id === member.id
            ? data.staffMember
            : item,
        ),
    )

    if (member.active) {
      setMessage(
        "Colaborador desativado. O acesso de login vinculado também foi desativado.",
      )
    }

    await reloadAccess()
  }

  async function createInvite(
    member: StaffMember,
  ) {
    setBusyId(member.id)
    setMessage("")

    const response = await fetch(
      "/api/admin/team/access",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          action: "invite",
          staffMemberId:
            member.id,
        }),
      },
    )

    const data =
      await response.json()

    setBusyId(null)

    if (!response.ok) {
      return setMessage(
        data.error ||
          "Não foi possível gerar o convite.",
      )
    }

    const invitation =
      data.invitation

    if (
      invitation?.alreadyActive
    ) {
      setMessage(
        "Este colaborador já possui acesso ativo.",
      )
    } else if (
      invitation?.url
    ) {
      await navigator.clipboard
        .writeText(
          invitation.url,
        )
        .catch(() => null)

      setMessage(
        `Convite criado e copiado. Link válido até ${new Date(
          invitation.expiresAt,
        ).toLocaleString(
          "pt-BR",
        )}: ${invitation.url}`,
      )
    }

    await reloadAccess()
  }

  async function createReset(
    member: StaffMember,
    item: TeamAccess,
  ) {
    if (!item.userId) return

    setBusyId(member.id)
    setMessage("")

    const response = await fetch(
      "/api/admin/team/access",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          action:
            "password-reset",
          userId:
            item.userId,
        }),
      },
    )

    const data =
      await response.json()

    setBusyId(null)

    if (!response.ok) {
      return setMessage(
        data.error ||
          "Não foi possível gerar recuperação.",
      )
    }

    const url =
      data.reset?.url

    if (url) {
      await navigator.clipboard
        .writeText(url)
        .catch(() => null)

      setMessage(
        `Link de recuperação copiado. Válido até ${new Date(
          data.reset.expiresAt,
        ).toLocaleString(
          "pt-BR",
        )}: ${url}`,
      )
    }
  }

  async function disableAccess(
    member: StaffMember,
    item: TeamAccess,
  ) {
    if (!item.userId) return

    if (
      !window.confirm(
        `Desativar o login de ${member.name} nesta empresa?`,
      )
    ) {
      return
    }

    setBusyId(member.id)

    const response = await fetch(
      "/api/admin/team/access",
      {
        method: "DELETE",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          userId:
            item.userId,
        }),
      },
    )

    const data =
      await response.json()

    setBusyId(null)

    if (!response.ok) {
      return setMessage(
        data.error ||
          "Não foi possível desativar.",
      )
    }

    setStaffMembers(
      (current) =>
        current.map((entry) =>
          entry.id === member.id
            ? {
                ...entry,
                active: false,
              }
            : entry,
        ),
    )

    setMessage(
      "Acesso desativado.",
    )
    await reloadAccess()
  }

  function openEditor(member: StaffMember) {
    setEditorId(member.id)
    setEditDraft({
      name: member.name,
      email: member.email,
      phone: member.phone,
      role: member.role,
      active: member.active,
      hireDate: member.hireDate || "",
      employmentType: member.employmentType || "",
      notes: member.notes || "",
    })
    setMessage("")
  }

  async function saveProfile() {
    if (!editor || !canManageTeam) return

    setBusyId(editor.id)
    setMessage("")

    const payload: Record<string, unknown> = {
      name: editDraft.name,
      email: editDraft.email,
      phone: editDraft.phone,
      active: editDraft.active,
      hireDate: editDraft.hireDate,
      employmentType: editDraft.employmentType || null,
      notes: editDraft.notes,
    }

    if (canManageAccess) {
      payload.role = editDraft.role
    }

    const response = await fetch(`/api/staff/${editor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    setBusyId(null)

    if (!response.ok) {
      return setMessage(data.error || "Não foi possível salvar o colaborador.")
    }

    setStaffMembers((current) =>
      current.map((item) =>
        item.id === editor.id ? data.staffMember : item,
      ),
    )
    setEditorId(null)
    setMessage("Dados do colaborador atualizados.")
    await reloadAccess()
  }

  function openPermissions(member: StaffMember) {
    const custom = storedPermissionsAreCustom(member.permissions)
    setPermissionEditorId(member.id)
    setPermissionDraft(
      custom
        ? getCustomPermissionsFromStorage(member.permissions)
        : getRolePermissionPreset(member.role),
    )
    setMessage("")
  }

  function togglePermission(permission: OperationalPermission) {
    setPermissionDraft((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    )
  }

  async function savePermissionProfile(custom: boolean) {
    if (!permissionEditor || !canManageAccess) return

    setBusyId(permissionEditor.id)
    setMessage("")

    const response = await fetch(`/api/staff/${permissionEditor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        permissions: custom
          ? toCustomPermissionStorage(permissionDraft)
          : [],
      }),
    })

    const data = await response.json()
    setBusyId(null)

    if (!response.ok) {
      return setMessage(data.error || "Não foi possível salvar as permissões.")
    }

    setStaffMembers((current) =>
      current.map((item) =>
        item.id === permissionEditor.id ? data.staffMember : item,
      ),
    )
    setPermissionEditorId(null)
    setMessage(
      custom
        ? "Permissões personalizadas salvas."
        : "O colaborador voltou a usar o padrão da função.",
    )
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black">
              <HelpLabel helpKey="team.access">Equipe e acessos</HelpLabel>
            </h2>
            <p className="text-sm text-gray-500">
              Cadastre o perfil operacional e
              gere um login individual por
              colaborador.
            </p>
          </div>
        </div>

        {canManageTeam && <form
          onSubmit={add}
          className="mt-5 grid gap-3 rounded-2xl bg-gray-50 p-4 md:grid-cols-2 xl:grid-cols-5"
        >
          <input
            required
            value={draft.name}
            onChange={(event) =>
              setDraft({
                ...draft,
                name:
                  event.target
                    .value,
              })
            }
            placeholder="Nome"
            className="h-10 rounded-xl border border-gray-200 px-3 text-sm"
          />

          <input
            type="email"
            value={draft.email}
            onChange={(event) =>
              setDraft({
                ...draft,
                email:
                  event.target
                    .value,
              })
            }
            placeholder="E-mail"
            className="h-10 rounded-xl border border-gray-200 px-3 text-sm"
          />

          <input
            value={draft.phone}
            onChange={(event) =>
              setDraft({
                ...draft,
                phone:
                  event.target
                    .value,
              })
            }
            placeholder="Telefone"
            className="h-10 rounded-xl border border-gray-200 px-3 text-sm"
          />

          <select
            value={draft.role}
            onChange={(event) =>
              setDraft({
                ...draft,
                role:
                  event.target
                    .value as StaffRole,
              })
            }
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"
          >
            {Object.entries(
              roleLabels,
            )
              .filter(([value]) => canManageAccess || value !== "admin")
              .map(
              ([value, label]) => (
                <option
                  key={value}
                  value={value}
                >
                  {label}
                </option>
              ),
            )}
          </select>

          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white">
            <UserPlus className="h-4 w-4" />
            Cadastrar
          </button>
        </form>}

        {message && (
          <p className="mt-3 break-words rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
            {message}
          </p>
        )}

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">
                  Colaborador
                </th>
                <th className="px-4 py-3">
                  <HelpLabel helpKey="team.role">Função</HelpLabel>
                </th>
                <th className="px-4 py-3">
                  Status operacional
                </th>
                <th className="px-4 py-3">
                  Login
                </th>
                <th className="px-4 py-3">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {staffMembers.map(
                (member) => {
                  const item =
                    accessByStaff.get(
                      member.id,
                    )
                  const badge =
                    accessLabel(item)
                  const busy =
                    busyId ===
                    member.id

                  return (
                    <tr key={member.id}>
                      <td className="px-4 py-3">
                        <strong>
                          {member.name}
                        </strong>
                        <div className="text-xs text-gray-400">
                          {member.email ||
                            member.phone ||
                            "Sem contato"}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold">{roleLabels[member.role]}</div>
                        <div className="mt-1 text-[11px] text-gray-400">
                          {storedPermissionsAreCustom(member.permissions)
                            ? "Acesso personalizado"
                            : "Padrão da função"}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-bold ${
                            member.active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {member.active
                            ? "Ativo"
                            : "Inativo"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-bold ${badge.className}`}
                        >
                          {badge.text}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {canManageTeam && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => openEditor(member)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </button>
                          )}

                          {canManageTeam && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                toggle(
                                  member,
                                )
                              }
                              title={
                                member.active
                                  ? "Desativar colaborador"
                                  : "Ativar perfil operacional"
                              }
                              className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            >
                              <Power className="h-4 w-4" />
                            </button>
                          )}

                          {canManageAccess &&
                            member.active &&
                            member.email &&
                            item?.membershipStatus !==
                              "active" && (
                              <button
                                type="button"
                                disabled={
                                  busy
                                }
                                onClick={() =>
                                  createInvite(
                                    member,
                                  )
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                              >
                                {item?.membershipStatus ===
                                "invited" ? (
                                  <RefreshCw className="h-3.5 w-3.5" />
                                ) : (
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                )}
                                {item?.membershipStatus ===
                                "invited"
                                  ? "Novo convite"
                                  : "Criar login"}
                              </button>
                            )}

                          {canManageAccess && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => openPermissions(member)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 px-3 py-2 text-xs font-black text-violet-700 disabled:opacity-50"
                            >
                              <SlidersHorizontal className="h-3.5 w-3.5" />
                              Permissões
                            </button>
                          )}

                          {canManageAccess &&
                            item?.membershipStatus ===
                              "active" &&
                            item.userId && (
                              <>
                                <button
                                  type="button"
                                  disabled={
                                    busy
                                  }
                                  onClick={() =>
                                    createReset(
                                      member,
                                      item,
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-black text-blue-700 disabled:opacity-50"
                                >
                                  <KeyRound className="h-3.5 w-3.5" />
                                  Recuperar senha
                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    busy
                                  }
                                  onClick={() =>
                                    disableAccess(
                                      member,
                                      item,
                                    )
                                  }
                                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-50"
                                >
                                  Desativar login
                                </button>
                              </>
                            )}
                        </div>
                      </td>
                    </tr>
                  )
                },
              )}
            </tbody>
          </table>
        </div>

        {editor && canManageTeam && (
          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-black text-gray-900">Editar colaborador</h3>
                <p className="mt-1 text-xs text-gray-600">
                  Atualize os dados operacionais de {editor.name}. Alterações de função exigem permissão de gestão de acessos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditorId(null)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
                Fechar
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-1 text-xs font-bold text-gray-600">
                <span>Nome</span>
                <input
                  required
                  value={editDraft.name}
                  onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900"
                />
              </label>

              <label className="space-y-1 text-xs font-bold text-gray-600">
                <span>E-mail</span>
                <input
                  type="email"
                  value={editDraft.email}
                  onChange={(event) => setEditDraft({ ...editDraft, email: event.target.value })}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900"
                  placeholder="Usado para gerar convite de acesso"
                />
              </label>

              <label className="space-y-1 text-xs font-bold text-gray-600">
                <span>Telefone</span>
                <input
                  value={editDraft.phone}
                  onChange={(event) => setEditDraft({ ...editDraft, phone: event.target.value })}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900"
                />
              </label>

              <label className="space-y-1 text-xs font-bold text-gray-600">
                <span>Função</span>
                <select
                  value={editDraft.role}
                  disabled={!canManageAccess}
                  onChange={(event) => setEditDraft({ ...editDraft, role: event.target.value as StaffRole })}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 disabled:bg-gray-100"
                >
                  {Object.entries(roleLabels)
                    .filter(([value]) => canManageAccess || value === editor.role)
                    .map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                </select>
              </label>

              <label className="space-y-1 text-xs font-bold text-gray-600">
                <span>Vínculo</span>
                <select
                  value={editDraft.employmentType}
                  onChange={(event) => setEditDraft({ ...editDraft, employmentType: event.target.value as StaffEmploymentType | "" })}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900"
                >
                  <option value="">Não informado</option>
                  {Object.entries(employmentLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs font-bold text-gray-600">
                <span>Data de entrada</span>
                <input
                  type="date"
                  value={editDraft.hireDate}
                  onChange={(event) => setEditDraft({ ...editDraft, hireDate: event.target.value })}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900"
                />
              </label>

              <label className="space-y-1 text-xs font-bold text-gray-600">
                <span>Status operacional</span>
                <select
                  value={editDraft.active ? "active" : "inactive"}
                  onChange={(event) => setEditDraft({ ...editDraft, active: event.target.value === "active" })}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </label>
            </div>

            <label className="mt-3 block space-y-1 text-xs font-bold text-gray-600">
              <span>Observações internas</span>
              <textarea
                value={editDraft.notes}
                onChange={(event) => setEditDraft({ ...editDraft, notes: event.target.value })}
                rows={3}
                maxLength={1200}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-normal text-gray-900"
                placeholder="Informações internas da gestão. Não são exibidas ao cliente."
              />
            </label>

            {(() => {
              const item = accessByStaff.get(editor.id)
              const badge = accessLabel(item)
              return (
                <div className="mt-4 rounded-xl border border-blue-100 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-blue-700">Acesso ao sistema</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${badge.className}`}>{badge.text}</span>
                        {item?.email && <span className="text-xs text-gray-500">{item.email}</span>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canManageAccess && editor.active && editor.email && editDraft.email === editor.email && item?.membershipStatus !== "active" && (
                        <button
                          type="button"
                          disabled={busyId === editor.id}
                          onClick={() => void createInvite(editor)}
                          className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                        >
                          {item?.membershipStatus === "invited" ? "Gerar novo convite" : "Gerar login"}
                        </button>
                      )}
                      {canManageAccess && item?.membershipStatus === "active" && item.userId && (
                        <>
                          <button
                            type="button"
                            disabled={busyId === editor.id}
                            onClick={() => void createReset(editor, item)}
                            className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-black text-blue-700 disabled:opacity-50"
                          >
                            Recuperar senha
                          </button>
                          <button
                            type="button"
                            disabled={busyId === editor.id}
                            onClick={() => void disableAccess(editor, item)}
                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-50"
                          >
                            Revogar login
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {editDraft.email !== editor.email && (
                    <p className="mt-2 text-[11px] text-amber-700">
                      Salve o novo e-mail antes de gerar um convite. Se o login já estiver ativo, alterar o e-mail do perfil não troca automaticamente a credencial existente.
                    </p>
                  )}
                </div>
              )
            })()}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyId === editor.id || !editDraft.name.trim()}
                onClick={() => void saveProfile()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                Salvar alterações
              </button>
              {canManageAccess && (
                <button
                  type="button"
                  onClick={() => { setEditorId(null); openPermissions(editor) }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-4 py-2 text-xs font-black text-violet-700"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Personalizar permissões
                </button>
              )}
            </div>
          </div>
        )}

        {permissionEditor && canManageAccess && (
          <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-black text-gray-900">
                  Permissões de {permissionEditor.name}
                </h3>
                <p className="mt-1 text-xs text-gray-600">
                  Função: {roleLabels[permissionEditor.role]}. Se você salvar como personalizado,
                  esta lista passa a substituir o padrão da função para este colaborador.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPermissionEditorId(null)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {permissionGroups.map(([group, items]) => (
                <div key={group} className="rounded-xl border border-white bg-white p-3 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-wide text-violet-700">{group}</p>
                  <div className="mt-2 space-y-2">
                    {items.map((item) => (
                      <label key={item.id} className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={permissionDraft.includes(item.id)}
                          onChange={() => togglePermission(item.id)}
                          className="mt-0.5"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyId === permissionEditor.id}
                onClick={() => void savePermissionProfile(true)}
                className="rounded-xl bg-violet-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                Salvar acesso personalizado
              </button>
              <button
                type="button"
                disabled={busyId === permissionEditor.id}
                onClick={() => void savePermissionProfile(false)}
                className="rounded-xl border border-violet-200 bg-white px-4 py-2 text-xs font-black text-violet-700 disabled:opacity-50"
              >
                Usar padrão da função
              </button>
            </div>
          </div>
        )}

        {!staffMembers.length && (
          <p className="mt-4 rounded-xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
            Nenhum colaborador cadastrado além
            do proprietário da empresa.
          </p>
        )}

        <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <span className="inline-flex items-center gap-1.5"><strong>
            Convites:
          </strong><HelpTip helpKey="team.invite" /></span>{" "}
          o link é exibido e copiado somente
          quando você o gera. Compartilhe
          diretamente com o colaborador. O
          SaborFlow não envia e-mail automático
          nesta fase.
        </div>
      </section>
    </div>
  )
}
