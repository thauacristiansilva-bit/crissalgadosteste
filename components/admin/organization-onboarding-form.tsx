"use client"

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useState,
} from "react"
import {
  useRouter,
} from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Building2,
  LoaderCircle,
} from "lucide-react"
import type { BillingSnapshot } from "@/lib/billing-types"
import type { CommercialRegistrationProfile } from "@/lib/commercial-registration"

export function OrganizationOnboardingForm({
  mode = "additional",
  initialBilling = null,
  initialRegistration = null,
}: {
  mode?: "first" | "additional"
  initialBilling?: BillingSnapshot | null
  initialRegistration?: CommercialRegistrationProfile | null
}) {
  const router = useRouter()
  const [personType, setPersonType] =
    useState<"PF" | "PJ">(initialRegistration?.companyPersonType || "PJ")
  const [document, setDocument] =
    useState(initialRegistration?.companyDocument || "")
  const [tradeName, setTradeName] =
    useState("")
  const [legalName, setLegalName] =
    useState("")
  const [industry, setIndustry] =
    useState("")
  const [phone, setPhone] =
    useState("")
  const [email, setEmail] =
    useState("")
  const [city, setCity] =
    useState("")
  const [state, setState] =
    useState("")
  const [busy, setBusy] =
    useState(false)
  const [error, setError] =
    useState("")
  const [billing, setBilling] =
    useState<BillingSnapshot | null>(initialBilling)

  useEffect(() => {
    if (initialBilling) return
    let mounted = true
    fetch("/api/admin/billing", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "Não foi possível validar o plano.")
        return payload.billing as BillingSnapshot
      })
      .then((value) => { if (mounted) setBilling(value) })
      .catch((reason) => {
        if (mounted) setError(reason instanceof Error ? reason.message : "Não foi possível validar o plano.")
      })
    return () => { mounted = false }
  }, [initialBilling])

  async function submit(
    event: FormEvent,
  ) {
    event.preventDefault()
    setBusy(true)
    setError("")

    try {
      const response = await fetch(
        "/api/admin/organizations",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            personType,
            document,
            tradeName,
            legalName,
            industry,
            phone,
            email,
            city,
            state,
          }),
        },
      )

      const payload =
        await response.json()

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Não foi possível criar a empresa.",
        )
      }

      router.replace(String(payload.onboardingUrl || "/onboarding"))
      router.refresh()
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Erro ao criar empresa.",
      )
    } finally {
      setBusy(false)
    }
  }

  const field =
    "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href={mode === "first" ? "/contratar/retorno" : "/admin"}
        className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-amber-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {mode === "first" ? "Voltar à contratação" : "Voltar ao painel"}
      </Link>

      <div className="mt-5 rounded-3xl border border-amber-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">
              SaborFlow
            </p>
            <h1 className="mt-1 text-2xl font-black text-gray-950">
              {mode === "first" ? "Configure sua primeira loja" : "Adicionar loja ao plano"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              {mode === "first"
                ? "Seu pagamento já foi confirmado. Crie a estrutura da primeira loja para iniciar a configuração comercial guiada."
                : "A nova loja terá dados, catálogo, clientes, pedidos e configurações isolados. A criação depende de assinatura ativa e de uma vaga disponível no seu plano."}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {billing && (
          <div className={`mt-5 rounded-xl border px-4 py-3 text-sm font-semibold ${billing.capacity.canCreateOrganization ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            Lojas utilizadas: {billing.usage.organizations} / {billing.entitlements.maxOrganizations === null ? "∞" : billing.entitlements.maxOrganizations}.
            {!billing.capacity.canCreateOrganization && " O limite atual foi atingido. Faça upgrade do plano antes de adicionar outra loja."}
          </div>
        )}

        {mode === "first" && initialRegistration && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <p className="font-black">Dados do cadastro reaproveitados</p>
            <p className="mt-1 text-xs leading-5">CPF do responsável terminado em <strong>{initialRegistration.responsibleCpfLast4 || "••••"}</strong>. {initialRegistration.companyPersonType === "PJ" && initialRegistration.companyDocument ? "O CNPJ informado no cadastro já foi preenchido abaixo." : "Como esta conta foi criada sem CNPJ, confirme o CPF da empresa individual abaixo."}</p>
          </div>
        )}

        <form
          onSubmit={submit}
          className="mt-7 grid gap-4 sm:grid-cols-2"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-gray-500">
              Tipo
            </span>
            <select
              value={personType}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setPersonType(
                  event.target.value ===
                    "PF"
                    ? "PF"
                    : "PJ",
                )
              }
              className={field}
            >
              <option value="PJ">
                Pessoa jurídica
              </option>
              <option value="PF">
                Empresa individual / PF
              </option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-gray-500">
              {personType === "PJ"
                ? "CNPJ"
                : "CPF da empresa individual"}
            </span>
            <input
              required
              value={document}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setDocument(
                  event.target.value,
                )
              }
              inputMode="numeric"
              className={field}
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-gray-500">
              Nome da empresa
            </span>
            <input
              required
              value={tradeName}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setTradeName(
                  event.target.value,
                )
              }
              className={field}
              placeholder="Nome exibido para clientes"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-gray-500">
              Razão social
            </span>
            <input
              value={legalName}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setLegalName(
                  event.target.value,
                )
              }
              className={field}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-gray-500">
              Segmento
            </span>
            <input
              value={industry}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setIndustry(
                  event.target.value,
                )
              }
              className={field}
              placeholder="Ex.: varejo, serviços, alimentação"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-gray-500">
              Telefone
            </span>
            <input
              value={phone}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setPhone(
                  event.target.value,
                )
              }
              className={field}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-gray-500">
              E-mail da empresa
            </span>
            <input
              type="email"
              value={email}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setEmail(
                  event.target.value,
                )
              }
              className={field}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-gray-500">
              Cidade
            </span>
            <input
              value={city}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setCity(
                  event.target.value,
                )
              }
              className={field}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-gray-500">
              UF
            </span>
            <input
              value={state}
              maxLength={2}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setState(
                  event.target.value
                    .toUpperCase(),
                )
              }
              className={field}
              placeholder="MA"
            />
          </label>

          <div className="sm:col-span-2">
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-950">
              Depois da criação, o SaborFlow abrirá um assistente para configurar dados comerciais, identidade visual, horários, retirada/entrega, produtos e publicação. A loja permanece privada até a etapa final.
            </div>

            <button
              type="submit"
              disabled={busy || (billing ? !billing.capacity.canCreateOrganization : false)}
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 text-sm font-black text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
            >
              {busy && (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              )}
              {busy
                ? "Criando loja..."
                : billing && !billing.capacity.canCreateOrganization
                  ? "Limite de lojas atingido"
                  : mode === "first" ? "Criar primeira loja e configurar" : "Criar loja e configurar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
