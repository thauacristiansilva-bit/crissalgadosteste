import { randomUUID } from "node:crypto"
import { getR2Config, putR2Object } from "@/lib/storage/r2"

const MAX_HELP_VIDEO_BYTES = 150 * 1024 * 1024

const allowedVideoTypes = {
  "video/mp4": "mp4",
  "video/webm": "webm",
} as const

type AllowedVideoType = keyof typeof allowedVideoTypes

function isAllowedVideoType(value: string): value is AllowedVideoType {
  return Object.prototype.hasOwnProperty.call(allowedVideoTypes, value)
}

function looksLikeMp4(bytes: Uint8Array) {
  return (
    bytes.length >= 12 &&
    String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]) === "ftyp"
  )
}

function looksLikeWebm(bytes: Uint8Array) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  )
}

export async function storeHelpCenterVideo(file: File) {
  if (!getR2Config()) throw new Error("Cloudflare R2 não está configurado.")

  if (!isAllowedVideoType(file.type)) {
    throw new Error("Formato de vídeo inválido. Use MP4 ou WebM.")
  }

  if (file.size <= 0 || file.size > MAX_HELP_VIDEO_BYTES) {
    throw new Error("O vídeo deve ter no máximo 150 MB.")
  }

  const bytes = new Uint8Array(await file.arrayBuffer())

  const signatureOk =
    file.type === "video/mp4" ? looksLikeMp4(bytes) : looksLikeWebm(bytes)

  if (!signatureOk) {
    throw new Error(
      "O conteúdo do arquivo não corresponde ao formato de vídeo informado.",
    )
  }

  const extension = allowedVideoTypes[file.type]
  const key = `help-center/videos/tutorial-${Date.now()}-${randomUUID()}.${extension}`
  const url = await putR2Object(key, bytes, file.type)

  return {
    url,
    key,
    size: file.size,
    contentType: file.type,
  }
}