const fs = require("fs");
const path = require("path");

const root = process.cwd();
const tsconfigPath = path.join(root, "tsconfig.json");

if (!fs.existsSync(tsconfigPath)) {
  console.error("ERRO: tsconfig.json não encontrado. Execute este arquivo na raiz do projeto Sabor Flow.");
  process.exit(1);
}

const backupDir = path.join(root, "_backups");
fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `tsconfig-before-hotfix-etapa12-${stamp}.json`);
fs.copyFileSync(tsconfigPath, backupPath);

let raw = fs.readFileSync(tsconfigPath, "utf8");

// Remove BOM if present.
raw = raw.replace(/^\uFEFF/, "");

let config;
try {
  config = JSON.parse(raw);
} catch (error) {
  console.error("ERRO: não consegui ler o tsconfig.json como JSON.");
  console.error(error.message);
  process.exit(1);
}

const requiredExcludes = [
  "node_modules",
  ".next",
  "_backups",
  "_backups/**/*",
  "ARQUIVOS-GERADOS",
  "ARQUIVOS-GERADOS/**/*"
];

const current = Array.isArray(config.exclude) ? config.exclude : [];
config.exclude = [...new Set([...current, ...requiredExcludes])];

fs.writeFileSync(tsconfigPath, JSON.stringify(config, null, 2) + "\n", "utf8");

console.log("");
console.log("HOTFIX ETAPA 12 - TYPECHECK aplicado com sucesso.");
console.log("As pastas de backup e ARQUIVOS-GERADOS foram excluidas do TypeScript.");
console.log(`Backup do tsconfig: ${path.relative(root, backupPath)}`);
console.log("");
console.log("Agora execute:");
console.log("  npm run build");
console.log("");
console.log("Se passar:");
console.log('  git add .');
console.log('  git commit -m "Hotfix Etapa 12 - excluir backups do typecheck"');
console.log("  git push origin main");
console.log("");
