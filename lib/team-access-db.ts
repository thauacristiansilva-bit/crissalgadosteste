import { randomUUID } from "node:crypto"
import {
  hashAdminPassword,
} from "@/lib/admin-user-db"
import { getPostgresPool } from "@/lib/postgres"
import {
  createAuthToken,
  getValidAuthToken,
  revokeOutstandingAuthTokens,
} from "@/lib/security-tokens"
import type {
  OrganizationRole,
} from "@/lib/tenant-context"
import type {
  StaffRole,
} from "@/lib/types"

export type TeamAccessStatus = {
  staffMemberId: number
  name: string
  email: string
  role: StaffRole
  staffActive: boolean
  userId: string | null
  userStatus:
    | "active"
    | "blocked"
    | "pending"
    | null
  membershipStatus:
    | "active"
    | "invited"
    | "disabled"
    | null
  passwordReady: boolean
}

type TeamAccessRow = {
  staff_member_id: number
  name: string
  email: string
  role: StaffRole
  staff_active: boolean
  user_id: string | null
  user_status:
    | "active"
    | "blocked"
    | "pending"
    | null
  membership_status:
    | "active"
    | "invited"
    | "disabled"
    | null
  password_ready: boolean
}

function mapAccess(
  row: TeamAccessRow,
): TeamAccessStatus {
  return {
    staffMemberId:
      Number(row.staff_member_id),
    name: row.name,
    email: row.email || "",
    role: row.role,
    staffActive:
      Boolean(row.staff_active),
    userId: row.user_id,
    userStatus: row.user_status,
    membershipStatus:
      row.membership_status,
    passwordReady:
      Boolean(row.password_ready),
  }
}

export async function listTeamAccess(
  organizationId: string,
) {
  const result =
    await getPostgresPool().query<TeamAccessRow>(
      `
        SELECT
          s.id AS staff_member_id,
          s.name,
          s.email,
          s.role,
          s.active AS staff_active,
          u.id AS user_id,
          u.status AS user_status,
          m.status AS membership_status,
          (u.password_hash IS NOT NULL) AS password_ready
        FROM sf_staff_members s
        LEFT JOIN sf_users u
          ON u.id = s.user_id
        LEFT JOIN sf_memberships m
          ON m.organization_id = s.organization_id
         AND m.user_id = u.id
        WHERE s.organization_id = $1
        ORDER BY s.name ASC, s.id ASC
      `,
      [organizationId],
    )

  return result.rows.map(mapAccess)
}

export async function createTeamInvitation(
  input: {
    organizationId: string
    staffMemberId: number
    invitedByUserId: string
  },
) {
  const pool = getPostgresPool()
  const client = await pool.connect()

  let userId = ""
  let email = ""
  let organizationName = ""
  let organizationSlug = ""
  let alreadyActive = false

  try {
    await client.query("BEGIN")
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [
        `saborflow-team-invite:${input.organizationId}:${input.staffMemberId}`,
      ],
    )

    const staffResult =
      await client.query<{
        id: number
        name: string
        email: string
        phone: string
        role: StaffRole
        active: boolean
        user_id: string | null
        organization_name: string
        organization_slug: string
      }>(
        `
          SELECT
            s.id,
            s.name,
            s.email,
            s.phone,
            s.role,
            s.active,
            s.user_id,
            o.trade_name AS organization_name,
            o.slug AS organization_slug
          FROM sf_staff_members s
          INNER JOIN sf_organizations o
            ON o.id = s.organization_id
          WHERE s.organization_id = $1
            AND s.id = $2
          LIMIT 1
        `,
        [
          input.organizationId,
          input.staffMemberId,
        ],
      )

    const staff = staffResult.rows[0]

    if (!staff) {
      throw new Error(
        "Colaborador não encontrado.",
      )
    }

    email = staff.email
      .trim()
      .toLowerCase()

    if (!email) {
      throw new Error(
        "Cadastre um e-mail no colaborador antes de criar o acesso.",
      )
    }

    if (!staff.active) {
      throw new Error(
        "Ative o colaborador antes de criar o acesso.",
      )
    }

    organizationName =
      staff.organization_name
    organizationSlug =
      staff.organization_slug

    const existingUser =
      await client.query<{
        id: string
        status:
          | "active"
          | "blocked"
          | "pending"
      }>(
        `
          SELECT id, status
          FROM sf_users
          WHERE lower(email) = lower($1)
          LIMIT 1
        `,
        [email],
      )

    if (existingUser.rows[0]) {
      if (
        existingUser.rows[0].status ===
        "blocked"
      ) {
        throw new Error(
          "Este usuário está bloqueado na plataforma.",
        )
      }

      userId =
        existingUser.rows[0].id

      await client.query(
        `
          UPDATE sf_users
          SET
            name = CASE
              WHEN trim(name) = '' THEN $2
              ELSE name
            END,
            phone = COALESCE(NULLIF(phone, ''), NULLIF($3, '')),
            updated_at = now()
          WHERE id = $1
        `,
        [
          userId,
          staff.name.trim(),
          staff.phone.trim(),
        ],
      )
    } else {
      userId = randomUUID()

      await client.query(
        `
          INSERT INTO sf_users (
            id,
            name,
            email,
            phone,
            status,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            'pending',
            now(),
            now()
          )
        `,
        [
          userId,
          staff.name.trim(),
          email,
          staff.phone.trim() || null,
        ],
      )
    }

    const membership =
      await client.query<{
        id: string
        status:
          | "active"
          | "invited"
          | "disabled"
      }>(
        `
          SELECT id, status
          FROM sf_memberships
          WHERE organization_id = $1
            AND user_id = $2
          LIMIT 1
        `,
        [
          input.organizationId,
          userId,
        ],
      )

    alreadyActive =
      membership.rows[0]?.status ===
      "active"

    if (!alreadyActive) {
      if (membership.rows[0]) {
        await client.query(
          `
            UPDATE sf_memberships
            SET
              role = $3,
              status = 'invited',
              invited_by_user_id = $4,
              invited_at = now(),
              accepted_at = NULL,
              updated_at = now()
            WHERE organization_id = $1
              AND user_id = $2
          `,
          [
            input.organizationId,
            userId,
            staff.role,
            input.invitedByUserId,
          ],
        )
      } else {
        await client.query(
          `
            INSERT INTO sf_memberships (
              id,
              organization_id,
              user_id,
              role,
              status,
              invited_by_user_id,
              invited_at,
              created_at,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              'invited',
              $5,
              now(),
              now(),
              now()
            )
          `,
          [
            randomUUID(),
            input.organizationId,
            userId,
            staff.role,
            input.invitedByUserId,
          ],
        )
      }
    }

    await client.query(
      `
        UPDATE sf_staff_members
        SET
          user_id = $3,
          updated_at = now()
        WHERE organization_id = $1
          AND id = $2
      `,
      [
        input.organizationId,
        input.staffMemberId,
        userId,
      ],
    )

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }

  if (alreadyActive) {
    return {
      alreadyActive: true,
      userId,
      email,
      organizationName,
      organizationSlug,
      token: null,
      expiresAt: null,
    }
  }

  await revokeOutstandingAuthTokens(
    userId,
    "invite",
    input.organizationId,
  )

  const created = await createAuthToken({
    userId,
    organizationId:
      input.organizationId,
    purpose: "invite",
    createdByUserId:
      input.invitedByUserId,
    expiresInMinutes: 7 * 24 * 60,
    metadata: {
      organizationName,
      organizationSlug,
      email,
    },
  })

  return {
    alreadyActive: false,
    userId,
    email,
    organizationName,
    organizationSlug,
    token: created.token,
    expiresAt:
      created.expiresAt,
  }
}

export async function getInvitationPreview(
  token: string,
) {
  const valid =
    await getValidAuthToken(
      token,
      "invite",
    )

  if (
    !valid ||
    !valid.organizationId
  ) {
    return null
  }

  const result =
    await getPostgresPool().query<{
      user_id: string
      name: string
      email: string
      password_ready: boolean
      membership_status:
        | "active"
        | "invited"
        | "disabled"
      role: OrganizationRole
      organization_name: string
      organization_slug: string
    }>(
      `
        SELECT
          u.id AS user_id,
          u.name,
          u.email,
          (u.password_hash IS NOT NULL) AS password_ready,
          m.status AS membership_status,
          m.role,
          o.trade_name AS organization_name,
          o.slug AS organization_slug
        FROM sf_users u
        INNER JOIN sf_memberships m
          ON m.user_id = u.id
         AND m.organization_id = $2
        INNER JOIN sf_organizations o
          ON o.id = m.organization_id
        WHERE u.id = $1
          AND u.status <> 'blocked'
        LIMIT 1
      `,
      [
        valid.userId,
        valid.organizationId,
      ],
    )

  const row = result.rows[0]
  if (!row) return null
  if (
    row.membership_status ===
    "disabled"
  ) {
    return null
  }

  return {
    tokenId: valid.id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    passwordReady:
      Boolean(row.password_ready),
    membershipStatus:
      row.membership_status,
    role: row.role,
    organizationId:
      valid.organizationId,
    organizationName:
      row.organization_name,
    organizationSlug:
      row.organization_slug,
    expiresAt:
      valid.expiresAt,
  }
}

export async function acceptTeamInvitation(
  token: string,
  password?: string,
) {
  const preview =
    await getInvitationPreview(token)

  if (!preview) {
    throw new Error(
      "Convite inválido ou expirado.",
    )
  }

  const nextPassword =
    password?.trim() || ""

  if (
    !preview.passwordReady &&
    nextPassword.length < 8
  ) {
    throw new Error(
      "Crie uma senha com pelo menos 8 caracteres.",
    )
  }

  const client =
    await getPostgresPool().connect()

  try {
    await client.query("BEGIN")

    const consumed =
      await client.query(
        `
          UPDATE sf_auth_tokens
          SET used_at = now()
          WHERE id = $1
            AND used_at IS NULL
            AND expires_at > now()
          RETURNING id
        `,
        [preview.tokenId],
      )

    if (!consumed.rowCount) {
      throw new Error(
        "Este convite já foi usado ou expirou.",
      )
    }

    if (!preview.passwordReady) {
      await client.query(
        `
          UPDATE sf_users
          SET
            password_hash = $2,
            password_updated_at = now(),
            status = 'active',
            updated_at = now()
          WHERE id = $1
        `,
        [
          preview.userId,
          hashAdminPassword(
            nextPassword,
          ),
        ],
      )
    } else {
      await client.query(
        `
          UPDATE sf_users
          SET
            status = 'active',
            updated_at = now()
          WHERE id = $1
            AND status <> 'blocked'
        `,
        [preview.userId],
      )
    }

    await client.query(
      `
        UPDATE sf_memberships
        SET
          status = 'active',
          accepted_at = now(),
          updated_at = now()
        WHERE organization_id = $1
          AND user_id = $2
          AND status = 'invited'
      `,
      [
        preview.organizationId,
        preview.userId,
      ],
    )

    await client.query(
      `
        UPDATE sf_staff_members
        SET
          user_id = $3,
          active = true,
          updated_at = now()
        WHERE organization_id = $1
          AND lower(email) = lower($2)
      `,
      [
        preview.organizationId,
        preview.email,
        preview.userId,
      ],
    )

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }

  return {
    email: preview.email,
    organizationName:
      preview.organizationName,
    passwordCreated:
      !preview.passwordReady,
  }
}

export async function disableTeamAccess(
  organizationId: string,
  userId: string,
) {
  const client =
    await getPostgresPool().connect()

  try {
    await client.query("BEGIN")

    const membership =
      await client.query<{
        role: OrganizationRole
      }>(
        `
          SELECT role
          FROM sf_memberships
          WHERE organization_id = $1
            AND user_id = $2
          LIMIT 1
        `,
        [organizationId, userId],
      )

    if (!membership.rows[0]) {
      throw new Error(
        "Acesso não encontrado.",
      )
    }

    if (
      membership.rows[0].role ===
      "owner"
    ) {
      throw new Error(
        "O proprietário da empresa não pode ser desativado por esta tela.",
      )
    }

    await client.query(
      `
        UPDATE sf_memberships
        SET
          status = 'disabled',
          updated_at = now()
        WHERE organization_id = $1
          AND user_id = $2
      `,
      [organizationId, userId],
    )

    await client.query(
      `
        UPDATE sf_staff_members
        SET
          active = false,
          updated_at = now()
        WHERE organization_id = $1
          AND user_id = $2
      `,
      [organizationId, userId],
    )

    await client.query(
      `
        UPDATE sf_auth_tokens
        SET used_at = COALESCE(used_at, now())
        WHERE organization_id = $1
          AND user_id = $2
          AND used_at IS NULL
      `,
      [organizationId, userId],
    )

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function createTeamPasswordReset(
  input: {
    organizationId: string
    targetUserId: string
    createdByUserId: string
    actorRole: OrganizationRole
  },
) {
  const result =
    await getPostgresPool().query<{
      email: string
      role: OrganizationRole
      status:
        | "active"
        | "invited"
        | "disabled"
    }>(
      `
        SELECT
          u.email,
          m.role,
          m.status
        FROM sf_memberships m
        INNER JOIN sf_users u
          ON u.id = m.user_id
        WHERE m.organization_id = $1
          AND m.user_id = $2
        LIMIT 1
      `,
      [
        input.organizationId,
        input.targetUserId,
      ],
    )

  const target = result.rows[0]

  if (
    !target ||
    target.status !== "active"
  ) {
    throw new Error(
      "O usuário precisa ter acesso ativo para redefinir a senha.",
    )
  }

  if (
    target.role === "owner" &&
    input.actorRole !== "owner"
  ) {
    throw new Error(
      "Somente um proprietário pode gerar recuperação para outro proprietário.",
    )
  }

  await revokeOutstandingAuthTokens(
    input.targetUserId,
    "password_reset",
    input.organizationId,
  )

  const created =
    await createAuthToken({
      userId:
        input.targetUserId,
      organizationId:
        input.organizationId,
      purpose:
        "password_reset",
      createdByUserId:
        input.createdByUserId,
      expiresInMinutes: 30,
      metadata: {
        email: target.email,
      },
    })

  return {
    email: target.email,
    token: created.token,
    expiresAt:
      created.expiresAt,
  }
}
