import { createHash } from "node:crypto"
import { getPostgresPool } from "@/lib/postgres"

function digits(value: string) {
  return value.replace(/\D/g, "")
}

export function normalizeCpfDocument(value: string) {
  return digits(value)
}

export function normalizeCnpjDocument(value: string) {
  return digits(value)
}

export function isValidResponsibleCpf(value: string) {
  const cpf = normalizeCpfDocument(value)
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false

  const digit = (length: number) => {
    let sum = 0
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index)
    }
    const mod = (sum * 10) % 11
    return mod === 10 ? 0 : mod
  }

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}

export function isValidCompanyCnpj(value: string) {
  const cnpj = normalizeCnpjDocument(value)
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false

  const calculate = (length: 12 | 13) => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = weights.reduce((total, weight, index) => total + Number(cnpj[index]) * weight, 0)
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }

  return calculate(12) === Number(cnpj[12]) && calculate(13) === Number(cnpj[13])
}

export function responsibleCpfHash(value: string) {
  return createHash("sha256")
    .update(`saborflow-responsible-cpf:v1:${normalizeCpfDocument(value)}`)
    .digest("hex")
}

export type CommercialRegistrationInput = {
  cpf: string
  hasCnpj?: boolean
  cnpj?: string
}

export type NormalizedCommercialRegistration = {
  cpfDigits: string
  cpfHash: string
  cpfLast4: string
  companyPersonType: "PF" | "PJ"
  companyDocument: string | null
}

export function normalizeCommercialRegistration(
  input: CommercialRegistrationInput,
): NormalizedCommercialRegistration {
  const cpfDigits = normalizeCpfDocument(input.cpf || "")
  if (!isValidResponsibleCpf(cpfDigits)) {
    throw new Error("Informe um CPF válido para o responsável pela conta.")
  }

  if (input.hasCnpj) {
    const cnpjDigits = normalizeCnpjDocument(input.cnpj || "")
    if (!isValidCompanyCnpj(cnpjDigits)) {
      throw new Error("Informe um CNPJ válido para a empresa.")
    }
    return {
      cpfDigits,
      cpfHash: responsibleCpfHash(cpfDigits),
      cpfLast4: cpfDigits.slice(-4),
      companyPersonType: "PJ",
      companyDocument: cnpjDigits,
    }
  }

  return {
    cpfDigits,
    cpfHash: responsibleCpfHash(cpfDigits),
    cpfLast4: cpfDigits.slice(-4),
    companyPersonType: "PF",
    companyDocument: null,
  }
}

export function commercialRegistrationMetadata(
  registration: NormalizedCommercialRegistration,
  source: string,
) {
  return {
    signup: "phase-26",
    source,
    registration: {
      responsibleCpfLast4: registration.cpfLast4,
      responsibleCpfStoredAsHash: true,
      responsibleDocumentValidation: "local_check_digits",
      companyPersonType: registration.companyPersonType,
      companyDocument: registration.companyDocument,
      companyDocumentValidation: registration.companyDocument
        ? "local_check_digits"
        : "pending_company_creation",
      officialRegistryVerification: "pending",
    },
  }
}

export type CommercialRegistrationProfile = {
  responsibleCpfLast4: string
  companyPersonType: "PF" | "PJ"
  companyDocument: string
  officialRegistryVerification: "pending" | "verified" | "failed"
}

export async function getCommercialRegistrationProfile(
  userId: string,
): Promise<CommercialRegistrationProfile | null> {
  const result = await getPostgresPool().query<{
    metadata: Record<string, unknown> | null
  }>(
    `
      SELECT metadata
      FROM sf_billing_accounts
      WHERE owner_user_id = $1
      LIMIT 1
    `,
    [userId],
  )

  const metadata = result.rows[0]?.metadata
  if (!metadata || typeof metadata !== "object") return null
  const registration = metadata.registration
  if (!registration || typeof registration !== "object" || Array.isArray(registration)) return null

  const row = registration as Record<string, unknown>
  const personType = row.companyPersonType === "PF" ? "PF" : "PJ"
  const verification = row.officialRegistryVerification === "verified"
    ? "verified"
    : row.officialRegistryVerification === "failed"
      ? "failed"
      : "pending"

  return {
    responsibleCpfLast4: String(row.responsibleCpfLast4 || ""),
    companyPersonType: personType,
    companyDocument: String(row.companyDocument || ""),
    officialRegistryVerification: verification,
  }
}
