export type GoogleAddress = {
  address: string
  number: string
  district: string
  city: string
  state: string
  zipCode: string
  formattedAddress: string
  locationType?: string
}

declare global {
  interface Window {
    google?: any
    __crisGoogleMapsReady?: () => void
  }
}

let googleMapsPromise: Promise<any> | null = null

export function hasGoogleMapsKey() {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
}

export function googleMapsMapId() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID"
}

export function loadGoogleMaps() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps só pode ser carregado no navegador."))
  }

  if (window.google?.maps) return Promise.resolve(window.google)
  if (googleMapsPromise) return googleMapsPromise

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return Promise.reject(new Error("Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para ativar o mapa do delivery."))
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-cris-google-maps="true"]')

    window.__crisGoogleMapsReady = () => {
      if (window.google?.maps) resolve(window.google)
      else reject(new Error("Google Maps não ficou disponível após o carregamento."))
    }

    if (existing) {
      const startedAt = Date.now()
      const timer = window.setInterval(() => {
        if (window.google?.maps) {
          window.clearInterval(timer)
          resolve(window.google)
        } else if (Date.now() - startedAt > 15000) {
          window.clearInterval(timer)
          reject(new Error("Tempo esgotado ao carregar o Google Maps."))
        }
      }, 120)
      return
    }

    const script = document.createElement("script")
    const params = new URLSearchParams({
      key: apiKey,
      callback: "__crisGoogleMapsReady",
      libraries: "marker,places",
      v: "weekly",
      language: "pt-BR",
      region: "BR",
      loading: "async",
    })

    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
    script.async = true
    script.defer = true
    script.dataset.crisGoogleMaps = "true"
    script.onerror = () => reject(new Error("Não foi possível carregar o Google Maps."))
    document.head.appendChild(script)
  })

  return googleMapsPromise
}

function addressComponents(result: any) {
  if (Array.isArray(result?.address_components)) return result.address_components
  if (Array.isArray(result?.addressComponents)) return result.addressComponents
  return []
}

function component(result: any, type: string, short = false) {
  const item = addressComponents(result).find((entry: any) => Array.isArray(entry?.types) && entry.types.includes(type))
  if (!item) return ""
  if (short) return String(item.short_name || item.shortText || item.long_name || item.longText || "")
  return String(item.long_name || item.longText || item.short_name || item.shortText || "")
}

function rankedResults(results: any[]) {
  const score = (result: any) => {
    const types = Array.isArray(result?.types) ? result.types : []
    let value = 0
    if (types.includes("street_address")) value += 100
    if (types.includes("premise")) value += 80
    if (types.includes("subpremise")) value += 70
    if (types.includes("route")) value += 60
    if (component(result, "street_number")) value += 30
    if (component(result, "route")) value += 25
    if (component(result, "postal_code")) value += 10
    if (component(result, "sublocality_level_1") || component(result, "neighborhood")) value += 8
    return value
  }
  return [...results].sort((a, b) => score(b) - score(a))
}

function componentAcross(results: any[], types: string[], short = false) {
  for (const result of results) {
    for (const type of types) {
      const value = component(result, type, short)
      if (value) return value
    }
  }
  return ""
}

export function addressFromGoogleResults(results: any[]): GoogleAddress {
  const ordered = rankedResults(results)
  const best = ordered[0]
  return {
    address: componentAcross(ordered, ["route"]),
    number: componentAcross(ordered, ["street_number"]),
    district: componentAcross(ordered, ["sublocality_level_1", "sublocality_level_2", "sublocality", "neighborhood", "administrative_area_level_4", "administrative_area_level_3"]),
    city: componentAcross(ordered, ["locality", "administrative_area_level_2", "administrative_area_level_3"]),
    state: componentAcross(ordered, ["administrative_area_level_1"], true),
    zipCode: componentAcross(ordered, ["postal_code"]),
    formattedAddress: best?.formatted_address || best?.formattedAddress || "",
  }
}

export function addressFromGoogleResult(result: any): GoogleAddress {
  return addressFromGoogleResults(result ? [result] : [])
}

async function createGeocoder() {
  const google = await loadGoogleMaps()
  if (typeof google.maps.importLibrary === "function") {
    const library = await google.maps.importLibrary("geocoding")
    if (library?.Geocoder) return new library.Geocoder()
  }
  if (google.maps.Geocoder) return new google.maps.Geocoder()
  throw new Error("O serviço de endereço do Google Maps não foi carregado.")
}

export async function geocodeGoogleAddress(address: string) {
  const geocoder = await createGeocoder()
  const response = await geocoder.geocode({ address, region: "BR" })
  const result = response.results?.[0]
  if (!result) throw new Error("Endereço não encontrado no Google Maps.")
  const location = result.geometry?.location
  if (!location) throw new Error("O Google Maps não retornou coordenadas para o endereço.")
  return {
    latitude: Number(location.lat()),
    longitude: Number(location.lng()),
    address: addressFromGoogleResults(response.results || [result]),
    locationType: result.geometry?.location_type || "",
  }
}

export async function reverseGeocodeGoogle(latitude: number, longitude: number): Promise<GoogleAddress | null> {
  const geocoder = await createGeocoder()
  const response = await geocoder.geocode({ location: { lat: latitude, lng: longitude } })
  const results = response.results || []
  if (!results.length) return null
  const best = rankedResults(results)[0]
  return {
    ...addressFromGoogleResults(results),
    locationType: best?.geometry?.location_type || "",
  }
}
