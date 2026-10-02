import { randomUUID } from "node:crypto"
import { getPostgresPool } from "@/lib/postgres"
import { MIGRATION_MAX_ASSETS, type MigrationAsset, type MigrationIntake, type MigrationIntakeStatus } from "@/lib/migration-intake-types"

type MigrationRow = {
  id: string
  organization_id: string
  status: MigrationIntakeStatus
  source_system: string
  source_url: string
  source_notes: string
  delivery_notes: string
  location_notes: string
  catalog_notes: string
  assets: unknown
  ai_requested: boolean
  submitted_at: Date | string | null
  completed_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

function iso(value: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function cleanText(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max)
}

function cleanUrl(value: unknown) {
  const text = cleanText(value, 1500)
  if (!text) return ""
  let parsed: URL
  try {
    parsed = new URL(text)
  } catch {
    throw new Error("Informe um link válido, começando com http:// ou https://.")
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error("O link antigo precisa usar http:// ou https://.")
  }
  return parsed.toString()
}

function assets(value: unknown): MigrationAsset[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const raw = item as Partial<MigrationAsset>
    if (!raw.id || !raw.url || !raw.filename || !raw.contentType) return []
    return [{
      id: String(raw.id),
      url: String(raw.url),
      filename: String(raw.filename).slice(0, 180),
      contentType: String(raw.contentType).slice(0, 80),
      size: Math.max(0, Number(raw.size || 0)),
      createdAt: String(raw.createdAt || new Date().toISOString()),
    }]
  }).slice(0, MIGRATION_MAX_ASSETS)
}

function mapRow(row: MigrationRow): MigrationIntake {
  return {
    id: row.id,
    organizationId: row.organization_id,
    status: row.status,
    sourceSystem: row.source_system || "",
    sourceUrl: row.source_url || "",
    sourceNotes: row.source_notes || "",
    deliveryNotes: row.delivery_notes || "",
    locationNotes: row.location_notes || "",
    catalogNotes: row.catalog_notes || "",
    assets: assets(row.assets),
    aiRequested: Boolean(row.ai_requested),
    submittedAt: iso(row.submitted_at),
    completedAt: iso(row.completed_at),
    createdAt: iso(row.created_at) || new Date().toISOString(),
    updatedAt: iso(row.updated_at) || new Date().toISOString(),
  }
}

async function ensureMigrationIntake(organizationId: string, userId: string) {
  await getPostgresPool().query(`
    INSERT INTO sf_migration_intakes (id, organization_id, created_by_user_id)
    VALUES ($1, $2, $3)
    ON CONFLICT (organization_id) DO NOTHING
  `, [randomUUID(), organizationId, userId])
}

export async function getMigrationIntake(organizationId: string, userId: string): Promise<MigrationIntake> {
  await ensureMigrationIntake(organizationId, userId)
  const result = await getPostgresPool().query<MigrationRow>(`
    SELECT id, organization_id, status, source_system, source_url,
           source_notes, delivery_notes, location_notes, catalog_notes,
           assets, ai_requested, submitted_at, completed_at, created_at, updated_at
    FROM sf_migration_intakes
    WHERE organization_id = $1
    LIMIT 1
  `, [organizationId])
  if (!result.rows[0]) throw new Error("Não foi possível preparar a área de migração.")
  return mapRow(result.rows[0])
}

export async function saveMigrationIntake(
  organizationId: string,
  userId: string,
  input: {
    sourceSystem?: unknown
    sourceUrl?: unknown
    sourceNotes?: unknown
    deliveryNotes?: unknown
    locationNotes?: unknown
    catalogNotes?: unknown
    aiRequested?: unknown
  },
): Promise<MigrationIntake> {
  await ensureMigrationIntake(organizationId, userId)
  await getPostgresPool().query(`
    UPDATE sf_migration_intakes
    SET source_system = $2,
        source_url = $3,
        source_notes = $4,
        delivery_notes = $5,
        location_notes = $6,
        catalog_notes = $7,
        ai_requested = $8,
        status = CASE WHEN status IN ('processing', 'ready', 'completed') THEN status ELSE 'draft' END,
        submitted_at = CASE WHEN status IN ('processing', 'ready', 'completed') THEN submitted_at ELSE NULL END,
        updated_at = now()
    WHERE organization_id = $1
  `, [
    organizationId,
    cleanText(input.sourceSystem, 120),
    cleanUrl(input.sourceUrl),
    cleanText(input.sourceNotes, 5000),
    cleanText(input.deliveryNotes, 4000),
    cleanText(input.locationNotes, 4000),
    cleanText(input.catalogNotes, 5000),
    Boolean(input.aiRequested),
  ])
  return getMigrationIntake(organizationId, userId)
}

export async function addMigrationAsset(
  organizationId: string,
  userId: string,
  asset: Omit<MigrationAsset, "id" | "createdAt">,
): Promise<MigrationIntake> {
  const current = await getMigrationIntake(organizationId, userId)
  if (current.status === "processing" || current.status === "completed") {
    throw new Error("Esta migração já está em processamento e não aceita novos anexos agora.")
  }
  if (current.assets.length >= MIGRATION_MAX_ASSETS) {
    throw new Error(`O limite desta migração é de ${MIGRATION_MAX_ASSETS} imagens.`)
  }
  const next: MigrationAsset = {
    ...asset,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  }
  await getPostgresPool().query(`
    UPDATE sf_migration_intakes
    SET assets = COALESCE(assets, '[]'::jsonb) || $2::jsonb,
        status = 'draft', submitted_at = NULL, updated_at = now()
    WHERE organization_id = $1
  `, [organizationId, JSON.stringify([next])])
  return getMigrationIntake(organizationId, userId)
}

export async function removeMigrationAsset(
  organizationId: string,
  userId: string,
  assetId: string,
): Promise<MigrationIntake> {
  const current = await getMigrationIntake(organizationId, userId)
  if (current.status === "processing" || current.status === "completed") {
    throw new Error("Esta migração já está em processamento e não pode ser alterada agora.")
  }
  const nextAssets = current.assets.filter((asset) => asset.id !== assetId)
  await getPostgresPool().query(`
    UPDATE sf_migration_intakes
    SET assets = $2::jsonb, status = 'draft', submitted_at = NULL, updated_at = now()
    WHERE organization_id = $1
  `, [organizationId, JSON.stringify(nextAssets)])
  return getMigrationIntake(organizationId, userId)
}

export async function submitMigrationIntake(organizationId: string, userId: string): Promise<MigrationIntake> {
  const current = await getMigrationIntake(organizationId, userId)
  const hasMaterial = Boolean(
    current.sourceUrl || current.assets.length || current.sourceNotes || current.catalogNotes,
  )
  if (!hasMaterial) {
    throw new Error("Envie pelo menos um link, uma imagem ou informações do cadastro antigo antes de continuar.")
  }
  await getPostgresPool().query(`
    UPDATE sf_migration_intakes
    SET status = 'submitted', submitted_at = now(), updated_at = now()
    WHERE organization_id = $1
      AND status NOT IN ('processing', 'completed')
  `, [organizationId])
  return getMigrationIntake(organizationId, userId)
}
