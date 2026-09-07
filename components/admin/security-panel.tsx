"use client"

import Script from "next/script"
import {
  browserSupportsWebAuthn,
  startRegistration,
} from "@simplewebauthn/browser"
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

type RoutingInstruction = {
  provider: "cloudflare_saas"
  hostnameId: string
  hostnameStatus: string | null
  sslStatus: string | null
  ready: boolean
  cnameTarget: string
  dnsRecords: Array<{
    type: "CNAME" | "TXT"
    name: string
    value: string
    purpose: "traffic" | "hostname_verification" | "ssl_validation"
    status: string | null
  }>
  errors: string[]
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

type TwoFactorSecurityStatus = {
  configured: boolean
  enabled: boolean
  recoveryCodesRemaining: number
  reconfigurationPending: boolean
  reconfigurationExpiresAt: string | null
}

type PasskeySummary = {
  id: string
  name: string
  deviceType: "singleDevice" | "multiDevice"
  backedUp: boolean
  createdAt: string
  lastUsedAt: string | null
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

function DnsCopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-bold uppercase text-amber-700">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-xs">{value}</code>
        <CopyButton value={value} />
      </div>
    </div>
  )
}

function RecoveryCodesBox({
  codes,
  title = "Códigos de recuperação",
}: {
  codes: string[]
  title?: string
}) {
  if (!codes.length) {
    return null
  }

  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-amber-950">
            {title}
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            Estes códigos aparecem somente agora. Cada código funciona uma única vez.
          </p>
        </div>
        <CopyButton
          value={codes.join("\n")}
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {codes.map((code) => (
          <code
            key={code}
            className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-center text-xs font-black tracking-wide text-amber-950"
          >
            {code}
          </code>
        ))}
      </div>
    </div>
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
    twoFactorStatus,
    setTwoFactorStatus,
  ] =
    useState<TwoFactorSecurityStatus | null>(
      null,
    )
  const [
    twoFactorMessage,
    setTwoFactorMessage,
  ] = useState("")
  const [
    twoFactorBusy,
    setTwoFactorBusy,
  ] = useState(false)
  const [
    recoveryVerifier,
    setRecoveryVerifier,
  ] = useState("")
  const [
    recoveryCodes,
    setRecoveryCodes,
  ] = useState<string[]>([])
  const [
    reconfigureVerifier,
    setReconfigureVerifier,
  ] = useState("")
  const [
    reconfigureManualKey,
    setReconfigureManualKey,
  ] = useState("")
  const [
    reconfigureExpiresAt,
    setReconfigureExpiresAt,
  ] = useState("")
  const [
    reconfigureQrUrl,
    setReconfigureQrUrl,
  ] = useState("")
  const [
    reconfigureNewCode,
    setReconfigureNewCode,
  ] = useState("")
  const [
    reconfigureRecoveryCodes,
    setReconfigureRecoveryCodes,
  ] = useState<string[]>([])


  const [
    passkeys,
    setPasskeys,
  ] = useState<PasskeySummary[]>([])

  const [
    passkeySupported,
    setPasskeySupported,
  ] = useState(true)

  const [
    passkeyBusy,
    setPasskeyBusy,
  ] = useState(false)

  const [
    passkeyMessage,
    setPasskeyMessage,
  ] = useState("")

  const [
    passkeyName,
    setPasskeyName,
  ] = useState("")

  const [
    passkeyVerifier,
    setPasskeyVerifier,
  ] = useState("")


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
    recordName?: string
    recordValue?: string
    routing?: RoutingInstruction | null
  } | null>(null)

  const storefrontRootDomain =
    process.env.NEXT_PUBLIC_STOREFRONT_ROOT_DOMAIN || ""

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

  async function reloadTwoFactor() {
    const response =
      await fetch(
        "/api/admin/2fa/security",
        {
          cache: "no-store",
        },
      ).catch(() => null)

    const result =
      await response
        ?.json()
        .catch(() => null)

    if (
      response?.ok &&
      result
    ) {
      setTwoFactorStatus(
        result,
      )
    }
  }

  async function reloadPasskeys() {
    const response =
      await fetch(
        "/api/admin/passkeys",
        {
          cache: "no-store",
        },
      ).catch(() => null)

    const result =
      await response
        ?.json()
        .catch(() => null)

    if (
      response?.ok &&
      Array.isArray(
        result?.passkeys,
      )
    ) {
      setPasskeys(
        result.passkeys,
      )
    }
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
    void reloadTwoFactor()
    void reloadPasskeys()

    setPasskeySupported(
      browserSupportsWebAuthn(),
    )
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

  async function generateNewRecoveryCodes() {
    setTwoFactorMessage("")
    setRecoveryCodes([])

    if (
      !/^\d{6}$/.test(
        recoveryVerifier.trim(),
      )
    ) {
      setTwoFactorMessage(
        "Informe o código de 6 dígitos do aplicativo autenticador.",
      )
      return
    }

    if (
      !window.confirm(
        "Gerar novos códigos de recuperação? Todos os códigos antigos deixarão de funcionar imediatamente.",
      )
    ) {
      return
    }

    setTwoFactorBusy(true)

    const response =
      await fetch(
        "/api/admin/2fa/recovery-codes",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            code:
              recoveryVerifier,
          }),
        },
      ).catch(() => null)

    const result =
      await response
        ?.json()
        .catch(() => null)

    setTwoFactorBusy(false)

    if (!response?.ok) {
      setTwoFactorMessage(
        result?.error ||
          "Não foi possível gerar novos códigos.",
      )
      return
    }

    const nextCodes =
      Array.isArray(
        result?.recoveryCodes,
      )
        ? result.recoveryCodes
        : []

    setRecoveryVerifier("")
    setRecoveryCodes(
      nextCodes,
    )
    setTwoFactorMessage(
      "Novos códigos gerados. Os códigos anteriores foram invalidados. Guarde estes novos códigos em local seguro.",
    )

    await reloadTwoFactor()
  }

  async function startAuthenticatorChange() {
    setTwoFactorMessage("")
    setReconfigureRecoveryCodes([])

    const code =
      reconfigureVerifier.trim()

    if (!code) {
      setTwoFactorMessage(
        "Informe o código atual do Authenticator ou um código de recuperação.",
      )
      return
    }

    setTwoFactorBusy(true)

    const response =
      await fetch(
        "/api/admin/2fa/reconfigure",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            code,
          }),
        },
      ).catch(() => null)

    const result =
      await response
        ?.json()
        .catch(() => null)

    setTwoFactorBusy(false)

    if (!response?.ok) {
      setTwoFactorMessage(
        result?.error ||
          "Não foi possível iniciar a troca do autenticador.",
      )
      return
    }

    setReconfigureVerifier("")
    setReconfigureManualKey(
      result?.manualKey || "",
    )
    setReconfigureExpiresAt(
      result?.expiresAt || "",
    )
    setReconfigureQrUrl(
      result?.qrUrl || "",
    )
    setReconfigureNewCode("")
    setTwoFactorMessage(
      "Novo Authenticator preparado. O autenticador atual continuará funcionando até você confirmar o novo.",
    )

    await reloadTwoFactor()
  }

  async function confirmAuthenticatorChange() {
    setTwoFactorMessage("")

    const code =
      reconfigureNewCode.trim()

    if (!/^\d{6}$/.test(code)) {
      setTwoFactorMessage(
        "Informe o código de 6 dígitos exibido no novo Authenticator.",
      )
      return
    }

    setTwoFactorBusy(true)

    const response =
      await fetch(
        "/api/admin/2fa/reconfigure",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            code,
          }),
        },
      ).catch(() => null)

    const result =
      await response
        ?.json()
        .catch(() => null)

    setTwoFactorBusy(false)

    if (!response?.ok) {
      setTwoFactorMessage(
        result?.error ||
          "Não foi possível confirmar o novo Authenticator.",
      )
      return
    }

    const nextCodes =
      Array.isArray(
        result?.recoveryCodes,
      )
        ? result.recoveryCodes
        : []

    setReconfigureNewCode("")
    setReconfigureManualKey("")
    setReconfigureExpiresAt("")
    setReconfigureQrUrl("")
    setReconfigureRecoveryCodes(
      nextCodes,
    )
    setRecoveryCodes([])
    setTwoFactorMessage(
      "Authenticator trocado com sucesso. O antigo não é mais válido. Guarde os novos códigos de recuperação.",
    )

    await reloadTwoFactor()
  }

  async function cancelAuthenticatorChange() {
    setTwoFactorBusy(true)

    const response =
      await fetch(
        "/api/admin/2fa/reconfigure",
        {
          method: "DELETE",
        },
      ).catch(() => null)

    setTwoFactorBusy(false)

    if (!response?.ok) {
      const result =
        await response
          ?.json()
          .catch(() => null)

      setTwoFactorMessage(
        result?.error ||
          "Não foi possível cancelar a troca.",
      )
      return
    }

    setReconfigureManualKey("")
    setReconfigureExpiresAt("")
    setReconfigureQrUrl("")
    setReconfigureNewCode("")
    setTwoFactorMessage(
      "Troca de Authenticator cancelada. O autenticador atual continua ativo.",
    )

    await reloadTwoFactor()
  }

  async function addPasskey() {
    setPasskeyMessage("")

    if (
      !browserSupportsWebAuthn()
    ) {
      setPasskeySupported(false)
      setPasskeyMessage(
        "Este navegador não oferece suporte a Passkeys/WebAuthn.",
      )
      return
    }

    const name =
      passkeyName
        .trim()
        .replace(/\s+/g, " ")

    const code =
      passkeyVerifier.trim()

    if (
      name.length < 2 ||
      name.length > 80
    ) {
      setPasskeyMessage(
        "Informe um nome de 2 a 80 caracteres para identificar esta Passkey.",
      )
      return
    }

    if (!code) {
      setPasskeyMessage(
        "Confirme com o código atual do Authenticator ou um código de recuperação.",
      )
      return
    }

    setPasskeyBusy(true)

    try {
      const optionsResponse =
        await fetch(
          "/api/admin/passkeys/register/options",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              name,
              code,
            }),
          },
        )

      const optionsData =
        await optionsResponse
          .json()
          .catch(() => null)

      if (!optionsResponse.ok) {
        throw new Error(
          optionsData?.error ||
            "Não foi possível preparar a Passkey.",
        )
      }

      const registrationResponse =
        await startRegistration({
          optionsJSON:
            optionsData.options,
        })

      const verifyResponse =
        await fetch(
          "/api/admin/passkeys/register/verify",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              response:
                registrationResponse,
            }),
          },
        )

      const verifyData =
        await verifyResponse
          .json()
          .catch(() => null)

      if (!verifyResponse.ok) {
        throw new Error(
          verifyData?.error ||
            "Não foi possível confirmar a Passkey.",
        )
      }

      setPasskeyName("")
      setPasskeyVerifier("")
      setPasskeyMessage(
        "Passkey cadastrada com sucesso. Ela já pode ser usada como segundo fator no próximo login.",
      )

      await reloadPasskeys()
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Não foi possível cadastrar a Passkey."

      setPasskeyMessage(
        message.includes(
          "The operation either timed out or was not allowed",
        ) ||
          message.includes(
            "NotAllowedError",
          )
          ? "O cadastro da Passkey foi cancelado ou expirou."
          : message,
      )
    } finally {
      setPasskeyBusy(false)
    }
  }

  async function removePasskey(
    credentialId: string,
    name: string,
  ) {
    setPasskeyMessage("")

    const code =
      passkeyVerifier.trim()

    if (!code) {
      setPasskeyMessage(
        "Informe o código atual do Authenticator ou um código de recuperação antes de remover uma Passkey.",
      )
      return
    }

    if (
      !window.confirm(
        `Remover a Passkey "${name}" desta conta?`,
      )
    ) {
      return
    }

    setPasskeyBusy(true)

    try {
      const response =
        await fetch(
          "/api/admin/passkeys",
          {
            method: "DELETE",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              credentialId,
              code,
            }),
          },
        )

      const result =
        await response
          .json()
          .catch(() => null)

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Não foi possível remover a Passkey.",
        )
      }

      setPasskeyVerifier("")
      setPasskeyMessage(
        "Passkey removida. Ela não pode mais ser usada no login.",
      )

      await reloadPasskeys()
    } catch (err) {
      setPasskeyMessage(
        err instanceof Error
          ? err.message
          : "Não foi possível remover a Passkey.",
      )
    } finally {
      setPasskeyBusy(false)
    }
  }

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
      "Domínio cadastrado no SaborFlow e no Cloudflare for SaaS. Configure os registros DNS exibidos abaixo e depois clique em Verificar.",
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

    setVerification({
      domain: value,
      routing: result.routing || null,
    })
    setOrganizationMessage(
      result.routing?.ready
        ? "Domínio verificado e Cloudflare/SSL prontos."
        : "Domínio verificado no SaborFlow. O Cloudflare ainda está validando DNS/SSL.",
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-black">
              Autenticação em duas etapas
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              O 2FA protege sua conta com o aplicativo autenticador. Não existe botão de desativação simples: alterações sensíveis exigem uma nova confirmação.
            </p>
          </div>

          <div
            className={
              twoFactorStatus?.enabled
                ? "w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700"
                : "w-fit rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800"
            }
          >
            {twoFactorStatus?.enabled
              ? "2FA ativo"
              : "2FA não confirmado"}
          </div>
        </div>

        {twoFactorStatus?.enabled ? (
          <>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 p-4">
                <h3 className="text-sm font-black text-gray-950">
                  Códigos de recuperação
                </h3>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Restam <strong>{twoFactorStatus.recoveryCodesRemaining}</strong> código(s). Gere novos códigos somente se perdeu os antigos ou acredita que foram expostos.
                </p>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="Código atual de 6 dígitos"
                    value={recoveryVerifier}
                    onChange={(event) =>
                      setRecoveryVerifier(
                        event.target.value.replace(/\D/g, "").slice(0, 6),
                      )
                    }
                    className="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 px-3 text-sm"
                  />
                  <button
                    type="button"
                    disabled={twoFactorBusy}
                    onClick={generateNewRecoveryCodes}
                    className="h-11 rounded-xl bg-[#2f1c13] px-4 text-sm font-black text-white disabled:opacity-60"
                  >
                    Gerar novos códigos
                  </button>
                </div>

                <p className="mt-2 text-xs leading-5 text-gray-500">
                  Por segurança, esta ação exige um código novo do Authenticator. Os códigos antigos são invalidados imediatamente.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 p-4">
                <h3 className="text-sm font-black text-gray-950">
                  Trocar Authenticator
                </h3>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Use esta opção ao trocar ou perder o celular. O autenticador atual continua válido até a confirmação do novo.
                </p>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    autoComplete="one-time-code"
                    placeholder="Código atual ou de recuperação"
                    value={reconfigureVerifier}
                    onChange={(event) =>
                      setReconfigureVerifier(
                        event.target.value,
                      )
                    }
                    className="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 px-3 text-sm"
                  />
                  <button
                    type="button"
                    disabled={twoFactorBusy}
                    onClick={startAuthenticatorChange}
                    className="h-11 rounded-xl border border-gray-300 px-4 text-sm font-black text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Preparar troca
                  </button>
                </div>

                <p className="mt-2 text-xs leading-5 text-gray-500">
                  Se você perdeu o celular, pode usar um dos seus códigos de recuperação para autorizar esta troca.
                </p>
              </div>
            </div>

            {twoFactorStatus.reconfigurationPending &&
              !reconfigureManualKey && (
                <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-amber-950">
                      Existe uma troca de Authenticator pendente.
                    </p>
                    <p className="mt-1 text-xs leading-5 text-amber-900">
                      Para continuar, autorize novamente com o código atual. Se você não iniciou a troca, cancele agora.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={twoFactorBusy}
                    onClick={cancelAuthenticatorChange}
                    className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-black text-amber-900 disabled:opacity-60"
                  >
                    Cancelar troca pendente
                  </button>
                </div>
              )}

            <RecoveryCodesBox
              codes={recoveryCodes}
              title="Novos códigos de recuperação"
            />

            {reconfigureManualKey && (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-blue-950">
                      Configure o novo Authenticator
                    </p>
                    <p className="mt-1 text-xs leading-5 text-blue-900">
                      Escaneie o QR Code abaixo com o novo celular. O autenticador antigo só será substituído depois da confirmação.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={twoFactorBusy}
                    onClick={cancelAuthenticatorChange}
                    className="rounded-xl border border-blue-300 bg-white px-3 py-2 text-xs font-black text-blue-900 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[280px_1fr] md:items-start">
                  <div className="overflow-hidden rounded-2xl border border-blue-200 bg-white p-3">
                    {reconfigureQrUrl && (
                      <img
                        src={reconfigureQrUrl}
                        alt="QR Code do novo Authenticator"
                        width={280}
                        height={280}
                        className="h-auto w-full"
                      />
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase text-blue-800">
                      Chave manual
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="min-w-0 flex-1 break-all rounded-xl bg-white px-3 py-3 text-xs font-black text-blue-950">
                        {reconfigureManualKey}
                      </code>
                      <CopyButton
                        value={reconfigureManualKey.replace(/\s+/g, "")}
                      />
                    </div>

                    {reconfigureExpiresAt && (
                      <p className="mt-2 text-xs text-blue-800">
                        Esta troca expira às{" "}
                        <strong>
                          {new Date(
                            reconfigureExpiresAt,
                          ).toLocaleTimeString(
                            "pt-BR",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </strong>.
                      </p>
                    )}

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder="Código do novo Authenticator"
                        value={reconfigureNewCode}
                        onChange={(event) =>
                          setReconfigureNewCode(
                            event.target.value.replace(/\D/g, "").slice(0, 6),
                          )
                        }
                        className="h-11 min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-3 text-sm"
                      />
                      <button
                        type="button"
                        disabled={twoFactorBusy}
                        onClick={confirmAuthenticatorChange}
                        className="h-11 rounded-xl bg-blue-700 px-4 text-sm font-black text-white disabled:opacity-60"
                      >
                        Confirmar novo Authenticator
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <RecoveryCodesBox
              codes={reconfigureRecoveryCodes}
              title="Novos códigos após a troca"
            />
          </>
        ) : (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            O 2FA ainda não está confirmado nesta conta. Saia e entre novamente para concluir a ativação obrigatória.
          </div>
        )}

        {twoFactorMessage && (
          <p className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
            {twoFactorMessage}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-black">
              Passkeys e chaves de segurança
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Cadastre Windows Hello, biometria do celular, Passkeys sincronizadas ou uma chave física FIDO2. No login, elas podem substituir o código de 6 dígitos como segundo fator.
            </p>
          </div>

          <span className="w-fit rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">
            {passkeys.length} cadastrada(s)
          </span>
        </div>

        {!passkeySupported ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            Este navegador ou dispositivo não oferece suporte a Passkeys/WebAuthn. Você pode continuar usando o Authenticator normalmente.
          </div>
        ) : !twoFactorStatus?.enabled ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            Conclua primeiro a ativação obrigatória do 2FA para cadastrar Passkeys.
          </div>
        ) : (
          <>
            <div className="mt-5 rounded-2xl border border-gray-200 p-4">
              <h3 className="text-sm font-black text-gray-950">
                Adicionar uma Passkey
              </h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                A confirmação abaixo protege o cadastro de novas chaves. Se acabou de usar um código do Authenticator, aguarde o próximo código antes de confirmar.
              </p>

              <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
                <input
                  type="text"
                  maxLength={80}
                  placeholder="Nome, ex.: Notebook principal"
                  value={passkeyName}
                  onChange={(event) =>
                    setPasskeyName(
                      event.target.value,
                    )
                  }
                  className="h-11 min-w-0 rounded-xl border border-gray-200 px-3 text-sm"
                />

                <input
                  type="text"
                  autoComplete="one-time-code"
                  placeholder="Código atual ou de recuperação"
                  value={passkeyVerifier}
                  onChange={(event) =>
                    setPasskeyVerifier(
                      event.target.value,
                    )
                  }
                  className="h-11 min-w-0 rounded-xl border border-gray-200 px-3 text-sm"
                />

                <button
                  type="button"
                  disabled={passkeyBusy}
                  onClick={() =>
                    void addPasskey()
                  }
                  className="h-11 rounded-xl bg-blue-700 px-4 text-sm font-black text-white disabled:opacity-60"
                >
                  {passkeyBusy
                    ? "Aguarde..."
                    : "Adicionar Passkey"}
                </button>
              </div>

              <p className="mt-2 text-xs leading-5 text-gray-500">
                A chave privada fica protegida no seu dispositivo ou chave física. O SaborFlow armazena somente a credencial pública necessária para verificar o login.
              </p>
            </div>

            <div className="mt-4 space-y-2">
              {passkeys.map(
                (passkey) => (
                  <div
                    key={passkey.id}
                    className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-gray-950">
                        {passkey.name}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        Cadastrada em{" "}
                        {new Date(
                          passkey.createdAt,
                        ).toLocaleString(
                          "pt-BR",
                        )}
                        {" · "}
                        {passkey.backedUp ||
                        passkey.deviceType ===
                          "multiDevice"
                          ? "Passkey sincronizável"
                          : "Dispositivo/chave física"}
                        {passkey.lastUsedAt
                          ? ` · último uso ${new Date(
                              passkey.lastUsedAt,
                            ).toLocaleString(
                              "pt-BR",
                            )}`
                          : " · ainda não utilizada"}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={passkeyBusy}
                      onClick={() =>
                        void removePasskey(
                          passkey.id,
                          passkey.name,
                        )
                      }
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-60"
                    >
                      Remover
                    </button>
                  </div>
                ),
              )}

              {!passkeys.length && (
                <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
                  Nenhuma Passkey ou chave de segurança cadastrada ainda.
                </p>
              )}
            </div>
          </>
        )}

        {passkeyMessage && (
          <p className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
            {passkeyMessage}
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
              O SaborFlow cadastra o domínio automaticamente no Cloudflare for SaaS,
              prepara o SSL e informa exatamente quais registros DNS o cliente deve criar.
            </p>

            {storefrontRootDomain && data?.organization?.slug && (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs font-bold uppercase text-blue-700">Subdomínio automático SaborFlow</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-xs">
                    {`https://${data.organization.slug}.${storefrontRootDomain}`}
                  </code>
                  <CopyButton value={`https://${data.organization.slug}.${storefrontRootDomain}`} />
                </div>
                <p className="mt-2 text-xs text-blue-800">
                  Esse endereço usa o slug da empresa e funciona pelo wildcard da plataforma, sem cadastrar cada loja individualmente.
                </p>
              </div>
            )}

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
              <div className="mt-4 space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                {verification.recordName && verification.recordValue && (
                  <div className="space-y-3">
                    <p className="text-sm font-black text-amber-900">1. Verificação de propriedade do SaborFlow</p>
                    <DnsCopyRow label="TXT — Nome" value={verification.recordName} />
                    <DnsCopyRow label="TXT — Valor" value={verification.recordValue} />
                  </div>
                )}

                {verification.routing && (
                  <div className="space-y-3 border-t border-amber-200 pt-4">
                    <p className="text-sm font-black text-amber-900">2. Roteamento e SSL automáticos — Cloudflare for SaaS</p>
                    {verification.routing.dnsRecords.map((record, index) => (
                      <div key={`${record.name}-${record.value}-${index}`} className="rounded-xl border border-amber-200 bg-white/70 p-3">
                        <p className="mb-2 text-xs font-black text-amber-800">
                          {record.purpose === "traffic"
                            ? "Tráfego da loja"
                            : record.purpose === "hostname_verification"
                              ? "Validação do hostname"
                              : "Validação do certificado SSL"}
                        </p>
                        <DnsCopyRow label={`${record.type} — Nome`} value={record.name} />
                        <div className="mt-2"><DnsCopyRow label={`${record.type} — Valor`} value={record.value} /></div>
                        {record.status && <p className="mt-2 text-xs text-amber-800">Status Cloudflare: {record.status}</p>}
                      </div>
                    ))}
                    <div className="rounded-xl border border-amber-200 bg-white/70 p-3 text-xs text-amber-900">
                      <p><strong>Hostname:</strong> {verification.routing.hostnameStatus || "aguardando"}</p>
                      <p className="mt-1"><strong>SSL:</strong> {verification.routing.sslStatus || "aguardando"}</p>
                    </div>
                    {verification.routing.errors.length > 0 && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
                        {verification.routing.errors.join(" • ")}
                      </div>
                    )}
                    <p className={verification.routing.ready ? "text-xs font-bold text-emerald-700" : "text-xs font-bold text-amber-800"}>
                      {verification.routing.ready
                        ? "Cloudflare: hostname e certificado SSL ativos."
                        : "Cloudflare: aguardando propagação/validação. Clique em Verificar novamente após o DNS propagar."}
                    </p>
                  </div>
                )}
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

                    <button
                      type="button"
                      onClick={() => verifyDomain(item.domain)}
                      className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white"
                    >
                      {item.verified ? "Atualizar Cloudflare/SSL" : "Verificar"}
                    </button>

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
