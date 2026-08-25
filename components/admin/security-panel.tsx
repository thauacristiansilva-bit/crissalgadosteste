"use client"

import Script from "next/script"
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type {
  OrganizationRole,
} from "@/lib/tenant-context"
import { HelpLabel } from "@/components/admin/help-tip"


type DomainStatus = {
  domain: string
  verified: boolean
  primary: boolean
  verificationRecordName: string
  verifiedAt: string | null
  lastCheckedAt: string | null
}

type PrintAgent = {
  id: string
  name: string
  active: boolean
  lastSeenAt: string | null
  createdAt: string
}

type StorageStatus = {
  mode: "local" | "r2"
  r2Configured: boolean
  publicHost: string | null
  localFileCount: number
  uploadDirConfigured: boolean
  replicaReady: boolean
}

type SecurityData = {
  organization: {
    id: string
    name: string
    slug: string
  }
  role: OrganizationRole
  timeZone: string
  domains: DomainStatus[]
  printAgents: PrintAgent[]
  canManageSecurity: boolean
}

const commonTimeZones = [
  "America/Sao_Paulo",
  "America/Fortaleza",
  "America/Recife",
  "America/Bahia",
  "America/Manaus",
  "America/Belem",
  "America/Cuiaba",
  "America/Campo_Grande",
  "America/Rio_Branco",
]

function CopyButton({
  value,
}: {
  value: string
}) {
  const [copied, setCopied] =
    useState(false)

  async function copy() {
    await navigator.clipboard
      .writeText(value)
      .catch(() => null)

    setCopied(true)
    window.setTimeout(
      () => setCopied(false),
      1600,
    )
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-black text-gray-700 hover:bg-gray-50"
    >
      {copied
        ? "Copiado"
        : "Copiar"}
    </button>
  )
}

export function SecurityPanel({
  canManageSecurity,
}: {
  canManageSecurity: boolean
}) {
  const [
    data,
    setData,
  ] = useState<SecurityData | null>(
    null,
  )
  const [
    currentPassword,
    setCurrentPassword,
  ] = useState("")
  const [
    newPassword,
    setNewPassword,
  ] = useState("")
  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("")
  const [
    passwordMessage,
    setPasswordMessage,
  ] = useState("")
  const [
    passwordBusy,
    setPasswordBusy,
  ] = useState(false)

  const [googleLink, setGoogleLink] = useState<{ configured: boolean; linked: boolean; email: string } | null>(null)
  const [googleMessage, setGoogleMessage] = useState("")
  const [googleReady, setGoogleReady] = useState(false)
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null)
  const [storageMessage, setStorageMessage] = useState("")
  const [storageBusy, setStorageBusy] = useState(false)
  const googleButtonRef = useRef<HTMLDivElement | null>(null)
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""

  const [
    timeZone,
    setTimeZone,
  ] = useState(
    "America/Sao_Paulo",
  )
  const [
    domain,
    setDomain,
  ] = useState("")
  const [
    verification,
    setVerification,
  ] = useState<{
    domain: string
    recordName: string
    recordValue: string
  } | null>(null)

  const [
    agentName,
    setAgentName,
  ] = useState("")
  const [
    newAgent,
    setNewAgent,
  ] = useState<{
    id: string
    name: string
    token: string
  } | null>(null)

  const [
    organizationMessage,
    setOrganizationMessage,
  ] = useState("")
  const [busy, setBusy] =
    useState(false)

  const canManage = canManageSecurity

  async function reload() {
    const response = await fetch(
      "/api/admin/organization-security",
      { cache: "no-store" },
    )

    const next =
      await response.json()

    if (!response.ok) {
      setOrganizationMessage(
        next.error ||
          "Não foi possível carregar.",
      )
      return
    }

    setData(next)
    setTimeZone(next.timeZone)
  }

  async function reloadGoogle() {
    const response = await fetch("/api/admin/google-link", { cache: "no-store" })
    const result = await response.json().catch(() => null)
    if (response.ok && result) setGoogleLink(result)
  }

  async function reloadStorage() {
    const response = await fetch("/api/admin/storage", { cache: "no-store" }).catch(() => null)
    if (!response?.ok) return
    const result = await response.json().catch(() => null)
    if (result) setStorageStatus(result)
  }

  async function migrateStorageBatch() {
    setStorageBusy(true)
    setStorageMessage("")
    const response = await fetch("/api/admin/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 50 }),
    }).catch(() => null)
    const result = await response?.json().catch(() => null)
    setStorageBusy(false)

    if (!response?.ok) {
      setStorageMessage(result?.error || "Não foi possível migrar as imagens.")
      return
    }

    setStorageMessage(
      result?.complete
        ? `Migração concluída. ${result.uploaded || 0} arquivo(s) enviados neste lote e as cópias locais já podem deixar de ser usadas.`
        : `Lote concluído: ${result.uploaded || 0} enviado(s), ${result.alreadyStored || 0} já estavam no R2. Restam ${result.remainingLocal || 0} arquivo(s) locais. Clique novamente para continuar.`,
    )
    await reloadStorage()
  }

  async function linkGoogle(credential: string) {
    setGoogleMessage("")
    const response = await fetch("/api/admin/google-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    })
    const result = await response.json().catch(() => null)
    if (!response.ok) {
      setGoogleMessage(result?.error || "Não foi possível vincular o Google.")
      return
    }
    setGoogleMessage("Conta Google vinculada. No próximo login você já poderá usar o Google.")
    await reloadGoogle()
  }

  useEffect(() => {
    void reload()
    void reloadGoogle()
    void reloadStorage()
  }, [])

  useEffect(() => {
    if (!googleReady || !googleClientId || !googleButtonRef.current || !window.google || googleLink?.linked) return
    googleButtonRef.current.innerHTML = ""
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response: { credential: string }) => void linkGoogle(response.credential),
    })
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "large",
      width: 360,
      shape: "rectangular",
      text: "continue_with",
      locale: "pt-BR",
    })
  }, [googleReady, googleClientId, googleLink?.linked])

  const printCommand =
    useMemo(() => {
      if (!newAgent) return ""

      if (
        typeof window ===
        "undefined"
      ) {
        return ""
      }

      return `powershell -ExecutionPolicy Bypass -File .\\INICIAR-IMPRESSAO-AUTOMATICA.ps1 -ServerUrl "${window.location.origin}" -Token "${newAgent.token}"`
    }, [newAgent])

  async function changePassword(
    event: FormEvent,
  ) {
    event.preventDefault()
    setPasswordMessage("")

    if (newPassword.length < 12) {
      return setPasswordMessage(
        "A nova senha precisa ter pelo menos 12 caracteres.",
      )
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      return setPasswordMessage(
        "As novas senhas não conferem.",
      )
    }

    setPasswordBusy(true)

    const response = await fetch(
      "/api/admin/password/change",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      },
    )

    const result =
      await response.json()

    if (!response.ok) {
      setPasswordBusy(false)
      return setPasswordMessage(
        result.error ||
          "Não foi possível alterar.",
      )
    }

    setPasswordMessage(
      "Senha alterada. Entre novamente.",
    )

    window.setTimeout(() => {
      window.location.href =
        "/login"
    }, 700)
  }

  async function saveTimeZone() {
    setBusy(true)
    setOrganizationMessage("")

    const response = await fetch(
      "/api/admin/organization-security",
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          timeZone,
        }),
      },
    )

    const result =
      await response.json()

    setBusy(false)

    if (!response.ok) {
      return setOrganizationMessage(
        result.error ||
          "Não foi possível salvar.",
      )
    }

    setOrganizationMessage(
      "Timezone atualizado.",
    )
    await reload()
  }

  async function createDomain(
    event: FormEvent,
  ) {
    event.preventDefault()
    setBusy(true)
    setOrganizationMessage("")
    setVerification(null)

    const response = await fetch(
      "/api/admin/domains",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          domain,
        }),
      },
    )

    const result =
      await response.json()

    setBusy(false)

    if (!response.ok) {
      return setOrganizationMessage(
        result.error ||
          "Não foi possível cadastrar.",
      )
    }

    setVerification(
      result.verification,
    )
    setDomain("")
    setOrganizationMessage(
      "Domínio cadastrado. Crie o registro TXT abaixo e depois clique em Verificar.",
    )
    await reload()
  }

  async function verifyDomain(
    value: string,
  ) {
    setBusy(true)
    setOrganizationMessage("")

    const response = await fetch(
      "/api/admin/domains/verify",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          domain: value,
        }),
      },
    )

    const result =
      await response.json()

    setBusy(false)

    if (!response.ok) {
      return setOrganizationMessage(
        result.error ||
          "DNS ainda não validado.",
      )
    }

    setVerification(null)
    setOrganizationMessage(
      "Domínio verificado no SaborFlow.",
    )
    await reload()
  }

  async function removeDomain(
    value: string,
  ) {
    if (
      !window.confirm(
        `Remover ${value} desta empresa?`,
      )
    ) {
      return
    }

    const response = await fetch(
      "/api/admin/domains",
      {
        method: "DELETE",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          domain: value,
        }),
      },
    )

    const result =
      await response.json()

    if (!response.ok) {
      return setOrganizationMessage(
        result.error ||
          "Não foi possível remover.",
      )
    }

    await reload()
  }

  async function createAgent(
    event: FormEvent,
  ) {
    event.preventDefault()
    setBusy(true)
    setOrganizationMessage("")
    setNewAgent(null)

    const response = await fetch(
      "/api/admin/print-agents",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          name: agentName,
        }),
      },
    )

    const result =
      await response.json()

    setBusy(false)

    if (!response.ok) {
      return setOrganizationMessage(
        result.error ||
          "Não foi possível criar.",
      )
    }

    setNewAgent(
      result.agent,
    )
    setAgentName("")
    setOrganizationMessage(
      "Agente criado. O token abaixo é exibido somente nesta tela agora.",
    )
    await reload()
  }

  async function revokeAgent(
    id: string,
  ) {
    const response = await fetch(
      "/api/admin/print-agents",
      {
        method: "DELETE",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          id,
        }),
      },
    )

    const result =
      await response.json()

    if (!response.ok) {
      return setOrganizationMessage(
        result.error ||
          "Não foi possível revogar.",
      )
    }

    await reload()
  }

  return (
    <div className="space-y-5">
      {googleClientId && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setGoogleReady(true)} />}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">
          Minha conta
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          A nova senha invalida as
          sessões administrativas antigas.
        </p>

        <form
          onSubmit={changePassword}
          className="mt-5 grid gap-3 md:grid-cols-3"
        >
          <input
            type="password"
            autoComplete="current-password"
            required
            placeholder="Senha atual"
            value={currentPassword}
            onChange={(event) =>
              setCurrentPassword(
                event.target.value,
              )
            }
            className="h-11 rounded-xl border border-gray-200 px-3 text-sm"
          />
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            placeholder="Nova senha"
            value={newPassword}
            onChange={(event) =>
              setNewPassword(
                event.target.value,
              )
            }
            className="h-11 rounded-xl border border-gray-200 px-3 text-sm"
          />
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            placeholder="Confirmar nova senha"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(
                event.target.value,
              )
            }
            className="h-11 rounded-xl border border-gray-200 px-3 text-sm"
          />

          <button
            disabled={passwordBusy}
            className="h-11 rounded-xl bg-[#2f1c13] px-4 text-sm font-black text-white md:col-span-3 md:w-fit"
          >
            {passwordBusy
              ? "Alterando..."
              : "Alterar minha senha"}
          </button>
        </form>

        {passwordMessage && (
          <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
            {passwordMessage}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Login com Google</h2>
        <p className="mt-1 text-sm text-gray-500">
          Vincule a mesma Conta Google do seu e-mail SaborFlow para entrar no painel sem digitar a senha.
        </p>

        {!googleClientId || googleLink?.configured === false ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            Login com Google ainda não foi habilitado nas variáveis do Railway.
          </div>
        ) : googleLink?.linked ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            Conta Google vinculada a <strong>{googleLink.email}</strong>.
          </div>
        ) : (
          <div className="mt-4">
            <div ref={googleButtonRef} className="min-h-11 max-w-sm" />
            <p className="mt-2 text-xs leading-5 text-gray-500">Use exatamente a Conta Google com o e-mail <strong>{googleLink?.email || "da sua conta SaborFlow"}</strong>.</p>
          </div>
        )}

        {googleMessage && (
          <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{googleMessage}</p>
        )}
      </section>

      {!canManage && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">
            Segurança da empresa
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Domínios, timezone e agentes
            de impressão são gerenciados
            por proprietário ou
            administrador.
          </p>
        </section>
      )}

      {canManage && (
        <>
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Storage e CDN</h2>
            <p className="mt-1 text-sm text-gray-500">
              Imagens no Cloudflare R2 deixam a aplicação independente do disco do Railway e preparam o serviço para múltiplas réplicas.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-gray-200 p-3">
                <p className="text-xs font-bold uppercase text-gray-500">Modo atual</p>
                <p className="mt-1 font-black">{storageStatus?.mode === "r2" ? "Cloudflare R2" : "Disco / Volume"}</p>
              </div>
              <div className="rounded-xl border border-gray-200 p-3">
                <p className="text-xs font-bold uppercase text-gray-500">CDN pública</p>
                <p className="mt-1 break-all font-black">{storageStatus?.publicHost || "Não configurada"}</p>
              </div>
              <div className="rounded-xl border border-gray-200 p-3">
                <p className="text-xs font-bold uppercase text-gray-500">Arquivos legados locais</p>
                <p className="mt-1 font-black">{storageStatus?.localFileCount ?? "—"}</p>
              </div>
            </div>

            {storageStatus?.mode === "r2" && storageStatus.r2Configured ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-black text-emerald-900">R2 configurado e ativo.</p>
                <p className="mt-1 text-xs leading-5 text-emerald-800">
                  Novos uploads já vão para o R2. Enquanto ainda existirem arquivos locais, mantenha o Volume do Railway conectado e migre os arquivos antigos.
                </p>
                {(storageStatus.localFileCount || 0) > 0 && (
                  <button
                    type="button"
                    disabled={storageBusy}
                    onClick={migrateStorageBatch}
                    className="mt-3 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
                  >
                    {storageBusy ? "Migrando..." : "Migrar próximo lote de imagens"}
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Configure as variáveis R2 no Railway e defina <code className="font-black">MEDIA_STORAGE_MODE=r2</code>. Até lá, o sistema continua usando o armazenamento local atual.
              </div>
            )}

            {storageMessage && (
              <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{storageMessage}</p>
            )}

            {storageStatus?.replicaReady && (
              <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                O serviço está sem arquivos locais detectados e com R2 ativo. Depois de confirmar que todas as imagens abrem corretamente, você pode remover o Volume para liberar o uso de réplicas.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">
              <HelpLabel helpKey="security.timezone">Timezone da empresa</HelpLabel>
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Usado para datas operacionais,
              relatórios e impressão.
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                list="saborflow-timezones"
                value={timeZone}
                onChange={(event) =>
                  setTimeZone(
                    event.target.value,
                  )
                }
                className="h-11 flex-1 rounded-xl border border-gray-200 px-3 text-sm"
              />
              <datalist id="saborflow-timezones">
                {commonTimeZones.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    />
                  ),
                )}
              </datalist>
              <button
                type="button"
                disabled={busy}
                onClick={saveTimeZone}
                className="h-11 rounded-xl bg-blue-700 px-4 text-sm font-black text-white"
              >
                Salvar timezone
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">
              <HelpLabel helpKey="security.domain">Domínio customizado</HelpLabel>
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              O SaborFlow verifica propriedade
              com um registro DNS TXT. A
              configuração de roteamento do
              domínio no provedor de hospedagem
              continua sendo necessária.
            </p>

            <form
              onSubmit={createDomain}
              className="mt-4 flex flex-col gap-3 sm:flex-row"
            >
              <input
                required
                placeholder="pedidos.suaempresa.com.br"
                value={domain}
                onChange={(event) =>
                  setDomain(
                    event.target.value,
                  )
                }
                className="h-11 flex-1 rounded-xl border border-gray-200 px-3 text-sm"
              />
              <button
                disabled={busy}
                className="h-11 rounded-xl bg-blue-700 px-4 text-sm font-black text-white"
              >
                Gerar verificação
              </button>
            </form>

            {verification && (
              <div className="mt-4 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-black text-amber-900">
                  Crie este registro TXT no DNS
                </p>

                <div>
                  <span className="text-xs font-bold uppercase text-amber-700">
                    Nome
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-xs">
                      {
                        verification.recordName
                      }
                    </code>
                    <CopyButton
                      value={
                        verification.recordName
                      }
                    />
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold uppercase text-amber-700">
                    Valor
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-xs">
                      {
                        verification.recordValue
                      }
                    </code>
                    <CopyButton
                      value={
                        verification.recordValue
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 space-y-2">
              {data?.domains.map(
                (item) => (
                  <div
                    key={item.domain}
                    className="flex flex-col gap-3 rounded-xl border border-gray-200 p-3 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <strong className="break-all text-sm">
                        {item.domain}
                      </strong>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        <span
                          className={
                            item.verified
                              ? "font-bold text-emerald-700"
                              : "font-bold text-amber-700"
                          }
                        >
                          {item.verified
                            ? "Verificado"
                            : "Pendente"}
                        </span>
                        {item.primary && (
                          <span className="font-bold text-blue-700">
                            Principal
                          </span>
                        )}
                      </div>
                    </div>

                    {!item.verified && (
                      <button
                        type="button"
                        onClick={() =>
                          verifyDomain(
                            item.domain,
                          )
                        }
                        className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white"
                      >
                        Verificar
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        removeDomain(
                          item.domain,
                        )
                      }
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700"
                    >
                      Remover
                    </button>
                  </div>
                ),
              )}

              {!data?.domains.length && (
                <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
                  Nenhum domínio customizado
                  cadastrado.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">
              <HelpLabel helpKey="security.printAgent">Agentes de impressão</HelpLabel>
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Cada empresa recebe seu próprio
              token. Um token de uma empresa não
              acessa a fila de outra.
            </p>

            <form
              onSubmit={createAgent}
              className="mt-4 flex flex-col gap-3 sm:flex-row"
            >
              <input
                required
                placeholder="Caixa principal"
                value={agentName}
                onChange={(event) =>
                  setAgentName(
                    event.target.value,
                  )
                }
                className="h-11 flex-1 rounded-xl border border-gray-200 px-3 text-sm"
              />
              <button
                disabled={busy}
                className="h-11 rounded-xl bg-blue-700 px-4 text-sm font-black text-white"
              >
                Criar agente
              </button>
            </form>

            {newAgent && (
              <div className="mt-4 space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-black text-emerald-900">
                  Token exibido uma única vez
                </p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-xs">
                    {newAgent.token}
                  </code>
                  <CopyButton
                    value={
                      newAgent.token
                    }
                  />
                </div>

                {printCommand && (
                  <>
                    <p className="text-xs font-bold text-emerald-800">
                      Comando no computador
                      Windows:
                    </p>
                    <div className="flex items-start gap-2">
                      <code className="min-w-0 flex-1 whitespace-pre-wrap break-all rounded-lg bg-white px-3 py-2 text-xs">
                        {printCommand}
                      </code>
                      <CopyButton
                        value={
                          printCommand
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="mt-5 space-y-2">
              {data?.printAgents.map(
                (agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <strong className="text-sm">
                        {agent.name}
                      </strong>
                      <p className="mt-1 text-xs text-gray-500">
                        {agent.active
                          ? "Ativo"
                          : "Revogado"}
                        {agent.lastSeenAt
                          ? ` · último contato ${new Date(
                              agent.lastSeenAt,
                            ).toLocaleString(
                              "pt-BR",
                            )}`
                          : " · ainda não conectado"}
                      </p>
                    </div>

                    {agent.active && (
                      <button
                        type="button"
                        onClick={() =>
                          revokeAgent(
                            agent.id,
                          )
                        }
                        className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700"
                      >
                        Revogar
                      </button>
                    )}
                  </div>
                ),
              )}

              {!data?.printAgents.length && (
                <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
                  Nenhum agente específico da
                  empresa ainda.
                </p>
              )}
            </div>
          </section>
        </>
      )}

      {organizationMessage && (
        <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
          {organizationMessage}
        </p>
      )}
    </div>
  )
}
