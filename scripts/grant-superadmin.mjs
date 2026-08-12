import pg from "pg"
import crypto from "node:crypto"

const { Pool } = pg
const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error("DATABASE_URL não está configurada.")

const email = (process.argv[2] || process.env.SUPERADMIN_EMAIL || process.env.ADMIN_EMAIL || "").trim().toLowerCase()
const role = (process.argv[3] || "owner").trim().toLowerCase()
if (!email) throw new Error("Informe o e-mail: node scripts/grant-superadmin.mjs email@dominio.com [owner|operator|support|finance]")
if (!["owner", "operator", "support", "finance"].includes(role)) throw new Error("Papel de Superadmin inválido.")

const pool = new Pool({ connectionString, max: 1 })
try {
  const user = await pool.query(`SELECT id, email FROM sf_users WHERE lower(email) = lower($1) AND status = 'active' LIMIT 1`, [email])
  if (!user.rows[0]) throw new Error(`Usuário ativo não encontrado para ${email}. Faça login/cadastro no SaborFlow antes de conceder Superadmin.`)
  const id = crypto.randomUUID()
  await pool.query(`
    INSERT INTO sf_platform_admins (id, user_id, role, status, created_by_user_id, metadata)
    VALUES ($1, $2, $3, 'active', $2, jsonb_build_object('grantedBy', 'server-console', 'grantedAt', now()))
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = now()
  `, [id, user.rows[0].id, role])
  console.log(`OK Superadmin: ${user.rows[0].email} (${role})`)
} finally {
  await pool.end()
}
