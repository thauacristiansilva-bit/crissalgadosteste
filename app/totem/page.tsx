import { Storefront } from "@/components/store/storefront"
import { getPublicStore } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function TotemPage() {
  const store = await getPublicStore()
  if (!store.settings.totemEnabled) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><section className="max-w-md rounded-3xl bg-white p-8 text-center shadow-sm"><div className="text-5xl">🖥️</div><h1 className="mt-4 text-2xl font-black">Totem desativado</h1><p className="mt-2 text-sm text-gray-500">Ative o modo totem em Admin → Configurações para usar esta tela.</p></section></main>
  }
  return <Storefront {...store} />
}
