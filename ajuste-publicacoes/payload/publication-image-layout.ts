export type PublicationChannel = "instagram_feed" | "instagram_story" | "whatsapp_status"
export function imageTarget(channel: PublicationChannel) {
  return { width: 1080, height: channel === "instagram_feed" ? 1080 : 1920 }
}
export function imagePlacement(width: number, height: number, targetWidth: number, targetHeight: number, mode: "contain" | "cover", zoom = 1, x = 0.5, y = 0.5) {
  if (![width, height, targetWidth, targetHeight].every(v => Number.isFinite(v) && v > 0)) throw new Error("Dimensões inválidas")
  const clamp = (value: number, fallback: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
  const scale = (mode === "contain" ? Math.min(targetWidth / width, targetHeight / height) : Math.max(targetWidth / width, targetHeight / height)) * (mode === "contain" ? 1 : Math.max(1, Math.min(3, Number.isFinite(zoom) ? zoom : 1)))
  const w = width * scale, h = height * scale
  return { width: w, height: h, left: (targetWidth - w) * clamp(x, 0.5), top: (targetHeight - h) * clamp(y, 0.5) }
}
