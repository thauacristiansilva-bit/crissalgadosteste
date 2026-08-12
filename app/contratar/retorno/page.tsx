import { CheckoutReturn } from "@/components/billing/checkout-return"

export const dynamic = "force-dynamic"

export default function ContractReturnPage() {
  return (
    <main className="min-h-screen bg-[#fffaf3] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">SaborFlow</p>
        <h1 className="mt-2 text-3xl font-black text-gray-950">Status da contratação</h1>
        <div className="mt-7"><CheckoutReturn /></div>
      </div>
    </main>
  )
}
