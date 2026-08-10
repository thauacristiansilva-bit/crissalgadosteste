"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import { Bike, MapPin, Plus, Power, Trash2, UserPlus } from "lucide-react"
import type { Courier, DeliveryZone, StoreSettings } from "@/lib/types"

let leafletPromise: Promise<any> | null = null

function loadLeaflet() {
  if (typeof window === "undefined") return Promise.reject(new Error("Mapa indisponível."))
  const w = window as Window & { L?: any }
  if (w.L) return Promise.resolve(w.L)
  if (leafletPromise) return leafletPromise
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-cris-leaflet="1"]')) {
      const css = document.createElement("link")
      css.rel = "stylesheet"
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      css.dataset.crisLeaflet = "1"
      document.head.appendChild(css)
    }
    const existing = document.querySelector('script[data-cris-leaflet="1"]') as HTMLScriptElement | null
    if (existing) {
      const wait = () => w.L ? resolve(w.L) : window.setTimeout(wait, 100)
      wait()
      return
    }
    const script = document.createElement("script")
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    script.async = true
    script.dataset.crisLeaflet = "1"
    script.onload = () => w.L ? resolve(w.L) : reject(new Error("Leaflet não carregou."))
    script.onerror = () => reject(new Error("Não foi possível carregar o mapa."))
    document.body.appendChild(script)
  })
  return leafletPromise
}

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

export function DeliverySettings({
  settings,
  deliveryZones,
  couriers,
  onDeliveryZonesChanged,
  onCouriersChanged,
}: {
  settings: StoreSettings
  deliveryZones: DeliveryZone[]
  couriers: Courier[]
  onDeliveryZonesChanged: (zones: DeliveryZone[]) => void
  onCouriersChanged: (couriers: Courier[]) => void
}) {
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const zoneLayersRef = useRef<any[]>([])
  const previewRef = useRef<any>(null)
  const [mapError, setMapError] = useState("")
  const [mapReady, setMapReady] = useState(false)
  const [zoneBusy, setZoneBusy] = useState(false)
  const [zoneMessage, setZoneMessage] = useState("")
  const [zoneDraft, setZoneDraft] = useState({ name: "", fee: "5,00", radiusMeters: "1500", centerLat: settings.storeLatitude, centerLng: settings.storeLongitude })
  const [courierDraft, setCourierDraft] = useState({ name: "", phone: "", vehicle: "Moto" })
  const [courierBusy, setCourierBusy] = useState(false)
  const [courierMessage, setCourierMessage] = useState("")

  useEffect(() => {
    setMapReady(false)
    let disposed = false
    loadLeaflet().then((L) => {
      if (disposed || !mapContainer.current || mapRef.current) return
      const map = L.map(mapContainer.current, { zoomControl: true }).setView([settings.storeLatitude, settings.storeLongitude], 13)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors", maxZoom: 19 }).addTo(map)
      map.on("click", (event: any) => {
        setZoneDraft((current) => ({ ...current, centerLat: event.latlng.lat, centerLng: event.latlng.lng }))
      })
      mapRef.current = map
      setMapReady(true)
      window.setTimeout(() => map.invalidateSize(), 150)
    }).catch((error) => setMapError(error instanceof Error ? error.message : "Erro ao carregar mapa."))
    return () => {
      disposed = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [settings.storeLatitude, settings.storeLongitude])

  useEffect(() => {
    const w = window as Window & { L?: any }
    const L = w.L
    const map = mapRef.current
    if (!L || !map) return
    zoneLayersRef.current.forEach((layer) => map.removeLayer(layer))
    zoneLayersRef.current = deliveryZones.map((zone) => {
      const layer = L.circle([zone.centerLat, zone.centerLng], {
        radius: zone.radiusMeters,
        color: zone.active ? "#2563eb" : "#94a3b8",
        fillColor: zone.active ? "#60a5fa" : "#cbd5e1",
        fillOpacity: 0.16,
        weight: 2,
      }).addTo(map)
      layer.bindTooltip(`${zone.name} · ${money(zone.fee)} · ${(zone.radiusMeters / 1000).toFixed(1)} km`)
      return layer
    })
  }, [deliveryZones, mapReady])

  useEffect(() => {
    const w = window as Window & { L?: any }
    const L = w.L
    const map = mapRef.current
    if (!L || !map) return
    if (previewRef.current) map.removeLayer(previewRef.current)
    const radius = Number(zoneDraft.radiusMeters)
    if (!Number.isFinite(zoneDraft.centerLat) || !Number.isFinite(zoneDraft.centerLng) || !Number.isFinite(radius)) return
    previewRef.current = L.circle([zoneDraft.centerLat, zoneDraft.centerLng], { radius, color: "#ea580c", fillColor: "#fb923c", fillOpacity: 0.12, dashArray: "6 6", weight: 2 }).addTo(map)
  }, [zoneDraft.centerLat, zoneDraft.centerLng, zoneDraft.radiusMeters, mapReady])

  async function saveZone(event: FormEvent) {
    event.preventDefault()
    setZoneBusy(true)
    setZoneMessage("")
    try {
      const response = await fetch("/api/delivery-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...zoneDraft, fee: Number(zoneDraft.fee.replace(",", ".")), radiusMeters: Number(zoneDraft.radiusMeters) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar a área.")
      onDeliveryZonesChanged([...deliveryZones, data.deliveryZone])
      setZoneDraft((current) => ({ ...current, name: "", fee: "5,00" }))
      setZoneMessage("Área de entrega cadastrada.")
    } catch (error) {
      setZoneMessage(error instanceof Error ? error.message : "Erro ao salvar área.")
    } finally {
      setZoneBusy(false)
    }
  }

  async function patchZone(zone: DeliveryZone, patch: Partial<DeliveryZone>) {
    const response = await fetch(`/api/delivery-zones/${zone.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) })
    const data = await response.json()
    if (response.ok) onDeliveryZonesChanged(deliveryZones.map((item) => item.id === zone.id ? data.deliveryZone : item))
  }

  async function removeZone(zone: DeliveryZone) {
    if (!window.confirm(`Excluir a área ${zone.name}?`)) return
    const response = await fetch(`/api/delivery-zones/${zone.id}`, { method: "DELETE" })
    if (response.ok) onDeliveryZonesChanged(deliveryZones.filter((item) => item.id !== zone.id))
  }

  async function saveCourier(event: FormEvent) {
    event.preventDefault()
    setCourierBusy(true)
    setCourierMessage("")
    try {
      const response = await fetch("/api/couriers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(courierDraft) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível cadastrar.")
      onCouriersChanged([...couriers, data.courier])
      setCourierDraft({ name: "", phone: "", vehicle: "Moto" })
      setCourierMessage("Entregador cadastrado.")
    } catch (error) {
      setCourierMessage(error instanceof Error ? error.message : "Erro ao cadastrar entregador.")
    } finally {
      setCourierBusy(false)
    }
  }

  async function toggleCourier(courier: Courier) {
    const response = await fetch(`/api/couriers/${courier.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !courier.active }) })
    const data = await response.json()
    if (response.ok) onCouriersChanged(couriers.map((item) => item.id === courier.id ? data.courier : item))
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><MapPin className="h-5 w-5" /></div><div><h2 className="text-lg font-bold text-gray-900">Áreas e taxas de entrega</h2><p className="text-sm text-gray-500">Clique no mapa para definir o centro, escolha o raio e o valor. Você pode cadastrar várias áreas.</p></div></div>
        {mapError && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{mapError}</div>}
        <div ref={mapContainer} className="h-[420px] w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-100" />

        <form onSubmit={saveZone} className="mt-4 grid gap-3 rounded-2xl bg-gray-50 p-4 md:grid-cols-2 xl:grid-cols-5">
          <label><span className="mb-1 block text-xs font-bold uppercase text-gray-500">Nome da área</span><input required value={zoneDraft.name} onChange={(e) => setZoneDraft({ ...zoneDraft, name: e.target.value })} placeholder="Ex.: Centro" className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label>
          <label><span className="mb-1 block text-xs font-bold uppercase text-gray-500">Taxa</span><input required inputMode="decimal" value={zoneDraft.fee} onChange={(e) => setZoneDraft({ ...zoneDraft, fee: e.target.value })} className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label>
          <label><span className="mb-1 block text-xs font-bold uppercase text-gray-500">Raio (metros)</span><input required type="number" min="50" step="50" value={zoneDraft.radiusMeters} onChange={(e) => setZoneDraft({ ...zoneDraft, radiusMeters: e.target.value })} className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label>
          <div className="md:col-span-2 xl:col-span-1"><span className="mb-1 block text-xs font-bold uppercase text-gray-500">Centro</span><div className="h-10 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">{zoneDraft.centerLat.toFixed(5)}, {zoneDraft.centerLng.toFixed(5)}</div></div>
          <button disabled={zoneBusy} className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-xl bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50"><Plus className="h-4 w-4" />{zoneBusy ? "Salvando..." : "Cadastrar área"}</button>
        </form>
        {zoneMessage && <p className="mt-2 text-sm font-semibold text-blue-700">{zoneMessage}</p>}

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {deliveryZones.map((zone) => <article key={zone.id} className={`rounded-xl border p-3 ${zone.active ? "border-blue-200 bg-blue-50/50" : "border-gray-200 bg-gray-50 opacity-70"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-black text-gray-900">{zone.name}</p><p className="mt-1 text-sm text-gray-600">{money(zone.fee)} · raio {(zone.radiusMeters / 1000).toFixed(2)} km</p></div><div className="flex gap-1"><button onClick={() => patchZone(zone, { active: !zone.active })} type="button" className="rounded-lg p-2 text-gray-500 hover:bg-white" title={zone.active ? "Desativar" : "Ativar"}><Power className="h-4 w-4" /></button><button onClick={() => removeZone(zone)} type="button" className="rounded-lg p-2 text-red-500 hover:bg-white" title="Excluir"><Trash2 className="h-4 w-4" /></button></div></div></article>)}
          {!deliveryZones.length && <div className="rounded-xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500 md:col-span-2 xl:col-span-3">Nenhuma área cadastrada. Enquanto não houver área, novos pedidos de delivery serão bloqueados.</div>}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><Bike className="h-5 w-5" /></div><div><h2 className="text-lg font-bold text-gray-900">Entregadores</h2><p className="text-sm text-gray-500">Cadastre sua equipe para atribuir pedidos de delivery.</p></div></div>
        <form onSubmit={saveCourier} className="grid gap-3 rounded-2xl bg-gray-50 p-4 md:grid-cols-4"><label><span className="mb-1 block text-xs font-bold uppercase text-gray-500">Nome</span><input required value={courierDraft.name} onChange={(e) => setCourierDraft({ ...courierDraft, name: e.target.value })} className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label><label><span className="mb-1 block text-xs font-bold uppercase text-gray-500">Telefone</span><input required value={courierDraft.phone} onChange={(e) => setCourierDraft({ ...courierDraft, phone: e.target.value })} className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label><label><span className="mb-1 block text-xs font-bold uppercase text-gray-500">Veículo</span><input value={courierDraft.vehicle} onChange={(e) => setCourierDraft({ ...courierDraft, vehicle: e.target.value })} placeholder="Moto" className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label><button disabled={courierBusy} className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"><UserPlus className="h-4 w-4" />Cadastrar</button></form>
        {courierMessage && <p className="mt-2 text-sm font-semibold text-emerald-700">{courierMessage}</p>}
        <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200">{couriers.map((courier) => <div key={courier.id} className="flex items-center gap-3 p-3"><div className={`flex h-10 w-10 items-center justify-center rounded-full font-black ${courier.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>{courier.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="font-bold text-gray-900">{courier.name}</p><p className="text-xs text-gray-500">{courier.phone}{courier.vehicle ? ` · ${courier.vehicle}` : ""}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${courier.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{courier.active ? "Ativo" : "Inativo"}</span><button type="button" onClick={() => toggleCourier(courier)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Power className="h-4 w-4" /></button></div>)}{!couriers.length && <div className="p-6 text-center text-sm text-gray-500">Nenhum entregador cadastrado.</div>}</div>
      </section>
    </div>
  )
}
