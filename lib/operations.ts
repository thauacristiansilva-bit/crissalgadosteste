import type { BusinessHour, DeliveryZone, StoreSettings } from "@/lib/types"
import { compareDeliveryZoneSpecificity, pointInPolygonInclusive } from "@/lib/delivery-zone-geometry"

export const FORTALEZA_TIME_ZONE = "America/Fortaleza"

export const defaultBusinessHours: BusinessHour[] = [
  { day: 0, label: "Domingo", enabled: false, open: "08:00", close: "20:00" },
  { day: 1, label: "Segunda", enabled: true, open: "08:00", close: "20:00" },
  { day: 2, label: "Terça", enabled: true, open: "08:00", close: "20:00" },
  { day: 3, label: "Quarta", enabled: true, open: "08:00", close: "20:00" },
  { day: 4, label: "Quinta", enabled: true, open: "08:00", close: "20:00" },
  { day: 5, label: "Sexta", enabled: true, open: "08:00", close: "20:00" },
  { day: 6, label: "Sábado", enabled: true, open: "08:00", close: "20:00" },
]

export function fortalezaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FORTALEZA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ""
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
    day: weekdayMap[get("weekday")] ?? 0,
  }
}

export function localFortalezaDate(dateText: string, timeText: string) {
  return new Date(`${dateText}T${timeText}:00-03:00`)
}

export function isWithinBusinessHours(settings: Pick<StoreSettings, "businessHours">, date: Date) {
  const parts = fortalezaParts(date)
  const schedule = settings.businessHours.find((item) => item.day === parts.day)
  if (!schedule?.enabled) return false
  return parts.time >= schedule.open && parts.time <= schedule.close
}

export function isStoreOpenNow(settings: StoreSettings, now = new Date()) {
  return settings.acceptingOrders && isWithinBusinessHours(settings, now)
}

export function minutesBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 60000)
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const earth = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * earth * Math.asin(Math.sqrt(a))
}

export function pointInPolygon(latitude: number, longitude: number, points: Array<{ lat: number; lng: number }>) {
  return pointInPolygonInclusive({ lat: latitude, lng: longitude }, points)
}

export function findDeliveryZone(zones: DeliveryZone[], latitude: number, longitude: number) {
  const matches = zones
    .filter((zone) => zone.active)
    .map((zone) => {
      if (zone.shape === "polygon" && zone.points.length >= 3) {
        return pointInPolygon(latitude, longitude, zone.points) ? { zone, distance: 0 } : null
      }
      const distance = haversineMeters(zone.centerLat, zone.centerLng, latitude, longitude)
      return distance <= zone.radiusMeters ? { zone, distance } : null
    })
    .filter((entry): entry is { zone: DeliveryZone; distance: number } => Boolean(entry))
  // Quando duas áreas encostam ou uma cobertura externa passa sobre uma interna,
  // a área geograficamente menor é a mais específica e recebe o ponto.
  // Isso elimina faixas sem cobertura e também evita duas taxas concorrendo pelo mesmo endereço.
  return matches.sort((a, b) => compareDeliveryZoneSpecificity(a.zone, b.zone))[0] || null
}
