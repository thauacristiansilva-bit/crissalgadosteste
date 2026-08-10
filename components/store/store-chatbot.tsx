"use client"

import { useState } from "react"
import { Bot, Clock3, CreditCard, MessageCircle, Truck, X } from "lucide-react"
import type { StoreSettings } from "@/lib/types"

export function StoreChatbot({ settings }: { settings: StoreSettings }) {
  const [open, setOpen] = useState(false)
  const [answer, setAnswer] = useState(settings.chatbotGreeting)
  if (!settings.chatbotEnabled) return null

  const payments = [settings.pixEnabled && "PIX", settings.cashEnabled && "Dinheiro", settings.cardEnabled && "Cartão"].filter(Boolean).join(", ")
  return <div className="fixed bottom-5 right-5 z-[90]">
    {open && <div className="mb-3 w-[min(340px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between bg-slate-950 px-4 py-3 text-white"><div className="flex items-center gap-2"><Bot className="h-5 w-5" /><strong>Ajuda rápida</strong></div><button onClick={() => setOpen(false)}><X className="h-4 w-4" /></button></div>
      <div className="p-4"><div className="rounded-2xl rounded-tl-sm bg-gray-100 p-3 text-sm leading-relaxed text-gray-700">{answer}</div><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => setAnswer(`Nosso horário: ${settings.openingHours}`)} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-left text-xs font-bold"><Clock3 className="h-4 w-4" />Horário</button><button onClick={() => setAnswer(`Delivery: prazo aproximado de ${settings.deliveryMinMinutes} a ${settings.deliveryMaxMinutes} min. Marque seu ponto exato no mapa para calcular a área.`)} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-left text-xs font-bold"><Truck className="h-4 w-4" />Entrega</button><button onClick={() => setAnswer(`Pagamentos disponíveis: ${payments || "consulte a loja"}.`)} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-left text-xs font-bold"><CreditCard className="h-4 w-4" />Pagamento</button><a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><MessageCircle className="h-4 w-4" />WhatsApp</a></div></div>
    </div>}
    <button onClick={() => setOpen((value) => !value)} className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-white shadow-xl" aria-label="Abrir ajuda"><Bot className="h-6 w-6" /></button>
  </div>
}
