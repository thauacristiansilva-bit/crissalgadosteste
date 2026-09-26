const fs = require("fs");

const UTF8 = "utf8";

function read(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Arquivo nao encontrado: ${file}`);
  }

  return fs.readFileSync(file, UTF8);
}

function write(file, content) {
  fs.writeFileSync(file, content, UTF8);
}

function backup(file) {
  fs.copyFileSync(
    file,
    `${file}.bak147`
  );
}

function replaceRequired(
  content,
  search,
  replacement,
  description
) {
  if (!content.includes(search)) {
    throw new Error(
      `Ponto nao encontrado: ${description}`
    );
  }

  return content.replace(
    search,
    replacement
  );
}

const typesFile =
  "lib/types.ts";

const organizationFile =
  "lib/organization-db.ts";

const panelFile =
  "components/admin/chatbot-panel.tsx";

const storeChatbotFile =
  "components/store/store-chatbot.tsx";

const dashboardFile =
  "components/admin/admin-dashboard.tsx";

[
  typesFile,
  organizationFile,
  panelFile,
  storeChatbotFile,
  dashboardFile,
].forEach(backup);

// ============================================================
// 1. STORE SETTINGS
// ============================================================

let types = read(typesFile);

if (
  !types.includes(
    "aiStorefrontChatEnabled?: boolean"
  )
) {
  const anchor = `  chatbotGreeting: string
  cashRegisterEnabled: boolean`;

  const replacement = `  chatbotGreeting: string

  /** Central de IA e automacoes. */
  aiStorefrontChatEnabled?: boolean
  aiStorefrontTextEnabled?: boolean
  aiStorefrontAudioEnabled?: boolean
  aiFloatingButtonEnabled?: boolean

  /** IA operacional do caixa / PDV. */
  aiPdvEnabled?: boolean
  aiPdvTextEnabled?: boolean
  aiPdvAudioEnabled?: boolean

  /** Automacao futura do WhatsApp. */
  whatsappAiEnabled?: boolean
  whatsappAutoServiceEnabled?: boolean
  whatsappOrdersEnabled?: boolean
  whatsappConfirmationsEnabled?: boolean
  whatsappHumanHandoffEnabled?: boolean

  cashRegisterEnabled: boolean`;

  types = replaceRequired(
    types,
    anchor,
    replacement,
    "StoreSettings chatbotGreeting"
  );
}

write(typesFile, types);

// ============================================================
// 2. DEFAULTS AO CARREGAR CONFIGURACOES DA EMPRESA
// ============================================================

let organization =
  read(organizationFile);

if (
  !organization.includes(
    "aiStorefrontChatEnabled:"
  )
) {
  const anchor = `    deliveryTrackingEnabled: settings.deliveryTrackingEnabled !== false,
`;

  const replacement = `    deliveryTrackingEnabled: settings.deliveryTrackingEnabled !== false,

    // Central IA / automacoes.
    chatbotEnabled:
      settings.chatbotEnabled === true,

    aiStorefrontChatEnabled:
      settings.aiStorefrontChatEnabled !== false,

    aiStorefrontTextEnabled:
      settings.aiStorefrontTextEnabled !== false,

    aiStorefrontAudioEnabled:
      settings.aiStorefrontAudioEnabled !== false,

    aiFloatingButtonEnabled:
      settings.aiFloatingButtonEnabled !== false,

    aiPdvEnabled:
      settings.aiPdvEnabled === true,

    aiPdvTextEnabled:
      settings.aiPdvTextEnabled !== false,

    aiPdvAudioEnabled:
      settings.aiPdvAudioEnabled !== false,

    whatsappAiEnabled:
      settings.whatsappAiEnabled === true,

    whatsappAutoServiceEnabled:
      settings.whatsappAutoServiceEnabled === true,

    whatsappOrdersEnabled:
      settings.whatsappOrdersEnabled === true,

    whatsappConfirmationsEnabled:
      settings.whatsappConfirmationsEnabled === true,

    whatsappHumanHandoffEnabled:
      settings.whatsappHumanHandoffEnabled !== false,
`;

  organization = replaceRequired(
    organization,
    anchor,
    replacement,
    "defaults de getTenantSettings"
  );
}

// ============================================================
// 3. NORMALIZACAO / SEGURANCA DO PATCH
// ============================================================

if (
  !organization.includes(
    "patch.aiStorefrontChatEnabled !== undefined"
  )
) {
  const anchor =
`    deliveryPricingMode: [`;

  const replacement =
`    chatbotEnabled:
      patch.chatbotEnabled !== undefined
        ? Boolean(patch.chatbotEnabled)
        : current.chatbotEnabled,

    chatbotGreeting:
      patch.chatbotGreeting !== undefined
        ? String(patch.chatbotGreeting)
            .trim()
            .slice(0, 500)
        : current.chatbotGreeting,

    aiStorefrontChatEnabled:
      patch.aiStorefrontChatEnabled !== undefined
        ? Boolean(patch.aiStorefrontChatEnabled)
        : current.aiStorefrontChatEnabled,

    aiStorefrontTextEnabled:
      patch.aiStorefrontTextEnabled !== undefined
        ? Boolean(patch.aiStorefrontTextEnabled)
        : current.aiStorefrontTextEnabled,

    aiStorefrontAudioEnabled:
      patch.aiStorefrontAudioEnabled !== undefined
        ? Boolean(patch.aiStorefrontAudioEnabled)
        : current.aiStorefrontAudioEnabled,

    aiFloatingButtonEnabled:
      patch.aiFloatingButtonEnabled !== undefined
        ? Boolean(patch.aiFloatingButtonEnabled)
        : current.aiFloatingButtonEnabled,

    aiPdvEnabled:
      patch.aiPdvEnabled !== undefined
        ? Boolean(patch.aiPdvEnabled)
        : current.aiPdvEnabled,

    aiPdvTextEnabled:
      patch.aiPdvTextEnabled !== undefined
        ? Boolean(patch.aiPdvTextEnabled)
        : current.aiPdvTextEnabled,

    aiPdvAudioEnabled:
      patch.aiPdvAudioEnabled !== undefined
        ? Boolean(patch.aiPdvAudioEnabled)
        : current.aiPdvAudioEnabled,

    whatsappAiEnabled:
      patch.whatsappAiEnabled !== undefined
        ? Boolean(patch.whatsappAiEnabled)
        : current.whatsappAiEnabled,

    whatsappAutoServiceEnabled:
      patch.whatsappAutoServiceEnabled !== undefined
        ? Boolean(patch.whatsappAutoServiceEnabled)
        : current.whatsappAutoServiceEnabled,

    whatsappOrdersEnabled:
      patch.whatsappOrdersEnabled !== undefined
        ? Boolean(patch.whatsappOrdersEnabled)
        : current.whatsappOrdersEnabled,

    whatsappConfirmationsEnabled:
      patch.whatsappConfirmationsEnabled !== undefined
        ? Boolean(patch.whatsappConfirmationsEnabled)
        : current.whatsappConfirmationsEnabled,

    whatsappHumanHandoffEnabled:
      patch.whatsappHumanHandoffEnabled !== undefined
        ? Boolean(patch.whatsappHumanHandoffEnabled)
        : current.whatsappHumanHandoffEnabled,

    deliveryPricingMode: [`;

  organization = replaceRequired(
    organization,
    anchor,
    replacement,
    "normalizedSettings"
  );
}

write(
  organizationFile,
  organization
);

// ============================================================
// 4. CENTRAL IA E AUTOMACOES
// ============================================================

const panel = `"use client"

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
  Users,
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
      className={\`relative h-7 w-12 shrink-0 rounded-full transition \${
        checked
          ? "bg-emerald-500"
          : "bg-gray-300"
      } \${
        disabled
          ? "cursor-not-allowed opacity-40"
          : ""
      }\`}
    >
      <span
        className={\`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all \${
          checked
            ? "left-6"
            : "left-1"
        }\`}
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
      className={\`flex items-center gap-4 rounded-2xl border p-4 transition \${
        checked
          ? "border-emerald-200 bg-emerald-50/40"
          : "border-gray-200 bg-white"
      }\`}
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

          <SettingRow
            title="Receber pedidos"
            description="Permite transformar a conversa do WhatsApp em pedido."
            checked={
              draft.whatsappOrdersEnabled
            }
            disabled={
              masterDisabled ||
              !draft.whatsappAiEnabled
            }
            icon={
              <ShoppingCart className="h-5 w-5" />
            }
            onChange={(
              value,
            ) =>
              patch({
                whatsappOrdersEnabled:
                  value,
              })
            }
          />

          <SettingRow
            title="Confirmação automática"
            description="Envia o resumo para o cliente confirmar antes de finalizar."
            checked={
              draft.whatsappConfirmationsEnabled
            }
            disabled={
              masterDisabled ||
              !draft.whatsappAiEnabled
            }
            icon={
              <MessageCircle className="h-5 w-5" />
            }
            onChange={(
              value,
            ) =>
              patch({
                whatsappConfirmationsEnabled:
                  value,
              })
            }
          />

          <SettingRow
            title="Transferir para humano"
            description="Permite interromper a IA e passar a conversa para uma pessoa."
            checked={
              draft.whatsappHumanHandoffEnabled
            }
            disabled={
              masterDisabled ||
              !draft.whatsappAiEnabled
            }
            icon={
              <Users className="h-5 w-5" />
            }
            onChange={(
              value,
            ) =>
              patch({
                whatsappHumanHandoffEnabled:
                  value,
              })
            }
          />
        </div>

        <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          Esses controles já ficarão salvos por empresa. A conexão com a API do WhatsApp será feita na etapa própria.
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
`;

write(
  panelFile,
  panel
);

// ============================================================
// 5. BOTAO FLUTUANTE DO CLIENTE RESPEITA OS CONTROLES
// ============================================================

let storeChatbot =
  read(storeChatbotFile);

const oldCheck =
  `  if (!settings.chatbotEnabled) return null`;

const newCheck =
`  if (
    !settings.chatbotEnabled ||
    settings.aiStorefrontChatEnabled === false ||
    settings.aiFloatingButtonEnabled === false
  ) {
    return null
  }`;

if (
  storeChatbot.includes(
    oldCheck
  )
) {
  storeChatbot =
    storeChatbot.replace(
      oldCheck,
      newCheck
    );
} else if (
  !storeChatbot.includes(
    "settings.aiStorefrontChatEnabled"
  )
) {
  throw new Error(
    "Controle do StoreChatbot nao encontrado."
  );
}

write(
  storeChatbotFile,
  storeChatbot
);

// ============================================================
// 6. RENOMEIA A ABA NO MENU ADMIN
// ============================================================

let dashboard =
  read(dashboardFile);

dashboard =
  dashboard.replace(
    /(\{\s*key:\s*"chatbot",\s*label:\s*)"[^"]+"/,
    '$1"IA e Automações"'
  );

write(
  dashboardFile,
  dashboard
);

// ============================================================
// FINAL
// ============================================================

console.log("");
console.log(
  "=============================================="
);
console.log(
  "ETAPA 14.7.1 APLICADA"
);
console.log(
  "=============================================="
);
console.log(
  "- Central IA e Automacoes criada"
);
console.log(
  "- Configuracoes salvas por empresa"
);
console.log(
  "- Chatbot do cardapio ON/OFF"
);
console.log(
  "- Texto e audio configuraveis"
);
console.log(
  "- Botao flutuante configuravel"
);
console.log(
  "- Controles do PDV preparados"
);
console.log(
  "- Controles do WhatsApp preparados"
);
console.log(
  "- Nenhuma migration necessaria"
);
console.log("");