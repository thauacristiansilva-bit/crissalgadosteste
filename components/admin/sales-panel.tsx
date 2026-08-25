"use client"

import { FormEvent, useMemo, useState } from "react"
import {
  Banknote,
  Download,
  LockKeyhole,
  Plus,
  TrendingDown,
  TrendingUp,
  UnlockKeyhole,
} from "lucide-react"
import type {
  CashSession,
  FinancialEntry,
  Order,
  StoreSettings,
} from "@/lib/types"
import { HelpTip } from "@/components/admin/help-tip"

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)

const date = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))

const dreCategories = [
  "Pessoal e encargos",
  "Aluguel e ocupação",
  "Água, energia e utilidades",
  "Marketing e publicidade",
  "Logística e entregas",
  "Despesas financeiras",
  "Impostos e taxas",
  "Administrativas",
  "Manutenção e reparos",
  "Perdas de estoque",
  "Outras despesas",
  "Outras receitas",
]

type Feedback =
  | {
      kind: "success" | "error"
      text: string
    }
  | null

function parseMoneyInput(value: string) {
  const raw = value
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/\s+/g, "")

  if (!raw) return Number.NaN

  return Number(
    raw.includes(",")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw,
  )
}

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null

  return (
    <p
      className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold ${
        feedback.kind === "success"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-700"
      }`}
      role={feedback.kind === "error" ? "alert" : "status"}
    >
      {feedback.text}
    </p>
  )
}

export function SalesPanel({
  orders,
  settings: _settings,
  initialCashSessions,
  initialEntries,
}: {
  orders: Order[]
  settings: StoreSettings
  initialCashSessions: CashSession[]
  initialEntries: FinancialEntry[]
}) {
  const [cashSessions, setCashSessions] = useState(initialCashSessions)
  const [entries, setEntries] = useState(initialEntries)
  const [cashAmount, setCashAmount] = useState("0")
  const [entryType, setEntryType] = useState<"income" | "expense">(
    "expense",
  )
  const [entryCategory, setEntryCategory] = useState("Geral")
  const [entryDescription, setEntryDescription] = useState("")
  const [entryAmount, setEntryAmount] = useState("")
  const [cashFeedback, setCashFeedback] = useState<Feedback>(null)
  const [financeFeedback, setFinanceFeedback] = useState<Feedback>(null)
  const [cashBusy, setCashBusy] = useState(false)
  const [financeBusy, setFinanceBusy] = useState(false)
  const [historyType, setHistoryType] = useState<"all" | "income" | "expense">(
    "all",
  )
  const [historySearch, setHistorySearch] = useState("")

  const openCash = cashSessions.find((item) => !item.closedAt)
  const validOrders = orders.filter((order) => order.status !== "cancelled")
  const revenue = validOrders.reduce((sum, order) => sum + order.total, 0)
  const paid = validOrders
    .filter((order) => order.paymentStatus === "paid")
    .reduce((sum, order) => sum + order.total, 0)
  const expenses = entries
    .filter((entry) => entry.type === "expense")
    .reduce((sum, entry) => sum + entry.amount, 0)
  const incomes = entries
    .filter((entry) => entry.type === "income")
    .reduce((sum, entry) => sum + entry.amount, 0)
  const net = paid + incomes - expenses

  const filteredEntries = useMemo(() => {
    const query = historySearch.trim().toLocaleLowerCase("pt-BR")

    return [...entries]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .filter((entry) => {
        if (historyType !== "all" && entry.type !== historyType) return false
        if (!query) return true

        return [entry.description, entry.category]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(query)
      })
  }, [entries, historySearch, historyType])

  const daily = useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number }>()

    validOrders.forEach((order) => {
      const key = new Date(order.createdAt).toLocaleDateString("pt-BR")
      const current = map.get(key) || { orders: 0, revenue: 0 }
      current.orders += 1
      current.revenue += order.total
      map.set(key, current)
    })

    return [...map.entries()].slice(-14).reverse()
  }, [orders])

  async function cashAction(action: "open" | "close") {
    if (cashBusy) return

    const amount = parseMoneyInput(cashAmount)
    if (!Number.isFinite(amount) || amount < 0) {
      setCashFeedback({
        kind: "error",
        text: "Informe um valor de caixa válido.",
      })
      return
    }

    setCashBusy(true)
    setCashFeedback(null)

    try {
      const response = await fetch("/api/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "open"
            ? { action, amount }
            : { action, id: openCash?.id, amount },
        ),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setCashFeedback({
          kind: "error",
          text: data.error || "Erro no caixa.",
        })
        return
      }

      const refreshResponse = await fetch("/api/cash", {
        cache: "no-store",
      })
      const refresh = await refreshResponse.json().catch(() => ({}))

      if (!refreshResponse.ok) {
        setCashFeedback({
          kind: "error",
          text:
            refresh.error ||
            "A operação foi salva, mas não foi possível atualizar o caixa.",
        })
        return
      }

      setCashSessions(refresh.sessions || [])
      setCashAmount("0")
      setCashFeedback({
        kind: "success",
        text: action === "open" ? "Caixa aberto." : "Caixa fechado.",
      })
    } catch {
      setCashFeedback({
        kind: "error",
        text: "Falha de comunicação ao operar o caixa.",
      })
    } finally {
      setCashBusy(false)
    }
  }

  async function addEntry(event: FormEvent) {
    event.preventDefault()
    if (financeBusy) return

    const description = entryDescription.trim()
    const category = entryCategory.trim() || "Geral"
    const amount = parseMoneyInput(entryAmount)

    if (!description) {
      setFinanceFeedback({
        kind: "error",
        text: "Informe a descrição do lançamento.",
      })
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setFinanceFeedback({
        kind: "error",
        text: "Informe um valor maior que zero.",
      })
      return
    }

    setFinanceBusy(true)
    setFinanceFeedback(null)

    try {
      const response = await fetch("/api/financial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: entryType,
          category,
          description,
          amount,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setFinanceFeedback({
          kind: "error",
          text: data.error || "Erro no lançamento.",
        })
        return
      }

      setEntries((current) => [data.entry, ...current])
      setEntryDescription("")
      setEntryAmount("")
      setFinanceFeedback({
        kind: "success",
        text:
          entryType === "expense"
            ? "Despesa salva."
            : "Receita salva.",
      })
    } catch {
      setFinanceFeedback({
        kind: "error",
        text: "Falha de comunicação ao salvar o lançamento.",
      })
    } finally {
      setFinanceBusy(false)
    }
  }

  function exportFinancialCsv() {
    const rows = [
      ["data", "tipo", "categoria", "descricao", "valor"],
      ...filteredEntries.map((entry) => [
        entry.createdAt,
        entry.type === "expense" ? "Despesa" : "Outra receita",
        entry.category,
        entry.description,
        entry.amount.toFixed(2),
      ]),
    ]
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(";"),
      )
      .join("\n")
    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `lancamentos-financeiros-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportCsv() {
    const rows = [
      ["pedido", "data", "cliente", "tipo", "status", "pagamento", "total"],
      ...orders.map((order) => [
        order.code,
        order.createdAt,
        order.customer.name,
        order.type,
        order.status,
        order.paymentStatus,
        order.total.toFixed(2),
      ]),
    ]
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(";"),
      )
      .join("\n")
    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `vendas-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Vendas", money(revenue), TrendingUp, "bg-blue-50 text-blue-700"],
          ["Recebido", money(paid), Banknote, "bg-emerald-50 text-emerald-700"],
          ["Despesas", money(expenses), TrendingDown, "bg-red-50 text-red-700"],
          ["Saldo operacional", money(net), TrendingUp, "bg-violet-50 text-violet-700"],
        ].map(([label, value, Icon, cls]: any) => (
          <article
            key={label}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-500">{label}</p>
                <p className="mt-2 text-2xl font-black">{value}</p>
              </div>
              <div className={`rounded-xl p-2.5 ${cls}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </article>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-black">Caixa</h2>
                <HelpTip helpKey="cash.openClose" />
              </div>
              <p className="text-sm text-gray-500">
                Abertura e fechamento do turno.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-black ${
                openCash
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {openCash ? "ABERTO" : "FECHADO"}
            </span>
          </div>

          <div className="mt-4 flex gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={cashAmount}
              onChange={(event) => setCashAmount(event.target.value)}
              disabled={cashBusy}
              className="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 px-3 text-sm disabled:bg-gray-50"
              placeholder={
                openCash ? "Valor contado no fechamento" : "Troco inicial"
              }
            />
            <button
              type="button"
              disabled={cashBusy}
              onClick={() => cashAction(openCash ? "close" : "open")}
              className={`inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                openCash ? "bg-red-600" : "bg-blue-700"
              }`}
            >
              {openCash ? (
                <LockKeyhole className="h-4 w-4" />
              ) : (
                <UnlockKeyhole className="h-4 w-4" />
              )}
              {cashBusy
                ? "Salvando..."
                : openCash
                  ? "Fechar caixa"
                  : "Abrir caixa"}
            </button>
          </div>

          {openCash && (
            <p className="mt-3 text-xs text-gray-500">
              Aberto em {date(openCash.openedAt)} · fundo{" "}
              {money(openCash.openingAmount)}
            </p>
          )}

          <FeedbackMessage feedback={cashFeedback} />
        </section>

        <form
          onSubmit={addEntry}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-1.5">
            <h2 className="font-black">Lançamento financeiro</h2>
            <HelpTip helpKey="finance.entry" />
          </div>
          <p className="text-sm text-gray-500">
            Registre apenas receitas fora dos pedidos e despesas da operação.
          </p>
          <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
            As vendas dos pedidos já entram automaticamente na DRE. Não lance a
            mesma venda aqui para evitar receita duplicada.
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              value={entryType}
              onChange={(event) =>
                setEntryType(event.target.value as "income" | "expense")
              }
              disabled={financeBusy}
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm disabled:bg-gray-50"
            >
              <option value="expense">Despesa</option>
              <option value="income">Outra receita</option>
            </select>

            <div className="relative">
              <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2">
                <HelpTip helpKey="finance.category" />
              </div>
              <input
                list="dre-financial-categories"
                value={entryCategory}
                onChange={(event) => setEntryCategory(event.target.value)}
                disabled={financeBusy}
                className="h-10 w-full rounded-xl border border-gray-200 px-3 pr-9 text-sm disabled:bg-gray-50"
                placeholder="Categoria da DRE"
              />
              <datalist id="dre-financial-categories">
                {dreCategories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>

            <input
              required
              maxLength={500}
              value={entryDescription}
              onChange={(event) => setEntryDescription(event.target.value)}
              disabled={financeBusy}
              className="h-10 rounded-xl border border-gray-200 px-3 text-sm disabled:bg-gray-50 sm:col-span-2"
              placeholder="Descrição"
            />

            <input
              required
              value={entryAmount}
              onChange={(event) => setEntryAmount(event.target.value)}
              disabled={financeBusy}
              inputMode="decimal"
              className="h-10 rounded-xl border border-gray-200 px-3 text-sm disabled:bg-gray-50"
              placeholder="Valor"
            />

            <button
              disabled={financeBusy}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {financeBusy ? "Salvando..." : "Salvar"}
            </button>
          </div>

          <FeedbackMessage feedback={financeFeedback} />
        </form>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-black">Histórico de lançamentos</h2>
              <p className="text-sm text-gray-500">
                Consulte despesas e receitas avulsas registradas no financeiro.
              </p>
            </div>

            <button
              type="button"
              onClick={exportFinancialCsv}
              disabled={filteredEntries.length === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-black text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Exportar lançamentos
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr]">
            <select
              value={historyType}
              onChange={(event) =>
                setHistoryType(
                  event.target.value as "all" | "income" | "expense",
                )
              }
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="all">Todos os tipos</option>
              <option value="expense">Despesas</option>
              <option value="income">Outras receitas</option>
            </select>

            <input
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
              className="h-10 rounded-xl border border-gray-200 px-3 text-sm"
              placeholder="Buscar por descrição ou categoria"
            />
          </div>

          <p className="mt-3 text-xs font-semibold text-gray-500">
            {filteredEntries.length} lançamento
            {filteredEntries.length === 1 ? "" : "s"} encontrado
            {filteredEntries.length === 1 ? "" : "s"}.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Data</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Categoria</th>
                <th className="px-5 py-3">Descrição</th>
                <th className="px-5 py-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEntries.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap px-5 py-3 text-gray-600">
                    {date(entry.createdAt)}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${
                        entry.type === "expense"
                          ? "bg-red-50 text-red-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {entry.type === "expense"
                        ? "Despesa"
                        : "Outra receita"}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-semibold text-gray-700">
                    {entry.category || "Geral"}
                  </td>
                  <td className="min-w-[260px] px-5 py-3 text-gray-700">
                    {entry.description}
                  </td>
                  <td
                    className={`whitespace-nowrap px-5 py-3 text-right font-black ${
                      entry.type === "expense"
                        ? "text-red-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {entry.type === "expense" ? "- " : "+ "}
                    {money(entry.amount)}
                  </td>
                </tr>
              ))}

              {filteredEntries.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-sm text-gray-500"
                  >
                    Nenhum lançamento encontrado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="font-black">Histórico e relatórios</h2>
            <p className="text-sm text-gray-500">
              Resumo por dia e exportação para Excel/CSV.
            </p>
          </div>
          <button
            onClick={exportCsv}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-black text-gray-700"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Data</th>
                <th className="px-5 py-3">Pedidos</th>
                <th className="px-5 py-3">Faturamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {daily.map(([day, info]) => (
                <tr key={day}>
                  <td className="px-5 py-3 font-bold">{day}</td>
                  <td className="px-5 py-3">{info.orders}</td>
                  <td className="px-5 py-3 font-black">
                    {money(info.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
