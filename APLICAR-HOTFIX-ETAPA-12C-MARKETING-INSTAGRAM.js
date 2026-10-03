const fs = require("fs")
const path = require("path")

const root = process.cwd()
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const backupRoot = path.join(root, "_backups", `hotfix-etapa12c-marketing-${stamp}`)

function backup(relative) {
  const src = path.join(root, relative)
  if (!fs.existsSync(src)) {
    throw new Error(`Arquivo nao encontrado: ${relative}`)
  }
  const dst = path.join(backupRoot, relative)
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  fs.copyFileSync(src, dst)
}

function write(relative, content) {
  fs.writeFileSync(path.join(root, relative), content, "utf8")
}

const publicationsRelative = "components/admin/marketing-publications-panel.tsx"
const dashboardRelative = "components/admin/admin-dashboard.tsx"
const connectionCardRelative = "components/admin/meta-instagram-connection-card.tsx"

backup(publicationsRelative)
backup(dashboardRelative)

if (!fs.existsSync(path.join(root, connectionCardRelative))) {
  throw new Error(
    "O arquivo meta-instagram-connection-card.tsx nao existe. A ETAPA 12C precisa estar aplicada antes deste hotfix."
  )
}

// 1. Conecta o cartão Meta à tela de Publicações.
let publications = fs.readFileSync(path.join(root, publicationsRelative), "utf8")

const metaImport =
  'import { MetaInstagramConnectionCard } from "@/components/admin/meta-instagram-connection-card"'

if (!publications.includes(metaImport)) {
  const typeImport = 'import type { StoreSettings } from "@/lib/types"'
  if (!publications.includes(typeImport)) {
    throw new Error("Nao encontrei o ponto de importacao em marketing-publications-panel.tsx.")
  }
  publications = publications.replace(
    typeImport,
    `${typeImport}\n${metaImport}`
  )
}

if (!publications.includes("<MetaInstagramConnectionCard />")) {
  const returnAnchor =
    '    <section className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">'

  if (!publications.includes(returnAnchor)) {
    throw new Error("Nao encontrei o inicio visual da Etapa 12.")
  }

  publications = publications.replace(
    '  return (\n' + returnAnchor,
    '  return (\n    <div className="space-y-5">\n      <MetaInstagramConnectionCard />\n' + returnAnchor
  )

  const closingAnchor = "    </section>\n  )\n}"
  if (!publications.includes(closingAnchor)) {
    throw new Error("Nao encontrei o fechamento da tela de Publicacoes.")
  }

  publications = publications.replace(
    closingAnchor,
    "    </section>\n    </div>\n  )\n}"
  )
}

write(publicationsRelative, publications)

// 2. Torna o menu óbvio para o usuário.
let dashboard = fs.readFileSync(path.join(root, dashboardRelative), "utf8")

const oldMenu =
  '{ key: "marketing", label: "Cupons e campanhas", icon: Megaphone, group: "clientes" }'
const newMenu =
  '{ key: "marketing", label: "Marketing e divulgações", icon: Megaphone, group: "clientes" }'

if (dashboard.includes(oldMenu)) {
  dashboard = dashboard.replace(oldMenu, newMenu)
} else if (
  !dashboard.includes('{ key: "marketing", label: "Marketing e divulgações"')
) {
  console.warn("AVISO: o nome atual do menu de marketing e diferente; nao foi renomeado.")
}

write(dashboardRelative, dashboard)

console.log("")
console.log("HOTFIX ETAPA 12C aplicado com sucesso.")
console.log("")
console.log("Mudancas:")
console.log("  - Menu: Marketing e divulgacoes")
console.log("  - Cartao Conectar Instagram exibido no topo de Publicacoes")
console.log(`  - Backup: ${path.relative(root, backupRoot)}`)
console.log("")
console.log("Agora execute:")
console.log("  npm run build")
console.log("")
console.log("Se passar:")
console.log("  git add .")
console.log('  git commit -m "Hotfix Etapa 12C - conectar Instagram ao Marketing"')
console.log("  git push origin main")
