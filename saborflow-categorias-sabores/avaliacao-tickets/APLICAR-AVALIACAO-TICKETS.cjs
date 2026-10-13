// SaborFlow — instalador cumulativo com checagem de versões e backup.
// Não altera banco de dados e não envia WhatsApp sem ação humana.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = process.cwd();
const base = __dirname;
const sha = data => crypto.createHash('sha256').update(String(data).replace(/\r\n/g, '\n')).digest('hex');
const manifest = require('./MANIFESTO.json');
function fail(message) { throw new Error(message); }

function replaceOneOrAlready(text, original, wanted, filename) {
  if (text.includes(original)) {
    if (text.split(original).length !== 2) fail(`Trecho repetido em ${filename}; nenhuma alteração aplicada.`);
    return text.replace(original, wanted);
  }
  if (text.includes(wanted)) return text;
  fail(`Estrutura diferente em ${filename}. Nenhum arquivo foi alterado; preserve seu projeto e envie a versão atual para adaptar.`);
}
function transformPrintHtml(text) {
  const f = 'lib/print-order.ts';
  const changes = [
    ['<tr><td>${item.quantity}x ${escapeHtml(item.name)}${modifiers}</td>', '<tr><td><span class="b">${item.quantity}x ${escapeHtml(item.name)}</span>${modifiers}</td>'],
    ['.b{font-weight:800}', '.b{font-weight:700}'],
    ['.big{font-size:22px}', '.big{font-size:20px}'],
    ['.warn{font-size:17px;font-weight:900;border:2px', '.warn{font-size:14px;font-weight:400;border:1px'],
    ['<div class="c b">${escapeHtml(settings?.storeName || "SaborFlow")}</div>', '<div class="c">${escapeHtml(settings?.storeName || "SaborFlow")}</div>'],
    ['<div class="c big b">${order.code}</div>', '<div class="c big">${escapeHtml(order.code)}</div>'],
    ['<span class="b">${order.type === "delivery" ? "DELIVERY" : "RETIRADA"}</span>', '<span class="b">${order.type === "delivery" ? "ENTREGA" : "RETIRADA"}</span>'],
    ['<div class="b">OBS: ${escapeHtml(order.notes)}</div>', '<div>OBS: ${escapeHtml(order.notes)}</div>'],
    ['<tr class="b"><td>TOTAL</td>', '<tr><td>TOTAL</td>'],
  ];
  for (const [a, b] of changes) text = replaceOneOrAlready(text, a, b, f);
  return text;
}
function transformPdf(text) {
  const f = 'app/api/orders/[id]/ticket-pdf/route.ts';
  const changes = [
    ['{ text: settings.storeName.toUpperCase(), bold: true, size: 12 }','{ text: settings.storeName.toUpperCase(), size: 12 }'],
    ['{ text: order.code, bold: true, size: 18 }','{ text: order.code, size: 18 }'],
    ['{ text: `RECEBER: ${stamp(order.requestedFor, timeZone)}`, bold: true, size: 11 }','{ text: `RECEBER: ${stamp(order.requestedFor, timeZone)}`, size: 11 }'],
    ['{ text: `Cliente: ${order.customer.name}` }','{ text: `Cliente: ${order.customer.name}`, bold: true }'],
    ['bold: mode === "kitchen"','bold: true'],
    ['{ text: `OBS: ${order.notes}`, bold: true }','{ text: `OBS: ${order.notes}` }'],
    ['{ text: `TOTAL: ${money(order.total)}`, bold: true, size: 12 }','{ text: `TOTAL: ${money(order.total)}`, size: 12 }'],
  ];
  for (const [a, b] of changes) text = replaceOneOrAlready(text, a, b, f);
  if (!text.includes('order.type === "delivery" ? "DELIVERY" : "RETIRADA"') ||
      !text.includes('"AGENDADO" : "IMEDIATO"}`, bold: true')) {
    fail(`Entrega/retirada não identificada em ${f}`);
  }
  return text;
}
function transformAutoPrint(text) {
  const f = 'INICIAR-IMPRESSAO-AUTOMATICA.ps1';
  const changes = [
    ['bool important = line.Style == "Title" || line.Style == "Alert";', 'bool important = false; // Sem destaque nas informacoes secundarias'],
    ['var font = important ? large : line.Style == "Normal" || line.Style == "Sub" ? normal : bold;', 'var font = (line.Style == "Client" || line.Style == "Item" || line.Style == "DeliveryType") ? bold : normal;'],
    ['Add-Line $(if ($order.type -eq \'delivery\') { \'ENTREGA\' } else { \'RETIRADA\' }) \'Alert\'', 'Add-Line $(if ($order.type -eq \'delivery\') { \'ENTREGA\' } else { \'RETIRADA\' }) \'DeliveryType\''],
    ['Add-Line "CLIENTE: $($order.customer.name)" \'Section\'', 'Add-Line "CLIENTE: $($order.customer.name)" \'Client\''],
  ];
  for (const [a,b] of changes) text = replaceOneOrAlready(text, a, b, f);
  return text;
}

try {
  if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'components', 'admin'))) {
    fail('Abra o terminal na pasta ORIGINAL do SaborFlow (onde estão package.json e components).');
  }
  const changes = [];
  for (const entry of manifest.files) {
    const target = path.join(root, entry.path);
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    if (current === null && !entry.allowed.includes(null)) fail(`Arquivo ausente: ${entry.path}`);
    if (current !== null && !entry.allowed.includes(sha(current))) {
      fail(`Arquivo tem alterações desconhecidas: ${entry.path}. Nenhum arquivo foi alterado. Não iremos sobrescrever suas correções.`);
    }
    const filename = path.join(base, 'payload', entry.path);
    const newText = fs.readFileSync(filename, 'utf8');
    if (sha(newText) !== entry.result) fail(`O ZIP está incompleto ou corrompido: ${entry.path}`);
    if (current !== newText) changes.push({ file: entry.path, target, current, newText });
  }
  for (const [file, transform] of [
    ['lib/print-order.ts', transformPrintHtml],
    ['app/api/orders/[id]/ticket-pdf/route.ts', transformPdf],
    ['INICIAR-IMPRESSAO-AUTOMATICA.ps1', transformAutoPrint],
  ]) {
    const target = path.join(root, file);
    if (!fs.existsSync(target)) fail(`Arquivo de impressão não encontrado: ${file}`);
    const current = fs.readFileSync(target, 'utf8');
    const newText = transform(current);
    if (current !== newText) changes.push({ file, target, current, newText });
  }
  if (!changes.length) {
    console.log('A avaliação e a economia de tinta já estão instaladas. Nenhum arquivo foi modificado.');
    process.exit(0);
  }
  const backup = path.join(path.dirname(root), path.basename(root) + '-backup-avaliacao-tickets-' + Date.now());
  // Prepare todo o backup antes de alterar qualquer arquivo de produção.
  for (const file of changes) if (file.current !== null) {
    const dest = path.join(backup, file.file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, file.current, 'utf8');
  }
  const written = [];
  try {
    for (const file of changes) {
      fs.mkdirSync(path.dirname(file.target), { recursive: true });
      fs.writeFileSync(file.target, file.newText, 'utf8');
      written.push(file);
    }
  } catch (err) {
    for (const file of written.reverse()) {
      if (file.current === null) fs.unlinkSync(file.target);
      else fs.writeFileSync(file.target, file.current, 'utf8');
    }
    throw err;
  }
  console.log(`SaborFlow atualizado: ${changes.length} arquivo(s).`);
  console.log('Backup fora do projeto: ' + backup);
  console.log('Agora execute: npm run typecheck');
  console.log('Faça commit/push somente se a validação terminar sem erros.');
} catch (error) {
  console.error('Instalação CANCELADA: ' + error.message);
  process.exitCode = 1;
}
