import { Storefront } from "@/components/store/storefront"
import { getPublicStoreForOrganization } from "@/lib/public-store-db"
import { resolveServerPublicOrganization } from "@/lib/public-tenant"

export const dynamic = "force-dynamic"

export default async function TotemPage({
  searchParams,
}: {
  searchParams: Promise<{ loja?: string }>
}) {
  const { loja } = await searchParams
  const organization = await resolveServerPublicOrganization(loja)

  if (!organization) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <section className="max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-5xl">🖥️</div>
          <h1 className="mt-4 text-2xl font-black">Selecione a loja do totem</h1>
          <p className="mt-2 text-sm text-gray-500">
            Abra o totem pelo domínio da loja ou use /totem?loja=slug-da-empresa.
          </p>
        </section>
      </main>
    )
  }

  const store = await getPublicStoreForOrganization(organization)

  if (!store.settings.totemEnabled) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <section className="max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-5xl">🖥️</div>
          <h1 className="mt-4 text-2xl font-black">Totem desativado</h1>
          <p className="mt-2 text-sm text-gray-500">
            Ative o modo totem em Admin → Configurações para usar esta tela.
          </p>
        </section>
      </main>
    )
  }

  return <Storefront {...store} />
}
