import type { BusinessHour, DeliveryZone, StoreSettings } from "@/lib/types"
import { compareDeliveryZoneSpecificity, pointInPolygonInclusive } from "@/lib/delivery-zone-geometry"

export const FORTALEZA_TIME_ZONE = "America/Fortaleza"
export const DEFAULT_ORGANIZATION_TIME_ZONE = "America/Sao_Paulo"

export const defaultBusinessHours: BusinessHour[] = [
  { day: 0, label: "Domingo", enabled: false, open: "08:00", close: "20:00" },
  { day: 1, label: "Segunda", enabled: true, open: "08:00", close: "20:00" },
  { day: 2, label: "Terça", enabled: true, open: "08:00", close: "20:00" },
  { day: 3, label: "Quarta", enabled: true, open: "08:00", close: "20:00" },
  { day: 4, label: "Quinta", enabled: true, open: "08:00", close: "20:00" },
  { day: 5, label: "Sexta", enabled: true, open: "08:00", close: "20:00" },
  { day: 6, label: "Sábado", enabled: true, open: "08:00", close: "20:00" },
]

function safeTimeZone(timeZone?: string) {
  const candidate = timeZone?.trim() || DEFAULT_ORGANIZATION_TIME_ZONE
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date())
    return candidate
  } catch {
    return DEFAULT_ORGANIZATION_TIME_ZONE
  }
}

export function zonedParts(date = new Date(), timeZone?: string) {
  const zone = safeTimeZone(timeZone)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ""
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
    seconds: get("second"),
    day: weekdayMap[get("weekday")] ?? 0,
    year: Number(get("year")),
    month: Number(get("month")),
    dateOfMonth: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    timeZone: zone,
  }
}

export function zonedDateString(date = new Date(), timeZone?: string) {
  return zonedParts(date, timeZone).date
}

/**
 * Converts a wall-clock date/time from an IANA timezone to a real Date instant.
 * The iterative correction avoids hard-coding a UTC offset and also works in
 * Brazilian zones outside UTC-03.
 */
export function zonedDateTime(dateText: string, timeText: string, timeZone?: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeText)
  if (!dateMatch || !timeMatch) return new Date(Number.NaN)

  const desired = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    0,
  )

  let guess = desired
  for (let index = 0; index < 4; index += 1) {
    const actual = zonedParts(new Date(guess), timeZone)
    const represented = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.dateOfMonth,
      actual.hour,
      actual.minute,
      actual.second,
    )
    const delta = desired - represented
    guess += delta
    if (Math.abs(delta) < 1000) break
  }

  return new Date(guess)
}

export function fortalezaParts(date = new Date()) {
  return zonedParts(date, FORTALEZA_TIME_ZONE)
}

export function localFortalezaDate(dateText: string, timeText: string) {
  return zonedDateTime(dateText, timeText, FORTALEZA_TIME_ZONE)
}

export function isWithinBusinessHours(
  settings: Pick<StoreSettings, "businessHours" | "timeZone">,
  date: Date,
) {
  const parts = zonedParts(date, settings.timeZone)
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
  return matches.sort((a, b) => compareDeliveryZoneSpecificity(a.zone, b.zone))[0] || null
}
