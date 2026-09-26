"use client"

import {
  useState,
} from "react"

import {
  Bot,
  Keyboard,
  MessageCircle,
  Mic,
  Monitor,
  Save,
  ShoppingCart,
  Sparkles,
} from "lucide-react"

import type {
  StoreSettings,
} from "@/lib/types"

type Draft = {
  chatbotEnabled: boolean

  aiStorefrontChatEnabled: boolean
  aiStorefrontTextEnabled: boolean
  aiStorefrontAudioEnabled: boolean
  aiFloatingButtonEnabled: boolean

  aiPdvEnabled: boolean
  aiPdvTextEnabled: boolean
  aiPdvAudioEnabled: boolean

  whatsappAiEnabled: boolean
  whatsappAutoServiceEnabled: boolean
  whatsappOrdersEnabled: boolean
  whatsappConfirmationsEnabled: boolean
  whatsappHumanHandoffEnabled: boolean

  chatbotGreeting: string
  aiBusinessDescription: string
  aiServiceInstructions: string
  aiServiceTone: "friendly" | "formal" | "informal"
  aiMenuUrl: string
  aiCheckoutUrl: string
  aiPaymentUrl: string
}

function draftFromSettings(
  settings: StoreSettings,
): Draft {
  return {
    chatbotEnabled:
      Boolean(
        settings.chatbotEnabled,
      ),

    aiStorefrontChatEnabled:
      settings.aiStorefrontChatEnabled !==
      false,

    aiStorefrontTextEnabled:
      settings.aiStorefrontTextEnabled !==
      false,

    aiStorefrontAudioEnabled:
      settings.aiStorefrontAudioEnabled !==
      false,

    aiFloatingButtonEnabled:
      settings.aiFloatingButtonEnabled !==
      false,

    aiPdvEnabled:
      Boolean(
        settings.aiPdvEnabled,
      ),

    aiPdvTextEnabled:
      settings.aiPdvTextEnabled !==
      false,

    aiPdvAudioEnabled:
      settings.aiPdvAudioEnabled !==
      false,

    whatsappAiEnabled:
      Boolean(
        settings.whatsappAiEnabled,
      ),

    whatsappAutoServiceEnabled:
      Boolean(
        settings.whatsappAutoServiceEnabled,
      ),

    whatsappOrdersEnabled:
      Boolean(
        settings.whatsappOrdersEnabled,
      ),

    whatsappConfirmationsEnabled:
      Boolean(
        settings.whatsappConfirmationsEnabled,
      ),

    whatsappHumanHandoffEnabled:
      settings.whatsappHumanHandoffEnabled !==
      false,

    chatbotGreeting:
      settings.chatbotGreeting ||
      "Olá! Como posso ajudar com seu pedido?",
    aiBusinessDescription: settings.aiBusinessDescription || "",
    aiServiceInstructions: settings.aiServiceInstructions || "",
    aiServiceTone: settings.aiServiceTone || "friendly",
    aiMenuUrl: settings.aiMenuUrl || "",
    aiCheckoutUrl: settings.aiCheckoutUrl || "",
    aiPaymentUrl: settings.aiPaymentUrl || "",
  }
}

function Toggle({
  checked,
  disabled = false,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (
    checked: boolean,
  ) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() =>
        onChange(!checked)
      }
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${
        checked
          ? "bg-emerald-500"
          : "bg-gray-300"
      } ${
        disabled
          ? "cursor-not-allowed opacity-40"
          : ""
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked
            ? "left-6"
            : "left-1"
        }`}
      />
    </button>
  )
}

function SettingRow({
  title,
  description,
  checked,
  disabled,
  onChange,
  icon,
}: {
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (
    checked: boolean,
  ) => void
  icon?: React.ReactNode
}) {
  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border p-4 transition ${
        checked
          ? "border-emerald-200 bg-emerald-50/40"
          : "border-gray-200 bg-white"
      }`}
    >
      {icon && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
          {icon}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <strong className="block text-sm text-gray-950">
          {title}
        </strong>

        <p className="mt-0.5 text-xs leading-5 text-gray-500">
          {description}
        </p>
      </div>

      <Toggle
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  )
}

export function ChatbotPanel({
  settings,
  onSettingsChanged,
}: {
  settings: StoreSettings
  onSettingsChanged: (
    settings: StoreSettings,
  ) => void
}) {
  const [draft, setDraft] =
    useState<Draft>(
      () =>
        draftFromSettings(
          settings,
        ),
    )

  const [busy, setBusy] =
    useState(false)

  const [message, setMessage] =
    useState("")

  function patch(
    value: Partial<Draft>,
  ) {
    setDraft(
      (current) => ({
        ...current,
        ...value,
      }),
    )
  }

  async function save() {
    setBusy(true)
    setMessage("")

    try {
      const response =
        await fetch(
          "/api/settings",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                draft,
              ),
          },
        )

      const data =
        (await response.json()) as {
          settings?: StoreSettings
          error?: string
        }

      if (
        !response.ok ||
        !data.settings
      ) {
        throw new Error(
          data.error ||
            "Não foi possível salvar as configurações.",
        )
      }

      onSettingsChanged(
        data.settings,
      )

      setDraft(
        draftFromSettings(
          data.settings,
        ),
      )

      setMessage(
        "Configurações de IA e automações salvas.",
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Erro ao salvar.",
      )
    } finally {
      setBusy(false)
    }
  }

  const masterDisabled =
    !draft.chatbotEnabled

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-orange-50 shadow-sm">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200">
              <Sparkles className="h-7 w-7" />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">
                SaborFlow IA
              </p>

              <h2 className="mt-1 text-2xl font-black text-gray-950">
                IA e Automações
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
                Controle em um único lugar como a inteligência artificial será usada no cardápio, no PDV e no WhatsApp.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="text-xs font-black text-gray-900">
                IA da empresa
              </p>

              <p className="text-[11px] text-gray-500">
                Controle principal
              </p>
            </div>

            <Toggle
              checked={
                draft.chatbotEnabled
              }
              onChange={(
                value,
              ) =>
                patch({
                  chatbotEnabled:
                    value,
                })
              }
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-violet-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-black">Como a IA deve atender?</h3>
        <p className="mt-1 text-sm text-gray-600">Descreva seu negócio e o que a equipe costuma responder. Serve para loja, curso ou consultoria.</p>
        <div className="mt-4 grid gap-4">
          <label className="text-sm font-bold">Sobre a empresa<textarea rows={3} maxLength={2400} value={draft.aiBusinessDescription} onChange={event => patch({ aiBusinessDescription: event.target.value })} placeholder="Ex.: Vendemos salgados para festas, aceitamos encomendas e fazemos entregas..." className="mt-1 w-full rounded-xl border p-3 font-normal" /></label>
          <label className="text-sm font-bold">Jeito de falar<select value={draft.aiServiceTone} onChange={event => patch({ aiServiceTone: event.target.value as Draft["aiServiceTone"] })} className="mt-1 w-full rounded-xl border p-3 font-normal"><option value="friendly">Gentil e direto</option><option value="informal">Mais informal</option><option value="formal">Mais formal</option></select></label>
          <label className="text-sm font-bold">Regras de atendimento<textarea rows={3} maxLength={2400} value={draft.aiServiceInstructions} onChange={event => patch({ aiServiceInstructions: event.target.value })} placeholder="Ex.: Sempre explique o prazo antes de sugerir encomendas. Para dúvidas de pagamento, chame uma pessoa." className="mt-1 w-full rounded-xl border p-3 font-normal" /></label>
          <div className="grid gap-3 md:grid-cols-3">{([
            ["aiMenuUrl", "Link do catálogo/cardápio"], ["aiCheckoutUrl", "Link para fazer pedido"], ["aiPaymentUrl", "Link oficial de pagamento"],
          ] as const).map(([field, label]) => <label key={field} className="text-sm font-bold">{label}<input type="url" value={draft[field]} onChange={event => patch({ [field]: event.target.value })} placeholder="https://..." className="mt-1 w-full rounded-xl border p-3 font-normal" /></label>)}</div>
          <p className="text-xs text-amber-800">Informe apenas links reais da sua empresa. A IA pode compartilhá-los; ela não cria pedidos nem confirma pagamentos pela conversa.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-xl bg-orange-50 p-2.5 text-orange-600">
            <Bot className="h-5 w-5" />
          </div>

          <div>
            <h3 className="font-black text-gray-950">
              Assistente do cardápio
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Configura o chatbot que aparece para o cliente na loja.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <SettingRow
            title="Chatbot no cardápio"
            description="Permite que o cliente abra o assistente da loja."
            checked={
              draft.aiStorefrontChatEnabled
            }
            disabled={
              masterDisabled
            }
            icon={
              <Bot className="h-5 w-5" />
            }
            onChange={(
              value,
            ) =>
              patch({
                aiStorefrontChatEnabled:
                  value,
              })
            }
          />

          <SettingRow
            title="Pedido por texto"
            description="Cliente pode escrever o pedido para a IA interpretar."
            checked={
              draft.aiStorefrontTextEnabled
            }
            disabled={
              masterDisabled
            }
            icon={
              <Keyboard className="h-5 w-5" />
            }
            onChange={(
              value,
            ) =>
              patch({
                aiStorefrontTextEnabled:
                  value,
              })
            }
          />

          <SettingRow
            title="Pedido por áudio"
            description="Cliente pode falar o pedido usando o microfone."
            checked={
              draft.aiStorefrontAudioEnabled
            }
            disabled={
              masterDisabled
            }
            icon={
              <Mic className="h-5 w-5" />
            }
            onChange={(
              value,
            ) =>
              patch({
                aiStorefrontAudioEnabled:
                  value,
              })
            }
          />

          <SettingRow
            title="Botão flutuante"
            description="Mostra o ícone do robô no canto do cardápio."
            checked={
              draft.aiFloatingButtonEnabled
            }
            disabled={
              masterDisabled
            }
            icon={
              <Sparkles className="h-5 w-5" />
            }
            onChange={(
              value,
            ) =>
              patch({
                aiFloatingButtonEnabled:
                  value,
              })
            }
          />
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-black uppercase tracking-wide text-gray-500">
            Saudação do assistente
          </span>

          <textarea
            value={
              draft.chatbotGreeting
            }
            onChange={(
              event,
            ) =>
              patch({
                chatbotGreeting:
                  event.target.value,
              })
            }
            maxLength={500}
            rows={3}
            className="mt-2 w-full resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
            placeholder="Olá! Como posso ajudar com seu pedido?"
          />
        </label>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
            <Monitor className="h-5 w-5" />
          </div>

          <div>
            <h3 className="font-black text-gray-950">
              IA no Caixa / PDV
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Funcionário poderá lançar pedidos digitando ou falando.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <SettingRow
            title="IA no PDV"
            description="Habilita os recursos inteligentes na tela do caixa."
            checked={
              draft.aiPdvEnabled
            }
            disabled={
              masterDisabled
            }
            icon={
              <ShoppingCart className="h-5 w-5" />
            }
            onChange={(
              value,
            ) =>
              patch({
                aiPdvEnabled:
                  value,
              })
            }
          />

          <SettingRow
            title="Texto no PDV"
            description="Funcionário pode digitar o pedido rapidamente."
            checked={
              draft.aiPdvTextEnabled
            }
            disabled={
              masterDisabled ||
              !draft.aiPdvEnabled
            }
            icon={
              <Keyboard className="h-5 w-5" />
            }
            onChange={(
              value,
            ) =>
              patch({
                aiPdvTextEnabled:
                  value,
              })
            }
          />

          <SettingRow
            title="Áudio no PDV"
            description="Funcionário pode falar o pedido no caixa."
            checked={
              draft.aiPdvAudioEnabled
            }
            disabled={
              masterDisabled ||
              !draft.aiPdvEnabled
            }
            icon={
              <Mic className="h-5 w-5" />
            }
            onChange={(
              value,
            ) =>
              patch({
                aiPdvAudioEnabled:
                  value,
              })
            }
          />
        </div>

        <p className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
          A integração do pedido por texto e áudio diretamente no carrinho do PDV será conectada na Etapa 14.10.
        </p>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
            <MessageCircle className="h-5 w-5" />
          </div>

          <div>
            <h3 className="font-black text-gray-950">
              WhatsApp IA
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Prepare como o atendimento automático da empresa funcionará.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <SettingRow
            title="WhatsApp com IA"
            description="Controle principal da automação pelo WhatsApp."
            checked={
              draft.whatsappAiEnabled
            }
            disabled={
              masterDisabled
            }
            icon={
              <MessageCircle className="h-5 w-5" />
            }
            onChange={(
              value,
            ) =>
              patch({
                whatsappAiEnabled:
                  value,
              })
            }
          />

          <SettingRow
            title="Atendimento automático"
            description="IA poderá iniciar e continuar conversas automaticamente."
            checked={
              draft.whatsappAutoServiceEnabled
            }
            disabled={
              masterDisabled ||
              !draft.whatsappAiEnabled
            }
            icon={
              <Bot className="h-5 w-5" />
            }
            onChange={(
              value,
            ) =>
              patch({
                whatsappAutoServiceEnabled:
                  value,
              })
            }
          />

        </div>

        <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          O cliente configura o WhatsApp em “Conectar serviços”. O robô atende dúvidas em texto; a compra e o pagamento continuam no site. Para pedir uma pessoa, o cliente pode escrever “atendente”.
        </p>
      </section>

      <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div>
          {message ? (
            <p className="text-sm font-bold text-gray-700">
              {message}
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              As configurações são individuais para esta empresa.
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void save()
          }
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gray-950 px-5 text-sm font-black text-white disabled:opacity-50"
        >
          <Save className="h-4 w-4" />

          {busy
            ? "Salvando..."
            : "Salvar IA e automações"}
        </button>
      </div>
    </div>
  )
}
