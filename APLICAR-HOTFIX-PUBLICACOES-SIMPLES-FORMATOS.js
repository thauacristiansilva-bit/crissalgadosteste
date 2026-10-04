const fs = require("fs")
const path = require("path")

const projectRoot = process.cwd()
const packageRoot = __dirname

const manifest = JSON.parse(
  fs.readFileSync(
    path.join(packageRoot, "manifest.json"),
    "utf8",
  ),
)

const requiredFiles = [
  "components/admin/marketing-publications-panel.tsx",
  "app/api/marketing-publications/assets/route.ts",
  "lib/marketing-auto-publisher.ts",
  "components/admin/meta-instagram-connection-card.tsx",
]

for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(projectRoot, relative))) {
    console.error("")
    console.error(`ERRO: arquivo obrigatório não encontrado: ${relative}`)
    console.error("A ETAPA 12 e a ETAPA 12C precisam estar aplicadas antes deste hotfix.")
    process.exit(1)
  }
}

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-")

const backupRoot =
  path.join(
    projectRoot,
    "_backups",
    `hotfix-publicacoes-simples-${stamp}`,
  )

function ensureParent(filePath) {
  fs.mkdirSync(
    path.dirname(filePath),
    { recursive: true },
  )
}

function backup(relative) {
  const source =
    path.join(projectRoot, relative)

  if (!fs.existsSync(source)) {
    return
  }

  const target =
    path.join(backupRoot, relative)

  ensureParent(target)
  fs.copyFileSync(source, target)
}

for (
  const [relative, payloadRelative]
  of Object.entries(manifest)
) {
  backup(relative)

  const source =
    path.join(packageRoot, payloadRelative)

  const target =
    path.join(projectRoot, relative)

  ensureParent(target)
  fs.copyFileSync(source, target)
}

console.log("")
console.log("HOTFIX DE PUBLICACOES SIMPLES aplicado com sucesso.")
console.log("")
console.log("Mudancas:")
console.log("  - Remove o criador manual de flyer/logo da tela.")
console.log("  - Agora a arte e criada fora e apenas anexada/agendada.")
console.log("  - Instagram Feed: 1:1 (1080x1080).")
console.log("  - Instagram Story: 9:16 (1080x1920).")
console.log("  - WhatsApp Status: 9:16 (1080x1920).")
console.log("  - PNG/WEBP/JPG de entrada sao normalizados para JPG.")
console.log("  - Formato incorreto e bloqueado antes do agendamento.")
console.log("  - Upload usa R2 automaticamente quando as variaveis R2 estao configuradas.")
console.log("  - Remove o botao manual Publicada do Instagram.")
console.log("  - Corrige o cron claimed:0 causado pelo RLS sem bypass.")
console.log("")
console.log(`Backup: ${path.relative(projectRoot, backupRoot)}`)
console.log("")
console.log("Agora execute:")
console.log("  npm run build")
console.log("")
console.log("Se passar:")
console.log("  git add .")
console.log('  git commit -m "Simplificar publicacoes e corrigir fila Instagram"')
console.log("  git push origin main")
