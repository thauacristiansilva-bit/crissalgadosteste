"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  ClipboardCheck,
  Factory,
  Loader2,
  PackagePlus,
  RefreshCcw,
  Scale,
  Trash2,
} from "lucide-react"

type Ingredient = {
  id: number
  name: string
  unit: string
  stockQuantity: number
  minStockQuantity: number
  unitCost: number
}

type Product = {
  id: number
  name: string
  recipeItems: number
  theoreticalUnitCost: number
}

type Lot = {
  id: string
  ingredientId: number
  ingredientName: string
  lotCode: string
  supplier: string
  receivedAt: string
  expiresAt: string | null
  quantityReceived: number
  quantityDiscarded: number
  unitCost: number
  status: "active" | "closed" | "discarded"
  note: string
}

type ProductionRun = {
  id: string
  productName: string
  batchCode: string
  producedAt: string
  plannedYield: number
  actualYield: number
  wasteQuantity: number
  theoreticalBatchCost: number
  effectiveUnitCost: number
  yieldEfficiency: number
}

type InventoryCount = {
  id: string
  reference: string
  countedAt: string
  totalItems: number
  adjustedItems: number
  valueDifference: number
}

type Overview = {
  organization: { id: string; name: string }
  billing: { subscriptionActive: boolean; inventoryIncluded: boolean; planCode: string | null }
  ingredients: Ingredient[]
  products: Product[]
  lots: Lot[]
  productionRuns: ProductionRun[]
  inventoryCounts: InventoryCount[]
  summary: {
    ingredients: number
    lowStock: number
    activeLots: number
    expiringLots: number
    expiredLots: number
    productionRuns: number
    averageYieldEfficiency: number
    stockValue: number
  }
}

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0)

const number = (value: number, maximumFractionDigits = 3) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits }).format(value || 0)

const today = () => new Date().toISOString().slice(0, 10)

export function FoodOperationsDashboard({ currentOrganizationName }: { currentOrganizationName: string }) {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [lotDraft, setLotDraft] = useState({
    ingredientId: "",
    lotCode: "",
    supplier: "",
    receivedAt: today(),
    expiresAt: "",
    quantity: "",
    unitCost: "",
    note: "",
  })
  const [productionDraft, setProductionDraft] = useState({
    productId: "",
    batchCode: "",
    plannedYield: "",
    actualYield: "",
    wasteQuantity: "0",
    note: "",
  })
  const [countReference, setCountReference] = useState("")
  const [countDrafts, setCountDrafts] = useState<Record<number, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    const response = await fetch("/api/admin/food-operations", { cache: "no-store" }).catch(() => null)
    if (!response) {
      setError("Não foi possível conectar ao servidor.")
      setLoading(false)
      return
    }
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(payload.error || "Não foi possível carregar a operação alimentar.")
      setLoading(false)
      return
    }
    setData(payload as Overview)
    setCountDrafts((current) => {
      const next = { ...current }
      for (const ingredient of (payload as Overview).ingredients) {
        if (next[ingredient.id] === undefined) next[ingredient.id] = String(ingredient.stockQuantity)
      }
      return next
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const action = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true)
    setMessage("")
    setError("")
    const response = await fetch("/api/admin/food-operations/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null)
    if (!response) {
      setError("Não foi possível conectar ao servidor.")
      setBusy(false)
      return false
    }
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(payload.error || "Não foi possível concluir a ação.")
      setBusy(false)
      return false
    }
    setBusy(false)
    await load()
    return true
  }, [load])

  async function submitLot(event: FormEvent) {
    event.preventDefault()
    const ok = await action({
      action: "receive_lot",
      ingredientId: Number(lotDraft.ingredientId),
      lotCode: lotDraft.lotCode,
      supplier: lotDraft.supplier,
      receivedAt: lotDraft.receivedAt,
      expiresAt: lotDraft.expiresAt || null,
      quantity: Number(lotDraft.quantity),
      unitCost: Number(lotDraft.unitCost),
      note: lotDraft.note,
    })
    if (ok) {
      setMessage("Lote recebido e estoque atualizado com custo médio ponderado.")
      setLotDraft({ ingredientId: "", lotCode: "", supplier: "", receivedAt: today(), expiresAt: "", quantity: "", unitCost: "", note: "" })
    }
  }

  async function submitProduction(event: FormEvent) {
    event.preventDefault()
    const ok = await action({
      action: "create_production_run",
      productId: Number(productionDraft.productId),
      batchCode: productionDraft.batchCode,
      plannedYield: Number(productionDraft.plannedYield),
      actualYield: Number(productionDraft.actualYield),
      wasteQuantity: Number(productionDraft.wasteQuantity || 0),
      note: productionDraft.note,
    })
    if (ok) {
      setMessage("Apontamento de produção registrado.")
      setProductionDraft({ productId: "", batchCode: "", plannedYield: "", actualYield: "", wasteQuantity: "0", note: "" })
    }
  }

  async function submitCount(event: FormEvent) {
    event.preventDefault()
    if (!data) return
    const items = data.ingredients.map((ingredient) => ({
      ingredientId: ingredient.id,
      countedQuantity: Number(countDrafts[ingredient.id] ?? ingredient.stockQuantity),
    }))
    const ok = await action({
      action: "inventory_count",
      reference: countReference,
      items,
    })
    if (ok) {
      setMessage("Inventário físico conciliado com o estoque do sistema.")
      setCountReference("")
    }
  }

  async function wasteLot(lot: Lot) {
    const raw = window.prompt(`Quantidade perdida do lote ${lot.lotCode}:`)
    if (!raw) return
    const reason = window.prompt("Motivo da perda:")
    if (!reason) return
    if (await action({ action: "waste_lot", lotId: lot.id, quantity: Number(raw.replace(",", ".")), reason })) {
      setMessage("Perda registrada e saldo do ingrediente ajustado.")
    }
  }

  async function closeLot(lot: Lot) {
    if (!window.confirm(`Encerrar o lote ${lot.lotCode}? Use quando ele já não estiver fisicamente disponível.`)) return
    if (await action({ action: "close_lot", lotId: lot.id })) setMessage("Lote encerrado.")
  }

  const productionProducts = useMemo(() => data?.products.filter((product) => product.recipeItems > 0) || [], [data])

  if (loading && !data) {
    return <div className="flex min-h-[70vh] items-center justify-center text-sm text-gray-500"><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Carregando operação alimentar...</div>
  }

  return (
    <main className="min-h-screen bg-[#fffaf4] text-[#2f1c13]">
      <header className="border-b border-[#efd9c3] bg-white px-4 py-4 shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a href="/admin" className="rounded-xl border border-[#ead2b8] p-2 text-[#7b4d2b] hover:bg-[#fff5e9]" aria-label="Voltar"><ArrowLeft className="h-5 w-5"/></a>
            <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#d97706]">FASE 22</p><h1 className="text-xl font-black">Operação alimentar avançada</h1><p className="text-xs text-gray-500">{currentOrganizationName}</p></div>
          </div>
          <button onClick={() => void load()} disabled={busy || loading} className="inline-flex items-center gap-2 rounded-xl border border-[#ead2b8] bg-white px-3 py-2 text-sm font-bold"><RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}/>Atualizar</button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
        {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>}

        {data && <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {[
              ["Valor em estoque", money(data.summary.stockValue), Boxes],
              ["Ingredientes", String(data.summary.ingredients), PackagePlus],
              ["Estoque baixo", String(data.summary.lowStock), AlertTriangle],
              ["Lotes ativos", String(data.summary.activeLots), ClipboardCheck],
              ["Vencem em 7 dias", String(data.summary.expiringLots), AlertTriangle],
              ["Rendimento médio", `${number(data.summary.averageYieldEfficiency, 1)}%`, Scale],
            ].map(([label, value, Icon]) => {
              const CardIcon = Icon as typeof Boxes
              return <div key={String(label)} className="rounded-2xl border border-[#efd9c3] bg-white p-4 shadow-sm"><CardIcon className="mb-3 h-5 w-5 text-[#d97706]"/><p className="text-xs font-bold text-gray-500">{label as string}</p><p className="mt-1 text-xl font-black">{value as string}</p></div>
            })}
          </section>

          {data.summary.expiredLots > 0 && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><strong>{data.summary.expiredLots} lote(s) vencido(s) ainda ativo(s).</strong> Revise fisicamente, registre perda quando houver descarte e encerre o lote quando não existir mais saldo físico.</div>}

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border border-[#efd9c3] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2"><PackagePlus className="h-5 w-5 text-[#d97706]"/><div><h2 className="font-black">Recebimento por lote</h2><p className="text-xs text-gray-500">Entrada atualiza estoque e custo médio ponderado do ingrediente.</p></div></div>
              <form onSubmit={submitLot} className="grid gap-3 sm:grid-cols-2">
                <select required value={lotDraft.ingredientId} onChange={(e) => setLotDraft({ ...lotDraft, ingredientId: e.target.value })} className="h-11 rounded-xl border border-gray-200 px-3 text-sm"><option value="">Ingrediente</option>{data.ingredients.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.unit}</option>)}</select>
                <input required value={lotDraft.lotCode} onChange={(e) => setLotDraft({ ...lotDraft, lotCode: e.target.value })} placeholder="Código do lote" className="h-11 rounded-xl border border-gray-200 px-3 text-sm"/>
                <input value={lotDraft.supplier} onChange={(e) => setLotDraft({ ...lotDraft, supplier: e.target.value })} placeholder="Fornecedor" className="h-11 rounded-xl border border-gray-200 px-3 text-sm"/>
                <input type="date" required value={lotDraft.receivedAt} onChange={(e) => setLotDraft({ ...lotDraft, receivedAt: e.target.value })} className="h-11 rounded-xl border border-gray-200 px-3 text-sm"/>
                <input type="date" value={lotDraft.expiresAt} onChange={(e) => setLotDraft({ ...lotDraft, expiresAt: e.target.value })} className="h-11 rounded-xl border border-gray-200 px-3 text-sm" title="Validade"/>
                <input required type="number" min="0.001" step="0.001" value={lotDraft.quantity} onChange={(e) => setLotDraft({ ...lotDraft, quantity: e.target.value })} placeholder="Quantidade recebida" className="h-11 rounded-xl border border-gray-200 px-3 text-sm"/>
                <input required type="number" min="0" step="0.0001" value={lotDraft.unitCost} onChange={(e) => setLotDraft({ ...lotDraft, unitCost: e.target.value })} placeholder="Custo por unidade" className="h-11 rounded-xl border border-gray-200 px-3 text-sm"/>
                <input value={lotDraft.note} onChange={(e) => setLotDraft({ ...lotDraft, note: e.target.value })} placeholder="Observação" className="h-11 rounded-xl border border-gray-200 px-3 text-sm"/>
                <button disabled={busy} className="sm:col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#d97706] px-4 font-black text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin"/>}Registrar recebimento</button>
              </form>
            </div>

            <div className="rounded-2xl border border-[#efd9c3] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2"><Factory className="h-5 w-5 text-[#d97706]"/><div><h2 className="font-black">Apontamento de produção</h2><p className="text-xs text-gray-500">Compara rendimento real com a ficha técnica sem gerar uma segunda baixa de estoque.</p></div></div>
              <form onSubmit={submitProduction} className="grid gap-3 sm:grid-cols-2">
                <select required value={productionDraft.productId} onChange={(e) => setProductionDraft({ ...productionDraft, productId: e.target.value })} className="h-11 rounded-xl border border-gray-200 px-3 text-sm"><option value="">Produto com ficha técnica</option>{productionProducts.map((item) => <option key={item.id} value={item.id}>{item.name} · custo teórico {money(item.theoreticalUnitCost)}</option>)}</select>
                <input required value={productionDraft.batchCode} onChange={(e) => setProductionDraft({ ...productionDraft, batchCode: e.target.value })} placeholder="Código da produção" className="h-11 rounded-xl border border-gray-200 px-3 text-sm"/>
                <input required type="number" min="0.001" step="0.001" value={productionDraft.plannedYield} onChange={(e) => setProductionDraft({ ...productionDraft, plannedYield: e.target.value })} placeholder="Rendimento planejado" className="h-11 rounded-xl border border-gray-200 px-3 text-sm"/>
                <input required type="number" min="0.001" step="0.001" value={productionDraft.actualYield} onChange={(e) => setProductionDraft({ ...productionDraft, actualYield: e.target.value })} placeholder="Rendimento real" className="h-11 rounded-xl border border-gray-200 px-3 text-sm"/>
                <input type="number" min="0" step="0.001" value={productionDraft.wasteQuantity} onChange={(e) => setProductionDraft({ ...productionDraft, wasteQuantity: e.target.value })} placeholder="Perda apurada" className="h-11 rounded-xl border border-gray-200 px-3 text-sm"/>
                <input value={productionDraft.note} onChange={(e) => setProductionDraft({ ...productionDraft, note: e.target.value })} placeholder="Observação" className="h-11 rounded-xl border border-gray-200 px-3 text-sm"/>
                <button disabled={busy || !productionProducts.length} className="sm:col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#4b2c1d] px-4 font-black text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin"/>}Registrar produção</button>
              </form>
            </div>
          </section>

          <section className="rounded-2xl border border-[#efd9c3] bg-white shadow-sm">
            <div className="border-b border-[#f2e4d5] p-5"><h2 className="font-black">Lotes e validade</h2><p className="text-xs text-gray-500">Rastreabilidade do recebimento. O saldo oficial continua sendo o estoque do ingrediente, porque as vendas já fazem a baixa automática da ficha técnica.</p></div>
            <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-[#fffaf4] text-left text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Ingrediente / lote</th><th className="px-4 py-3">Recebido</th><th className="px-4 py-3">Validade</th><th className="px-4 py-3">Custo</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Ações</th></tr></thead><tbody className="divide-y divide-gray-100">{data.lots.map((lot) => <tr key={lot.id}><td className="px-4 py-3"><strong>{lot.ingredientName}</strong><p className="text-xs text-gray-500">{lot.lotCode}{lot.supplier ? ` · ${lot.supplier}` : ""}</p></td><td className="px-4 py-3">{number(lot.quantityReceived)}<p className="text-xs text-red-500">Perdas: {number(lot.quantityDiscarded)}</p></td><td className="px-4 py-3">{lot.expiresAt ? new Date(`${lot.expiresAt}T12:00:00`).toLocaleDateString("pt-BR") : "Sem validade"}</td><td className="px-4 py-3">{money(lot.unitCost)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${lot.status === "active" ? "bg-emerald-100 text-emerald-700" : lot.status === "discarded" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{lot.status === "active" ? "Ativo" : lot.status === "discarded" ? "Descartado" : "Encerrado"}</span></td><td className="px-4 py-3">{lot.status === "active" && <div className="flex gap-2"><button onClick={() => void wasteLot(lot)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-700"><Trash2 className="h-3 w-3"/>Perda</button><button onClick={() => void closeLot(lot)} disabled={busy} className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700">Encerrar</button></div>}</td></tr>)}</tbody></table></div>
            {!data.lots.length && <div className="p-8 text-center text-sm text-gray-400">Nenhum lote registrado.</div>}
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border border-[#efd9c3] bg-white shadow-sm"><div className="border-b border-[#f2e4d5] p-5"><h2 className="font-black">Produções recentes</h2><p className="text-xs text-gray-500">Rendimento e custo efetivo calculados a partir da ficha técnica.</p></div><div className="divide-y divide-gray-100">{data.productionRuns.slice(0, 12).map((run) => <div key={run.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><strong>{run.productName}</strong><p className="text-xs text-gray-500">{run.batchCode} · {new Date(run.producedAt).toLocaleString("pt-BR")}</p></div><span className={`rounded-full px-2 py-1 text-xs font-black ${run.yieldEfficiency >= 100 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{number(run.yieldEfficiency, 1)}%</span></div><div className="mt-2 grid grid-cols-3 gap-2 text-xs"><div><span className="text-gray-400">Planejado</span><p className="font-bold">{number(run.plannedYield)}</p></div><div><span className="text-gray-400">Real</span><p className="font-bold">{number(run.actualYield)}</p></div><div><span className="text-gray-400">Custo/un real</span><p className="font-bold">{money(run.effectiveUnitCost)}</p></div></div></div>)}</div>{!data.productionRuns.length && <div className="p-8 text-center text-sm text-gray-400">Nenhuma produção apontada.</div>}</div>

            <div className="rounded-2xl border border-[#efd9c3] bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-[#d97706]"/><div><h2 className="font-black">Inventário físico</h2><p className="text-xs text-gray-500">Informe o saldo contado; diferenças viram ajustes auditáveis em uma única transação.</p></div></div><form onSubmit={submitCount} className="space-y-3"><input required value={countReference} onChange={(e) => setCountReference(e.target.value)} placeholder="Referência, ex.: Fechamento 31/08" className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"/><div className="max-h-72 space-y-2 overflow-y-auto pr-1">{data.ingredients.map((ingredient) => <label key={ingredient.id} className="grid grid-cols-[1fr_110px] items-center gap-3 rounded-xl bg-[#fffaf4] p-3"><span className="text-sm"><strong>{ingredient.name}</strong><span className="ml-2 text-xs text-gray-500">Sistema: {number(ingredient.stockQuantity)} {ingredient.unit}</span></span><input type="number" min="0" step="0.001" value={countDrafts[ingredient.id] ?? ""} onChange={(e) => setCountDrafts({ ...countDrafts, [ingredient.id]: e.target.value })} className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm"/></label>)}</div><button disabled={busy || !data.ingredients.length} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#d97706] font-black text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin"/>}Conciliar inventário</button></form>{data.inventoryCounts.length > 0 && <div className="mt-5 border-t border-gray-100 pt-4"><p className="mb-2 text-xs font-black uppercase text-gray-400">Últimas contagens</p>{data.inventoryCounts.slice(0, 4).map((count) => <div key={count.id} className="mb-2 rounded-xl bg-gray-50 p-3 text-xs"><div className="flex justify-between gap-2"><strong>{count.reference}</strong><span>{new Date(count.countedAt).toLocaleDateString("pt-BR")}</span></div><p className="mt-1 text-gray-500">{count.totalItems} itens · {count.adjustedItems} ajustados · diferença financeira {money(count.valueDifference)}</p></div>)}</div>}</div>
          </section>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-900"><strong>Autoridade de estoque preservada:</strong> pedidos continuam baixando ingredientes automaticamente pela ficha técnica atual. O apontamento de produção mede rendimento e custo, mas não repete essa baixa. Lotes registram recebimento, validade e perdas; o estoque oficial continua em <code>sf_ingredients</code>.</div>
        </>}
      </div>
    </main>
  )
}
