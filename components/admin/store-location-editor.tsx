"use client"

import {
  useEffect,
  useRef,
  useState,
} from "react"

import {
  Crosshair,
  MapPin,
} from "lucide-react"

import type {
  StoreSettings,
} from "@/lib/types"

import {
  geocodeGoogleAddress,
  hasGoogleMapsKey,
  loadGoogleMaps,
  reverseGeocodeGoogle,
  type GoogleAddress,
} from "@/lib/google-maps-client"

import {
  GoogleAddressAutocomplete,
  type GoogleAddressSelection,
} from "@/components/maps/google-address-autocomplete"

export function StoreLocationEditor({
  settings,
  onPosition,
  onAddress,
}: {
  settings: StoreSettings
  onPosition: (
    latitude: number,
    longitude: number,
  ) => void
  onAddress: (
    value: GoogleAddress & {
      latitude: number
      longitude: number
    },
  ) => void
}) {
  const containerRef =
    useRef<HTMLDivElement | null>(
      null,
    )

  const mapRef =
    useRef<any>(null)

  const markerRef =
    useRef<any>(null)

  const [busy, setBusy] =
    useState(false)

  const [message, setMessage] =
    useState("")

  const [
    mapError,
    setMapError,
  ] = useState("")

  const fullAddress = [
    settings.address,
    settings.storeDistrict,
    settings.city,
    settings.state,
    settings.zipCode,
    "Brasil",
  ]
    .filter(Boolean)
    .join(", ")

  function moveMap(
    latitude: number,
    longitude: number,
    zoom = 18,
  ) {
    const position = {
      lat: latitude,
      lng: longitude,
    }

    mapRef.current?.setCenter?.(
      position,
    )

    mapRef.current?.setZoom?.(
      zoom,
    )

    markerRef.current?.setPosition?.(
      position,
    )
  }

  function applySelection(
    selection: GoogleAddressSelection,
  ) {
    const address =
      selection.address

    onAddress({
      ...address,
      latitude:
        selection.latitude,
      longitude:
        selection.longitude,
    })

    moveMap(
      selection.latitude,
      selection.longitude,
      19,
    )

    setMessage(
      "✓ Endereço da empresa identificado automaticamente. Ajuste o pino até a porta, se necessário, e salve.",
    )
  }

  async function locateStore() {
    if (!fullAddress.trim()) {
      return
    }

    setBusy(true)
    setMessage("")

    try {
      const result =
        await geocodeGoogleAddress(
          fullAddress,
        )

      onAddress({
        ...result.address,
        latitude:
          result.latitude,
        longitude:
          result.longitude,
      })

      moveMap(
        result.latitude,
        result.longitude,
        19,
      )

      setMessage(
        "✓ Localização confirmada pelo Google Maps. Se necessário, arraste o pino até a entrada exata.",
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível localizar o endereço da empresa.",
      )
    } finally {
      setBusy(false)
    }
  }

  async function updateFromPoint(
    latitude: number,
    longitude: number,
  ) {
    onPosition(
      latitude,
      longitude,
    )

    try {
      const address =
        await reverseGeocodeGoogle(
          latitude,
          longitude,
        )

      if (address) {
        onAddress({
          ...address,
          latitude,
          longitude,
        })
      }

      setMessage(
        "✓ Ponto da empresa atualizado. Clique em Salvar configurações.",
      )
    } catch {
      setMessage(
        "✓ Ponto da empresa atualizado. Clique em Salvar configurações.",
      )
    }
  }

  useEffect(() => {
    let disposed = false

    async function init() {
      if (
        !containerRef.current ||
        mapRef.current
      ) {
        return
      }

      if (
        !hasGoogleMapsKey()
      ) {
        setMapError(
          "Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para ativar o mapa e os endereços automáticos.",
        )

        return
      }

      try {
        const google =
          await loadGoogleMaps()

        if (
          disposed ||
          !containerRef.current
        ) {
          return
        }

        const latitude =
          Number(
            settings.storeLatitude,
          )

        const longitude =
          Number(
            settings.storeLongitude,
          )

        const validPosition =
          Number.isFinite(
            latitude,
          ) &&
          Number.isFinite(
            longitude,
          ) &&
          Math.abs(latitude) <= 90 &&
          Math.abs(longitude) <= 180

        const point =
          validPosition
            ? {
                lat: latitude,
                lng: longitude,
              }
            : {
                lat: -4.2246,
                lng: -44.7838,
              }

        // =====================================================
        // GOOGLE MAPS PADRÃO
        // Sem Map ID e sem Cloud Styling.
        // Isso restaura ruas, nomes, estabelecimentos e POIs.
        // =====================================================

        const map =
          new google.maps.Map(
            containerRef.current,
            {
              center: point,
              zoom: 18,

              mapTypeId:
                google.maps
                  .MapTypeId
                  .ROADMAP,

              streetViewControl:
                true,

              mapTypeControl:
                true,

              fullscreenControl:
                true,

              zoomControl:
                true,

              clickableIcons:
                true,

              gestureHandling:
                "greedy",
            },
          )

        // =====================================================
        // MARCADOR CLÁSSICO
        // Não depende de Map ID.
        // =====================================================

        const marker =
          new google.maps.Marker(
            {
              map,
              position: point,

              draggable: true,

              title:
                settings.storeName ||
                "Local da empresa",

              animation:
                google.maps
                  .Animation
                  .DROP,
            },
          )

        marker.addListener(
          "dragend",
          () => {
            const position =
              marker.getPosition()

            if (!position) {
              return
            }

            const lat =
              position.lat()

            const lng =
              position.lng()

            map.panTo({
              lat,
              lng,
            })

            void updateFromPoint(
              lat,
              lng,
            )
          },
        )

        map.addListener(
          "click",
          (event: any) => {
            if (
              !event.latLng
            ) {
              return
            }

            const lat =
              event.latLng.lat()

            const lng =
              event.latLng.lng()

            marker.setPosition({
              lat,
              lng,
            })

            map.panTo({
              lat,
              lng,
            })

            void updateFromPoint(
              lat,
              lng,
            )
          },
        )

        mapRef.current =
          map

        markerRef.current =
          marker
      } catch (error) {
        setMapError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o Google Maps.",
        )
      }
    }

    void init()

    return () => {
      disposed = true
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const latitude =
      Number(
        settings.storeLatitude,
      )

    const longitude =
      Number(
        settings.storeLongitude,
      )

    if (
      !Number.isFinite(
        latitude,
      ) ||
      !Number.isFinite(
        longitude,
      )
    ) {
      return
    }

    moveMap(
      latitude,
      longitude,
      18,
    )
  }, [
    settings.storeLatitude,
    settings.storeLongitude,
  ])

  return (
    <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <strong className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-blue-700" />

            Localização automática
            da empresa
          </strong>

          <p className="mt-1 text-xs text-gray-500">
            Pesquise o endereço ou
            marque a entrada exata no
            mapa. Não há cadastro de
            bairros.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void locateStore()
          }
          disabled={
            busy ||
            !hasGoogleMapsKey()
          }
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 text-xs font-black text-white disabled:opacity-50"
        >
          <Crosshair className="h-4 w-4" />

          {busy
            ? "Localizando..."
            : "Confirmar endereço atual"}
        </button>
      </div>

      <div className="mt-4">
        <GoogleAddressAutocomplete
          onSelect={
            applySelection
          }
          placeholder="Pesquise rua, número ou CEP da empresa"
        />
      </div>

      <div
        ref={containerRef}
        className="mt-4 h-80 w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-100"
      />

      {mapError && (
        <p className="mt-2 text-xs font-semibold text-amber-700">
          {mapError}
        </p>
      )}

      {message && (
        <p className="mt-2 text-xs font-bold text-blue-800">
          {message}
        </p>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-white px-3 py-2 text-xs">
          <span className="block text-gray-500">
            Latitude
          </span>

          <strong>
            {Number(
              settings.storeLatitude,
            ).toFixed(6)}
          </strong>
        </div>

        <div className="rounded-xl bg-white px-3 py-2 text-xs">
          <span className="block text-gray-500">
            Longitude
          </span>

          <strong>
            {Number(
              settings.storeLongitude,
            ).toFixed(6)}
          </strong>
        </div>
      </div>
    </div>
  )
}