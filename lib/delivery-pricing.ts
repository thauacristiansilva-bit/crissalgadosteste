import type { DeliveryZone, StoreSettings } from "@/lib/types"
import { computeDrivingRouteDistance } from "@/lib/google-routes-server"
import { findDeliveryZone } from "@/lib/operations"

export type DeliveryQuote = {
  fee: number
  mode: StoreSettings["deliveryPricingMode"]
  distanceKm: number | null
  durationMinutes: number | null
  zone: DeliveryZone | null
  label: string
}

const roundedMoney = (value: number) => Math.max(0, Number(Number(value || 0).toFixed(2)))
const isFreeBySubtotal = (settings: StoreSettings, subtotal: number) => settings.freeDeliveryAbove > 0 && subtotal >= settings.freeDeliveryAbove

export async function calculateDeliveryQuote(settings: StoreSettings, zones: DeliveryZone[], latitude: number, longitude: number, subtotal = 0): Promise<DeliveryQuote> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Defina o ponto exato da entrega no mapa.")

  if (settings.deliveryPricingMode === "free") {
    return { fee: 0, mode: "free", distanceKm: null, durationMinutes: null, zone: null, label: "Entrega grátis" }
  }

  if (settings.deliveryPricingMode === "fixed") {
    const free = isFreeBySubtotal(settings, subtotal)
    return { fee: free ? 0 : roundedMoney(settings.fixedDeliveryFee), mode: "fixed", distanceKm: null, durationMinutes: null, zone: null, label: free ? "Entrega grátis pelo valor do pedido" : "Preço fixo" }
  }

  if (settings.deliveryPricingMode === "customAreas") {
    const match = findDeliveryZone(zones, latitude, longitude)
    if (!match) throw new Error("Esse endereço está fora das áreas personalizadas de entrega.")
    const free = isFreeBySubtotal(settings, subtotal)
    return { fee: free ? 0 : roundedMoney(match.zone.fee), mode: "customAreas", distanceKm: null, durationMinutes: null, zone: match.zone, label: free ? `Entrega grátis · ${match.zone.name}` : match.zone.name }
  }

  const route = await computeDrivingRouteDistance(
    { lat: settings.storeLatitude, lng: settings.storeLongitude },
    { lat: latitude, lng: longitude },
  )
  const distanceKm = route.distanceMeters / 1000
  const durationMinutes = Math.max(1, Math.ceil(route.durationSeconds / 60))
  if (settings.maxDeliveryDistanceKm > 0 && distanceKm > settings.maxDeliveryDistanceKm) {
    throw new Error(`Endereço fora da cobertura de ${settings.maxDeliveryDistanceKm.toFixed(1).replace(".", ",")} km pelas ruas.`)
  }

  if (isFreeBySubtotal(settings, subtotal)) {
    return { fee: 0, mode: settings.deliveryPricingMode, distanceKm, durationMinutes, zone: null, label: "Entrega grátis pelo valor do pedido" }
  }

  if (settings.deliveryPricingMode === "distance") {
    const fee = settings.distanceBaseFee + distanceKm * settings.distanceFeePerKm
    return { fee: roundedMoney(fee), mode: "distance", distanceKm, durationMinutes, zone: null, label: "Distância percorrida" }
  }

  const band = settings.deliveryDistanceBands
    .filter((item) => item.active)
    .sort((a, b) => a.minKm - b.minKm || a.maxKm - b.maxKm)
    .find((item) => distanceKm >= item.minKm && distanceKm <= item.maxKm)
  if (!band) throw new Error("Não existe uma faixa de preço configurada para essa distância.")
  return { fee: roundedMoney(band.fee), mode: "distanceBands", distanceKm, durationMinutes, zone: null, label: `${band.minKm.toFixed(1)}–${band.maxKm.toFixed(1)} km` }
}
