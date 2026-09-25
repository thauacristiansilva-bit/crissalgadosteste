"use client"

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  BarChart3,
  CalendarClock,
  Copy,
  ExternalLink,
  Flame,
  Gift,
  MessageCircle,
  Pencil,
  Plus,
  Power,
  Send,
  Store,
  TicketPercent,
} from "lucide-react"
import type {
  Coupon,
  CustomerSummary,
  ProductPromotion,
  StoreSettings,
} from "@/lib/types"

type PromotionProduct = {
  id: number
  name: string
  category: string
  price: number
  active: boolean
}

const dayOptions = [
  [0, "Dom"],
  [1, "Seg"],
  [2, "Ter"],
  [3, "Qua"],
  [4, "Qui"],
  [5, "Sex"],
  [6, "Sab"],
] as const

const allDays: number[] =
  dayOptions.map(([day]) => Number(day))

const money = (value: number) =>
  new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    },
  ).format(value)

function emptyPromotionDraft() {
  return {
    productId: "",
    promotionalPrice: "",
    startDate: "",
    endDate: "",
    daysOfWeek: [...allDays],
    startTime: "00:00",
    endTime: "23:59",
    recurringWeekly: true,
    active: true,
    highlight: true,
    label: "Oferta",
  }
}

function promotionPeriod(
  promotion: ProductPromotion,
) {
  const dates =
    promotion.startDate ||
    promotion.endDate
      ? `${promotion.startDate || "sem inicio"} ate ${promotion.endDate || "sem fim"}`
      : "sem limite de data"

  return `${dates} · ${promotion.startTime}–${promotion.endTime}`
}

export function MarketingPanel({
  coupons: initialCoupons,
  customers,
  settings,
  onSettingsChanged,
}: {
  coupons: Coupon[]
  customers: CustomerSummary[]
  settings: StoreSettings
  onSettingsChanged: (
    settings: StoreSettings,
  ) => void
}) {
  const [coupons, setCoupons] =
    useState(initialCoupons)

  const [draft, setDraft] =
    useState({
      code: "",
      description: "",
      type: "percent" as
        | "percent"
        | "fixed",
      value: "10",
      minimumOrder: "0",
    })

  const [segment, setSegment] =
    useState("all")

  const [bulkText, setBulkText] =
    useState(
      () =>
        `Olá! Temos novidades no cardápio da ${settings.storeName} 😋`,
    )

  const [message, setMessage] =
    useState("")

  const [loyalty, setLoyalty] =
    useState({
      enabled:
        settings.loyaltyEnabled,
      points:
        settings.loyaltyPointsPerReal,
      rewardPoints:
        settings.loyaltyRewardPoints,
      rewardText:
        settings.loyaltyRewardText,
    })

  const [promotionProducts, setPromotionProducts] =
    useState<PromotionProduct[]>([])

  const [promotions, setPromotions] =
    useState<ProductPromotion[]>([])

  const [promotionReady, setPromotionReady] =
    useState(true)

  const [promotionBusy, setPromotionBusy] =
    useState(false)

  const [editingPromotionId, setEditingPromotionId] =
    useState<string | null>(null)

  const [promotionDraft, setPromotionDraft] =
    useState(
      emptyPromotionDraft,
    )

  const audience = useMemo(
    () =>
      customers.filter(
        (customer) =>
          segment === "all" ||
          customer.segment ===
            segment ||
          customer.lifecycle ===
            segment,
      ),
    [customers, segment],
  )

  const selectedProduct =
    promotionProducts.find(
      (product) =>
        product.id ===
        Number(
          promotionDraft.productId,
        ),
    ) || null

  useEffect(() => {
    let disposed = false

    fetch("/api/promotions", {
      cache: "no-store",
    })
      .then(async (response) => {
        const data =
          await response.json()

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Erro ao carregar promoções.",
          )
        }

        if (disposed) return

        setPromotionReady(
          data.ready !== false,
        )
        setPromotions(
          Array.isArray(
            data.promotions,
          )
            ? data.promotions
            : [],
        )
        setPromotionProducts(
          Array.isArray(
            data.products,
          )
            ? data.products
            : [],
        )
      })
      .catch((error) => {
        if (!disposed) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Erro ao carregar promoções.",
          )
        }
      })

    return () => {
      disposed = true
    }
  }, [])

  async function addCoupon(
    event: FormEvent,
  ) {
    event.preventDefault()

    const response =
      await fetch(
        "/api/coupons",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            ...draft,
            value: Number(
              draft.value.replace(
                ",",
                ".",
              ),
            ),
            minimumOrder: Number(
              draft.minimumOrder.replace(
                ",",
                ".",
              ),
            ),
            active: true,
          }),
        },
      )

    const data =
      await response.json()

    if (!response.ok) {
      setMessage(
        data.error ||
          "Erro ao criar cupom.",
      )
      return
    }

    setCoupons([
      ...coupons,
      data.coupon,
    ])

    setDraft({
      code: "",
      description: "",
      type: "percent",
      value: "10",
      minimumOrder: "0",
    })

    setMessage("Cupom criado.")
  }

  async function toggleCoupon(
    coupon: Coupon,
  ) {
    const response =
      await fetch(
        `/api/coupons/${coupon.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            active:
              !coupon.active,
          }),
        },
      )

    const data =
      await response.json()

    if (response.ok) {
      setCoupons(
        coupons.map((item) =>
          item.id === coupon.id
            ? data.coupon
            : item,
        ),
      )
    }
  }

  async function saveLoyalty() {
    const response =
      await fetch(
        "/api/settings",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            loyaltyEnabled:
              loyalty.enabled,
            loyaltyPointsPerReal:
              loyalty.points,
            loyaltyRewardPoints:
              loyalty.rewardPoints,
            loyaltyRewardText:
              loyalty.rewardText,
          }),
        },
      )

    const data =
      await response.json()

    if (response.ok) {
      onSettingsChanged(
        data.settings,
      )
      setMessage(
        "Programa de fidelidade atualizado.",
      )
    }
  }

  function openWhatsApp(
    customer: CustomerSummary,
  ) {
    const phone =
      customer.phone.replace(
        /\D/g,
        "",
      )

    if (!phone) return

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(bulkText)}`,
      "_blank",
    )
  }

  function togglePromotionDay(
    day: number,
  ) {
    setPromotionDraft(
      (current) => {
        const has =
          current.daysOfWeek.includes(
            day,
          )

        return {
          ...current,
          daysOfWeek: has
            ? current.daysOfWeek.filter(
                (item) =>
                  item !== day,
              )
            : [
                ...current.daysOfWeek,
                day,
              ].sort(
                (a, b) => a - b,
              ),
        }
      },
    )
  }

  function resetPromotionForm() {
    setEditingPromotionId(null)
    setPromotionDraft(
      emptyPromotionDraft(),
    )
  }

  function editPromotion(
    promotion: ProductPromotion,
  ) {
    setEditingPromotionId(
      promotion.id,
    )

    setPromotionDraft({
      productId: String(
        promotion.productId,
      ),
      promotionalPrice: String(
        promotion.promotionalPrice,
      ).replace(".", ","),
      startDate:
        promotion.startDate || "",
      endDate:
        promotion.endDate || "",
      daysOfWeek: [
        ...promotion.daysOfWeek,
      ],
      startTime:
        promotion.startTime,
      endTime:
        promotion.endTime,
      recurringWeekly:
        promotion.recurringWeekly,
      active:
        promotion.active,
      highlight:
        promotion.highlight,
      label:
        promotion.label,
    })

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }

  async function savePromotion(
    event: FormEvent,
  ) {
    event.preventDefault()

    if (
      !promotionDraft.productId
    ) {
      setMessage(
        "Selecione um produto.",
      )
      return
    }

    if (
      !promotionDraft
        .daysOfWeek.length
    ) {
      setMessage(
        "Selecione pelo menos um dia da semana.",
      )
      return
    }

    const promotionalPrice =
      Number(
        promotionDraft.promotionalPrice
          .replace(",", "."),
      )

    setPromotionBusy(true)
    setMessage("")

    try {
      const editing =
        Boolean(
          editingPromotionId,
        )

      const response =
        await fetch(
          editing
            ? `/api/promotions/${editingPromotionId}`
            : "/api/promotions",
          {
            method:
              editing
                ? "PATCH"
                : "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              ...promotionDraft,
              productId: Number(
                promotionDraft.productId,
              ),
              promotionalPrice,
            }),
          },
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Erro ao salvar promoção.",
        )
      }

      const promotion =
        data.promotion as ProductPromotion

      setPromotions(
        (current) =>
          editing
            ? current.map(
                (item) =>
                  item.id ===
                  promotion.id
                    ? promotion
                    : item,
              )
            : [
                promotion,
                ...current,
              ],
      )

      resetPromotionForm()

      setMessage(
        editing
          ? "Promoção atualizada."
          : "Promoção criada.",
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Erro ao salvar promoção.",
      )
    } finally {
      setPromotionBusy(false)
    }
  }

  async function togglePromotion(
    promotion: ProductPromotion,
  ) {
    setPromotionBusy(true)
    setMessage("")

    try {
      const response =
        await fetch(
          `/api/promotions/${promotion.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              active:
                !promotion.active,
            }),
          },
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Erro ao alterar promoção.",
        )
      }

      setPromotions(
        (current) =>
          current.map((item) =>
            item.id ===
            promotion.id
              ? data.promotion
              : item,
          ),
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Erro ao alterar promoção.",
      )
    } finally {
      setPromotionBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-orange-600 p-2 text-white">
            <Flame className="h-5 w-5" />
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-700">
              Regra obrigatória
            </p>
            <h2 className="mt-1 text-lg font-black text-gray-950">
              Promoção somente para pedido imediato
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-700">
              O preço promocional vale apenas quando o cliente escolhe
              <strong> Para agora</strong>. Qualquer agendamento,
              inclusive para mais tarde no mesmo dia, volta automaticamente
              ao preço normal. O servidor valida essa regra novamente antes
              de criar o pedido.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-orange-600" />
            <div>
              <h2 className="font-black">
                Promoções de produtos
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Defina preco, dias e horario. Se duas promoções coincidirem,
                o menor preco valido vence.
              </p>
            </div>
          </div>

          {editingPromotionId && (
            <button
              type="button"
              onClick={resetPromotionForm}
              className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-600"
            >
              Cancelar edicao
            </button>
          )}
        </div>

        {!promotionReady && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
            A migration 039 ainda precisa ser aplicada no PostgreSQL antes
            de cadastrar promoções.
          </div>
        )}

        <form
          onSubmit={savePromotion}
          className="mt-5 grid gap-4"
        >
          <div className="grid gap-3 md:grid-cols-3">
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-black uppercase text-gray-500">
                Produto
              </span>
              <select
                required
                value={promotionDraft.productId}
                onChange={(event) =>
                  setPromotionDraft({
                    ...promotionDraft,
                    productId:
                      event.target.value,
                  })
                }
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
              >
                <option value="">
                  Selecione
                </option>
                {promotionProducts
                  .filter(
                    (product) =>
                      product.active,
                  )
                  .map((product) => (
                    <option
                      key={product.id}
                      value={product.id}
                    >
                      {product.name} · {money(product.price)}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-xs font-black uppercase text-gray-500">
                Preço promocional
              </span>
              <input
                required
                inputMode="decimal"
                value={
                  promotionDraft.promotionalPrice
                }
                onChange={(event) =>
                  setPromotionDraft({
                    ...promotionDraft,
                    promotionalPrice:
                      event.target.value,
                  })
                }
                placeholder="Ex.: 5,99"
                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"
              />
              {selectedProduct && (
                <small className="mt-1 block text-gray-400">
                  Normal: {money(selectedProduct.price)}
                </small>
              )}
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label>
              <span className="mb-1 block text-xs font-black uppercase text-gray-500">
                Rótulo
              </span>
              <input
                value={promotionDraft.label}
                onChange={(event) =>
                  setPromotionDraft({
                    ...promotionDraft,
                    label:
                      event.target.value,
                  })
                }
                maxLength={40}
                placeholder="Oferta"
                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-black uppercase text-gray-500">
                Início da validade
              </span>
              <input
                type="date"
                value={promotionDraft.startDate}
                onChange={(event) =>
                  setPromotionDraft({
                    ...promotionDraft,
                    startDate:
                      event.target.value,
                  })
                }
                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-black uppercase text-gray-500">
                Fim da validade
              </span>
              <input
                type="date"
                value={promotionDraft.endDate}
                onChange={(event) =>
                  setPromotionDraft({
                    ...promotionDraft,
                    endDate:
                      event.target.value,
                  })
                }
                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"
              />
            </label>
          </div>

          <div>
            <span className="mb-2 block text-xs font-black uppercase text-gray-500">
              Dias da semana
            </span>
            <div className="flex flex-wrap gap-2">
              {dayOptions.map(
                ([day, label]) => {
                  const active =
                    promotionDraft.daysOfWeek.includes(
                      day,
                    )

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() =>
                        togglePromotionDay(
                          day,
                        )
                      }
                      className={`rounded-xl border px-3 py-2 text-xs font-black ${
                        active
                          ? "border-orange-300 bg-orange-50 text-orange-700"
                          : "border-gray-200 bg-white text-gray-500"
                      }`}
                    >
                      {active ? "✓ " : ""}
                      {label}
                    </button>
                  )
                },
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-black uppercase text-gray-500">
                Começa às
              </span>
              <input
                type="time"
                required
                value={promotionDraft.startTime}
                onChange={(event) =>
                  setPromotionDraft({
                    ...promotionDraft,
                    startTime:
                      event.target.value,
                  })
                }
                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-black uppercase text-gray-500">
                Termina às
              </span>
              <input
                type="time"
                required
                value={promotionDraft.endTime}
                onChange={(event) =>
                  setPromotionDraft({
                    ...promotionDraft,
                    endTime:
                      event.target.value,
                  })
                }
                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"
              />
            </label>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3">
              <span>
                <strong className="block text-sm">
                  Repetir toda semana
                </strong>
                <small className="text-gray-500">
                  Usa os dias marcados
                </small>
              </span>
              <input
                type="checkbox"
                checked={
                  promotionDraft.recurringWeekly
                }
                onChange={(event) =>
                  setPromotionDraft({
                    ...promotionDraft,
                    recurringWeekly:
                      event.target.checked,
                  })
                }
                className="h-5 w-5"
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3">
              <span>
                <strong className="block text-sm">
                  Destacar no cardápio
                </strong>
                <small className="text-gray-500">
                  Mostra selo de oferta
                </small>
              </span>
              <input
                type="checkbox"
                checked={
                  promotionDraft.highlight
                }
                onChange={(event) =>
                  setPromotionDraft({
                    ...promotionDraft,
                    highlight:
                      event.target.checked,
                  })
                }
                className="h-5 w-5"
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3">
              <span>
                <strong className="block text-sm">
                  Promoção ativa
                </strong>
                <small className="text-gray-500">
                  Pode entrar em vigor
                </small>
              </span>
              <input
                type="checkbox"
                checked={
                  promotionDraft.active
                }
                onChange={(event) =>
                  setPromotionDraft({
                    ...promotionDraft,
                    active:
                      event.target.checked,
                  })
                }
                className="h-5 w-5"
              />
            </label>
          </div>

          <button
            disabled={
              promotionBusy ||
              !promotionReady
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-black text-white disabled:opacity-50"
          >
            {editingPromotionId ? (
              <Pencil className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {promotionBusy
              ? "Salvando..."
              : editingPromotionId
                ? "Salvar alteracoes"
                : "Criar promoção"}
          </button>
        </form>

        <div className="mt-5 space-y-2">
          {!promotions.length && (
            <div className="rounded-xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-400">
              Nenhuma promoção cadastrada.
            </div>
          )}

          {promotions.map(
            (promotion) => (
              <article
                key={promotion.id}
                className="rounded-2xl border border-gray-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm text-gray-950">
                        {promotion.productName}
                      </strong>

                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-black ${
                          promotion.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {promotion.active
                          ? "ATIVA"
                          : "PAUSADA"}
                      </span>

                      {promotion.highlight && (
                        <span className="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-black text-orange-700">
                          DESTAQUE
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-sm">
                      <span className="text-gray-400 line-through">
                        {money(promotion.normalPrice)}
                      </span>
                      <strong className="ml-2 text-orange-600">
                        {money(promotion.promotionalPrice)}
                      </strong>
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      {promotion.daysOfWeek
                        .map(
                          (day) =>
                            dayOptions.find(
                              ([value]) =>
                                value === day,
                            )?.[1],
                        )
                        .filter(Boolean)
                        .join(", ")}
                      {" · "}
                      {promotionPeriod(
                        promotion,
                      )}
                    </p>

                    <p className="mt-1 text-[11px] font-bold text-gray-400">
                      {promotion.label}
                      {promotion.recurringWeekly
                        ? " · recorrente"
                        : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        editPromotion(
                          promotion,
                        )
                      }
                      className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      disabled={promotionBusy}
                      onClick={() =>
                        togglePromotion(
                          promotion,
                        )
                      }
                      className={`rounded-lg p-2 ${
                        promotion.active
                          ? "text-emerald-600"
                          : "text-gray-400"
                      }`}
                      title={
                        promotion.active
                          ? "Pausar"
                          : "Ativar"
                      }
                    >
                      <Power className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ),
          )}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <TicketPercent className="h-5 w-5 text-blue-700" />
            <h2 className="font-black">
              Cupons de desconto
            </h2>
          </div>

          <form
            onSubmit={addCoupon}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <input
              required
              value={draft.code}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  code:
                    event.target.value.toUpperCase(),
                })
              }
              placeholder="CODIGO"
              className="h-10 rounded-xl border border-gray-200 px-3 text-sm uppercase"
            />

            <input
              value={draft.description}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  description:
                    event.target.value,
                })
              }
              placeholder="Descrição"
              className="h-10 rounded-xl border border-gray-200 px-3 text-sm"
            />

            <select
              value={draft.type}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  type:
                    event.target.value as
                      | "percent"
                      | "fixed",
                })
              }
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="percent">
                Percentual (%)
              </option>
              <option value="fixed">
                Valor fixo (R$)
              </option>
            </select>

            <input
              value={draft.value}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  value:
                    event.target.value,
                })
              }
              placeholder="Valor"
              className="h-10 rounded-xl border border-gray-200 px-3 text-sm"
            />

            <input
              value={draft.minimumOrder}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  minimumOrder:
                    event.target.value,
                })
              }
              placeholder="Pedido mínimo"
              className="h-10 rounded-xl border border-gray-200 px-3 text-sm"
            />

            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 text-sm font-black text-white">
              <Plus className="h-4 w-4" />
              Criar cupom
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {coupons.map(
              (coupon) => (
                <div
                  key={coupon.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-black">
                      {coupon.code}
                    </p>
                    <p className="text-xs text-gray-500">
                      {coupon.type ===
                      "percent"
                        ? `${coupon.value}%`
                        : money(
                            coupon.value,
                          )}
                      {" · minimo "}
                      {money(
                        coupon.minimumOrder,
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        coupon.code,
                      )
                    }
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                  >
                    <Copy className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      toggleCoupon(
                        coupon,
                      )
                    }
                    className={`rounded-lg p-2 ${
                      coupon.active
                        ? "text-emerald-600"
                        : "text-gray-400"
                    }`}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                </div>
              ),
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-violet-700" />
            <h2 className="font-black">
              Programa de fidelidade
            </h2>
          </div>

          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between rounded-xl border border-gray-200 p-3">
              <span>
                <strong className="block text-sm">
                  Ativar pontos
                </strong>
                <small className="text-gray-500">
                  Clientes logados acumulam pontos automaticamente.
                </small>
              </span>
              <input
                type="checkbox"
                checked={loyalty.enabled}
                onChange={(event) =>
                  setLoyalty({
                    ...loyalty,
                    enabled:
                      event.target.checked,
                  })
                }
                className="h-5 w-5"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  Pontos por R$ 1
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={loyalty.points}
                  onChange={(event) =>
                    setLoyalty({
                      ...loyalty,
                      points: Number(
                        event.target.value,
                      ),
                    })
                  }
                  className="h-10 w-full rounded-xl border border-gray-200 px-3"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  Meta de pontos
                </span>
                <input
                  type="number"
                  min="1"
                  value={
                    loyalty.rewardPoints
                  }
                  onChange={(event) =>
                    setLoyalty({
                      ...loyalty,
                      rewardPoints:
                        Number(
                          event.target.value,
                        ),
                    })
                  }
                  className="h-10 w-full rounded-xl border border-gray-200 px-3"
                />
              </label>
            </div>

            <textarea
              value={loyalty.rewardText}
              onChange={(event) =>
                setLoyalty({
                  ...loyalty,
                  rewardText:
                    event.target.value,
                })
              }
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="Benefício do programa"
            />

            <button
              type="button"
              onClick={saveLoyalty}
              className="h-10 w-full rounded-xl bg-violet-700 text-sm font-black text-white"
            >
              Salvar fidelidade
            </button>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5 text-emerald-700" />
          <h2 className="font-black">
            Envio em massa pelo WhatsApp
          </h2>
        </div>

        <p className="mt-1 text-sm text-gray-500">
          Selecione um segmento e abra as conversas uma a uma.
          Para automacao real em massa, conecte a API oficial do
          WhatsApp Business.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
          <select
            value={segment}
            onChange={(event) =>
              setSegment(
                event.target.value,
              )
            }
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"
          >
            <option value="all">
              Todos
            </option>
            <option value="elite">
              Comprador Elite
            </option>
            <option value="frequent">
              Comprador frequente
            </option>
            <option value="repeat">
              Comprador repetido
            </option>
            <option value="active">
              Ativos
            </option>
            <option value="sleeping">
              Dormindo
            </option>
            <option value="inactive">
              Inativos
            </option>
          </select>

          <textarea
            value={bulkText}
            onChange={(event) =>
              setBulkText(
                event.target.value,
              )
            }
            rows={2}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {audience
            .slice(0, 50)
            .map((customer) => (
              <button
                key={customer.key}
                type="button"
                onClick={() =>
                  openWhatsApp(
                    customer,
                  )
                }
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {customer.name}
              </button>
            ))}
        </div>

        <p className="mt-3 text-xs text-gray-400">
          Público selecionado: {audience.length} cliente(s).
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-blue-700" />
            <h2 className="font-black">
              Google para o negócio
            </h2>
          </div>

          <p className="mt-2 text-sm text-gray-500">
            Centralize o link do Perfil da Empresa e leve clientes para
            Maps/Pesquisa.
          </p>

          {settings.googleBusinessUrl ? (
            <a
              href={
                settings.googleBusinessUrl
              }
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-blue-50 px-3 text-sm font-black text-blue-700"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir Perfil da Empresa
            </a>
          ) : (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700">
              Configure o link em Configurações → Avaliações e Google.
            </p>
          )}
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-violet-700" />
            <h2 className="font-black">
              Ferramentas de rastreamento
            </h2>
          </div>

          <p className="mt-2 text-sm text-gray-500">
            IDs preparados para Google Analytics e Meta Pixel nas
            configurações.
          </p>

          <div className="mt-4 grid gap-2 text-xs">
            <div className="rounded-xl bg-gray-50 p-3">
              <strong>
                Google Analytics:
              </strong>{" "}
              {settings.googleAnalyticsId ||
                "não configurado"}
            </div>

            <div className="rounded-xl bg-gray-50 p-3">
              <strong>
                Meta Pixel:
              </strong>{" "}
              {settings.metaPixelId ||
                "não configurado"}
            </div>
          </div>
        </article>
      </section>

      {message && (
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
          {message}
        </div>
      )}
    </div>
  )
}
