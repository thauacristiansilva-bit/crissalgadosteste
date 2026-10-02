export const MIGRATION_MAX_ASSETS = 60
export const MIGRATION_MAX_BATCH = 12

export type MigrationAsset = {
  id: string
  url: string
  filename: string
  contentType: string
  size: number
  createdAt: string
}

export type MigrationIntakeStatus = "draft" | "submitted" | "processing" | "ready" | "completed"

export type MigrationIntake = {
  id: string
  organizationId: string
  status: MigrationIntakeStatus
  sourceSystem: string
  sourceUrl: string
  sourceNotes: string
  deliveryNotes: string
  locationNotes: string
  catalogNotes: string
  assets: MigrationAsset[]
  aiRequested: boolean
  submittedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}
