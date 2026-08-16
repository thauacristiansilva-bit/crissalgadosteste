"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  CheckCircle2,
  Crosshair,
  Link2Off,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  Route,
  Truck,
  UserRoundCheck,
} from "lucide-react"
import { OperationalShell } from "@/components/operational/operational-shell"
import type { Courier, Order, OrderStatus } from "@/lib/types"

type CourierPosition = {
  latitude: number
  longitude: number
  accuracy: number | null
}

function address(order: Order) {
  return [
    order.customer.address,
    order.customer.number,
    order.customer.district,
    order.customer.city,
    order.customer.state,
  ]
    .filter(Boolean)
    .join(", ")
}

function destinationValue(order: Order) {
  const hasCoordinates =
    order.customer.latitude !== null &&
    order.customer.latitude !== undefined &&
    order.customer.longitude !== null &&
    order.customer.longitude !== undefined
  const latitude = Number(order.customer.latitude)
  const longitude = Number(order.customer.longitude)
  if (hasCoordinates && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `${latitude},${longitude}`
  }
  return address(order)
}

function directionsUrl(order: Order, position?: CourierPosition | null) {
  const destination = destinationValue(order)
  if (!destination) return null

  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "driving",
  })

  if (position) {
    params.set("origin", `${position.latitude},${position.longitude}`)
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`
}

function getCurrentPosition(): Promise<CourierPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este aparelho não oferece GPS pelo navegador."))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
        }),
      () => reject(new Error("Permita o acesso à localização para gerar a rota e compartilhar o GPS da entrega.")),
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 5000,
      },
    )
  })
}

export function CourierWorkspace({
  organizationName,
  initialOrders,
  selfMode,
  courier,
}: {
  organizationName: string
  initialOrders: Order[]
  selfMode: boolean
  courier: Courier | null
}) {
  const [orders, setOrders] = useState(initialOrders)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [message, setMessage] = useState("")
  const [gpsMessage, setGpsMessage] = useState("")
  const [position, setPosition] = useState<CourierPosition | null>(null)
  const lastLocationSentAt = useRef(0)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    const refresh = async () => {
      const response = await fetch("/api/dashboard", { cache: "no-store" }).catch(
        () => null,
      )
      if (!response?.ok) return
      const data = (await response.json()) as { orders?: Order[] }
      if (Array.isArray(data.orders)) setOrders(data.orders)
    }

    const id = window.setInterval(refresh, 5000)
    return () => window.clearInterval(id)
  }, [])

  const deliveries = useMemo(
    () =>
      orders
        .filter(
          (order) =>
            order.type === "delivery" &&
            ["ready", "in-route"].includes(order.status),
        )
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === "in-route" ? -1 : 1
          return (
            new Date(a.requestedFor).getTime() -
            new Date(b.requestedFor).getTime()
          )
        }),
    [orders],
  )

  const activeOrder = useMemo(
    () => deliveries.find((order) => order.status === "in-route") || null,
    [deliveries],
  )

  async function publishLocation(next: CourierPosition) {
    if (!selfMode || !activeOrder) return

    const response = await fetch("/api/courier/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: next.latitude,
        longitude: next.longitude,
        accuracyMeters: next.accuracy,
      }),
    }).catch(() => null)

    if (!response) {
      setGpsMessage("Sem conexão para atualizar o GPS. O sistema tentará novamente automaticamente.")
      return
    }

    if (!response.ok) {
      const data = await response.json().catch(() => null)
      setGpsMessage(data?.error || "Não foi possível compartilhar o GPS desta entrega.")
      return
    }

    setGpsMessage("GPS ativo. A localização só é liberada para o cliente da entrega atual.")
  }

  useEffect(() => {
    if (!selfMode || !activeOrder || !("wakeLock" in navigator)) return

    let disposed = false
    const acquire = async () => {
      if (document.visibilityState !== "visible" || disposed) return
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen")
      } catch {
        // Wake Lock é uma melhoria de confiabilidade; GPS continua funcionando
        // mesmo quando o navegador/aparelho não oferecer esse recurso.
      }
    }

    void acquire()
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        void acquire()
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      disposed = true
      document.removeEventListener("visibilitychange", onVisibilityChange)
      void wakeLockRef.current?.release().catch(() => undefined)
      wakeLockRef.current = null
    }
  }, [activeOrder?.id, selfMode])

  useEffect(() => {
    if (!selfMode || !courier || !activeOrder || !navigator.geolocation) return

    setGpsMessage("Ativando GPS da entrega atual...")
    const watchId = navigator.geolocation.watchPosition(
      (geo) => {
        const next: CourierPosition = {
          latitude: geo.coords.latitude,
          longitude: geo.coords.longitude,
          accuracy: Number.isFinite(geo.coords.accuracy)
            ? geo.coords.accuracy
            : null,
        }
        setPosition(next)

        const now = Date.now()
        if (now - lastLocationSentAt.current >= 5000) {
          lastLocationSentAt.current = now
          void publishLocation(next)
        }
      },
      () => {
        setGpsMessage(
          "GPS indisponível. Ative a localização do aparelho e permita o acesso ao navegador.",
        )
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 15000,
      },
    )

    return () => navigator.geolocation.clearWatch(watchId)
    // A troca da entrega ativa encerra o watch anterior e inicia outro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrder?.id, courier?.id, selfMode])

  async function patchStatus(orderId: number, status: OrderStatus) {
    const response = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || "Não foi possível atualizar a entrega.")
    }
    const updated = data.order as Order
    setOrders((current) =>
      current.map((order) => (order.id === updated.id ? updated : order)),
    )
    return updated
  }

  async function startDelivery(order: Order) {
    setBusyId(order.id)
    setMessage("")
    setGpsMessage("")

    try {
      let current: CourierPosition | null = null
      if (selfMode) {
        try {
          current = await getCurrentPosition()
          setPosition(current)
        } catch (error) {
          setGpsMessage(
            error instanceof Error
              ? error.message
              : "Não foi possível obter a localização atual.",
          )
        }
      }

      await patchStatus(order.id, "in-route")

      if (selfMode && current) {
        await fetch("/api/courier/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: current.latitude,
            longitude: current.longitude,
            accuracyMeters: current.accuracy,
          }),
        }).catch(() => null)
      }

      setMessage(
        selfMode
          ? "Entrega iniciada. A rota foi preparada e o GPS ficará restrito ao cliente desta entrega."
          : "Entrega marcada como em rota. O GPS será publicado pelo aparelho do entregador vinculado.",
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar a entrega.",
      )
    } finally {
      setBusyId(null)
    }
  }

  async function completeDelivery(order: Order) {
    setBusyId(order.id)
    setMessage("")
    try {
      await patchStatus(order.id, "completed")
      setGpsMessage("")
      setPosition(null)
      setMessage("Entrega concluída. O compartilhamento de localização foi encerrado.")
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível finalizar a entrega.",
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <OperationalShell
      title={selfMode ? "Minhas entregas" : "Expedição de entregas"}
      subtitle={
        selfMode
          ? "Uma entrega por vez: o sistema gera a navegação até o cliente e compartilha seu GPS somente com o pedido que estiver ativo."
          : "Acompanhe entregas prontas e em rota. Cada entregador mantém apenas uma entrega ativa por vez."
      }
      organizationName={organizationName}
      roleLabel={selfMode ? "Entregador" : "Gestão de entrega"}
    >
      {selfMode && !courier && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <div className="flex items-start gap-3">
            <Link2Off className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h2 className="font-black">Login ainda não vinculado ao perfil de entregador</h2>
              <p className="mt-1 text-sm leading-relaxed">
                O administrador precisa abrir Configurações → Entregadores e vincular este colaborador a um perfil operacional de entrega.
              </p>
            </div>
          </div>
        </div>
      )}

      {selfMode && courier && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
          <UserRoundCheck className="h-5 w-5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Perfil vinculado</p>
            <p className="font-black">{courier.name}{courier.vehicle ? ` · ${courier.vehicle}` : ""}</p>
          </div>
          {activeOrder && <span className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-black text-white">ROTA ATIVA</span>}
        </div>
      )}

      {selfMode && activeOrder && (
        <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Navigation className="mt-0.5 h-5 w-5 text-blue-700" />
              <div>
                <p className="font-black">Entrega ativa: {activeOrder.code}</p>
                <p className="mt-1 text-sm">{gpsMessage || "Aguardando atualização do GPS."}</p>
              </div>
            </div>
            {directionsUrl(activeOrder, position) && (
              <a
                href={directionsUrl(activeOrder, position) || undefined}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white"
              >
                <Route className="h-4 w-4" />Abrir rota
              </a>
            )}
          </div>
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500"><PackageCheck className="h-4 w-4" />Prontas para sair</div>
          <p className="mt-2 text-3xl font-black">{deliveries.filter((order) => order.status === "ready").length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500"><Truck className="h-4 w-4" />Em rota</div>
          <p className="mt-2 text-3xl font-black">{deliveries.filter((order) => order.status === "in-route").length}</p>
        </div>
      </div>

      {message && (
        <p className={`mb-4 rounded-xl px-3 py-2 text-sm font-semibold ${message.toLowerCase().includes("conclu") || message.toLowerCase().includes("iniciada") ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {message}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {deliveries.map((order) => {
          const destination = address(order)
          const routeHref = directionsUrl(order, position)
          const mayOperate =
            !selfMode || Boolean(courier && order.courierId === courier.id)
          const blockedByAnother =
            selfMode && Boolean(activeOrder && activeOrder.id !== order.id)

          return (
            <article
              key={order.id}
              className={`rounded-2xl border bg-white p-4 shadow-sm ${order.status === "in-route" ? "border-blue-300 ring-1 ring-blue-100" : "border-slate-200"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-xl">{order.code}</strong>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${order.status === "in-route" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {order.status === "in-route" ? "Em rota" : "Pronto"}
                    </span>
                  </div>
                  {order.courierName && <p className="mt-1 text-xs font-bold text-slate-500">Atribuído: {order.courierName}</p>}
                  {!order.courierId && !selfMode && <p className="mt-1 text-xs font-bold text-amber-700">Ainda sem entregador atribuído</p>}
                </div>
                <Navigation className="h-5 w-5 text-blue-700" />
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <p className="font-black text-slate-900">{order.customer.name}</p>
                <p className="flex items-start gap-2 text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{destination || "Endereço não informado"}</p>
                {order.customer.phone && <p className="flex items-center gap-2 text-slate-600"><Phone className="h-4 w-4" />{order.customer.phone}</p>}
                {order.notes && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"><strong>Obs.:</strong> {order.notes}</p>}
              </div>

              {blockedByAnother && order.status === "ready" && (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                  Finalize {activeOrder?.code} antes de iniciar esta entrega.
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {routeHref && (
                  <a
                    href={routeHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-bold text-blue-700"
                  >
                    {position ? <Navigation className="h-4 w-4" /> : <Crosshair className="h-4 w-4" />}
                    {order.status === "in-route" ? "Abrir rota" : "Prévia da rota"}
                  </a>
                )}

                {mayOperate && order.status === "ready" && order.courierId && (
                  <button
                    type="button"
                    disabled={busyId === order.id || blockedByAnother}
                    onClick={() => startDelivery(order)}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-700 px-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Truck className="h-4 w-4" />Iniciar entrega
                  </button>
                )}

                {mayOperate && order.status === "in-route" && (
                  <button
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => completeDelivery(order)}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />Finalizar entrega
                  </button>
                )}
              </div>
            </article>
          )
        })}

        {deliveries.length === 0 && (
          <div className="lg:col-span-2 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Truck className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="mt-3 font-black">Nenhuma entrega disponível</h2>
            <p className="mt-1 text-sm text-slate-500">
              {selfMode
                ? "Somente pedidos atribuídos ao seu perfil aparecerão aqui."
                : "Pedidos prontos para delivery aparecerão aqui automaticamente."}
            </p>
          </div>
        )}
      </div>
    </OperationalShell>
  )
}
