import type { Metadata } from "next"
import { CommercialCheckout } from "@/components/billing/commercial-checkout"
import { MarketingShell } from "@/components/marketing/marketing-shell"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Contratar — SaborFlow", description: "Crie sua conta e contrate um plano SaborFlow." }

export default function ContractPage() {
  return (
    <MarketingShell>
      <main className="px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600">Contratação SaborFlow</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-stone-950 sm:text-5xl">Escolha seu plano</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-600">Crie sua conta, escolha o plano e conclua o pagamento no provedor seguro. A assinatura só é liberada quando o backend confirma o status diretamente com o provedor.</p>
          <div className="mt-8"><CommercialCheckout /></div>
        </div>
      </main>
    </MarketingShell>
  )
}
