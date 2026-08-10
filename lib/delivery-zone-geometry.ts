import type { DeliveryZone, GeoPoint } from "@/lib/types"

const EPSILON = 1e-10
const METERS_EPSILON = 0.25

export const DELIVERY_ZONE_COLORS = [
  "#2563EB", // azul
  "#DC2626", // vermelho
  "#16A34A", // verde
  "#9333EA", // roxo
  "#EA580C", // laranja
  "#0891B2", // ciano
  "#DB2777", // rosa
  "#65A30D", // lima
  "#7C3AED", // violeta
  "#D97706", // âmbar
  "#0F766E", // teal
  "#4F46E5", // índigo
  "#BE123C", // rose
  "#15803D", // verde escuro
  "#0369A1", // sky
  "#A21CAF", // fúcsia
]

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())
}

export function deliveryZoneColor(value: unknown, fallbackIndex = 0) {
  return isHexColor(value) ? value.trim().toUpperCase() : DELIVERY_ZONE_COLORS[Math.abs(fallbackIndex) % DELIVERY_ZONE_COLORS.length]
}

export function nextDeliveryZoneColor(zones: Array<Pick<DeliveryZone, "color">>) {
  const used = new Set(zones.map((zone) => deliveryZoneColor(zone.color).toUpperCase()))
  const free = DELIVERY_ZONE_COLORS.find((color) => !used.has(color.toUpperCase()))
  if (free) return free

  const index = zones.length
  const hue = Math.round((index * 137.508) % 360)
  return hslToHex(hue, 68, 44)
}

function hslToHex(h: number, s: number, l: number) {
  const saturation = s / 100
  const lightness = l / 100
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lightness - c / 2
  let r = 0; let g = 0; let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const hex = (value: number) => Math.round((value + m) * 255).toString(16).padStart(2, "0")
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase()
}

function cross(a: GeoPoint, b: GeoPoint, c: GeoPoint) {
  return (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng)
}

function sign(value: number) {
  if (Math.abs(value) <= EPSILON) return 0
  return value > 0 ? 1 : -1
}

export function pointOnSegment(point: GeoPoint, a: GeoPoint, b: GeoPoint) {
  if (Math.abs(cross(a, b, point)) > EPSILON) return false
  return point.lng >= Math.min(a.lng, b.lng) - EPSILON && point.lng <= Math.max(a.lng, b.lng) + EPSILON &&
    point.lat >= Math.min(a.lat, b.lat) - EPSILON && point.lat <= Math.max(a.lat, b.lat) + EPSILON
}

function segmentsIntersectInclusive(a: GeoPoint, b: GeoPoint, c: GeoPoint, d: GeoPoint) {
  const o1 = sign(cross(a, b, c)); const o2 = sign(cross(a, b, d))
  const o3 = sign(cross(c, d, a)); const o4 = sign(cross(c, d, b))
  if (o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) return true
  return (o1 === 0 && pointOnSegment(c, a, b)) || (o2 === 0 && pointOnSegment(d, a, b)) ||
    (o3 === 0 && pointOnSegment(a, c, d)) || (o4 === 0 && pointOnSegment(b, c, d))
}

function segmentsProperlyIntersect(a: GeoPoint, b: GeoPoint, c: GeoPoint, d: GeoPoint) {
  const o1 = sign(cross(a, b, c)); const o2 = sign(cross(a, b, d))
  const o3 = sign(cross(c, d, a)); const o4 = sign(cross(c, d, b))
  return o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0 && o1 !== o2 && o3 !== o4
}

export function polygonSelfIntersects(points: GeoPoint[]) {
  if (points.length < 4) return false
  const edgeCount = points.length
  for (let i = 0; i < edgeCount; i += 1) {
    const a = points[i]; const b = points[(i + 1) % edgeCount]
    for (let j = i + 1; j < edgeCount; j += 1) {
      const adjacent = j === i || j === i + 1 || (i === 0 && j === edgeCount - 1)
      if (adjacent) continue
      const c = points[j]; const d = points[(j + 1) % edgeCount]
      if (segmentsIntersectInclusive(a, b, c, d)) return true
    }
  }
  return false
}

export function pointInPolygonInclusive(point: GeoPoint, polygon: GeoPoint[]) {
  if (polygon.length < 3) return false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (pointOnSegment(point, polygon[j], polygon[i])) return true
  }
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]; const b = polygon[j]
    const intersects = ((a.lat > point.lat) !== (b.lat > point.lat)) &&
      (point.lng < ((b.lng - a.lng) * (point.lat - a.lat)) / ((b.lat - a.lat) || Number.EPSILON) + a.lng)
    if (intersects) inside = !inside
  }
  return inside
}

function pointInPolygonStrict(point: GeoPoint, polygon: GeoPoint[]) {
  if (polygon.length < 3) return false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (pointOnSegment(point, polygon[j], polygon[i])) return false
  }
  return pointInPolygonInclusive(point, polygon)
}

function averagePoint(points: GeoPoint[]) {
  return {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
  }
}

function interiorSamples(points: GeoPoint[]) {
  const average = averagePoint(points)
  const candidates: GeoPoint[] = [average]
  for (const point of points) {
    candidates.push({ lat: point.lat * 0.75 + average.lat * 0.25, lng: point.lng * 0.75 + average.lng * 0.25 })
    candidates.push({ lat: point.lat * 0.5 + average.lat * 0.5, lng: point.lng * 0.5 + average.lng * 0.5 })
  }
  return candidates.filter((point) => pointInPolygonStrict(point, points))
}

export function polygonsOverlap(a: GeoPoint[], b: GeoPoint[]) {
  if (a.length < 3 || b.length < 3) return false
  for (let i = 0; i < a.length; i += 1) {
    const a1 = a[i]; const a2 = a[(i + 1) % a.length]
    for (let j = 0; j < b.length; j += 1) {
      const b1 = b[j]; const b2 = b[(j + 1) % b.length]
      if (segmentsProperlyIntersect(a1, a2, b1, b2)) return true
    }
  }
  if (a.some((point) => pointInPolygonStrict(point, b))) return true
  if (b.some((point) => pointInPolygonStrict(point, a))) return true
  if (interiorSamples(a).some((point) => pointInPolygonStrict(point, b))) return true
  if (interiorSamples(b).some((point) => pointInPolygonStrict(point, a))) return true
  return false
}

function distanceMeters(a: GeoPoint, b: GeoPoint) {
  const toRad = (value: number) => value * Math.PI / 180
  const earth = 6371000
  const dLat = toRad(b.lat - a.lat); const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat); const lat2 = toRad(b.lat)
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * earth * Math.asin(Math.sqrt(value))
}

function pointSegmentDistanceMeters(point: GeoPoint, a: GeoPoint, b: GeoPoint) {
  return nearestPointOnSegmentMeters(point, a, b).distanceMeters
}

function nearestPointOnSegmentMeters(point: GeoPoint, a: GeoPoint, b: GeoPoint) {
  const referenceLat = (point.lat + a.lat + b.lat) / 3
  const metersPerLng = 111320 * Math.max(0.01, Math.cos(referenceLat * Math.PI / 180))
  const metersPerLat = 110540
  const ax = (a.lng - point.lng) * metersPerLng
  const ay = (a.lat - point.lat) * metersPerLat
  const bx = (b.lng - point.lng) * metersPerLng
  const by = (b.lat - point.lat) * metersPerLat
  const dx = bx - ax
  const dy = by - ay
  const denominator = dx * dx + dy * dy
  const t = denominator <= Number.EPSILON ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / denominator))
  const x = ax + t * dx
  const y = ay + t * dy
  return {
    point: {
      lat: point.lat + y / metersPerLat,
      lng: point.lng + x / metersPerLng,
    },
    distanceMeters: Math.sqrt(x * x + y * y),
  }
}

function polygonCircleOverlap(points: GeoPoint[], center: GeoPoint, radiusMeters: number) {
  if (points.some((point) => distanceMeters(point, center) < radiusMeters - METERS_EPSILON)) return true
  if (pointInPolygonStrict(center, points)) return true
  for (let i = 0; i < points.length; i += 1) {
    if (pointSegmentDistanceMeters(center, points[i], points[(i + 1) % points.length]) < radiusMeters - METERS_EPSILON) return true
  }
  return false
}

export function deliveryZonesOverlap(a: Pick<DeliveryZone, "shape" | "points" | "centerLat" | "centerLng" | "radiusMeters">, b: Pick<DeliveryZone, "shape" | "points" | "centerLat" | "centerLng" | "radiusMeters">) {
  if (a.shape === "polygon" && b.shape === "polygon") return polygonsOverlap(a.points, b.points)
  if (a.shape === "circle" && b.shape === "circle") {
    return distanceMeters({ lat: a.centerLat, lng: a.centerLng }, { lat: b.centerLat, lng: b.centerLng }) < a.radiusMeters + b.radiusMeters - METERS_EPSILON
  }
  const polygon = a.shape === "polygon" ? a : b
  const circle = a.shape === "circle" ? a : b
  return polygonCircleOverlap(polygon.points, { lat: circle.centerLat, lng: circle.centerLng }, circle.radiusMeters)
}

/**
 * Aproxima a área geográfica em m². Ela é usada somente para decidir prioridade
 * quando duas coberturas se encontram: a área menor é considerada mais específica.
 */
export function deliveryZoneAreaScore(zone: Pick<DeliveryZone, "shape" | "points" | "centerLat" | "radiusMeters">) {
  if (zone.shape === "circle") return Math.PI * Math.max(0, zone.radiusMeters) ** 2
  if (!Array.isArray(zone.points) || zone.points.length < 3) return Number.POSITIVE_INFINITY
  const referenceLat = zone.points.reduce((sum, point) => sum + point.lat, 0) / zone.points.length
  const metersPerLng = 111320 * Math.max(0.01, Math.cos(referenceLat * Math.PI / 180))
  const metersPerLat = 110540
  let twiceArea = 0
  for (let i = 0; i < zone.points.length; i += 1) {
    const a = zone.points[i]
    const b = zone.points[(i + 1) % zone.points.length]
    const ax = a.lng * metersPerLng
    const ay = a.lat * metersPerLat
    const bx = b.lng * metersPerLng
    const by = b.lat * metersPerLat
    twiceArea += ax * by - bx * ay
  }
  return Math.max(1, Math.abs(twiceArea) / 2)
}

export function compareDeliveryZoneSpecificity(a: DeliveryZone, b: DeliveryZone) {
  const areaDifference = deliveryZoneAreaScore(a) - deliveryZoneAreaScore(b)
  if (Math.abs(areaDifference) > 1) return areaDifference
  return a.id - b.id
}

export function snapPointToDeliveryBoundaries(
  point: GeoPoint,
  zones: DeliveryZone[],
  options?: { ignoreZoneId?: number | null; maxDistanceMeters?: number },
) {
  const maxDistanceMeters = Math.max(1, options?.maxDistanceMeters ?? 35)
  let best: { point: GeoPoint; distanceMeters: number; zone: DeliveryZone } | null = null

  for (const zone of zones) {
    if (!zone.active || zone.id === options?.ignoreZoneId || zone.shape !== "polygon" || zone.points.length < 2) continue
    for (let index = 0; index < zone.points.length; index += 1) {
      const candidate = nearestPointOnSegmentMeters(point, zone.points[index], zone.points[(index + 1) % zone.points.length])
      if (candidate.distanceMeters > maxDistanceMeters) continue
      if (!best || candidate.distanceMeters < best.distanceMeters) best = { ...candidate, zone }
    }
  }

  return best
}

export function validateDeliveryPolygon(points: GeoPoint[], _zones: DeliveryZone[] = [], _ignoreZoneId?: number | null) {
  if (points.length < 3) return "Desenhe pelo menos 3 pontos para fechar a área."
  if (polygonSelfIntersects(points)) return "O desenho cruza ele mesmo. Reposicione os pontos para formar um polígono simples."
  // Sobreposição proposital não é erro: a área menor/específica ganha prioridade.
  // Assim a área externa pode passar ao redor da interna sem deixar ruas sem cobertura.
  return ""
}

export function assertDeliveryZoneValid(zone: DeliveryZone, zones: DeliveryZone[], ignoreZoneId?: number | null) {
  if (zone.shape === "polygon") {
    const message = validateDeliveryPolygon(zone.points, zones, ignoreZoneId)
    if (message) throw new Error(message)
  }
}
