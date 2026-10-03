const fs = require("fs")
const path = require("path")

const file = path.join("components", "admin", "marketing-publications-panel.tsx")
if (!fs.existsSync(file)) {
  throw new Error(`Arquivo nao encontrado: ${file}. Execute este hotfix na raiz do SaborFlow depois da Etapa 12.`)
}

let content = fs.readFileSync(file, "utf8")
const original = content

content = content.replace(/^\s*Instagram,\r?\n/m, "")
content = content.replace(/<Instagram className="h-4 w-4" \/>/g, '<ImagePlus className="h-4 w-4" />')

if (content === original) {
  if (!content.includes("Instagram,") && !content.includes("<Instagram ")) {
    console.log("Hotfix ja parece aplicado. Nenhuma alteracao necessaria.")
    process.exit(0)
  }
  throw new Error("Nao foi possivel localizar automaticamente o import/uso do icone Instagram.")
}

const backupDir = path.join("_backups", `hotfix-etapa12-instagram-${new Date().toISOString().replace(/[:.]/g, "-")}`)
fs.mkdirSync(backupDir, { recursive: true })
fs.copyFileSync(file, path.join(backupDir, "marketing-publications-panel.tsx"))
fs.writeFileSync(file, content, "utf8")

console.log("")
console.log("HOTFIX ETAPA 12 aplicado com sucesso.")
console.log("O icone Instagram foi substituido por ImagePlus, que ja existe na mesma versao do lucide-react.")
console.log(`Backup: ${backupDir}`)
console.log("")
console.log("Agora execute:")
console.log("  npm run build")
console.log("")
console.log("Se o build passar:")
console.log("  git add .")
console.log('  git commit -m "Hotfix Etapa 12 - icone Instagram"')
console.log("  git push origin main")
