"use client"

import { useEffect, useRef, useState } from "react"
import { MapPin } from "lucide-react"
import { addressFromGoogleResult, hasGoogleMapsKey, loadGoogleMaps, type GoogleAddress } from "@/lib/google-maps-client"

export type GoogleAddressSelection = {
  latitude: number
  longitude: number
  address: GoogleAddress
  formattedAddress: string
  placeId: string
}

export function GoogleAddressAutocomplete({
  onSelect,
  placeholder = "Digite rua, número ou CEP",
  className = "",
  biasCenter,
  biasRadiusMeters = 50000,
}: {
  onSelect: (selection: GoogleAddressSelection) => void
  placeholder?: string
  className?: string
  biasCenter?: { lat: number; lng: number }
  biasRadiusMeters?: number
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const onSelectRef = useRef(onSelect)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  useEffect(() => {
    let disposed = false
    let element: any = null
    let listener: ((event: any) => void) | null = null

    async function init() {
      if (!hostRef.current || !hasGoogleMapsKey()) return
      try {
        const google = await loadGoogleMaps()
        const places = await google.maps.importLibrary("places")
        const PlaceAutocompleteElement = places?.PlaceAutocompleteElement
        if (!PlaceAutocompleteElement) throw new Error("Busca automática de endereços não disponível.")
        if (disposed || !hostRef.current) return

        element = new PlaceAutocompleteElement({
          includedRegionCodes: ["br"],
          requestedLanguage: "pt-BR",
          requestedRegion: "br",
          placeholder,
          ...(biasCenter && Number.isFinite(biasCenter.lat) && Number.isFinite(biasCenter.lng)
            ? { locationBias: { center: biasCenter, radius: Math.max(1000, Math.min(100000, biasRadiusMeters)) } }
            : {}),
        })
        element.setAttribute("placeholder", placeholder)
        element.style.width = "100%"
        hostRef.current.replaceChildren(element)

        listener = async (event: any) => {
          try {
            const prediction = event?.placePrediction
            if (!prediction) return
            const place = prediction.toPlace()
            await place.fetchFields({ fields: ["id", "formattedAddress", "location", "addressComponents"] })
            const location = place.location
            if (!location) throw new Error("O Google não retornou a localização desse endereço.")
            const formattedAddress = String(place.formattedAddress || "")
            const address = addressFromGoogleResult(place)
            onSelectRef.current({
              latitude: Number(location.lat()),
              longitude: Number(location.lng()),
              address: { ...address, formattedAddress: formattedAddress || address.formattedAddress },
              formattedAddress,
              placeId: String(place.id || ""),
            })
            setError("")
          } catch (err) {
            setError(err instanceof Error ? err.message : "Não foi possível carregar os dados do endereço selecionado.")
          }
        }
        element.addEventListener("gmp-select", listener)
        setReady(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível ativar a busca automática de endereços.")
      }
    }

    void init()
    return () => {
      disposed = true
      if (element && listener) element.removeEventListener?.("gmp-select", listener)
      if (hostRef.current) hostRef.current.replaceChildren()
    }
  }, [placeholder, biasCenter?.lat, biasCenter?.lng, biasRadiusMeters])

  return <div className={className}>
    <div ref={hostRef} className="min-h-12 w-full rounded-xl border border-gray-200 bg-white px-1 py-1 [&_gmp-place-autocomplete]:w-full" />
    <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-500">
      <MapPin className="h-3 w-3" />
      {hasGoogleMapsKey() ? ready ? "Endereço automático pelo Google Maps" : "Carregando busca do Google Maps…" : "Configure a chave do Google Maps para ativar a busca automática."}
    </div>
    {error && <p className="mt-1 text-xs font-semibold text-amber-700">{error}</p>}
  </div>
}
