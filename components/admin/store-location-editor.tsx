"use client"

import { useEffect, useRef, useState } from "react"
import { Crosshair, MapPin } from "lucide-react"
import type { StoreSettings } from "@/lib/types"
import { geocodeGoogleAddress, googleMapsMapId, hasGoogleMapsKey, loadGoogleMaps, reverseGeocodeGoogle, type GoogleAddress } from "@/lib/google-maps-client"
import { GoogleAddressAutocomplete, type GoogleAddressSelection } from "@/components/maps/google-address-autocomplete"

export function StoreLocationEditor({
  settings,
  onPosition,
  onAddress,
}: {
  settings: StoreSettings
  onPosition: (latitude: number, longitude: number) => void
  onAddress: (value: GoogleAddress & { latitude: number; longitude: number }) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [mapError, setMapError] = useState("")

  const fullAddress = [settings.address, settings.storeDistrict, settings.city, settings.state, settings.zipCode, "Brasil"].filter(Boolean).join(", ")

  function moveMap(latitude: number, longitude: number, zoom = 18) {
    const position = { lat: latitude, lng: longitude }
    mapRef.current?.setCenter?.(position)
    mapRef.current?.setZoom?.(zoom)
    if (markerRef.current) markerRef.current.position = position
  }

  function applySelection(selection: GoogleAddressSelection) {
    const address = selection.address
    onAddress({ ...address, latitude: selection.latitude, longitude: selection.longitude })
    moveMap(selection.latitude, selection.longitude, 19)
    setMessage("✓ Endereço da empresa identificado automaticamente. Ajuste o pino até a porta, se necessário, e salve.")
  }

  async function locateStore() {
    if (!fullAddress.trim()) return
    setBusy(true); setMessage("")
    try {
      const result = await geocodeGoogleAddress(fullAddress)
      onAddress({ ...result.address, latitude: result.latitude, longitude: result.longitude })
      moveMap(result.latitude, result.longitude, 19)
      setMessage("✓ Localização confirmada pelo Google Maps. Se necessário, arraste o pino até a entrada exata.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível localizar o endereço da empresa.")
    } finally { setBusy(false) }
  }

  async function updateFromPoint(latitude: number, longitude: number) {
    onPosition(latitude, longitude)
    try {
      const address = await reverseGeocodeGoogle(latitude, longitude)
      if (address) {
        onAddress({ ...address, latitude, longitude })
      }
      setMessage("✓ Ponto da empresa atualizado. Clique em Salvar configurações.")
    } catch {
      setMessage("✓ Ponto da empresa atualizado. Clique em Salvar configurações.")
    }
  }

  useEffect(() => {
    let disposed = false
    async function init() {
      if (!containerRef.current || mapRef.current) return
      if (!hasGoogleMapsKey()) { setMapError("Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para ativar o mapa e os endereços automáticos."); return }
      try {
        const google = await loadGoogleMaps()
        if (disposed || !containerRef.current) return
        const point = { lat: Number(settings.storeLatitude), lng: Number(settings.storeLongitude) }
        const map = new google.maps.Map(containerRef.current, {
          center: point,
          zoom: 18,
          mapId: googleMapsMapId(),
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
        })
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker")
        const marker = new AdvancedMarkerElement({ map, position: point, gmpDraggable: true, title: settings.storeName || "Local da empresa" })
        marker.addListener("dragend", () => {
          const position = marker.position
          if (!position) return
          const lat = typeof position.lat === "function" ? position.lat() : Number(position.lat)
          const lng = typeof position.lng === "function" ? position.lng() : Number(position.lng)
          void updateFromPoint(lat, lng)
        })
        map.addListener("click", (event: any) => {
          if (!event.latLng) return
          const lat = event.latLng.lat(); const lng = event.latLng.lng()
          marker.position = { lat, lng }
          void updateFromPoint(lat, lng)
        })
        mapRef.current = map; markerRef.current = marker
      } catch (error) { setMapError(error instanceof Error ? error.message : "Não foi possível carregar o Google Maps.") }
    }
    void init()
    return () => { disposed = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { moveMap(Number(settings.storeLatitude), Number(settings.storeLongitude), 18) }, [settings.storeLatitude, settings.storeLongitude])

  return <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><strong className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-blue-700"/>Localização automática da empresa</strong><p className="mt-1 text-xs text-gray-500">Pesquise o endereço ou marque a entrada exata no mapa. Não há cadastro de bairros.</p></div>
      <button type="button" onClick={() => void locateStore()} disabled={busy || !hasGoogleMapsKey()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 text-xs font-black text-white disabled:opacity-50"><Crosshair className="h-4 w-4"/>{busy ? "Localizando..." : "Confirmar endereço atual"}</button>
    </div>
    <div className="mt-4"><GoogleAddressAutocomplete onSelect={applySelection} placeholder="Pesquise rua, número ou CEP da empresa" /></div>
    <div ref={containerRef} className="mt-4 h-80 w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-100"/>
    {mapError && <p className="mt-2 text-xs font-semibold text-amber-700">{mapError}</p>}
    {message && <p className="mt-2 text-xs font-bold text-blue-800">{message}</p>}
    <div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-xl bg-white px-3 py-2 text-xs"><span className="block text-gray-500">Latitude</span><strong>{Number(settings.storeLatitude).toFixed(6)}</strong></div><div className="rounded-xl bg-white px-3 py-2 text-xs"><span className="block text-gray-500">Longitude</span><strong>{Number(settings.storeLongitude).toFixed(6)}</strong></div></div>
  </div>
}
