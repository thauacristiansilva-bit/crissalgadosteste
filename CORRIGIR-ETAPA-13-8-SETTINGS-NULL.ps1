$ErrorActionPreference = "Stop"

$arquivo = "app/api/admin/customers/route.ts"
$tempNode = Join-Path $env:TEMP "saborflow-hotfix-13-8-settings.cjs"

if (-not (Test-Path $arquivo)) {
  throw "Arquivo nao encontrado: $arquivo"
}

$node = @'
const fs = require("fs");

const file = "app/api/admin/customers/route.ts";
let content = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");

const oldText = `  const settings = await getTenantSettings(session.organizationId)
  const created = []`;

const newText = `  const settings = await getTenantSettings(session.organizationId)

  if (!settings) {
    return NextResponse.json(
      { error: "Configuracao da organizacao nao encontrada." },
      { status: 503 },
    )
  }

  const created = []`;

if (!content.includes(oldText)) {
  throw new Error("Trecho esperado nao encontrado. Nenhum arquivo foi alterado.");
}

content = content.replace(oldText, newText);
content = content.replace(/\n+$/, "\n");
fs.writeFileSync(file, content, "utf8");

console.log("HOTFIX 13.8 APLICADO.");
console.log("- settings agora e validado antes de usar city/state.");
console.log("- UTF-8 preservado.");
console.log("- ainda nao foi feito commit nem deploy.");
'@

[System.IO.File]::WriteAllText(
  $tempNode,
  $node,
  (New-Object System.Text.UTF8Encoding($false))
)

node $tempNode
$exitCode = $LASTEXITCODE
Remove-Item $tempNode -Force -ErrorAction SilentlyContinue

if ($exitCode -ne 0) {
  throw "Falha ao aplicar o hotfix 13.8."
}
