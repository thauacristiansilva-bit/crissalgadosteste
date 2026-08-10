"use client"

import { useEffect, useRef, useState } from "react"
import { Crosshair, MapPin, Move } from "lucide-react"
import { googleMapsMapId, hasGoogleMapsKey, loadGoogleMaps, reverseGeocodeGoogle, type GoogleAddress } from "@/lib/google-maps-client"

type Props = {
  latitude: number | null
  longitude: number | null
  accuracyMeters?: number | null
  storeLatitude: number
  storeLongitude: number
  onPositionChange: (value: { latitude: number; longitude: number; address?: GoogleAddress | null }) => void
}

export function DeliveryLocationMap({
  latitude,
  longitude,
  accuracyMeters,
  storeLatitude,
  storeLongitude,
  onPositionChange,
}: Props) {
  const elementRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const accuracyCircleRef = useRef<any>(null)
  const latestPositionRef = useRef({ latitude, longitude, storeLatitude, storeLongitude })
  const [loading, setLoading] = useState(false)
  const [mapError, setMapError] = useState("")
  const [refining, setRefining] = useState(false)

  latestPositionRef.current = { latitude, longitude, storeLatitude, storeLongitude }

  async function reportPosition(lat: number, lng: number) {
    setRefining(true)
    try {
      const address = await reverseGeocodeGoogle(lat, lng).catch(() => null)
      onPositionChange({ latitude: lat, longitude: lng, address })
    } finally {
      setRefining(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function init() {
      if (!elementRef.current || mapRef.current) return
      if (!hasGoogleMapsKey()) {
        setMapError("Google Maps ainda não foi configurado. Adicione NEXT_PUBLIC_GOOGLE_MAPS_API_KEY nas variáveis do projeto.")
        return
      }

      setLoading(true)
      try {
        const google = await loadGoogleMaps()
        if (cancelled || !elementRef.current) return

        const latest = latestPositionRef.current
        const center = {
          lat: latest.latitude ?? latest.storeLatitude,
          lng: latest.longitude ?? latest.storeLongitude,
        }

        const map = new google.maps.Map(elementRef.current, {
          center,
          zoom: latest.latitude != null && latest.longitude != null ? 19 : 14,
          mapId: googleMapsMapId(),
          streetViewControl: false,
          fullscreenControl: true,
          mapTypeControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
        })

        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker")
        const marker = new AdvancedMarkerElement({
          map,
          position: center,
          gmpDraggable: true,
          title: "Arraste para o ponto exato da entrega",
        })

        marker.addListener("dragend", () => {
          const position = marker.position
          if (!position) return
          const lat = typeof position.lat === "function" ? position.lat() : Number(position.lat)
          const lng = typeof position.lng === "function" ? position.lng() : Number(position.lng)
          map.panTo({ lat, lng })
          void reportPosition(lat, lng)
        })

        map.addListener("click", (event: any) => {
          if (!event.latLng) return
          const lat = event.latLng.lat()
          const lng = event.latLng.lng()
          marker.position = { lat, lng }
          map.panTo({ lat, lng })
          void reportPosition(lat, lng)
        })

        mapRef.current = map
        markerRef.current = marker

        // A posição pode ter mudado enquanto o script do Google estava carregando.
        // Reaplicamos o valor mais recente para evitar o mapa preso no endereço da loja.
        const afterLoad = latestPositionRef.current
        if (afterLoad.latitude != null && afterLoad.longitude != null) {
          const currentPosition = { lat: afterLoad.latitude, lng: afterLoad.longitude }
          marker.position = currentPosition
          map.setCenter(currentPosition)
          map.setZoom(19)
        }
      } catch (error) {
        setMapError(error instanceof Error ? error.message : "Não foi possível abrir o Google Maps.")
      } finally {
        setLoading(false)
      }
    }

    void init()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker || latitude == null || longitude == null) return
    const position = { lat: latitude, lng: longitude }
    marker.position = position
    map.setCenter(position)
    map.setZoom(19)
  }, [latitude, longitude, loading])


  useEffect(() => {
    const map = mapRef.current
    const google = window.google
    if (!map || !google?.maps) return

    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.setMap(null)
      accuracyCircleRef.current = null
    }

    if (latitude == null || longitude == null || !accuracyMeters || accuracyMeters <= 0) return
    accuracyCircleRef.current = new google.maps.Circle({
      map,
      center: { lat: latitude, lng: longitude },
      radius: accuracyMeters,
      strokeColor: "#2563eb",
      strokeOpacity: 0.45,
      strokeWeight: 1,
      fillColor: "#3b82f6",
      fillOpacity: 0.08,
      clickable: false,
    })
  }, [accuracyMeters, latitude, longitude, loading])

  if (mapError) {
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong className="block">Mapa indisponível</strong><span className="mt-1 block">{mapError}</span></div>
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-2xl border border-blue-100 bg-slate-100 shadow-inner">
        <div ref={elementRef} className="h-[320px] w-full sm:h-[380px]" />
        {loading && <div className="flex h-12 items-center justify-center border-t border-blue-100 bg-white text-sm font-semibold text-gray-600">Carregando Google Maps…</div>}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-900"><Move className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Marque com precisão:</strong> arraste o pino ou toque exatamente no portão/local de entrega.</span></div>
        <div className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900"><Crosshair className="mt-0.5 h-4 w-4 shrink-0" /><span>{refining ? "Atualizando endereço do ponto escolhido…" : accuracyMeters ? `Precisão informada pelo dispositivo: aproximadamente ${Math.round(accuracyMeters)} m. O pino pode ser refinado manualmente.` : "O ponto escolhido no mapa será usado para calcular a área e a taxa de entrega."}</span></div>
      </div>
      {latitude != null && longitude != null && <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-500"><MapPin className="h-3.5 w-3.5" />{latitude.toFixed(6)}, {longitude.toFixed(6)}</div>}
    </div>
  )
}
