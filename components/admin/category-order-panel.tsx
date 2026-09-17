"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, GripVertical, Loader2 } from "lucide-react"
import type { Category } from "@/lib/types"

function orderedCategories(categories: Category[]) {
  return [...categories].sort(
    (a, b) =>
      Number(a.sortOrder || 0) - Number(b.sortOrder || 0) ||
      a.name.localeCompare(b.name, "pt-BR") ||
      a.id - b.id,
  )
}

export function CategoryOrderPanel({
  categories,
  onCategoriesChanged,
}: {
  categories: Category[]
  onCategoriesChanged: (categories: Category[]) => void
}) {
  const sortedFromProps = useMemo(() => orderedCategories(categories), [categories])
  const [order, setOrder] = useState<Category[]>(sortedFromProps)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [draggedId, setDraggedId] = useState<number | null>(null)

  useEffect(() => {
    if (!busy) setOrder(sortedFromProps)
  }, [sortedFromProps, busy])

  async function saveOrder(nextOrder: Category[]) {
    if (busy) return

    const normalized = nextOrder.map((item, index) => ({
      ...item,
      sortOrder: index + 1,
    }))

    setOrder(normalized)
    setBusy(true)
    setMessage("Salvando nova ordem...")

    try {
      for (const item of normalized) {
        const response = await fetch(
          `/api/categories/${encodeURIComponent(String(item.id))}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: item.sortOrder }),
          },
        )
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(
            data.error || `Não foi possível reposicionar a categoria ${item.name}.`,
          )
        }
      }

      onCategoriesChanged(normalized)
      setMessage("Ordem salva. O cardápio seguirá esta sequência.")
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a ordem das categorias.",
      )
    } finally {
      setBusy(false)
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (busy || target < 0 || target >= order.length) return

    const next = [...order]
    ;[next[index], next[target]] = [next[target], next[index]]
    void saveOrder(next)
  }

  function dropOn(targetId: number) {
    if (busy || draggedId === null || draggedId === targetId) {
      setDraggedId(null)
      return
    }

    const from = order.findIndex((item) => item.id === draggedId)
    const to = order.findIndex((item) => item.id === targetId)
    if (from < 0 || to < 0) {
      setDraggedId(null)
      return
    }

    const next = [...order]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setDraggedId(null)
    void saveOrder(next)
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">Ordem no cardápio</p>
          <h2 className="mt-1 text-lg font-black">Organizar categorias</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Arraste as categorias ou use as setas. A primeira desta lista será a primeira categoria exibida para o cliente, independentemente da ordem em que ela foi cadastrada.
          </p>
        </div>
        {busy ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black text-orange-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Salvando
          </span>
        ) : null}
      </div>

      <div className="mt-5 space-y-2">
        {order.map((category, index) => (
          <div
            key={category.id}
            draggable={!busy}
            onDragStart={() => setDraggedId(category.id)}
            onDragEnd={() => setDraggedId(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => dropOn(category.id)}
            className={`flex items-center gap-3 rounded-xl border bg-white p-3 transition ${
              draggedId === category.id
                ? "border-orange-300 opacity-60"
                : "border-gray-200"
            }`}
          >
            <div className="hidden cursor-grab text-gray-300 active:cursor-grabbing sm:block" title="Arraste para reorganizar">
              <GripVertical className="h-5 w-5" />
            </div>

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-950 text-xs font-black text-white">
              {index + 1}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-gray-950">{category.name}</p>
              <p className="text-xs text-gray-500">
                {category.active ? "Visível no cardápio" : "Categoria desativada"}
              </p>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={busy || index === 0}
                onClick={() => move(index, -1)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label={`Mover ${category.name} para cima`}
                title="Mover para cima"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={busy || index === order.length - 1}
                onClick={() => move(index, 1)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label={`Mover ${category.name} para baixo`}
                title="Mover para baixo"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {order.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
            Cadastre uma categoria para começar a organizar a ordem.
          </div>
        ) : null}
      </div>

      {message ? (
        <p
          className={`mt-4 text-sm font-semibold ${
            message.startsWith("Ordem salva")
              ? "text-emerald-700"
              : message.startsWith("Salvando")
                ? "text-orange-700"
                : "text-red-600"
          }`}
        >
          {message}
        </p>
      ) : null}
    </section>
  )
}
