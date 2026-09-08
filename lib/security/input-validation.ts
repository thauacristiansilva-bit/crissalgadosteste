export class InputValidationError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "InputValidationError"
    this.status = status
  }
}

type TextOptions = {
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  allowNewlines?: boolean
}

type NumberOptions = {
  min?: number
  max?: number
  integer?: boolean
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MONTH_PATTERN = /^\d{4}-\d{2}$/
const SAFE_CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/

function asFiniteContentLength(value: string | null) {
  if (!value || !/^\d+$/.test(value.trim())) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

export function validationErrorStatus(error: unknown) {
  return error instanceof InputValidationError ? error.status : 400
}

export function requestBodyTooLarge(request: Request, maxBytes: number) {
  const length = asFiniteContentLength(request.headers.get("content-length"))
  return length !== null && length > maxBytes
}

export async function readJsonObject(
  request: Request,
  maxBytes = 32 * 1024,
): Promise<Record<string, unknown> | null> {
  if (requestBodyTooLarge(request, maxBytes)) {
    throw new InputValidationError("Corpo da requisição muito grande.", 413)
  }

  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new InputValidationError("Corpo da requisição muito grande.", 413)
  }

  if (!raw.trim()) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new InputValidationError("JSON inválido.")
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new InputValidationError("O corpo da requisição deve ser um objeto JSON.")
  }

  return parsed as Record<string, unknown>
}

export function requiredText(
  value: unknown,
  field: string,
  options: TextOptions = {},
) {
  if (typeof value !== "string") {
    throw new InputValidationError(`${field} é obrigatório.`)
  }

  const text = value.trim()
  const minLength = options.minLength ?? 1
  const maxLength = options.maxLength ?? 255

  if (text.length < minLength || text.length > maxLength) {
    throw new InputValidationError(
      `${field} deve ter entre ${minLength} e ${maxLength} caracteres.`,
    )
  }

  if (SAFE_CONTROL_CHARS.test(text)) {
    throw new InputValidationError(`${field} contém caracteres inválidos.`)
  }

  if (options.allowNewlines === false && /[\r\n]/.test(text)) {
    throw new InputValidationError(`${field} não pode conter quebra de linha.`)
  }

  if (options.pattern && !options.pattern.test(text)) {
    throw new InputValidationError(`${field} possui formato inválido.`)
  }

  return text
}

export function optionalText(
  value: unknown,
  field: string,
  options: TextOptions = {},
) {
  if (value === null || value === undefined || value === "") return null
  return requiredText(value, field, { ...options, minLength: options.minLength ?? 0 })
}

export function finiteNumber(
  value: unknown,
  field: string,
  options: NumberOptions = {},
) {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  ) {
    throw new InputValidationError(`${field} deve ser numérico.`)
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    throw new InputValidationError(`${field} deve ser numérico.`)
  }

  if (options.integer && !Number.isSafeInteger(parsed)) {
    throw new InputValidationError(`${field} deve ser um número inteiro válido.`)
  }

  if (options.min !== undefined && parsed < options.min) {
    throw new InputValidationError(`${field} está abaixo do valor mínimo permitido.`)
  }

  if (options.max !== undefined && parsed > options.max) {
    throw new InputValidationError(`${field} excede o valor máximo permitido.`)
  }

  return parsed
}

export function optionalBoolean(value: unknown, field: string, fallback: boolean) {
  if (value === undefined || value === null) return fallback
  if (typeof value !== "boolean") {
    throw new InputValidationError(`${field} deve ser verdadeiro ou falso.`)
  }
  return value
}

export function oneOf<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new InputValidationError(`${field} inválido.`)
  }
  return value as T
}

export function strictDate(value: unknown, field: string) {
  const text = requiredText(value, field, {
    minLength: 10,
    maxLength: 10,
    pattern: DATE_PATTERN,
    allowNewlines: false,
  })

  const [year, month, day] = text.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new InputValidationError(`${field} é uma data inválida.`)
  }

  return text
}

export function optionalDate(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return null
  return strictDate(value, field)
}

export function strictMonth(value: unknown, field = "Mês") {
  const text = requiredText(value, field, {
    minLength: 7,
    maxLength: 7,
    pattern: MONTH_PATTERN,
    allowNewlines: false,
  })

  const month = Number(text.slice(5, 7))
  if (month < 1 || month > 12) {
    throw new InputValidationError(`${field} inválido.`)
  }

  return text
}

export function optionalMonth(value: unknown, field = "Mês") {
  if (value === null || value === undefined || value === "") return null
  return strictMonth(value, field)
}

export function optionalIsoDateTime(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return null
  const text = requiredText(value, field, {
    minLength: 10,
    maxLength: 64,
    allowNewlines: false,
  })

  if (DATE_PATTERN.test(text)) {
    return strictDate(text, field)
  }

  const parsed = Date.parse(text)
  if (!Number.isFinite(parsed)) {
    throw new InputValidationError(`${field} possui data ou horário inválido.`)
  }

  return text
}

export function latitude(value: unknown) {
  return finiteNumber(value, "Latitude", { min: -90, max: 90 })
}

export function longitude(value: unknown) {
  return finiteNumber(value, "Longitude", { min: -180, max: 180 })
}
