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
  Power,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react"
import type {
  StaffMember,
  StaffRole,
} from "@/lib/types"

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

const permissionsByRole: Record<
  StaffRole,
  string[]
> = {
  admin: ["all"],
  manager: [
    "orders",
    "products",
    "customers",
    "reports",
    "settings",
  ],
  cashier: [
    "pdv",
    "orders",
    "cash",
  ],
  kitchen: [
    "kitchen",
    "orders",
  ],
  courier: ["delivery"],
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
}: {
  staffMembers: StaffMember[]
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

  async function add(
    event: FormEvent,
  ) {
    event.preventDefault()
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
          permissions:
            permissionsByRole[
              draft.role
            ],
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

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black">
              Equipe e acessos
            </h2>
            <p className="text-sm text-gray-500">
              Cadastre o perfil operacional e
              gere um login individual por
              colaborador.
            </p>
          </div>
        </div>

        <form
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
            ).map(
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
        </form>

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
                  Função
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
                        {
                          roleLabels[
                            member.role
                          ]
                        }
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

                          {member.active &&
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

                          {item?.membershipStatus ===
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

        {!staffMembers.length && (
          <p className="mt-4 rounded-xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
            Nenhum colaborador cadastrado além
            do proprietário da empresa.
          </p>
        )}

        <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <strong>
            Convites:
          </strong>{" "}
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
