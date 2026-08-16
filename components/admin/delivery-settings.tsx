"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { Bike, Crosshair, MapPin, Plus, Power, Save, Trash2, UserPlus } from "lucide-react"
import type { Courier, DeliveryDistanceBand, DeliveryPricingMode, DeliveryZone, GeoPoint, StaffMember, StoreSettings } from "@/lib/types"
import { googleMapsMapId, hasGoogleMapsKey, loadGoogleMaps } from "@/lib/google-maps-client"
import { deliveryZoneAreaScore, deliveryZoneColor, nextDeliveryZoneColor, snapPointToDeliveryBoundaries, validateDeliveryPolygon } from "@/lib/delivery-zone-geometry"
import { HelpLabel, HelpTip } from "@/components/admin/help-tip"

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
const numberValue = (value: string) => Number(value.replace(",", "."))

const pricingModes: Array<{ value: DeliveryPricingMode; title: string; description: string; icon: string }> = [
  { value: "free", title: "Sem preço", description: "Frete grátis em todos os pedidos", icon: "🪙" },
  { value: "fixed", title: "Preço fixo", description: "O mesmo valor para qualquer entrega", icon: "📦" },
  { value: "distance", title: "Distância percorrida", description: "Taxa calculada pelos quilômetros de carro", icon: "🛣️" },
  { value: "customAreas", title: "Áreas personalizadas", description: "Desenhe polígonos no mapa e defina um preço por área", icon: "🗺️" },
  { value: "distanceBands", title: "Faixas por distância", description: "Defina preços para intervalos de quilômetros", icon: "📍" },
]

export function DeliverySettings({
  settings,
  deliveryZones,
  couriers,
  staffMembers,
  onSettingsChanged,
  onDeliveryZonesChanged,
  onCouriersChanged,
}: {
  settings: StoreSettings
  deliveryZones: DeliveryZone[]
  couriers: Courier[]
  staffMembers: StaffMember[]
  onSettingsChanged: (settings: StoreSettings) => void
  onDeliveryZonesChanged: (zones: DeliveryZone[]) => void
  onCouriersChanged: (couriers: Courier[]) => void
}) {
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const storeMarkerRef = useRef<any>(null)
  const existingShapesRef = useRef<any[]>([])
  const previewPolygonRef = useRef<any>(null)
  const vertexMarkersRef = useRef<any[]>([])
  const deliveryZonesRef = useRef(deliveryZones)
  const editingZoneIdRef = useRef<number | null>(null)
  deliveryZonesRef.current = deliveryZones

  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState("")
  const [pricingBusy, setPricingBusy] = useState(false)
  const [pricingMessage, setPricingMessage] = useState("")
  const [pricing, setPricing] = useState({
    mode: settings.deliveryPricingMode,
    fixedDeliveryFee: settings.fixedDeliveryFee,
    distanceBaseFee: settings.distanceBaseFee,
    distanceFeePerKm: settings.distanceFeePerKm,
    maxDeliveryDistanceKm: settings.maxDeliveryDistanceKm,
    freeDeliveryAbove: settings.freeDeliveryAbove,
    bands: settings.deliveryDistanceBands,
  })
  const [zoneName, setZoneName] = useState("")
  const [zoneFee, setZoneFee] = useState("5,00")
  const [zonePoints, setZonePoints] = useState<GeoPoint[]>([])
  const [editingZoneId, setEditingZoneId] = useState<number | null>(null)
  const [zoneBusy, setZoneBusy] = useState(false)
  const [zoneMessage, setZoneMessage] = useState("")
  const [courierDraft, setCourierDraft] = useState({ name: "", phone: "", vehicle: "Moto", staffMemberId: "" })
  const [courierBusy, setCourierBusy] = useState(false)
  const [courierMessage, setCourierMessage] = useState("")
  const courierStaffMembers = useMemo(
    () => staffMembers.filter((member) => member.active && member.role === "courier"),
    [staffMembers],
  )

  editingZoneIdRef.current = editingZoneId
  const editingZone = deliveryZones.find((zone) => zone.id === editingZoneId) || null
  const draftZoneColor = editingZone?.color || nextDeliveryZoneColor(deliveryZones.filter((zone) => zone.id !== editingZoneId))
  const zoneValidationError = useMemo(() => zonePoints.length >= 3 ? validateDeliveryPolygon(zonePoints, deliveryZones, editingZoneId) : "", [zonePoints, deliveryZones, editingZoneId])

  useEffect(() => {
    let disposed = false
    async function init() {
      if (pricing.mode !== "customAreas" || !mapContainer.current || mapRef.current) return
      if (!hasGoogleMapsKey()) { setMapError("Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para ativar o editor automático de cobertura."); return }
      try {
        const google = await loadGoogleMaps()
        if (disposed || !mapContainer.current) return
        const center = { lat: settings.storeLatitude, lng: settings.storeLongitude }
        const map = new google.maps.Map(mapContainer.current, {
          center,
          zoom: 14,
          mapId: googleMapsMapId(),
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
        })
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker")
        storeMarkerRef.current = new AdvancedMarkerElement({ map, position: center, title: settings.storeName || "Empresa" })
        map.addListener("click", (event: any) => {
          if (!event.latLng) return
          const rawPoint = { lat: event.latLng.lat(), lng: event.latLng.lng() }
          const snapped = snapPointToDeliveryBoundaries(rawPoint, deliveryZonesRef.current, { ignoreZoneId: editingZoneIdRef.current, maxDistanceMeters: 35 })
          const point = snapped?.point || rawPoint
          if (snapped) setZoneMessage(`Ponto encaixado no limite de “${snapped.zone.name}” (${Math.round(snapped.distanceMeters)} m).`)
          setZonePoints((points) => [...points, point])
        })
        mapRef.current = map
        setMapReady(true)
      } catch (error) { setMapError(error instanceof Error ? error.message : "Não foi possível abrir o Google Maps.") }
    }
    void init()
    return () => {
      disposed = true
      if (pricing.mode === "customAreas" && mapRef.current) {
        existingShapesRef.current.forEach((shape) => shape.setMap?.(null))
        previewPolygonRef.current?.setMap?.(null)
        vertexMarkersRef.current.forEach((marker) => { marker.map = null })
        if (storeMarkerRef.current) storeMarkerRef.current.map = null
        mapRef.current = null
        storeMarkerRef.current = null
        setMapReady(false)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricing.mode])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !storeMarkerRef.current) return
    const center = { lat: settings.storeLatitude, lng: settings.storeLongitude }
    storeMarkerRef.current.position = center
    map.panTo(center)
  }, [settings.storeLatitude, settings.storeLongitude])

  useEffect(() => {
    const google = window.google
    const map = mapRef.current
    if (!google?.maps || !map) return
    existingShapesRef.current.forEach((shape) => shape.setMap?.(null))
    const orderedZones = deliveryZones.filter((zone) => zone.active).sort((a, b) => deliveryZoneAreaScore(b) - deliveryZoneAreaScore(a))
    existingShapesRef.current = orderedZones.map((zone, index) => {
      if (zone.shape === "polygon" && zone.points.length >= 3) {
        const color = deliveryZoneColor(zone.color, zone.id)
        return new google.maps.Polygon({
          map,
          paths: zone.points,
          strokeColor: color,
          strokeOpacity: 1,
          strokeWeight: 4,
          fillColor: color,
          fillOpacity: 0,
          clickable: false,
          zIndex: index + 1,
        })
      }
      const color = deliveryZoneColor(zone.color, zone.id)
      return new google.maps.Circle({ map, center: { lat: zone.centerLat, lng: zone.centerLng }, radius: zone.radiusMeters, strokeColor: color, strokeOpacity: 1, strokeWeight: 4, fillColor: color, fillOpacity: 0, clickable: false, zIndex: index + 1 })
    })
  }, [deliveryZones, mapReady])

  useEffect(() => {
    const google = window.google
    const map = mapRef.current
    if (!google?.maps || !map) return
    previewPolygonRef.current?.setMap?.(null)
    vertexMarkersRef.current.forEach((marker) => { marker.map = null })
    vertexMarkersRef.current = []
    if (!zonePoints.length) return

    const previewColor = zoneValidationError ? "#DC2626" : draftZoneColor
    previewPolygonRef.current = new google.maps.Polygon({
      map,
      paths: zonePoints,
      strokeColor: previewColor,
      strokeOpacity: 0.98,
      strokeWeight: zoneValidationError ? 4 : 4,
      fillColor: previewColor,
      fillOpacity: 0,
      clickable: false,
    })

    void (async () => {
      const { AdvancedMarkerElement } = await google.maps.importLibrary("marker")
      if (!mapRef.current) return
      vertexMarkersRef.current = zonePoints.map((point, index) => {
        const content = document.createElement("div")
        content.textContent = String(index + 1)
        content.style.cssText = `width:24px;height:24px;border-radius:9999px;background:${previewColor};color:white;border:2px solid white;display:flex;align-items:center;justify-content:center;font:700 11px sans-serif;box-shadow:0 2px 8px #0003`
        const marker = new AdvancedMarkerElement({ map, position: point, gmpDraggable: true, content, title: `Ponto ${index + 1}` })
        marker.addListener("dragend", () => {
          const position = marker.position
          if (!position) return
          const lat = typeof position.lat === "function" ? position.lat() : Number(position.lat)
          const lng = typeof position.lng === "function" ? position.lng() : Number(position.lng)
          const rawPoint = { lat, lng }
          const snapped = snapPointToDeliveryBoundaries(rawPoint, deliveryZonesRef.current, { ignoreZoneId: editingZoneIdRef.current, maxDistanceMeters: 35 })
          if (snapped) setZoneMessage(`Ponto encaixado no limite de “${snapped.zone.name}” (${Math.round(snapped.distanceMeters)} m).`)
          setZonePoints((current) => current.map((item, itemIndex) => itemIndex === index ? (snapped?.point || rawPoint) : item))
        })
        return marker
      })
    })()
  }, [zonePoints, mapReady, draftZoneColor, zoneValidationError])

  function setMode(mode: DeliveryPricingMode) {
    setPricing((current) => ({ ...current, mode }))
    setPricingMessage("")
    if (mode === "customAreas") mapRef.current?.panTo?.({ lat: settings.storeLatitude, lng: settings.storeLongitude })
  }

  async function savePricing() {
    setPricingBusy(true); setPricingMessage("")
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryPricingMode: pricing.mode,
          fixedDeliveryFee: pricing.fixedDeliveryFee,
          distanceBaseFee: pricing.distanceBaseFee,
          distanceFeePerKm: pricing.distanceFeePerKm,
          maxDeliveryDistanceKm: pricing.maxDeliveryDistanceKm,
          freeDeliveryAbove: pricing.freeDeliveryAbove,
          deliveryDistanceBands: pricing.bands,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar a configuração de entrega.")
      onSettingsChanged(data.settings)
      setPricingMessage("Configuração de preço e cobertura salva.")
    } catch (error) { setPricingMessage(error instanceof Error ? error.message : "Erro ao salvar.") } finally { setPricingBusy(false) }
  }

  function addBand() {
    const last = pricing.bands[pricing.bands.length - 1]
    const minKm = last ? Number((last.maxKm + 0.01).toFixed(2)) : 0
    const band: DeliveryDistanceBand = { id: `band-${Date.now()}`, minKm, maxKm: Number((minKm + 3).toFixed(2)), fee: last?.fee ?? 5, active: true }
    setPricing((current) => ({ ...current, bands: [...current.bands, band] }))
  }

  function patchBand(id: string, patch: Partial<DeliveryDistanceBand>) { setPricing((current) => ({ ...current, bands: current.bands.map((band) => band.id === id ? { ...band, ...patch } : band) })) }
  function removeBand(id: string) { setPricing((current) => ({ ...current, bands: current.bands.filter((band) => band.id !== id) })) }

  function clearZoneEditor() { setEditingZoneId(null); setZoneName(""); setZoneFee("5,00"); setZonePoints([]); setZoneMessage("") }
  function editZone(zone: DeliveryZone) {
    setEditingZoneId(zone.id); setZoneName(zone.name); setZoneFee(zone.fee.toFixed(2).replace(".", ",")); setZonePoints(zone.shape === "polygon" ? zone.points : [])
    if (zone.shape === "polygon" && zone.points.length) {
      const bounds = new window.google.maps.LatLngBounds(); zone.points.forEach((point) => bounds.extend(point)); mapRef.current?.fitBounds?.(bounds, 60)
    }
  }

  async function saveZone(event: FormEvent) {
    event.preventDefault()
    if (zonePoints.length < 3) { setZoneMessage("Clique no mapa para criar pelo menos 3 pontos e fechar uma área."); return }
    const validationError = validateDeliveryPolygon(zonePoints, deliveryZones, editingZoneId)
    if (validationError) { setZoneMessage(validationError); return }
    setZoneBusy(true); setZoneMessage("")
    try {
      const centerLat = zonePoints.reduce((sum, point) => sum + point.lat, 0) / zonePoints.length
      const centerLng = zonePoints.reduce((sum, point) => sum + point.lng, 0) / zonePoints.length
      const response = await fetch(editingZoneId ? `/api/delivery-zones/${editingZoneId}` : "/api/delivery-zones", {
        method: editingZoneId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: zoneName, fee: numberValue(zoneFee), shape: "polygon", points: zonePoints, centerLat, centerLng, radiusMeters: 1500 }),
      })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Não foi possível salvar a área.")
      onDeliveryZonesChanged(editingZoneId ? deliveryZones.map((zone) => zone.id === editingZoneId ? data.deliveryZone : zone) : [...deliveryZones, data.deliveryZone])
      clearZoneEditor(); setZoneMessage(editingZoneId ? "Área atualizada com ajuste automático de limites." : "Área criada. Limites compartilhados são resolvidos automaticamente, sem lacunas.")
    } catch (error) { setZoneMessage(error instanceof Error ? error.message : "Erro ao salvar área.") } finally { setZoneBusy(false) }
  }

  async function patchZone(zone: DeliveryZone, patch: Partial<DeliveryZone>) {
    setZoneMessage("")
    const response = await fetch(`/api/delivery-zones/${zone.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) })
    const data = await response.json()
    if (!response.ok) { setZoneMessage(data.error || "Não foi possível atualizar a área."); return }
    onDeliveryZonesChanged(deliveryZones.map((item) => item.id === zone.id ? data.deliveryZone : item))
  }
  async function removeZone(zone: DeliveryZone) { if (!window.confirm(`Excluir a área ${zone.name}?`)) return; const response = await fetch(`/api/delivery-zones/${zone.id}`, { method: "DELETE" }); if (response.ok) { onDeliveryZonesChanged(deliveryZones.filter((item) => item.id !== zone.id)); if (editingZoneId === zone.id) clearZoneEditor() } }

  async function saveCourier(event: FormEvent) {
    event.preventDefault(); setCourierBusy(true); setCourierMessage("")
    try {
      const response = await fetch("/api/couriers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...courierDraft,
          staffMemberId: courierDraft.staffMemberId ? Number(courierDraft.staffMemberId) : null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível cadastrar.")
      onCouriersChanged([...couriers, data.courier])
      setCourierDraft({ name: "", phone: "", vehicle: "Moto", staffMemberId: "" })
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

  async function linkCourierStaff(courier: Courier, staffMemberId: string) {
    setCourierMessage("")
    const response = await fetch(`/api/couriers/${courier.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffMemberId: staffMemberId ? Number(staffMemberId) : null }),
    })
    const data = await response.json()
    if (!response.ok) {
      setCourierMessage(data.error || "Não foi possível vincular o login do entregador.")
      return
    }
    onCouriersChanged(couriers.map((item) => item.id === courier.id ? data.courier : item))
    setCourierMessage(staffMemberId ? "Perfil operacional vinculado ao colaborador." : "Vínculo do colaborador removido.")
  }

  return <div className="space-y-5">
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-1.5"><h2 className="text-lg font-black text-gray-900">Preços e cobertura de entrega</h2><HelpTip helpKey="delivery.pricing" /></div><p className="mt-1 text-sm text-gray-500">Sem cadastro de bairros. O endereço do cliente vira coordenadas e a taxa é calculada automaticamente.</p></div><button type="button" onClick={() => void savePricing()} disabled={pricingBusy} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4"/>{pricingBusy ? "Salvando..." : "Salvar"}</button></div>
      <div className="grid gap-2 lg:grid-cols-2">{pricingModes.map((mode) => <button type="button" key={mode.value} onClick={() => setMode(mode.value)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${pricing.mode === mode.value ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200" : "border-gray-200 hover:bg-gray-50"}`}><span className="text-3xl">{mode.icon}</span><span className="min-w-0 flex-1"><strong className={`block ${pricing.mode === mode.value ? "text-blue-700" : "text-gray-900"}`}>{mode.title}</strong><small className="text-gray-500">{mode.description}</small></span>{pricing.mode === mode.value && <span className="rounded-full bg-blue-600 px-2 py-1 text-[10px] font-black text-white">ATIVO</span>}</button>)}</div>

      {pricing.mode === "fixed" && <div className="mt-4 max-w-sm rounded-2xl bg-gray-50 p-4"><label className="text-xs font-black uppercase text-gray-500">Preço fixo</label><input type="number" min="0" step="0.01" value={pricing.fixedDeliveryFee} onChange={(e) => setPricing({ ...pricing, fixedDeliveryFee: Number(e.target.value) })} className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3"/></div>}
      {pricing.mode === "distance" && <div className="mt-4 grid gap-3 rounded-2xl bg-gray-50 p-4 md:grid-cols-3"><label><span className="flex items-center gap-1.5 text-xs font-black uppercase text-gray-500">Taxa inicial <HelpTip helpKey="delivery.distance" /></span><input type="number" min="0" step="0.01" value={pricing.distanceBaseFee} onChange={(e) => setPricing({ ...pricing, distanceBaseFee: Number(e.target.value) })} className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3"/></label><label><span className="text-xs font-black uppercase text-gray-500">Preço por km</span><input type="number" min="0" step="0.01" value={pricing.distanceFeePerKm} onChange={(e) => setPricing({ ...pricing, distanceFeePerKm: Number(e.target.value) })} className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3"/></label><label><span className="text-xs font-black uppercase text-gray-500">Distância máxima (km)</span><input type="number" min="0" step="0.1" value={pricing.maxDeliveryDistanceKm} onChange={(e) => setPricing({ ...pricing, maxDeliveryDistanceKm: Number(e.target.value) })} className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3"/></label><p className="text-xs text-gray-500 md:col-span-3">A distância é calculada pelas ruas usando Google Routes, não em linha reta.</p></div>}
      {pricing.mode === "distanceBands" && <div className="mt-4 rounded-2xl bg-gray-50 p-4"><div className="mb-3 flex items-center justify-between"><div><HelpLabel helpKey="delivery.bands"><strong>Faixas por quilômetros percorridos</strong></HelpLabel><p className="text-xs text-gray-500">O sistema escolhe a faixa automaticamente pela rota.</p></div><button type="button" onClick={addBand} className="inline-flex h-9 items-center gap-1 rounded-xl bg-white px-3 text-xs font-black text-blue-700 shadow-sm"><Plus className="h-4 w-4"/>Adicionar faixa</button></div><div className="space-y-2">{pricing.bands.map((band) => <div key={band.id} className="grid items-end gap-2 rounded-xl border border-gray-200 bg-white p-3 sm:grid-cols-[1fr_1fr_1fr_auto_auto]"><label><span className="text-[10px] font-black uppercase text-gray-500">De km</span><input type="number" min="0" step="0.01" value={band.minKm} onChange={(e) => patchBand(band.id, { minKm: Number(e.target.value) })} className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-2 text-sm"/></label><label><span className="text-[10px] font-black uppercase text-gray-500">Até km</span><input type="number" min="0" step="0.01" value={band.maxKm} onChange={(e) => patchBand(band.id, { maxKm: Number(e.target.value) })} className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-2 text-sm"/></label><label><span className="text-[10px] font-black uppercase text-gray-500">Preço</span><input type="number" min="0" step="0.01" value={band.fee} onChange={(e) => patchBand(band.id, { fee: Number(e.target.value) })} className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-2 text-sm"/></label><button type="button" onClick={() => patchBand(band.id, { active: !band.active })} className={`h-10 rounded-lg px-3 text-xs font-black ${band.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{band.active ? "Ativa" : "Inativa"}</button><button type="button" onClick={() => removeBand(band.id)} className="flex h-10 w-10 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4"/></button></div>)}</div><label className="mt-3 block max-w-xs"><span className="text-xs font-black uppercase text-gray-500">Distância máxima (km)</span><input type="number" min="0" step="0.1" value={pricing.maxDeliveryDistanceKm} onChange={(e) => setPricing({ ...pricing, maxDeliveryDistanceKm: Number(e.target.value) })} className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3"/></label></div>}

      <div className="mt-4 rounded-2xl border border-dashed border-gray-300 p-4"><label className="grid items-center gap-3 sm:grid-cols-[1fr_200px]"><span><span className="flex items-center gap-1.5"><strong className="text-sm">Entrega grátis acima de</strong><HelpTip helpKey="delivery.freeAbove" /></span><small className="block text-xs text-gray-500">Opcional. Digite 0 para desativar.</small></span><input type="number" min="0" step="0.01" value={pricing.freeDeliveryAbove} onChange={(e) => setPricing({ ...pricing, freeDeliveryAbove: Number(e.target.value) })} className="h-10 rounded-xl border border-gray-200 px-3"/></label></div>
      {pricingMessage && <p className="mt-3 text-sm font-semibold text-blue-700">{pricingMessage}</p>}
    </section>

    {pricing.mode === "customAreas" && <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-blue-700"/><h2 className="text-lg font-black"><HelpLabel helpKey="delivery.customAreas">Áreas personalizadas no Google Maps</HelpLabel></h2></div><p className="mt-1 text-sm text-gray-500">Cada área recebe uma cor diferente. Você pode desenhar uma área externa passando ao redor de outra: o sistema usa o limite da área menor como divisão automática, sem deixar ruas sem cobertura.</p></div><button type="button" onClick={() => mapRef.current?.setCenter?.({ lat: settings.storeLatitude, lng: settings.storeLongitude })} className="inline-flex h-9 items-center gap-1 rounded-xl border border-gray-200 px-3 text-xs font-black"><Crosshair className="h-4 w-4"/>Centralizar na empresa</button></div>
      {mapError && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{mapError}</div>}
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]"><div ref={mapContainer} className="h-[520px] min-h-[360px] overflow-hidden rounded-2xl border border-gray-200 bg-gray-100"/><div className="space-y-3"><form onSubmit={saveZone} className="rounded-2xl bg-gray-50 p-4"><strong className="text-sm">{editingZoneId ? "Editar área" : "Nova área"}</strong><label className="mt-3 block"><span className="text-[10px] font-black uppercase text-gray-500">Nome</span><input required value={zoneName} onChange={(e) => setZoneName(e.target.value)} placeholder="Ex.: Região central" className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm"/></label><label className="mt-3 block"><span className="text-[10px] font-black uppercase text-gray-500">Preço</span><input required inputMode="decimal" value={zoneFee} onChange={(e) => setZoneFee(e.target.value)} placeholder="5,00" className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm"/></label><div className={`mt-3 rounded-xl border p-3 text-xs ${zoneValidationError ? "border-red-200 bg-red-50 text-red-800" : "border-blue-100 bg-blue-50 text-blue-900"}`}><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: zoneValidationError ? "#DC2626" : draftZoneColor }} /><strong>{zonePoints.length} ponto(s)</strong></div><p className="mt-1">{zoneValidationError || "Clique no mapa para adicionar vértices. Cada área aparece somente pelo contorno, sem preenchimento sobre outra cor. Pontos a até 35 m de outra borda encaixam automaticamente, permitindo limites colados sem ruas descobertas."}</p></div><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={!zonePoints.length} onClick={() => setZonePoints((points) => points.slice(0, -1))} className="h-10 rounded-xl border border-gray-200 bg-white text-xs font-black disabled:opacity-50">Desfazer ponto</button><button type="button" disabled={!zonePoints.length} onClick={() => setZonePoints([])} className="h-10 rounded-xl border border-gray-200 bg-white text-xs font-black disabled:opacity-50">Limpar desenho</button></div><button disabled={zoneBusy || zonePoints.length < 3 || Boolean(zoneValidationError)} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4"/>{zoneBusy ? "Salvando..." : editingZoneId ? "Atualizar área" : "Salvar área"}</button>{editingZoneId && <button type="button" onClick={clearZoneEditor} className="mt-2 h-10 w-full rounded-xl text-xs font-black text-gray-500">Cancelar edição</button>}</form>{zoneMessage && <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">{zoneMessage}</p>}<div className="space-y-2">{deliveryZones.map((zone) => <article key={zone.id} className={`rounded-xl border p-3 ${zone.active ? "border-blue-200 bg-blue-50/40" : "border-gray-200 bg-gray-50 opacity-60"}`}><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: deliveryZoneColor(zone.color, zone.id) }} /><strong className="block truncate">{zone.name}</strong></div><span className="text-xs text-gray-500">{money(zone.fee)} · {zone.shape === "polygon" ? `${zone.points.length} pontos` : `círculo legado ${(zone.radiusMeters / 1000).toFixed(1)} km`}</span></div><button type="button" onClick={() => editZone(zone)} disabled={zone.shape !== "polygon"} className="rounded-lg px-2 py-1 text-xs font-black text-blue-700 disabled:opacity-30">Editar</button><button type="button" onClick={() => void patchZone(zone, { active: !zone.active })} className="rounded-lg p-1.5 text-gray-500"><Power className="h-4 w-4"/></button><button type="button" onClick={() => void removeZone(zone)} className="rounded-lg p-1.5 text-red-500"><Trash2 className="h-4 w-4"/></button></div></article>)}{!deliveryZones.length && <div className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-xs text-gray-500">Nenhuma área desenhada.</div>}</div></div></div>
    </section>}

    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><Bike className="h-5 w-5" /></div><div><h2 className="text-lg font-bold text-gray-900"><HelpLabel helpKey="delivery.couriers">Entregadores</HelpLabel></h2><p className="text-sm text-gray-500">Cadastre o perfil operacional e vincule-o ao colaborador que fará login no app de entregas.</p></div></div>
      <form onSubmit={saveCourier} className="grid gap-3 rounded-2xl bg-gray-50 p-4 md:grid-cols-5"><label><span className="mb-1 block text-xs font-bold uppercase text-gray-500">Nome</span><input required value={courierDraft.name} onChange={(e) => setCourierDraft({ ...courierDraft, name: e.target.value })} className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label><label><span className="mb-1 block text-xs font-bold uppercase text-gray-500">Telefone</span><input required value={courierDraft.phone} onChange={(e) => setCourierDraft({ ...courierDraft, phone: e.target.value })} className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label><label><span className="mb-1 block text-xs font-bold uppercase text-gray-500">Veículo</span><input value={courierDraft.vehicle} onChange={(e) => setCourierDraft({ ...courierDraft, vehicle: e.target.value })} placeholder="Moto" className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label><label><span className="mb-1 block text-xs font-bold uppercase text-gray-500">Colaborador / login</span><select value={courierDraft.staffMemberId} onChange={(e) => setCourierDraft({ ...courierDraft, staffMemberId: e.target.value })} className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"><option value="">Vincular depois</option>{courierStaffMembers.map((member) => <option key={member.id} value={member.id}>{member.name}{member.email ? ` · ${member.email}` : ""}</option>)}</select></label><button disabled={courierBusy} className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50"><UserPlus className="h-4 w-4" />Cadastrar</button></form>
      {courierMessage && <p className="mt-2 text-sm font-semibold text-emerald-700">{courierMessage}</p>}
      <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200">{couriers.map((courier) => <div key={courier.id} className="grid items-center gap-3 p-3 md:grid-cols-[auto_1fr_minmax(220px,320px)_auto_auto]"><div className={`flex h-10 w-10 items-center justify-center rounded-full font-black ${courier.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>{courier.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="font-bold text-gray-900">{courier.name}</p><p className="text-xs text-gray-500">{courier.phone}{courier.vehicle ? ` · ${courier.vehicle}` : ""}</p>{courier.linkedUserId && <p className="mt-1 text-[11px] font-bold text-emerald-700">Login do app ativo{courier.staffEmail ? ` · ${courier.staffEmail}` : ""}</p>}</div><select value={courier.staffMemberId ? String(courier.staffMemberId) : ""} onChange={(event) => void linkCourierStaff(courier, event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm"><option value="">Sem colaborador vinculado</option>{courierStaffMembers.map((member) => <option key={member.id} value={member.id}>{member.name}{member.email ? ` · ${member.email}` : ""}</option>)}</select><span className={`rounded-full px-2 py-1 text-center text-xs font-bold ${courier.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{courier.active ? "Ativo" : "Inativo"}</span><button type="button" onClick={() => toggleCourier(courier)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Power className="h-4 w-4" /></button></div>)}{!couriers.length && <div className="p-6 text-center text-sm text-gray-500">Nenhum entregador cadastrado.</div>}</div>
    </section>
  </div>
}
