"use client"

import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react"
import Link from "next/link"
import {
  Building2,
  ExternalLink,
  LoaderCircle,
  Plus,
  Store,
} from "lucide-react"
import type {
  OrganizationMembershipSummary,
} from "@/lib/tenant-context"

type OrganizationsResponse = {
  activeOrganizationId: string
  organizations:
    OrganizationMembershipSummary[]
}

export function OrganizationSwitcher({
  fallbackName,
  variant = "card",
}: {
  fallbackName: string
  variant?: "card" | "compact"
}) {
  const [data, setData] =
    useState<
      OrganizationsResponse | null
    >(null)
  const [busy, setBusy] =
    useState(false)
  const [error, setError] =
    useState("")

  useEffect(() => {
    let mounted = true

    fetch("/api/admin/organizations", {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            "Não foi possível carregar as empresas.",
          )
        }

        return response.json()
      })
      .then((value) => {
        if (mounted) {
          setData(value)
        }
      })
      .catch((reason) => {
        if (mounted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Erro ao carregar empresas.",
          )
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  const active = useMemo(
    () =>
      data?.organizations.find(
        (organization) =>
          organization.organizationId ===
          data.activeOrganizationId,
      ),
    [data],
  )

  async function switchOrganization(
    organizationId: string,
  ) {
    if (
      !organizationId ||
      organizationId ===
        data?.activeOrganizationId
    ) {
      return
    }

    setBusy(true)
    setError("")

    try {
      const response = await fetch(
        "/api/admin/switch-organization",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            organizationId,
          }),
        },
      )

      const payload =
        await response.json()

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Não foi possível trocar de empresa.",
        )
      }

      window.location.assign(
        "/admin",
      )
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Erro ao trocar de empresa.",
      )
      setBusy(false)
    }
  }

  async function toggleOrdering() {
    if (!active) return

    setBusy(true)
    setError("")

    try {
      const enabled =
        !active.publicOrderingEnabled

      const response = await fetch(
        "/api/admin/organizations/current/ordering",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            enabled,
          }),
        },
      )

      const payload =
        await response.json()

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Não foi possível alterar os pedidos online.",
        )
      }

      setData((current) =>
        current
          ? {
              ...current,
              organizations:
                current.organizations.map(
                  (organization) =>
                    organization.organizationId ===
                    current.activeOrganizationId
                      ? {
                          ...organization,
                          publicOrderingEnabled:
                            enabled,
                        }
                      : organization,
                ),
            }
          : current,
      )
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Erro ao alterar pedidos online.",
      )
    } finally {
      setBusy(false)
    }
  }

  const canManage =
    active?.role === "owner" ||
    active?.role === "admin"

  if (variant === "compact") {
    if (!data || data.organizations.length <= 1) return null

    return (
      <label className="hidden items-center gap-2 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-600 md:flex">
        <Building2 className="h-3.5 w-3.5 text-amber-700" />
        <span className="sr-only">Trocar empresa</span>
        <select
          value={data.activeOrganizationId}
          disabled={busy}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => switchOrganization(event.target.value)}
          className="max-w-44 bg-transparent text-xs font-black text-gray-800 outline-none disabled:opacity-50"
        >
          {data.organizations.map((organization) => (
            <option key={organization.organizationId} value={organization.organizationId}>
              {organization.organizationName}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <div className="mt-4 space-y-2">
      <div
        className="rounded-2xl border p-3"
        style={{
          borderColor:
            "rgba(255,255,255,.08)",
          backgroundColor:
            "rgba(255,255,255,.05)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white">
            <Store className="h-5 w-5 text-amber-700" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-white">
              {active?.organizationName ||
                fallbackName}
            </p>
            <p className="truncate text-[11px] text-amber-100/80">
              Empresa ativa
              {active
                ? ` · ${active.role}`
                : ""}
            </p>
          </div>
        </div>

        {data &&
          data.organizations.length >
            1 && (
            <label className="mt-3 block">
              <span className="sr-only">
                Trocar empresa
              </span>
              <select
                value={
                  data.activeOrganizationId
                }
                disabled={busy}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  switchOrganization(
                    event.target.value,
                  )
                }
                className="h-10 w-full rounded-xl border border-white/10 bg-white/10 px-3 text-xs font-bold text-white outline-none"
              >
                {data.organizations.map(
                  (organization) => (
                    <option
                      key={
                        organization.organizationId
                      }
                      value={
                        organization.organizationId
                      }
                      className="text-gray-900"
                    >
                      {
                        organization.organizationName
                      }
                    </option>
                  ),
                )}
              </select>
            </label>
          )}

        {active && (
          <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
            <span
              className={
                active.publicOrderingEnabled
                  ? "font-bold text-emerald-300"
                  : "font-bold text-amber-200"
              }
            >
              {active.publicOrderingEnabled
                ? "Pedidos online ativos"
                : "Pedidos online desativados"}
            </span>

            {canManage && (
              <button
                type="button"
                disabled={busy}
                onClick={
                  toggleOrdering
                }
                className="rounded-lg bg-white/10 px-2 py-1 font-black text-white hover:bg-white/15 disabled:opacity-50"
              >
                {busy ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : active.publicOrderingEnabled ? (
                  "Desativar"
                ) : (
                  "Ativar"
                )}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/admin/nova-empresa"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-2 text-[11px] font-black text-white hover:bg-white/15"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova empresa
        </Link>

        <Link
          href="/minha-loja"
          target="_blank"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-2 text-[11px] font-black text-white hover:bg-white/15"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir loja
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-100">
          {error}
        </div>
      )}

      {!data && !error && (
        <div className="flex items-center gap-2 px-1 text-[11px] text-amber-100/70">
          <Building2 className="h-3.5 w-3.5" />
          Carregando empresas...
        </div>
      )}
    </div>
  )
}
