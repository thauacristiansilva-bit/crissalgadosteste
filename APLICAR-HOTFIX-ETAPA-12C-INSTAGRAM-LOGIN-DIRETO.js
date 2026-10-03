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

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-")

const backupRoot =
  path.join(
    projectRoot,
    "_backups",
    `hotfix-etapa12c-instagram-login-${stamp}`,
  )

function ensureParent(filePath) {
  fs.mkdirSync(
    path.dirname(filePath),
    { recursive: true },
  )
}

function backup(relative) {
  const src =
    path.join(
      projectRoot,
      relative,
    )

  if (!fs.existsSync(src)) {
    return
  }

  const dst =
    path.join(
      backupRoot,
      relative,
    )

  ensureParent(dst)
  fs.copyFileSync(src, dst)
}

for (
  const [relative, payloadRelative]
  of Object.entries(manifest)
) {
  const source =
    path.join(
      packageRoot,
      payloadRelative,
    )

  const target =
    path.join(
      projectRoot,
      relative,
    )

  backup(relative)
  ensureParent(target)
  fs.copyFileSync(
    source,
    target,
  )
}

// Ajusta os flyers gerados pela ETAPA 12 para JPG,
// formato mais seguro para publicacao automatica no Instagram.
const publicationsRelative =
  "components/admin/marketing-publications-panel.tsx"

const publicationsPath =
  path.join(
    projectRoot,
    publicationsRelative,
  )

if (
  fs.existsSync(
    publicationsPath,
  )
) {
  backup(publicationsRelative)

  let code =
    fs.readFileSync(
      publicationsPath,
      "utf8",
    )

  code = code
    .replace(
      /"image\/png",\s*0\.95/g,
      '"image/jpeg", 0.92',
    )
    .replace(
      /Não foi possível gerar o PNG\./g,
      "Não foi possível gerar o JPG.",
    )
    .replace(
      /new File\(\[blob\], "flyer\.png", \{ type: "image\/png" \}\)/g,
      'new File([blob], "flyer.jpg", { type: "image/jpeg" })',
    )
    .replace(
      /`\$\{?["']?saborflow-?/g,
      (match) => match,
    )
    .replace(
      /\.png`/g,
      ".jpg`",
    )
    .replace(
      /Flyer baixado em PNG\./g,
      "Flyer baixado em JPG.",
    )
    .replace(
      /Gerar e anexar PNG/g,
      "Gerar e anexar JPG",
    )

  fs.writeFileSync(
    publicationsPath,
    code,
    "utf8",
  )
}

// Acrescenta as novas variaveis ao .env.example,
// sem apagar as variaveis antigas do WhatsApp/Meta.
const envPath =
  path.join(
    projectRoot,
    ".env.example",
  )

if (
  fs.existsSync(envPath)
) {
  backup(".env.example")

  let env =
    fs.readFileSync(
      envPath,
      "utf8",
    )

  const block = `
# Instagram API com Instagram Login direto
META_INSTAGRAM_APP_ID=
META_INSTAGRAM_APP_SECRET=
# Opcional. Se vazio, usa APP_PUBLIC_URL + /api/meta/instagram/callback
META_INSTAGRAM_REDIRECT_URI=
`

  if (
    !env.includes(
      "META_INSTAGRAM_APP_ID=",
    )
  ) {
    env =
      env.trimEnd() +
      "\n" +
      block

    fs.writeFileSync(
      envPath,
      env,
      "utf8",
    )
  }
}

console.log("")
console.log(
  "HOTFIX ETAPA 12C - INSTAGRAM LOGIN DIRETO aplicado com sucesso.",
)
console.log("")
console.log("O que mudou:")
console.log(
  "  - OAuth agora abre instagram.com, nao Facebook Login.",
)
console.log(
  "  - Escopos: instagram_business_basic + instagram_business_content_publish.",
)
console.log(
  "  - Publicacao agora usa graph.instagram.com.",
)
console.log(
  "  - Instagram App ID/Secret separados do META_APP_ID/SECRET.",
)
console.log(
  "  - Flyers gerados agora usam JPG para compatibilidade de publicacao.",
)
console.log(
  "  - Renovacao de token de longa duracao preparada.",
)
console.log("")
console.log(
  `Backup: ${path.relative(projectRoot, backupRoot)}`,
)
console.log("")
console.log("Agora execute:")
console.log("  npm run build")
console.log("")
console.log("Se passar:")
console.log("  git add .")
console.log(
  '  git commit -m "Hotfix Etapa 12C - Instagram Login direto"',
)
console.log("  git push origin main")
