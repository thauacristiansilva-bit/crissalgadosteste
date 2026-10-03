"use client"

import { MessageCircle, Bot, UserRound, Tags, FileText } from "lucide-react"
import { WhatsAppEmbeddedSignup } from "@/components/admin/whatsapp-embedded-signup"
import { WhatsAppInbox } from "@/components/admin/whatsapp-inbox"

export function WhatsAppCenterPanel() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-[#f2fff7] via-white to-[#f8fffb] p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#128c4a]">
              <MessageCircle className="h-5 w-5" />
              <span className="text-xs font-black uppercase tracking-[0.18em]">Central de atendimento</span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-slate-950">WhatsApp</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Atenda clientes, acompanhe conversas e alterne entre inteligência artificial e atendimento humano sem sair do SaborFlow.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <span className="flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 font-bold text-slate-700"><Bot className="h-4 w-4 text-violet-600" />IA</span>
            <span className="flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 font-bold text-slate-700"><UserRound className="h-4 w-4 text-blue-600" />Humano</span>
            <span className="flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 font-bold text-slate-700"><Tags className="h-4 w-4 text-amber-600" />Etiquetas</span>
            <span className="flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 font-bold text-slate-700"><FileText className="h-4 w-4 text-emerald-600" />Modelos</span>
          </div>
        </div>
      </section>

      <WhatsAppEmbeddedSignup />

      <WhatsAppInbox />
    </div>
  )
}
