const fs = require("fs")
const path = require("path")

const root = process.cwd()
const packageDir = __dirname
const manifest = JSON.parse(
  fs.readFileSync(path.join(packageDir, "manifest.json"), "utf8"),
)

const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const backupDir = path.join(
  root,
  "_backups",
  `etapa-12c-meta-${stamp}`,
)

fs.mkdirSync(backupDir, { recursive: true })

function ensureParent(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
}

function backupIfExists(relative) {
  const target = path.join(root, relative)
  if (!fs.existsSync(target)) return

  const backup = path.join(backupDir, relative)
  ensureParent(backup)
  fs.copyFileSync(target, backup)
}

for (const [relative, payloadRelative] of Object.entries(manifest)) {
  backupIfExists(relative)
  const target = path.join(root, relative)
  const source = path.join(packageDir, payloadRelative)
  ensureParent(target)
  fs.copyFileSync(source, target)
}

const panelRelative =
  "components/admin/marketing-publications-panel.tsx"
const panelPath = path.join(root, panelRelative)

if (!fs.existsSync(panelPath)) {
  throw new Error(
    `Arquivo ${panelRelative} nao encontrado. A ETAPA 12 precisa estar aplicada antes da 12C.`,
  )
}

backupIfExists(panelRelative)

let panel = fs.readFileSync(panelPath, "utf8")

const importLine =
  'import { MetaInstagramConnectionCard } from "@/components/admin/meta-instagram-connection-card"'

if (!panel.includes(importLine)) {
  const anchor =
    'import type { StoreSettings } from "@/lib/types"'

  if (!panel.includes(anchor)) {
    throw new Error(
      "Nao encontrei o ponto de importacao no marketing-publications-panel.tsx.",
    )
  }

  panel = panel.replace(
    anchor,
    `${anchor}\n${importLine}`,
  )
}

if (!panel.includes("<MetaInstagramConnectionCard />")) {
  const anchor =
    '<div className="space-y-5">'

  if (!panel.includes(anchor)) {
    throw new Error(
      "Nao encontrei o inicio do painel de publicacoes para inserir a conexao Meta.",
    )
  }

  panel = panel.replace(
    anchor,
    `${anchor}\n      <MetaInstagramConnectionCard />`,
  )
}

fs.writeFileSync(panelPath, panel, "utf8")

const envPath = path.join(root, ".env.example")
if (fs.existsSync(envPath)) {
  backupIfExists(".env.example")
  let env = fs.readFileSync(envPath, "utf8")

  const block = `
# ETAPA 12C - Publicacao automatica Instagram / Meta
META_APP_ID=
META_APP_SECRET=
META_GRAPH_VERSION=v25.0
META_TOKEN_ENCRYPTION_KEY=
META_OAUTH_STATE_SECRET=
META_INSTAGRAM_REDIRECT_URI=
APP_PUBLIC_URL=
CRON_SECRET=
# Fortaleza/Brasilia = -180. Ajuste se sua operacao usar outro fuso fixo.
MARKETING_TIMEZONE_OFFSET_MINUTES=-180
`

  if (!env.includes("META_TOKEN_ENCRYPTION_KEY=")) {
    env = env.trimEnd() + "\n" + block
    fs.writeFileSync(envPath, env, "utf8")
  }
}

console.log("")
console.log("ETAPA 12C - PUBLICACAO AUTOMATICA META aplicada.")
console.log(`Backup: ${path.relative(root, backupDir)}`)
console.log("")
console.log("Agora execute:")
console.log("  node APLICAR-MIGRATION-ETAPA-12C.cjs")
console.log("  npm run build")
console.log("")
console.log("Depois configure as variaveis da Meta no Railway e crie o Cron.")
