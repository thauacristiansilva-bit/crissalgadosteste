$ErrorActionPreference = "Stop"

$tempNode = Join-Path $env:TEMP "saborflow-hotfix-13-9-async-v2.cjs"

$node = @'
const fs = require("fs");
const path = require("path");

const tsPath = path.join(process.cwd(), "node_modules", "typescript");
const ts = require(tsPath);

const apiRoot = path.join(process.cwd(), "app", "api");
const targetNames = new Set([
  "checkAuthRateLimit",
  "registerAuthFailure",
  "clearAuthFailures",
]);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

function isFunctionLike(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

function hasAsync(node) {
  return Boolean(
    node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword,
    ),
  );
}

function getFunctionName(node) {
  if (
    (ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isMethodDeclaration(node)) &&
    node.name
  ) {
    return node.name.getText();
  }

  if (
    (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
    ts.isVariableDeclaration(node.parent) &&
    ts.isIdentifier(node.parent.name)
  ) {
    return node.parent.name.text;
  }

  return null;
}

function directCalls(fn) {
  const calls = [];

  function visit(node) {
    if (node !== fn && isFunctionLike(node)) return;

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression)
    ) {
      calls.push({
        name: node.expression.text,
        node,
        awaited: ts.isAwaitExpression(node.parent),
      });
    }

    ts.forEachChild(node, visit);
  }

  if (fn.body) visit(fn.body);
  return calls;
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

  for (let pass = 0; pass < 12; pass += 1) {
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const functions = [];

    function collect(node) {
      if (isFunctionLike(node) && node.body) {
        functions.push({
          node,
          name: getFunctionName(node),
          calls: directCalls(node),
          async: hasAsync(node),
        });
      }
      ts.forEachChild(node, collect);
    }

    collect(source);

    // Funcoes diretamente afetadas sao as que chamam o rate limiter
    // ou algum helper local ja identificado como afetado.
    const affected = new Set();
    let changedSet = true;

    while (changedSet) {
      changedSet = false;

      for (const fn of functions) {
        if (!fn.name) continue;

        const isAffected = fn.calls.some(
          (call) =>
            targetNames.has(call.name) ||
            affected.has(call.name),
        );

        if (isAffected && !affected.has(fn.name)) {
          affected.add(fn.name);
          changedSet = true;
        }
      }
    }

    const edits = [];

    // Marca como async somente funcoes ligadas ao rate limit.
    for (const fn of functions) {
      if (
        fn.name &&
        affected.has(fn.name) &&
        !fn.async
      ) {
        edits.push({
          pos: fn.node.getStart(source),
          text: "async ",
        });
      }
    }

    // Aguarda chamadas aos helpers afetados.
    for (const fn of functions) {
      for (const call of fn.calls) {
        if (
          affected.has(call.name) &&
          !call.awaited
        ) {
          edits.push({
            pos: call.node.getStart(source),
            text: "await ",
          });
        }
      }
    }

    // Tambem corrige os awaits diretos do rate limiter dentro de
    // funcoes sem nome, se houver.
    for (const fn of functions) {
      const directTarget = fn.calls.some(
        (call) => targetNames.has(call.name),
      );

      if (directTarget && !fn.async) {
        const already = edits.some(
          (edit) => edit.pos === fn.node.getStart(source),
        );
        if (!already) {
          edits.push({
            pos: fn.node.getStart(source),
            text: "async ",
          });
        }
      }
    }

    // Remove duplicatas de edicao.
    const unique = [];
    const seen = new Set();
    for (const edit of edits) {
      const key = `${edit.pos}:${edit.text}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(edit);
      }
    }

    if (unique.length === 0) break;

    totalEdits += unique.length;
    text = applyEdits(text, unique);
  }

  if (totalEdits > 0) {
    fs.writeFileSync(
      file,
      text.replace(/\n+$/, "\n"),
      "utf8",
    );
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
  `HOTFIX ASYNC V2: ${totalEdits} ajuste(s) em ${changedFiles} arquivo(s).`,
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
  throw "Falha ao aplicar hotfix async V2."
}

Write-Host ""
Write-Host "Verificando diff..."
git diff --check
if ($LASTEXITCODE -ne 0) {
  throw "git diff --check encontrou problema."
}

Write-Host ""
Write-Host "Executando build..."
npm.cmd run build
$buildExit = $LASTEXITCODE

git restore -- next-env.d.ts 2>$null

if ($buildExit -ne 0) {
  throw "BUILD AINDA FALHOU. Envie apenas o novo erro."
}

Write-Host ""
Write-Host "=============================================="
Write-Host "HOTFIX 13.9 V2 OK - BUILD APROVADO"
Write-Host "=============================================="
Write-Host "- funcoes ligadas ao rate limit convertidas para async"
Write-Host "- chamadas dos helpers aguardadas corretamente"
Write-Host "- ainda falta aplicar a migration 033 no PostgreSQL"
Write-Host "- ainda nao foi feito commit nem deploy"
