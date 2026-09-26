"use client"

import {
  useState,
} from "react"

import {
  Bot,
  Clock3,
  CreditCard,
  MessageCircle,
  ShoppingBag,
  Truck,
  X,
} from "lucide-react"

import {
  AiOrderAssistant,
  type AiOrderItem,
} from "@/components/store/ai-order-assistant"

import type {
  Product,
  StoreSettings,
} from "@/lib/types"

export function StoreChatbot({
  settings,
  products,
  onApplyOrder,
}: {
  settings: StoreSettings
  products: Product[]
  onApplyOrder: (
    items: AiOrderItem[],
  ) => void
}) {
  const [open, setOpen] =
    useState(false)

  const [answer, setAnswer] =
    useState(
      settings.chatbotGreeting,
    )

  if (
    !settings.chatbotEnabled ||
    settings.aiStorefrontChatEnabled ===
      false ||
    settings.aiFloatingButtonEnabled ===
      false
  ) {
    return null
  }

  const textEnabled =
    settings.aiStorefrontTextEnabled !==
    false

  const audioEnabled =
    settings.aiStorefrontAudioEnabled !==
    false

  const orderAssistantEnabled =
    textEnabled ||
    audioEnabled

  const payments = [
    settings.pixEnabled &&
      "PIX",
    settings.cashEnabled &&
      "Dinheiro",
    settings.cardEnabled &&
      "Cartao",
  ]
    .filter(Boolean)
    .join(", ")

  const whatsappDigits =
    settings.whatsapp
      .replace(/\D/g, "")

  const whatsappUrl =
    "https://wa.me/" +
    whatsappDigits

  function applyOrder(
    items: AiOrderItem[],
  ) {
    onApplyOrder(items)
    setOpen(false)
  }

  return (
    <div className="fixed bottom-5 right-5 z-[90]">
      {open && (
        <div className="mb-3 flex max-h-[min(78vh,680px)] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between bg-slate-950 px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <Bot className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <strong className="block truncate text-sm">
                  Assistente de {settings.storeName}
                </strong>

                <span className="text-[10px] text-white/60">
                  Atendimento e pedidos
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setOpen(false)
              }
              aria-label="Fechar assistente"
              className="rounded-lg p-2 transition hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-y-auto p-4">
            <div className="rounded-2xl rounded-tl-sm bg-gray-100 p-3 text-sm leading-relaxed text-gray-700">
              {answer}
            </div>
            {settings.aiBusinessDescription && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-950">{settings.aiBusinessDescription}</p>}
            {(settings.aiMenuUrl || settings.aiCheckoutUrl || settings.aiPaymentUrl) && <div className="mt-3 flex flex-wrap gap-2">{([
              [settings.aiMenuUrl, "Ver catálogo"], [settings.aiCheckoutUrl, "Fazer pedido"], [settings.aiPaymentUrl, "Abrir pagamento"],
            ] as const).filter(([url]) => url?.startsWith("https://")).map(([url, label]) => <a key={label} href={url} target="_blank" rel="noreferrer" className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-bold text-amber-900">{label}</a>)}</div>}

            {orderAssistantEnabled && (
              <AiOrderAssistant
                products={products}
                primaryColor={
                  settings.primaryColor
                }
                storeName={
                  settings.storeName
                }
                textEnabled={
                  textEnabled
                }
                audioEnabled={
                  audioEnabled
                }
                variant="chat"
                onApply={
                  applyOrder
                }
              />
            )}

            {!orderAssistantEnabled && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
                <ShoppingBag className="h-4 w-4" />
                Pedidos por IA estao desativados nesta loja.
              </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setAnswer(
                    "Nosso horario: " +
                      settings.openingHours,
                  )
                }
                className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-left text-xs font-bold"
              >
                <Clock3 className="h-4 w-4" />
                Horario
              </button>

              <button
                type="button"
                onClick={() =>
                  setAnswer(
                    "Delivery: prazo aproximado de " +
                      settings.deliveryMinMinutes +
                      " a " +
                      settings.deliveryMaxMinutes +
                      " min. Marque seu ponto exato no mapa para calcular a area.",
                  )
                }
                className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-left text-xs font-bold"
              >
                <Truck className="h-4 w-4" />
                Entrega
              </button>

              <button
                type="button"
                onClick={() =>
                  setAnswer(
                    "Pagamentos disponiveis: " +
                      (
                        payments ||
                        "consulte a loja"
                      ) +
                      ".",
                  )
                }
                className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-left text-xs font-bold"
              >
                <CreditCard className="h-4 w-4" />
                Pagamento
              </button>

              {whatsappDigits ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              ) : (
                <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-bold text-gray-400">
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() =>
          setOpen(
            (value) =>
              !value,
          )
        }
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-white shadow-xl transition hover:scale-105"
        aria-label={
          open
            ? "Fechar assistente"
            : "Abrir assistente"
        }
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <Bot className="h-6 w-6" />
        )}
      </button>
    </div>
  )
}
