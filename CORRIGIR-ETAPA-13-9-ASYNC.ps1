$ErrorActionPreference = "Stop"

$tempNode = Join-Path $env:TEMP "saborflow-hotfix-13-9-async.cjs"

$node = @'
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const apiRoot = path.join(process.cwd(), "app", "api");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

function hasAsyncModifier(node) {
  return Boolean(
    node.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
    ),
  );
}

function isFunctionLike(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

function functionName(node) {
  if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node)) && node.name) {
    return node.name.getText();
  }

  if (
    ts.isArrowFunction(node) &&
    ts.isVariableDeclaration(node.parent) &&
    ts.isIdentifier(node.parent.name)
  ) {
    return node.parent.name.text;
  }

  return null;
}

function directAwaitExists(fn) {
  let found = false;

  function visit(node) {
    if (found) return;

    if (node !== fn && isFunctionLike(node)) {
      return;
    }

    if (ts.isAwaitExpression(node)) {
      found = true;
      return;
    }

    ts.forEachChild(node, visit);
  }

  if (fn.body) visit(fn.body);
  return found;
}

function collectLocalAsyncNames(sourceFile) {
  const names = new Set();

  function visit(node) {
    if (isFunctionLike(node) && hasAsyncModifier(node)) {
      const name = functionName(node);
      if (name) names.add(name);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return names;
}

function applyEdits(text, edits) {
  edits.sort((a, b) => b.pos - a.pos);
  let next = text;

  for (const edit of edits) {
    next =
      next.slice(0, edit.pos) +
      edit.text +
      next.slice(edit.pos);
  }

  return next;
}

function fixFile(file) {
  let text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");

  if (!text.includes("@/lib/security/rate-limit")) {
    return { changed: false, edits: 0 };
  }

  let totalEdits = 0;

  for (let pass = 0; pass < 10; pass += 1) {
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const edits = [];

    // 1) Qualquer funcao que ganhou await precisa virar async.
    function markAsync(node) {
      if (
        isFunctionLike(node) &&
        node.body &&
        directAwaitExists(node) &&
        !hasAsyncModifier(node)
      ) {
        edits.push({
          pos: node.getStart(source),
          text: "async ",
        });
      }

      ts.forEachChild(node, markAsync);
    }

    markAsync(source);

    if (edits.length > 0) {
      totalEdits += edits.length;
      text = applyEdits(text, edits);
      continue;
    }

    // 2) Agora que sabemos quais helpers locais sao async,
    //    seus chamadores tambem precisam usar await.
    const reparsed = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const asyncNames = collectLocalAsyncNames(reparsed);
    const callEdits = [];

    function fixCalls(node) {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        asyncNames.has(node.expression.text)
      ) {
        const parent = node.parent;

        const alreadyAwaited =
          ts.isAwaitExpression(parent);

        // Nao altera chamadas recursivas dentro da propria declaracao
        // quando ja estiverem corretamente aguardadas.
        if (!alreadyAwaited) {
          callEdits.push({
            pos: node.getStart(reparsed),
            text: "await ",
          });
        }
      }

      ts.forEachChild(node, fixCalls);
    }

    fixCalls(reparsed);

    if (callEdits.length === 0) break;

    totalEdits += callEdits.length;
    text = applyEdits(text, callEdits);
  }

  if (totalEdits > 0) {
    text = text.replace(/\n+$/, "\n");
    fs.writeFileSync(file, text, "utf8");
    return { changed: true, edits: totalEdits };
  }

  return { changed: false, edits: 0 };
}

let changedFiles = 0;
let totalEdits = 0;

for (const file of walk(apiRoot)) {
  const result = fixFile(file);
  if (result.changed) {
    changedFiles += 1;
    totalEdits += result.edits;
    console.log(
      "OK:",
      path.relative(process.cwd(), file),
      `(${result.edits} ajuste(s))`,
    );
  }
}

console.log("");
console.log(
  `HOTFIX ASYNC APLICADO: ${totalEdits} ajuste(s) em ${changedFiles} arquivo(s).`,
);
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
  throw "Falha ao aplicar hotfix async da Etapa 13.9."
}

Write-Host ""
Write-Host "Verificando diff..."
git diff --check
if ($LASTEXITCODE -ne 0) {
  throw "git diff --check encontrou problema."
}

Write-Host ""
Write-Host "Executando build novamente..."
npm.cmd run build
$buildExit = $LASTEXITCODE

git restore -- next-env.d.ts 2>$null

if ($buildExit -ne 0) {
  throw "BUILD AINDA FALHOU. Envie apenas o novo erro."
}

Write-Host ""
Write-Host "=============================================="
Write-Host "HOTFIX 13.9 OK - BUILD APROVADO"
Write-Host "=============================================="
Write-Host "- helpers com await convertidos para async"
Write-Host "- chamadas locais de helpers async aguardadas"
Write-Host "- UTF-8 preservado"
Write-Host "- ainda falta aplicar a migration 033 no PostgreSQL"
Write-Host "- ainda nao foi feito commit nem deploy"
