export type RouteDistance = {
  distanceMeters: number
  durationSeconds: number
}

export async function computeDrivingRouteDistance(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): Promise<RouteDistance> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY
  if (!apiKey) throw new Error("Configure GOOGLE_MAPS_SERVER_API_KEY para usar preços por distância percorrida.")

  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      computeAlternativeRoutes: false,
      languageCode: "pt-BR",
      units: "METRIC",
    }),
    cache: "no-store",
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data?.error?.message || "Não foi possível calcular a distância pelas ruas."
    throw new Error(message)
  }

  const route = data?.routes?.[0]
  const distanceMeters = Number(route?.distanceMeters)
  const durationText = String(route?.duration || "0s")
  const durationSeconds = Math.max(0, Number.parseFloat(durationText.replace("s", "")) || 0)
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) throw new Error("O Google Routes não retornou uma rota válida até esse endereço.")
  return { distanceMeters, durationSeconds }
}
