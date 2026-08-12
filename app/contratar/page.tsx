import { CommercialCheckout } from "@/components/billing/commercial-checkout"

export const dynamic = "force-dynamic"

export default function ContractPage() {
  return (
    <main className="min-h-screen bg-[#fffaf3] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">SaborFlow</p>
        <h1 className="mt-2 text-3xl font-black text-gray-950 sm:text-4xl">Escolha seu plano</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">Crie sua conta, escolha o plano e conclua o pagamento no provedor seguro. A assinatura só é liberada quando o backend confirma o status diretamente com o provedor.</p>
        <div className="mt-8"><CommercialCheckout /></div>
      </div>
    </main>
  )
}
